/**
 * UIImage.ts - UI Image Node
 *
 * Renders images in canvas-based 3D UI panels with object-fit support.
 * Loads images asynchronously via the shared image cache and redraws
 * when ready. Supports contain, cover, fill, none, and scale-down modes.
 */

import Yoga from "yoga-layout";
import type * as YogaTypes from "yoga-layout";
import { every, isArray, isBoolean, isNumber, isString } from "lodash-es";

import { Node } from "./Node";
import { Display, isDisplay } from "../extras/ui/yoga";
import { fillRoundRect, imageRoundRect } from "../extras/ui/roundRect";
import { loadCachedImage } from "../extras/ui/imageCache";
import type {
  UIImageData,
  DisplayType,
  EdgeValue,
  UIContext,
} from "../types/rendering/nodes";

type ObjectFitMode = "fill" | "contain" | "cover" | "none" | "scale-down";

const objectFitModes: ReadonlySet<string> = new Set([
  "fill",
  "contain",
  "cover",
  "none",
  "scale-down",
]);

function isObjectFit(value: string): value is ObjectFitMode {
  return objectFitModes.has(value);
}

const defaults = {
  display: "flex",
  src: null,
  width: null,
  height: null,
  absolute: false,
  top: null,
  right: null,
  bottom: null,
  left: null,
  objectFit: "fill",
  backgroundColor: null,
  borderRadius: 0,
  margin: 0,
};

const isBrowser = typeof window !== "undefined";

export class UIImage extends Node {
  // Private properties
  _display!: DisplayType;
  _src!: string | null;
  _width!: number | null;
  _height!: number | null;
  _absolute!: boolean;
  _top!: number | null;
  _right!: number | null;
  _bottom!: number | null;
  _left!: number | null;
  _objectFit!: ObjectFitMode;
  _backgroundColor!: string | null;
  _borderRadius!: number;
  _margin!: EdgeValue;

  // UI properties
  ui?: UIContext;
  yogaNode?: YogaTypes.Node;
  box?: { left: number; top: number; width: number; height: number };

  constructor(data: UIImageData = {}) {
    super(data);
    this.name = "uiimage";

    this.display =
      (data.display as DisplayType | undefined) ??
      (defaults.display as DisplayType);
    this.src = data.src ?? defaults.src;
    this.width = (data.width as number | null | undefined) ?? defaults.width;
    this.height = (data.height as number | null | undefined) ?? defaults.height;
    this.absolute = data.absolute ?? defaults.absolute;
    this.top = data.top ?? defaults.top;
    this.right = data.right ?? defaults.right;
    this.bottom = data.bottom ?? defaults.bottom;
    this.left = data.left ?? defaults.left;
    this.objectFit =
      (data.objectFit as ObjectFitMode | undefined) ??
      (defaults.objectFit as ObjectFitMode);
    this.backgroundColor = data.backgroundColor ?? defaults.backgroundColor;
    this.borderRadius = data.borderRadius ?? defaults.borderRadius;
    this.margin = (data.margin as EdgeValue | undefined) ?? defaults.margin;
  }

  draw(ctx: CanvasRenderingContext2D, offsetLeft: number, offsetTop: number) {
    if (this._display === "none" || !this.yogaNode || !this.ui) return;

    const left = offsetLeft + this.yogaNode.getComputedLeft();
    const top = offsetTop + this.yogaNode.getComputedTop();
    const width = this.yogaNode.getComputedWidth();
    const height = this.yogaNode.getComputedHeight();

    // Draw background
    if (this._backgroundColor) {
      fillRoundRect(
        ctx,
        left,
        top,
        width,
        height,
        this._borderRadius * this.ui!._res,
        this._backgroundColor,
      );
    }

    // Load and draw image
    if (this._src) {
      const img = loadCachedImage(this._src, () => this.ui?.redraw());
      if (img) {
        const imgNaturalW = img.naturalWidth;
        const imgNaturalH = img.naturalHeight;

        if (imgNaturalW > 0 && imgNaturalH > 0) {
          const { drawX, drawY, drawW, drawH } = computeObjectFit(
            this._objectFit,
            left,
            top,
            width,
            height,
            imgNaturalW,
            imgNaturalH,
          );

          const radius = this._borderRadius * this.ui!._res;
          imageRoundRect(
            ctx,
            left,
            top,
            width,
            height,
            radius,
            img,
            drawX,
            drawY,
            drawW,
            drawH,
          );
        }
      }
    }

    this.box = { left, top, width, height };
  }

  mount() {
    if (!isBrowser) return;
    this.ui = (this.parent as Node & { ui?: UIContext })?.ui;
    if (!this.ui) return console.error("uiimage: must be child of ui node");

    this.yogaNode = Yoga.Node.create();
    this.yogaNode.setMeasureFunc(this.measureImageFunc());
    this.yogaNode.setDisplay(Display[this._display]);
    this.yogaNode.setWidth(
      this._width === null ? undefined : this._width * this.ui!._res,
    );
    this.yogaNode.setHeight(
      this._height === null ? undefined : this._height * this.ui!._res,
    );
    this.yogaNode.setPositionType(
      this._absolute
        ? Yoga.POSITION_TYPE_ABSOLUTE
        : Yoga.POSITION_TYPE_RELATIVE,
    );
    this.yogaNode.setPosition(
      Yoga.EDGE_TOP,
      isNumber(this._top) ? this._top * this.ui!._res : undefined,
    );
    this.yogaNode.setPosition(
      Yoga.EDGE_RIGHT,
      isNumber(this._right) ? this._right * this.ui!._res : undefined,
    );
    this.yogaNode.setPosition(
      Yoga.EDGE_BOTTOM,
      isNumber(this._bottom) ? this._bottom * this.ui!._res : undefined,
    );
    this.yogaNode.setPosition(
      Yoga.EDGE_LEFT,
      isNumber(this._left) ? this._left * this.ui!._res : undefined,
    );
    if (isArray(this._margin)) {
      const [marginTop, marginRight, marginBottom, marginLeft] = this._margin;
      this.yogaNode.setMargin(Yoga.EDGE_TOP, marginTop * this.ui!._res);
      this.yogaNode.setMargin(Yoga.EDGE_RIGHT, marginRight * this.ui!._res);
      this.yogaNode.setMargin(Yoga.EDGE_BOTTOM, marginBottom * this.ui!._res);
      this.yogaNode.setMargin(Yoga.EDGE_LEFT, marginLeft * this.ui!._res);
    } else {
      this.yogaNode.setMargin(Yoga.EDGE_ALL, this._margin * this.ui!._res);
    }

    const parentNode = (this.parent as Node & { yogaNode?: YogaTypes.Node })
      ?.yogaNode;
    if (parentNode) {
      parentNode.insertChild(this.yogaNode, parentNode.getChildCount());
    }
    this.ui?.redraw();
  }

  commit(_didMove: boolean) {
    // ...
  }

  unmount() {
    if (!isBrowser) return;
    if (this.yogaNode) {
      const parentNode = (this.parent as Node & { yogaNode?: YogaTypes.Node })
        ?.yogaNode;
      if (parentNode) {
        parentNode.removeChild(this.yogaNode);
      }
      this.yogaNode.free();
      this.yogaNode = undefined;
      this.box = undefined;
    }
  }

  copy(source: UIImage, recursive: boolean) {
    super.copy(source, recursive);
    this._display = source._display;
    this._src = source._src;
    this._width = source._width;
    this._height = source._height;
    this._absolute = source._absolute;
    this._top = source._top;
    this._right = source._right;
    this._bottom = source._bottom;
    this._left = source._left;
    this._objectFit = source._objectFit;
    this._backgroundColor = source._backgroundColor;
    this._borderRadius = source._borderRadius;
    this._margin = source._margin;
    return this;
  }

  /**
   * Measure function for Yoga layout. When no explicit width/height is set,
   * uses the natural image dimensions (scaled by _res) to size the node.
   * If the image is not yet loaded, returns 0x0 and will re-layout on load.
   */
  measureImageFunc() {
    return (
      width: number,
      widthMode: number,
      height: number,
      heightMode: number,
    ) => {
      // If explicit dimensions are set, Yoga uses those directly
      // This measure func only fires when width/height are undefined
      if (!this._src || !this.ui) {
        return { width: 0, height: 0 };
      }

      const img = loadCachedImage(this._src, () => {
        this.yogaNode?.markDirty();
        this.ui?.redraw();
      });

      if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
        return { width: 0, height: 0 };
      }

      const naturalW = img.naturalWidth * this.ui!._res;
      const naturalH = img.naturalHeight * this.ui!._res;
      const aspectRatio = naturalW / naturalH;

      let finalWidth = naturalW;
      let finalHeight = naturalH;

      if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
        finalWidth = width;
        finalHeight = width / aspectRatio;
      } else if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
        finalWidth = Math.min(naturalW, width);
        finalHeight = finalWidth / aspectRatio;
      }

      if (heightMode === Yoga.MEASURE_MODE_EXACTLY) {
        finalHeight = height;
        if (widthMode === Yoga.MEASURE_MODE_UNDEFINED) {
          finalWidth = height * aspectRatio;
        }
      } else if (heightMode === Yoga.MEASURE_MODE_AT_MOST) {
        if (finalHeight > height) {
          finalHeight = height;
          finalWidth = height * aspectRatio;
          if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
            finalWidth = Math.min(finalWidth, width);
          }
        }
      }

      return { width: finalWidth, height: finalHeight };
    };
  }

  // -- Property getters and setters --

  get display() {
    return this._display;
  }

  set display(value: DisplayType | undefined) {
    if (value === undefined) value = defaults.display as DisplayType;
    if (!isDisplay(value)) {
      throw new Error(`[uiimage] display invalid: ${value}`);
    }
    if (this._display === value) return;
    this._display = value;
    this.yogaNode?.setDisplay(
      (Display as Record<string, YogaTypes.Display>)[this._display],
    );
    this.yogaNode?.markDirty();
    this.ui?.redraw();
  }

  get src() {
    return this._src;
  }

  set src(value: string | null | undefined) {
    if (value === undefined) value = defaults.src;
    if (value !== null && !isString(value)) {
      throw new Error("[uiimage] src not a string");
    }
    if (this._src === value) return;
    this._src = value;
    this.yogaNode?.markDirty();
    this.ui?.redraw();
  }

  get width() {
    return this._width;
  }

  set width(value: number | null | undefined) {
    if (value === undefined) value = defaults.width;
    if (value !== null && !isNumber(value)) {
      throw new Error("[uiimage] width not a number");
    }
    if (this._width === value) return;
    this._width = value;
    this.yogaNode?.setWidth(
      this._width === null ? undefined : this._width * this.ui!._res,
    );
    this.yogaNode?.markDirty();
    this.ui?.redraw();
  }

  get height() {
    return this._height;
  }

  set height(value: number | null | undefined) {
    if (value === undefined) value = defaults.height;
    if (value !== null && !isNumber(value)) {
      throw new Error("[uiimage] height not a number");
    }
    if (this._height === value) return;
    this._height = value;
    this.yogaNode?.setHeight(
      this._height === null ? undefined : this._height * this.ui!._res,
    );
    this.yogaNode?.markDirty();
    this.ui?.redraw();
  }

  get absolute() {
    return this._absolute;
  }

  set absolute(value: boolean | undefined) {
    if (value === undefined) value = defaults.absolute;
    if (!isBoolean(value)) {
      throw new Error("[uiimage] absolute not a boolean");
    }
    if (this._absolute === value) return;
    this._absolute = value;
    this.yogaNode?.setPositionType(
      this._absolute
        ? Yoga.POSITION_TYPE_ABSOLUTE
        : Yoga.POSITION_TYPE_RELATIVE,
    );
    this.ui?.redraw();
  }

  get top() {
    return this._top;
  }

  set top(value: number | null | undefined) {
    if (value === undefined) value = defaults.top;
    const isNum = isNumber(value);
    if (value !== null && !isNum) {
      throw new Error("[uiimage] top must be a number or null");
    }
    if (this._top === value) return;
    this._top = value;
    this.yogaNode?.setPosition(
      Yoga.EDGE_TOP,
      isNum && this._top !== null ? this._top * this.ui!._res : undefined,
    );
    this.ui?.redraw();
  }

  get right() {
    return this._right;
  }

  set right(value: number | null | undefined) {
    if (value === undefined) value = defaults.right;
    const isNum = isNumber(value);
    if (value !== null && !isNum) {
      throw new Error("[uiimage] right must be a number or null");
    }
    if (this._right === value) return;
    this._right = value;
    this.yogaNode?.setPosition(
      Yoga.EDGE_RIGHT,
      isNum && this._right !== null ? this._right * this.ui!._res : undefined,
    );
    this.ui?.redraw();
  }

  get bottom() {
    return this._bottom;
  }

  set bottom(value: number | null | undefined) {
    if (value === undefined) value = defaults.bottom;
    const isNum = isNumber(value);
    if (value !== null && !isNum) {
      throw new Error("[uiimage] bottom must be a number or null");
    }
    if (this._bottom === value) return;
    this._bottom = value;
    this.yogaNode?.setPosition(
      Yoga.EDGE_BOTTOM,
      isNum && this._bottom !== null ? this._bottom * this.ui!._res : undefined,
    );
    this.ui?.redraw();
  }

  get left() {
    return this._left;
  }

  set left(value: number | null | undefined) {
    if (value === undefined) value = defaults.left;
    const isNum = isNumber(value);
    if (value !== null && !isNum) {
      throw new Error("[uiimage] left must be a number or null");
    }
    if (this._left === value) return;
    this._left = value;
    this.yogaNode?.setPosition(
      Yoga.EDGE_LEFT,
      isNum && this._left !== null ? this._left * this.ui!._res : undefined,
    );
    this.ui?.redraw();
  }

  get objectFit() {
    return this._objectFit;
  }

  set objectFit(value: ObjectFitMode | string | undefined) {
    if (value === undefined) value = defaults.objectFit as ObjectFitMode;
    if (!isObjectFit(value)) {
      throw new Error(`[uiimage] objectFit invalid: ${value}`);
    }
    if (this._objectFit === value) return;
    this._objectFit = value;
    this.ui?.redraw();
  }

  get backgroundColor() {
    return this._backgroundColor;
  }

  set backgroundColor(value: string | null | undefined) {
    if (value === undefined) value = defaults.backgroundColor;
    if (value !== null && !isString(value)) {
      throw new Error("[uiimage] backgroundColor not a string");
    }
    if (this._backgroundColor === value) return;
    this._backgroundColor = value;
    this.ui?.redraw();
  }

  get borderRadius() {
    return this._borderRadius;
  }

  set borderRadius(value: number | null | undefined) {
    if (value === undefined || value === null) value = defaults.borderRadius;
    if (!isNumber(value)) {
      throw new Error("[uiimage] borderRadius not a number");
    }
    if (this._borderRadius === value) return;
    this._borderRadius = value;
    this.ui?.redraw();
  }

  get margin() {
    return this._margin;
  }

  set margin(value: number | number[] | EdgeValue | null | undefined) {
    if (value === undefined || value === null) value = defaults.margin;
    if (!isEdge(value)) {
      throw new Error("[uiimage] margin not a number or array of numbers");
    }
    if (this._margin === value) return;
    this._margin = value;
    if (isArray(this._margin)) {
      const [marginTop, marginRight, marginBottom, marginLeft] = this._margin;
      this.yogaNode?.setMargin(Yoga.EDGE_TOP, marginTop * this.ui!._res);
      this.yogaNode?.setMargin(Yoga.EDGE_RIGHT, marginRight * this.ui!._res);
      this.yogaNode?.setMargin(Yoga.EDGE_BOTTOM, marginBottom * this.ui!._res);
      this.yogaNode?.setMargin(Yoga.EDGE_LEFT, marginLeft * this.ui!._res);
    } else {
      this.yogaNode?.setMargin(Yoga.EDGE_ALL, this._margin * this.ui!._res);
    }
    this.ui?.redraw();
  }

  getProxy() {
    const self = this;
    if (!this.proxy) {
      let proxy = {
        get display() {
          return self.display;
        },
        set display(value) {
          self.display = value;
        },
        get src() {
          return self.src;
        },
        set src(value) {
          self.src = value;
        },
        get width() {
          return self.width;
        },
        set width(value) {
          self.width = value;
        },
        get height() {
          return self.height;
        },
        set height(value) {
          self.height = value;
        },
        get absolute() {
          return self.absolute;
        },
        set absolute(value) {
          self.absolute = value;
        },
        get top() {
          return self.top;
        },
        set top(value) {
          self.top = value;
        },
        get right() {
          return self.right;
        },
        set right(value) {
          self.right = value;
        },
        get bottom() {
          return self.bottom;
        },
        set bottom(value) {
          self.bottom = value;
        },
        get left() {
          return self.left;
        },
        set left(value) {
          self.left = value;
        },
        get objectFit() {
          return self.objectFit;
        },
        set objectFit(value) {
          self.objectFit = value;
        },
        get backgroundColor() {
          return self.backgroundColor;
        },
        set backgroundColor(value) {
          self.backgroundColor = value;
        },
        get borderRadius() {
          return self.borderRadius;
        },
        set borderRadius(value) {
          self.borderRadius = value;
        },
        get margin() {
          return self.margin;
        },
        set margin(value) {
          self.margin = value;
        },
      };
      proxy = Object.defineProperties(
        proxy,
        Object.getOwnPropertyDescriptors(super.getProxy()),
      ); // inherit Node properties
      this.proxy = proxy;
    }
    return this.proxy;
  }
}

/**
 * Compute draw coordinates for an image within a container box
 * based on the CSS object-fit model.
 *
 * Returns absolute pixel positions for drawImage().
 */
function computeObjectFit(
  mode: ObjectFitMode,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  imgW: number,
  imgH: number,
): { drawX: number; drawY: number; drawW: number; drawH: number } {
  switch (mode) {
    case "fill": {
      // Stretch to fill entire box, ignoring aspect ratio
      return { drawX: boxX, drawY: boxY, drawW: boxW, drawH: boxH };
    }

    case "contain": {
      // Fit inside box, maintain aspect ratio, letterbox
      const scale = Math.min(boxW / imgW, boxH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;
      return { drawX, drawY, drawW, drawH };
    }

    case "cover": {
      // Fill box, maintain aspect ratio, clip overflow
      const scale = Math.max(boxW / imgW, boxH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;
      return { drawX, drawY, drawW, drawH };
    }

    case "none": {
      // Natural size, centered in box
      const drawX = boxX + (boxW - imgW) / 2;
      const drawY = boxY + (boxH - imgH) / 2;
      return { drawX, drawY, drawW: imgW, drawH: imgH };
    }

    case "scale-down": {
      // Use the smaller of "none" and "contain"
      const containScale = Math.min(boxW / imgW, boxH / imgH);
      const scale = Math.min(1, containScale);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;
      return { drawX, drawY, drawW, drawH };
    }
  }
}

function isEdge(value: unknown): value is number | EdgeValue {
  if (isNumber(value)) {
    return true;
  }
  if (isArray(value)) {
    return value.length === 4 && every(value, (n) => isNumber(n));
  }
  return false;
}
