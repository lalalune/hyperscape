var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  "../../node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter2() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter2.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter2.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter2.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter2.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
    EventEmitter2.prefixed = prefix;
    EventEmitter2.EventEmitter = EventEmitter2;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter2;
    }
  }
});

// ../../node_modules/three-mesh-bvh/build/index.umd.cjs
var require_index_umd = __commonJS({
  "../../node_modules/three-mesh-bvh/build/index.umd.cjs"(exports, module) {
    (function(global2, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports, __require("three")) : typeof define === "function" && define.amd ? define(["exports", "three"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.MeshBVHLib = global2.MeshBVHLib || {}, global2.THREE));
    })(exports, function(exports2, three) {
      "use strict";
      const CENTER = 0;
      const AVERAGE = 1;
      const SAH = 2;
      const NOT_INTERSECTED = 0;
      const INTERSECTED = 1;
      const CONTAINED = 2;
      const TRIANGLE_INTERSECT_COST = 1.25;
      const TRAVERSAL_COST = 1;
      const BYTES_PER_NODE = 6 * 4 + 4 + 4;
      const IS_LEAFNODE_FLAG = 65535;
      const FLOAT32_EPSILON = Math.pow(2, -24);
      const SKIP_GENERATION = Symbol("SKIP_GENERATION");
      function getVertexCount(geo) {
        return geo.index ? geo.index.count : geo.attributes.position.count;
      }
      function getTriCount(geo) {
        return getVertexCount(geo) / 3;
      }
      function getIndexArray(vertexCount, BufferConstructor = ArrayBuffer) {
        if (vertexCount > 65535) {
          return new Uint32Array(new BufferConstructor(4 * vertexCount));
        } else {
          return new Uint16Array(new BufferConstructor(2 * vertexCount));
        }
      }
      function ensureIndex(geo, options) {
        if (!geo.index) {
          const vertexCount = geo.attributes.position.count;
          const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
          const index = getIndexArray(vertexCount, BufferConstructor);
          geo.setIndex(new three.BufferAttribute(index, 1));
          for (let i = 0; i < vertexCount; i++) {
            index[i] = i;
          }
        }
      }
      function getFullGeometryRange(geo, range) {
        const triCount = getTriCount(geo);
        const drawRange = range ? range : geo.drawRange;
        const start = drawRange.start / 3;
        const end = (drawRange.start + drawRange.count) / 3;
        const offset = Math.max(0, start);
        const count = Math.min(triCount, end) - offset;
        return [{
          offset: Math.floor(offset),
          count: Math.floor(count)
        }];
      }
      function getRootIndexRanges(geo, range) {
        if (!geo.groups || !geo.groups.length) {
          return getFullGeometryRange(geo, range);
        }
        const ranges = [];
        const rangeBoundaries = /* @__PURE__ */ new Set();
        const drawRange = range ? range : geo.drawRange;
        const drawRangeStart = drawRange.start / 3;
        const drawRangeEnd = (drawRange.start + drawRange.count) / 3;
        for (const group of geo.groups) {
          const groupStart = group.start / 3;
          const groupEnd = (group.start + group.count) / 3;
          rangeBoundaries.add(Math.max(drawRangeStart, groupStart));
          rangeBoundaries.add(Math.min(drawRangeEnd, groupEnd));
        }
        const sortedBoundaries = Array.from(rangeBoundaries.values()).sort((a, b) => a - b);
        for (let i = 0; i < sortedBoundaries.length - 1; i++) {
          const start = sortedBoundaries[i];
          const end = sortedBoundaries[i + 1];
          ranges.push({
            offset: Math.floor(start),
            count: Math.floor(end - start)
          });
        }
        return ranges;
      }
      function hasGroupGaps(geometry, range) {
        const vertexCount = getTriCount(geometry);
        const groups = getRootIndexRanges(geometry, range).sort((a, b) => a.offset - b.offset);
        const finalGroup = groups[groups.length - 1];
        finalGroup.count = Math.min(vertexCount - finalGroup.offset, finalGroup.count);
        let total = 0;
        groups.forEach(({ count }) => total += count);
        return vertexCount !== total;
      }
      function getBounds(triangleBounds, offset, count, target, centroidTarget) {
        let minx = Infinity;
        let miny = Infinity;
        let minz = Infinity;
        let maxx = -Infinity;
        let maxy = -Infinity;
        let maxz = -Infinity;
        let cminx = Infinity;
        let cminy = Infinity;
        let cminz = Infinity;
        let cmaxx = -Infinity;
        let cmaxy = -Infinity;
        let cmaxz = -Infinity;
        for (let i = offset * 6, end = (offset + count) * 6; i < end; i += 6) {
          const cx = triangleBounds[i + 0];
          const hx = triangleBounds[i + 1];
          const lx = cx - hx;
          const rx = cx + hx;
          if (lx < minx) minx = lx;
          if (rx > maxx) maxx = rx;
          if (cx < cminx) cminx = cx;
          if (cx > cmaxx) cmaxx = cx;
          const cy = triangleBounds[i + 2];
          const hy = triangleBounds[i + 3];
          const ly = cy - hy;
          const ry = cy + hy;
          if (ly < miny) miny = ly;
          if (ry > maxy) maxy = ry;
          if (cy < cminy) cminy = cy;
          if (cy > cmaxy) cmaxy = cy;
          const cz = triangleBounds[i + 4];
          const hz = triangleBounds[i + 5];
          const lz = cz - hz;
          const rz = cz + hz;
          if (lz < minz) minz = lz;
          if (rz > maxz) maxz = rz;
          if (cz < cminz) cminz = cz;
          if (cz > cmaxz) cmaxz = cz;
        }
        target[0] = minx;
        target[1] = miny;
        target[2] = minz;
        target[3] = maxx;
        target[4] = maxy;
        target[5] = maxz;
        centroidTarget[0] = cminx;
        centroidTarget[1] = cminy;
        centroidTarget[2] = cminz;
        centroidTarget[3] = cmaxx;
        centroidTarget[4] = cmaxy;
        centroidTarget[5] = cmaxz;
      }
      function computeTriangleBounds(geo, target = null, offset = null, count = null) {
        const posAttr = geo.attributes.position;
        const index = geo.index ? geo.index.array : null;
        const triCount = getTriCount(geo);
        const normalized = posAttr.normalized;
        let triangleBounds;
        if (target === null) {
          triangleBounds = new Float32Array(triCount * 6);
          offset = 0;
          count = triCount;
        } else {
          triangleBounds = target;
          offset = offset || 0;
          count = count || triCount;
        }
        const posArr = posAttr.array;
        const bufferOffset = posAttr.offset || 0;
        let stride = 3;
        if (posAttr.isInterleavedBufferAttribute) {
          stride = posAttr.data.stride;
        }
        const getters = ["getX", "getY", "getZ"];
        for (let tri = offset; tri < offset + count; tri++) {
          const tri3 = tri * 3;
          const tri6 = tri * 6;
          let ai = tri3 + 0;
          let bi = tri3 + 1;
          let ci = tri3 + 2;
          if (index) {
            ai = index[ai];
            bi = index[bi];
            ci = index[ci];
          }
          if (!normalized) {
            ai = ai * stride + bufferOffset;
            bi = bi * stride + bufferOffset;
            ci = ci * stride + bufferOffset;
          }
          for (let el = 0; el < 3; el++) {
            let a, b, c;
            if (normalized) {
              a = posAttr[getters[el]](ai);
              b = posAttr[getters[el]](bi);
              c = posAttr[getters[el]](ci);
            } else {
              a = posArr[ai + el];
              b = posArr[bi + el];
              c = posArr[ci + el];
            }
            let min = a;
            if (b < min) min = b;
            if (c < min) min = c;
            let max = a;
            if (b > max) max = b;
            if (c > max) max = c;
            const halfExtents = (max - min) / 2;
            const el2 = el * 2;
            triangleBounds[tri6 + el2 + 0] = min + halfExtents;
            triangleBounds[tri6 + el2 + 1] = halfExtents + (Math.abs(min) + halfExtents) * FLOAT32_EPSILON;
          }
        }
        return triangleBounds;
      }
      function arrayToBox(nodeIndex32, array, target) {
        target.min.x = array[nodeIndex32];
        target.min.y = array[nodeIndex32 + 1];
        target.min.z = array[nodeIndex32 + 2];
        target.max.x = array[nodeIndex32 + 3];
        target.max.y = array[nodeIndex32 + 4];
        target.max.z = array[nodeIndex32 + 5];
        return target;
      }
      function makeEmptyBounds(target) {
        target[0] = target[1] = target[2] = Infinity;
        target[3] = target[4] = target[5] = -Infinity;
      }
      function getLongestEdgeIndex(bounds) {
        let splitDimIdx = -1;
        let splitDist = -Infinity;
        for (let i = 0; i < 3; i++) {
          const dist = bounds[i + 3] - bounds[i];
          if (dist > splitDist) {
            splitDist = dist;
            splitDimIdx = i;
          }
        }
        return splitDimIdx;
      }
      function copyBounds(source, target) {
        target.set(source);
      }
      function unionBounds(a, b, target) {
        let aVal, bVal;
        for (let d = 0; d < 3; d++) {
          const d3 = d + 3;
          aVal = a[d];
          bVal = b[d];
          target[d] = aVal < bVal ? aVal : bVal;
          aVal = a[d3];
          bVal = b[d3];
          target[d3] = aVal > bVal ? aVal : bVal;
        }
      }
      function expandByTriangleBounds(startIndex, triangleBounds, bounds) {
        for (let d = 0; d < 3; d++) {
          const tCenter = triangleBounds[startIndex + 2 * d];
          const tHalf = triangleBounds[startIndex + 2 * d + 1];
          const tMin = tCenter - tHalf;
          const tMax = tCenter + tHalf;
          if (tMin < bounds[d]) {
            bounds[d] = tMin;
          }
          if (tMax > bounds[d + 3]) {
            bounds[d + 3] = tMax;
          }
        }
      }
      function computeSurfaceArea(bounds) {
        const d0 = bounds[3] - bounds[0];
        const d1 = bounds[4] - bounds[1];
        const d2 = bounds[5] - bounds[2];
        return 2 * (d0 * d1 + d1 * d2 + d2 * d0);
      }
      const BIN_COUNT = 32;
      const binsSort = (a, b) => a.candidate - b.candidate;
      const sahBins = new Array(BIN_COUNT).fill().map(() => {
        return {
          count: 0,
          bounds: new Float32Array(6),
          rightCacheBounds: new Float32Array(6),
          leftCacheBounds: new Float32Array(6),
          candidate: 0
        };
      });
      const leftBounds = new Float32Array(6);
      function getOptimalSplit(nodeBoundingData, centroidBoundingData, triangleBounds, offset, count, strategy) {
        let axis = -1;
        let pos = 0;
        if (strategy === CENTER) {
          axis = getLongestEdgeIndex(centroidBoundingData);
          if (axis !== -1) {
            pos = (centroidBoundingData[axis] + centroidBoundingData[axis + 3]) / 2;
          }
        } else if (strategy === AVERAGE) {
          axis = getLongestEdgeIndex(nodeBoundingData);
          if (axis !== -1) {
            pos = getAverage(triangleBounds, offset, count, axis);
          }
        } else if (strategy === SAH) {
          const rootSurfaceArea = computeSurfaceArea(nodeBoundingData);
          let bestCost = TRIANGLE_INTERSECT_COST * count;
          const cStart = offset * 6;
          const cEnd = (offset + count) * 6;
          for (let a = 0; a < 3; a++) {
            const axisLeft = centroidBoundingData[a];
            const axisRight = centroidBoundingData[a + 3];
            const axisLength = axisRight - axisLeft;
            const binWidth = axisLength / BIN_COUNT;
            if (count < BIN_COUNT / 4) {
              const truncatedBins = [...sahBins];
              truncatedBins.length = count;
              let b = 0;
              for (let c = cStart; c < cEnd; c += 6, b++) {
                const bin = truncatedBins[b];
                bin.candidate = triangleBounds[c + 2 * a];
                bin.count = 0;
                const {
                  bounds,
                  leftCacheBounds,
                  rightCacheBounds
                } = bin;
                for (let d = 0; d < 3; d++) {
                  rightCacheBounds[d] = Infinity;
                  rightCacheBounds[d + 3] = -Infinity;
                  leftCacheBounds[d] = Infinity;
                  leftCacheBounds[d + 3] = -Infinity;
                  bounds[d] = Infinity;
                  bounds[d + 3] = -Infinity;
                }
                expandByTriangleBounds(c, triangleBounds, bounds);
              }
              truncatedBins.sort(binsSort);
              let splitCount = count;
              for (let bi = 0; bi < splitCount; bi++) {
                const bin = truncatedBins[bi];
                while (bi + 1 < splitCount && truncatedBins[bi + 1].candidate === bin.candidate) {
                  truncatedBins.splice(bi + 1, 1);
                  splitCount--;
                }
              }
              for (let c = cStart; c < cEnd; c += 6) {
                const center = triangleBounds[c + 2 * a];
                for (let bi = 0; bi < splitCount; bi++) {
                  const bin = truncatedBins[bi];
                  if (center >= bin.candidate) {
                    expandByTriangleBounds(c, triangleBounds, bin.rightCacheBounds);
                  } else {
                    expandByTriangleBounds(c, triangleBounds, bin.leftCacheBounds);
                    bin.count++;
                  }
                }
              }
              for (let bi = 0; bi < splitCount; bi++) {
                const bin = truncatedBins[bi];
                const leftCount = bin.count;
                const rightCount = count - bin.count;
                const leftBounds2 = bin.leftCacheBounds;
                const rightBounds = bin.rightCacheBounds;
                let leftProb = 0;
                if (leftCount !== 0) {
                  leftProb = computeSurfaceArea(leftBounds2) / rootSurfaceArea;
                }
                let rightProb = 0;
                if (rightCount !== 0) {
                  rightProb = computeSurfaceArea(rightBounds) / rootSurfaceArea;
                }
                const cost = TRAVERSAL_COST + TRIANGLE_INTERSECT_COST * (leftProb * leftCount + rightProb * rightCount);
                if (cost < bestCost) {
                  axis = a;
                  bestCost = cost;
                  pos = bin.candidate;
                }
              }
            } else {
              for (let i = 0; i < BIN_COUNT; i++) {
                const bin = sahBins[i];
                bin.count = 0;
                bin.candidate = axisLeft + binWidth + i * binWidth;
                const bounds = bin.bounds;
                for (let d = 0; d < 3; d++) {
                  bounds[d] = Infinity;
                  bounds[d + 3] = -Infinity;
                }
              }
              for (let c = cStart; c < cEnd; c += 6) {
                const triCenter = triangleBounds[c + 2 * a];
                const relativeCenter = triCenter - axisLeft;
                let binIndex = ~~(relativeCenter / binWidth);
                if (binIndex >= BIN_COUNT) binIndex = BIN_COUNT - 1;
                const bin = sahBins[binIndex];
                bin.count++;
                expandByTriangleBounds(c, triangleBounds, bin.bounds);
              }
              const lastBin = sahBins[BIN_COUNT - 1];
              copyBounds(lastBin.bounds, lastBin.rightCacheBounds);
              for (let i = BIN_COUNT - 2; i >= 0; i--) {
                const bin = sahBins[i];
                const nextBin = sahBins[i + 1];
                unionBounds(bin.bounds, nextBin.rightCacheBounds, bin.rightCacheBounds);
              }
              let leftCount = 0;
              for (let i = 0; i < BIN_COUNT - 1; i++) {
                const bin = sahBins[i];
                const binCount = bin.count;
                const bounds = bin.bounds;
                const nextBin = sahBins[i + 1];
                const rightBounds = nextBin.rightCacheBounds;
                if (binCount !== 0) {
                  if (leftCount === 0) {
                    copyBounds(bounds, leftBounds);
                  } else {
                    unionBounds(bounds, leftBounds, leftBounds);
                  }
                }
                leftCount += binCount;
                let leftProb = 0;
                let rightProb = 0;
                if (leftCount !== 0) {
                  leftProb = computeSurfaceArea(leftBounds) / rootSurfaceArea;
                }
                const rightCount = count - leftCount;
                if (rightCount !== 0) {
                  rightProb = computeSurfaceArea(rightBounds) / rootSurfaceArea;
                }
                const cost = TRAVERSAL_COST + TRIANGLE_INTERSECT_COST * (leftProb * leftCount + rightProb * rightCount);
                if (cost < bestCost) {
                  axis = a;
                  bestCost = cost;
                  pos = bin.candidate;
                }
              }
            }
          }
        } else {
          console.warn(`MeshBVH: Invalid build strategy value ${strategy} used.`);
        }
        return { axis, pos };
      }
      function getAverage(triangleBounds, offset, count, axis) {
        let avg = 0;
        for (let i = offset, end = offset + count; i < end; i++) {
          avg += triangleBounds[i * 6 + axis * 2];
        }
        return avg / count;
      }
      class MeshBVHNode {
        constructor() {
          this.boundingData = new Float32Array(6);
        }
      }
      function partition(indirectBuffer, index, triangleBounds, offset, count, split) {
        let left = offset;
        let right = offset + count - 1;
        const pos = split.pos;
        const axisOffset = split.axis * 2;
        while (true) {
          while (left <= right && triangleBounds[left * 6 + axisOffset] < pos) {
            left++;
          }
          while (left <= right && triangleBounds[right * 6 + axisOffset] >= pos) {
            right--;
          }
          if (left < right) {
            for (let i = 0; i < 3; i++) {
              let t0 = index[left * 3 + i];
              index[left * 3 + i] = index[right * 3 + i];
              index[right * 3 + i] = t0;
            }
            for (let i = 0; i < 6; i++) {
              let tb = triangleBounds[left * 6 + i];
              triangleBounds[left * 6 + i] = triangleBounds[right * 6 + i];
              triangleBounds[right * 6 + i] = tb;
            }
            left++;
            right--;
          } else {
            return left;
          }
        }
      }
      function partition_indirect(indirectBuffer, index, triangleBounds, offset, count, split) {
        let left = offset;
        let right = offset + count - 1;
        const pos = split.pos;
        const axisOffset = split.axis * 2;
        while (true) {
          while (left <= right && triangleBounds[left * 6 + axisOffset] < pos) {
            left++;
          }
          while (left <= right && triangleBounds[right * 6 + axisOffset] >= pos) {
            right--;
          }
          if (left < right) {
            let t = indirectBuffer[left];
            indirectBuffer[left] = indirectBuffer[right];
            indirectBuffer[right] = t;
            for (let i = 0; i < 6; i++) {
              let tb = triangleBounds[left * 6 + i];
              triangleBounds[left * 6 + i] = triangleBounds[right * 6 + i];
              triangleBounds[right * 6 + i] = tb;
            }
            left++;
            right--;
          } else {
            return left;
          }
        }
      }
      function IS_LEAF(n16, uint16Array2) {
        return uint16Array2[n16 + 15] === 65535;
      }
      function OFFSET(n32, uint32Array2) {
        return uint32Array2[n32 + 6];
      }
      function COUNT(n16, uint16Array2) {
        return uint16Array2[n16 + 14];
      }
      function LEFT_NODE(n32) {
        return n32 + 8;
      }
      function RIGHT_NODE(n32, uint32Array2) {
        return uint32Array2[n32 + 6];
      }
      function SPLIT_AXIS(n32, uint32Array2) {
        return uint32Array2[n32 + 7];
      }
      function BOUNDING_DATA_INDEX(n32) {
        return n32;
      }
      let float32Array, uint32Array, uint16Array, uint8Array;
      const MAX_POINTER = Math.pow(2, 32);
      function countNodes(node) {
        if ("count" in node) {
          return 1;
        } else {
          return 1 + countNodes(node.left) + countNodes(node.right);
        }
      }
      function populateBuffer(byteOffset, node, buffer) {
        float32Array = new Float32Array(buffer);
        uint32Array = new Uint32Array(buffer);
        uint16Array = new Uint16Array(buffer);
        uint8Array = new Uint8Array(buffer);
        return _populateBuffer(byteOffset, node);
      }
      function _populateBuffer(byteOffset, node) {
        const stride4Offset = byteOffset / 4;
        const stride2Offset = byteOffset / 2;
        const isLeaf = "count" in node;
        const boundingData = node.boundingData;
        for (let i = 0; i < 6; i++) {
          float32Array[stride4Offset + i] = boundingData[i];
        }
        if (isLeaf) {
          if (node.buffer) {
            const buffer = node.buffer;
            uint8Array.set(new Uint8Array(buffer), byteOffset);
            for (let offset = byteOffset, l = byteOffset + buffer.byteLength; offset < l; offset += BYTES_PER_NODE) {
              const offset2 = offset / 2;
              if (!IS_LEAF(offset2, uint16Array)) {
                uint32Array[offset / 4 + 6] += stride4Offset;
              }
            }
            return byteOffset + buffer.byteLength;
          } else {
            const offset = node.offset;
            const count = node.count;
            uint32Array[stride4Offset + 6] = offset;
            uint16Array[stride2Offset + 14] = count;
            uint16Array[stride2Offset + 15] = IS_LEAFNODE_FLAG;
            return byteOffset + BYTES_PER_NODE;
          }
        } else {
          const left = node.left;
          const right = node.right;
          const splitAxis = node.splitAxis;
          let nextUnusedPointer;
          nextUnusedPointer = _populateBuffer(byteOffset + BYTES_PER_NODE, left);
          if (nextUnusedPointer / 4 > MAX_POINTER) {
            throw new Error("MeshBVH: Cannot store child pointer greater than 32 bits.");
          }
          uint32Array[stride4Offset + 6] = nextUnusedPointer / 4;
          nextUnusedPointer = _populateBuffer(nextUnusedPointer, right);
          uint32Array[stride4Offset + 7] = splitAxis;
          return nextUnusedPointer;
        }
      }
      function generateIndirectBuffer(geometry, useSharedArrayBuffer) {
        const triCount = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
        const useUint32 = triCount > 2 ** 16;
        const byteCount = useUint32 ? 4 : 2;
        const buffer = useSharedArrayBuffer ? new SharedArrayBuffer(triCount * byteCount) : new ArrayBuffer(triCount * byteCount);
        const indirectBuffer = useUint32 ? new Uint32Array(buffer) : new Uint16Array(buffer);
        for (let i = 0, l = indirectBuffer.length; i < l; i++) {
          indirectBuffer[i] = i;
        }
        return indirectBuffer;
      }
      function buildTree(bvh, triangleBounds, offset, count, options) {
        const {
          maxDepth,
          verbose,
          maxLeafTris,
          strategy,
          onProgress,
          indirect
        } = options;
        const indirectBuffer = bvh._indirectBuffer;
        const geometry = bvh.geometry;
        const indexArray = geometry.index ? geometry.index.array : null;
        const partionFunc = indirect ? partition_indirect : partition;
        const totalTriangles = getTriCount(geometry);
        const cacheCentroidBoundingData = new Float32Array(6);
        let reachedMaxDepth = false;
        const root2 = new MeshBVHNode();
        getBounds(triangleBounds, offset, count, root2.boundingData, cacheCentroidBoundingData);
        splitNode(root2, offset, count, cacheCentroidBoundingData);
        return root2;
        function triggerProgress(trianglesProcessed) {
          if (onProgress) {
            onProgress(trianglesProcessed / totalTriangles);
          }
        }
        function splitNode(node, offset2, count2, centroidBoundingData = null, depth = 0) {
          if (!reachedMaxDepth && depth >= maxDepth) {
            reachedMaxDepth = true;
            if (verbose) {
              console.warn(`MeshBVH: Max depth of ${maxDepth} reached when generating BVH. Consider increasing maxDepth.`);
              console.warn(geometry);
            }
          }
          if (count2 <= maxLeafTris || depth >= maxDepth) {
            triggerProgress(offset2 + count2);
            node.offset = offset2;
            node.count = count2;
            return node;
          }
          const split = getOptimalSplit(node.boundingData, centroidBoundingData, triangleBounds, offset2, count2, strategy);
          if (split.axis === -1) {
            triggerProgress(offset2 + count2);
            node.offset = offset2;
            node.count = count2;
            return node;
          }
          const splitOffset = partionFunc(indirectBuffer, indexArray, triangleBounds, offset2, count2, split);
          if (splitOffset === offset2 || splitOffset === offset2 + count2) {
            triggerProgress(offset2 + count2);
            node.offset = offset2;
            node.count = count2;
          } else {
            node.splitAxis = split.axis;
            const left = new MeshBVHNode();
            const lstart = offset2;
            const lcount = splitOffset - offset2;
            node.left = left;
            getBounds(triangleBounds, lstart, lcount, left.boundingData, cacheCentroidBoundingData);
            splitNode(left, lstart, lcount, cacheCentroidBoundingData, depth + 1);
            const right = new MeshBVHNode();
            const rstart = splitOffset;
            const rcount = count2 - lcount;
            node.right = right;
            getBounds(triangleBounds, rstart, rcount, right.boundingData, cacheCentroidBoundingData);
            splitNode(right, rstart, rcount, cacheCentroidBoundingData, depth + 1);
          }
          return node;
        }
      }
      function buildPackedTree(bvh, options) {
        const geometry = bvh.geometry;
        if (options.indirect) {
          bvh._indirectBuffer = generateIndirectBuffer(geometry, options.useSharedArrayBuffer);
          if (hasGroupGaps(geometry, options.range) && !options.verbose) {
            console.warn(
              'MeshBVH: Provided geometry contains groups or a range that do not fully span the vertex contents while using the "indirect" option. BVH may incorrectly report intersections on unrendered portions of the geometry.'
            );
          }
        }
        if (!bvh._indirectBuffer) {
          ensureIndex(geometry, options);
        }
        const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
        const triangleBounds = computeTriangleBounds(geometry);
        const geometryRanges = options.indirect ? getFullGeometryRange(geometry, options.range) : getRootIndexRanges(geometry, options.range);
        bvh._roots = geometryRanges.map((range) => {
          const root2 = buildTree(bvh, triangleBounds, range.offset, range.count, options);
          const nodeCount = countNodes(root2);
          const buffer = new BufferConstructor(BYTES_PER_NODE * nodeCount);
          populateBuffer(0, root2, buffer);
          return buffer;
        });
      }
      class SeparatingAxisBounds {
        constructor() {
          this.min = Infinity;
          this.max = -Infinity;
        }
        setFromPointsField(points, field) {
          let min = Infinity;
          let max = -Infinity;
          for (let i = 0, l = points.length; i < l; i++) {
            const p = points[i];
            const val = p[field];
            min = val < min ? val : min;
            max = val > max ? val : max;
          }
          this.min = min;
          this.max = max;
        }
        setFromPoints(axis, points) {
          let min = Infinity;
          let max = -Infinity;
          for (let i = 0, l = points.length; i < l; i++) {
            const p = points[i];
            const val = axis.dot(p);
            min = val < min ? val : min;
            max = val > max ? val : max;
          }
          this.min = min;
          this.max = max;
        }
        isSeparated(other) {
          return this.min > other.max || other.min > this.max;
        }
      }
      SeparatingAxisBounds.prototype.setFromBox = function() {
        const p = new three.Vector3();
        return function setFromBox(axis, box) {
          const boxMin = box.min;
          const boxMax = box.max;
          let min = Infinity;
          let max = -Infinity;
          for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
              for (let z = 0; z <= 1; z++) {
                p.x = boxMin.x * x + boxMax.x * (1 - x);
                p.y = boxMin.y * y + boxMax.y * (1 - y);
                p.z = boxMin.z * z + boxMax.z * (1 - z);
                const val = axis.dot(p);
                min = Math.min(val, min);
                max = Math.max(val, max);
              }
            }
          }
          this.min = min;
          this.max = max;
        };
      }();
      const areIntersecting = function() {
        const cacheSatBounds = new SeparatingAxisBounds();
        return function areIntersecting2(shape1, shape2) {
          const points1 = shape1.points;
          const satAxes1 = shape1.satAxes;
          const satBounds1 = shape1.satBounds;
          const points2 = shape2.points;
          const satAxes2 = shape2.satAxes;
          const satBounds2 = shape2.satBounds;
          for (let i = 0; i < 3; i++) {
            const sb = satBounds1[i];
            const sa = satAxes1[i];
            cacheSatBounds.setFromPoints(sa, points2);
            if (sb.isSeparated(cacheSatBounds)) return false;
          }
          for (let i = 0; i < 3; i++) {
            const sb = satBounds2[i];
            const sa = satAxes2[i];
            cacheSatBounds.setFromPoints(sa, points1);
            if (sb.isSeparated(cacheSatBounds)) return false;
          }
        };
      }();
      const closestPointLineToLine = function() {
        const dir1 = new three.Vector3();
        const dir2 = new three.Vector3();
        const v02 = new three.Vector3();
        return function closestPointLineToLine2(l1, l2, result) {
          const v0 = l1.start;
          const v10 = dir1;
          const v2 = l2.start;
          const v32 = dir2;
          v02.subVectors(v0, v2);
          dir1.subVectors(l1.end, l1.start);
          dir2.subVectors(l2.end, l2.start);
          const d0232 = v02.dot(v32);
          const d3210 = v32.dot(v10);
          const d3232 = v32.dot(v32);
          const d0210 = v02.dot(v10);
          const d1010 = v10.dot(v10);
          const denom = d1010 * d3232 - d3210 * d3210;
          let d, d2;
          if (denom !== 0) {
            d = (d0232 * d3210 - d0210 * d3232) / denom;
          } else {
            d = 0;
          }
          d2 = (d0232 + d * d3210) / d3232;
          result.x = d;
          result.y = d2;
        };
      }();
      const closestPointsSegmentToSegment = function() {
        const paramResult = new three.Vector2();
        const temp12 = new three.Vector3();
        const temp22 = new three.Vector3();
        return function closestPointsSegmentToSegment2(l1, l2, target1, target2) {
          closestPointLineToLine(l1, l2, paramResult);
          let d = paramResult.x;
          let d2 = paramResult.y;
          if (d >= 0 && d <= 1 && d2 >= 0 && d2 <= 1) {
            l1.at(d, target1);
            l2.at(d2, target2);
            return;
          } else if (d >= 0 && d <= 1) {
            if (d2 < 0) {
              l2.at(0, target2);
            } else {
              l2.at(1, target2);
            }
            l1.closestPointToPoint(target2, true, target1);
            return;
          } else if (d2 >= 0 && d2 <= 1) {
            if (d < 0) {
              l1.at(0, target1);
            } else {
              l1.at(1, target1);
            }
            l2.closestPointToPoint(target1, true, target2);
            return;
          } else {
            let p;
            if (d < 0) {
              p = l1.start;
            } else {
              p = l1.end;
            }
            let p2;
            if (d2 < 0) {
              p2 = l2.start;
            } else {
              p2 = l2.end;
            }
            const closestPoint = temp12;
            const closestPoint2 = temp22;
            l1.closestPointToPoint(p2, true, temp12);
            l2.closestPointToPoint(p, true, temp22);
            if (closestPoint.distanceToSquared(p2) <= closestPoint2.distanceToSquared(p)) {
              target1.copy(closestPoint);
              target2.copy(p2);
              return;
            } else {
              target1.copy(p);
              target2.copy(closestPoint2);
              return;
            }
          }
        };
      }();
      const sphereIntersectTriangle = function() {
        const closestPointTemp = new three.Vector3();
        const projectedPointTemp = new three.Vector3();
        const planeTemp = new three.Plane();
        const lineTemp = new three.Line3();
        return function sphereIntersectTriangle2(sphere, triangle3) {
          const { radius, center } = sphere;
          const { a, b, c } = triangle3;
          lineTemp.start = a;
          lineTemp.end = b;
          const closestPoint1 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
          if (closestPoint1.distanceTo(center) <= radius) return true;
          lineTemp.start = a;
          lineTemp.end = c;
          const closestPoint2 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
          if (closestPoint2.distanceTo(center) <= radius) return true;
          lineTemp.start = b;
          lineTemp.end = c;
          const closestPoint3 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
          if (closestPoint3.distanceTo(center) <= radius) return true;
          const plane = triangle3.getPlane(planeTemp);
          const dp = Math.abs(plane.distanceToPoint(center));
          if (dp <= radius) {
            const pp = plane.projectPoint(center, projectedPointTemp);
            const cp = triangle3.containsPoint(pp);
            if (cp) return true;
          }
          return false;
        };
      }();
      const ZERO_EPSILON = 1e-15;
      function isNearZero(value) {
        return Math.abs(value) < ZERO_EPSILON;
      }
      class ExtendedTriangle extends three.Triangle {
        constructor(...args) {
          super(...args);
          this.isExtendedTriangle = true;
          this.satAxes = new Array(4).fill().map(() => new three.Vector3());
          this.satBounds = new Array(4).fill().map(() => new SeparatingAxisBounds());
          this.points = [this.a, this.b, this.c];
          this.sphere = new three.Sphere();
          this.plane = new three.Plane();
          this.needsUpdate = true;
        }
        intersectsSphere(sphere) {
          return sphereIntersectTriangle(sphere, this);
        }
        update() {
          const a = this.a;
          const b = this.b;
          const c = this.c;
          const points = this.points;
          const satAxes = this.satAxes;
          const satBounds = this.satBounds;
          const axis0 = satAxes[0];
          const sab0 = satBounds[0];
          this.getNormal(axis0);
          sab0.setFromPoints(axis0, points);
          const axis1 = satAxes[1];
          const sab1 = satBounds[1];
          axis1.subVectors(a, b);
          sab1.setFromPoints(axis1, points);
          const axis2 = satAxes[2];
          const sab2 = satBounds[2];
          axis2.subVectors(b, c);
          sab2.setFromPoints(axis2, points);
          const axis3 = satAxes[3];
          const sab3 = satBounds[3];
          axis3.subVectors(c, a);
          sab3.setFromPoints(axis3, points);
          this.sphere.setFromPoints(this.points);
          this.plane.setFromNormalAndCoplanarPoint(axis0, a);
          this.needsUpdate = false;
        }
      }
      ExtendedTriangle.prototype.closestPointToSegment = function() {
        const point1 = new three.Vector3();
        const point2 = new three.Vector3();
        const edge = new three.Line3();
        return function distanceToSegment(segment, target1 = null, target2 = null) {
          const { start, end } = segment;
          const points = this.points;
          let distSq;
          let closestDistanceSq = Infinity;
          for (let i = 0; i < 3; i++) {
            const nexti = (i + 1) % 3;
            edge.start.copy(points[i]);
            edge.end.copy(points[nexti]);
            closestPointsSegmentToSegment(edge, segment, point1, point2);
            distSq = point1.distanceToSquared(point2);
            if (distSq < closestDistanceSq) {
              closestDistanceSq = distSq;
              if (target1) target1.copy(point1);
              if (target2) target2.copy(point2);
            }
          }
          this.closestPointToPoint(start, point1);
          distSq = start.distanceToSquared(point1);
          if (distSq < closestDistanceSq) {
            closestDistanceSq = distSq;
            if (target1) target1.copy(point1);
            if (target2) target2.copy(start);
          }
          this.closestPointToPoint(end, point1);
          distSq = end.distanceToSquared(point1);
          if (distSq < closestDistanceSq) {
            closestDistanceSq = distSq;
            if (target1) target1.copy(point1);
            if (target2) target2.copy(end);
          }
          return Math.sqrt(closestDistanceSq);
        };
      }();
      ExtendedTriangle.prototype.intersectsTriangle = function() {
        const saTri2 = new ExtendedTriangle();
        const arr1 = new Array(3);
        const arr2 = new Array(3);
        const cachedSatBounds = new SeparatingAxisBounds();
        const cachedSatBounds2 = new SeparatingAxisBounds();
        const cachedAxis = new three.Vector3();
        const dir = new three.Vector3();
        const dir1 = new three.Vector3();
        const dir2 = new three.Vector3();
        const tempDir = new three.Vector3();
        const edge = new three.Line3();
        const edge1 = new three.Line3();
        const edge2 = new three.Line3();
        const tempPoint = new three.Vector3();
        function triIntersectPlane(tri, plane, targetEdge) {
          const points = tri.points;
          let count = 0;
          let startPointIntersection = -1;
          for (let i = 0; i < 3; i++) {
            const { start, end } = edge;
            start.copy(points[i]);
            end.copy(points[(i + 1) % 3]);
            edge.delta(dir);
            const startIntersects = isNearZero(plane.distanceToPoint(start));
            if (isNearZero(plane.normal.dot(dir)) && startIntersects) {
              targetEdge.copy(edge);
              count = 2;
              break;
            }
            const doesIntersect = plane.intersectLine(edge, tempPoint);
            if (!doesIntersect && startIntersects) {
              tempPoint.copy(start);
            }
            if ((doesIntersect || startIntersects) && !isNearZero(tempPoint.distanceTo(end))) {
              if (count <= 1) {
                const point = count === 1 ? targetEdge.start : targetEdge.end;
                point.copy(tempPoint);
                if (startIntersects) {
                  startPointIntersection = count;
                }
              } else if (count >= 2) {
                const point = startPointIntersection === 1 ? targetEdge.start : targetEdge.end;
                point.copy(tempPoint);
                count = 2;
                break;
              }
              count++;
              if (count === 2 && startPointIntersection === -1) {
                break;
              }
            }
          }
          return count;
        }
        return function intersectsTriangle(other, target = null, suppressLog = false) {
          if (this.needsUpdate) {
            this.update();
          }
          if (!other.isExtendedTriangle) {
            saTri2.copy(other);
            saTri2.update();
            other = saTri2;
          } else if (other.needsUpdate) {
            other.update();
          }
          const plane1 = this.plane;
          const plane2 = other.plane;
          if (Math.abs(plane1.normal.dot(plane2.normal)) > 1 - 1e-10) {
            const satBounds1 = this.satBounds;
            const satAxes1 = this.satAxes;
            arr2[0] = other.a;
            arr2[1] = other.b;
            arr2[2] = other.c;
            for (let i = 0; i < 4; i++) {
              const sb = satBounds1[i];
              const sa = satAxes1[i];
              cachedSatBounds.setFromPoints(sa, arr2);
              if (sb.isSeparated(cachedSatBounds)) return false;
            }
            const satBounds2 = other.satBounds;
            const satAxes2 = other.satAxes;
            arr1[0] = this.a;
            arr1[1] = this.b;
            arr1[2] = this.c;
            for (let i = 0; i < 4; i++) {
              const sb = satBounds2[i];
              const sa = satAxes2[i];
              cachedSatBounds.setFromPoints(sa, arr1);
              if (sb.isSeparated(cachedSatBounds)) return false;
            }
            for (let i = 0; i < 4; i++) {
              const sa1 = satAxes1[i];
              for (let i2 = 0; i2 < 4; i2++) {
                const sa2 = satAxes2[i2];
                cachedAxis.crossVectors(sa1, sa2);
                cachedSatBounds.setFromPoints(cachedAxis, arr1);
                cachedSatBounds2.setFromPoints(cachedAxis, arr2);
                if (cachedSatBounds.isSeparated(cachedSatBounds2)) return false;
              }
            }
            if (target) {
              if (!suppressLog) {
                console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0.");
              }
              target.start.set(0, 0, 0);
              target.end.set(0, 0, 0);
            }
            return true;
          } else {
            const count1 = triIntersectPlane(this, plane2, edge1);
            if (count1 === 1 && other.containsPoint(edge1.end)) {
              if (target) {
                target.start.copy(edge1.end);
                target.end.copy(edge1.end);
              }
              return true;
            } else if (count1 !== 2) {
              return false;
            }
            const count2 = triIntersectPlane(other, plane1, edge2);
            if (count2 === 1 && this.containsPoint(edge2.end)) {
              if (target) {
                target.start.copy(edge2.end);
                target.end.copy(edge2.end);
              }
              return true;
            } else if (count2 !== 2) {
              return false;
            }
            edge1.delta(dir1);
            edge2.delta(dir2);
            if (dir1.dot(dir2) < 0) {
              let tmp = edge2.start;
              edge2.start = edge2.end;
              edge2.end = tmp;
            }
            const s1 = edge1.start.dot(dir1);
            const e1 = edge1.end.dot(dir1);
            const s2 = edge2.start.dot(dir1);
            const e2 = edge2.end.dot(dir1);
            const separated1 = e1 < s2;
            const separated2 = s1 < e2;
            if (s1 !== e2 && s2 !== e1 && separated1 === separated2) {
              return false;
            }
            if (target) {
              tempDir.subVectors(edge1.start, edge2.start);
              if (tempDir.dot(dir1) > 0) {
                target.start.copy(edge1.start);
              } else {
                target.start.copy(edge2.start);
              }
              tempDir.subVectors(edge1.end, edge2.end);
              if (tempDir.dot(dir1) < 0) {
                target.end.copy(edge1.end);
              } else {
                target.end.copy(edge2.end);
              }
            }
            return true;
          }
        };
      }();
      ExtendedTriangle.prototype.distanceToPoint = function() {
        const target = new three.Vector3();
        return function distanceToPoint(point) {
          this.closestPointToPoint(point, target);
          return point.distanceTo(target);
        };
      }();
      ExtendedTriangle.prototype.distanceToTriangle = function() {
        const point = new three.Vector3();
        const point2 = new three.Vector3();
        const cornerFields = ["a", "b", "c"];
        const line1 = new three.Line3();
        const line2 = new three.Line3();
        return function distanceToTriangle(other, target1 = null, target2 = null) {
          const lineTarget = target1 || target2 ? line1 : null;
          if (this.intersectsTriangle(other, lineTarget)) {
            if (target1 || target2) {
              if (target1) lineTarget.getCenter(target1);
              if (target2) lineTarget.getCenter(target2);
            }
            return 0;
          }
          let closestDistanceSq = Infinity;
          for (let i = 0; i < 3; i++) {
            let dist;
            const field = cornerFields[i];
            const otherVec = other[field];
            this.closestPointToPoint(otherVec, point);
            dist = otherVec.distanceToSquared(point);
            if (dist < closestDistanceSq) {
              closestDistanceSq = dist;
              if (target1) target1.copy(point);
              if (target2) target2.copy(otherVec);
            }
            const thisVec = this[field];
            other.closestPointToPoint(thisVec, point);
            dist = thisVec.distanceToSquared(point);
            if (dist < closestDistanceSq) {
              closestDistanceSq = dist;
              if (target1) target1.copy(thisVec);
              if (target2) target2.copy(point);
            }
          }
          for (let i = 0; i < 3; i++) {
            const f11 = cornerFields[i];
            const f12 = cornerFields[(i + 1) % 3];
            line1.set(this[f11], this[f12]);
            for (let i2 = 0; i2 < 3; i2++) {
              const f21 = cornerFields[i2];
              const f22 = cornerFields[(i2 + 1) % 3];
              line2.set(other[f21], other[f22]);
              closestPointsSegmentToSegment(line1, line2, point, point2);
              const dist = point.distanceToSquared(point2);
              if (dist < closestDistanceSq) {
                closestDistanceSq = dist;
                if (target1) target1.copy(point);
                if (target2) target2.copy(point2);
              }
            }
          }
          return Math.sqrt(closestDistanceSq);
        };
      }();
      class OrientedBox {
        constructor(min, max, matrix2) {
          this.isOrientedBox = true;
          this.min = new three.Vector3();
          this.max = new three.Vector3();
          this.matrix = new three.Matrix4();
          this.invMatrix = new three.Matrix4();
          this.points = new Array(8).fill().map(() => new three.Vector3());
          this.satAxes = new Array(3).fill().map(() => new three.Vector3());
          this.satBounds = new Array(3).fill().map(() => new SeparatingAxisBounds());
          this.alignedSatBounds = new Array(3).fill().map(() => new SeparatingAxisBounds());
          this.needsUpdate = false;
          if (min) this.min.copy(min);
          if (max) this.max.copy(max);
          if (matrix2) this.matrix.copy(matrix2);
        }
        set(min, max, matrix2) {
          this.min.copy(min);
          this.max.copy(max);
          this.matrix.copy(matrix2);
          this.needsUpdate = true;
        }
        copy(other) {
          this.min.copy(other.min);
          this.max.copy(other.max);
          this.matrix.copy(other.matrix);
          this.needsUpdate = true;
        }
      }
      OrientedBox.prototype.update = /* @__PURE__ */ function() {
        return function update() {
          const matrix2 = this.matrix;
          const min = this.min;
          const max = this.max;
          const points = this.points;
          for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
              for (let z = 0; z <= 1; z++) {
                const i = (1 << 0) * x | (1 << 1) * y | (1 << 2) * z;
                const v = points[i];
                v.x = x ? max.x : min.x;
                v.y = y ? max.y : min.y;
                v.z = z ? max.z : min.z;
                v.applyMatrix4(matrix2);
              }
            }
          }
          const satBounds = this.satBounds;
          const satAxes = this.satAxes;
          const minVec = points[0];
          for (let i = 0; i < 3; i++) {
            const axis = satAxes[i];
            const sb = satBounds[i];
            const index = 1 << i;
            const pi = points[index];
            axis.subVectors(minVec, pi);
            sb.setFromPoints(axis, points);
          }
          const alignedSatBounds = this.alignedSatBounds;
          alignedSatBounds[0].setFromPointsField(points, "x");
          alignedSatBounds[1].setFromPointsField(points, "y");
          alignedSatBounds[2].setFromPointsField(points, "z");
          this.invMatrix.copy(this.matrix).invert();
          this.needsUpdate = false;
        };
      }();
      OrientedBox.prototype.intersectsBox = function() {
        const aabbBounds = new SeparatingAxisBounds();
        return function intersectsBox(box) {
          if (this.needsUpdate) {
            this.update();
          }
          const min = box.min;
          const max = box.max;
          const satBounds = this.satBounds;
          const satAxes = this.satAxes;
          const alignedSatBounds = this.alignedSatBounds;
          aabbBounds.min = min.x;
          aabbBounds.max = max.x;
          if (alignedSatBounds[0].isSeparated(aabbBounds)) return false;
          aabbBounds.min = min.y;
          aabbBounds.max = max.y;
          if (alignedSatBounds[1].isSeparated(aabbBounds)) return false;
          aabbBounds.min = min.z;
          aabbBounds.max = max.z;
          if (alignedSatBounds[2].isSeparated(aabbBounds)) return false;
          for (let i = 0; i < 3; i++) {
            const axis = satAxes[i];
            const sb = satBounds[i];
            aabbBounds.setFromBox(axis, box);
            if (sb.isSeparated(aabbBounds)) return false;
          }
          return true;
        };
      }();
      OrientedBox.prototype.intersectsTriangle = function() {
        const saTri = new ExtendedTriangle();
        const pointsArr = new Array(3);
        const cachedSatBounds = new SeparatingAxisBounds();
        const cachedSatBounds2 = new SeparatingAxisBounds();
        const cachedAxis = new three.Vector3();
        return function intersectsTriangle(triangle3) {
          if (this.needsUpdate) {
            this.update();
          }
          if (!triangle3.isExtendedTriangle) {
            saTri.copy(triangle3);
            saTri.update();
            triangle3 = saTri;
          } else if (triangle3.needsUpdate) {
            triangle3.update();
          }
          const satBounds = this.satBounds;
          const satAxes = this.satAxes;
          pointsArr[0] = triangle3.a;
          pointsArr[1] = triangle3.b;
          pointsArr[2] = triangle3.c;
          for (let i = 0; i < 3; i++) {
            const sb = satBounds[i];
            const sa = satAxes[i];
            cachedSatBounds.setFromPoints(sa, pointsArr);
            if (sb.isSeparated(cachedSatBounds)) return false;
          }
          const triSatBounds = triangle3.satBounds;
          const triSatAxes = triangle3.satAxes;
          const points = this.points;
          for (let i = 0; i < 3; i++) {
            const sb = triSatBounds[i];
            const sa = triSatAxes[i];
            cachedSatBounds.setFromPoints(sa, points);
            if (sb.isSeparated(cachedSatBounds)) return false;
          }
          for (let i = 0; i < 3; i++) {
            const sa1 = satAxes[i];
            for (let i2 = 0; i2 < 4; i2++) {
              const sa2 = triSatAxes[i2];
              cachedAxis.crossVectors(sa1, sa2);
              cachedSatBounds.setFromPoints(cachedAxis, pointsArr);
              cachedSatBounds2.setFromPoints(cachedAxis, points);
              if (cachedSatBounds.isSeparated(cachedSatBounds2)) return false;
            }
          }
          return true;
        };
      }();
      OrientedBox.prototype.closestPointToPoint = /* @__PURE__ */ function() {
        return function closestPointToPoint2(point, target1) {
          if (this.needsUpdate) {
            this.update();
          }
          target1.copy(point).applyMatrix4(this.invMatrix).clamp(this.min, this.max).applyMatrix4(this.matrix);
          return target1;
        };
      }();
      OrientedBox.prototype.distanceToPoint = function() {
        const target = new three.Vector3();
        return function distanceToPoint(point) {
          this.closestPointToPoint(point, target);
          return point.distanceTo(target);
        };
      }();
      OrientedBox.prototype.distanceToBox = function() {
        const xyzFields = ["x", "y", "z"];
        const segments1 = new Array(12).fill().map(() => new three.Line3());
        const segments2 = new Array(12).fill().map(() => new three.Line3());
        const point1 = new three.Vector3();
        const point2 = new three.Vector3();
        return function distanceToBox(box, threshold = 0, target1 = null, target2 = null) {
          if (this.needsUpdate) {
            this.update();
          }
          if (this.intersectsBox(box)) {
            if (target1 || target2) {
              box.getCenter(point2);
              this.closestPointToPoint(point2, point1);
              box.closestPointToPoint(point1, point2);
              if (target1) target1.copy(point1);
              if (target2) target2.copy(point2);
            }
            return 0;
          }
          const threshold2 = threshold * threshold;
          const min = box.min;
          const max = box.max;
          const points = this.points;
          let closestDistanceSq = Infinity;
          for (let i = 0; i < 8; i++) {
            const p = points[i];
            point2.copy(p).clamp(min, max);
            const dist = p.distanceToSquared(point2);
            if (dist < closestDistanceSq) {
              closestDistanceSq = dist;
              if (target1) target1.copy(p);
              if (target2) target2.copy(point2);
              if (dist < threshold2) return Math.sqrt(dist);
            }
          }
          let count = 0;
          for (let i = 0; i < 3; i++) {
            for (let i1 = 0; i1 <= 1; i1++) {
              for (let i2 = 0; i2 <= 1; i2++) {
                const nextIndex = (i + 1) % 3;
                const nextIndex2 = (i + 2) % 3;
                const index = i1 << nextIndex | i2 << nextIndex2;
                const index2 = 1 << i | i1 << nextIndex | i2 << nextIndex2;
                const p1 = points[index];
                const p2 = points[index2];
                const line1 = segments1[count];
                line1.set(p1, p2);
                const f1 = xyzFields[i];
                const f2 = xyzFields[nextIndex];
                const f3 = xyzFields[nextIndex2];
                const line2 = segments2[count];
                const start = line2.start;
                const end = line2.end;
                start[f1] = min[f1];
                start[f2] = i1 ? min[f2] : max[f2];
                start[f3] = i2 ? min[f3] : max[f2];
                end[f1] = max[f1];
                end[f2] = i1 ? min[f2] : max[f2];
                end[f3] = i2 ? min[f3] : max[f2];
                count++;
              }
            }
          }
          for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
              for (let z = 0; z <= 1; z++) {
                point2.x = x ? max.x : min.x;
                point2.y = y ? max.y : min.y;
                point2.z = z ? max.z : min.z;
                this.closestPointToPoint(point2, point1);
                const dist = point2.distanceToSquared(point1);
                if (dist < closestDistanceSq) {
                  closestDistanceSq = dist;
                  if (target1) target1.copy(point1);
                  if (target2) target2.copy(point2);
                  if (dist < threshold2) return Math.sqrt(dist);
                }
              }
            }
          }
          for (let i = 0; i < 12; i++) {
            const l1 = segments1[i];
            for (let i2 = 0; i2 < 12; i2++) {
              const l2 = segments2[i2];
              closestPointsSegmentToSegment(l1, l2, point1, point2);
              const dist = point1.distanceToSquared(point2);
              if (dist < closestDistanceSq) {
                closestDistanceSq = dist;
                if (target1) target1.copy(point1);
                if (target2) target2.copy(point2);
                if (dist < threshold2) return Math.sqrt(dist);
              }
            }
          }
          return Math.sqrt(closestDistanceSq);
        };
      }();
      class PrimitivePool {
        constructor(getNewPrimitive) {
          this._getNewPrimitive = getNewPrimitive;
          this._primitives = [];
        }
        getPrimitive() {
          const primitives = this._primitives;
          if (primitives.length === 0) {
            return this._getNewPrimitive();
          } else {
            return primitives.pop();
          }
        }
        releasePrimitive(primitive) {
          this._primitives.push(primitive);
        }
      }
      class ExtendedTrianglePoolBase extends PrimitivePool {
        constructor() {
          super(() => new ExtendedTriangle());
        }
      }
      const ExtendedTrianglePool = /* @__PURE__ */ new ExtendedTrianglePoolBase();
      class _BufferStack {
        constructor() {
          this.float32Array = null;
          this.uint16Array = null;
          this.uint32Array = null;
          const stack = [];
          let prevBuffer = null;
          this.setBuffer = (buffer) => {
            if (prevBuffer) {
              stack.push(prevBuffer);
            }
            prevBuffer = buffer;
            this.float32Array = new Float32Array(buffer);
            this.uint16Array = new Uint16Array(buffer);
            this.uint32Array = new Uint32Array(buffer);
          };
          this.clearBuffer = () => {
            prevBuffer = null;
            this.float32Array = null;
            this.uint16Array = null;
            this.uint32Array = null;
            if (stack.length !== 0) {
              this.setBuffer(stack.pop());
            }
          };
        }
      }
      const BufferStack = new _BufferStack();
      let _box1$1, _box2$1;
      const boxStack = [];
      const boxPool = /* @__PURE__ */ new PrimitivePool(() => new three.Box3());
      function shapecast(bvh, root2, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset) {
        _box1$1 = boxPool.getPrimitive();
        _box2$1 = boxPool.getPrimitive();
        boxStack.push(_box1$1, _box2$1);
        BufferStack.setBuffer(bvh._roots[root2]);
        const result = shapecastTraverse(0, bvh.geometry, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset);
        BufferStack.clearBuffer();
        boxPool.releasePrimitive(_box1$1);
        boxPool.releasePrimitive(_box2$1);
        boxStack.pop();
        boxStack.pop();
        const length = boxStack.length;
        if (length > 0) {
          _box2$1 = boxStack[length - 1];
          _box1$1 = boxStack[length - 2];
        }
        return result;
      }
      function shapecastTraverse(nodeIndex32, geometry, intersectsBoundsFunc, intersectsRangeFunc, nodeScoreFunc = null, nodeIndexByteOffset = 0, depth = 0) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        let nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, _box1$1);
          return intersectsRangeFunc(offset, count, false, depth, nodeIndexByteOffset + nodeIndex32, _box1$1);
        } else {
          let getLeftOffset = function(nodeIndex322) {
            const { uint16Array: uint16Array3, uint32Array: uint32Array3 } = BufferStack;
            let nodeIndex162 = nodeIndex322 * 2;
            while (!IS_LEAF(nodeIndex162, uint16Array3)) {
              nodeIndex322 = LEFT_NODE(nodeIndex322);
              nodeIndex162 = nodeIndex322 * 2;
            }
            return OFFSET(nodeIndex322, uint32Array3);
          }, getRightEndOffset = function(nodeIndex322) {
            const { uint16Array: uint16Array3, uint32Array: uint32Array3 } = BufferStack;
            let nodeIndex162 = nodeIndex322 * 2;
            while (!IS_LEAF(nodeIndex162, uint16Array3)) {
              nodeIndex322 = RIGHT_NODE(nodeIndex322, uint32Array3);
              nodeIndex162 = nodeIndex322 * 2;
            }
            return OFFSET(nodeIndex322, uint32Array3) + COUNT(nodeIndex162, uint16Array3);
          };
          const left = LEFT_NODE(nodeIndex32);
          const right = RIGHT_NODE(nodeIndex32, uint32Array2);
          let c1 = left;
          let c2 = right;
          let score1, score2;
          let box1, box2;
          if (nodeScoreFunc) {
            box1 = _box1$1;
            box2 = _box2$1;
            arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array2, box1);
            arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array2, box2);
            score1 = nodeScoreFunc(box1);
            score2 = nodeScoreFunc(box2);
            if (score2 < score1) {
              c1 = right;
              c2 = left;
              const temp5 = score1;
              score1 = score2;
              score2 = temp5;
              box1 = box2;
            }
          }
          if (!box1) {
            box1 = _box1$1;
            arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array2, box1);
          }
          const isC1Leaf = IS_LEAF(c1 * 2, uint16Array2);
          const c1Intersection = intersectsBoundsFunc(box1, isC1Leaf, score1, depth + 1, nodeIndexByteOffset + c1);
          let c1StopTraversal;
          if (c1Intersection === CONTAINED) {
            const offset = getLeftOffset(c1);
            const end = getRightEndOffset(c1);
            const count = end - offset;
            c1StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexByteOffset + c1, box1);
          } else {
            c1StopTraversal = c1Intersection && shapecastTraverse(
              c1,
              geometry,
              intersectsBoundsFunc,
              intersectsRangeFunc,
              nodeScoreFunc,
              nodeIndexByteOffset,
              depth + 1
            );
          }
          if (c1StopTraversal) return true;
          box2 = _box2$1;
          arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array2, box2);
          const isC2Leaf = IS_LEAF(c2 * 2, uint16Array2);
          const c2Intersection = intersectsBoundsFunc(box2, isC2Leaf, score2, depth + 1, nodeIndexByteOffset + c2);
          let c2StopTraversal;
          if (c2Intersection === CONTAINED) {
            const offset = getLeftOffset(c2);
            const end = getRightEndOffset(c2);
            const count = end - offset;
            c2StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexByteOffset + c2, box2);
          } else {
            c2StopTraversal = c2Intersection && shapecastTraverse(
              c2,
              geometry,
              intersectsBoundsFunc,
              intersectsRangeFunc,
              nodeScoreFunc,
              nodeIndexByteOffset,
              depth + 1
            );
          }
          if (c2StopTraversal) return true;
          return false;
        }
      }
      const temp = /* @__PURE__ */ new three.Vector3();
      const temp1$2 = /* @__PURE__ */ new three.Vector3();
      function closestPointToPoint(bvh, point, target = {}, minThreshold = 0, maxThreshold = Infinity) {
        const minThresholdSq = minThreshold * minThreshold;
        const maxThresholdSq = maxThreshold * maxThreshold;
        let closestDistanceSq = Infinity;
        let closestDistanceTriIndex = null;
        bvh.shapecast(
          {
            boundsTraverseOrder: (box) => {
              temp.copy(point).clamp(box.min, box.max);
              return temp.distanceToSquared(point);
            },
            intersectsBounds: (box, isLeaf, score) => {
              return score < closestDistanceSq && score < maxThresholdSq;
            },
            intersectsTriangle: (tri, triIndex) => {
              tri.closestPointToPoint(point, temp);
              const distSq = point.distanceToSquared(temp);
              if (distSq < closestDistanceSq) {
                temp1$2.copy(temp);
                closestDistanceSq = distSq;
                closestDistanceTriIndex = triIndex;
              }
              if (distSq < minThresholdSq) {
                return true;
              } else {
                return false;
              }
            }
          }
        );
        if (closestDistanceSq === Infinity) return null;
        const closestDistance = Math.sqrt(closestDistanceSq);
        if (!target.point) target.point = temp1$2.clone();
        else target.point.copy(temp1$2);
        target.distance = closestDistance, target.faceIndex = closestDistanceTriIndex;
        return target;
      }
      const IS_GT_REVISION_169 = parseInt(three.REVISION) >= 169;
      const _vA = /* @__PURE__ */ new three.Vector3();
      const _vB = /* @__PURE__ */ new three.Vector3();
      const _vC = /* @__PURE__ */ new three.Vector3();
      const _uvA = /* @__PURE__ */ new three.Vector2();
      const _uvB = /* @__PURE__ */ new three.Vector2();
      const _uvC = /* @__PURE__ */ new three.Vector2();
      const _normalA = /* @__PURE__ */ new three.Vector3();
      const _normalB = /* @__PURE__ */ new three.Vector3();
      const _normalC = /* @__PURE__ */ new three.Vector3();
      const _intersectionPoint = /* @__PURE__ */ new three.Vector3();
      function checkIntersection(ray2, pA, pB, pC, point, side, near, far) {
        let intersect;
        if (side === three.BackSide) {
          intersect = ray2.intersectTriangle(pC, pB, pA, true, point);
        } else {
          intersect = ray2.intersectTriangle(pA, pB, pC, side !== three.DoubleSide, point);
        }
        if (intersect === null) return null;
        const distance = ray2.origin.distanceTo(point);
        if (distance < near || distance > far) return null;
        return {
          distance,
          point: point.clone()
        };
      }
      function checkBufferGeometryIntersection(ray2, position, normal, uv, uv1, a, b, c, side, near, far) {
        _vA.fromBufferAttribute(position, a);
        _vB.fromBufferAttribute(position, b);
        _vC.fromBufferAttribute(position, c);
        const intersection = checkIntersection(ray2, _vA, _vB, _vC, _intersectionPoint, side, near, far);
        if (intersection) {
          const barycoord = new three.Vector3();
          three.Triangle.getBarycoord(_intersectionPoint, _vA, _vB, _vC, barycoord);
          if (uv) {
            _uvA.fromBufferAttribute(uv, a);
            _uvB.fromBufferAttribute(uv, b);
            _uvC.fromBufferAttribute(uv, c);
            intersection.uv = three.Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new three.Vector2());
          }
          if (uv1) {
            _uvA.fromBufferAttribute(uv1, a);
            _uvB.fromBufferAttribute(uv1, b);
            _uvC.fromBufferAttribute(uv1, c);
            intersection.uv1 = three.Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new three.Vector2());
          }
          if (normal) {
            _normalA.fromBufferAttribute(normal, a);
            _normalB.fromBufferAttribute(normal, b);
            _normalC.fromBufferAttribute(normal, c);
            intersection.normal = three.Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _normalA, _normalB, _normalC, new three.Vector3());
            if (intersection.normal.dot(ray2.direction) > 0) {
              intersection.normal.multiplyScalar(-1);
            }
          }
          const face = {
            a,
            b,
            c,
            normal: new three.Vector3(),
            materialIndex: 0
          };
          three.Triangle.getNormal(_vA, _vB, _vC, face.normal);
          intersection.face = face;
          intersection.faceIndex = a;
          if (IS_GT_REVISION_169) {
            intersection.barycoord = barycoord;
          }
        }
        return intersection;
      }
      function intersectTri(geo, side, ray2, tri, intersections, near, far) {
        const triOffset = tri * 3;
        let a = triOffset + 0;
        let b = triOffset + 1;
        let c = triOffset + 2;
        const index = geo.index;
        if (geo.index) {
          a = index.getX(a);
          b = index.getX(b);
          c = index.getX(c);
        }
        const { position, normal, uv, uv1 } = geo.attributes;
        const intersection = checkBufferGeometryIntersection(ray2, position, normal, uv, uv1, a, b, c, side, near, far);
        if (intersection) {
          intersection.faceIndex = tri;
          if (intersections) intersections.push(intersection);
          return intersection;
        }
        return null;
      }
      function setTriangle(tri, i, index, pos) {
        const ta = tri.a;
        const tb = tri.b;
        const tc = tri.c;
        let i0 = i;
        let i1 = i + 1;
        let i2 = i + 2;
        if (index) {
          i0 = index.getX(i0);
          i1 = index.getX(i1);
          i2 = index.getX(i2);
        }
        ta.x = pos.getX(i0);
        ta.y = pos.getY(i0);
        ta.z = pos.getZ(i0);
        tb.x = pos.getX(i1);
        tb.y = pos.getY(i1);
        tb.z = pos.getZ(i1);
        tc.x = pos.getX(i2);
        tc.y = pos.getY(i2);
        tc.z = pos.getZ(i2);
      }
      const tempV1 = /* @__PURE__ */ new three.Vector3();
      const tempV2 = /* @__PURE__ */ new three.Vector3();
      const tempV3 = /* @__PURE__ */ new three.Vector3();
      const tempUV1 = /* @__PURE__ */ new three.Vector2();
      const tempUV2 = /* @__PURE__ */ new three.Vector2();
      const tempUV3 = /* @__PURE__ */ new three.Vector2();
      function getTriangleHitPointInfo(point, geometry, triangleIndex, target) {
        const indices = geometry.getIndex().array;
        const positions = geometry.getAttribute("position");
        const uvs = geometry.getAttribute("uv");
        const a = indices[triangleIndex * 3];
        const b = indices[triangleIndex * 3 + 1];
        const c = indices[triangleIndex * 3 + 2];
        tempV1.fromBufferAttribute(positions, a);
        tempV2.fromBufferAttribute(positions, b);
        tempV3.fromBufferAttribute(positions, c);
        let materialIndex = 0;
        const groups = geometry.groups;
        const firstVertexIndex = triangleIndex * 3;
        for (let i = 0, l = groups.length; i < l; i++) {
          const group = groups[i];
          const { start, count } = group;
          if (firstVertexIndex >= start && firstVertexIndex < start + count) {
            materialIndex = group.materialIndex;
            break;
          }
        }
        const barycoord = target && target.barycoord ? target.barycoord : new three.Vector3();
        three.Triangle.getBarycoord(point, tempV1, tempV2, tempV3, barycoord);
        let uv = null;
        if (uvs) {
          tempUV1.fromBufferAttribute(uvs, a);
          tempUV2.fromBufferAttribute(uvs, b);
          tempUV3.fromBufferAttribute(uvs, c);
          if (target && target.uv) uv = target.uv;
          else uv = new three.Vector2();
          three.Triangle.getInterpolation(point, tempV1, tempV2, tempV3, tempUV1, tempUV2, tempUV3, uv);
        }
        if (target) {
          if (!target.face) target.face = {};
          target.face.a = a;
          target.face.b = b;
          target.face.c = c;
          target.face.materialIndex = materialIndex;
          if (!target.face.normal) target.face.normal = new three.Vector3();
          three.Triangle.getNormal(tempV1, tempV2, tempV3, target.face.normal);
          if (uv) target.uv = uv;
          target.barycoord = barycoord;
          return target;
        } else {
          return {
            face: {
              a,
              b,
              c,
              materialIndex,
              normal: three.Triangle.getNormal(tempV1, tempV2, tempV3, new three.Vector3())
            },
            uv,
            barycoord
          };
        }
      }
      function intersectTris(bvh, side, ray2, offset, count, intersections, near, far) {
        const { geometry, _indirectBuffer } = bvh;
        for (let i = offset, end = offset + count; i < end; i++) {
          intersectTri(geometry, side, ray2, i, intersections, near, far);
        }
      }
      function intersectClosestTri(bvh, side, ray2, offset, count, near, far) {
        const { geometry, _indirectBuffer } = bvh;
        let dist = Infinity;
        let res = null;
        for (let i = offset, end = offset + count; i < end; i++) {
          let intersection;
          intersection = intersectTri(geometry, side, ray2, i, null, near, far);
          if (intersection && intersection.distance < dist) {
            res = intersection;
            dist = intersection.distance;
          }
        }
        return res;
      }
      function iterateOverTriangles(offset, count, bvh, intersectsTriangleFunc, contained, depth, triangle3) {
        const { geometry } = bvh;
        const { index } = geometry;
        const pos = geometry.attributes.position;
        for (let i = offset, l = count + offset; i < l; i++) {
          let tri;
          tri = i;
          setTriangle(triangle3, tri * 3, index, pos);
          triangle3.needsUpdate = true;
          if (intersectsTriangleFunc(triangle3, tri, contained, depth)) {
            return true;
          }
        }
        return false;
      }
      function refit(bvh, nodeIndices = null) {
        if (nodeIndices && Array.isArray(nodeIndices)) {
          nodeIndices = new Set(nodeIndices);
        }
        const geometry = bvh.geometry;
        const indexArr = geometry.index ? geometry.index.array : null;
        const posAttr = geometry.attributes.position;
        let buffer, uint32Array2, uint16Array2, float32Array2;
        let byteOffset = 0;
        const roots = bvh._roots;
        for (let i = 0, l = roots.length; i < l; i++) {
          buffer = roots[i];
          uint32Array2 = new Uint32Array(buffer);
          uint16Array2 = new Uint16Array(buffer);
          float32Array2 = new Float32Array(buffer);
          _traverse2(0, byteOffset);
          byteOffset += buffer.byteLength;
        }
        function _traverse2(node32Index, byteOffset2, force = false) {
          const node16Index = node32Index * 2;
          const isLeaf = uint16Array2[node16Index + 15] === IS_LEAFNODE_FLAG;
          if (isLeaf) {
            const offset = uint32Array2[node32Index + 6];
            const count = uint16Array2[node16Index + 14];
            let minx = Infinity;
            let miny = Infinity;
            let minz = Infinity;
            let maxx = -Infinity;
            let maxy = -Infinity;
            let maxz = -Infinity;
            for (let i = 3 * offset, l = 3 * (offset + count); i < l; i++) {
              let index = indexArr[i];
              const x = posAttr.getX(index);
              const y = posAttr.getY(index);
              const z = posAttr.getZ(index);
              if (x < minx) minx = x;
              if (x > maxx) maxx = x;
              if (y < miny) miny = y;
              if (y > maxy) maxy = y;
              if (z < minz) minz = z;
              if (z > maxz) maxz = z;
            }
            if (float32Array2[node32Index + 0] !== minx || float32Array2[node32Index + 1] !== miny || float32Array2[node32Index + 2] !== minz || float32Array2[node32Index + 3] !== maxx || float32Array2[node32Index + 4] !== maxy || float32Array2[node32Index + 5] !== maxz) {
              float32Array2[node32Index + 0] = minx;
              float32Array2[node32Index + 1] = miny;
              float32Array2[node32Index + 2] = minz;
              float32Array2[node32Index + 3] = maxx;
              float32Array2[node32Index + 4] = maxy;
              float32Array2[node32Index + 5] = maxz;
              return true;
            } else {
              return false;
            }
          } else {
            const left = node32Index + 8;
            const right = uint32Array2[node32Index + 6];
            const offsetLeft = left + byteOffset2;
            const offsetRight = right + byteOffset2;
            let forceChildren = force;
            let includesLeft = false;
            let includesRight = false;
            if (nodeIndices) {
              if (!forceChildren) {
                includesLeft = nodeIndices.has(offsetLeft);
                includesRight = nodeIndices.has(offsetRight);
                forceChildren = !includesLeft && !includesRight;
              }
            } else {
              includesLeft = true;
              includesRight = true;
            }
            const traverseLeft = forceChildren || includesLeft;
            const traverseRight = forceChildren || includesRight;
            let leftChange = false;
            if (traverseLeft) {
              leftChange = _traverse2(left, byteOffset2, forceChildren);
            }
            let rightChange = false;
            if (traverseRight) {
              rightChange = _traverse2(right, byteOffset2, forceChildren);
            }
            const didChange = leftChange || rightChange;
            if (didChange) {
              for (let i = 0; i < 3; i++) {
                const lefti = left + i;
                const righti = right + i;
                const minLeftValue = float32Array2[lefti];
                const maxLeftValue = float32Array2[lefti + 3];
                const minRightValue = float32Array2[righti];
                const maxRightValue = float32Array2[righti + 3];
                float32Array2[node32Index + i] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
                float32Array2[node32Index + i + 3] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;
              }
            }
            return didChange;
          }
        }
      }
      function intersectRay(nodeIndex32, array, ray2, near, far) {
        let tmin, tmax, tymin, tymax, tzmin, tzmax;
        const invdirx = 1 / ray2.direction.x, invdiry = 1 / ray2.direction.y, invdirz = 1 / ray2.direction.z;
        const ox = ray2.origin.x;
        const oy = ray2.origin.y;
        const oz = ray2.origin.z;
        let minx = array[nodeIndex32];
        let maxx = array[nodeIndex32 + 3];
        let miny = array[nodeIndex32 + 1];
        let maxy = array[nodeIndex32 + 3 + 1];
        let minz = array[nodeIndex32 + 2];
        let maxz = array[nodeIndex32 + 3 + 2];
        if (invdirx >= 0) {
          tmin = (minx - ox) * invdirx;
          tmax = (maxx - ox) * invdirx;
        } else {
          tmin = (maxx - ox) * invdirx;
          tmax = (minx - ox) * invdirx;
        }
        if (invdiry >= 0) {
          tymin = (miny - oy) * invdiry;
          tymax = (maxy - oy) * invdiry;
        } else {
          tymin = (maxy - oy) * invdiry;
          tymax = (miny - oy) * invdiry;
        }
        if (tmin > tymax || tymin > tmax) return false;
        if (tymin > tmin || isNaN(tmin)) tmin = tymin;
        if (tymax < tmax || isNaN(tmax)) tmax = tymax;
        if (invdirz >= 0) {
          tzmin = (minz - oz) * invdirz;
          tzmax = (maxz - oz) * invdirz;
        } else {
          tzmin = (maxz - oz) * invdirz;
          tzmax = (minz - oz) * invdirz;
        }
        if (tmin > tzmax || tzmin > tmax) return false;
        if (tzmin > tmin || tmin !== tmin) tmin = tzmin;
        if (tzmax < tmax || tmax !== tmax) tmax = tzmax;
        return tmin <= far && tmax >= near;
      }
      function intersectTris_indirect(bvh, side, ray2, offset, count, intersections, near, far) {
        const { geometry, _indirectBuffer } = bvh;
        for (let i = offset, end = offset + count; i < end; i++) {
          let vi = _indirectBuffer ? _indirectBuffer[i] : i;
          intersectTri(geometry, side, ray2, vi, intersections, near, far);
        }
      }
      function intersectClosestTri_indirect(bvh, side, ray2, offset, count, near, far) {
        const { geometry, _indirectBuffer } = bvh;
        let dist = Infinity;
        let res = null;
        for (let i = offset, end = offset + count; i < end; i++) {
          let intersection;
          intersection = intersectTri(geometry, side, ray2, _indirectBuffer ? _indirectBuffer[i] : i, null, near, far);
          if (intersection && intersection.distance < dist) {
            res = intersection;
            dist = intersection.distance;
          }
        }
        return res;
      }
      function iterateOverTriangles_indirect(offset, count, bvh, intersectsTriangleFunc, contained, depth, triangle3) {
        const { geometry } = bvh;
        const { index } = geometry;
        const pos = geometry.attributes.position;
        for (let i = offset, l = count + offset; i < l; i++) {
          let tri;
          tri = bvh.resolveTriangleIndex(i);
          setTriangle(triangle3, tri * 3, index, pos);
          triangle3.needsUpdate = true;
          if (intersectsTriangleFunc(triangle3, tri, contained, depth)) {
            return true;
          }
        }
        return false;
      }
      function raycast(bvh, root2, side, ray2, intersects, near, far) {
        BufferStack.setBuffer(bvh._roots[root2]);
        _raycast$1(0, bvh, side, ray2, intersects, near, far);
        BufferStack.clearBuffer();
      }
      function _raycast$1(nodeIndex32, bvh, side, ray2, intersects, near, far) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        const nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          intersectTris(bvh, side, ray2, offset, count, intersects, near, far);
        } else {
          const leftIndex = LEFT_NODE(nodeIndex32);
          if (intersectRay(leftIndex, float32Array2, ray2, near, far)) {
            _raycast$1(leftIndex, bvh, side, ray2, intersects, near, far);
          }
          const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array2);
          if (intersectRay(rightIndex, float32Array2, ray2, near, far)) {
            _raycast$1(rightIndex, bvh, side, ray2, intersects, near, far);
          }
        }
      }
      const _xyzFields$1 = ["x", "y", "z"];
      function raycastFirst(bvh, root2, side, ray2, near, far) {
        BufferStack.setBuffer(bvh._roots[root2]);
        const result = _raycastFirst$1(0, bvh, side, ray2, near, far);
        BufferStack.clearBuffer();
        return result;
      }
      function _raycastFirst$1(nodeIndex32, bvh, side, ray2, near, far) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        let nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          return intersectClosestTri(bvh, side, ray2, offset, count, near, far);
        } else {
          const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array2);
          const xyzAxis = _xyzFields$1[splitAxis];
          const rayDir = ray2.direction[xyzAxis];
          const leftToRight = rayDir >= 0;
          let c1, c2;
          if (leftToRight) {
            c1 = LEFT_NODE(nodeIndex32);
            c2 = RIGHT_NODE(nodeIndex32, uint32Array2);
          } else {
            c1 = RIGHT_NODE(nodeIndex32, uint32Array2);
            c2 = LEFT_NODE(nodeIndex32);
          }
          const c1Intersection = intersectRay(c1, float32Array2, ray2, near, far);
          const c1Result = c1Intersection ? _raycastFirst$1(c1, bvh, side, ray2, near, far) : null;
          if (c1Result) {
            const point = c1Result.point[xyzAxis];
            const isOutside = leftToRight ? point <= float32Array2[c2 + splitAxis] : (
              // min bounding data
              point >= float32Array2[c2 + splitAxis + 3]
            );
            if (isOutside) {
              return c1Result;
            }
          }
          const c2Intersection = intersectRay(c2, float32Array2, ray2, near, far);
          const c2Result = c2Intersection ? _raycastFirst$1(c2, bvh, side, ray2, near, far) : null;
          if (c1Result && c2Result) {
            return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
          } else {
            return c1Result || c2Result || null;
          }
        }
      }
      const boundingBox$2 = /* @__PURE__ */ new three.Box3();
      const triangle$1 = /* @__PURE__ */ new ExtendedTriangle();
      const triangle2$1 = /* @__PURE__ */ new ExtendedTriangle();
      const invertedMat$1 = /* @__PURE__ */ new three.Matrix4();
      const obb$4 = /* @__PURE__ */ new OrientedBox();
      const obb2$3 = /* @__PURE__ */ new OrientedBox();
      function intersectsGeometry(bvh, root2, otherGeometry, geometryToBvh) {
        BufferStack.setBuffer(bvh._roots[root2]);
        const result = _intersectsGeometry$1(0, bvh, otherGeometry, geometryToBvh);
        BufferStack.clearBuffer();
        return result;
      }
      function _intersectsGeometry$1(nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        let nodeIndex16 = nodeIndex32 * 2;
        if (cachedObb === null) {
          if (!otherGeometry.boundingBox) {
            otherGeometry.computeBoundingBox();
          }
          obb$4.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
          cachedObb = obb$4;
        }
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const thisGeometry = bvh.geometry;
          const thisIndex = thisGeometry.index;
          const thisPos = thisGeometry.attributes.position;
          const index = otherGeometry.index;
          const pos = otherGeometry.attributes.position;
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          invertedMat$1.copy(geometryToBvh).invert();
          if (otherGeometry.boundsTree) {
            arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, obb2$3);
            obb2$3.matrix.copy(invertedMat$1);
            obb2$3.needsUpdate = true;
            const res = otherGeometry.boundsTree.shapecast({
              intersectsBounds: (box) => obb2$3.intersectsBox(box),
              intersectsTriangle: (tri) => {
                tri.a.applyMatrix4(geometryToBvh);
                tri.b.applyMatrix4(geometryToBvh);
                tri.c.applyMatrix4(geometryToBvh);
                tri.needsUpdate = true;
                for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
                  setTriangle(triangle2$1, i, thisIndex, thisPos);
                  triangle2$1.needsUpdate = true;
                  if (tri.intersectsTriangle(triangle2$1)) {
                    return true;
                  }
                }
                return false;
              }
            });
            return res;
          } else {
            for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
              setTriangle(triangle$1, i, thisIndex, thisPos);
              triangle$1.a.applyMatrix4(invertedMat$1);
              triangle$1.b.applyMatrix4(invertedMat$1);
              triangle$1.c.applyMatrix4(invertedMat$1);
              triangle$1.needsUpdate = true;
              for (let i2 = 0, l2 = index.count; i2 < l2; i2 += 3) {
                setTriangle(triangle2$1, i2, index, pos);
                triangle2$1.needsUpdate = true;
                if (triangle$1.intersectsTriangle(triangle2$1)) {
                  return true;
                }
              }
            }
          }
        } else {
          const left = nodeIndex32 + 8;
          const right = uint32Array2[nodeIndex32 + 6];
          arrayToBox(BOUNDING_DATA_INDEX(left), float32Array2, boundingBox$2);
          const leftIntersection = cachedObb.intersectsBox(boundingBox$2) && _intersectsGeometry$1(left, bvh, otherGeometry, geometryToBvh, cachedObb);
          if (leftIntersection) return true;
          arrayToBox(BOUNDING_DATA_INDEX(right), float32Array2, boundingBox$2);
          const rightIntersection = cachedObb.intersectsBox(boundingBox$2) && _intersectsGeometry$1(right, bvh, otherGeometry, geometryToBvh, cachedObb);
          if (rightIntersection) return true;
          return false;
        }
      }
      const tempMatrix$1 = /* @__PURE__ */ new three.Matrix4();
      const obb$3 = /* @__PURE__ */ new OrientedBox();
      const obb2$2 = /* @__PURE__ */ new OrientedBox();
      const temp1$1 = /* @__PURE__ */ new three.Vector3();
      const temp2$1 = /* @__PURE__ */ new three.Vector3();
      const temp3$1 = /* @__PURE__ */ new three.Vector3();
      const temp4$1 = /* @__PURE__ */ new three.Vector3();
      function closestPointToGeometry(bvh, otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
        if (!otherGeometry.boundingBox) {
          otherGeometry.computeBoundingBox();
        }
        obb$3.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
        obb$3.needsUpdate = true;
        const geometry = bvh.geometry;
        const pos = geometry.attributes.position;
        const index = geometry.index;
        const otherPos = otherGeometry.attributes.position;
        const otherIndex = otherGeometry.index;
        const triangle3 = ExtendedTrianglePool.getPrimitive();
        const triangle22 = ExtendedTrianglePool.getPrimitive();
        let tempTarget1 = temp1$1;
        let tempTargetDest1 = temp2$1;
        let tempTarget2 = null;
        let tempTargetDest2 = null;
        if (target2) {
          tempTarget2 = temp3$1;
          tempTargetDest2 = temp4$1;
        }
        let closestDistance = Infinity;
        let closestDistanceTriIndex = null;
        let closestDistanceOtherTriIndex = null;
        tempMatrix$1.copy(geometryToBvh).invert();
        obb2$2.matrix.copy(tempMatrix$1);
        bvh.shapecast(
          {
            boundsTraverseOrder: (box) => {
              return obb$3.distanceToBox(box);
            },
            intersectsBounds: (box, isLeaf, score) => {
              if (score < closestDistance && score < maxThreshold) {
                if (isLeaf) {
                  obb2$2.min.copy(box.min);
                  obb2$2.max.copy(box.max);
                  obb2$2.needsUpdate = true;
                }
                return true;
              }
              return false;
            },
            intersectsRange: (offset, count) => {
              if (otherGeometry.boundsTree) {
                const otherBvh = otherGeometry.boundsTree;
                return otherBvh.shapecast({
                  boundsTraverseOrder: (box) => {
                    return obb2$2.distanceToBox(box);
                  },
                  intersectsBounds: (box, isLeaf, score) => {
                    return score < closestDistance && score < maxThreshold;
                  },
                  intersectsRange: (otherOffset, otherCount) => {
                    for (let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2++) {
                      setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
                      triangle22.a.applyMatrix4(geometryToBvh);
                      triangle22.b.applyMatrix4(geometryToBvh);
                      triangle22.c.applyMatrix4(geometryToBvh);
                      triangle22.needsUpdate = true;
                      for (let i = offset, l = offset + count; i < l; i++) {
                        setTriangle(triangle3, 3 * i, index, pos);
                        triangle3.needsUpdate = true;
                        const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                        if (dist < closestDistance) {
                          tempTargetDest1.copy(tempTarget1);
                          if (tempTargetDest2) {
                            tempTargetDest2.copy(tempTarget2);
                          }
                          closestDistance = dist;
                          closestDistanceTriIndex = i;
                          closestDistanceOtherTriIndex = i2;
                        }
                        if (dist < minThreshold) {
                          return true;
                        }
                      }
                    }
                  }
                });
              } else {
                const triCount = getTriCount(otherGeometry);
                for (let i2 = 0, l2 = triCount; i2 < l2; i2++) {
                  setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
                  triangle22.a.applyMatrix4(geometryToBvh);
                  triangle22.b.applyMatrix4(geometryToBvh);
                  triangle22.c.applyMatrix4(geometryToBvh);
                  triangle22.needsUpdate = true;
                  for (let i = offset, l = offset + count; i < l; i++) {
                    setTriangle(triangle3, 3 * i, index, pos);
                    triangle3.needsUpdate = true;
                    const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                    if (dist < closestDistance) {
                      tempTargetDest1.copy(tempTarget1);
                      if (tempTargetDest2) {
                        tempTargetDest2.copy(tempTarget2);
                      }
                      closestDistance = dist;
                      closestDistanceTriIndex = i;
                      closestDistanceOtherTriIndex = i2;
                    }
                    if (dist < minThreshold) {
                      return true;
                    }
                  }
                }
              }
            }
          }
        );
        ExtendedTrianglePool.releasePrimitive(triangle3);
        ExtendedTrianglePool.releasePrimitive(triangle22);
        if (closestDistance === Infinity) {
          return null;
        }
        if (!target1.point) {
          target1.point = tempTargetDest1.clone();
        } else {
          target1.point.copy(tempTargetDest1);
        }
        target1.distance = closestDistance, target1.faceIndex = closestDistanceTriIndex;
        if (target2) {
          if (!target2.point) target2.point = tempTargetDest2.clone();
          else target2.point.copy(tempTargetDest2);
          target2.point.applyMatrix4(tempMatrix$1);
          tempTargetDest1.applyMatrix4(tempMatrix$1);
          target2.distance = tempTargetDest1.sub(target2.point).length();
          target2.faceIndex = closestDistanceOtherTriIndex;
        }
        return target1;
      }
      function refit_indirect(bvh, nodeIndices = null) {
        if (nodeIndices && Array.isArray(nodeIndices)) {
          nodeIndices = new Set(nodeIndices);
        }
        const geometry = bvh.geometry;
        const indexArr = geometry.index ? geometry.index.array : null;
        const posAttr = geometry.attributes.position;
        let buffer, uint32Array2, uint16Array2, float32Array2;
        let byteOffset = 0;
        const roots = bvh._roots;
        for (let i = 0, l = roots.length; i < l; i++) {
          buffer = roots[i];
          uint32Array2 = new Uint32Array(buffer);
          uint16Array2 = new Uint16Array(buffer);
          float32Array2 = new Float32Array(buffer);
          _traverse2(0, byteOffset);
          byteOffset += buffer.byteLength;
        }
        function _traverse2(node32Index, byteOffset2, force = false) {
          const node16Index = node32Index * 2;
          const isLeaf = uint16Array2[node16Index + 15] === IS_LEAFNODE_FLAG;
          if (isLeaf) {
            const offset = uint32Array2[node32Index + 6];
            const count = uint16Array2[node16Index + 14];
            let minx = Infinity;
            let miny = Infinity;
            let minz = Infinity;
            let maxx = -Infinity;
            let maxy = -Infinity;
            let maxz = -Infinity;
            for (let i = offset, l = offset + count; i < l; i++) {
              const t = 3 * bvh.resolveTriangleIndex(i);
              for (let j = 0; j < 3; j++) {
                let index = t + j;
                index = indexArr ? indexArr[index] : index;
                const x = posAttr.getX(index);
                const y = posAttr.getY(index);
                const z = posAttr.getZ(index);
                if (x < minx) minx = x;
                if (x > maxx) maxx = x;
                if (y < miny) miny = y;
                if (y > maxy) maxy = y;
                if (z < minz) minz = z;
                if (z > maxz) maxz = z;
              }
            }
            if (float32Array2[node32Index + 0] !== minx || float32Array2[node32Index + 1] !== miny || float32Array2[node32Index + 2] !== minz || float32Array2[node32Index + 3] !== maxx || float32Array2[node32Index + 4] !== maxy || float32Array2[node32Index + 5] !== maxz) {
              float32Array2[node32Index + 0] = minx;
              float32Array2[node32Index + 1] = miny;
              float32Array2[node32Index + 2] = minz;
              float32Array2[node32Index + 3] = maxx;
              float32Array2[node32Index + 4] = maxy;
              float32Array2[node32Index + 5] = maxz;
              return true;
            } else {
              return false;
            }
          } else {
            const left = node32Index + 8;
            const right = uint32Array2[node32Index + 6];
            const offsetLeft = left + byteOffset2;
            const offsetRight = right + byteOffset2;
            let forceChildren = force;
            let includesLeft = false;
            let includesRight = false;
            if (nodeIndices) {
              if (!forceChildren) {
                includesLeft = nodeIndices.has(offsetLeft);
                includesRight = nodeIndices.has(offsetRight);
                forceChildren = !includesLeft && !includesRight;
              }
            } else {
              includesLeft = true;
              includesRight = true;
            }
            const traverseLeft = forceChildren || includesLeft;
            const traverseRight = forceChildren || includesRight;
            let leftChange = false;
            if (traverseLeft) {
              leftChange = _traverse2(left, byteOffset2, forceChildren);
            }
            let rightChange = false;
            if (traverseRight) {
              rightChange = _traverse2(right, byteOffset2, forceChildren);
            }
            const didChange = leftChange || rightChange;
            if (didChange) {
              for (let i = 0; i < 3; i++) {
                const lefti = left + i;
                const righti = right + i;
                const minLeftValue = float32Array2[lefti];
                const maxLeftValue = float32Array2[lefti + 3];
                const minRightValue = float32Array2[righti];
                const maxRightValue = float32Array2[righti + 3];
                float32Array2[node32Index + i] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
                float32Array2[node32Index + i + 3] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;
              }
            }
            return didChange;
          }
        }
      }
      function raycast_indirect(bvh, root2, side, ray2, intersects, near, far) {
        BufferStack.setBuffer(bvh._roots[root2]);
        _raycast(0, bvh, side, ray2, intersects, near, far);
        BufferStack.clearBuffer();
      }
      function _raycast(nodeIndex32, bvh, side, ray2, intersects, near, far) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        const nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          intersectTris_indirect(bvh, side, ray2, offset, count, intersects, near, far);
        } else {
          const leftIndex = LEFT_NODE(nodeIndex32);
          if (intersectRay(leftIndex, float32Array2, ray2, near, far)) {
            _raycast(leftIndex, bvh, side, ray2, intersects, near, far);
          }
          const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array2);
          if (intersectRay(rightIndex, float32Array2, ray2, near, far)) {
            _raycast(rightIndex, bvh, side, ray2, intersects, near, far);
          }
        }
      }
      const _xyzFields = ["x", "y", "z"];
      function raycastFirst_indirect(bvh, root2, side, ray2, near, far) {
        BufferStack.setBuffer(bvh._roots[root2]);
        const result = _raycastFirst(0, bvh, side, ray2, near, far);
        BufferStack.clearBuffer();
        return result;
      }
      function _raycastFirst(nodeIndex32, bvh, side, ray2, near, far) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        let nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          return intersectClosestTri_indirect(bvh, side, ray2, offset, count, near, far);
        } else {
          const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array2);
          const xyzAxis = _xyzFields[splitAxis];
          const rayDir = ray2.direction[xyzAxis];
          const leftToRight = rayDir >= 0;
          let c1, c2;
          if (leftToRight) {
            c1 = LEFT_NODE(nodeIndex32);
            c2 = RIGHT_NODE(nodeIndex32, uint32Array2);
          } else {
            c1 = RIGHT_NODE(nodeIndex32, uint32Array2);
            c2 = LEFT_NODE(nodeIndex32);
          }
          const c1Intersection = intersectRay(c1, float32Array2, ray2, near, far);
          const c1Result = c1Intersection ? _raycastFirst(c1, bvh, side, ray2, near, far) : null;
          if (c1Result) {
            const point = c1Result.point[xyzAxis];
            const isOutside = leftToRight ? point <= float32Array2[c2 + splitAxis] : (
              // min bounding data
              point >= float32Array2[c2 + splitAxis + 3]
            );
            if (isOutside) {
              return c1Result;
            }
          }
          const c2Intersection = intersectRay(c2, float32Array2, ray2, near, far);
          const c2Result = c2Intersection ? _raycastFirst(c2, bvh, side, ray2, near, far) : null;
          if (c1Result && c2Result) {
            return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
          } else {
            return c1Result || c2Result || null;
          }
        }
      }
      const boundingBox$1 = /* @__PURE__ */ new three.Box3();
      const triangle = /* @__PURE__ */ new ExtendedTriangle();
      const triangle2 = /* @__PURE__ */ new ExtendedTriangle();
      const invertedMat = /* @__PURE__ */ new three.Matrix4();
      const obb$2 = /* @__PURE__ */ new OrientedBox();
      const obb2$1 = /* @__PURE__ */ new OrientedBox();
      function intersectsGeometry_indirect(bvh, root2, otherGeometry, geometryToBvh) {
        BufferStack.setBuffer(bvh._roots[root2]);
        const result = _intersectsGeometry(0, bvh, otherGeometry, geometryToBvh);
        BufferStack.clearBuffer();
        return result;
      }
      function _intersectsGeometry(nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null) {
        const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
        let nodeIndex16 = nodeIndex32 * 2;
        if (cachedObb === null) {
          if (!otherGeometry.boundingBox) {
            otherGeometry.computeBoundingBox();
          }
          obb$2.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
          cachedObb = obb$2;
        }
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const thisGeometry = bvh.geometry;
          const thisIndex = thisGeometry.index;
          const thisPos = thisGeometry.attributes.position;
          const index = otherGeometry.index;
          const pos = otherGeometry.attributes.position;
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          invertedMat.copy(geometryToBvh).invert();
          if (otherGeometry.boundsTree) {
            arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, obb2$1);
            obb2$1.matrix.copy(invertedMat);
            obb2$1.needsUpdate = true;
            const res = otherGeometry.boundsTree.shapecast({
              intersectsBounds: (box) => obb2$1.intersectsBox(box),
              intersectsTriangle: (tri) => {
                tri.a.applyMatrix4(geometryToBvh);
                tri.b.applyMatrix4(geometryToBvh);
                tri.c.applyMatrix4(geometryToBvh);
                tri.needsUpdate = true;
                for (let i = offset, l = count + offset; i < l; i++) {
                  setTriangle(triangle2, 3 * bvh.resolveTriangleIndex(i), thisIndex, thisPos);
                  triangle2.needsUpdate = true;
                  if (tri.intersectsTriangle(triangle2)) {
                    return true;
                  }
                }
                return false;
              }
            });
            return res;
          } else {
            for (let i = offset, l = count + offset; i < l; i++) {
              const ti = bvh.resolveTriangleIndex(i);
              setTriangle(triangle, 3 * ti, thisIndex, thisPos);
              triangle.a.applyMatrix4(invertedMat);
              triangle.b.applyMatrix4(invertedMat);
              triangle.c.applyMatrix4(invertedMat);
              triangle.needsUpdate = true;
              for (let i2 = 0, l2 = index.count; i2 < l2; i2 += 3) {
                setTriangle(triangle2, i2, index, pos);
                triangle2.needsUpdate = true;
                if (triangle.intersectsTriangle(triangle2)) {
                  return true;
                }
              }
            }
          }
        } else {
          const left = nodeIndex32 + 8;
          const right = uint32Array2[nodeIndex32 + 6];
          arrayToBox(BOUNDING_DATA_INDEX(left), float32Array2, boundingBox$1);
          const leftIntersection = cachedObb.intersectsBox(boundingBox$1) && _intersectsGeometry(left, bvh, otherGeometry, geometryToBvh, cachedObb);
          if (leftIntersection) return true;
          arrayToBox(BOUNDING_DATA_INDEX(right), float32Array2, boundingBox$1);
          const rightIntersection = cachedObb.intersectsBox(boundingBox$1) && _intersectsGeometry(right, bvh, otherGeometry, geometryToBvh, cachedObb);
          if (rightIntersection) return true;
          return false;
        }
      }
      const tempMatrix = /* @__PURE__ */ new three.Matrix4();
      const obb$1 = /* @__PURE__ */ new OrientedBox();
      const obb2 = /* @__PURE__ */ new OrientedBox();
      const temp1 = /* @__PURE__ */ new three.Vector3();
      const temp2 = /* @__PURE__ */ new three.Vector3();
      const temp3 = /* @__PURE__ */ new three.Vector3();
      const temp4 = /* @__PURE__ */ new three.Vector3();
      function closestPointToGeometry_indirect(bvh, otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
        if (!otherGeometry.boundingBox) {
          otherGeometry.computeBoundingBox();
        }
        obb$1.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
        obb$1.needsUpdate = true;
        const geometry = bvh.geometry;
        const pos = geometry.attributes.position;
        const index = geometry.index;
        const otherPos = otherGeometry.attributes.position;
        const otherIndex = otherGeometry.index;
        const triangle3 = ExtendedTrianglePool.getPrimitive();
        const triangle22 = ExtendedTrianglePool.getPrimitive();
        let tempTarget1 = temp1;
        let tempTargetDest1 = temp2;
        let tempTarget2 = null;
        let tempTargetDest2 = null;
        if (target2) {
          tempTarget2 = temp3;
          tempTargetDest2 = temp4;
        }
        let closestDistance = Infinity;
        let closestDistanceTriIndex = null;
        let closestDistanceOtherTriIndex = null;
        tempMatrix.copy(geometryToBvh).invert();
        obb2.matrix.copy(tempMatrix);
        bvh.shapecast(
          {
            boundsTraverseOrder: (box) => {
              return obb$1.distanceToBox(box);
            },
            intersectsBounds: (box, isLeaf, score) => {
              if (score < closestDistance && score < maxThreshold) {
                if (isLeaf) {
                  obb2.min.copy(box.min);
                  obb2.max.copy(box.max);
                  obb2.needsUpdate = true;
                }
                return true;
              }
              return false;
            },
            intersectsRange: (offset, count) => {
              if (otherGeometry.boundsTree) {
                const otherBvh = otherGeometry.boundsTree;
                return otherBvh.shapecast({
                  boundsTraverseOrder: (box) => {
                    return obb2.distanceToBox(box);
                  },
                  intersectsBounds: (box, isLeaf, score) => {
                    return score < closestDistance && score < maxThreshold;
                  },
                  intersectsRange: (otherOffset, otherCount) => {
                    for (let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2++) {
                      const ti2 = otherBvh.resolveTriangleIndex(i2);
                      setTriangle(triangle22, 3 * ti2, otherIndex, otherPos);
                      triangle22.a.applyMatrix4(geometryToBvh);
                      triangle22.b.applyMatrix4(geometryToBvh);
                      triangle22.c.applyMatrix4(geometryToBvh);
                      triangle22.needsUpdate = true;
                      for (let i = offset, l = offset + count; i < l; i++) {
                        const ti = bvh.resolveTriangleIndex(i);
                        setTriangle(triangle3, 3 * ti, index, pos);
                        triangle3.needsUpdate = true;
                        const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                        if (dist < closestDistance) {
                          tempTargetDest1.copy(tempTarget1);
                          if (tempTargetDest2) {
                            tempTargetDest2.copy(tempTarget2);
                          }
                          closestDistance = dist;
                          closestDistanceTriIndex = i;
                          closestDistanceOtherTriIndex = i2;
                        }
                        if (dist < minThreshold) {
                          return true;
                        }
                      }
                    }
                  }
                });
              } else {
                const triCount = getTriCount(otherGeometry);
                for (let i2 = 0, l2 = triCount; i2 < l2; i2++) {
                  setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
                  triangle22.a.applyMatrix4(geometryToBvh);
                  triangle22.b.applyMatrix4(geometryToBvh);
                  triangle22.c.applyMatrix4(geometryToBvh);
                  triangle22.needsUpdate = true;
                  for (let i = offset, l = offset + count; i < l; i++) {
                    const ti = bvh.resolveTriangleIndex(i);
                    setTriangle(triangle3, 3 * ti, index, pos);
                    triangle3.needsUpdate = true;
                    const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                    if (dist < closestDistance) {
                      tempTargetDest1.copy(tempTarget1);
                      if (tempTargetDest2) {
                        tempTargetDest2.copy(tempTarget2);
                      }
                      closestDistance = dist;
                      closestDistanceTriIndex = i;
                      closestDistanceOtherTriIndex = i2;
                    }
                    if (dist < minThreshold) {
                      return true;
                    }
                  }
                }
              }
            }
          }
        );
        ExtendedTrianglePool.releasePrimitive(triangle3);
        ExtendedTrianglePool.releasePrimitive(triangle22);
        if (closestDistance === Infinity) {
          return null;
        }
        if (!target1.point) {
          target1.point = tempTargetDest1.clone();
        } else {
          target1.point.copy(tempTargetDest1);
        }
        target1.distance = closestDistance, target1.faceIndex = closestDistanceTriIndex;
        if (target2) {
          if (!target2.point) target2.point = tempTargetDest2.clone();
          else target2.point.copy(tempTargetDest2);
          target2.point.applyMatrix4(tempMatrix);
          tempTargetDest1.applyMatrix4(tempMatrix);
          target2.distance = tempTargetDest1.sub(target2.point).length();
          target2.faceIndex = closestDistanceOtherTriIndex;
        }
        return target1;
      }
      function isSharedArrayBufferSupported() {
        return typeof SharedArrayBuffer !== "undefined";
      }
      function convertToBufferType(array, BufferConstructor) {
        if (array === null) {
          return array;
        } else if (array.buffer) {
          const buffer = array.buffer;
          if (buffer.constructor === BufferConstructor) {
            return array;
          }
          const ArrayConstructor = array.constructor;
          const result = new ArrayConstructor(new BufferConstructor(buffer.byteLength));
          result.set(array);
          return result;
        } else {
          if (array.constructor === BufferConstructor) {
            return array;
          }
          const result = new BufferConstructor(array.byteLength);
          new Uint8Array(result).set(new Uint8Array(array));
          return result;
        }
      }
      const _bufferStack1 = new BufferStack.constructor();
      const _bufferStack2 = new BufferStack.constructor();
      const _boxPool = new PrimitivePool(() => new three.Box3());
      const _leftBox1 = new three.Box3();
      const _rightBox1 = new three.Box3();
      const _leftBox2 = new three.Box3();
      const _rightBox2 = new three.Box3();
      let _active = false;
      function bvhcast(bvh, otherBvh, matrixToLocal, intersectsRanges) {
        if (_active) {
          throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");
        }
        _active = true;
        const roots = bvh._roots;
        const otherRoots = otherBvh._roots;
        let result;
        let offset1 = 0;
        let offset2 = 0;
        const invMat = new three.Matrix4().copy(matrixToLocal).invert();
        for (let i = 0, il = roots.length; i < il; i++) {
          _bufferStack1.setBuffer(roots[i]);
          offset2 = 0;
          const localBox = _boxPool.getPrimitive();
          arrayToBox(BOUNDING_DATA_INDEX(0), _bufferStack1.float32Array, localBox);
          localBox.applyMatrix4(invMat);
          for (let j = 0, jl = otherRoots.length; j < jl; j++) {
            _bufferStack2.setBuffer(otherRoots[j]);
            result = _traverse(
              0,
              0,
              matrixToLocal,
              invMat,
              intersectsRanges,
              offset1,
              offset2,
              0,
              0,
              localBox
            );
            _bufferStack2.clearBuffer();
            offset2 += otherRoots[j].length;
            if (result) {
              break;
            }
          }
          _boxPool.releasePrimitive(localBox);
          _bufferStack1.clearBuffer();
          offset1 += roots[i].length;
          if (result) {
            break;
          }
        }
        _active = false;
        return result;
      }
      function _traverse(node1Index32, node2Index32, matrix2to1, matrix1to2, intersectsRangesFunc, node1IndexByteOffset = 0, node2IndexByteOffset = 0, depth1 = 0, depth2 = 0, currBox = null, reversed = false) {
        let bufferStack1, bufferStack2;
        if (reversed) {
          bufferStack1 = _bufferStack2;
          bufferStack2 = _bufferStack1;
        } else {
          bufferStack1 = _bufferStack1;
          bufferStack2 = _bufferStack2;
        }
        const float32Array1 = bufferStack1.float32Array, uint32Array1 = bufferStack1.uint32Array, uint16Array1 = bufferStack1.uint16Array, float32Array2 = bufferStack2.float32Array, uint32Array2 = bufferStack2.uint32Array, uint16Array2 = bufferStack2.uint16Array;
        const node1Index16 = node1Index32 * 2;
        const node2Index16 = node2Index32 * 2;
        const isLeaf1 = IS_LEAF(node1Index16, uint16Array1);
        const isLeaf2 = IS_LEAF(node2Index16, uint16Array2);
        let result = false;
        if (isLeaf2 && isLeaf1) {
          if (reversed) {
            result = intersectsRangesFunc(
              OFFSET(node2Index32, uint32Array2),
              COUNT(node2Index32 * 2, uint16Array2),
              OFFSET(node1Index32, uint32Array1),
              COUNT(node1Index32 * 2, uint16Array1),
              depth2,
              node2IndexByteOffset + node2Index32,
              depth1,
              node1IndexByteOffset + node1Index32
            );
          } else {
            result = intersectsRangesFunc(
              OFFSET(node1Index32, uint32Array1),
              COUNT(node1Index32 * 2, uint16Array1),
              OFFSET(node2Index32, uint32Array2),
              COUNT(node2Index32 * 2, uint16Array2),
              depth1,
              node1IndexByteOffset + node1Index32,
              depth2,
              node2IndexByteOffset + node2Index32
            );
          }
        } else if (isLeaf2) {
          const newBox = _boxPool.getPrimitive();
          arrayToBox(BOUNDING_DATA_INDEX(node2Index32), float32Array2, newBox);
          newBox.applyMatrix4(matrix2to1);
          const cl1 = LEFT_NODE(node1Index32);
          const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
          arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
          arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
          const intersectCl1 = newBox.intersectsBox(_leftBox1);
          const intersectCr1 = newBox.intersectsBox(_rightBox1);
          result = intersectCl1 && _traverse(
            node2Index32,
            cl1,
            matrix1to2,
            matrix2to1,
            intersectsRangesFunc,
            node2IndexByteOffset,
            node1IndexByteOffset,
            depth2,
            depth1 + 1,
            newBox,
            !reversed
          ) || intersectCr1 && _traverse(
            node2Index32,
            cr1,
            matrix1to2,
            matrix2to1,
            intersectsRangesFunc,
            node2IndexByteOffset,
            node1IndexByteOffset,
            depth2,
            depth1 + 1,
            newBox,
            !reversed
          );
          _boxPool.releasePrimitive(newBox);
        } else {
          const cl2 = LEFT_NODE(node2Index32);
          const cr2 = RIGHT_NODE(node2Index32, uint32Array2);
          arrayToBox(BOUNDING_DATA_INDEX(cl2), float32Array2, _leftBox2);
          arrayToBox(BOUNDING_DATA_INDEX(cr2), float32Array2, _rightBox2);
          const leftIntersects = currBox.intersectsBox(_leftBox2);
          const rightIntersects = currBox.intersectsBox(_rightBox2);
          if (leftIntersects && rightIntersects) {
            result = _traverse(
              node1Index32,
              cl2,
              matrix2to1,
              matrix1to2,
              intersectsRangesFunc,
              node1IndexByteOffset,
              node2IndexByteOffset,
              depth1,
              depth2 + 1,
              currBox,
              reversed
            ) || _traverse(
              node1Index32,
              cr2,
              matrix2to1,
              matrix1to2,
              intersectsRangesFunc,
              node1IndexByteOffset,
              node2IndexByteOffset,
              depth1,
              depth2 + 1,
              currBox,
              reversed
            );
          } else if (leftIntersects) {
            if (isLeaf1) {
              result = _traverse(
                node1Index32,
                cl2,
                matrix2to1,
                matrix1to2,
                intersectsRangesFunc,
                node1IndexByteOffset,
                node2IndexByteOffset,
                depth1,
                depth2 + 1,
                currBox,
                reversed
              );
            } else {
              const newBox = _boxPool.getPrimitive();
              newBox.copy(_leftBox2).applyMatrix4(matrix2to1);
              const cl1 = LEFT_NODE(node1Index32);
              const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
              arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
              arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
              const intersectCl1 = newBox.intersectsBox(_leftBox1);
              const intersectCr1 = newBox.intersectsBox(_rightBox1);
              result = intersectCl1 && _traverse(
                cl2,
                cl1,
                matrix1to2,
                matrix2to1,
                intersectsRangesFunc,
                node2IndexByteOffset,
                node1IndexByteOffset,
                depth2,
                depth1 + 1,
                newBox,
                !reversed
              ) || intersectCr1 && _traverse(
                cl2,
                cr1,
                matrix1to2,
                matrix2to1,
                intersectsRangesFunc,
                node2IndexByteOffset,
                node1IndexByteOffset,
                depth2,
                depth1 + 1,
                newBox,
                !reversed
              );
              _boxPool.releasePrimitive(newBox);
            }
          } else if (rightIntersects) {
            if (isLeaf1) {
              result = _traverse(
                node1Index32,
                cr2,
                matrix2to1,
                matrix1to2,
                intersectsRangesFunc,
                node1IndexByteOffset,
                node2IndexByteOffset,
                depth1,
                depth2 + 1,
                currBox,
                reversed
              );
            } else {
              const newBox = _boxPool.getPrimitive();
              newBox.copy(_rightBox2).applyMatrix4(matrix2to1);
              const cl1 = LEFT_NODE(node1Index32);
              const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
              arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
              arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
              const intersectCl1 = newBox.intersectsBox(_leftBox1);
              const intersectCr1 = newBox.intersectsBox(_rightBox1);
              result = intersectCl1 && _traverse(
                cr2,
                cl1,
                matrix1to2,
                matrix2to1,
                intersectsRangesFunc,
                node2IndexByteOffset,
                node1IndexByteOffset,
                depth2,
                depth1 + 1,
                newBox,
                !reversed
              ) || intersectCr1 && _traverse(
                cr2,
                cr1,
                matrix1to2,
                matrix2to1,
                intersectsRangesFunc,
                node2IndexByteOffset,
                node1IndexByteOffset,
                depth2,
                depth1 + 1,
                newBox,
                !reversed
              );
              _boxPool.releasePrimitive(newBox);
            }
          }
        }
        return result;
      }
      const obb = /* @__PURE__ */ new OrientedBox();
      const tempBox = /* @__PURE__ */ new three.Box3();
      const DEFAULT_OPTIONS = {
        strategy: CENTER,
        maxDepth: 40,
        maxLeafTris: 10,
        useSharedArrayBuffer: false,
        setBoundingBox: true,
        onProgress: null,
        indirect: false,
        verbose: true,
        range: null
      };
      class MeshBVH {
        static serialize(bvh, options = {}) {
          options = {
            cloneBuffers: true,
            ...options
          };
          const geometry = bvh.geometry;
          const rootData = bvh._roots;
          const indirectBuffer = bvh._indirectBuffer;
          const indexAttribute = geometry.getIndex();
          let result;
          if (options.cloneBuffers) {
            result = {
              roots: rootData.map((root2) => root2.slice()),
              index: indexAttribute ? indexAttribute.array.slice() : null,
              indirectBuffer: indirectBuffer ? indirectBuffer.slice() : null
            };
          } else {
            result = {
              roots: rootData,
              index: indexAttribute ? indexAttribute.array : null,
              indirectBuffer
            };
          }
          return result;
        }
        static deserialize(data, geometry, options = {}) {
          options = {
            setIndex: true,
            indirect: Boolean(data.indirectBuffer),
            ...options
          };
          const { index, roots, indirectBuffer } = data;
          const bvh = new MeshBVH(geometry, { ...options, [SKIP_GENERATION]: true });
          bvh._roots = roots;
          bvh._indirectBuffer = indirectBuffer || null;
          if (options.setIndex) {
            const indexAttribute = geometry.getIndex();
            if (indexAttribute === null) {
              const newIndex = new three.BufferAttribute(data.index, 1, false);
              geometry.setIndex(newIndex);
            } else if (indexAttribute.array !== index) {
              indexAttribute.array.set(index);
              indexAttribute.needsUpdate = true;
            }
          }
          return bvh;
        }
        get indirect() {
          return !!this._indirectBuffer;
        }
        constructor(geometry, options = {}) {
          if (!geometry.isBufferGeometry) {
            throw new Error("MeshBVH: Only BufferGeometries are supported.");
          } else if (geometry.index && geometry.index.isInterleavedBufferAttribute) {
            throw new Error("MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.");
          }
          options = Object.assign({
            ...DEFAULT_OPTIONS,
            // undocumented options
            // Whether to skip generating the tree. Used for deserialization.
            [SKIP_GENERATION]: false
          }, options);
          if (options.useSharedArrayBuffer && !isSharedArrayBufferSupported()) {
            throw new Error("MeshBVH: SharedArrayBuffer is not available.");
          }
          this.geometry = geometry;
          this._roots = null;
          this._indirectBuffer = null;
          if (!options[SKIP_GENERATION]) {
            buildPackedTree(this, options);
            if (!geometry.boundingBox && options.setBoundingBox) {
              geometry.boundingBox = this.getBoundingBox(new three.Box3());
            }
          }
          this.resolveTriangleIndex = options.indirect ? (i) => this._indirectBuffer[i] : (i) => i;
        }
        refit(nodeIndices = null) {
          const refitFunc = this.indirect ? refit_indirect : refit;
          return refitFunc(this, nodeIndices);
        }
        traverse(callback, rootIndex = 0) {
          const buffer = this._roots[rootIndex];
          const uint32Array2 = new Uint32Array(buffer);
          const uint16Array2 = new Uint16Array(buffer);
          _traverse2(0);
          function _traverse2(node32Index, depth = 0) {
            const node16Index = node32Index * 2;
            const isLeaf = uint16Array2[node16Index + 15] === IS_LEAFNODE_FLAG;
            if (isLeaf) {
              const offset = uint32Array2[node32Index + 6];
              const count = uint16Array2[node16Index + 14];
              callback(depth, isLeaf, new Float32Array(buffer, node32Index * 4, 6), offset, count);
            } else {
              const left = node32Index + BYTES_PER_NODE / 4;
              const right = uint32Array2[node32Index + 6];
              const splitAxis = uint32Array2[node32Index + 7];
              const stopTraversal = callback(depth, isLeaf, new Float32Array(buffer, node32Index * 4, 6), splitAxis);
              if (!stopTraversal) {
                _traverse2(left, depth + 1);
                _traverse2(right, depth + 1);
              }
            }
          }
        }
        /* Core Cast Functions */
        raycast(ray2, materialOrSide = three.FrontSide, near = 0, far = Infinity) {
          const roots = this._roots;
          const geometry = this.geometry;
          const intersects = [];
          const isMaterial = materialOrSide.isMaterial;
          const isArrayMaterial = Array.isArray(materialOrSide);
          const groups = geometry.groups;
          const side = isMaterial ? materialOrSide.side : materialOrSide;
          const raycastFunc = this.indirect ? raycast_indirect : raycast;
          for (let i = 0, l = roots.length; i < l; i++) {
            const materialSide = isArrayMaterial ? materialOrSide[groups[i].materialIndex].side : side;
            const startCount = intersects.length;
            raycastFunc(this, i, materialSide, ray2, intersects, near, far);
            if (isArrayMaterial) {
              const materialIndex = groups[i].materialIndex;
              for (let j = startCount, jl = intersects.length; j < jl; j++) {
                intersects[j].face.materialIndex = materialIndex;
              }
            }
          }
          return intersects;
        }
        raycastFirst(ray2, materialOrSide = three.FrontSide, near = 0, far = Infinity) {
          const roots = this._roots;
          const geometry = this.geometry;
          const isMaterial = materialOrSide.isMaterial;
          const isArrayMaterial = Array.isArray(materialOrSide);
          let closestResult = null;
          const groups = geometry.groups;
          const side = isMaterial ? materialOrSide.side : materialOrSide;
          const raycastFirstFunc = this.indirect ? raycastFirst_indirect : raycastFirst;
          for (let i = 0, l = roots.length; i < l; i++) {
            const materialSide = isArrayMaterial ? materialOrSide[groups[i].materialIndex].side : side;
            const result = raycastFirstFunc(this, i, materialSide, ray2, near, far);
            if (result != null && (closestResult == null || result.distance < closestResult.distance)) {
              closestResult = result;
              if (isArrayMaterial) {
                result.face.materialIndex = groups[i].materialIndex;
              }
            }
          }
          return closestResult;
        }
        intersectsGeometry(otherGeometry, geomToMesh) {
          let result = false;
          const roots = this._roots;
          const intersectsGeometryFunc = this.indirect ? intersectsGeometry_indirect : intersectsGeometry;
          for (let i = 0, l = roots.length; i < l; i++) {
            result = intersectsGeometryFunc(this, i, otherGeometry, geomToMesh);
            if (result) {
              break;
            }
          }
          return result;
        }
        shapecast(callbacks) {
          const triangle3 = ExtendedTrianglePool.getPrimitive();
          const iterateFunc = this.indirect ? iterateOverTriangles_indirect : iterateOverTriangles;
          let {
            boundsTraverseOrder,
            intersectsBounds,
            intersectsRange,
            intersectsTriangle
          } = callbacks;
          if (intersectsRange && intersectsTriangle) {
            const originalIntersectsRange = intersectsRange;
            intersectsRange = (offset, count, contained, depth, nodeIndex) => {
              if (!originalIntersectsRange(offset, count, contained, depth, nodeIndex)) {
                return iterateFunc(offset, count, this, intersectsTriangle, contained, depth, triangle3);
              }
              return true;
            };
          } else if (!intersectsRange) {
            if (intersectsTriangle) {
              intersectsRange = (offset, count, contained, depth) => {
                return iterateFunc(offset, count, this, intersectsTriangle, contained, depth, triangle3);
              };
            } else {
              intersectsRange = (offset, count, contained) => {
                return contained;
              };
            }
          }
          let result = false;
          let byteOffset = 0;
          const roots = this._roots;
          for (let i = 0, l = roots.length; i < l; i++) {
            const root2 = roots[i];
            result = shapecast(this, i, intersectsBounds, intersectsRange, boundsTraverseOrder, byteOffset);
            if (result) {
              break;
            }
            byteOffset += root2.byteLength;
          }
          ExtendedTrianglePool.releasePrimitive(triangle3);
          return result;
        }
        bvhcast(otherBvh, matrixToLocal, callbacks) {
          let {
            intersectsRanges,
            intersectsTriangles
          } = callbacks;
          const triangle1 = ExtendedTrianglePool.getPrimitive();
          const indexAttr1 = this.geometry.index;
          const positionAttr1 = this.geometry.attributes.position;
          const assignTriangle1 = this.indirect ? (i1) => {
            const ti = this.resolveTriangleIndex(i1);
            setTriangle(triangle1, ti * 3, indexAttr1, positionAttr1);
          } : (i1) => {
            setTriangle(triangle1, i1 * 3, indexAttr1, positionAttr1);
          };
          const triangle22 = ExtendedTrianglePool.getPrimitive();
          const indexAttr2 = otherBvh.geometry.index;
          const positionAttr2 = otherBvh.geometry.attributes.position;
          const assignTriangle2 = otherBvh.indirect ? (i2) => {
            const ti2 = otherBvh.resolveTriangleIndex(i2);
            setTriangle(triangle22, ti2 * 3, indexAttr2, positionAttr2);
          } : (i2) => {
            setTriangle(triangle22, i2 * 3, indexAttr2, positionAttr2);
          };
          if (intersectsTriangles) {
            const iterateOverDoubleTriangles = (offset1, count1, offset2, count2, depth1, index1, depth2, index2) => {
              for (let i2 = offset2, l2 = offset2 + count2; i2 < l2; i2++) {
                assignTriangle2(i2);
                triangle22.a.applyMatrix4(matrixToLocal);
                triangle22.b.applyMatrix4(matrixToLocal);
                triangle22.c.applyMatrix4(matrixToLocal);
                triangle22.needsUpdate = true;
                for (let i1 = offset1, l1 = offset1 + count1; i1 < l1; i1++) {
                  assignTriangle1(i1);
                  triangle1.needsUpdate = true;
                  if (intersectsTriangles(triangle1, triangle22, i1, i2, depth1, index1, depth2, index2)) {
                    return true;
                  }
                }
              }
              return false;
            };
            if (intersectsRanges) {
              const originalIntersectsRanges = intersectsRanges;
              intersectsRanges = function(offset1, count1, offset2, count2, depth1, index1, depth2, index2) {
                if (!originalIntersectsRanges(offset1, count1, offset2, count2, depth1, index1, depth2, index2)) {
                  return iterateOverDoubleTriangles(offset1, count1, offset2, count2, depth1, index1, depth2, index2);
                }
                return true;
              };
            } else {
              intersectsRanges = iterateOverDoubleTriangles;
            }
          }
          return bvhcast(this, otherBvh, matrixToLocal, intersectsRanges);
        }
        /* Derived Cast Functions */
        intersectsBox(box, boxToMesh) {
          obb.set(box.min, box.max, boxToMesh);
          obb.needsUpdate = true;
          return this.shapecast(
            {
              intersectsBounds: (box2) => obb.intersectsBox(box2),
              intersectsTriangle: (tri) => obb.intersectsTriangle(tri)
            }
          );
        }
        intersectsSphere(sphere) {
          return this.shapecast(
            {
              intersectsBounds: (box) => sphere.intersectsBox(box),
              intersectsTriangle: (tri) => tri.intersectsSphere(sphere)
            }
          );
        }
        closestPointToGeometry(otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
          const closestPointToGeometryFunc = this.indirect ? closestPointToGeometry_indirect : closestPointToGeometry;
          return closestPointToGeometryFunc(
            this,
            otherGeometry,
            geometryToBvh,
            target1,
            target2,
            minThreshold,
            maxThreshold
          );
        }
        closestPointToPoint(point, target = {}, minThreshold = 0, maxThreshold = Infinity) {
          return closestPointToPoint(
            this,
            point,
            target,
            minThreshold,
            maxThreshold
          );
        }
        getBoundingBox(target) {
          target.makeEmpty();
          const roots = this._roots;
          roots.forEach((buffer) => {
            arrayToBox(0, new Float32Array(buffer), tempBox);
            target.union(tempBox);
          });
          return target;
        }
      }
      const boundingBox = /* @__PURE__ */ new three.Box3();
      const matrix = /* @__PURE__ */ new three.Matrix4();
      class MeshBVHRootHelper extends three.Object3D {
        get isMesh() {
          return !this.displayEdges;
        }
        get isLineSegments() {
          return this.displayEdges;
        }
        get isLine() {
          return this.displayEdges;
        }
        getVertexPosition(...args) {
          return three.Mesh.prototype.getVertexPosition.call(this, ...args);
        }
        constructor(bvh, material, depth = 10, group = 0) {
          super();
          this.material = material;
          this.geometry = new three.BufferGeometry();
          this.name = "MeshBVHRootHelper";
          this.depth = depth;
          this.displayParents = false;
          this.bvh = bvh;
          this.displayEdges = true;
          this._group = group;
        }
        raycast() {
        }
        update() {
          const geometry = this.geometry;
          const boundsTree = this.bvh;
          const group = this._group;
          geometry.dispose();
          this.visible = false;
          if (boundsTree) {
            const targetDepth = this.depth - 1;
            const displayParents = this.displayParents;
            let boundsCount = 0;
            boundsTree.traverse((depth, isLeaf) => {
              if (depth >= targetDepth || isLeaf) {
                boundsCount++;
                return true;
              } else if (displayParents) {
                boundsCount++;
              }
            }, group);
            let posIndex = 0;
            const positionArray = new Float32Array(8 * 3 * boundsCount);
            boundsTree.traverse((depth, isLeaf, boundingData) => {
              const terminate = depth >= targetDepth || isLeaf;
              if (terminate || displayParents) {
                arrayToBox(0, boundingData, boundingBox);
                const { min, max } = boundingBox;
                for (let x = -1; x <= 1; x += 2) {
                  const xVal = x < 0 ? min.x : max.x;
                  for (let y = -1; y <= 1; y += 2) {
                    const yVal = y < 0 ? min.y : max.y;
                    for (let z = -1; z <= 1; z += 2) {
                      const zVal = z < 0 ? min.z : max.z;
                      positionArray[posIndex + 0] = xVal;
                      positionArray[posIndex + 1] = yVal;
                      positionArray[posIndex + 2] = zVal;
                      posIndex += 3;
                    }
                  }
                }
                return terminate;
              }
            }, group);
            let indexArray;
            let indices;
            if (this.displayEdges) {
              indices = new Uint8Array([
                // x axis
                0,
                4,
                1,
                5,
                2,
                6,
                3,
                7,
                // y axis
                0,
                2,
                1,
                3,
                4,
                6,
                5,
                7,
                // z axis
                0,
                1,
                2,
                3,
                4,
                5,
                6,
                7
              ]);
            } else {
              indices = new Uint8Array([
                // X-, X+
                0,
                1,
                2,
                2,
                1,
                3,
                4,
                6,
                5,
                6,
                7,
                5,
                // Y-, Y+
                1,
                4,
                5,
                0,
                4,
                1,
                2,
                3,
                6,
                3,
                7,
                6,
                // Z-, Z+
                0,
                2,
                4,
                2,
                6,
                4,
                1,
                5,
                3,
                3,
                5,
                7
              ]);
            }
            if (positionArray.length > 65535) {
              indexArray = new Uint32Array(indices.length * boundsCount);
            } else {
              indexArray = new Uint16Array(indices.length * boundsCount);
            }
            const indexLength = indices.length;
            for (let i = 0; i < boundsCount; i++) {
              const posOffset = i * 8;
              const indexOffset = i * indexLength;
              for (let j = 0; j < indexLength; j++) {
                indexArray[indexOffset + j] = posOffset + indices[j];
              }
            }
            geometry.setIndex(
              new three.BufferAttribute(indexArray, 1, false)
            );
            geometry.setAttribute(
              "position",
              new three.BufferAttribute(positionArray, 3, false)
            );
            this.visible = true;
          }
        }
      }
      class MeshBVHHelper extends three.Group {
        get color() {
          return this.edgeMaterial.color;
        }
        get opacity() {
          return this.edgeMaterial.opacity;
        }
        set opacity(v) {
          this.edgeMaterial.opacity = v;
          this.meshMaterial.opacity = v;
        }
        constructor(mesh = null, bvh = null, depth = 10) {
          if (mesh instanceof MeshBVH) {
            depth = bvh || 10;
            bvh = mesh;
            mesh = null;
          }
          if (typeof bvh === "number") {
            depth = bvh;
            bvh = null;
          }
          super();
          this.name = "MeshBVHHelper";
          this.depth = depth;
          this.mesh = mesh;
          this.bvh = bvh;
          this.displayParents = false;
          this.displayEdges = true;
          this.objectIndex = 0;
          this._roots = [];
          const edgeMaterial = new three.LineBasicMaterial({
            color: 65416,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
          });
          const meshMaterial = new three.MeshBasicMaterial({
            color: 65416,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
          });
          meshMaterial.color = edgeMaterial.color;
          this.edgeMaterial = edgeMaterial;
          this.meshMaterial = meshMaterial;
          this.update();
        }
        update() {
          const mesh = this.mesh;
          let bvh = this.bvh || mesh.geometry.boundsTree || null;
          if (mesh.isBatchedMesh && mesh.boundsTrees && !bvh) {
            const drawInfo = mesh._drawInfo[this.objectIndex];
            if (drawInfo) {
              bvh = mesh.boundsTrees[drawInfo.geometryIndex] || bvh;
            }
          }
          const totalRoots = bvh ? bvh._roots.length : 0;
          while (this._roots.length > totalRoots) {
            const root2 = this._roots.pop();
            root2.geometry.dispose();
            this.remove(root2);
          }
          for (let i = 0; i < totalRoots; i++) {
            const { depth, edgeMaterial, meshMaterial, displayParents, displayEdges } = this;
            if (i >= this._roots.length) {
              const root3 = new MeshBVHRootHelper(bvh, edgeMaterial, depth, i);
              this.add(root3);
              this._roots.push(root3);
            }
            const root2 = this._roots[i];
            root2.bvh = bvh;
            root2.depth = depth;
            root2.displayParents = displayParents;
            root2.displayEdges = displayEdges;
            root2.material = displayEdges ? edgeMaterial : meshMaterial;
            root2.update();
          }
        }
        updateMatrixWorld(...args) {
          const mesh = this.mesh;
          const parent = this.parent;
          if (mesh !== null) {
            mesh.updateWorldMatrix(true, false);
            if (parent) {
              this.matrix.copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld);
            } else {
              this.matrix.copy(mesh.matrixWorld);
            }
            if (mesh.isInstancedMesh || mesh.isBatchedMesh) {
              mesh.getMatrixAt(this.objectIndex, matrix);
              this.matrix.multiply(matrix);
            }
            this.matrix.decompose(
              this.position,
              this.quaternion,
              this.scale
            );
          }
          super.updateMatrixWorld(...args);
        }
        copy(source) {
          this.depth = source.depth;
          this.mesh = source.mesh;
          this.bvh = source.bvh;
          this.opacity = source.opacity;
          this.color.copy(source.color);
        }
        clone() {
          return new MeshBVHHelper(this.mesh, this.bvh, this.depth);
        }
        dispose() {
          this.edgeMaterial.dispose();
          this.meshMaterial.dispose();
          const children = this.children;
          for (let i = 0, l = children.length; i < l; i++) {
            children[i].geometry.dispose();
          }
        }
      }
      class MeshBVHVisualizer extends MeshBVHHelper {
        constructor(...args) {
          super(...args);
          console.warn("MeshBVHVisualizer: MeshBVHVisualizer has been deprecated. Use MeshBVHHelper, instead.");
        }
      }
      const _box1 = /* @__PURE__ */ new three.Box3();
      const _box2 = /* @__PURE__ */ new three.Box3();
      const _vec = /* @__PURE__ */ new three.Vector3();
      function getPrimitiveSize(el) {
        switch (typeof el) {
          case "number":
            return 8;
          case "string":
            return el.length * 2;
          case "boolean":
            return 4;
          default:
            return 0;
        }
      }
      function isTypedArray(arr) {
        const regex = /(Uint|Int|Float)(8|16|32)Array/;
        return regex.test(arr.constructor.name);
      }
      function getRootExtremes(bvh, group) {
        const result = {
          nodeCount: 0,
          leafNodeCount: 0,
          depth: {
            min: Infinity,
            max: -Infinity
          },
          tris: {
            min: Infinity,
            max: -Infinity
          },
          splits: [0, 0, 0],
          surfaceAreaScore: 0
        };
        bvh.traverse((depth, isLeaf, boundingData, offsetOrSplit, count) => {
          const l0 = boundingData[0 + 3] - boundingData[0];
          const l1 = boundingData[1 + 3] - boundingData[1];
          const l2 = boundingData[2 + 3] - boundingData[2];
          const surfaceArea = 2 * (l0 * l1 + l1 * l2 + l2 * l0);
          result.nodeCount++;
          if (isLeaf) {
            result.leafNodeCount++;
            result.depth.min = Math.min(depth, result.depth.min);
            result.depth.max = Math.max(depth, result.depth.max);
            result.tris.min = Math.min(count, result.tris.min);
            result.tris.max = Math.max(count, result.tris.max);
            result.surfaceAreaScore += surfaceArea * TRIANGLE_INTERSECT_COST * count;
          } else {
            result.splits[offsetOrSplit]++;
            result.surfaceAreaScore += surfaceArea * TRAVERSAL_COST;
          }
        }, group);
        if (result.tris.min === Infinity) {
          result.tris.min = 0;
          result.tris.max = 0;
        }
        if (result.depth.min === Infinity) {
          result.depth.min = 0;
          result.depth.max = 0;
        }
        return result;
      }
      function getBVHExtremes(bvh) {
        return bvh._roots.map((root2, i) => getRootExtremes(bvh, i));
      }
      function estimateMemoryInBytes(obj) {
        const traversed = /* @__PURE__ */ new Set();
        const stack = [obj];
        let bytes = 0;
        while (stack.length) {
          const curr = stack.pop();
          if (traversed.has(curr)) {
            continue;
          }
          traversed.add(curr);
          for (let key in curr) {
            if (!Object.hasOwn(curr, key)) {
              continue;
            }
            bytes += getPrimitiveSize(key);
            const value = curr[key];
            if (value && (typeof value === "object" || typeof value === "function")) {
              if (isTypedArray(value)) {
                bytes += value.byteLength;
              } else if (isSharedArrayBufferSupported() && value instanceof SharedArrayBuffer) {
                bytes += value.byteLength;
              } else if (value instanceof ArrayBuffer) {
                bytes += value.byteLength;
              } else {
                stack.push(value);
              }
            } else {
              bytes += getPrimitiveSize(value);
            }
          }
        }
        return bytes;
      }
      function validateBounds(bvh) {
        const geometry = bvh.geometry;
        const depthStack = [];
        const index = geometry.index;
        const position = geometry.getAttribute("position");
        let passes = true;
        bvh.traverse((depth, isLeaf, boundingData, offset, count) => {
          const info = {
            depth,
            isLeaf,
            boundingData,
            offset,
            count
          };
          depthStack[depth] = info;
          arrayToBox(0, boundingData, _box1);
          const parent = depthStack[depth - 1];
          if (isLeaf) {
            for (let i = offset, l = offset + count; i < l; i++) {
              const triIndex = bvh.resolveTriangleIndex(i);
              let i0 = 3 * triIndex;
              let i1 = 3 * triIndex + 1;
              let i2 = 3 * triIndex + 2;
              if (index) {
                i0 = index.getX(i0);
                i1 = index.getX(i1);
                i2 = index.getX(i2);
              }
              let isContained;
              _vec.fromBufferAttribute(position, i0);
              isContained = _box1.containsPoint(_vec);
              _vec.fromBufferAttribute(position, i1);
              isContained = isContained && _box1.containsPoint(_vec);
              _vec.fromBufferAttribute(position, i2);
              isContained = isContained && _box1.containsPoint(_vec);
              console.assert(isContained, "Leaf bounds does not fully contain triangle.");
              passes = passes && isContained;
            }
          }
          if (parent) {
            arrayToBox(0, boundingData, _box2);
            const isContained = _box2.containsBox(_box1);
            console.assert(isContained, "Parent bounds does not fully contain child.");
            passes = passes && isContained;
          }
        });
        return passes;
      }
      function getJSONStructure(bvh) {
        const depthStack = [];
        bvh.traverse((depth, isLeaf, boundingData, offset, count) => {
          const info = {
            bounds: arrayToBox(0, boundingData, new three.Box3())
          };
          if (isLeaf) {
            info.count = count;
            info.offset = offset;
          } else {
            info.left = null;
            info.right = null;
          }
          depthStack[depth] = info;
          const parent = depthStack[depth - 1];
          if (parent) {
            if (parent.left === null) {
              parent.left = info;
            } else {
              parent.right = info;
            }
          }
        });
        return depthStack[0];
      }
      function convertRaycastIntersect(hit, object, raycaster) {
        if (hit === null) {
          return null;
        }
        hit.point.applyMatrix4(object.matrixWorld);
        hit.distance = hit.point.distanceTo(raycaster.ray.origin);
        hit.object = object;
        return hit;
      }
      const IS_REVISION_166 = parseInt(three.REVISION) >= 166;
      const ray = /* @__PURE__ */ new three.Ray();
      const direction = /* @__PURE__ */ new three.Vector3();
      const tmpInverseMatrix = /* @__PURE__ */ new three.Matrix4();
      const origMeshRaycastFunc = three.Mesh.prototype.raycast;
      const origBatchedRaycastFunc = three.BatchedMesh.prototype.raycast;
      const _worldScale = /* @__PURE__ */ new three.Vector3();
      const _mesh = /* @__PURE__ */ new three.Mesh();
      const _batchIntersects = [];
      function acceleratedRaycast2(raycaster, intersects) {
        if (this.isBatchedMesh) {
          acceleratedBatchedMeshRaycast.call(this, raycaster, intersects);
        } else {
          acceleratedMeshRaycast.call(this, raycaster, intersects);
        }
      }
      function acceleratedBatchedMeshRaycast(raycaster, intersects) {
        if (this.boundsTrees) {
          const boundsTrees = this.boundsTrees;
          const drawInfo = this._drawInfo || this._instanceInfo;
          const drawRanges = this._drawRanges || this._geometryInfo;
          const matrixWorld = this.matrixWorld;
          _mesh.material = this.material;
          _mesh.geometry = this.geometry;
          const oldBoundsTree = _mesh.geometry.boundsTree;
          const oldDrawRange = _mesh.geometry.drawRange;
          if (_mesh.geometry.boundingSphere === null) {
            _mesh.geometry.boundingSphere = new three.Sphere();
          }
          for (let i = 0, l = drawInfo.length; i < l; i++) {
            if (!this.getVisibleAt(i)) {
              continue;
            }
            const geometryId = drawInfo[i].geometryIndex;
            _mesh.geometry.boundsTree = boundsTrees[geometryId];
            this.getMatrixAt(i, _mesh.matrixWorld).premultiply(matrixWorld);
            if (!_mesh.geometry.boundsTree) {
              this.getBoundingBoxAt(geometryId, _mesh.geometry.boundingBox);
              this.getBoundingSphereAt(geometryId, _mesh.geometry.boundingSphere);
              const drawRange = drawRanges[geometryId];
              _mesh.geometry.setDrawRange(drawRange.start, drawRange.count);
            }
            _mesh.raycast(raycaster, _batchIntersects);
            for (let j = 0, l2 = _batchIntersects.length; j < l2; j++) {
              const intersect = _batchIntersects[j];
              intersect.object = this;
              intersect.batchId = i;
              intersects.push(intersect);
            }
            _batchIntersects.length = 0;
          }
          _mesh.geometry.boundsTree = oldBoundsTree;
          _mesh.geometry.drawRange = oldDrawRange;
          _mesh.material = null;
          _mesh.geometry = null;
        } else {
          origBatchedRaycastFunc.call(this, raycaster, intersects);
        }
      }
      function acceleratedMeshRaycast(raycaster, intersects) {
        if (this.geometry.boundsTree) {
          if (this.material === void 0) return;
          tmpInverseMatrix.copy(this.matrixWorld).invert();
          ray.copy(raycaster.ray).applyMatrix4(tmpInverseMatrix);
          _worldScale.setFromMatrixScale(this.matrixWorld);
          direction.copy(ray.direction).multiply(_worldScale);
          const scaleFactor = direction.length();
          const near = raycaster.near / scaleFactor;
          const far = raycaster.far / scaleFactor;
          const bvh = this.geometry.boundsTree;
          if (raycaster.firstHitOnly === true) {
            const hit = convertRaycastIntersect(bvh.raycastFirst(ray, this.material, near, far), this, raycaster);
            if (hit) {
              intersects.push(hit);
            }
          } else {
            const hits = bvh.raycast(ray, this.material, near, far);
            for (let i = 0, l = hits.length; i < l; i++) {
              const hit = convertRaycastIntersect(hits[i], this, raycaster);
              if (hit) {
                intersects.push(hit);
              }
            }
          }
        } else {
          origMeshRaycastFunc.call(this, raycaster, intersects);
        }
      }
      function computeBoundsTree2(options = {}) {
        this.boundsTree = new MeshBVH(this, options);
        return this.boundsTree;
      }
      function disposeBoundsTree2() {
        this.boundsTree = null;
      }
      function computeBatchedBoundsTree(index = -1, options = {}) {
        if (!IS_REVISION_166) {
          throw new Error("BatchedMesh: Three r166+ is required to compute bounds trees.");
        }
        if (options.indirect) {
          console.warn('"Indirect" is set to false because it is not supported for BatchedMesh.');
        }
        options = {
          ...options,
          indirect: false,
          range: null
        };
        const drawRanges = this._drawRanges || this._geometryInfo;
        const geometryCount = this._geometryCount;
        if (!this.boundsTrees) {
          this.boundsTrees = new Array(geometryCount).fill(null);
        }
        const boundsTrees = this.boundsTrees;
        while (boundsTrees.length < geometryCount) {
          boundsTrees.push(null);
        }
        if (index < 0) {
          for (let i = 0; i < geometryCount; i++) {
            options.range = drawRanges[i];
            boundsTrees[i] = new MeshBVH(this.geometry, options);
          }
          return boundsTrees;
        } else {
          if (index < drawRanges.length) {
            options.range = drawRanges[index];
            boundsTrees[index] = new MeshBVH(this.geometry, options);
          }
          return boundsTrees[index] || null;
        }
      }
      function disposeBatchedBoundsTree(index = -1) {
        if (index < 0) {
          this.boundsTrees.fill(null);
        } else {
          if (index < this.boundsTree.length) {
            this.boundsTrees[index] = null;
          }
        }
      }
      function countToStringFormat(count) {
        switch (count) {
          case 1:
            return "R";
          case 2:
            return "RG";
          case 3:
            return "RGBA";
          case 4:
            return "RGBA";
        }
        throw new Error();
      }
      function countToFormat(count) {
        switch (count) {
          case 1:
            return three.RedFormat;
          case 2:
            return three.RGFormat;
          case 3:
            return three.RGBAFormat;
          case 4:
            return three.RGBAFormat;
        }
      }
      function countToIntFormat(count) {
        switch (count) {
          case 1:
            return three.RedIntegerFormat;
          case 2:
            return three.RGIntegerFormat;
          case 3:
            return three.RGBAIntegerFormat;
          case 4:
            return three.RGBAIntegerFormat;
        }
      }
      class VertexAttributeTexture extends three.DataTexture {
        constructor() {
          super();
          this.minFilter = three.NearestFilter;
          this.magFilter = three.NearestFilter;
          this.generateMipmaps = false;
          this.overrideItemSize = null;
          this._forcedType = null;
        }
        updateFrom(attr) {
          const overrideItemSize = this.overrideItemSize;
          const originalItemSize = attr.itemSize;
          const originalCount = attr.count;
          if (overrideItemSize !== null) {
            if (originalItemSize * originalCount % overrideItemSize !== 0) {
              throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");
            }
            attr.itemSize = overrideItemSize;
            attr.count = originalCount * originalItemSize / overrideItemSize;
          }
          const itemSize = attr.itemSize;
          const count = attr.count;
          const normalized = attr.normalized;
          const originalBufferCons = attr.array.constructor;
          const byteCount = originalBufferCons.BYTES_PER_ELEMENT;
          let targetType = this._forcedType;
          let finalStride = itemSize;
          if (targetType === null) {
            switch (originalBufferCons) {
              case Float32Array:
                targetType = three.FloatType;
                break;
              case Uint8Array:
              case Uint16Array:
              case Uint32Array:
                targetType = three.UnsignedIntType;
                break;
              case Int8Array:
              case Int16Array:
              case Int32Array:
                targetType = three.IntType;
                break;
            }
          }
          let type, format, normalizeValue, targetBufferCons;
          let internalFormat = countToStringFormat(itemSize);
          switch (targetType) {
            case three.FloatType:
              normalizeValue = 1;
              format = countToFormat(itemSize);
              if (normalized && byteCount === 1) {
                targetBufferCons = originalBufferCons;
                internalFormat += "8";
                if (originalBufferCons === Uint8Array) {
                  type = three.UnsignedByteType;
                } else {
                  type = three.ByteType;
                  internalFormat += "_SNORM";
                }
              } else {
                targetBufferCons = Float32Array;
                internalFormat += "32F";
                type = three.FloatType;
              }
              break;
            case three.IntType:
              internalFormat += byteCount * 8 + "I";
              normalizeValue = normalized ? Math.pow(2, originalBufferCons.BYTES_PER_ELEMENT * 8 - 1) : 1;
              format = countToIntFormat(itemSize);
              if (byteCount === 1) {
                targetBufferCons = Int8Array;
                type = three.ByteType;
              } else if (byteCount === 2) {
                targetBufferCons = Int16Array;
                type = three.ShortType;
              } else {
                targetBufferCons = Int32Array;
                type = three.IntType;
              }
              break;
            case three.UnsignedIntType:
              internalFormat += byteCount * 8 + "UI";
              normalizeValue = normalized ? Math.pow(2, originalBufferCons.BYTES_PER_ELEMENT * 8 - 1) : 1;
              format = countToIntFormat(itemSize);
              if (byteCount === 1) {
                targetBufferCons = Uint8Array;
                type = three.UnsignedByteType;
              } else if (byteCount === 2) {
                targetBufferCons = Uint16Array;
                type = three.UnsignedShortType;
              } else {
                targetBufferCons = Uint32Array;
                type = three.UnsignedIntType;
              }
              break;
          }
          if (finalStride === 3 && (format === three.RGBAFormat || format === three.RGBAIntegerFormat)) {
            finalStride = 4;
          }
          const dimension = Math.ceil(Math.sqrt(count)) || 1;
          const length = finalStride * dimension * dimension;
          const dataArray = new targetBufferCons(length);
          const originalNormalized = attr.normalized;
          attr.normalized = false;
          for (let i = 0; i < count; i++) {
            const ii = finalStride * i;
            dataArray[ii] = attr.getX(i) / normalizeValue;
            if (itemSize >= 2) {
              dataArray[ii + 1] = attr.getY(i) / normalizeValue;
            }
            if (itemSize >= 3) {
              dataArray[ii + 2] = attr.getZ(i) / normalizeValue;
              if (finalStride === 4) {
                dataArray[ii + 3] = 1;
              }
            }
            if (itemSize >= 4) {
              dataArray[ii + 3] = attr.getW(i) / normalizeValue;
            }
          }
          attr.normalized = originalNormalized;
          this.internalFormat = internalFormat;
          this.format = format;
          this.type = type;
          this.image.width = dimension;
          this.image.height = dimension;
          this.image.data = dataArray;
          this.needsUpdate = true;
          this.dispose();
          attr.itemSize = originalItemSize;
          attr.count = originalCount;
        }
      }
      class UIntVertexAttributeTexture extends VertexAttributeTexture {
        constructor() {
          super();
          this._forcedType = three.UnsignedIntType;
        }
      }
      class IntVertexAttributeTexture extends VertexAttributeTexture {
        constructor() {
          super();
          this._forcedType = three.IntType;
        }
      }
      class FloatVertexAttributeTexture extends VertexAttributeTexture {
        constructor() {
          super();
          this._forcedType = three.FloatType;
        }
      }
      class MeshBVHUniformStruct {
        constructor() {
          this.index = new UIntVertexAttributeTexture();
          this.position = new FloatVertexAttributeTexture();
          this.bvhBounds = new three.DataTexture();
          this.bvhContents = new three.DataTexture();
          this._cachedIndexAttr = null;
          this.index.overrideItemSize = 3;
        }
        updateFrom(bvh) {
          const { geometry } = bvh;
          bvhToTextures(bvh, this.bvhBounds, this.bvhContents);
          this.position.updateFrom(geometry.attributes.position);
          if (bvh.indirect) {
            const indirectBuffer = bvh._indirectBuffer;
            if (this._cachedIndexAttr === null || this._cachedIndexAttr.count !== indirectBuffer.length) {
              if (geometry.index) {
                this._cachedIndexAttr = geometry.index.clone();
              } else {
                const array = getIndexArray(getVertexCount(geometry));
                this._cachedIndexAttr = new three.BufferAttribute(array, 1, false);
              }
            }
            dereferenceIndex(geometry, indirectBuffer, this._cachedIndexAttr);
            this.index.updateFrom(this._cachedIndexAttr);
          } else {
            this.index.updateFrom(geometry.index);
          }
        }
        dispose() {
          const { index, position, bvhBounds, bvhContents } = this;
          if (index) index.dispose();
          if (position) position.dispose();
          if (bvhBounds) bvhBounds.dispose();
          if (bvhContents) bvhContents.dispose();
        }
      }
      function dereferenceIndex(geometry, indirectBuffer, target) {
        const unpacked = target.array;
        const indexArray = geometry.index ? geometry.index.array : null;
        for (let i = 0, l = indirectBuffer.length; i < l; i++) {
          const i3 = 3 * i;
          const v3 = 3 * indirectBuffer[i];
          for (let c = 0; c < 3; c++) {
            unpacked[i3 + c] = indexArray ? indexArray[v3 + c] : v3 + c;
          }
        }
      }
      function bvhToTextures(bvh, boundsTexture, contentsTexture) {
        const roots = bvh._roots;
        if (roots.length !== 1) {
          throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");
        }
        const root2 = roots[0];
        const uint16Array2 = new Uint16Array(root2);
        const uint32Array2 = new Uint32Array(root2);
        const float32Array2 = new Float32Array(root2);
        const nodeCount = root2.byteLength / BYTES_PER_NODE;
        const boundsDimension = 2 * Math.ceil(Math.sqrt(nodeCount / 2));
        const boundsArray = new Float32Array(4 * boundsDimension * boundsDimension);
        const contentsDimension = Math.ceil(Math.sqrt(nodeCount));
        const contentsArray = new Uint32Array(2 * contentsDimension * contentsDimension);
        for (let i = 0; i < nodeCount; i++) {
          const nodeIndex32 = i * BYTES_PER_NODE / 4;
          const nodeIndex16 = nodeIndex32 * 2;
          const boundsIndex = BOUNDING_DATA_INDEX(nodeIndex32);
          for (let b = 0; b < 3; b++) {
            boundsArray[8 * i + 0 + b] = float32Array2[boundsIndex + 0 + b];
            boundsArray[8 * i + 4 + b] = float32Array2[boundsIndex + 3 + b];
          }
          if (IS_LEAF(nodeIndex16, uint16Array2)) {
            const count = COUNT(nodeIndex16, uint16Array2);
            const offset = OFFSET(nodeIndex32, uint32Array2);
            const mergedLeafCount = 4294901760 | count;
            contentsArray[i * 2 + 0] = mergedLeafCount;
            contentsArray[i * 2 + 1] = offset;
          } else {
            const rightIndex = 4 * RIGHT_NODE(nodeIndex32, uint32Array2) / BYTES_PER_NODE;
            const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array2);
            contentsArray[i * 2 + 0] = splitAxis;
            contentsArray[i * 2 + 1] = rightIndex;
          }
        }
        boundsTexture.image.data = boundsArray;
        boundsTexture.image.width = boundsDimension;
        boundsTexture.image.height = boundsDimension;
        boundsTexture.format = three.RGBAFormat;
        boundsTexture.type = three.FloatType;
        boundsTexture.internalFormat = "RGBA32F";
        boundsTexture.minFilter = three.NearestFilter;
        boundsTexture.magFilter = three.NearestFilter;
        boundsTexture.generateMipmaps = false;
        boundsTexture.needsUpdate = true;
        boundsTexture.dispose();
        contentsTexture.image.data = contentsArray;
        contentsTexture.image.width = contentsDimension;
        contentsTexture.image.height = contentsDimension;
        contentsTexture.format = three.RGIntegerFormat;
        contentsTexture.type = three.UnsignedIntType;
        contentsTexture.internalFormat = "RG32UI";
        contentsTexture.minFilter = three.NearestFilter;
        contentsTexture.magFilter = three.NearestFilter;
        contentsTexture.generateMipmaps = false;
        contentsTexture.needsUpdate = true;
        contentsTexture.dispose();
      }
      const _positionVector = /* @__PURE__ */ new three.Vector3();
      const _normalVector = /* @__PURE__ */ new three.Vector3();
      const _tangentVector = /* @__PURE__ */ new three.Vector3();
      const _tangentVector4 = /* @__PURE__ */ new three.Vector4();
      const _morphVector = /* @__PURE__ */ new three.Vector3();
      const _temp = /* @__PURE__ */ new three.Vector3();
      const _skinIndex = /* @__PURE__ */ new three.Vector4();
      const _skinWeight = /* @__PURE__ */ new three.Vector4();
      const _matrix = /* @__PURE__ */ new three.Matrix4();
      const _boneMatrix = /* @__PURE__ */ new three.Matrix4();
      function validateAttributes(attr1, attr2) {
        if (!attr1 && !attr2) {
          return;
        }
        const sameCount = attr1.count === attr2.count;
        const sameNormalized = attr1.normalized === attr2.normalized;
        const sameType = attr1.array.constructor === attr2.array.constructor;
        const sameItemSize = attr1.itemSize === attr2.itemSize;
        if (!sameCount || !sameNormalized || !sameType || !sameItemSize) {
          throw new Error();
        }
      }
      function createAttributeClone(attr, countOverride = null) {
        const cons = attr.array.constructor;
        const normalized = attr.normalized;
        const itemSize = attr.itemSize;
        const count = countOverride === null ? attr.count : countOverride;
        return new three.BufferAttribute(new cons(itemSize * count), itemSize, normalized);
      }
      function copyAttributeContents(attr, target, targetOffset = 0) {
        if (attr.isInterleavedBufferAttribute) {
          const itemSize = attr.itemSize;
          for (let i = 0, l = attr.count; i < l; i++) {
            const io = i + targetOffset;
            target.setX(io, attr.getX(i));
            if (itemSize >= 2) target.setY(io, attr.getY(i));
            if (itemSize >= 3) target.setZ(io, attr.getZ(i));
            if (itemSize >= 4) target.setW(io, attr.getW(i));
          }
        } else {
          const array = target.array;
          const cons = array.constructor;
          const byteOffset = array.BYTES_PER_ELEMENT * attr.itemSize * targetOffset;
          const temp5 = new cons(array.buffer, byteOffset, attr.array.length);
          temp5.set(attr.array);
        }
      }
      function addScaledMatrix(target, matrix2, scale) {
        const targetArray = target.elements;
        const matrixArray = matrix2.elements;
        for (let i = 0, l = matrixArray.length; i < l; i++) {
          targetArray[i] += matrixArray[i] * scale;
        }
      }
      function boneNormalTransform(mesh, index, target) {
        const skeleton = mesh.skeleton;
        const geometry = mesh.geometry;
        const bones = skeleton.bones;
        const boneInverses = skeleton.boneInverses;
        _skinIndex.fromBufferAttribute(geometry.attributes.skinIndex, index);
        _skinWeight.fromBufferAttribute(geometry.attributes.skinWeight, index);
        _matrix.elements.fill(0);
        for (let i = 0; i < 4; i++) {
          const weight = _skinWeight.getComponent(i);
          if (weight !== 0) {
            const boneIndex = _skinIndex.getComponent(i);
            _boneMatrix.multiplyMatrices(bones[boneIndex].matrixWorld, boneInverses[boneIndex]);
            addScaledMatrix(_matrix, _boneMatrix, weight);
          }
        }
        _matrix.multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse);
        target.transformDirection(_matrix);
        return target;
      }
      function applyMorphTarget(morphData, morphInfluences, morphTargetsRelative, i, target) {
        _morphVector.set(0, 0, 0);
        for (let j = 0, jl = morphData.length; j < jl; j++) {
          const influence = morphInfluences[j];
          const morphAttribute = morphData[j];
          if (influence === 0) continue;
          _temp.fromBufferAttribute(morphAttribute, i);
          if (morphTargetsRelative) {
            _morphVector.addScaledVector(_temp, influence);
          } else {
            _morphVector.addScaledVector(_temp.sub(target), influence);
          }
        }
        target.add(_morphVector);
      }
      function mergeBufferGeometries(geometries, options = { useGroups: false, updateIndex: false, skipAttributes: [] }, targetGeometry = new three.BufferGeometry()) {
        const isIndexed = geometries[0].index !== null;
        const { useGroups = false, updateIndex = false, skipAttributes = [] } = options;
        const attributesUsed = new Set(Object.keys(geometries[0].attributes));
        const attributes = {};
        let offset = 0;
        targetGeometry.clearGroups();
        for (let i = 0; i < geometries.length; ++i) {
          const geometry = geometries[i];
          let attributesCount = 0;
          if (isIndexed !== (geometry.index !== null)) {
            throw new Error("StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");
          }
          for (const name in geometry.attributes) {
            if (!attributesUsed.has(name)) {
              throw new Error('StaticGeometryGenerator: All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.');
            }
            if (attributes[name] === void 0) {
              attributes[name] = [];
            }
            attributes[name].push(geometry.attributes[name]);
            attributesCount++;
          }
          if (attributesCount !== attributesUsed.size) {
            throw new Error("StaticGeometryGenerator: Make sure all geometries have the same number of attributes.");
          }
          if (useGroups) {
            let count;
            if (isIndexed) {
              count = geometry.index.count;
            } else if (geometry.attributes.position !== void 0) {
              count = geometry.attributes.position.count;
            } else {
              throw new Error("StaticGeometryGenerator: The geometry must have either an index or a position attribute");
            }
            targetGeometry.addGroup(offset, count, i);
            offset += count;
          }
        }
        if (isIndexed) {
          let forceUpdateIndex = false;
          if (!targetGeometry.index) {
            let indexCount = 0;
            for (let i = 0; i < geometries.length; ++i) {
              indexCount += geometries[i].index.count;
            }
            targetGeometry.setIndex(new three.BufferAttribute(new Uint32Array(indexCount), 1, false));
            forceUpdateIndex = true;
          }
          if (updateIndex || forceUpdateIndex) {
            const targetIndex = targetGeometry.index;
            let targetOffset = 0;
            let indexOffset = 0;
            for (let i = 0; i < geometries.length; ++i) {
              const geometry = geometries[i];
              const index = geometry.index;
              if (skipAttributes[i] !== true) {
                for (let j = 0; j < index.count; ++j) {
                  targetIndex.setX(targetOffset, index.getX(j) + indexOffset);
                  targetOffset++;
                }
              }
              indexOffset += geometry.attributes.position.count;
            }
          }
        }
        for (const name in attributes) {
          const attrList = attributes[name];
          if (!(name in targetGeometry.attributes)) {
            let count = 0;
            for (const key in attrList) {
              count += attrList[key].count;
            }
            targetGeometry.setAttribute(name, createAttributeClone(attributes[name][0], count));
          }
          const targetAttribute = targetGeometry.attributes[name];
          let offset2 = 0;
          for (let i = 0, l = attrList.length; i < l; i++) {
            const attr = attrList[i];
            if (skipAttributes[i] !== true) {
              copyAttributeContents(attr, targetAttribute, offset2);
            }
            offset2 += attr.count;
          }
        }
        return targetGeometry;
      }
      function checkTypedArrayEquality(a, b) {
        if (a === null || b === null) {
          return a === b;
        }
        if (a.length !== b.length) {
          return false;
        }
        for (let i = 0, l = a.length; i < l; i++) {
          if (a[i] !== b[i]) {
            return false;
          }
        }
        return true;
      }
      function invertGeometry(geometry) {
        const { index, attributes } = geometry;
        if (index) {
          for (let i = 0, l = index.count; i < l; i += 3) {
            const v0 = index.getX(i);
            const v2 = index.getX(i + 2);
            index.setX(i, v2);
            index.setX(i + 2, v0);
          }
        } else {
          for (const key in attributes) {
            const attr = attributes[key];
            const itemSize = attr.itemSize;
            for (let i = 0, l = attr.count; i < l; i += 3) {
              for (let j = 0; j < itemSize; j++) {
                const v0 = attr.getComponent(i, j);
                const v2 = attr.getComponent(i + 2, j);
                attr.setComponent(i, j, v2);
                attr.setComponent(i + 2, j, v0);
              }
            }
          }
        }
        return geometry;
      }
      class GeometryDiff {
        constructor(mesh) {
          this.matrixWorld = new three.Matrix4();
          this.geometryHash = null;
          this.boneMatrices = null;
          this.primitiveCount = -1;
          this.mesh = mesh;
          this.update();
        }
        update() {
          const mesh = this.mesh;
          const geometry = mesh.geometry;
          const skeleton = mesh.skeleton;
          const primitiveCount = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
          this.matrixWorld.copy(mesh.matrixWorld);
          this.geometryHash = geometry.attributes.position.version;
          this.primitiveCount = primitiveCount;
          if (skeleton) {
            if (!skeleton.boneTexture) {
              skeleton.computeBoneTexture();
            }
            skeleton.update();
            const boneMatrices = skeleton.boneMatrices;
            if (!this.boneMatrices || this.boneMatrices.length !== boneMatrices.length) {
              this.boneMatrices = boneMatrices.slice();
            } else {
              this.boneMatrices.set(boneMatrices);
            }
          } else {
            this.boneMatrices = null;
          }
        }
        didChange() {
          const mesh = this.mesh;
          const geometry = mesh.geometry;
          const primitiveCount = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
          const identical = this.matrixWorld.equals(mesh.matrixWorld) && this.geometryHash === geometry.attributes.position.version && checkTypedArrayEquality(mesh.skeleton && mesh.skeleton.boneMatrices || null, this.boneMatrices) && this.primitiveCount === primitiveCount;
          return !identical;
        }
      }
      class StaticGeometryGenerator {
        constructor(meshes) {
          if (!Array.isArray(meshes)) {
            meshes = [meshes];
          }
          const finalMeshes = [];
          meshes.forEach((object) => {
            object.traverseVisible((c) => {
              if (c.isMesh) {
                finalMeshes.push(c);
              }
            });
          });
          this.meshes = finalMeshes;
          this.useGroups = true;
          this.applyWorldTransforms = true;
          this.attributes = ["position", "normal", "color", "tangent", "uv", "uv2"];
          this._intermediateGeometry = new Array(finalMeshes.length).fill().map(() => new three.BufferGeometry());
          this._diffMap = /* @__PURE__ */ new WeakMap();
        }
        getMaterials() {
          const materials = [];
          this.meshes.forEach((mesh) => {
            if (Array.isArray(mesh.material)) {
              materials.push(...mesh.material);
            } else {
              materials.push(mesh.material);
            }
          });
          return materials;
        }
        generate(targetGeometry = new three.BufferGeometry()) {
          let skipAttributes = [];
          const { meshes, useGroups, _intermediateGeometry, _diffMap } = this;
          for (let i = 0, l = meshes.length; i < l; i++) {
            const mesh = meshes[i];
            const geom = _intermediateGeometry[i];
            const diff = _diffMap.get(mesh);
            if (!diff || diff.didChange(mesh)) {
              this._convertToStaticGeometry(mesh, geom);
              skipAttributes.push(false);
              if (!diff) {
                _diffMap.set(mesh, new GeometryDiff(mesh));
              } else {
                diff.update();
              }
            } else {
              skipAttributes.push(true);
            }
          }
          if (_intermediateGeometry.length === 0) {
            targetGeometry.setIndex(null);
            const attrs = targetGeometry.attributes;
            for (const key in attrs) {
              targetGeometry.deleteAttribute(key);
            }
            for (const key in this.attributes) {
              targetGeometry.setAttribute(this.attributes[key], new three.BufferAttribute(new Float32Array(0), 4, false));
            }
          } else {
            mergeBufferGeometries(_intermediateGeometry, { useGroups, skipAttributes }, targetGeometry);
          }
          for (const key in targetGeometry.attributes) {
            targetGeometry.attributes[key].needsUpdate = true;
          }
          return targetGeometry;
        }
        _convertToStaticGeometry(mesh, targetGeometry = new three.BufferGeometry()) {
          const geometry = mesh.geometry;
          const applyWorldTransforms = this.applyWorldTransforms;
          const includeNormal = this.attributes.includes("normal");
          const includeTangent = this.attributes.includes("tangent");
          const attributes = geometry.attributes;
          const targetAttributes = targetGeometry.attributes;
          if (!targetGeometry.index && geometry.index) {
            targetGeometry.index = geometry.index.clone();
          }
          if (!targetAttributes.position) {
            targetGeometry.setAttribute("position", createAttributeClone(attributes.position));
          }
          if (includeNormal && !targetAttributes.normal && attributes.normal) {
            targetGeometry.setAttribute("normal", createAttributeClone(attributes.normal));
          }
          if (includeTangent && !targetAttributes.tangent && attributes.tangent) {
            targetGeometry.setAttribute("tangent", createAttributeClone(attributes.tangent));
          }
          validateAttributes(geometry.index, targetGeometry.index);
          validateAttributes(attributes.position, targetAttributes.position);
          if (includeNormal) {
            validateAttributes(attributes.normal, targetAttributes.normal);
          }
          if (includeTangent) {
            validateAttributes(attributes.tangent, targetAttributes.tangent);
          }
          const position = attributes.position;
          const normal = includeNormal ? attributes.normal : null;
          const tangent = includeTangent ? attributes.tangent : null;
          const morphPosition = geometry.morphAttributes.position;
          const morphNormal = geometry.morphAttributes.normal;
          const morphTangent = geometry.morphAttributes.tangent;
          const morphTargetsRelative = geometry.morphTargetsRelative;
          const morphInfluences = mesh.morphTargetInfluences;
          const normalMatrix = new three.Matrix3();
          normalMatrix.getNormalMatrix(mesh.matrixWorld);
          if (geometry.index) {
            targetGeometry.index.array.set(geometry.index.array);
          }
          for (let i = 0, l = attributes.position.count; i < l; i++) {
            _positionVector.fromBufferAttribute(position, i);
            if (normal) {
              _normalVector.fromBufferAttribute(normal, i);
            }
            if (tangent) {
              _tangentVector4.fromBufferAttribute(tangent, i);
              _tangentVector.fromBufferAttribute(tangent, i);
            }
            if (morphInfluences) {
              if (morphPosition) {
                applyMorphTarget(morphPosition, morphInfluences, morphTargetsRelative, i, _positionVector);
              }
              if (morphNormal) {
                applyMorphTarget(morphNormal, morphInfluences, morphTargetsRelative, i, _normalVector);
              }
              if (morphTangent) {
                applyMorphTarget(morphTangent, morphInfluences, morphTargetsRelative, i, _tangentVector);
              }
            }
            if (mesh.isSkinnedMesh) {
              mesh.applyBoneTransform(i, _positionVector);
              if (normal) {
                boneNormalTransform(mesh, i, _normalVector);
              }
              if (tangent) {
                boneNormalTransform(mesh, i, _tangentVector);
              }
            }
            if (applyWorldTransforms) {
              _positionVector.applyMatrix4(mesh.matrixWorld);
            }
            targetAttributes.position.setXYZ(i, _positionVector.x, _positionVector.y, _positionVector.z);
            if (normal) {
              if (applyWorldTransforms) {
                _normalVector.applyNormalMatrix(normalMatrix);
              }
              targetAttributes.normal.setXYZ(i, _normalVector.x, _normalVector.y, _normalVector.z);
            }
            if (tangent) {
              if (applyWorldTransforms) {
                _tangentVector.transformDirection(mesh.matrixWorld);
              }
              targetAttributes.tangent.setXYZW(i, _tangentVector.x, _tangentVector.y, _tangentVector.z, _tangentVector4.w);
            }
          }
          for (const i in this.attributes) {
            const key = this.attributes[i];
            if (key === "position" || key === "tangent" || key === "normal" || !(key in attributes)) {
              continue;
            }
            if (!targetAttributes[key]) {
              targetGeometry.setAttribute(key, createAttributeClone(attributes[key]));
            }
            validateAttributes(attributes[key], targetAttributes[key]);
            copyAttributeContents(attributes[key], targetAttributes[key]);
          }
          if (mesh.matrixWorld.determinant() < 0) {
            invertGeometry(targetGeometry);
          }
          return targetGeometry;
        }
      }
      const common_functions = (
        /* glsl */
        `

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`
      );
      const bvh_distance_functions = (
        /* glsl */
        `

float dot2( vec3 v ) {

	return dot( v, v );

}

// https://www.shadertoy.com/view/ttfGWl
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0-v;

	}

	barycoord = vec3( u, v, w );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = pow( 100000.0, 2.0 );
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;
			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`
      );
      const bvh_ray_functions = (
        /* glsl */
        `

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`
      );
      const bvh_struct_definitions = (
        /* glsl */
        `
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`
      );
      var BVHShaderGLSL = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        bvh_distance_functions,
        bvh_ray_functions,
        bvh_struct_definitions,
        common_functions
      });
      const shaderStructs = bvh_struct_definitions;
      const shaderDistanceFunction = bvh_distance_functions;
      const shaderIntersectFunction = `
	${common_functions}
	${bvh_ray_functions}
`;
      exports2.AVERAGE = AVERAGE;
      exports2.BVHShaderGLSL = BVHShaderGLSL;
      exports2.CENTER = CENTER;
      exports2.CONTAINED = CONTAINED;
      exports2.ExtendedTriangle = ExtendedTriangle;
      exports2.FloatVertexAttributeTexture = FloatVertexAttributeTexture;
      exports2.INTERSECTED = INTERSECTED;
      exports2.IntVertexAttributeTexture = IntVertexAttributeTexture;
      exports2.MeshBVH = MeshBVH;
      exports2.MeshBVHHelper = MeshBVHHelper;
      exports2.MeshBVHUniformStruct = MeshBVHUniformStruct;
      exports2.NOT_INTERSECTED = NOT_INTERSECTED;
      exports2.OrientedBox = OrientedBox;
      exports2.SAH = SAH;
      exports2.StaticGeometryGenerator = StaticGeometryGenerator;
      exports2.UIntVertexAttributeTexture = UIntVertexAttributeTexture;
      exports2.VertexAttributeTexture = VertexAttributeTexture;
      exports2.acceleratedRaycast = acceleratedRaycast2;
      exports2.computeBatchedBoundsTree = computeBatchedBoundsTree;
      exports2.computeBoundsTree = computeBoundsTree2;
      exports2.disposeBatchedBoundsTree = disposeBatchedBoundsTree;
      exports2.disposeBoundsTree = disposeBoundsTree2;
      exports2.estimateMemoryInBytes = estimateMemoryInBytes;
      exports2.getBVHExtremes = getBVHExtremes;
      exports2.getJSONStructure = getJSONStructure;
      exports2.getTriangleHitPointInfo = getTriangleHitPointInfo;
      exports2.shaderDistanceFunction = shaderDistanceFunction;
      exports2.shaderIntersectFunction = shaderIntersectFunction;
      exports2.shaderStructs = shaderStructs;
      exports2.validateBounds = validateBounds;
    });
  }
});

// src/rpg/world/WorldGenerator.ts
var init_WorldGenerator = __esm({
  "src/rpg/world/WorldGenerator.ts"() {
    "use strict";
  }
});

// src/rpg/world/WorldInitializer.ts
var init_WorldInitializer = __esm({
  "src/rpg/world/WorldInitializer.ts"() {
    "use strict";
    init_WorldGenerator();
  }
});

// src/rpg/RPGWorldManager.ts
var init_RPGWorldManager = __esm({
  "src/rpg/RPGWorldManager.ts"() {
    "use strict";
    init_WorldInitializer();
  }
});

// ugc-apps/rpg/index.ts
import * as manifest from "./manifest-W4E4KLFI.json";

// ../../node_modules/eventemitter3/index.mjs
var import_index = __toESM(require_eventemitter3(), 1);
var eventemitter3_default = import_index.default;

// src/core/systems/System.ts
var System = class extends eventemitter3_default {
  constructor(world) {
    super();
    this.world = world;
  }
  /**
   * Initialize the system with world options
   * Called once when the world is initialized
   */
  async init(_options) {
  }
  /**
   * Start the system
   * Called after all systems have been initialized
   */
  start() {
  }
  /**
   * Destroy the system and clean up resources
   */
  destroy() {
  }
  // Update cycle methods - override as needed in subclasses
  /**
   * Called at the beginning of each frame
   */
  preTick() {
  }
  /**
   * Called before fixed update steps
   */
  preFixedUpdate(_willFixedStep) {
  }
  /**
   * Fixed timestep update for physics and deterministic logic
   */
  fixedUpdate(_delta) {
  }
  /**
   * Called after fixed update steps
   */
  postFixedUpdate(_delta) {
  }
  /**
   * Called before main update with interpolation alpha
   */
  preUpdate(_alpha) {
  }
  /**
   * Main update loop
   */
  update(_delta) {
  }
  /**
   * Called after main update
   */
  postUpdate(_delta) {
  }
  /**
   * Late update for camera and final adjustments
   */
  lateUpdate(_delta) {
  }
  /**
   * Called after late update
   */
  postLateUpdate(_delta) {
  }
  /**
   * Commit changes (e.g., render on client)
   */
  commit() {
  }
  /**
   * Called at the end of each frame
   */
  postTick() {
  }
};

// src/rpg/systems/ConstructionSystem.ts
var ConstructionSystem = class extends System {
  constructor(world) {
    super(world);
    this.name = "ConstructionSystem";
    this.enabled = true;
    this.houses = /* @__PURE__ */ new Map();
    this.playerHouses = /* @__PURE__ */ new Map();
    // playerId -> houseId
    this.furnitureDefinitions = /* @__PURE__ */ new Map();
    this.roomCosts = /* @__PURE__ */ new Map();
    // House locations with their portal coordinates
    this.housePortals = /* @__PURE__ */ new Map([
      ["rimmington", { x: 2954, y: 0, z: 3224 }],
      ["taverley", { x: 2894, y: 0, z: 3465 }],
      ["pollnivneach", { x: 3340, y: 0, z: 3003 }],
      ["hosidius", { x: 1743, y: 0, z: 3517 }],
      ["rellekka", { x: 2670, y: 0, z: 3631 }],
      ["brimhaven", { x: 2758, y: 0, z: 3178 }],
      ["yanille", { x: 2544, y: 0, z: 3095 }]
    ]);
    // Configuration
    this.HOUSE_INSTANCE_OFFSET = 1e4;
    // Offset for house instances
    this.MAX_ROOMS = 30;
    this.MAX_FLOORS = 3;
    this.ROOM_SIZE = 8;
    // 8x8 tiles per room
    this.BUILD_MODE_SPEED = 0.5;
    // Movement speed in build mode
    this.SERVANT_WAGES = /* @__PURE__ */ new Map([
      ["rick", 500],
      ["maid", 1e3],
      ["cook", 3e3],
      ["butler", 5e3],
      ["demon_butler", 1e4]
    ]);
    this.initializeRoomCosts();
    this.initializeFurniture();
  }
  /**
   * Initialize room costs and level requirements
   */
  initializeRoomCosts() {
    this.roomCosts.set("garden" /* GARDEN */, { level: 1, cost: 1e3 });
    this.roomCosts.set("parlour" /* PARLOUR */, { level: 1, cost: 1e3 });
    this.roomCosts.set("kitchen" /* KITCHEN */, { level: 5, cost: 5e3 });
    this.roomCosts.set("dining_room" /* DINING_ROOM */, { level: 10, cost: 5e3 });
    this.roomCosts.set("workshop" /* WORKSHOP */, { level: 15, cost: 1e4 });
    this.roomCosts.set("bedroom" /* BEDROOM */, { level: 20, cost: 1e4 });
    this.roomCosts.set("hall" /* HALL */, { level: 25, cost: 1e4 });
    this.roomCosts.set("games_room" /* GAMES_ROOM */, { level: 30, cost: 15e3 });
    this.roomCosts.set("combat_room" /* COMBAT_ROOM */, { level: 32, cost: 15e3 });
    this.roomCosts.set("quest_hall" /* QUEST_HALL */, { level: 35, cost: 25e3 });
    this.roomCosts.set("study" /* STUDY */, { level: 40, cost: 15e3 });
    this.roomCosts.set("costume_room" /* COSTUME_ROOM */, { level: 42, cost: 15e3 });
    this.roomCosts.set("chapel" /* CHAPEL */, { level: 45, cost: 25e3 });
    this.roomCosts.set("portal_chamber" /* PORTAL_CHAMBER */, { level: 50, cost: 1e5 });
    this.roomCosts.set("formal_garden" /* FORMAL_GARDEN */, { level: 55, cost: 75e3 });
    this.roomCosts.set("throne_room" /* THRONE_ROOM */, { level: 60, cost: 15e4 });
    this.roomCosts.set("oubliette" /* OUBLIETTE */, { level: 65, cost: 125e3 });
    this.roomCosts.set("dungeon" /* DUNGEON */, { level: 70, cost: 1e5 });
    this.roomCosts.set("treasure_room" /* TREASURE_ROOM */, { level: 75, cost: 25e4 });
  }
  /**
   * Initialize furniture definitions
   */
  initializeFurniture() {
    this.registerFurniture({
      id: "wooden_chair",
      itemId: 6752,
      name: "Wooden chair",
      hotspotType: "seating" /* SEATING */,
      level: 1,
      experience: 14,
      materials: [
        { itemId: 960, quantity: 2 }
        // Planks
      ],
      interactable: true
    });
    this.registerFurniture({
      id: "oak_chair",
      itemId: 6753,
      name: "Oak chair",
      hotspotType: "seating" /* SEATING */,
      level: 19,
      experience: 60,
      materials: [
        { itemId: 8778, quantity: 2 }
        // Oak planks
      ],
      interactable: true
    });
    this.registerFurniture({
      id: "wooden_table",
      itemId: 6760,
      name: "Wooden table",
      hotspotType: "table" /* TABLE */,
      level: 12,
      experience: 20,
      materials: [
        { itemId: 960, quantity: 4 }
        // Planks
      ],
      interactable: false
    });
    this.registerFurniture({
      id: "wooden_bookcase",
      itemId: 6770,
      name: "Wooden bookcase",
      hotspotType: "storage" /* STORAGE */,
      level: 4,
      experience: 20,
      materials: [
        { itemId: 960, quantity: 3 }
        // Planks
      ],
      interactable: true
    });
    this.registerFurniture({
      id: "candle",
      itemId: 36,
      name: "Candle",
      hotspotType: "lighting" /* LIGHTING */,
      level: 8,
      experience: 4,
      materials: [
        { itemId: 36, quantity: 1 }
        // Candle
      ],
      interactable: false
    });
    this.registerFurniture({
      id: "oak_altar",
      itemId: 13179,
      name: "Oak altar",
      hotspotType: "altar" /* ALTAR */,
      level: 45,
      experience: 240,
      materials: [
        { itemId: 8778, quantity: 4 }
        // Oak planks
      ],
      effects: [
        {
          type: "altar",
          data: { prayerBonus: 120 }
          // 120% prayer restoration
        }
      ],
      interactable: true
    });
    this.registerFurniture({
      id: "varrock_portal",
      itemId: 13615,
      name: "Varrock portal",
      hotspotType: "portal" /* PORTAL */,
      level: 50,
      experience: 250,
      materials: [
        { itemId: 8782, quantity: 3 },
        // Mahogany planks
        { itemId: 563, quantity: 100 }
        // Law runes
      ],
      effects: [
        {
          type: "teleport",
          data: { destination: "varrock", position: { x: 3213, y: 0, z: 3428 } }
        }
      ],
      interactable: true
    });
    this.registerFurniture({
      id: "mounted_glory",
      itemId: 13523,
      name: "Mounted glory",
      hotspotType: "glory" /* GLORY */,
      level: 47,
      experience: 290,
      materials: [
        { itemId: 1704, quantity: 1 },
        // Amulet of glory
        { itemId: 8780, quantity: 3 }
        // Teak planks
      ],
      effects: [
        {
          type: "teleport",
          data: {
            destinations: ["edgeville", "karamja", "draynor", "al_kharid"],
            charges: -1
            // Unlimited
          }
        }
      ],
      interactable: true
    });
  }
  /**
   * Register a furniture definition
   */
  registerFurniture(furniture) {
    this.furnitureDefinitions.set(furniture.id, furniture);
  }
  /**
   * Buy a house
   */
  buyHouse(playerId, location) {
    if (this.playerHouses.has(playerId)) {
      this.emit("construction:error", {
        playerId,
        error: "You already own a house"
      });
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const constructionComponent = this.getOrCreateConstructionComponent(player);
    if (constructionComponent.level < 1) {
      this.emit("construction:error", {
        playerId,
        error: "You need at least level 1 Construction"
      });
      return false;
    }
    const houseCost = 1e3;
    const inventory = player.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, houseCost)) {
      this.emit("construction:error", {
        playerId,
        error: "You need 1,000 gold to buy a house"
      });
      return false;
    }
    if (!this.housePortals.has(location)) {
      this.emit("construction:error", {
        playerId,
        error: "Invalid house location"
      });
      return false;
    }
    this.removeGold(inventory, houseCost);
    const houseId = this.generateHouseId();
    const house = {
      id: houseId,
      ownerId: playerId,
      location,
      layout: /* @__PURE__ */ new Map(),
      maxRooms: 20,
      // Start with 20, can upgrade
      maxFloors: 1,
      // Start with ground floor only
      settings: {
        locked: false,
        buildMode: false,
        pvpEnabled: false,
        teleportInside: true,
        renderDistance: 64,
        theme: "basic",
        visitors: [],
        maxVisitors: 20
      },
      servant: {
        type: "none",
        taskQueue: [],
        lastPayment: Date.now()
      },
      visitors: [],
      maxVisitors: 10,
      dungeonMonsters: []
    };
    this.addRoom(house, "garden" /* GARDEN */, { floor: 0, x: 0, z: 0 }, 0);
    this.houses.set(houseId, house);
    this.playerHouses.set(playerId, houseId);
    constructionComponent.houseId = houseId;
    this.grantConstructionXP(playerId, 100);
    this.emit("construction:house-bought", {
      playerId,
      houseId,
      location
    });
    return true;
  }
  /**
   * Enter house
   */
  enterHouse(playerId, ownerId) {
    const targetOwnerId = ownerId || playerId;
    const houseId = this.playerHouses.get(targetOwnerId);
    if (!houseId) {
      this.emit("construction:error", {
        playerId,
        error: "House not found"
      });
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    if (house.settings.locked && playerId !== targetOwnerId && !house.visitors.includes(playerId)) {
      this.emit("construction:error", {
        playerId,
        error: "This house is locked"
      });
      return false;
    }
    if (playerId !== targetOwnerId && house.visitors.length >= house.maxVisitors) {
      this.emit("construction:error", {
        playerId,
        error: "This house is full"
      });
      return false;
    }
    const constructionComponent = this.getOrCreateConstructionComponent(player);
    constructionComponent.inHouse = true;
    constructionComponent.buildMode = playerId === targetOwnerId ? house.settings.buildMode : false;
    if (playerId !== targetOwnerId) {
      house.visitors.push(playerId);
    }
    const entrancePosition = this.getHouseEntrance(house);
    const movement = player.getComponent("movement");
    if (movement) {
      movement.teleportDestination = entrancePosition;
      movement.teleportTime = Date.now();
      movement.teleportAnimation = "house_teleport";
    }
    this.emit("construction:entered-house", {
      playerId,
      houseId,
      ownerId: targetOwnerId,
      buildMode: constructionComponent.buildMode
    });
    return true;
  }
  /**
   * Leave house
   */
  leaveHouse(playerId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const constructionComponent = player.getComponent("construction");
    if (!constructionComponent || !constructionComponent.inHouse) {
      return false;
    }
    let houseId = null;
    let house = null;
    for (const [id, h] of this.houses) {
      if (h.ownerId === playerId || h.visitors.includes(playerId)) {
        houseId = id;
        house = h;
        break;
      }
    }
    if (!house) {
      return false;
    }
    const visitorIndex = house.visitors.indexOf(playerId);
    if (visitorIndex !== -1) {
      house.visitors.splice(visitorIndex, 1);
    }
    constructionComponent.inHouse = false;
    constructionComponent.buildMode = false;
    const portal = this.housePortals.get(house.location);
    if (portal) {
      const movement = player.getComponent("movement");
      if (movement) {
        movement.teleportDestination = portal;
        movement.teleportTime = Date.now();
        movement.teleportAnimation = "house_teleport";
      }
    }
    this.emit("construction:left-house", {
      playerId,
      houseId
    });
    return true;
  }
  /**
   * Toggle build mode
   */
  toggleBuildMode(playerId) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const constructionComponent = player.getComponent("construction");
    if (!constructionComponent || !constructionComponent.inHouse) {
      return false;
    }
    house.settings.buildMode = !house.settings.buildMode;
    constructionComponent.buildMode = house.settings.buildMode;
    if (house.settings.buildMode) {
      for (const visitorId of [...house.visitors]) {
        if (visitorId !== playerId) {
          this.leaveHouse(visitorId);
          this.sendMessage(visitorId, "The owner has entered build mode");
        }
      }
    }
    this.emit("construction:build-mode-toggled", {
      playerId,
      houseId,
      buildMode: house.settings.buildMode
    });
    return true;
  }
  /**
   * Build a room
   */
  buildRoom(playerId, roomType, position, rotation) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || !house.settings.buildMode) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const constructionComponent = player.getComponent("construction");
    if (!constructionComponent) {
      return false;
    }
    const roomRequirements = this.roomCosts.get(roomType);
    if (!roomRequirements) {
      return false;
    }
    if (constructionComponent.level < roomRequirements.level) {
      this.emit("construction:error", {
        playerId,
        error: `You need level ${roomRequirements.level} Construction`
      });
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, roomRequirements.cost)) {
      this.emit("construction:error", {
        playerId,
        error: `You need ${roomRequirements.cost} gold`
      });
      return false;
    }
    if (house.layout.size >= house.maxRooms) {
      this.emit("construction:error", {
        playerId,
        error: "You have reached the maximum number of rooms"
      });
      return false;
    }
    if (position.floor >= house.maxFloors || position.floor < -house.maxFloors) {
      this.emit("construction:error", {
        playerId,
        error: "You cannot build on this floor"
      });
      return false;
    }
    const key = `${position.floor},${position.x},${position.z}`;
    if (house.layout.has(key)) {
      this.emit("construction:error", {
        playerId,
        error: "There is already a room here"
      });
      return false;
    }
    if (house.layout.size > 0 && !this.isConnectedPosition(house, position)) {
      this.emit("construction:error", {
        playerId,
        error: "Room must be connected to existing rooms"
      });
      return false;
    }
    this.removeGold(inventory, roomRequirements.cost);
    const room = this.addRoom(house, roomType, position, rotation);
    const xp = Math.floor(roomRequirements.cost / 10);
    this.grantConstructionXP(playerId, xp);
    constructionComponent.currentBuild = {
      roomType,
      position: {
        x: position.x * this.ROOM_SIZE,
        y: position.floor * 3,
        z: position.z * this.ROOM_SIZE
      },
      rotation
    };
    this.emit("construction:room-built", {
      playerId,
      houseId,
      roomId: room.id,
      roomType,
      position,
      rotation
    });
    return true;
  }
  /**
   * Remove a room
   */
  removeRoom(playerId, position) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || !house.settings.buildMode) {
      return false;
    }
    const key = `${position.floor},${position.x},${position.z}`;
    const room = house.layout.get(key);
    if (!room) {
      this.emit("construction:error", {
        playerId,
        error: "No room at this position"
      });
      return false;
    }
    if (house.layout.size <= 1) {
      this.emit("construction:error", {
        playerId,
        error: "You cannot remove the last room"
      });
      return false;
    }
    if (this.wouldDisconnectRooms(house, position)) {
      this.emit("construction:error", {
        playerId,
        error: "Removing this room would disconnect others"
      });
      return false;
    }
    house.layout.delete(key);
    const roomRequirements = this.roomCosts.get(room.type);
    if (roomRequirements) {
      const refund = Math.floor(roomRequirements.cost / 2);
      const player = this.world.entities.get(playerId);
      if (player) {
        const inventory = player.getComponent("inventory");
        if (inventory) {
          this.addGold(inventory, refund);
        }
      }
    }
    this.emit("construction:room-removed", {
      playerId,
      houseId,
      roomId: room.id,
      position
    });
    return true;
  }
  /**
   * Build furniture
   */
  buildFurniture(playerId, roomPosition, hotspotId, furnitureId) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || !house.settings.buildMode) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const constructionComponent = player.getComponent("construction");
    if (!constructionComponent) {
      return false;
    }
    const key = `${roomPosition.floor},${roomPosition.x},${roomPosition.z}`;
    const room = house.layout.get(key);
    if (!room) {
      return false;
    }
    const hotspot = room.hotspots.get(hotspotId);
    if (!hotspot) {
      return false;
    }
    const furniture = this.furnitureDefinitions.get(furnitureId);
    if (!furniture) {
      return false;
    }
    if (furniture.hotspotType !== hotspot) {
      this.emit("construction:error", {
        playerId,
        error: "This furniture cannot be built here"
      });
      return false;
    }
    if (constructionComponent.level < furniture.level) {
      this.emit("construction:error", {
        playerId,
        error: `You need level ${furniture.level} Construction`
      });
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    for (const material of furniture.materials) {
      if (inventory.getItemCount(material.itemId) < material.quantity) {
        this.emit("construction:error", {
          playerId,
          error: "You do not have the required materials"
        });
        return false;
      }
    }
    for (const material of furniture.materials) {
      inventory.removeItem(material.itemId, material.quantity);
    }
    room.furniture.set(hotspotId, furniture);
    this.grantConstructionXP(playerId, furniture.experience);
    this.emit("construction:furniture-built", {
      playerId,
      houseId,
      roomId: room.id,
      hotspotId,
      furnitureId: furniture.id
    });
    return true;
  }
  /**
   * Remove furniture
   */
  removeFurniture(playerId, roomPosition, hotspotId) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || !house.settings.buildMode) {
      return false;
    }
    const key = `${roomPosition.floor},${roomPosition.x},${roomPosition.z}`;
    const room = house.layout.get(key);
    if (!room) {
      return false;
    }
    const furniture = room.furniture.get(hotspotId);
    if (!furniture) {
      return false;
    }
    const furnitureId = furniture.id;
    room.furniture.delete(hotspotId);
    this.emit("construction:furniture-removed", {
      playerId,
      houseId,
      roomId: room.id,
      hotspotId,
      furnitureId
    });
    return true;
  }
  /**
   * Interact with furniture
   */
  interactWithFurniture(playerId, roomPosition, hotspotId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const constructionComponent = player.getComponent("construction");
    if (!constructionComponent || !constructionComponent.inHouse) {
      return;
    }
    let house = null;
    for (const h of this.houses.values()) {
      if (h.ownerId === playerId || h.visitors.includes(playerId)) {
        house = h;
        break;
      }
    }
    if (!house) {
      return;
    }
    const key = `${roomPosition.floor},${roomPosition.x},${roomPosition.z}`;
    const room = house.layout.get(key);
    if (!room) {
      return;
    }
    const furniture = room.furniture.get(hotspotId);
    if (!furniture || !furniture.interactable) {
      return;
    }
    if (furniture.effects) {
      for (const effect of furniture.effects) {
        this.applyFurnitureEffect(player, effect, house);
      }
    }
    this.emit("construction:furniture-interacted", {
      playerId,
      houseId: house.id,
      furnitureId: furniture.id,
      effects: furniture.effects
    });
  }
  /**
   * Hire servant
   */
  hireServant(playerId, servantType) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const wage = this.SERVANT_WAGES.get(servantType);
    if (wage === void 0) {
      this.emit("construction:error", {
        playerId,
        error: "Invalid servant type"
      });
      return false;
    }
    if (house.servant.type !== "none") {
      this.emit("construction:error", {
        playerId,
        error: "You already have a servant"
      });
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, wage)) {
      this.emit("construction:error", {
        playerId,
        error: `You need ${wage} gold for the first payment`
      });
      return false;
    }
    this.removeGold(inventory, wage);
    house.servant = {
      type: servantType,
      taskQueue: [],
      lastPayment: Date.now()
    };
    this.emit("construction:servant-hired", {
      playerId,
      houseId,
      servantType,
      wage
    });
    return true;
  }
  /**
   * Dismiss servant
   */
  dismissServant(playerId) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || house.servant.type === "none") {
      return false;
    }
    const servantType = house.servant.type;
    house.servant = {
      type: "none",
      taskQueue: [],
      lastPayment: Date.now()
    };
    this.emit("construction:servant-dismissed", {
      playerId,
      houseId,
      servantType
    });
    return true;
  }
  /**
   * Give servant task
   */
  giveServantTask(playerId, task) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house || house.servant.type === "none") {
      return false;
    }
    const taskLimits = /* @__PURE__ */ new Map([
      ["rick", 1],
      ["maid", 2],
      ["cook", 3],
      ["butler", 4],
      ["demon_butler", 5]
    ]);
    const limit = taskLimits.get(house.servant.type) || 1;
    if (house.servant.taskQueue.length >= limit) {
      this.emit("construction:error", {
        playerId,
        error: "Your servant is too busy"
      });
      return false;
    }
    const baseTimes = /* @__PURE__ */ new Map([
      ["rick", 6e4],
      // 1 minute
      ["maid", 45e3],
      // 45 seconds
      ["cook", 3e4],
      // 30 seconds
      ["butler", 2e4],
      // 20 seconds
      ["demon_butler", 1e4]
      // 10 seconds
    ]);
    const baseTime = baseTimes.get(house.servant.type) || 6e4;
    task.completionTime = Date.now() + baseTime;
    house.servant.taskQueue.push(task);
    this.emit("construction:servant-task-given", {
      playerId,
      houseId,
      taskType: task.type,
      completionTime: task.completionTime
    });
    return true;
  }
  /**
   * Update house settings
   */
  updateHouseSettings(playerId, settings) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house) {
      return false;
    }
    Object.assign(house.settings, settings);
    this.emit("construction:settings-updated", {
      playerId,
      houseId,
      settings
    });
    return true;
  }
  /**
   * Move house
   */
  moveHouse(playerId, newLocation) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return false;
    }
    const house = this.houses.get(houseId);
    if (!house) {
      return false;
    }
    if (!this.housePortals.has(newLocation)) {
      this.emit("construction:error", {
        playerId,
        error: "Invalid house location"
      });
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const moveCost = 25e3;
    const inventory = player.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, moveCost)) {
      this.emit("construction:error", {
        playerId,
        error: `You need ${moveCost} gold to move your house`
      });
      return false;
    }
    for (const visitorId of [...house.visitors]) {
      this.leaveHouse(visitorId);
    }
    this.removeGold(inventory, moveCost);
    const oldLocation = house.location;
    house.location = newLocation;
    this.emit("construction:house-moved", {
      playerId,
      houseId,
      oldLocation,
      newLocation
    });
    return true;
  }
  /**
   * Get player's house
   */
  getPlayerHouse(playerId) {
    const houseId = this.playerHouses.get(playerId);
    if (!houseId) {
      return null;
    }
    return this.houses.get(houseId) || null;
  }
  /**
   * Get construction level
   */
  getConstructionLevel(playerId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return 0;
    }
    const component = player.getComponent("construction");
    return component?.level || 0;
  }
  /**
   * Helper methods
   */
  addRoom(house, type, position, rotation) {
    const roomId = this.generateRoomId();
    const room = {
      id: roomId,
      type,
      rotation,
      level: position.floor,
      furniture: /* @__PURE__ */ new Map(),
      doors: /* @__PURE__ */ new Map([
        ["north", true],
        ["east", true],
        ["south", true],
        ["west", true]
      ]),
      hotspots: this.generateHotspots(type)
    };
    const key = `${position.floor},${position.x},${position.z}`;
    house.layout.set(key, room);
    return room;
  }
  generateHotspots(roomType) {
    const hotspots = /* @__PURE__ */ new Map();
    switch (roomType) {
      case "parlour" /* PARLOUR */:
        hotspots.set("chair1", "seating" /* SEATING */);
        hotspots.set("chair2", "seating" /* SEATING */);
        hotspots.set("chair3", "seating" /* SEATING */);
        hotspots.set("bookcase", "storage" /* STORAGE */);
        hotspots.set("fireplace", "lighting" /* LIGHTING */);
        break;
      case "kitchen" /* KITCHEN */:
        hotspots.set("stove", "skill" /* SKILL */);
        hotspots.set("table", "table" /* TABLE */);
        hotspots.set("shelf", "storage" /* STORAGE */);
        hotspots.set("larder", "storage" /* STORAGE */);
        break;
      case "chapel" /* CHAPEL */:
        hotspots.set("altar", "altar" /* ALTAR */);
        hotspots.set("icon", "decoration" /* DECORATION */);
        hotspots.set("lamp1", "lighting" /* LIGHTING */);
        hotspots.set("lamp2", "lighting" /* LIGHTING */);
        break;
      case "portal_chamber" /* PORTAL_CHAMBER */:
        hotspots.set("portal1", "portal" /* PORTAL */);
        hotspots.set("portal2", "portal" /* PORTAL */);
        hotspots.set("portal3", "portal" /* PORTAL */);
        hotspots.set("centerpiece", "glory" /* GLORY */);
        break;
    }
    return hotspots;
  }
  isConnectedPosition(house, position) {
    const adjacent = [
      { floor: position.floor, x: position.x + 1, z: position.z },
      { floor: position.floor, x: position.x - 1, z: position.z },
      { floor: position.floor, x: position.x, z: position.z + 1 },
      { floor: position.floor, x: position.x, z: position.z - 1 }
    ];
    if (position.floor !== 0) {
      adjacent.push(
        { floor: position.floor - 1, x: position.x, z: position.z },
        { floor: position.floor + 1, x: position.x, z: position.z }
      );
    }
    for (const adj of adjacent) {
      const key = `${adj.floor},${adj.x},${adj.z}`;
      if (house.layout.has(key)) {
        return true;
      }
    }
    return false;
  }
  wouldDisconnectRooms(_house, _position) {
    return false;
  }
  getHouseEntrance(house) {
    const gardenKey = "0,0,0";
    const hasGarden = house.layout.has(gardenKey);
    return {
      x: this.HOUSE_INSTANCE_OFFSET + (hasGarden ? 4 : 0),
      y: 0,
      z: this.HOUSE_INSTANCE_OFFSET + (hasGarden ? 4 : 0)
    };
  }
  applyFurnitureEffect(player, effect, _house) {
    switch (effect.type) {
      case "teleport":
        const movement = player.getComponent("movement");
        if (movement && effect.data.position) {
          movement.teleportDestination = effect.data.position;
          movement.teleportTime = Date.now();
          movement.teleportAnimation = "teleport";
        }
        break;
      case "altar":
        const stats = player.getComponent("stats");
        if (stats && stats.prayer) {
          const bonus = effect.data.prayerBonus || 100;
          const restored = Math.floor(stats.prayer.maxPoints * (bonus / 100));
          stats.prayer.points = Math.min(stats.prayer.maxPoints + 20, stats.prayer.points + restored);
        }
        break;
      case "restore":
        const restoreStats = player.getComponent("stats");
        if (restoreStats && restoreStats.prayer) {
          const bonus = effect.data.bonus || 100;
          const restored = Math.floor(restoreStats.prayer.maxPoints * (bonus / 100));
          restoreStats.prayer.points = Math.min(
            restoreStats.prayer.maxPoints + 20,
            restoreStats.prayer.points + restored
          );
        }
        break;
      case "bank":
        this.emit("bank:open", { playerId: player.id });
        break;
    }
  }
  grantConstructionXP(playerId, xp) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const component = this.getOrCreateConstructionComponent(player);
    component.experience += xp;
    const newLevel = this.getLevelForXP(component.experience);
    if (newLevel > component.level) {
      component.level = newLevel;
      this.emit("skill:levelup", {
        playerId,
        skill: "construction",
        newLevel
      });
      if (newLevel === 30) {
        const houseId = this.playerHouses.get(playerId);
        if (houseId) {
          const house = this.houses.get(houseId);
          if (house) {
            house.maxFloors = 2;
          }
        }
      } else if (newLevel === 50) {
        const houseId = this.playerHouses.get(playerId);
        if (houseId) {
          const house = this.houses.get(houseId);
          if (house) {
            house.maxFloors = 3;
          }
        }
      }
    }
    this.emit("skill:xp-gained", {
      playerId,
      skill: "construction",
      xp,
      totalXp: component.experience
    });
  }
  getLevelForXP(xp) {
    let level = 1;
    let totalXP = 0;
    for (let l = 1; l <= 99; l++) {
      const xpRequired = Math.floor(l + 300 * Math.pow(2, l / 7)) / 4;
      totalXP += xpRequired;
      if (xp >= totalXP) {
        level = l + 1;
      } else {
        break;
      }
    }
    return Math.min(level, 99);
  }
  getOrCreateConstructionComponent(player) {
    let component = player.getComponent("construction");
    if (!component) {
      component = {
        type: "construction",
        entity: player,
        data: {},
        level: 1,
        experience: 0,
        houseId: null,
        inHouse: false,
        buildMode: false,
        flatpacks: /* @__PURE__ */ new Map(),
        currentBuild: null
      };
      player.addComponent("construction", component);
    }
    return component;
  }
  sendMessage(playerId, message) {
    this.emit("chat:message", {
      playerId,
      message,
      type: "system"
    });
  }
  hasGold(inventory, amount) {
    return inventory.getItemCount(995) >= amount;
  }
  removeGold(inventory, amount) {
    inventory.removeItem(995, amount);
  }
  addGold(inventory, amount) {
    inventory.addItem({ id: 995, quantity: amount });
  }
  generateHouseId() {
    return `house_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Update loop
   */
  update(_delta) {
    const now = Date.now();
    for (const house of this.houses.values()) {
      if (house.servant.type !== "none" && house.servant.taskQueue.length > 0) {
        const task = house.servant.taskQueue[0];
        if (now >= task.completionTime) {
          house.servant.taskQueue.shift();
          this.emit("construction:servant-task-completed", {
            houseId: house.id,
            ownerId: house.ownerId,
            taskType: task.type,
            items: task.items
          });
        }
      }
      if (house.servant.type !== "none") {
        const wageInterval = 30 * 60 * 1e3;
        if (now - house.servant.lastPayment >= wageInterval) {
          const wage = this.SERVANT_WAGES.get(house.servant.type) || 0;
          const owner = this.world.entities.get(house.ownerId);
          if (owner) {
            const inventory = owner.getComponent("inventory");
            if (inventory && this.hasGold(inventory, wage)) {
              this.removeGold(inventory, wage);
              house.servant.lastPayment = now;
            } else {
              this.dismissServant(house.ownerId);
              this.sendMessage(house.ownerId, "Your servant has left due to lack of payment");
            }
          }
        }
      }
    }
  }
};

// src/rpg/types/index.ts
var EquipmentSlot = /* @__PURE__ */ ((EquipmentSlot2) => {
  EquipmentSlot2["HEAD"] = "head";
  EquipmentSlot2["CAPE"] = "cape";
  EquipmentSlot2["AMULET"] = "amulet";
  EquipmentSlot2["WEAPON"] = "weapon";
  EquipmentSlot2["BODY"] = "body";
  EquipmentSlot2["SHIELD"] = "shield";
  EquipmentSlot2["LEGS"] = "legs";
  EquipmentSlot2["GLOVES"] = "gloves";
  EquipmentSlot2["BOOTS"] = "boots";
  EquipmentSlot2["RING"] = "ring";
  EquipmentSlot2["AMMO"] = "ammo";
  return EquipmentSlot2;
})(EquipmentSlot || {});

// src/rpg/systems/combat/HitCalculator.ts
var HitCalculator = class {
  /**
   * Calculate attack roll based on stats and combat style
   */
  calculateAttackRoll(attacker, style, attackType) {
    const effectiveLevel = this.getEffectiveAttackLevel(attacker, style, attackType);
    const equipmentBonus = this.getAttackBonus(attacker, attackType);
    return effectiveLevel * (equipmentBonus + 64);
  }
  /**
   * Calculate defense roll
   */
  calculateDefenseRoll(defender, incomingAttackType, defenderCombatComponent) {
    const effectiveDefense = this.getEffectiveDefenseLevel(
      defender,
      defenderCombatComponent?.combatStyle || "defensive" /* DEFENSIVE */
    );
    const defenseBonus = this.getDefenseBonus(defender, incomingAttackType);
    return effectiveDefense * (defenseBonus + 64);
  }
  /**
   * Calculate hit chance from attack and defense rolls
   */
  calculateHitChance(attackRoll, defenseRoll) {
    if (attackRoll > defenseRoll) {
      return 1 - (defenseRoll + 2) / (2 * (attackRoll + 1));
    } else {
      return attackRoll / (2 * (defenseRoll + 1));
    }
  }
  /**
   * Get effective attack level with style bonuses
   */
  getEffectiveAttackLevel(attacker, style, attackType) {
    let level = 0;
    let styleBonus = 0;
    switch (attackType) {
      case "melee" /* MELEE */:
        level = attacker.attack.level;
        break;
      case "ranged" /* RANGED */:
        level = attacker.ranged.level;
        break;
      case "magic" /* MAGIC */:
        level = attacker.magic.level;
        break;
    }
    switch (style) {
      case "accurate" /* ACCURATE */:
        styleBonus = 3;
        break;
      case "controlled" /* CONTROLLED */:
        styleBonus = 1;
        break;
    }
    return level + styleBonus + 8;
  }
  /**
   * Get effective defense level with style bonuses
   */
  getEffectiveDefenseLevel(defender, style) {
    const defenseLevel = defender.defense.level;
    const styleBonus = this.getDefenderStyleBonus(style);
    const prayerBonus = this.getDefencePrayerBonus(defender);
    return Math.floor((defenseLevel + styleBonus) * prayerBonus) + 8;
  }
  /**
   * Get defender style bonus
   */
  getDefenderStyleBonus(style) {
    switch (style) {
      case "defensive" /* DEFENSIVE */:
        return 3;
      // +3 defence levels
      case "controlled" /* CONTROLLED */:
        return 1;
      // +1 to all combat skills
      case "longrange" /* LONGRANGE */:
        return 3;
      // +3 defence levels for ranged
      default:
        return 0;
    }
  }
  /**
   * Get defence prayer bonus multiplier
   */
  getDefencePrayerBonus(defender) {
    const prayers = defender.activePrayers || {};
    if (prayers.piety) {
      return 1.25;
    }
    if (prayers.rigour) {
      return 1.25;
    }
    if (prayers.augury) {
      return 1.25;
    }
    if (prayers.chivalry) {
      return 1.2;
    }
    if (prayers.steelSkin) {
      return 1.15;
    }
    if (prayers.rockSkin) {
      return 1.1;
    }
    if (prayers.thickSkin) {
      return 1.05;
    }
    return 1;
  }
  /**
   * Get attack bonus based on attack type
   */
  getAttackBonus(attacker, attackType) {
    const bonuses = attacker.combatBonuses;
    switch (attackType) {
      case "melee" /* MELEE */:
        return Math.max(bonuses.attackStab, bonuses.attackSlash, bonuses.attackCrush);
      case "ranged" /* RANGED */:
        return bonuses.attackRanged;
      case "magic" /* MAGIC */:
        return bonuses.attackMagic;
      default:
        return 0;
    }
  }
  /**
   * Get defense bonus against attack type
   */
  getDefenseBonus(defender, attackType) {
    const bonuses = defender.combatBonuses;
    switch (attackType) {
      case "melee" /* MELEE */:
        return Math.floor((bonuses.defenseStab + bonuses.defenseSlash + bonuses.defenseCrush) / 3);
      case "ranged" /* RANGED */:
        return bonuses.defenseRanged;
      case "magic" /* MAGIC */:
        return bonuses.defenseMagic;
      default:
        return 0;
    }
  }
};

// src/rpg/systems/combat/DamageCalculator.ts
var DamageCalculator = class {
  /**
   * Calculate maximum hit based on stats and combat style
   */
  calculateMaxHit(attacker, style, attackType) {
    switch (attackType) {
      case "melee" /* MELEE */:
        return this.calculateMeleeMaxHit(attacker, style);
      case "ranged" /* RANGED */:
        return this.calculateRangedMaxHit(attacker, style);
      case "magic" /* MAGIC */:
        return this.calculateMagicMaxHit(attacker);
      default:
        return 0;
    }
  }
  /**
   * Roll damage between 0 and max hit
   */
  rollDamage(maxHit) {
    return Math.floor(Math.random() * (maxHit + 1));
  }
  /**
   * Apply damage reductions (protection prayers, etc.)
   */
  applyDamageReductions(damage, target, attackType, _attacker) {
    let reducedDamage = damage;
    const protectionMultiplier = this.getProtectionPrayerMultiplier(target, attackType);
    reducedDamage = Math.floor(reducedDamage * protectionMultiplier);
    const defenseReduction = this.getDefensiveDamageReduction(target, attackType);
    reducedDamage = Math.floor(reducedDamage * defenseReduction);
    const specialReduction = this.getSpecialDefensiveReduction(target);
    reducedDamage = Math.floor(reducedDamage * specialReduction);
    return Math.max(0, reducedDamage);
  }
  /**
   * Get protection prayer damage multiplier
   */
  getProtectionPrayerMultiplier(target, attackType) {
    const prayers = target.activePrayers || {};
    switch (attackType) {
      case "melee" /* MELEE */:
        if (prayers.protectFromMelee) {
          return 0.6;
        }
        break;
      case "ranged" /* RANGED */:
        if (prayers.protectFromRanged) {
          return 0.6;
        }
        break;
      case "magic" /* MAGIC */:
        if (prayers.protectFromMagic) {
          return 0.6;
        }
        break;
    }
    return 1;
  }
  /**
   * Calculate defensive damage reduction from equipment
   */
  getDefensiveDamageReduction(target, attackType) {
    let defenseBonus = 0;
    switch (attackType) {
      case "melee" /* MELEE */:
        defenseBonus = (target.combatBonuses.defenseStab + target.combatBonuses.defenseSlash + target.combatBonuses.defenseCrush) / 3;
        break;
      case "ranged" /* RANGED */:
        defenseBonus = target.combatBonuses.defenseRanged;
        break;
      case "magic" /* MAGIC */:
        defenseBonus = target.combatBonuses.defenseMagic;
        break;
    }
    const reduction = Math.min(0.1, defenseBonus / 1e3);
    return 1 - reduction;
  }
  /**
   * Get special defensive reductions (e.g., from shields)
   */
  getSpecialDefensiveReduction(target) {
    const equipment = target.equipment || {};
    if (equipment.shield?.name === "Elysian spirit shield") {
      if (Math.random() < 0.25) {
        return 0.75;
      }
    }
    if (equipment.shield?.name === "Divine spirit shield" && target.prayer.points > 0) {
      return 0.7;
    }
    return 1;
  }
  /**
   * Calculate melee max hit
   */
  calculateMeleeMaxHit(attacker, style) {
    const effectiveStrength = this.getEffectiveStrengthLevel(attacker, style);
    const strengthBonus = attacker.combatBonuses.meleeStrength;
    let maxHit = 0.5 + effectiveStrength * (strengthBonus + 64) / 640;
    const prayerMultiplier = this.getMeleePrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    const otherBonuses = this.getMeleeOtherBonuses(attacker);
    maxHit *= otherBonuses;
    return Math.floor(maxHit);
  }
  /**
   * Calculate ranged max hit
   */
  calculateRangedMaxHit(attacker, style) {
    const effectiveRanged = this.getEffectiveRangedLevel(attacker, style);
    const rangedStrength = attacker.combatBonuses.rangedStrength;
    let maxHit = 0.5 + effectiveRanged * (rangedStrength + 64) / 640;
    const prayerMultiplier = this.getRangedPrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    const otherBonuses = this.getRangedOtherBonuses(attacker);
    maxHit *= otherBonuses;
    return Math.floor(maxHit);
  }
  /**
   * Calculate magic max hit
   */
  calculateMagicMaxHit(attacker) {
    const magicLevel = attacker.magic.level;
    const magicDamage = attacker.combatBonuses.magicDamage;
    const baseSpellDamage = this.getEquippedSpellDamage(attacker);
    let maxHit = baseSpellDamage * (1 + magicDamage / 100);
    const levelBonus = 1 + (magicLevel - 1) / 200;
    maxHit *= levelBonus;
    const prayerMultiplier = this.getMagicPrayerBonus(attacker);
    maxHit *= prayerMultiplier;
    return Math.floor(maxHit);
  }
  /**
   * Get base damage for equipped spell
   */
  getEquippedSpellDamage(attacker) {
    const equippedSpell = attacker.equippedSpell;
    if (!equippedSpell) {
      return 2;
    }
    const spellDamages = {
      // Strike spells
      wind_strike: 2,
      water_strike: 4,
      earth_strike: 6,
      fire_strike: 8,
      // Bolt spells
      wind_bolt: 9,
      water_bolt: 10,
      earth_bolt: 11,
      fire_bolt: 12,
      // Blast spells
      wind_blast: 13,
      water_blast: 14,
      earth_blast: 15,
      fire_blast: 16,
      // Wave spells
      wind_wave: 17,
      water_wave: 18,
      earth_wave: 19,
      fire_wave: 20,
      // Surge spells
      wind_surge: 21,
      water_surge: 22,
      earth_surge: 23,
      fire_surge: 24,
      // Ancient spells
      ice_rush: 16,
      ice_burst: 22,
      ice_blitz: 26,
      ice_barrage: 30,
      blood_rush: 15,
      blood_burst: 21,
      blood_blitz: 25,
      blood_barrage: 29
    };
    return spellDamages[equippedSpell] || 10;
  }
  /**
   * Get melee prayer bonus multiplier
   */
  getMeleePrayerBonus(attacker) {
    const prayers = attacker.activePrayers || {};
    if (prayers.piety) {
      return 1.23;
    }
    if (prayers.chivalry) {
      return 1.18;
    }
    if (prayers.ultimateStrength) {
      return 1.15;
    }
    if (prayers.superhumanStrength) {
      return 1.1;
    }
    if (prayers.burstOfStrength) {
      return 1.05;
    }
    return 1;
  }
  /**
   * Get ranged prayer bonus multiplier
   */
  getRangedPrayerBonus(attacker) {
    const prayers = attacker.activePrayers || {};
    if (prayers.rigour) {
      return 1.23;
    }
    if (prayers.eagleEye) {
      return 1.15;
    }
    if (prayers.hawkEye) {
      return 1.1;
    }
    if (prayers.sharpEye) {
      return 1.05;
    }
    return 1;
  }
  /**
   * Get magic prayer bonus multiplier
   */
  getMagicPrayerBonus(attacker) {
    const prayers = attacker.activePrayers || {};
    if (prayers.augury) {
      return 1.25;
    }
    if (prayers.mysticMight) {
      return 1.15;
    }
    if (prayers.mysticLore) {
      return 1.1;
    }
    if (prayers.mysticWill) {
      return 1.05;
    }
    return 1;
  }
  /**
   * Get other melee bonuses (void, slayer helm, etc.)
   */
  getMeleeOtherBonuses(attacker) {
    let multiplier = 1;
    const equipment = attacker.equipment || {};
    const effects = attacker.effects || {};
    if (this.hasVoidMeleeSet(equipment)) {
      multiplier *= 1.1;
    }
    if (equipment.head?.name?.includes("Slayer helm") && effects.onSlayerTask) {
      multiplier *= 1.1667;
    }
    if (equipment.amulet?.name === "Berserker necklace" && equipment.weapon?.name?.includes("Obsidian")) {
      multiplier *= 1.2;
    }
    if (equipment.weapon?.name === "Dragon hunter lance" && effects.targetIsDragon) {
      multiplier *= 1.2;
    }
    return multiplier;
  }
  /**
   * Get other ranged bonuses
   */
  getRangedOtherBonuses(attacker) {
    let multiplier = 1;
    const equipment = attacker.equipment || {};
    const effects = attacker.effects || {};
    if (this.hasVoidRangedSet(equipment)) {
      multiplier *= 1.1;
    }
    if (this.hasEliteVoidRangedSet(equipment)) {
      multiplier *= 1.125;
    }
    if (equipment.head?.name?.includes("Slayer helm") && effects.onSlayerTask) {
      multiplier *= 1.15;
    }
    if (equipment.weapon?.name === "Twisted bow" && effects.targetMagicLevel) {
      const magicLevel = effects.targetMagicLevel;
      const damageBoost = Math.min(2.5, 1 + magicLevel / 100);
      multiplier *= damageBoost;
    }
    return multiplier;
  }
  /**
   * Check if player has void melee set
   */
  hasVoidMeleeSet(equipment) {
    return equipment.head?.name === "Void melee helm" && equipment.body?.name === "Void knight top" && equipment.legs?.name === "Void knight robe" && equipment.gloves?.name === "Void knight gloves";
  }
  /**
   * Check if player has void ranged set
   */
  hasVoidRangedSet(equipment) {
    return equipment.head?.name === "Void ranger helm" && equipment.body?.name === "Void knight top" && equipment.legs?.name === "Void knight robe" && equipment.gloves?.name === "Void knight gloves";
  }
  /**
   * Check if player has elite void ranged set
   */
  hasEliteVoidRangedSet(equipment) {
    return equipment.head?.name === "Void ranger helm" && equipment.body?.name === "Elite void top" && equipment.legs?.name === "Elite void robe" && equipment.gloves?.name === "Void knight gloves";
  }
  /**
   * Get effective strength level with style bonuses
   */
  getEffectiveStrengthLevel(attacker, style) {
    let styleBonus = 0;
    switch (style) {
      case "aggressive" /* AGGRESSIVE */:
        styleBonus = 3;
        break;
      case "controlled" /* CONTROLLED */:
        styleBonus = 1;
        break;
    }
    return attacker.strength.level + styleBonus + 8;
  }
  /**
   * Get effective ranged level with style bonuses
   */
  getEffectiveRangedLevel(attacker, _style) {
    const styleBonus = 0;
    return attacker.ranged.level + styleBonus + 8;
  }
};

// src/rpg/systems/combat/CombatAnimationManager.ts
var CombatAnimationManager = class {
  constructor(world) {
    this.activeAnimations = /* @__PURE__ */ new Map();
    this.animationQueue = [];
    // Animation definitions
    this.animations = {
      // Melee animations
      melee_slash: { duration: 600, file: "slash.glb" },
      melee_stab: { duration: 600, file: "stab.glb" },
      melee_crush: { duration: 600, file: "crush.glb" },
      // Unarmed combat
      punch: { duration: 400, file: "punch.glb" },
      // Weapon-specific melee animations
      stab: { duration: 600, file: "stab.glb" },
      stab_aggressive: { duration: 500, file: "stab_aggressive.glb" },
      slash: { duration: 600, file: "slash.glb" },
      slash_aggressive: { duration: 500, file: "slash_aggressive.glb" },
      slash_defensive: { duration: 700, file: "slash_defensive.glb" },
      crush: { duration: 700, file: "crush.glb" },
      crush_aggressive: { duration: 600, file: "crush_aggressive.glb" },
      stab_controlled: { duration: 650, file: "stab_controlled.glb" },
      stab_2h: { duration: 800, file: "stab_2h.glb" },
      // Ranged animations
      ranged_bow: { duration: 900, file: "bow_shoot.glb" },
      ranged_crossbow: { duration: 700, file: "crossbow_shoot.glb" },
      ranged_thrown: { duration: 600, file: "throw.glb" },
      bow_shoot: { duration: 900, file: "bow_shoot.glb" },
      crossbow_shoot: { duration: 700, file: "crossbow_shoot.glb" },
      // Magic animations
      magic_cast: { duration: 1200, file: "magic_cast.glb" },
      magic_strike: { duration: 600, file: "magic_strike.glb" },
      cast_standard: { duration: 1200, file: "cast_standard.glb" },
      cast_defensive: { duration: 1400, file: "cast_defensive.glb" },
      // Defense animations
      block: { duration: 400, file: "block.glb" },
      dodge: { duration: 500, file: "dodge.glb" },
      // Death animation
      death: { duration: 2e3, file: "death.glb" },
      // Hit reactions
      hit_reaction: { duration: 300, file: "hit_reaction.glb" },
      // Idle state
      idle: { duration: 0, file: "idle.glb" }
    };
    this.world = world;
  }
  /**
   * Update animation states
   */
  update(_delta) {
    const now = Date.now();
    const toRemove = [];
    for (const [entityId, task] of Array.from(this.activeAnimations)) {
      if (now - task.startTime >= task.duration) {
        toRemove.push(entityId);
      }
    }
    toRemove.forEach((id) => {
      const animation = this.activeAnimations.get(id);
      if (animation) {
        this.onAnimationComplete(id, animation);
      }
      this.activeAnimations.delete(id);
    });
  }
  /**
   * Play attack animation based on attack type
   */
  playAttackAnimation(attacker, attackType, style = "accurate" /* ACCURATE */) {
    const animationName = this.determineAnimation(attacker, attackType, style);
    this.playAnimation(attacker.id, animationName);
  }
  /**
   * Play block/defense animation
   */
  playDefenseAnimation(defender) {
    this.playAnimation(defender.id, "block");
  }
  /**
   * Play hit reaction animation
   */
  playHitReaction(entity) {
    this.playAnimation(entity.id, "hit_reaction");
  }
  /**
   * Play death animation
   */
  playDeathAnimation(entity) {
    this.playAnimation(entity.id, "death");
  }
  /**
   * Play a specific animation
   */
  playAnimation(entityId, animationName) {
    const animation = this.animations[animationName];
    if (!animation) {
      console.warn(`Unknown animation: ${animationName}`);
      return;
    }
    if (this.activeAnimations.has(entityId)) {
      this.cancelAnimation(entityId);
    }
    const task = {
      id: `anim_${Date.now()}_${Math.random()}`,
      entityId,
      targetId: void 0,
      animationName,
      duration: animation.duration,
      attackType: "melee" /* MELEE */,
      // Default for legacy animations
      style: "accurate" /* ACCURATE */,
      // Default for legacy animations
      damage: void 0,
      startTime: Date.now(),
      progress: 0,
      cancelled: false
    };
    this.activeAnimations.set(entityId, task);
    this.broadcastAnimation(entityId, animationName);
  }
  /**
   * Cancel animation
   */
  cancelAnimation(entityId) {
    const currentAnimation = this.activeAnimations.get(entityId);
    if (!currentAnimation) {
      return;
    }
    currentAnimation.cancelled = true;
    const network = this.world.network;
    if (network) {
      network.broadcast("animation:cancelled", {
        entityId,
        animationId: currentAnimation.id,
        timestamp: Date.now()
      });
    }
    this.activeAnimations.delete(entityId);
  }
  /**
   * Handle animation completion
   */
  onAnimationComplete(entityId, animation) {
    const entity = this.world.entities.get(entityId);
    if (entity) {
      const visual = entity.getComponent("visual");
      if (visual) {
        visual.currentAnimation = "idle";
        visual.animationTime = 0;
      }
    }
    const network = this.world.network;
    if (network) {
      network.broadcast("animation:complete", {
        entityId,
        animationId: animation.id,
        animationType: animation.animationName,
        timestamp: Date.now()
      });
    }
    this.world.events.emit("animation:complete", {
      entityId,
      animation: animation.animationName
    });
  }
  /**
   * Broadcast animation to all clients
   */
  broadcastAnimation(entityId, animationName) {
    const network = this.world.network;
    if (network) {
      network.broadcast("animation:play", {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    } else {
      this.world.events.emit("animation:play", {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    }
  }
  /**
   * Check if entity is playing an animation
   */
  isAnimating(entityId) {
    return this.activeAnimations.has(entityId);
  }
  /**
   * Get current animation for entity
   */
  getCurrentAnimation(entityId) {
    const task = this.activeAnimations.get(entityId);
    return task ? task.animationName : null;
  }
  /**
   * Determine specific animation based on attack type and weapon
   */
  determineAnimation(entity, attackType, style) {
    switch (attackType) {
      case "melee" /* MELEE */:
        const weapon = this.getEquippedWeapon(entity);
        if (weapon) {
          const weaponType = weapon.equipment?.weaponType;
          switch (weaponType) {
            case "dagger" /* DAGGER */:
              return style === "aggressive" /* AGGRESSIVE */ ? "stab_aggressive" : "stab";
            case "sword" /* SWORD */:
            case "scimitar" /* SCIMITAR */:
              return style === "aggressive" /* AGGRESSIVE */ ? "slash_aggressive" : style === "defensive" /* DEFENSIVE */ ? "slash_defensive" : "slash";
            case "mace" /* MACE */:
            case "axe" /* AXE */:
              return style === "aggressive" /* AGGRESSIVE */ ? "crush_aggressive" : "crush";
            case "spear" /* SPEAR */:
            case "halberd" /* HALBERD */:
              return style === "controlled" /* CONTROLLED */ ? "stab_controlled" : "stab_2h";
            default:
              return "punch";
          }
        }
        return "punch";
      // Unarmed
      case "ranged" /* RANGED */:
        const rangedWeapon = this.getEquippedWeapon(entity);
        if (rangedWeapon) {
          const weaponType = rangedWeapon.equipment?.weaponType;
          if (weaponType === "crossbow" /* CROSSBOW */) {
            return "crossbow_shoot";
          }
        }
        return "bow_shoot";
      // Default to bow
      case "magic" /* MAGIC */:
        return style === "defensive" /* DEFENSIVE */ ? "cast_defensive" : "cast_standard";
      default:
        return "idle";
    }
  }
  /**
   * Get equipped weapon
   */
  getEquippedWeapon(entity) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return null;
    }
    return inventory.equipment["weapon" /* WEAPON */];
  }
  /**
   * Queue animation for entity
   */
  queueAnimation(entityId, attackType, style, damage, targetId) {
    const entity = this.world.entities.get(entityId);
    const animationName = entity ? this.determineAnimation(entity, attackType, style) : this.getDefaultAnimationName(attackType);
    const duration = this.getAnimationDuration(animationName);
    const task = {
      id: `anim_${Date.now()}_${Math.random()}`,
      entityId,
      targetId,
      animationName,
      duration,
      attackType,
      style,
      damage,
      startTime: Date.now(),
      progress: 0,
      cancelled: false
    };
    this.animationQueue.push(task);
  }
  /**
   * Get default animation name for attack type
   */
  getDefaultAnimationName(attackType) {
    switch (attackType) {
      case "melee" /* MELEE */:
        return "melee_slash";
      case "ranged" /* RANGED */:
        return "ranged_bow";
      case "magic" /* MAGIC */:
        return "magic_cast";
      default:
        return "idle";
    }
  }
  /**
   * Get animation duration
   */
  getAnimationDuration(animationName) {
    const animation = this.animations[animationName];
    return animation ? animation.duration : 600;
  }
};

// src/rpg/systems/CombatSystem.ts
var CombatSystem = class extends System {
  constructor(world) {
    super(world);
    this.name = "CombatSystem";
    this.enabled = true;
    // Core components
    this.combatSessions = /* @__PURE__ */ new Map();
    // Configuration
    this.COMBAT_TICK_RATE = 600;
    // milliseconds
    this.COMBAT_TIMEOUT = 1e4;
    // 10 seconds
    this.MAX_ATTACK_RANGE = 1;
    // tiles
    this.lastTickTime = 0;
    this.hitCalculator = new HitCalculator();
    this.damageCalculator = new DamageCalculator();
    this.combatAnimations = new CombatAnimationManager(world);
  }
  /**
   * Initialize the combat system
   */
  async init(_options) {
    console.log("[CombatSystem] Initializing...");
    this.world.events.on("rpg:attack", (event) => {
      this.handleAttackEvent(event);
    });
    this.world.events.on("rpg:stop_combat", (event) => {
      this.endCombat(event.entityId);
    });
    this.world.events.on("rpg:special_attack", (event) => {
      this.handleSpecialAttackEvent(event);
    });
    this.world.events.on("entity:death", (event) => {
      this.handleEntityDeath(event.entityId);
    });
    this.world.events.on("entity:destroyed", (event) => {
      this.handleEntityDeath(event.entityId);
    });
  }
  /**
   * Fixed update for combat ticks
   */
  fixedUpdate(_delta) {
    const now = Date.now();
    if (now - this.lastTickTime >= this.COMBAT_TICK_RATE) {
      this.processCombatTick();
      this.lastTickTime = now;
    }
  }
  /**
   * Main update for visual effects
   */
  update(_delta) {
    this.updateHitSplats(_delta);
    this.combatAnimations.update(_delta);
    this.checkCombatTimeouts();
  }
  /**
   * Initiate an attack
   */
  initiateAttack(attackerId, targetId) {
    const attacker = this.getEntity(attackerId);
    const target = this.getEntity(targetId);
    if (!attacker || !target) {
      return false;
    }
    if (!this.canAttack(attacker, target)) {
      return false;
    }
    let session = this.combatSessions.get(attackerId);
    if (!session) {
      session = this.createCombatSession(attackerId, targetId);
      this.combatSessions.set(attackerId, session);
    }
    const attackerCombat = attacker.getComponent("combat");
    if (attackerCombat) {
      attackerCombat.inCombat = true;
      attackerCombat.target = targetId;
    }
    const targetCombat = target.getComponent("combat");
    if (targetCombat && targetCombat.autoRetaliate && !targetCombat.inCombat) {
      this.initiateAttack(targetId, attackerId);
    }
    this.world.events.emit("combat:start", { session });
    return true;
  }
  /**
   * Process combat tick for all active sessions
   */
  processCombatTick() {
    const now = Date.now();
    for (const [entityId, session] of Array.from(this.combatSessions)) {
      const attacker = this.getEntity(session.attackerId);
      const target = this.getEntity(session.targetId);
      if (!attacker || !target) {
        this.endCombat(entityId);
        continue;
      }
      const combat = attacker.getComponent("combat");
      if (!combat || !combat.inCombat) {
        continue;
      }
      if (now - combat.lastAttackTime >= this.getAttackSpeed(attacker, combat)) {
        this.performAttack(attacker, target, session);
        combat.lastAttackTime = now;
      }
    }
  }
  /**
   * Perform an attack
   */
  performAttack(attacker, target, session) {
    const hit = this.calculateHit(attacker, target);
    session.hits.push(hit);
    session.lastAttackTime = Date.now();
    if (hit.damage > 0) {
      this.applyDamage(target, hit.damage, attacker);
    }
    this.queueHitSplat(target, hit);
    this.combatAnimations.playAttackAnimation(attacker, hit.attackType);
    this.world.events.emit("combat:hit", { hit });
  }
  /**
   * Calculate hit result
   */
  calculateHit(attacker, target) {
    const attackerStats = attacker.getComponent("stats");
    const targetStats = target.getComponent("stats");
    const attackerCombat = attacker.getComponent("combat");
    if (!attackerStats || !targetStats || !attackerCombat) {
      return this.createMissResult(attacker.data.id, target.data.id);
    }
    const attackType = this.getAttackType(attacker);
    const attackRoll = this.hitCalculator.calculateAttackRoll(attackerStats, attackerCombat.combatStyle, attackType);
    const targetCombat = target.getComponent("combat");
    const defenseRoll = this.hitCalculator.calculateDefenseRoll(targetStats, attackType, targetCombat || void 0);
    const hitChance = this.hitCalculator.calculateHitChance(attackRoll, defenseRoll);
    const hits = Math.random() < hitChance;
    if (!hits) {
      return this.createMissResult(attacker.data.id, target.data.id, attackType);
    }
    const maxHit = this.damageCalculator.calculateMaxHit(attackerStats, attackerCombat.combatStyle, attackType);
    const damage = this.damageCalculator.rollDamage(maxHit);
    const finalDamage = this.damageCalculator.applyDamageReductions(damage, targetStats, attackType, attackerStats);
    return {
      damage: finalDamage,
      type: "normal",
      attackType,
      attackerId: attacker.data.id,
      targetId: target.data.id,
      timestamp: Date.now()
    };
  }
  /**
   * Apply damage to target
   */
  applyDamage(target, damage, source) {
    const stats = target.getComponent("stats");
    if (!stats) {
      return;
    }
    stats.hitpoints.current = Math.max(0, stats.hitpoints.current - damage);
    if (stats.hitpoints.current <= 0) {
      this.handleDeath(target, source);
    }
    this.world.events.emit("combat:damage", {
      targetId: target.data.id,
      damage,
      sourceId: source.data.id,
      remaining: stats.hitpoints.current
    });
  }
  /**
   * Handle entity death from event system
   */
  handleEntityDeath(entityId) {
    this.endCombat(entityId);
    for (const [sessionId, session] of Array.from(this.combatSessions)) {
      if (session.targetId === entityId) {
        this.endCombat(sessionId);
      }
    }
  }
  /**
   * Handle entity death (internal combat death)
   */
  handleDeath(entity, killer) {
    this.endCombat(entity.data.id);
    for (const [sessionId, session] of Array.from(this.combatSessions)) {
      if (session.targetId === entity.data.id) {
        this.endCombat(sessionId);
      }
    }
    this.world.events.emit("entity:death", {
      entityId: entity.data.id,
      killerId: killer.data.id
    });
  }
  /**
   * End combat for an entity
   */
  endCombat(entityId) {
    const session = this.combatSessions.get(entityId);
    if (!session) {
      return;
    }
    const entity = this.getEntity(entityId);
    if (entity) {
      const combat = entity.getComponent("combat");
      if (combat) {
        combat.inCombat = false;
        combat.target = null;
      }
    }
    this.combatSessions.delete(entityId);
    this.world.events.emit("combat:end", { session });
  }
  /**
   * Check if attacker can attack target
   */
  canAttack(attacker, target) {
    if (!attacker || !target) {
      return false;
    }
    const attackerStats = attacker.getComponent("stats");
    const targetStats = target.getComponent("stats");
    if (!attackerStats || !targetStats) {
      return false;
    }
    if (!attackerStats.hitpoints || !targetStats.hitpoints) {
      return false;
    }
    if (attackerStats.hitpoints.current <= 0 || targetStats.hitpoints.current <= 0) {
      return false;
    }
    const distance = this.getDistance(attacker, target);
    const attackRange = this.getAttackRange(attacker);
    if (distance > attackRange) {
      return false;
    }
    if (this.isInSafeZone(attacker) || this.isInSafeZone(target)) {
      this.world.events.emit("combat:denied", {
        reason: "safe_zone",
        attackerId: attacker.data.id,
        targetId: target.data.id
      });
      return false;
    }
    if (this.isInWilderness(attacker) && this.isInWilderness(target)) {
      const attackerWildLevel = this.getWildernessLevel(attacker);
      const targetWildLevel = this.getWildernessLevel(target);
      const combatLevelDiff = Math.abs(attackerStats.combatLevel - targetStats.combatLevel);
      const maxLevelDiff = Math.min(attackerWildLevel, targetWildLevel);
      if (combatLevelDiff > maxLevelDiff) {
        this.world.events.emit("combat:denied", {
          reason: "wilderness_level",
          attackerId: attacker.data.id,
          targetId: target.data.id
        });
        return false;
      }
    }
    const inMulti = this.isInMultiCombat(attacker);
    if (!inMulti) {
      const attackerSession = this.combatSessions.get(attacker.data.id);
      const targetSession = this.getTargetSession(target.data.id);
      if (attackerSession && attackerSession.targetId !== target.data.id) {
        return false;
      }
      if (targetSession && targetSession.attackerId !== attacker.data.id) {
        return false;
      }
    }
    return true;
  }
  /**
   * Check if entity is in a safe zone
   */
  isInSafeZone(entity) {
    const position = this.getEntityPosition(entity);
    if (!position) {
      return false;
    }
    const safeZones = this.world.safeZones || [
      // Default safe zones
      { type: "rectangle", min: { x: -50, y: -10, z: -50 }, max: { x: 50, y: 50, z: 50 } },
      // Spawn area
      { type: "circle", center: { x: 0, y: 0, z: 0 }, radius: 100 }
      // Town center
    ];
    for (const zone of safeZones) {
      if (this.isPositionInZone(position, zone)) {
        return true;
      }
    }
    const zoneComponent = entity.getComponent("zone");
    if (zoneComponent?.isSafe) {
      return true;
    }
    return false;
  }
  /**
   * Check if entity is in wilderness
   */
  isInWilderness(entity) {
    const position = this.getEntityPosition(entity);
    if (!position) {
      return false;
    }
    const wildernessStart = this.world.wildernessStart || { x: -1e3, y: 0, z: 1e3 };
    return position.z > wildernessStart.z;
  }
  /**
   * Get wilderness level for entity
   */
  getWildernessLevel(entity) {
    const position = this.getEntityPosition(entity);
    if (!position || !this.isInWilderness(entity)) {
      return 0;
    }
    const wildernessStart = this.world.wildernessStart || { x: -1e3, y: 0, z: 1e3 };
    const level = Math.floor((position.z - wildernessStart.z) / 8) + 1;
    return Math.min(Math.max(level, 1), 56);
  }
  /**
   * Check if position is in multi-combat area
   */
  isInMultiCombat(entity) {
    const position = this.getEntityPosition(entity);
    if (!position) {
      return false;
    }
    const multiZones = this.world.multiCombatZones || [
      // Default multi-combat zones
      { type: "rectangle", min: { x: 100, y: -10, z: 100 }, max: { x: 200, y: 50, z: 200 } }
      // Boss area
    ];
    for (const zone of multiZones) {
      if (this.isPositionInZone(position, zone)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Check if position is within a zone
   */
  isPositionInZone(position, zone) {
    if (zone.type === "rectangle") {
      return position.x >= zone.min.x && position.x <= zone.max.x && position.y >= zone.min.y && position.y <= zone.max.y && position.z >= zone.min.z && position.z <= zone.max.z;
    } else if (zone.type === "circle") {
      const distance = Math.sqrt(
        Math.pow(position.x - zone.center.x, 2) + Math.pow(position.y - zone.center.y, 2) + Math.pow(position.z - zone.center.z, 2)
      );
      return distance <= zone.radius;
    }
    return false;
  }
  /**
   * Get session where entity is the target
   */
  getTargetSession(targetId) {
    for (const [_, session] of this.combatSessions) {
      if (session.targetId === targetId) {
        return session;
      }
    }
    return null;
  }
  /**
   * Create combat session
   */
  createCombatSession(attackerId, targetId) {
    return {
      id: `combat_${attackerId}_${Date.now()}`,
      attackerId,
      targetId,
      startTime: Date.now(),
      lastAttackTime: Date.now(),
      combatTimer: this.COMBAT_TIMEOUT,
      hits: []
    };
  }
  /**
   * Create miss result
   */
  createMissResult(attackerId, targetId, attackType = "melee" /* MELEE */) {
    return {
      damage: 0,
      type: "miss",
      attackType,
      attackerId,
      targetId,
      timestamp: Date.now()
    };
  }
  /**
   * Queue hit splat for display
   */
  queueHitSplat(target, hit) {
    const combat = target.getComponent("combat");
    const movement = target.getComponent("movement");
    if (!combat || !movement) {
      return;
    }
    const hitSplat = {
      damage: hit.damage,
      type: hit.type === "miss" ? "miss" : "normal",
      position: { ...movement.position },
      timestamp: Date.now(),
      duration: 1e3
    };
    combat.hitSplatQueue.push(hitSplat);
  }
  /**
   * Update hit splats
   */
  updateHitSplats(_delta) {
    const now = Date.now();
    for (const [_entityId, entity] of Array.from(this.world.entities.items)) {
      const rpgEntity = this.asRPGEntity(entity);
      if (!rpgEntity) {
        continue;
      }
      const combat = rpgEntity.getComponent("combat");
      if (!combat) {
        continue;
      }
      combat.hitSplatQueue = combat.hitSplatQueue.filter((splat) => now - splat.timestamp < splat.duration);
    }
  }
  /**
   * Check for combat timeouts
   */
  checkCombatTimeouts() {
    const now = Date.now();
    const toRemove = [];
    for (const [entityId, session] of Array.from(this.combatSessions)) {
      if (now - session.lastAttackTime > this.COMBAT_TIMEOUT) {
        toRemove.push(entityId);
      }
    }
    toRemove.forEach((id) => this.endCombat(id));
  }
  /**
   * Get attack speed in milliseconds
   */
  getAttackSpeed(entity, combat) {
    let speed = combat.attackSpeed * this.COMBAT_TICK_RATE;
    const weapon = this.getEquippedWeapon(entity);
    if (weapon?.equipment?.attackSpeed) {
      speed = weapon.equipment.attackSpeed * this.COMBAT_TICK_RATE;
    }
    if (combat.combatStyle === "rapid" /* RAPID */) {
      speed = Math.max(this.COMBAT_TICK_RATE, speed - this.COMBAT_TICK_RATE);
    }
    const effects = entity.getComponent("effects");
    if (effects?.haste) {
      speed *= 0.9;
    }
    return speed;
  }
  /**
   * Get attack type based on equipment
   */
  getAttackType(entity) {
    const weapon = this.getEquippedWeapon(entity);
    if (!weapon) {
      return "melee" /* MELEE */;
    }
    const weaponType = weapon.equipment?.weaponType;
    switch (weaponType) {
      case "bow" /* BOW */:
      case "crossbow" /* CROSSBOW */:
        return "ranged" /* RANGED */;
      case "staff" /* STAFF */:
      case "wand" /* WAND */:
        return "magic" /* MAGIC */;
      default:
        return "melee" /* MELEE */;
    }
  }
  /**
   * Get attack range based on weapon
   */
  getAttackRange(entity) {
    const weapon = this.getEquippedWeapon(entity);
    if (!weapon) {
      return this.MAX_ATTACK_RANGE;
    }
    const weaponType = weapon.equipment?.weaponType;
    switch (weaponType) {
      case "halberd" /* HALBERD */:
        return 2;
      // Halberds can attack 2 tiles away
      case "bow" /* BOW */:
        return 7;
      // Shortbow range
      case "crossbow" /* CROSSBOW */:
        return 8;
      // Crossbow range
      case "staff" /* STAFF */:
      case "wand" /* WAND */:
        return 10;
      // Magic range
      default:
        return this.MAX_ATTACK_RANGE;
    }
  }
  /**
   * Get equipped weapon
   */
  getEquippedWeapon(entity) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return null;
    }
    return inventory.equipment["weapon" /* WEAPON */];
  }
  /**
   * Calculate distance between entities
   */
  getDistance(entity1, entity2) {
    const pos1 = this.getEntityPosition(entity1);
    const pos2 = this.getEntityPosition(entity2);
    if (!pos1 || !pos2) {
      return Infinity;
    }
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    const dz = Math.abs(pos1.z - pos2.z);
    return Math.max(dx, dy, dz);
  }
  /**
   * Get entity position from movement component
   */
  getEntityPosition(entity) {
    const movement = entity.getComponent("movement");
    if (movement?.position) {
      return movement.position;
    }
    if (entity.position) {
      return entity.position;
    }
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    return null;
  }
  /**
   * Get entity from world and cast to RPGEntity
   */
  getEntity(entityId) {
    let entity = this.world.entities.items?.get(entityId);
    if (!entity && this.world.entities.players) {
      entity = this.world.entities.players.get(entityId);
    }
    if (!entity) {
      return void 0;
    }
    return this.asRPGEntity(entity);
  }
  /**
   * Safely cast entity to RPGEntity
   */
  asRPGEntity(entity) {
    if (entity && typeof entity.getComponent === "function") {
      return entity;
    }
    return void 0;
  }
  /**
   * Check if entity is in combat
   */
  isInCombat(entityId) {
    return this.combatSessions.has(entityId);
  }
  /**
   * Get combat session for entity
   */
  getCombatSession(entityId) {
    return this.combatSessions.get(entityId) || null;
  }
  /**
   * Force end combat (admin command)
   */
  forceEndCombat(entityId) {
    this.endCombat(entityId);
  }
  /**
   * Get or create combat component for entity
   */
  getOrCreateCombatComponent(entityId) {
    const entity = this.getEntity(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    let combat = entity.getComponent("combat");
    if (!combat) {
      const defaultCombat = {
        type: "combat",
        entity,
        data: {},
        entityId,
        inCombat: false,
        target: null,
        lastAttackTime: 0,
        attackSpeed: 4,
        combatStyle: "accurate" /* ACCURATE */,
        autoRetaliate: true,
        hitSplatQueue: [],
        animationQueue: [],
        specialAttackEnergy: 100,
        specialAttackActive: false,
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false
        }
      };
      const addedComponent = entity.addComponent("combat", defaultCombat);
      combat = addedComponent;
    }
    return combat;
  }
  /**
   * Calculate maximum hit damage
   */
  calculateMaxHit(stats, attackType, style) {
    return this.damageCalculator.calculateMaxHit(
      stats,
      style,
      attackType
    );
  }
  /**
   * Calculate effective level with bonuses
   */
  calculateEffectiveLevel(baseLevel, prayerBonus, potionBonus, style) {
    let styleBonus = 0;
    switch (style) {
      case "accurate":
      case "aggressive":
      case "defensive":
        styleBonus = 3;
        break;
      case "controlled":
        styleBonus = 1;
        break;
    }
    return baseLevel + prayerBonus + potionBonus + styleBonus;
  }
  /**
   * Grant combat XP based on damage and attack type
   */
  grantCombatXP(entityId, damage, attackType) {
    const baseXp = damage * 4;
    const hpXp = damage * 1.33;
    const defenseXp = damage * 1.33;
    switch (attackType) {
      case "melee":
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "attack",
          amount: baseXp,
          source: "combat"
        });
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "strength",
          amount: baseXp,
          source: "combat"
        });
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "hitpoints",
          amount: hpXp,
          source: "combat"
        });
        break;
      case "ranged":
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "ranged",
          amount: baseXp,
          source: "combat"
        });
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "defence",
          amount: defenseXp,
          source: "combat"
        });
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "hitpoints",
          amount: hpXp,
          source: "combat"
        });
        break;
      case "magic":
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "magic",
          amount: damage * 2,
          source: "combat"
        });
        this.world.events.emit("rpg:xp_gain", {
          playerId: entityId,
          skill: "hitpoints",
          amount: hpXp,
          source: "combat"
        });
        break;
    }
  }
  /**
   * Handle entity death with proper event emission
   */
  handleEntityDeathWithKiller(deadEntityId, killerId) {
    this.world.events.emit("rpg:entity_death", {
      deadEntityId,
      killerId,
      timestamp: Date.now()
    });
    this.handleEntityDeath(deadEntityId);
  }
  /**
   * Regenerate special attack energy
   */
  regenerateSpecialAttack() {
    const allMaps = [this.world.entities.items, this.world.entities.players].filter(Boolean);
    for (const entityMap of allMaps) {
      for (const [entityId] of entityMap) {
        const entity = this.getEntity(entityId);
        if (!entity) continue;
        const combat = entity.getComponent("combat");
        if (!combat) continue;
        if (combat.specialAttackEnergy < 100) {
          combat.specialAttackEnergy = Math.min(100, combat.specialAttackEnergy + 10);
        }
      }
    }
  }
  /**
   * Handle attack event
   */
  handleAttackEvent(event) {
    const { attackerId, targetId } = event;
    this.initiateAttack(attackerId, targetId);
  }
  /**
   * Handle special attack event
   */
  handleSpecialAttackEvent(event) {
    const { attackerId, targetId } = event;
    this.performSpecialAttack(attackerId, targetId);
  }
  /**
   * Perform special attack
   */
  performSpecialAttack(attackerId, targetId) {
    const attacker = this.getEntity(attackerId);
    const target = this.getEntity(targetId);
    if (!attacker || !target) {
      return;
    }
    const combat = attacker.getComponent("combat");
    if (!combat || combat.specialAttackEnergy < 25) {
      return;
    }
    combat.specialAttackEnergy -= 25;
    const hit = this.calculateSpecialHit(attacker, target);
    if (hit.damage > 0) {
      this.applyDamage(target, hit.damage, attacker);
    }
    this.queueHitSplat(target, hit);
    this.combatAnimations.playAttackAnimation(attacker, hit.attackType);
    this.world.events.emit("combat:special_hit", { hit });
  }
  /**
   * Calculate special attack hit
   */
  calculateSpecialHit(attacker, target) {
    const hit = this.calculateHit(attacker, target);
    hit.damage = Math.floor(hit.damage * 1.2);
    hit.type = "critical";
    return hit;
  }
};

// src/rpg/systems/inventory/EquipmentBonusCalculator.ts
var EquipmentSlotLocal = {
  ...EquipmentSlot,
  BOOTS: "boots",
  HEAD: "head",
  CAPE: "cape",
  AMULET: "amulet",
  WEAPON: "weapon",
  BODY: "body",
  SHIELD: "shield",
  LEGS: "legs",
  GLOVES: "gloves",
  RING: "ring",
  AMMO: "ammo"
};
var EquipmentBonusCalculator = class {
  constructor(itemRegistry) {
    this.itemRegistry = itemRegistry;
  }
  /**
   * Calculate total bonuses from all equipped items
   */
  calculateTotalBonuses(equipment) {
    const totalBonuses = this.createEmptyBonuses();
    for (const slot in equipment) {
      const item = equipment[slot];
      if (item && item.equipment && item.equipment.bonuses) {
        const bonuses = item.equipment.bonuses;
        totalBonuses.attackStab += bonuses.attackStab;
        totalBonuses.attackSlash += bonuses.attackSlash;
        totalBonuses.attackCrush += bonuses.attackCrush;
        totalBonuses.attackMagic += bonuses.attackMagic;
        totalBonuses.attackRanged += bonuses.attackRanged;
        totalBonuses.defenseStab += bonuses.defenseStab;
        totalBonuses.defenseSlash += bonuses.defenseSlash;
        totalBonuses.defenseCrush += bonuses.defenseCrush;
        totalBonuses.defenseMagic += bonuses.defenseMagic;
        totalBonuses.defenseRanged += bonuses.defenseRanged;
        totalBonuses.meleeStrength += bonuses.meleeStrength;
        totalBonuses.rangedStrength += bonuses.rangedStrength;
        totalBonuses.magicDamage += bonuses.magicDamage;
        totalBonuses.prayerBonus += bonuses.prayerBonus;
      }
    }
    return totalBonuses;
  }
  /**
   * Check if player meets requirements to equip an item
   */
  meetsRequirements(item, stats) {
    if (!item.equipable || !item.equipment) {
      return true;
    }
    const requirements = item.equipment.requirements;
    if (!requirements || Object.keys(requirements).length === 0) {
      return true;
    }
    for (const skill in requirements) {
      const required = requirements[skill];
      if (!required) {
        continue;
      }
      const playerSkill = stats[skill];
      if (!playerSkill || typeof playerSkill !== "object" || !("level" in playerSkill)) {
        return false;
      }
      if (playerSkill.level < required.level) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculate total weight of equipped items
   */
  getEquipmentWeight(equipment) {
    let totalWeight = 0;
    for (const slot in equipment) {
      const item = equipment[slot];
      if (item) {
        totalWeight += item.weight;
      }
    }
    return totalWeight;
  }
  /**
   * Create an empty bonuses object with all values set to 0
   */
  createEmptyBonuses() {
    return {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };
  }
  /**
   * Get equipment set bonuses (e.g., Barrows sets)
   */
  getSetBonuses(equipment) {
    const setBonuses = {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };
    const equippedItems = Object.values(equipment).filter((item) => item !== null);
    if (this.hasCompleteSet(equippedItems, "dharok")) {
    }
    if (this.hasVoidSet(equippedItems)) {
    }
    return setBonuses;
  }
  /**
   * Check if player has a complete armor set
   */
  hasCompleteSet(items, setName) {
    const setItems = items.filter((item) => item.name.toLowerCase().includes(setName));
    return setItems.length >= 4;
  }
  /**
   * Check for void knight set
   */
  hasVoidSet(items) {
    const voidItems = items.filter((item) => item.name.toLowerCase().includes("void"));
    const hasTop = voidItems.some((item) => item.name.includes("top"));
    const hasBottom = voidItems.some((item) => item.name.includes("robe"));
    const hasGloves = voidItems.some((item) => item.name.includes("gloves"));
    const hasHelm = voidItems.some((item) => item.name.includes("helm") || item.name.includes("hood"));
    return hasTop && hasBottom && hasGloves && hasHelm;
  }
  /**
   * Calculate weight reduction from equipment
   */
  calculateWeightReduction(equipment) {
    let reduction = 0;
    const gracefulPieces = Object.values(equipment).filter(
      (item) => item && item.name.toLowerCase().includes("graceful")
    ).length;
    reduction += gracefulPieces * 3;
    if (gracefulPieces >= 6) {
      reduction += 3;
    }
    const cape = equipment["cape" /* CAPE */];
    if (cape) {
      if (cape.name.toLowerCase().includes("spottier")) {
        reduction += 5;
      } else if (cape.name.toLowerCase().includes("spotted")) {
        reduction += 3;
      }
    }
    const boots = equipment["boots" /* BOOTS */];
    if (boots && boots.name.toLowerCase().includes("lightness")) {
      reduction += 4;
    }
    return reduction;
  }
  /**
   * Get prayer drain reduction from equipment
   */
  getPrayerDrainReduction(equipment) {
    let reduction = 0;
    for (const slot in equipment) {
      const item = equipment[slot];
      if (item && item.equipment?.bonuses?.prayerBonus) {
        reduction += item.equipment.bonuses.prayerBonus * 3.33 / 100;
      }
    }
    return Math.min(reduction, 0.5);
  }
};

// src/rpg/systems/inventory/ItemRegistry.ts
var ItemRegistry = class {
  constructor() {
    this.items = /* @__PURE__ */ new Map();
    this.nameIndex = /* @__PURE__ */ new Map();
  }
  /**
   * Register an item definition
   */
  register(item) {
    this.items.set(item.id, item);
    this.nameIndex.set(item.name, item);
  }
  /**
   * Get item by ID
   */
  get(itemId) {
    return this.items.get(itemId) || null;
  }
  /**
   * Get item by exact name
   */
  getByName(name) {
    return this.nameIndex.get(name) || null;
  }
  /**
   * Check if item is stackable
   */
  isStackable(itemId) {
    const item = this.get(itemId);
    return item ? item.stackable : false;
  }
  /**
   * Check if item is equipable
   */
  isEquipable(itemId) {
    const item = this.get(itemId);
    return item ? item.equipable : false;
  }
  /**
   * Check if item is tradeable
   */
  isTradeable(itemId) {
    const item = this.get(itemId);
    return item ? item.tradeable : false;
  }
  /**
   * Check if item can be noted
   */
  isNoteable(itemId) {
    const item = this.get(itemId);
    return item ? item.noteable === true && !item.noted : false;
  }
  /**
   * Check if item is noted
   */
  isNoted(itemId) {
    const item = this.get(itemId);
    return item ? item.noted === true : false;
  }
  /**
   * Get unnoted version ID
   */
  getUnnoted(itemId) {
    const item = this.get(itemId);
    return item && item.noted && item.notedId ? item.notedId : null;
  }
  /**
   * Get noted version ID
   */
  getNoted(itemId) {
    const item = this.get(itemId);
    return item && item.noteable && item.notedId ? item.notedId : null;
  }
  /**
   * Check if item is members only
   */
  isMembers(itemId) {
    const item = this.get(itemId);
    return item ? item.members : false;
  }
  /**
   * Get all registered items
   */
  getAll() {
    return Array.from(this.items.values());
  }
  /**
   * Get items by category (equipment slot)
   */
  getByCategory(category) {
    const results = [];
    for (const item of this.items.values()) {
      if (item.equipment) {
        const slot = item.equipment.slot.toLowerCase();
        if (slot === category.toLowerCase()) {
          results.push(item);
        }
      }
    }
    return results;
  }
  /**
   * Search items by name (case insensitive partial match)
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];
    for (const item of this.items.values()) {
      if (item.name.toLowerCase().includes(lowerQuery)) {
        results.push(item);
      }
    }
    return results;
  }
  /**
   * Clear all items
   */
  clear() {
    this.items.clear();
    this.nameIndex.clear();
  }
  /**
   * Get number of registered items
   */
  size() {
    return this.items.size;
  }
  /**
   * Load default items (called by InventorySystem)
   */
  loadDefaults() {
    this.register({
      id: 1,
      name: "Bronze Sword",
      examine: "A bronze sword.",
      value: 15,
      weight: 2.2,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: "weapon",
        requirements: { attack: { level: 1, xp: 0 } },
        bonuses: {
          attackStab: 4,
          attackSlash: 5,
          attackCrush: -2,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 1,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 4,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        },
        weaponType: "sword" /* SWORD */,
        attackSpeed: 4
      },
      model: "bronze_sword",
      icon: "bronze_sword_icon"
    });
    this.register({
      id: 995,
      name: "Coins",
      examine: "Lovely money!",
      value: 1,
      weight: 0,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: "coins",
      icon: "coins_icon"
    });
    this.register({
      id: 317,
      name: "Raw Shrimp",
      examine: "Raw shrimp, needs cooking.",
      value: 1,
      weight: 0.1,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_shrimp",
      icon: "raw_shrimp_icon"
    });
    this.register({
      id: 327,
      name: "Raw Sardine",
      examine: "Raw sardine, needs cooking.",
      value: 2,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_sardine",
      icon: "raw_sardine_icon"
    });
    this.register({
      id: 335,
      name: "Raw Trout",
      examine: "Raw trout, needs cooking.",
      value: 10,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_trout",
      icon: "raw_trout_icon"
    });
    this.register({
      id: 315,
      name: "Shrimps",
      examine: "Some nicely cooked shrimps.",
      value: 5,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "shrimps",
      icon: "shrimps_icon"
    });
    this.register({
      id: 325,
      name: "Sardine",
      examine: "A nicely cooked sardine.",
      value: 8,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "sardine",
      icon: "sardine_icon"
    });
    this.register({
      id: 333,
      name: "Trout",
      examine: "A nicely cooked trout.",
      value: 25,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "trout",
      icon: "trout_icon"
    });
    this.register({
      id: 323,
      name: "Burnt Shrimp",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_shrimp",
      icon: "burnt_shrimp_icon"
    });
    this.register({
      id: 369,
      name: "Burnt Sardine",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.1,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_sardine",
      icon: "burnt_sardine_icon"
    });
    this.register({
      id: 343,
      name: "Burnt Trout",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_trout",
      icon: "burnt_trout_icon"
    });
    this.register({
      id: 526,
      name: "Bones",
      examine: "These would be good for prayer training.",
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "bones",
      icon: "bones_icon"
    });
    this.register({
      id: 341,
      name: "Raw Salmon",
      examine: "Raw salmon, needs cooking.",
      value: 15,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_salmon",
      icon: "raw_salmon_icon"
    });
    this.register({
      id: 339,
      name: "Salmon",
      examine: "A nicely cooked salmon.",
      value: 40,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "salmon",
      icon: "salmon_icon"
    });
    this.register({
      id: 347,
      name: "Burnt Salmon",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_salmon",
      icon: "burnt_salmon_icon"
    });
    this.register({
      id: 359,
      name: "Raw Tuna",
      examine: "Raw tuna, needs cooking.",
      value: 20,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_tuna",
      icon: "raw_tuna_icon"
    });
    this.register({
      id: 361,
      name: "Tuna",
      examine: "A nicely cooked tuna.",
      value: 50,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "tuna",
      icon: "tuna_icon"
    });
    this.register({
      id: 367,
      name: "Burnt Tuna",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_tuna",
      icon: "burnt_tuna_icon"
    });
    this.register({
      id: 377,
      name: "Raw Lobster",
      examine: "Raw lobster, needs cooking.",
      value: 100,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_lobster",
      icon: "raw_lobster_icon"
    });
    this.register({
      id: 379,
      name: "Lobster",
      examine: "A nicely cooked lobster.",
      value: 150,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "lobster",
      icon: "lobster_icon"
    });
    this.register({
      id: 381,
      name: "Burnt Lobster",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_lobster",
      icon: "burnt_lobster_icon"
    });
    this.register({
      id: 371,
      name: "Raw Swordfish",
      examine: "Raw swordfish, needs cooking.",
      value: 200,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_swordfish",
      icon: "raw_swordfish_icon"
    });
    this.register({
      id: 373,
      name: "Swordfish",
      examine: "A nicely cooked swordfish.",
      value: 300,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "swordfish",
      icon: "swordfish_icon"
    });
    this.register({
      id: 375,
      name: "Burnt Swordfish",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.6,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_swordfish",
      icon: "burnt_swordfish_icon"
    });
    this.register({
      id: 383,
      name: "Raw Shark",
      examine: "Raw shark, needs cooking.",
      value: 500,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_shark",
      icon: "raw_shark_icon"
    });
    this.register({
      id: 385,
      name: "Shark",
      examine: "A nicely cooked shark.",
      value: 800,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "shark",
      icon: "shark_icon"
    });
    this.register({
      id: 387,
      name: "Burnt Shark",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.8,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_shark",
      icon: "burnt_shark_icon"
    });
    this.register({
      id: 2138,
      name: "Raw Chicken",
      examine: "Raw chicken, needs cooking.",
      value: 3,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_chicken",
      icon: "raw_chicken_icon"
    });
    this.register({
      id: 2140,
      name: "Cooked Chicken",
      examine: "A nicely cooked chicken.",
      value: 8,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "cooked_chicken",
      icon: "cooked_chicken_icon"
    });
    this.register({
      id: 2142,
      name: "Burnt Chicken",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_chicken",
      icon: "burnt_chicken_icon"
    });
    this.register({
      id: 2132,
      name: "Raw Beef",
      examine: "Raw beef, needs cooking.",
      value: 3,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "raw_beef",
      icon: "raw_beef_icon"
    });
    this.register({
      id: 2134,
      name: "Cooked Beef",
      examine: "A nicely cooked beef.",
      value: 8,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "cooked_beef",
      icon: "cooked_beef_icon"
    });
    this.register({
      id: 2146,
      name: "Burnt Beef",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.3,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_beef",
      icon: "burnt_beef_icon"
    });
    this.register({
      id: 2307,
      name: "Bread Dough",
      examine: "Bread dough, ready for baking.",
      value: 5,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "bread_dough",
      icon: "bread_dough_icon"
    });
    this.register({
      id: 2309,
      name: "Bread",
      examine: "A nicely baked bread.",
      value: 12,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "bread",
      icon: "bread_icon"
    });
    this.register({
      id: 2311,
      name: "Burnt Bread",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.2,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_bread",
      icon: "burnt_bread_icon"
    });
    this.register({
      id: 1889,
      name: "Cake Mixture",
      examine: "Cake mixture, ready for baking.",
      value: 50,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "cake_mixture",
      icon: "cake_mixture_icon"
    });
    this.register({
      id: 1891,
      name: "Cake",
      examine: "A nicely baked cake.",
      value: 100,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "cake",
      icon: "cake_icon"
    });
    this.register({
      id: 1893,
      name: "Burnt Cake",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.5,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_cake",
      icon: "burnt_cake_icon"
    });
    this.register({
      id: 2003,
      name: "Stew Ingredients",
      examine: "Raw ingredients for stew.",
      value: 20,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "stew_ingredients",
      icon: "stew_ingredients_icon"
    });
    this.register({
      id: 2005,
      name: "Stew",
      examine: "A hearty stew.",
      value: 50,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: true,
      members: false,
      model: "stew",
      icon: "stew_icon"
    });
    this.register({
      id: 2007,
      name: "Burnt Stew",
      examine: "Burnt to a crisp.",
      value: 1,
      weight: 0.4,
      stackable: false,
      equipable: false,
      tradeable: false,
      members: false,
      model: "burnt_stew",
      icon: "burnt_stew_icon"
    });
  }
};

// src/rpg/systems/InventorySystem.ts
var InventorySystem = class extends System {
  constructor(world) {
    super(world);
    // Core management
    this.inventories = /* @__PURE__ */ new Map();
    // Configuration
    this.MAX_STACK_SIZE = 2147483647;
    // Max int32
    // Persistence
    this.pendingSaves = /* @__PURE__ */ new Set();
    this.itemRegistry = new ItemRegistry();
    this.equipmentCalculator = new EquipmentBonusCalculator(this.itemRegistry);
    this.itemRegistry.loadDefaults();
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    console.log("[InventorySystem] Initializing...");
    this.world.events.on("entity:created", (event) => {
      const entity = this.getEntity(event.entityId);
      if (entity && this.shouldHaveInventory(entity)) {
        this.createInventoryInternal(event.entityId);
      }
    });
    this.world.events.on("entity:destroyed", (event) => {
      this.inventories.delete(event.entityId);
    });
    this.world.events.on("player:connect", this.handlePlayerConnect.bind(this));
    this.world.events.on("player:disconnect", this.handlePlayerDisconnect.bind(this));
    this.startAutoSave();
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      this.savePendingInventories();
    }, 1e4);
  }
  /**
   * Handle player connect event
   */
  async handlePlayerConnect(data) {
    await this.loadPlayerInventory(data.playerId);
  }
  /**
   * Handle player disconnect event
   */
  async handlePlayerDisconnect(data) {
    await this.savePlayerInventory(data.playerId);
    this.pendingSaves.delete(data.playerId);
  }
  /**
   * Load player inventory from persistence
   */
  async loadPlayerInventory(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const items = await persistence.loadPlayerInventory(playerId);
      const equipment = await persistence.loadPlayerEquipment(playerId);
      let inventory = this.inventories.get(playerId);
      if (!inventory) {
        this.createInventoryInternal(playerId);
        inventory = this.inventories.get(playerId);
      }
      if (!inventory) return;
      inventory.items = new Array(inventory.maxSlots).fill(null);
      for (const item of items) {
        if (item.slot >= 0 && item.slot < inventory.maxSlots) {
          inventory.items[item.slot] = {
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: item.metadata
          };
        }
      }
      for (const equipItem of equipment) {
        const slot = equipItem.slot;
        const itemDef = this.itemRegistry.get(equipItem.itemId);
        if (itemDef && itemDef.equipment) {
          inventory.equipment[slot] = {
            ...itemDef,
            metadata: equipItem.metadata
          };
        }
      }
      this.updateWeight(inventory);
      this.updateEquipmentBonuses(inventory);
      console.log(`[InventorySystem] Loaded inventory for player ${playerId}`);
    } catch (error) {
      console.error(`[InventorySystem] Failed to load inventory for ${playerId}:`, error);
    }
  }
  /**
   * Save player inventory to persistence
   */
  async savePlayerInventory(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const inventory = this.inventories.get(playerId);
    if (!inventory) return;
    try {
      const items = [];
      for (let i = 0; i < inventory.items.length; i++) {
        const item = inventory.items[i];
        if (item) {
          items.push({
            slot: i,
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: item.metadata
          });
        }
      }
      const equipment = [];
      for (const [slot, equip] of Object.entries(inventory.equipment)) {
        if (equip) {
          equipment.push({
            slot,
            itemId: equip.id,
            metadata: equip.metadata
          });
        }
      }
      await persistence.savePlayerInventory(playerId, items);
      await persistence.savePlayerEquipment(playerId, equipment);
      console.log(`[InventorySystem] Saved inventory for player ${playerId}`);
    } catch (error) {
      console.error(`[InventorySystem] Failed to save inventory for ${playerId}:`, error);
    }
  }
  /**
   * Save all pending inventories
   */
  async savePendingInventories() {
    if (this.pendingSaves.size === 0) return;
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const toSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();
    for (const entityId of toSave) {
      const entity = this.getEntity(entityId);
      if (entity && entity.type === "player") {
        await this.savePlayerInventory(entityId);
      }
    }
  }
  /**
   * Mark entity for saving
   */
  markForSave(entityId) {
    this.pendingSaves.add(entityId);
  }
  /**
   * Update method
   */
  update(_delta) {
    for (const [_entityId, inventory] of Array.from(this.inventories)) {
      this.updateWeight(inventory);
    }
  }
  /**
   * Add item to entity inventory
   */
  addItem(entityId, itemId, quantity) {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return false;
    }
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const itemDef = this.itemRegistry.get(itemId);
    if (!itemDef) {
      return false;
    }
    if (itemDef.stackable) {
      const existingStack = inventory.items.find((stack) => stack?.itemId === itemId);
      if (existingStack) {
        existingStack.quantity += quantity;
        this.markForSave(entityId);
        return true;
      }
    }
    const freeSlot = inventory.items.findIndex((slot) => !slot);
    if (freeSlot === -1) {
      return false;
    }
    inventory.items[freeSlot] = {
      itemId,
      quantity
    };
    this.markForSave(entityId);
    return true;
  }
  /**
   * Remove item from inventory by slot
   */
  removeItem(entityId, slot, quantity) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return null;
    }
    const item = inventory.items[slot];
    if (!item) {
      return null;
    }
    const removeQuantity = quantity || item.quantity;
    if (removeQuantity >= item.quantity) {
      inventory.items[slot] = null;
      this.updateWeight(inventory);
      this.syncInventory(entityId);
      this.markForSave(entityId);
      this.world.events.emit("inventory:item-removed", {
        entityId,
        itemId: item.itemId,
        quantity: item.quantity,
        slot
      });
      return { ...item };
    } else {
      item.quantity -= removeQuantity;
      this.updateWeight(inventory);
      this.syncInventory(entityId);
      this.markForSave(entityId);
      this.world.events.emit("inventory:item-removed", {
        entityId,
        itemId: item.itemId,
        quantity: removeQuantity,
        slot
      });
      return {
        itemId: item.itemId,
        quantity: removeQuantity
      };
    }
  }
  /**
   * Remove item from inventory by item ID and quantity
   */
  removeItemById(entityId, itemId, quantity) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return false;
    }
    let remainingToRemove = quantity;
    for (let i = 0; i < inventory.items.length && remainingToRemove > 0; i++) {
      const item = inventory.items[i];
      if (item && item.itemId === itemId) {
        const toRemove = Math.min(item.quantity, remainingToRemove);
        if (toRemove === item.quantity) {
          inventory.items[i] = null;
        } else {
          item.quantity -= toRemove;
        }
        remainingToRemove -= toRemove;
        this.world.events.emit("inventory:item-removed", {
          entityId,
          itemId: item.itemId,
          quantity: toRemove,
          slot: i
        });
      }
    }
    this.updateWeight(inventory);
    this.syncInventory(entityId);
    if (remainingToRemove === 0) {
      this.markForSave(entityId);
    }
    return remainingToRemove === 0;
  }
  /**
   * Get the total quantity of a specific item in inventory
   */
  getItemQuantity(entityId, itemId) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      const entity = this.getEntity(entityId);
      if (entity) {
        const entityInventory = entity.getComponent("inventory");
        if (entityInventory) {
          let totalQuantity2 = 0;
          for (const item of entityInventory.items) {
            if (item && item.itemId === itemId) {
              totalQuantity2 += item.quantity;
            }
          }
          return totalQuantity2;
        }
      }
      return 0;
    }
    let totalQuantity = 0;
    for (const item of inventory.items) {
      if (item && item.itemId === itemId) {
        totalQuantity += item.quantity;
      }
    }
    return totalQuantity;
  }
  /**
   * Move item between slots
   */
  moveItem(entityId, fromSlot, toSlot) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return false;
    }
    if (fromSlot < 0 || fromSlot >= inventory.maxSlots || toSlot < 0 || toSlot >= inventory.maxSlots) {
      return false;
    }
    const fromItem = inventory.items[fromSlot] || null;
    const toItem = inventory.items[toSlot] || null;
    inventory.items[fromSlot] = toItem;
    inventory.items[toSlot] = fromItem;
    this.syncInventory(entityId);
    this.markForSave(entityId);
    this.world.events.emit("inventory:item-moved", {
      entityId,
      fromSlot,
      toSlot
    });
    return true;
  }
  /**
   * Equip item to slot
   */
  equipItem(entity, inventorySlot, equipmentSlot) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const stack = inventory.items[inventorySlot];
    if (!stack) {
      return false;
    }
    const itemDef = this.itemRegistry.get(stack.itemId);
    if (!itemDef || !itemDef.equipment) {
      return false;
    }
    if (itemDef.equipment.slot !== equipmentSlot) {
      return false;
    }
    const currentEquipped = inventory.equipment[equipmentSlot];
    if (currentEquipped) {
      this.unequipItem(entity, equipmentSlot);
    }
    const removedStack = this.removeFromSlot(inventory, inventorySlot, 1);
    if (!removedStack) {
      return false;
    }
    const equipment = {
      ...itemDef,
      metadata: stack.metadata
    };
    inventory.equipment[equipmentSlot] = equipment;
    this.syncEquipNetwork(entity, equipmentSlot, equipment);
    this.updateCombatBonuses(entity);
    this.markForSave(entity.data.id);
    this.world.events.emit("inventory:item-equipped", {
      entity,
      item: removedStack,
      slot: equipmentSlot
    });
    return true;
  }
  /**
   * Unequip item from slot
   */
  unequipItem(entity, slot) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const equipment = inventory.equipment[slot];
    if (!equipment) {
      return false;
    }
    if (!this.addItem(entity.data.id, equipment.id, 1)) {
      return false;
    }
    inventory.equipment[slot] = null;
    this.syncUnequipNetwork(entity, slot);
    this.updateCombatBonuses(entity);
    this.markForSave(entity.data.id);
    this.world.events.emit("inventory:item-unequipped", {
      entity,
      item: equipment,
      slot
    });
    return true;
  }
  /**
   * Drop item from inventory
   */
  dropItem(entity, slotIndex, quantity = 1) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const stack = inventory.items[slotIndex];
    if (!stack) {
      return false;
    }
    const droppedStack = this.removeFromSlot(inventory, slotIndex, quantity);
    if (!droppedStack) {
      return false;
    }
    const position = this.getEntityPosition(entity);
    if (!position) {
      this.addItem(entity.data.id, droppedStack.itemId, droppedStack.quantity);
      return false;
    }
    const droppedEntity = {
      id: `dropped_${Date.now()}_${Math.random()}`,
      type: "item",
      itemId: droppedStack.itemId,
      quantity: droppedStack.quantity,
      position: {
        x: position.x + (Math.random() - 0.5) * 2,
        y: position.y,
        z: position.z + (Math.random() - 0.5) * 2
      },
      droppedBy: entity.data.id,
      droppedAt: Date.now()
    };
    this.world.entities?.set(droppedEntity.id, droppedEntity);
    this.syncDropItemNetwork(entity, droppedStack, droppedEntity);
    this.markForSave(entity.data.id);
    this.world.events.emit("inventory:item-dropped", {
      entity,
      item: droppedStack,
      position,
      droppedEntity
    });
    return true;
  }
  /**
   * Get total weight
   */
  getWeight(entityId) {
    const inventory = this.inventories.get(entityId);
    return inventory ? inventory.totalWeight : 0;
  }
  /**
   * Get number of free slots
   */
  getFreeSlots(entityId) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return 0;
    }
    return inventory.items.filter((item) => item === null).length;
  }
  /**
   * Find item in inventory
   */
  findItem(entityId, itemId) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return null;
    }
    for (let i = 0; i < inventory.items.length; i++) {
      if (inventory.items[i]?.itemId === itemId) {
        return i;
      }
    }
    return null;
  }
  /**
   * Create inventory for entity (private helper)
   */
  createInventoryInternal(entityId) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const inventory = {
      type: "inventory",
      entity,
      data: {},
      items: new Array(28).fill(null),
      maxSlots: 28,
      equipment: {
        ["head" /* HEAD */]: null,
        ["cape" /* CAPE */]: null,
        ["amulet" /* AMULET */]: null,
        ["weapon" /* WEAPON */]: null,
        ["body" /* BODY */]: null,
        ["shield" /* SHIELD */]: null,
        ["legs" /* LEGS */]: null,
        ["gloves" /* GLOVES */]: null,
        ["boots" /* BOOTS */]: null,
        ["ring" /* RING */]: null,
        ["ammo" /* AMMO */]: null
      },
      totalWeight: 0,
      equipmentBonuses: {
        attackStab: 0,
        attackSlash: 0,
        attackCrush: 0,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 0,
        defenseSlash: 0,
        defenseCrush: 0,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0
      }
    };
    if ("addComponent" in entity && typeof entity.addComponent === "function") {
      entity.addComponent("inventory", inventory);
    }
    this.inventories.set(entityId, inventory);
  }
  /**
   * Find first free slot
   */
  findFreeSlot(inventory) {
    for (let i = 0; i < inventory.items.length; i++) {
      if (inventory.items[i] === null) {
        return i;
      }
    }
    return -1;
  }
  /**
   * Update total weight
   */
  updateWeight(inventory) {
    let totalWeight = 0;
    for (const item of inventory.items) {
      if (item) {
        const itemDef = this.itemRegistry.get(item.itemId);
        if (itemDef) {
          totalWeight += itemDef.weight * item.quantity;
        }
      }
    }
    for (const slot in inventory.equipment) {
      const equipped = inventory.equipment[slot];
      if (equipped) {
        totalWeight += equipped.weight;
      }
    }
    inventory.totalWeight = totalWeight;
  }
  /**
   * Update equipment bonuses
   */
  updateEquipmentBonuses(inventory) {
    inventory.equipmentBonuses = this.equipmentCalculator.calculateTotalBonuses(inventory.equipment);
    const entity = this.getEntityByInventory(inventory);
    if (entity) {
      const stats = entity.getComponent("stats");
      if (stats) {
        stats.combatBonuses = inventory.equipmentBonuses;
      }
    }
  }
  /**
   * Sync inventory to client
   */
  syncInventory(entityId) {
    const inventory = this.inventories.get(entityId);
    if (!inventory) {
      return;
    }
    const network = this.world.network;
    if (network) {
      network.send(entityId, "inventory:update", {
        items: inventory.items,
        equipment: inventory.equipment,
        weight: inventory.totalWeight,
        bonuses: inventory.equipmentBonuses
      });
    }
    this.world.events.emit("inventory:sync", {
      entityId,
      items: inventory.items,
      equipment: inventory.equipment,
      weight: inventory.totalWeight,
      bonuses: inventory.equipmentBonuses
    });
  }
  /**
   * Send message to entity
   */
  sendMessage(entityId, message) {
    this.world.events.emit("chat:system", {
      targetId: entityId,
      message
    });
  }
  /**
   * Public method to create inventory for an entity
   */
  createInventory(entityId) {
    this.createInventoryInternal(entityId);
    return this.inventories.get(entityId) || null;
  }
  /**
   * Check if entity should have inventory
   */
  shouldHaveInventory(entity) {
    if (entity.data?.type === "player" || entity.type === "player") {
      return true;
    }
    const npcComponent = entity.getComponent?.("npc");
    if (npcComponent && npcComponent.hasInventory) {
      return true;
    }
    return false;
  }
  /**
   * Get entity from world
   */
  getEntity(entityId) {
    if (this.world.entities.items instanceof Map) {
      const entity2 = this.world.entities.items.get(entityId);
      if (!entity2 || typeof entity2.getComponent !== "function") {
        return void 0;
      }
      return entity2;
    }
    const entity = this.world.entities.get?.(entityId);
    if (!entity || typeof entity.getComponent !== "function") {
      return void 0;
    }
    return entity;
  }
  /**
   * Get entity by inventory component
   */
  getEntityByInventory(inventory) {
    for (const [entityId, inv] of Array.from(this.inventories)) {
      if (inv === inventory) {
        return this.getEntity(entityId);
      }
    }
    return void 0;
  }
  /**
   * Create empty combat bonuses
   */
  createEmptyBonuses() {
    return {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };
  }
  /**
   * Register default items
   */
  registerDefaultItems() {
    this.itemRegistry.register({
      id: 1,
      name: "Coins",
      examine: "Lovely money!",
      value: 1,
      weight: 0,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: "coins.glb",
      icon: "coins.png"
    });
    this.itemRegistry.register({
      id: 1038,
      name: "Red partyhat",
      examine: "A nice hat from a cracker.",
      value: 1,
      weight: 0,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: "head" /* HEAD */,
        requirements: {},
        bonuses: this.createEmptyBonuses()
      },
      model: "red_partyhat.glb",
      icon: "red_partyhat.png"
    });
  }
  /**
   * Get entity position from movement component
   */
  getEntityPosition(entity) {
    const movement = entity.getComponent("movement");
    if (movement?.position) {
      return movement.position;
    }
    if (entity.position) {
      return entity.position;
    }
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    return null;
  }
  /**
   * Sync drop item over network
   */
  syncDropItemNetwork(entity, stack, droppedEntity) {
    const network = this.world.network;
    if (!network) {
      return;
    }
    const itemDef = this.itemRegistry.get(stack.itemId);
    network.broadcast("item_dropped", {
      entityId: entity.data.id,
      item: {
        id: stack.itemId,
        name: itemDef?.name || "Unknown item",
        quantity: stack.quantity
      },
      droppedEntityId: droppedEntity.id,
      position: droppedEntity.position
    });
  }
  /**
   * Sync equip item over network
   */
  syncEquipNetwork(entity, slot, equipment) {
    const network = this.world.network;
    if (!network) {
      return;
    }
    network.broadcast("item_equipped", {
      entityId: entity.data.id,
      slot,
      equipment: {
        id: equipment.id,
        name: equipment.name,
        bonuses: equipment.equipment?.bonuses
      }
    });
  }
  /**
   * Sync unequip item over network
   */
  syncUnequipNetwork(entity, slot) {
    const network = this.world.network;
    if (!network) {
      return;
    }
    network.broadcast("item_unequipped", {
      entityId: entity.data.id,
      slot
    });
  }
  /**
   * Update combat bonuses
   */
  updateCombatBonuses(entity) {
    const inventory = entity.getComponent("inventory");
    const stats = entity.getComponent("stats");
    if (!inventory || !stats) {
      return;
    }
    const bonuses = this.equipmentCalculator.calculateTotalBonuses(inventory.equipment);
    inventory.equipmentBonuses = bonuses;
    stats.combatBonuses = bonuses;
  }
  /**
   * Remove item from slot
   */
  removeFromSlot(inventory, slot, quantity) {
    const stack = inventory.items[slot];
    if (!stack || stack.quantity < quantity) {
      return null;
    }
    if (stack.quantity === quantity) {
      inventory.items[slot] = null;
      return stack;
    } else {
      stack.quantity -= quantity;
      return {
        itemId: stack.itemId,
        quantity
      };
    }
  }
  /**
   * Check if item can be equipped to slot
   */
  canEquipToSlot(itemStack, slot) {
    const itemDef = this.itemRegistry.get(itemStack.itemId);
    if (!itemDef || !itemDef.equipment) {
      return false;
    }
    const equipmentSlot = itemDef.equipment.slot;
    return equipmentSlot === slot;
  }
  /**
   * Add item to specific entity
   */
  addItemToEntity(entity, itemStack) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const freeSlot = inventory.items.findIndex((slot) => !slot);
    if (freeSlot === -1) {
      return false;
    }
    inventory.items[freeSlot] = itemStack;
    return true;
  }
};

// src/rpg/systems/quests/QuestDefinitions.ts
import tutorialQuest from "./tutorial_quest-2KHC4EQV.json";
import goblinMenace from "./goblin_menace-T42V2Y7O.json";
import sheepShearerJson from "./sheep_shearer-FUJK4XW4.json";
import impCatcher from "./imp_catcher-XUPJN6EY.json";
import doricQuest from "./doric_quest-EK4YFWM5.json";
import romeoAndJuliet from "./romeo_and_juliet-C4A6J3DD.json";
import restlessGhost from "./restless_ghost-44QCYPWF.json";
import witchsPotion from "./witchs_potion-OYEXAQ3J.json";
import ernestTheChicken from "./ernest_the_chicken-UFIMTUTU.json";
function convertJsonQuest(jsonQuest) {
  const objectives = [];
  const dialogue = {};
  jsonQuest.stages?.forEach((stage) => {
    stage.objectives?.forEach((obj) => {
      objectives.push({
        id: obj.type + "_" + stage.id,
        type: obj.type,
        description: obj.description || stage.description,
        target: obj.npcId || obj.itemId,
        quantity: obj.quantity,
        completed: false,
        hidden: obj.hidden
      });
    });
  });
  if (jsonQuest.stages?.length > 0) {
    const startStage = jsonQuest.stages[0];
    dialogue.start = {
      id: "start",
      speaker: jsonQuest.startNpc || "Quest Giver",
      text: startStage.objectives?.[0]?.dialogue || jsonQuest.description,
      choices: [
        { text: "I'll help!", nextNodeId: "accept" },
        { text: "Not right now.", nextNodeId: "decline" }
      ]
    };
    dialogue.accept = {
      id: "accept",
      speaker: jsonQuest.startNpc || "Quest Giver",
      text: "Great! " + jsonQuest.description,
      action: { type: "complete_objective", objectiveId: objectives[0]?.id }
    };
    dialogue.decline = {
      id: "decline",
      speaker: jsonQuest.startNpc || "Quest Giver",
      text: "Come back when you are ready."
    };
  }
  return {
    id: jsonQuest.id,
    name: jsonQuest.name,
    description: jsonQuest.description,
    lore: jsonQuest.description,
    difficulty: "novice" /* NOVICE */,
    requirements: [],
    objectives,
    dialogue,
    startNpcId: jsonQuest.startNpc || "quest_giver",
    experienceRewards: jsonQuest.rewards?.experience || {},
    itemRewards: jsonQuest.rewards?.items || [],
    coinReward: jsonQuest.rewards?.items?.find((i) => i.itemId === "coins")?.quantity || 0,
    questPoints: jsonQuest.rewards?.questPoints || 1,
    unlocks: jsonQuest.rewards?.unlocks || [],
    estimatedDuration: 30,
    membersOnly: false,
    category: "Story"
  };
}
var QUEST_DEFINITIONS = {
  // JSON quests
  tutorial_quest: convertJsonQuest(tutorialQuest),
  goblin_menace: convertJsonQuest(goblinMenace),
  sheep_shearer_json: convertJsonQuest(sheepShearerJson),
  imp_catcher: convertJsonQuest(impCatcher),
  doric_quest: convertJsonQuest(doricQuest),
  romeo_and_juliet: convertJsonQuest(romeoAndJuliet),
  restless_ghost: convertJsonQuest(restlessGhost),
  witchs_potion: convertJsonQuest(witchsPotion),
  ernest_the_chicken: convertJsonQuest(ernestTheChicken),
  // Original hardcoded quests
  cooks_assistant: {
    id: "cooks_assistant",
    name: "Cook's Assistant",
    description: "Help the Lumbridge cook prepare a cake for the Duke's birthday.",
    lore: "The cook in Lumbridge Castle is in a panic! The Duke's birthday is today and he needs to prepare a special cake, but he's missing some key ingredients.",
    difficulty: "novice" /* NOVICE */,
    requirements: [],
    objectives: [
      {
        id: "talk_to_cook",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to the Cook in Lumbridge Castle",
        target: "lumbridge_cook",
        completed: false
      },
      {
        id: "collect_milk",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Collect a bucket of milk",
        target: "bucket_of_milk",
        quantity: 1,
        completed: false
      },
      {
        id: "collect_egg",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Collect an egg",
        target: "egg",
        quantity: 1,
        completed: false
      },
      {
        id: "collect_flour",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Collect a pot of flour",
        target: "pot_of_flour",
        quantity: 1,
        completed: false
      },
      {
        id: "return_to_cook",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Return the ingredients to the Cook",
        target: "lumbridge_cook",
        completed: false,
        hidden: true
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "Cook",
        text: "Oh dear, oh dear! The Duke's birthday is today and I haven't even started baking his cake! I need milk, an egg, and flour. Could you help me gather them?",
        choices: [
          { text: "Yes, I'll help you!", nextNodeId: "accept" },
          { text: "Sorry, I'm too busy.", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "Cook",
        text: "Wonderful! I need a bucket of milk from a cow, an egg from a chicken, and a pot of flour from the wheat field. Please hurry!",
        action: { type: "complete_objective", objectiveId: "talk_to_cook" }
      },
      decline: {
        id: "decline",
        speaker: "Cook",
        text: "Oh... well, I understand you must be busy. Please come back if you change your mind!"
      },
      complete: {
        id: "complete",
        speaker: "Cook",
        text: "Perfect! You've brought everything I need. The Duke will be so pleased with his cake. Here's your reward!",
        action: { type: "complete_objective", objectiveId: "return_to_cook" }
      }
    },
    startNpcId: "lumbridge_cook",
    experienceRewards: {
      ["cooking" /* COOKING */]: 300
    },
    itemRewards: [{ itemId: "coins", quantity: 100 }],
    coinReward: 100,
    questPoints: 1,
    unlocks: ["cooking_tutorial"],
    estimatedDuration: 15,
    membersOnly: false,
    category: "Skill"
  },
  sheep_shearer: {
    id: "sheep_shearer",
    name: "Sheep Shearer",
    description: "Help Fred the Farmer collect wool from his sheep.",
    lore: "Fred the Farmer has lost his shears and needs help collecting wool from his sheep. It's shearing season and the sheep are getting uncomfortable!",
    difficulty: "novice" /* NOVICE */,
    requirements: [],
    objectives: [
      {
        id: "talk_to_fred",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to Fred the Farmer",
        target: "fred_farmer",
        completed: false
      },
      {
        id: "collect_wool",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Collect 20 balls of wool",
        target: "ball_of_wool",
        quantity: 20,
        completed: false
      },
      {
        id: "return_wool",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Return the wool to Fred",
        target: "fred_farmer",
        completed: false,
        hidden: true
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "Fred the Farmer",
        text: "Ah, perfect timing! I've lost my shears and my sheep desperately need shearing. Could you collect 20 balls of wool for me? You can shear the sheep in my field.",
        choices: [
          { text: "Sure, I'll help!", nextNodeId: "accept" },
          { text: "Not right now.", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "Fred the Farmer",
        text: "Excellent! My sheep are in the field behind me. Use shears on them to collect wool. Bring me 20 balls of wool when you're done!",
        action: { type: "complete_objective", objectiveId: "talk_to_fred" }
      },
      complete: {
        id: "complete",
        speaker: "Fred the Farmer",
        text: "Fantastic! That's exactly what I needed. My sheep look much more comfortable now. Here's some coin for your trouble!",
        action: { type: "complete_objective", objectiveId: "return_wool" }
      }
    },
    startNpcId: "fred_farmer",
    experienceRewards: {
      ["crafting" /* CRAFTING */]: 150
    },
    itemRewards: [{ itemId: "coins", quantity: 60 }],
    coinReward: 60,
    questPoints: 1,
    unlocks: ["spinning_wheel_access"],
    estimatedDuration: 20,
    membersOnly: false,
    category: "Skill"
  },
  knights_sword: {
    id: "knights_sword",
    name: "The Knight's Sword",
    description: "Help Sir Vyvin replace his lost ceremonial sword.",
    lore: "Sir Vyvin has lost his ceremonial sword and needs it replaced before the ceremony. The sword requires special blurite ore and advanced smithing techniques.",
    difficulty: "intermediate" /* INTERMEDIATE */,
    requirements: [{ type: "skill", skillType: "mining" /* MINING */, level: 10 }],
    objectives: [
      {
        id: "talk_to_vyvin",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to Sir Vyvin",
        target: "sir_vyvin",
        completed: false
      },
      {
        id: "learn_about_sword",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Learn about the sword from Reldo",
        target: "reldo",
        completed: false
      },
      {
        id: "mine_blurite",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Mine blurite ore",
        target: "blurite_ore",
        quantity: 2,
        completed: false
      },
      {
        id: "get_redberry_pie",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Get a redberry pie for Thurgo",
        target: "redberry_pie",
        quantity: 1,
        completed: false
      },
      {
        id: "talk_to_thurgo",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to Thurgo the dwarf smith",
        target: "thurgo",
        completed: false
      },
      {
        id: "return_sword",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Return the sword to Sir Vyvin",
        target: "sir_vyvin",
        completed: false,
        hidden: true
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "Sir Vyvin",
        text: "Oh dear! I've lost my ceremonial sword and the ceremony is tomorrow! It was made of blurite - a very special metal. Could you help me get it replaced?",
        choices: [
          { text: "Yes, I'll help you find a replacement.", nextNodeId: "accept" },
          { text: "Sorry, that sounds too difficult.", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "Sir Vyvin",
        text: "Thank you! The sword was made by an Imcando dwarf long ago. Perhaps Reldo in the palace library knows more about them.",
        action: { type: "complete_objective", objectiveId: "talk_to_vyvin" }
      }
    },
    startNpcId: "sir_vyvin",
    experienceRewards: {
      ["smithing" /* SMITHING */]: 12725
    },
    itemRewards: [],
    coinReward: 0,
    questPoints: 1,
    unlocks: ["blurite_smithing"],
    estimatedDuration: 45,
    membersOnly: false,
    category: "Skill"
  },
  dragon_slayer: {
    id: "dragon_slayer",
    name: "Dragon Slayer",
    description: "Prove yourself worthy by slaying the mighty dragon Elvarg.",
    lore: "The island of Crandor was once a thriving community, until the dragon Elvarg came and destroyed it. Now the dragon threatens the mainland. Can you defeat this ancient evil?",
    difficulty: "experienced" /* EXPERIENCED */,
    requirements: [
      { type: "level", combatLevel: 32 },
      { type: "quest", questId: "cooks_assistant" },
      { type: "quest", questId: "sheep_shearer" }
    ],
    objectives: [
      {
        id: "talk_to_guildmaster",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to the Champions Guild Guildmaster",
        target: "guildmaster",
        completed: false
      },
      {
        id: "find_map_pieces",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Find the three map pieces",
        target: "map_piece",
        quantity: 3,
        completed: false
      },
      {
        id: "get_antidragon_shield",
        type: "collect_items" /* COLLECT_ITEMS */,
        description: "Obtain an anti-dragon shield",
        target: "antidragon_shield",
        quantity: 1,
        completed: false
      },
      {
        id: "prepare_ship",
        type: "custom" /* CUSTOM */,
        description: "Prepare the ship to Crandor",
        completed: false
      },
      {
        id: "slay_elvarg",
        type: "kill_npcs" /* KILL_NPCS */,
        description: "Slay the dragon Elvarg",
        target: "elvarg",
        quantity: 1,
        completed: false
      },
      {
        id: "return_to_guildmaster",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Return to the Guildmaster",
        target: "guildmaster",
        completed: false,
        hidden: true
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "Guildmaster",
        text: "So, you think you're ready to face a dragon? Elvarg has terrorized these lands for years. If you can defeat her, you'll earn the right to wear rune plate mail!",
        choices: [
          { text: "Yes, I'm ready for the challenge!", nextNodeId: "accept" },
          { text: "A dragon? Maybe I should train more first...", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "Guildmaster",
        text: "Brave words! You'll need to find the map to Crandor - it was torn into three pieces for safety. You'll also need an anti-dragon shield. Good luck, adventurer!",
        action: { type: "complete_objective", objectiveId: "talk_to_guildmaster" }
      }
    },
    startNpcId: "guildmaster",
    experienceRewards: {
      ["strength" /* STRENGTH */]: 18650,
      ["defence" /* DEFENCE */]: 18650
    },
    itemRewards: [],
    coinReward: 0,
    questPoints: 2,
    unlocks: ["rune_platebody_wear", "green_dhide_body_wear"],
    estimatedDuration: 120,
    membersOnly: false,
    category: "Combat"
  },
  monkey_madness: {
    id: "monkey_madness",
    name: "Monkey Madness",
    description: "Go undercover as a monkey to infiltrate Ape Atoll.",
    lore: "The monkey colony on Ape Atoll has been acting strangely. King Narnode Shareen suspects they're planning something and needs you to investigate. But getting onto the island requires some very unusual methods...",
    difficulty: "master" /* MASTER */,
    requirements: [
      { type: "quest", questId: "knights_sword" },
      { type: "skill", skillType: "agility" /* AGILITY */, level: 40 },
      { type: "skill", skillType: "thieving" /* THIEVING */, level: 35 }
    ],
    objectives: [
      {
        id: "talk_to_narnode",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to King Narnode Shareen",
        target: "king_narnode",
        completed: false
      },
      {
        id: "infiltrate_ape_atoll",
        type: "custom" /* CUSTOM */,
        description: "Infiltrate Ape Atoll disguised as a monkey",
        completed: false
      },
      {
        id: "gather_intelligence",
        type: "custom" /* CUSTOM */,
        description: "Gather intelligence on the monkey plans",
        completed: false
      },
      {
        id: "escape_ape_atoll",
        type: "custom" /* CUSTOM */,
        description: "Escape from Ape Atoll",
        completed: false
      },
      {
        id: "report_to_narnode",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Report your findings to King Narnode",
        target: "king_narnode",
        completed: false
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "King Narnode Shareen",
        text: "Ah, a brave adventurer! I have a most unusual request. The monkeys on Ape Atoll have been acting suspiciously. I need someone to go undercover and investigate. Are you up for the challenge?",
        choices: [
          { text: "Undercover as a monkey? That sounds interesting!", nextNodeId: "accept" },
          { text: "That sounds completely insane.", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "King Narnode Shareen",
        text: "Excellent! It will be dangerous - the monkeys don't take kindly to intruders. But with the right disguise and careful planning, you might just pull it off!",
        action: { type: "complete_objective", objectiveId: "talk_to_narnode" }
      }
    },
    startNpcId: "king_narnode",
    experienceRewards: {
      ["attack" /* ATTACK */]: 35e3,
      ["defence" /* DEFENCE */]: 35e3,
      ["hitpoints" /* HITPOINTS */]: 35e3,
      ["strength" /* STRENGTH */]: 35e3
    },
    itemRewards: [{ itemId: "dragon_scimitar", quantity: 1 }],
    coinReward: 0,
    questPoints: 3,
    unlocks: ["dragon_weapons_wear", "ape_atoll_access"],
    estimatedDuration: 180,
    membersOnly: true,
    category: "Combat"
  },
  legends_quest: {
    id: "legends_quest",
    name: "Legends Quest",
    description: "Prove yourself worthy of joining the Legends Guild.",
    lore: "The ultimate test of a true adventurer. Deep in the jungles of Karamja lies an ancient civilization and powerful artifacts. Only the most skilled and experienced adventurers can hope to complete this quest.",
    difficulty: "grandmaster" /* GRANDMASTER */,
    requirements: [
      { type: "quest", questId: "dragon_slayer" },
      { type: "quest", questId: "monkey_madness" },
      { type: "skill", skillType: "attack" /* ATTACK */, level: 50 },
      { type: "skill", skillType: "strength" /* STRENGTH */, level: 50 },
      { type: "skill", skillType: "mining" /* MINING */, level: 52 },
      { type: "skill", skillType: "smithing" /* SMITHING */, level: 50 },
      { type: "skill", skillType: "magic" /* MAGIC */, level: 56 },
      { type: "skill", skillType: "prayer" /* PRAYER */, level: 42 },
      { type: "skill", skillType: "crafting" /* CRAFTING */, level: 50 },
      { type: "skill", skillType: "agility" /* AGILITY */, level: 50 },
      { type: "skill", skillType: "thieving" /* THIEVING */, level: 50 }
    ],
    objectives: [
      {
        id: "talk_to_legends_guard",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Talk to the Legends Guild guard",
        target: "legends_guard",
        completed: false
      },
      {
        id: "explore_kharazi_jungle",
        type: "reach_location" /* REACH_LOCATION */,
        description: "Explore the Kharazi Jungle",
        target: "kharazi_jungle",
        completed: false
      },
      {
        id: "complete_totem",
        type: "custom" /* CUSTOM */,
        description: "Complete the ancient totem",
        completed: false
      },
      {
        id: "defeat_demon",
        type: "kill_npcs" /* KILL_NPCS */,
        description: "Defeat the jungle demon",
        target: "jungle_demon",
        quantity: 1,
        completed: false
      },
      {
        id: "claim_reward",
        type: "talk_to_npc" /* TALK_TO_NPC */,
        description: "Claim your reward from the Legends Guild",
        target: "legends_guard",
        completed: false
      }
    ],
    dialogue: {
      start: {
        id: "start",
        speaker: "Legends Guild Guard",
        text: "Welcome, adventurer. You seek to join the Legends Guild? This is no simple task. You must venture into the dangerous Kharazi Jungle and prove your worth. Are you prepared for the ultimate challenge?",
        choices: [
          { text: "Yes, I'm ready to become a legend!", nextNodeId: "accept" },
          { text: "I need more time to prepare.", nextNodeId: "decline" }
        ]
      },
      accept: {
        id: "accept",
        speaker: "Legends Guild Guard",
        text: "Then let your legend begin! The jungle holds ancient secrets and terrible dangers. Only the worthy will return. May fortune favor you, adventurer!",
        action: { type: "complete_objective", objectiveId: "talk_to_legends_guard" }
      }
    },
    startNpcId: "legends_guard",
    experienceRewards: {
      ["attack" /* ATTACK */]: 7650,
      ["defence" /* DEFENCE */]: 7650,
      ["strength" /* STRENGTH */]: 7650,
      ["hitpoints" /* HITPOINTS */]: 7650
    },
    itemRewards: [{ itemId: "legends_cape", quantity: 1 }],
    coinReward: 0,
    questPoints: 4,
    unlocks: ["legends_guild_access", "dragon_sq_shield_make"],
    estimatedDuration: 300,
    membersOnly: true,
    category: "Combat"
  }
};
function getQuestDefinition(questId) {
  return QUEST_DEFINITIONS[questId] || null;
}
function canPlayerStartQuest(playerId, questId, getSkillLevel, isQuestCompleted, getCombatLevel) {
  const quest = getQuestDefinition(questId);
  if (!quest) {
    return false;
  }
  for (const requirement of quest.requirements) {
    switch (requirement.type) {
      case "skill":
        if (requirement.skillType && requirement.level) {
          if (getSkillLevel(playerId, requirement.skillType) < requirement.level) {
            return false;
          }
        }
        break;
      case "quest":
        if (requirement.questId && !isQuestCompleted(playerId, requirement.questId)) {
          return false;
        }
        break;
      case "level":
        if (requirement.combatLevel && getCombatLevel(playerId) < requirement.combatLevel) {
          return false;
        }
        break;
    }
  }
  return true;
}
function getAllAvailableQuests(playerId, getSkillLevel, isQuestCompleted, getCombatLevel) {
  return Object.values(QUEST_DEFINITIONS).filter(
    (quest) => !isQuestCompleted(playerId, quest.id) && canPlayerStartQuest(playerId, quest.id, getSkillLevel, isQuestCompleted, getCombatLevel)
  );
}

// src/rpg/systems/QuestSystem.ts
var QuestSystem = class extends System {
  constructor(world) {
    super(world);
    this.activeDialogues = /* @__PURE__ */ new Map();
    this.questJournal = /* @__PURE__ */ new Map();
    // Player quest journal entries
    // Persistence
    this.pendingSaves = /* @__PURE__ */ new Set();
  }
  async initialize() {
    console.log("[QuestSystem] Initializing...");
    this.world.events.on("player:joined", this.handlePlayerJoined.bind(this));
    this.world.events.on("quest:start", this.handleStartQuest.bind(this));
    this.world.events.on("quest:abandon", this.handleAbandonQuest.bind(this));
    this.world.events.on("quest:complete_objective", this.handleCompleteObjective.bind(this));
    this.world.events.on("quest:talk_to_npc", this.handleTalkToNpc.bind(this));
    this.world.events.on("quest:dialogue_choice", this.handleDialogueChoice.bind(this));
    this.world.events.on("quest:check_progress", this.handleCheckProgress.bind(this));
    this.world.events.on("quest:view_journal", this.handleViewJournal.bind(this));
    this.world.events.on("combat:npc_killed", this.handleNpcKilled.bind(this));
    this.world.events.on("inventory:item_added", this.handleItemCollected.bind(this));
    this.world.events.on("skills:level_up", this.handleSkillLevelUp.bind(this));
    this.world.events.on("player:location_reached", this.handleLocationReached.bind(this));
    this.world.events.on("inventory:item_used", this.handleItemUsed.bind(this));
    this.world.events.on("player:connect", this.handlePlayerConnect.bind(this));
    this.world.events.on("player:disconnect", this.handlePlayerDisconnect.bind(this));
    this.startAutoSave();
    console.log("[QuestSystem] Initialized with quest tracking and dialogue system");
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      this.savePendingQuests();
    }, 1e4);
  }
  /**
   * Handle player connect event
   */
  async handlePlayerConnect(data) {
    await this.loadPlayerQuests(data.playerId);
  }
  /**
   * Handle player disconnect event
   */
  async handlePlayerDisconnect(data) {
    await this.savePlayerQuests(data.playerId);
    this.pendingSaves.delete(data.playerId);
  }
  /**
   * Load player quests from persistence
   */
  async loadPlayerQuests(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const quests = await persistence.loadPlayerQuests(playerId);
      let entity = this.world.getEntityById(playerId);
      if (!entity) return;
      let questComponent = entity.getComponent("quest");
      if (!questComponent) {
        const newComponent = this.createQuestComponent(playerId);
        if (!newComponent) return;
        questComponent = newComponent;
      }
      for (const questData of quests) {
        if (questData.status === "completed") {
          if (!questComponent.completedQuests.includes(questData.questId)) {
            questComponent.completedQuests.push(questData.questId);
            const questDef = getQuestDefinition(questData.questId);
            if (questDef) {
              questComponent.questPoints += questDef.questPoints;
            }
          }
        } else if (questData.status === "started" || questData.status === "in_progress") {
          const progress = {
            questId: questData.questId,
            status: "in_progress" /* IN_PROGRESS */,
            objectives: questData.progress?.objectives || {},
            currentDialogueNode: questData.progress?.currentDialogueNode,
            startedAt: new Date(questData.startedAt || Date.now()).getTime(),
            completedAt: questData.completedAt ? new Date(questData.completedAt).getTime() : void 0
          };
          questComponent.activeQuests[questData.questId] = progress;
        }
      }
      console.log(`[QuestSystem] Loaded quests for player ${playerId}`);
    } catch (error) {
      console.error(`[QuestSystem] Failed to load quests for ${playerId}:`, error);
    }
  }
  /**
   * Save player quests to persistence
   */
  async savePlayerQuests(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const entity = this.world.getEntityById(playerId);
    if (!entity) return;
    const questComponent = entity.getComponent("quest");
    if (!questComponent) return;
    try {
      const quests = [];
      for (const [questId, progress] of Object.entries(questComponent.activeQuests)) {
        quests.push({
          questId,
          status: progress.status === "completed" /* COMPLETED */ ? "completed" : "in_progress",
          progress: {
            objectives: progress.objectives,
            currentDialogueNode: progress.currentDialogueNode
          },
          startedAt: new Date(progress.startedAt).toISOString(),
          completedAt: progress.completedAt ? new Date(progress.completedAt).toISOString() : void 0
        });
      }
      for (const questId of questComponent.completedQuests) {
        if (!questComponent.activeQuests[questId]) {
          quests.push({
            questId,
            status: "completed"
          });
        }
      }
      await persistence.savePlayerQuests(playerId, quests);
      console.log(`[QuestSystem] Saved quests for player ${playerId}`);
    } catch (error) {
      console.error(`[QuestSystem] Failed to save quests for ${playerId}:`, error);
    }
  }
  /**
   * Save all pending quests
   */
  async savePendingQuests() {
    if (this.pendingSaves.size === 0) return;
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const toSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();
    for (const playerId of toSave) {
      const entity = this.world.getEntityById(playerId);
      if (entity && entity.type === "player") {
        await this.savePlayerQuests(playerId);
      }
    }
  }
  /**
   * Mark player for saving
   */
  markForSave(playerId) {
    this.pendingSaves.add(playerId);
  }
  handlePlayerJoined(data) {
    const { entityId } = data;
    this.createQuestComponent(entityId);
  }
  createQuestComponent(entityId) {
    const entity = this.world.getEntityById(entityId);
    if (!entity) {
      return null;
    }
    const questComponent = {
      type: "quest",
      activeQuests: {},
      completedQuests: [],
      questPoints: 0,
      lastQuestActivity: Date.now()
    };
    entity.addComponent(questComponent);
    this.questJournal.set(entityId, {});
    return questComponent;
  }
  handleStartQuest(data) {
    const { playerId, questId } = data;
    this.startQuest(playerId, questId);
  }
  handleAbandonQuest(data) {
    const { playerId, questId } = data;
    this.abandonQuest(playerId, questId);
  }
  handleCompleteObjective(data) {
    const { playerId, questId, objectiveId } = data;
    this.completeObjective(playerId, questId, objectiveId);
  }
  handleTalkToNpc(data) {
    const { playerId, npcId } = data;
    this.handleNpcInteraction(playerId, npcId);
  }
  handleDialogueChoice(data) {
    const { playerId, choiceIndex } = data;
    this.processDialogueChoice(playerId, choiceIndex);
  }
  handleCheckProgress(data) {
    const { playerId, questId } = data;
    const progress = this.getQuestProgress(playerId, questId);
    this.world.events.emit("quest:progress_response", {
      playerId,
      questId,
      progress
    });
  }
  handleViewJournal(data) {
    const { playerId } = data;
    const journal = this.getQuestJournal(playerId);
    this.world.events.emit("quest:journal_response", {
      playerId,
      journal
    });
  }
  startQuest(playerId, questId) {
    const entity = this.world.getEntityById(playerId);
    const questDef = getQuestDefinition(questId);
    if (!entity || !questDef) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Quest not found"
      });
      return false;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Quest component not found"
      });
      return false;
    }
    if (questComponent.activeQuests[questId] || questComponent.completedQuests.includes(questId)) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Quest already started or completed"
      });
      return false;
    }
    if (!this.canPlayerStartQuest(playerId, questId)) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Quest requirements not met"
      });
      return false;
    }
    const objectives = {};
    questDef.objectives.forEach((obj) => {
      objectives[obj.id] = false;
    });
    const questProgress = {
      questId,
      status: "in_progress" /* IN_PROGRESS */,
      objectives,
      startedAt: Date.now()
    };
    questComponent.activeQuests[questId] = questProgress;
    questComponent.lastQuestActivity = Date.now();
    this.markForSave(playerId);
    this.addJournalEntry(playerId, questId, `Started quest: ${questDef.name}`);
    this.addJournalEntry(playerId, questId, questDef.description);
    if (questDef.startNpcId && questDef.dialogue.start) {
      this.startDialogue(playerId, questDef.startNpcId, questId, "start");
    }
    this.world.events.emit("quest:started", {
      playerId,
      questId,
      questName: questDef.name,
      difficulty: questDef.difficulty
    });
    return true;
  }
  abandonQuest(playerId, questId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return false;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent || !questComponent.activeQuests[questId]) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Quest not active"
      });
      return false;
    }
    delete questComponent.activeQuests[questId];
    questComponent.lastQuestActivity = Date.now();
    this.markForSave(playerId);
    this.activeDialogues.delete(playerId);
    this.addJournalEntry(playerId, questId, "Quest abandoned");
    this.world.events.emit("quest:abandoned", {
      playerId,
      questId
    });
    return true;
  }
  completeObjective(playerId, questId, objectiveId) {
    const entity = this.world.getEntityById(playerId);
    const questDef = getQuestDefinition(questId);
    if (!entity || !questDef) {
      return false;
    }
    const questComponent = entity.getComponent("quest");
    const questProgress = questComponent?.activeQuests[questId];
    if (!questProgress) {
      return false;
    }
    questProgress.objectives[objectiveId] = true;
    questComponent.lastQuestActivity = Date.now();
    this.markForSave(playerId);
    const objective = questDef.objectives.find((obj) => obj.id === objectiveId);
    if (objective) {
      this.addJournalEntry(playerId, questId, `\u2713 ${objective.description}`);
    }
    this.world.events.emit("quest:objective_completed", {
      playerId,
      questId,
      objectiveId,
      description: objective?.description
    });
    const allObjectivesComplete = questDef.objectives.every((obj) => questProgress.objectives[obj.id]);
    if (allObjectivesComplete) {
      this.completeQuest(playerId, questId);
    }
    return true;
  }
  completeQuest(playerId, questId) {
    const entity = this.world.getEntityById(playerId);
    const questDef = getQuestDefinition(questId);
    if (!entity || !questDef) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    const questProgress = questComponent.activeQuests[questId];
    if (!questProgress) {
      return;
    }
    questProgress.status = "completed" /* COMPLETED */;
    questProgress.completedAt = Date.now();
    questComponent.completedQuests.push(questId);
    delete questComponent.activeQuests[questId];
    questComponent.questPoints += questDef.questPoints;
    this.markForSave(playerId);
    this.giveQuestRewards(playerId, questDef);
    this.addJournalEntry(playerId, questId, `Quest completed! Gained ${questDef.questPoints} quest points.`);
    this.world.events.emit("quest:completed", {
      playerId,
      questId,
      questName: questDef.name,
      questPoints: questDef.questPoints,
      experienceRewards: questDef.experienceRewards,
      itemRewards: questDef.itemRewards,
      coinReward: questDef.coinReward,
      unlocks: questDef.unlocks
    });
  }
  giveQuestRewards(playerId, questDef) {
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    const skillsSystem = this.world.systems.find((s) => s.constructor.name === "EnhancedSkillsSystem");
    if (skillsSystem) {
      Object.entries(questDef.experienceRewards).forEach(([skill, xp]) => {
        ;
        skillsSystem.addExperience(playerId, skill, xp);
      });
    }
    if (inventorySystem) {
      questDef.itemRewards.forEach((reward) => {
        ;
        inventorySystem.addItem(playerId, reward.itemId, reward.quantity);
      });
      if (questDef.coinReward > 0) {
        ;
        inventorySystem.addItem(playerId, "coins", questDef.coinReward);
      }
    }
    questDef.unlocks.forEach((unlock) => {
      this.world.events.emit("quest:unlock", {
        playerId,
        unlock,
        questId: questDef.id
      });
    });
  }
  handleNpcInteraction(playerId, npcId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    for (const [questId, progress] of Object.entries(questComponent.activeQuests)) {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        continue;
      }
      const relevantObjective = questDef.objectives.find(
        (obj) => obj.type === "talk_to_npc" /* TALK_TO_NPC */ && obj.target === npcId && !progress.objectives[obj.id]
      );
      if (relevantObjective) {
        this.startDialogue(playerId, npcId, questId, "start");
        return;
      }
    }
    const availableQuests = Object.values(QUEST_DEFINITIONS).filter(
      (quest) => quest.startNpcId === npcId && !questComponent.completedQuests.includes(quest.id) && !questComponent.activeQuests[quest.id] && this.canPlayerStartQuest(playerId, quest.id)
    );
    if (availableQuests.length > 0) {
      const quest = availableQuests[0];
      this.startDialogue(playerId, npcId, quest.id, "start");
    }
  }
  startDialogue(playerId, npcId, questId, nodeId) {
    const questDef = getQuestDefinition(questId);
    if (!questDef || !questDef.dialogue[nodeId]) {
      return;
    }
    const dialogueState = {
      playerId,
      npcId,
      questId,
      currentNodeId: nodeId,
      context: {}
    };
    this.activeDialogues.set(playerId, dialogueState);
    const node = questDef.dialogue[nodeId];
    this.sendDialogue(playerId, node);
  }
  sendDialogue(playerId, node) {
    this.world.events.emit("quest:dialogue", {
      playerId,
      speaker: node.speaker,
      text: node.text,
      choices: node.choices || [],
      nodeId: node.id
    });
  }
  processDialogueChoice(playerId, choiceIndex) {
    const dialogueState = this.activeDialogues.get(playerId);
    if (!dialogueState) {
      return;
    }
    const questDef = getQuestDefinition(dialogueState.questId);
    if (!questDef) {
      return;
    }
    const currentNode = questDef.dialogue[dialogueState.currentNodeId];
    if (!currentNode || !currentNode.choices) {
      return;
    }
    const choice = currentNode.choices[choiceIndex];
    if (!choice) {
      return;
    }
    if (choice.condition && !choice.condition(playerId)) {
      this.world.events.emit("quest:error", {
        playerId,
        message: "Choice not available"
      });
      return;
    }
    const nextNode = questDef.dialogue[choice.nextNodeId];
    if (nextNode) {
      dialogueState.currentNodeId = choice.nextNodeId;
      if (nextNode.action) {
        this.executeDialogueAction(playerId, dialogueState.questId, nextNode.action);
      }
      this.sendDialogue(playerId, nextNode);
    } else {
      this.activeDialogues.delete(playerId);
    }
  }
  executeDialogueAction(playerId, questId, action) {
    switch (action.type) {
      case "complete_objective":
        if (action.objectiveId) {
          this.completeObjective(playerId, questId, action.objectiveId);
        }
        break;
      case "give_item":
        if (action.itemId && action.quantity) {
          const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
          if (inventorySystem) {
            ;
            inventorySystem.addItem(playerId, action.itemId, action.quantity);
          }
        }
        break;
      case "teleport":
        if (action.location) {
          this.world.events.emit("player:teleport", {
            playerId,
            location: action.location
          });
        }
        break;
    }
  }
  // Event handlers for objective completion
  handleNpcKilled(data) {
    const { killerId, npcId } = data;
    this.checkKillObjectives(killerId, npcId);
  }
  handleItemCollected(data) {
    const { playerId, itemId, quantity } = data;
    this.checkCollectionObjectives(playerId, itemId, quantity);
  }
  handleSkillLevelUp(data) {
    const { playerId, skill, newLevel } = data;
    this.checkSkillObjectives(playerId, skill, newLevel);
  }
  handleLocationReached(data) {
    const { playerId, locationId } = data;
    this.checkLocationObjectives(playerId, locationId);
  }
  handleItemUsed(data) {
    const { playerId, itemId } = data;
    this.checkItemUseObjectives(playerId, itemId);
  }
  checkKillObjectives(playerId, npcId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    Object.entries(questComponent.activeQuests).forEach(([questId, progress]) => {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        return;
      }
      questDef.objectives.forEach((obj) => {
        if (obj.type === "kill_npcs" /* KILL_NPCS */ && obj.target === npcId && !progress.objectives[obj.id]) {
          this.completeObjective(playerId, questId, obj.id);
        }
      });
    });
  }
  checkCollectionObjectives(playerId, itemId, quantity) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    Object.entries(questComponent.activeQuests).forEach(([questId, progress]) => {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        return;
      }
      questDef.objectives.forEach((obj) => {
        if (obj.type === "collect_items" /* COLLECT_ITEMS */ && obj.target === itemId && !progress.objectives[obj.id]) {
          const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
          if (inventorySystem) {
            const hasItems = inventorySystem.hasItem(playerId, itemId, obj.quantity || 1);
            if (hasItems) {
              this.completeObjective(playerId, questId, obj.id);
            }
          }
        }
      });
    });
  }
  checkSkillObjectives(playerId, skill, newLevel) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    Object.entries(questComponent.activeQuests).forEach(([questId, progress]) => {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        return;
      }
      questDef.objectives.forEach((obj) => {
        if (obj.type === "skill_level" /* SKILL_LEVEL */ && obj.skillType === skill && newLevel >= (obj.level || 1) && !progress.objectives[obj.id]) {
          this.completeObjective(playerId, questId, obj.id);
        }
      });
    });
  }
  checkLocationObjectives(playerId, locationId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    Object.entries(questComponent.activeQuests).forEach(([questId, progress]) => {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        return;
      }
      questDef.objectives.forEach((obj) => {
        if (obj.type === "reach_location" /* REACH_LOCATION */ && obj.target === locationId && !progress.objectives[obj.id]) {
          this.completeObjective(playerId, questId, obj.id);
        }
      });
    });
  }
  checkItemUseObjectives(playerId, itemId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const questComponent = entity.getComponent("quest");
    if (!questComponent) {
      return;
    }
    Object.entries(questComponent.activeQuests).forEach(([questId, progress]) => {
      const questDef = getQuestDefinition(questId);
      if (!questDef) {
        return;
      }
      questDef.objectives.forEach((obj) => {
        if (obj.type === "use_item" /* USE_ITEM */ && obj.target === itemId && !progress.objectives[obj.id]) {
          this.completeObjective(playerId, questId, obj.id);
        }
      });
    });
  }
  canPlayerStartQuest(playerId, questId) {
    const skillsSystem = this.world.systems.find((s) => s.constructor.name === "EnhancedSkillsSystem");
    const equipmentSystem = this.world.systems.find((s) => s.constructor.name === "EquipmentSystem");
    const getSkillLevel = (playerId2, skill) => {
      return skillsSystem ? skillsSystem.getSkillLevel(playerId2, skill) : 1;
    };
    const isQuestCompleted = (playerId2, questId2) => {
      return this.isQuestCompleted(playerId2, questId2);
    };
    const getCombatLevel = (playerId2) => {
      return equipmentSystem ? equipmentSystem.getCombatLevel(playerId2) : 3;
    };
    return canPlayerStartQuest(playerId, questId, getSkillLevel, isQuestCompleted, getCombatLevel);
  }
  addJournalEntry(playerId, questId, entry) {
    const playerJournal = this.questJournal.get(playerId) || {};
    if (!playerJournal[questId]) {
      playerJournal[questId] = [];
    }
    playerJournal[questId].push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${entry}`);
    this.questJournal.set(playerId, playerJournal);
  }
  // Public query methods
  getQuestProgress(playerId, questId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return null;
    }
    const questComponent = entity.getComponent("quest");
    return questComponent?.activeQuests[questId] || null;
  }
  isQuestCompleted(playerId, questId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return false;
    }
    const questComponent = entity.getComponent("quest");
    return questComponent?.completedQuests.includes(questId) || false;
  }
  getActiveQuests(playerId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return [];
    }
    const questComponent = entity.getComponent("quest");
    return questComponent ? Object.values(questComponent.activeQuests) : [];
  }
  getCompletedQuests(playerId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return [];
    }
    const questComponent = entity.getComponent("quest");
    return questComponent?.completedQuests || [];
  }
  getQuestPoints(playerId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return 0;
    }
    const questComponent = entity.getComponent("quest");
    return questComponent?.questPoints || 0;
  }
  getAvailableQuests(playerId) {
    const skillsSystem = this.world.systems.find((s) => s.constructor.name === "EnhancedSkillsSystem");
    const equipmentSystem = this.world.systems.find((s) => s.constructor.name === "EquipmentSystem");
    const getSkillLevel = (playerId2, skill) => {
      return skillsSystem ? skillsSystem.getSkillLevel(playerId2, skill) : 1;
    };
    const isQuestCompleted = (playerId2, questId) => {
      return this.isQuestCompleted(playerId2, questId);
    };
    const getCombatLevel = (playerId2) => {
      return equipmentSystem ? equipmentSystem.getCombatLevel(playerId2) : 3;
    };
    return getAllAvailableQuests(playerId, getSkillLevel, isQuestCompleted, getCombatLevel);
  }
  getQuestJournal(playerId) {
    return this.questJournal.get(playerId) || {};
  }
  getQuestComponent(playerId) {
    const entity = this.world.getEntityById(playerId);
    return entity ? entity.getComponent("quest") : null;
  }
  update(deltaTime) {
  }
  serialize() {
    return {
      activeDialogues: Object.fromEntries(this.activeDialogues),
      questJournal: Object.fromEntries(this.questJournal)
    };
  }
  deserialize(data) {
    if (data.activeDialogues) {
      this.activeDialogues = new Map(Object.entries(data.activeDialogues));
    }
    if (data.questJournal) {
      this.questJournal = new Map(Object.entries(data.questJournal));
    }
  }
};

// src/rpg/systems/SkillsSystem.ts
var SkillsSystem = class _SkillsSystem extends System {
  constructor(world) {
    super(world);
    this.xpTable = [];
    this.xpDrops = [];
    this.skillMilestones = /* @__PURE__ */ new Map();
    this.pendingSaves = /* @__PURE__ */ new Set();
    this.generateXPTable();
    this.setupSkillMilestones();
    this.setupEventListeners();
    this.startAutoSave();
  }
  static {
    this.MAX_LEVEL = 99;
  }
  static {
    this.MAX_XP = 2e8;
  }
  static {
    // 200M XP cap
    this.COMBAT_SKILLS = [
      "attack",
      "strength",
      "defense",
      "ranged",
      "magic",
      "hitpoints",
      "prayer"
    ];
  }
  setupEventListeners() {
    this.world.events.on("combat:kill", this.handleCombatKill.bind(this));
    this.world.events.on("skill:action", this.handleSkillAction.bind(this));
    this.world.events.on("quest:complete", this.handleQuestComplete.bind(this));
    this.world.events.on("player:disconnect", this.handlePlayerDisconnect.bind(this));
    this.world.events.on("player:connect", this.handlePlayerConnect.bind(this));
  }
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      this.savePendingSkills();
    }, 1e4);
  }
  update(_deltaTime) {
    const currentTime = Date.now();
    this.xpDrops = this.xpDrops.filter(
      (drop) => currentTime - drop.timestamp < 3e3
      // Keep for 3 seconds
    );
  }
  /**
   * Grant XP to a specific skill
   */
  grantXP(entityId, skill, amount) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const skillData = stats[skill];
    if (!skillData) {
      console.warn(`Skill ${skill} not found on entity ${entityId}`);
      return;
    }
    const modifiedAmount = this.calculateModifiedXP(entity, skill, amount);
    const oldXP = skillData.xp;
    const newXP = Math.min(oldXP + modifiedAmount, _SkillsSystem.MAX_XP);
    const actualGain = newXP - oldXP;
    if (actualGain <= 0) {
      return;
    }
    skillData.xp = newXP;
    const oldLevel = skillData.level;
    const newLevel = this.getLevelForXP(newXP);
    if (newLevel > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, newLevel);
    }
    if (_SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }
    this.updateTotalLevel(entity, stats);
    this.xpDrops.push({
      entityId,
      skill,
      amount: actualGain,
      timestamp: Date.now()
    });
    this.pendingSaves.add(entityId);
    this.world.events.emit("xp:gained", {
      entityId,
      skill,
      amount: actualGain,
      totalXP: newXP,
      level: skillData.level
    });
  }
  /**
   * Get the level for a given amount of XP
   */
  getLevelForXP(xp) {
    for (let level = _SkillsSystem.MAX_LEVEL; level >= 1; level--) {
      if (xp >= this.xpTable[level]) {
        return level;
      }
    }
    return 1;
  }
  /**
   * Get the XP required for a specific level
   */
  getXPForLevel(level) {
    if (level < 1) {
      return 0;
    }
    if (level > _SkillsSystem.MAX_LEVEL) {
      return this.xpTable[_SkillsSystem.MAX_LEVEL];
    }
    return this.xpTable[level];
  }
  /**
   * Get XP remaining to next level
   */
  getXPToNextLevel(skill) {
    if (skill.level >= _SkillsSystem.MAX_LEVEL) {
      return 0;
    }
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    return nextLevelXP - skill.xp;
  }
  /**
   * Get XP progress percentage to next level
   */
  getXPProgress(skill) {
    if (skill.level >= _SkillsSystem.MAX_LEVEL) {
      return 100;
    }
    const currentLevelXP = this.getXPForLevel(skill.level);
    const nextLevelXP = this.getXPForLevel(skill.level + 1);
    const progressXP = skill.xp - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;
    return progressXP / requiredXP * 100;
  }
  /**
   * Check if entity meets skill requirements
   */
  meetsRequirements(entity, requirements) {
    const stats = entity.getComponent("stats");
    if (!stats) {
      return false;
    }
    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const skillData = stats[skill];
      if (!skillData || skillData.level < requiredLevel) {
        return false;
      }
    }
    return true;
  }
  /**
   * Get combat level for an entity
   */
  getCombatLevel(stats) {
    const base = 0.25 * (stats.defense.level + stats.hitpoints.level + Math.floor(stats.prayer.level / 2));
    const melee = 0.325 * (stats.attack.level + stats.strength.level);
    const ranged = 0.325 * Math.floor(stats.ranged.level * 1.5);
    const magic = 0.325 * Math.floor(stats.magic.level * 1.5);
    return Math.floor(base + Math.max(melee, ranged, magic));
  }
  /**
   * Get total level (sum of all skill levels)
   */
  getTotalLevel(stats) {
    let total = 0;
    const skills = [
      "attack",
      "strength",
      "defense",
      "ranged",
      "magic",
      "prayer",
      "hitpoints",
      "mining",
      "smithing",
      "fishing",
      "cooking",
      "woodcutting",
      "firemaking",
      "crafting",
      "herblore",
      "agility",
      "thieving",
      "slayer",
      "farming",
      "runecrafting",
      "hunter",
      "construction"
    ];
    for (const skill of skills) {
      const skillData = stats[skill];
      if (skillData) {
        total += skillData.level;
      }
    }
    return total;
  }
  /**
   * Get total XP across all skills
   */
  getTotalXP(stats) {
    let total = 0;
    const skills = [
      "attack",
      "strength",
      "defense",
      "ranged",
      "magic",
      "prayer",
      "hitpoints",
      "mining",
      "smithing",
      "fishing",
      "cooking",
      "woodcutting",
      "firemaking",
      "crafting",
      "herblore",
      "agility",
      "thieving",
      "slayer",
      "farming",
      "runecrafting",
      "hunter",
      "construction"
    ];
    for (const skill of skills) {
      const skillData = stats[skill];
      if (skillData) {
        total += skillData.xp;
      }
    }
    return total;
  }
  /**
   * Reset a skill to level 1
   */
  resetSkill(entityId, skill) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const skillData = stats[skill];
    if (!skillData) {
      return;
    }
    skillData.level = 1;
    skillData.xp = 0;
    if (_SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }
    this.updateTotalLevel(entity, stats);
    this.world.events.emit("skill:reset", {
      entityId,
      skill
    });
  }
  /**
   * Set skill level directly (for admin commands)
   */
  setSkillLevel(entityId, skill, level) {
    if (level < 1 || level > _SkillsSystem.MAX_LEVEL) {
      console.warn(`Invalid level ${level} for skill ${skill}`);
      return;
    }
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const skillData = stats[skill];
    if (!skillData) {
      return;
    }
    const oldLevel = skillData.level;
    skillData.level = level;
    skillData.xp = this.getXPForLevel(level);
    if (level > oldLevel) {
      this.handleLevelUp(entity, skill, oldLevel, level);
    }
    if (_SkillsSystem.COMBAT_SKILLS.includes(skill)) {
      this.updateCombatLevel(entity, stats);
    }
    this.updateTotalLevel(entity, stats);
  }
  generateXPTable() {
    this.xpTable = [0, 0];
    for (let level = 2; level <= _SkillsSystem.MAX_LEVEL; level++) {
      const xp = Math.floor(level - 1 + 300 * Math.pow(2, (level - 1) / 7)) / 4;
      this.xpTable.push(Math.floor(this.xpTable[level - 1] + xp));
    }
  }
  setupSkillMilestones() {
    const commonMilestones = [
      { level: 50, name: "Halfway", message: "Halfway to mastery!" },
      { level: 92, name: "Half XP", message: "Halfway to 99 in XP!" },
      { level: 99, name: "Mastery", message: "Skill mastered!" }
    ];
    const skills = [
      "attack",
      "strength",
      "defense",
      "ranged",
      "magic",
      "prayer",
      "hitpoints",
      "mining",
      "smithing",
      "fishing",
      "cooking",
      "woodcutting",
      "firemaking",
      "crafting",
      "herblore",
      "agility",
      "thieving",
      "slayer",
      "farming",
      "runecrafting",
      "hunter",
      "construction"
    ];
    for (const skill of skills) {
      this.skillMilestones.set(skill, [...commonMilestones]);
    }
    const combatMilestones = this.skillMilestones.get("attack");
    combatMilestones.push(
      { level: 40, name: "Rune Weapons", message: "You can now wield rune weapons!" },
      { level: 60, name: "Dragon Weapons", message: "You can now wield dragon weapons!" }
    );
  }
  handleLevelUp(entity, skill, oldLevel, newLevel) {
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const skillData = stats[skill];
    skillData.level = newLevel;
    const milestones = this.skillMilestones.get(skill) || [];
    for (const milestone of milestones) {
      if (milestone.level > oldLevel && milestone.level <= newLevel) {
        this.world.events.emit("skill:milestone", {
          entityId: entity.id,
          skill,
          milestone
        });
      }
    }
    if (skill === "hitpoints") {
      const newMax = this.calculateMaxHitpoints(newLevel);
      stats.hitpoints.max = newMax;
      stats.hitpoints.current = newMax;
    }
    if (skill === "prayer") {
      const newMax = newLevel;
      stats.prayer.maxPoints = newMax;
    }
    this.world.events.emit("skill:levelup", {
      entityId: entity.id,
      skill,
      oldLevel,
      newLevel,
      totalLevel: stats.totalLevel
    });
  }
  calculateMaxHitpoints(level) {
    return 10 + level;
  }
  updateCombatLevel(entity, stats) {
    const oldCombatLevel = stats.combatLevel;
    const newCombatLevel = this.getCombatLevel(stats);
    if (newCombatLevel !== oldCombatLevel) {
      stats.combatLevel = newCombatLevel;
      this.world.events.emit("combat:levelChanged", {
        entityId: entity.id,
        oldLevel: oldCombatLevel,
        newLevel: newCombatLevel
      });
    }
  }
  updateTotalLevel(entity, stats) {
    const oldTotalLevel = stats.totalLevel;
    const newTotalLevel = this.getTotalLevel(stats);
    if (newTotalLevel !== oldTotalLevel) {
      stats.totalLevel = newTotalLevel;
      this.world.events.emit("total:levelChanged", {
        entityId: entity.id,
        oldLevel: oldTotalLevel,
        newLevel: newTotalLevel
      });
    }
  }
  calculateModifiedXP(entity, skill, baseXP) {
    let modifier = 1;
    const inventory = entity.getComponent("inventory");
    if (inventory && inventory.equipment) {
      if (inventory.equipment.amulet?.name === "wisdom_amulet") {
        modifier += 0.05;
      }
    }
    const eventsSystem = this.world.getSystem?.("events");
    if (eventsSystem && typeof eventsSystem.getActiveEvents === "function") {
      const activeEvents = eventsSystem.getActiveEvents() || [];
      for (const event of activeEvents) {
        if (event.type === "double_xp") {
          modifier *= 2;
        } else if (event.type === "bonus_xp" && event.skills?.includes(skill)) {
          modifier += event.bonusRate || 0.5;
        }
      }
    }
    return Math.floor(baseXP * modifier);
  }
  // Event handlers
  handleCombatKill(data) {
    const { attackerId, targetId, damageDealt, attackStyle } = data;
    const target = this.world.entities.get(targetId);
    if (!target) {
      return;
    }
    const targetStats = target.getComponent("stats");
    if (!targetStats) {
      return;
    }
    const baseXP = targetStats.hitpoints.max * 4;
    switch (attackStyle) {
      case "accurate":
        this.grantXP(attackerId, "attack", baseXP);
        break;
      case "aggressive":
        this.grantXP(attackerId, "strength", baseXP);
        break;
      case "defensive":
        this.grantXP(attackerId, "defense", baseXP);
        break;
      case "controlled":
        this.grantXP(attackerId, "attack", baseXP / 3);
        this.grantXP(attackerId, "strength", baseXP / 3);
        this.grantXP(attackerId, "defense", baseXP / 3);
        break;
      case "ranged":
        this.grantXP(attackerId, "ranged", baseXP);
        break;
      case "magic":
        this.grantXP(attackerId, "magic", baseXP);
        break;
    }
    this.grantXP(attackerId, "hitpoints", baseXP / 3);
  }
  handleSkillAction(data) {
    this.grantXP(data.entityId, data.skill, data.xp);
  }
  handleQuestComplete(data) {
    if (!data.rewards.xp) {
      return;
    }
    for (const [skill, xp] of Object.entries(data.rewards.xp)) {
      this.grantXP(data.playerId, skill, xp);
    }
  }
  // Public getters
  getXPDrops() {
    return [...this.xpDrops];
  }
  getSkillData(entityId, skill) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return null;
    }
    return stats[skill] || null;
  }
  /**
   * Load player skills from persistence
   */
  async loadPlayerSkills(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const skills = await persistence.loadPlayerSkills(playerId);
      const entity = this.world.entities.get(playerId);
      if (!entity) return;
      const stats = entity.getComponent("stats");
      if (!stats) return;
      for (const skillData of skills) {
        const skill = stats[skillData.type];
        if (skill) {
          skill.level = skillData.level;
          skill.xp = skillData.experience;
        }
      }
      this.updateCombatLevel(entity, stats);
      this.updateTotalLevel(entity, stats);
      console.log(`[SkillsSystem] Loaded skills for player ${playerId}`);
    } catch (error) {
      console.error(`[SkillsSystem] Failed to load skills for ${playerId}:`, error);
    }
  }
  /**
   * Save player skills to persistence
   */
  async savePlayerSkills(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const entity = this.world.entities.get(playerId);
    if (!entity) return;
    const stats = entity.getComponent("stats");
    if (!stats) return;
    try {
      const skills = [];
      const skillTypes = [
        "attack",
        "strength",
        "defense",
        "ranged",
        "magic",
        "prayer",
        "hitpoints",
        "mining",
        "smithing",
        "fishing",
        "cooking",
        "woodcutting",
        "firemaking",
        "crafting",
        "herblore",
        "agility",
        "thieving",
        "slayer",
        "farming",
        "runecrafting",
        "hunter",
        "construction"
      ];
      for (const skillType of skillTypes) {
        const skill = stats[skillType];
        if (skill) {
          skills.push({
            type: skillType,
            level: skill.level,
            experience: skill.xp
          });
        }
      }
      await persistence.savePlayerSkills(playerId, skills);
      console.log(`[SkillsSystem] Saved skills for player ${playerId}`);
    } catch (error) {
      console.error(`[SkillsSystem] Failed to save skills for ${playerId}:`, error);
    }
  }
  /**
   * Save all pending skill updates
   */
  async savePendingSkills() {
    if (this.pendingSaves.size === 0) return;
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const toSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();
    for (const entityId of toSave) {
      const entity = this.world.entities.get(entityId);
      if (entity && entity.type === "player") {
        await this.savePlayerSkills(entityId);
      }
    }
  }
  /**
   * Handle player connect event
   */
  async handlePlayerConnect(data) {
    await this.loadPlayerSkills(data.playerId);
  }
  /**
   * Handle player disconnect event
   */
  async handlePlayerDisconnect(data) {
    await this.savePlayerSkills(data.playerId);
    this.pendingSaves.delete(data.playerId);
  }
};

// src/rpg/systems/BankingSystem.ts
var BankingSystem = class _BankingSystem extends System {
  constructor(world) {
    super(world);
    // 5 minutes in milliseconds
    this.bankAccounts = /* @__PURE__ */ new Map();
    this.bankBooths = /* @__PURE__ */ new Set();
    this.playerBankOpen = /* @__PURE__ */ new Map();
    // Persistence
    this.pendingSaves = /* @__PURE__ */ new Set();
    this.itemRegistry = new ItemRegistry();
    this.itemRegistry.loadDefaults();
    this.initializeBankBooths();
    this.setupEventListeners();
    this.startAutoSave();
  }
  static {
    this.DEFAULT_BANK_SIZE = 816;
  }
  static {
    // 8 tabs * 102 slots per tab
    this.SLOTS_PER_TAB = 102;
  }
  static {
    this.DEFAULT_TABS = 8;
  }
  static {
    this.MAX_PIN_ATTEMPTS = 3;
  }
  static {
    this.PIN_LOCKOUT_TIME = 3e5;
  }
  setupEventListeners() {
    this.world.events.on("player:connect", this.handlePlayerConnect.bind(this));
    this.world.events.on("player:disconnect", this.handlePlayerDisconnect.bind(this));
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      this.savePendingBanks();
    }, 1e4);
  }
  /**
   * Handle player connect event
   */
  async handlePlayerConnect(data) {
    await this.loadPlayerBank(data.playerId);
  }
  /**
   * Handle player disconnect event
   */
  async handlePlayerDisconnect(data) {
    await this.savePlayerBank(data.playerId);
    this.pendingSaves.delete(data.playerId);
  }
  /**
   * Load player bank from persistence
   */
  async loadPlayerBank(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const bankItems = await persistence.loadPlayerBank(playerId);
      if (bankItems.length > 0) {
        const account = this.getOrCreateAccount(playerId);
        let usedSlots = 0;
        for (let tabIndex = 0; tabIndex < account.tabs.length; tabIndex++) {
          account.tabs[tabIndex].items.fill(null);
        }
        let currentTab = 0;
        let currentSlot = 0;
        for (const item of bankItems) {
          if (currentTab >= account.tabs.length) break;
          account.tabs[currentTab].items[currentSlot] = {
            itemId: item.itemId,
            quantity: item.quantity
          };
          usedSlots++;
          currentSlot++;
          if (currentSlot >= _BankingSystem.SLOTS_PER_TAB) {
            currentSlot = 0;
            currentTab++;
          }
        }
        account.usedSlots = usedSlots;
        console.log(`[BankingSystem] Loaded bank for player ${playerId} with ${usedSlots} items`);
      }
    } catch (error) {
      console.error(`[BankingSystem] Failed to load bank for ${playerId}:`, error);
    }
  }
  /**
   * Save player bank to persistence
   */
  async savePlayerBank(playerId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const account = this.bankAccounts.get(playerId);
    if (!account) return;
    try {
      const items = [];
      for (const tab of account.tabs) {
        for (const item of tab.items) {
          if (item) {
            items.push({
              itemId: item.itemId,
              quantity: item.quantity || 1
            });
          }
        }
      }
      await persistence.savePlayerBank(playerId, items);
      console.log(`[BankingSystem] Saved bank for player ${playerId} with ${items.length} items`);
    } catch (error) {
      console.error(`[BankingSystem] Failed to save bank for ${playerId}:`, error);
    }
  }
  /**
   * Save all pending banks
   */
  async savePendingBanks() {
    if (this.pendingSaves.size === 0) return;
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const toSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();
    for (const playerId of toSave) {
      if (this.bankAccounts.has(playerId)) {
        await this.savePlayerBank(playerId);
      }
    }
  }
  /**
   * Mark player for saving
   */
  markForSave(playerId) {
    this.pendingSaves.add(playerId);
  }
  initializeBankBooths() {
    this.bankBooths.add("bank_varrock_west");
    this.bankBooths.add("bank_varrock_east");
    this.bankBooths.add("bank_lumbridge");
    this.bankBooths.add("bank_falador_west");
    this.bankBooths.add("bank_falador_east");
    this.bankBooths.add("bank_edgeville");
  }
  registerBankBooth(boothId) {
    this.bankBooths.add(boothId);
  }
  getOrCreateAccount(playerId) {
    if (!this.bankAccounts.has(playerId)) {
      const tabs = [];
      for (let i = 0; i < _BankingSystem.DEFAULT_TABS; i++) {
        tabs.push({
          items: new Array(_BankingSystem.SLOTS_PER_TAB).fill(null),
          name: i === 0 ? "Main" : void 0
        });
      }
      this.bankAccounts.set(playerId, {
        playerId,
        tabs,
        pinAttempts: 0,
        totalSlots: _BankingSystem.DEFAULT_BANK_SIZE,
        usedSlots: 0
      });
    }
    return this.bankAccounts.get(playerId);
  }
  openBank(player, bankBoothId) {
    if (!this.bankBooths.has(bankBoothId)) {
      this.world.events.emit("bank:error", {
        playerId: player.id,
        error: "Invalid bank booth"
      });
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    if (account.pin && !this.isPinVerified(player.id)) {
      this.world.events.emit("bank:pin_required", {
        playerId: player.id
      });
      return false;
    }
    this.playerBankOpen.set(player.id, true);
    this.world.events.emit("bank:opened", {
      playerId: player.id,
      bankData: this.getBankData(account)
    });
    return true;
  }
  closeBank(player) {
    this.playerBankOpen.delete(player.id);
    this.world.events.emit("bank:closed", {
      playerId: player.id
    });
  }
  isBankOpen(playerId) {
    return this.playerBankOpen.get(playerId) || false;
  }
  depositItem(player, inventorySlot, quantity) {
    if (!this.isBankOpen(player.id)) {
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const item = inventory.items[inventorySlot];
    if (!item) {
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    const depositAmount = quantity || item.quantity || 1;
    const existingStack = this.findItemInBank(account, item.itemId);
    if (!existingStack && account.usedSlots >= account.totalSlots) {
      this.world.events.emit("bank:error", {
        playerId: player.id,
        error: "Bank is full"
      });
      return false;
    }
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (!inventorySystem) {
      return false;
    }
    const removed = inventorySystem.removeItem(player.id, inventorySlot, depositAmount);
    if (!removed) {
      return false;
    }
    if (existingStack) {
      existingStack.quantity = (existingStack.quantity || 1) + depositAmount;
    } else {
      for (const tab of account.tabs) {
        const emptyIndex = tab.items.findIndex((slot) => slot === null);
        if (emptyIndex !== -1) {
          tab.items[emptyIndex] = {
            itemId: item.itemId,
            quantity: depositAmount
          };
          account.usedSlots++;
          break;
        }
      }
    }
    this.markForSave(player.id);
    this.world.events.emit("bank:deposit", {
      playerId: player.id,
      itemId: item.itemId,
      quantity: depositAmount
    });
    return true;
  }
  depositAll(player) {
    if (!this.isBankOpen(player.id)) {
      return;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return;
    }
    for (let i = inventory.items.length - 1; i >= 0; i--) {
      if (inventory.items[i]) {
        this.depositItem(player, i);
      }
    }
  }
  withdrawItem(player, tabIndex, slotIndex, quantity) {
    if (!this.isBankOpen(player.id)) {
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    if (tabIndex < 0 || tabIndex >= account.tabs.length) {
      return false;
    }
    const tab = account.tabs[tabIndex];
    const item = tab.items[slotIndex];
    if (!item) {
      return false;
    }
    const withdrawAmount = Math.min(quantity || item.quantity || 1, item.quantity || 1);
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (!inventorySystem) {
      return false;
    }
    const added = inventorySystem.addItem(player.id, item.itemId, withdrawAmount);
    if (!added) {
      this.world.events.emit("bank:error", {
        playerId: player.id,
        error: "Inventory full"
      });
      return false;
    }
    if (item.quantity && item.quantity > withdrawAmount) {
      item.quantity -= withdrawAmount;
    } else {
      tab.items[slotIndex] = null;
      account.usedSlots--;
    }
    this.markForSave(player.id);
    this.world.events.emit("bank:withdraw", {
      playerId: player.id,
      itemId: item.itemId,
      quantity: withdrawAmount
    });
    return true;
  }
  withdrawAll(player, tabIndex, slotIndex) {
    if (!this.isBankOpen(player.id)) {
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    const tab = account.tabs[tabIndex];
    const item = tab.items[slotIndex];
    if (!item) {
      return false;
    }
    return this.withdrawItem(player, tabIndex, slotIndex, item.quantity);
  }
  searchBank(player, searchTerm) {
    const account = this.getOrCreateAccount(player.id);
    const results = [];
    const lowerSearch = searchTerm.toLowerCase();
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          if (item.itemId.toString().includes(lowerSearch)) {
            results.push({ ...item });
          }
        }
      }
    }
    return results;
  }
  moveItem(player, fromTab, fromSlot, toTab, toSlot) {
    if (!this.isBankOpen(player.id)) {
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    if (fromTab < 0 || fromTab >= account.tabs.length || toTab < 0 || toTab >= account.tabs.length || fromSlot < 0 || fromSlot >= _BankingSystem.SLOTS_PER_TAB || toSlot < 0 || toSlot >= _BankingSystem.SLOTS_PER_TAB) {
      return false;
    }
    const fromItem = account.tabs[fromTab].items[fromSlot];
    if (!fromItem) {
      return false;
    }
    const toItem = account.tabs[toTab].items[toSlot];
    account.tabs[fromTab].items[fromSlot] = toItem;
    account.tabs[toTab].items[toSlot] = fromItem;
    this.markForSave(player.id);
    this.world.events.emit("bank:item_moved", {
      playerId: player.id,
      fromTab,
      fromSlot,
      toTab,
      toSlot
    });
    return true;
  }
  setTabName(player, tabIndex, name) {
    if (!this.isBankOpen(player.id)) {
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    if (tabIndex < 0 || tabIndex >= account.tabs.length) {
      return false;
    }
    account.tabs[tabIndex].name = name.substring(0, 20);
    this.markForSave(player.id);
    this.world.events.emit("bank:tab_renamed", {
      playerId: player.id,
      tabIndex,
      name: account.tabs[tabIndex].name
    });
    return true;
  }
  // PIN Management
  setPin(player, pin) {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.world.events.emit("bank:error", {
        playerId: player.id,
        error: "PIN must be 4 digits"
      });
      return false;
    }
    const account = this.getOrCreateAccount(player.id);
    account.pin = pin;
    account.pinAttempts = 0;
    this.world.events.emit("bank:pin_set", {
      playerId: player.id
    });
    return true;
  }
  verifyPin(player, pin) {
    const account = this.getOrCreateAccount(player.id);
    if (!account.pin) {
      return true;
    }
    if (account.pinAttempts >= _BankingSystem.MAX_PIN_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - (account.lastPinAttempt || 0);
      if (timeSinceLastAttempt < _BankingSystem.PIN_LOCKOUT_TIME) {
        const remainingTime = Math.ceil((_BankingSystem.PIN_LOCKOUT_TIME - timeSinceLastAttempt) / 1e3);
        this.world.events.emit("bank:error", {
          playerId: player.id,
          error: `PIN locked. Try again in ${remainingTime} seconds`
        });
        return false;
      } else {
        account.pinAttempts = 0;
      }
    }
    if (pin === account.pin) {
      account.pinAttempts = 0;
      this.world.events.emit("bank:pin_verified", {
        playerId: player.id
      });
      return true;
    } else {
      account.pinAttempts++;
      account.lastPinAttempt = Date.now();
      const remainingAttempts = _BankingSystem.MAX_PIN_ATTEMPTS - account.pinAttempts;
      this.world.events.emit("bank:pin_failed", {
        playerId: player.id,
        remainingAttempts
      });
      return false;
    }
  }
  removePin(player, currentPin) {
    const account = this.getOrCreateAccount(player.id);
    if (!account.pin) {
      return true;
    }
    if (currentPin !== account.pin) {
      this.world.events.emit("bank:error", {
        playerId: player.id,
        error: "Incorrect PIN"
      });
      return false;
    }
    account.pin = void 0;
    account.pinAttempts = 0;
    this.world.events.emit("bank:pin_removed", {
      playerId: player.id
    });
    return true;
  }
  isPinVerified(_playerId) {
    return true;
  }
  // Helper methods
  findItemInBank(account, itemId) {
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item && item.itemId === itemId) {
          return item;
        }
      }
    }
    return null;
  }
  getBankData(account) {
    return {
      tabs: account.tabs.map((tab) => ({
        name: tab.name,
        items: tab.items
      })),
      usedSlots: account.usedSlots,
      totalSlots: account.totalSlots
    };
  }
  getBankValue(player) {
    const account = this.getOrCreateAccount(player.id);
    let totalValue = 0;
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          const itemDef = this.itemRegistry.get(item.itemId);
          if (itemDef) {
            const itemValue = Math.floor(itemDef.value * 0.6);
            totalValue += itemValue * (item.quantity || 1);
          }
        }
      }
    }
    return totalValue;
  }
  getTotalItems(player) {
    const account = this.getOrCreateAccount(player.id);
    let total = 0;
    for (const tab of account.tabs) {
      for (const item of tab.items) {
        if (item) {
          total += item.quantity || 1;
        }
      }
    }
    return total;
  }
  update(_deltaTime) {
  }
  serialize() {
    const data = {
      bankAccounts: {}
    };
    for (const [playerId, account] of Array.from(this.bankAccounts)) {
      data.bankAccounts[playerId] = {
        ...account,
        // Don't serialize PIN for security
        pin: account.pin ? "****" : void 0
      };
    }
    return data;
  }
  deserialize(data) {
    if (data.bankAccounts) {
      for (const [playerId, accountData] of Object.entries(data.bankAccounts)) {
        this.bankAccounts.set(playerId, accountData);
      }
    }
  }
  /**
   * Calculate bank value (for death costs)
   */
  calculateBankValue(entityId) {
    const bank = this.bankAccounts.get(entityId);
    if (!bank) {
      return 0;
    }
    let totalValue = 0;
    for (const tab of bank.tabs.values()) {
      for (const stack of tab.items) {
        if (stack) {
          const itemDef = this.itemRegistry.get(stack.itemId);
          if (itemDef) {
            const itemValue = Math.floor(itemDef.value * 0.6);
            totalValue += itemValue * stack.quantity;
          }
        }
      }
    }
    return totalValue;
  }
  /**
   * Get most valuable items (for death mechanics)
   */
  getMostValuableItems(entityId, count) {
    const bank = this.bankAccounts.get(entityId);
    if (!bank) {
      return [];
    }
    const itemValues = [];
    for (const tab of bank.tabs.values()) {
      for (const stack of tab.items) {
        if (stack) {
          const itemDef = this.itemRegistry.get(stack.itemId);
          if (itemDef) {
            const itemValue = Math.floor(itemDef.value * 0.6);
            itemValues.push({
              stack,
              value: itemValue * stack.quantity
            });
          }
        }
      }
    }
    itemValues.sort((a, b) => b.value - a.value);
    return itemValues.slice(0, count);
  }
};

// src/rpg/systems/TradingSystem.ts
var TradingSystem = class extends System {
  // tiles
  constructor(world) {
    super(world);
    this.tradeSessions = /* @__PURE__ */ new Map();
    this.playerTrades = /* @__PURE__ */ new Map();
    // playerId -> sessionId
    // Configuration
    this.TRADE_TIMEOUT = 3e5;
    // 5 minutes
    this.TRADE_SLOTS = 28;
    // Same as inventory
    this.MIN_TRADE_DISTANCE = 10;
  }
  /**
   * Initialize trade request
   */
  requestTrade(requesterId, targetId) {
    const requester = this.world.entities.get(requesterId);
    const target = this.world.entities.get(targetId);
    if (!requester || !target) {
      this.sendTradeMessage(requesterId, "Player not found.");
      return false;
    }
    if (this.playerTrades.has(requesterId)) {
      this.sendTradeMessage(requesterId, "You are already in a trade.");
      return false;
    }
    if (this.playerTrades.has(targetId)) {
      this.sendTradeMessage(requesterId, "That player is busy.");
      return false;
    }
    const distance = this.getDistance(requester, target);
    if (distance > this.MIN_TRADE_DISTANCE) {
      this.sendTradeMessage(requesterId, "You are too far away to trade.");
      return false;
    }
    const targetType = target.accountType;
    if (targetType === "ironman" || targetType === "hardcore_ironman") {
      this.sendTradeMessage(requesterId, "That player is an Iron Man and cannot trade.");
      return false;
    }
    this.world.events.emit("trade:request", {
      requesterId,
      targetId,
      timestamp: Date.now()
    });
    this.sendTradeMessage(targetId, `${requester.displayName || "Player"} wishes to trade with you.`);
    return true;
  }
  /**
   * Accept trade request
   */
  acceptTradeRequest(accepterId, requesterId) {
    if (this.playerTrades.has(accepterId) || this.playerTrades.has(requesterId)) {
      return false;
    }
    const sessionId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      player1Id: requesterId,
      player2Id: accepterId,
      offer1: {
        playerId: requesterId,
        items: new Array(this.TRADE_SLOTS).fill(null),
        goldAmount: 0,
        accepted: false
      },
      offer2: {
        playerId: accepterId,
        items: new Array(this.TRADE_SLOTS).fill(null),
        goldAmount: 0,
        accepted: false
      },
      status: "first_screen",
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };
    this.tradeSessions.set(sessionId, session);
    this.playerTrades.set(requesterId, sessionId);
    this.playerTrades.set(accepterId, sessionId);
    this.world.events.emit("trade:started", {
      sessionId,
      player1Id: requesterId,
      player2Id: accepterId
    });
    return true;
  }
  /**
   * Add item to trade offer
   */
  offerItem(playerId, inventorySlot, quantity) {
    const sessionId = this.playerTrades.get(playerId);
    if (!sessionId) {
      return false;
    }
    const session = this.tradeSessions.get(sessionId);
    if (!session || session.status !== "first_screen") {
      return false;
    }
    const player = this.world.entities.get(playerId);
    const inventory = player?.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const item = inventory.items[inventorySlot];
    if (!item) {
      return false;
    }
    const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
    const emptySlot = offer.items.findIndex((item2) => item2 === null);
    if (emptySlot === -1) {
      this.sendTradeMessage(playerId, "Your trade offer is full.");
      return false;
    }
    const offerQuantity = Math.min(quantity || item.quantity, item.quantity);
    const itemDef = this.getItemDefinition(item.itemId);
    if (!itemDef || !itemDef.tradeable) {
      this.sendTradeMessage(playerId, "This item cannot be traded.");
      return false;
    }
    offer.items[emptySlot] = {
      itemId: item.itemId,
      quantity: offerQuantity
    };
    session.offer1.accepted = false;
    session.offer2.accepted = false;
    session.lastUpdate = Date.now();
    this.notifyTradeUpdate(session);
    return true;
  }
  /**
   * Remove item from trade offer
   */
  removeOfferItem(playerId, tradeSlot) {
    const sessionId = this.playerTrades.get(playerId);
    if (!sessionId) {
      return false;
    }
    const session = this.tradeSessions.get(sessionId);
    if (!session || session.status !== "first_screen") {
      return false;
    }
    const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
    if (!offer.items[tradeSlot]) {
      return false;
    }
    offer.items[tradeSlot] = null;
    session.offer1.accepted = false;
    session.offer2.accepted = false;
    session.lastUpdate = Date.now();
    this.notifyTradeUpdate(session);
    return true;
  }
  /**
   * Accept current trade screen
   */
  acceptTrade(playerId) {
    const sessionId = this.playerTrades.get(playerId);
    if (!sessionId) {
      return false;
    }
    const session = this.tradeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    if (session.status === "first_screen") {
      const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
      offer.accepted = true;
      if (session.offer1.accepted && session.offer2.accepted) {
        session.status = "second_screen";
        session.offer1.accepted = false;
        session.offer2.accepted = false;
        session.lastUpdate = Date.now();
        this.world.events.emit("trade:second_screen", {
          sessionId: session.id
        });
      }
    } else if (session.status === "second_screen") {
      const offer = session.player1Id === playerId ? session.offer1 : session.offer2;
      offer.accepted = true;
      if (session.offer1.accepted && session.offer2.accepted) {
        return this.completeTrade(session);
      }
    }
    this.notifyTradeUpdate(session);
    return true;
  }
  /**
   * Cancel trade
   */
  cancelTrade(playerId) {
    const sessionId = this.playerTrades.get(playerId);
    if (!sessionId) {
      return false;
    }
    const session = this.tradeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    this.playerTrades.delete(session.player1Id);
    this.playerTrades.delete(session.player2Id);
    this.tradeSessions.delete(sessionId);
    this.world.events.emit("trade:cancelled", {
      sessionId: session.id,
      cancelledBy: playerId
    });
    this.sendTradeMessage(session.player1Id, "Trade cancelled.");
    this.sendTradeMessage(session.player2Id, "Trade cancelled.");
    return true;
  }
  /**
   * Complete the trade
   */
  completeTrade(session) {
    const player1 = this.world.entities.get(session.player1Id);
    const player2 = this.world.entities.get(session.player2Id);
    if (!player1 || !player2) {
      this.cancelTrade(session.player1Id);
      return false;
    }
    if (!this.verifyTradeSpace(player1, session.offer2) || !this.verifyTradeSpace(player2, session.offer1)) {
      this.sendTradeMessage(session.player1Id, "Not enough inventory space.");
      this.sendTradeMessage(session.player2Id, "Not enough inventory space.");
      return false;
    }
    if (!this.verifyTradeItems(player1, session.offer1) || !this.verifyTradeItems(player2, session.offer2)) {
      this.sendTradeMessage(session.player1Id, "Trade items no longer available.");
      this.sendTradeMessage(session.player2Id, "Trade items no longer available.");
      this.cancelTrade(session.player1Id);
      return false;
    }
    this.exchangeItems(player1, player2, session.offer1, session.offer2);
    this.playerTrades.delete(session.player1Id);
    this.playerTrades.delete(session.player2Id);
    this.tradeSessions.delete(session.id);
    this.world.events.emit("trade:completed", {
      sessionId: session.id,
      player1Id: session.player1Id,
      player2Id: session.player2Id
    });
    this.sendTradeMessage(session.player1Id, "Trade successful.");
    this.sendTradeMessage(session.player2Id, "Trade successful.");
    return true;
  }
  /**
   * Verify player has space for incoming items
   */
  verifyTradeSpace(player, incomingOffer) {
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const emptySlots = inventory.items.filter((item) => item === null).length;
    let requiredSlots = 0;
    for (const item of incomingOffer.items) {
      if (!item) {
        continue;
      }
      const itemDef = this.getItemDefinition(item.itemId);
      if (!itemDef) {
        continue;
      }
      if (!itemDef.stackable) {
        requiredSlots++;
      } else {
        const existing = inventory.items.find((i) => i?.itemId === item.itemId);
        if (!existing) {
          requiredSlots++;
        }
      }
    }
    return emptySlots >= requiredSlots;
  }
  /**
   * Verify player has the items they're offering
   */
  verifyTradeItems(player, offer) {
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    for (const offeredItem of offer.items) {
      if (!offeredItem) {
        continue;
      }
      let found = 0;
      for (const invItem of inventory.items) {
        if (invItem?.itemId === offeredItem.itemId) {
          found += invItem.quantity;
        }
      }
      if (found < offeredItem.quantity) {
        return false;
      }
    }
    return true;
  }
  /**
   * Exchange items between players
   */
  exchangeItems(player1, player2, offer1, offer2) {
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return;
    }
    for (const item of offer1.items) {
      if (!item) {
        continue;
      }
      inventorySystem.removeItem(player1.id, item.itemId, item.quantity);
      inventorySystem.addItem(player2.id, item.itemId, item.quantity);
    }
    for (const item of offer2.items) {
      if (!item) {
        continue;
      }
      inventorySystem.removeItem(player2.id, item.itemId, item.quantity);
      inventorySystem.addItem(player1.id, item.itemId, item.quantity);
    }
  }
  /**
   * Update loop - clean up expired trades
   */
  update(_delta) {
    const now = Date.now();
    for (const [_sessionId, session] of this.tradeSessions) {
      if (now - session.lastUpdate > this.TRADE_TIMEOUT) {
        this.cancelTrade(session.player1Id);
      }
    }
  }
  /**
   * Helper methods
   */
  getDistance(entity1, entity2) {
    const pos1 = entity1.position;
    const pos2 = entity2.position;
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  getItemDefinition(itemId) {
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return null;
    }
    return inventorySystem.itemRegistry?.getItem(itemId);
  }
  sendTradeMessage(playerId, message) {
    this.world.events.emit("chat:system", {
      playerId,
      message,
      type: "trade"
    });
  }
  notifyTradeUpdate(session) {
    this.world.events.emit("trade:updated", {
      sessionId: session.id,
      status: session.status,
      offer1: session.offer1,
      offer2: session.offer2
    });
  }
  /**
   * Get active trade session for player
   */
  getTradeSession(playerId) {
    const sessionId = this.playerTrades.get(playerId);
    if (!sessionId) {
      return null;
    }
    return this.tradeSessions.get(sessionId) || null;
  }
  /**
   * Check if player is in trade
   */
  isTrading(playerId) {
    return this.playerTrades.has(playerId);
  }
};

// src/rpg/systems/NavigationSystem.ts
var NavigationSystem = class extends System {
  // distance to consider "arrived"
  constructor(world) {
    super(world);
    this.activePaths = /* @__PURE__ */ new Map();
    this.DEFAULT_SPEED = 2;
    // units per second
    this.ARRIVAL_THRESHOLD = 0.5;
  }
  async init(_options) {
    console.log("[NavigationSystem] Initializing...");
  }
  /**
   * Navigate entity to destination
   */
  navigateTo(request) {
    const { _entityId, destination, speed = this.DEFAULT_SPEED, callback } = request;
    if (!_entityId || typeof _entityId !== "string") {
      console.error(`[NavigationSystem] Invalid entity ID: ${_entityId}`);
      if (callback) {
        callback();
      }
      return;
    }
    if (!destination || typeof destination.x !== "number" || typeof destination.y !== "number" || typeof destination.z !== "number") {
      console.error(`[NavigationSystem] Invalid destination for entity ${_entityId}:`, destination);
      if (callback) {
        callback();
      }
      return;
    }
    const entity = this.getEntity(_entityId);
    if (!entity) {
      console.error(`[NavigationSystem] Entity ${_entityId} not found`);
      if (callback) {
        callback();
      }
      return;
    }
    const currentPosition = entity.position || entity.data?.position;
    if (!currentPosition) {
      console.warn(`[NavigationSystem] Entity ${_entityId} has no position`);
      return;
    }
    const startPos = Array.isArray(currentPosition) ? { x: currentPosition[0] || 0, y: currentPosition[1] || 0, z: currentPosition[2] || 0 } : currentPosition;
    const waypoints = [startPos, destination];
    const path2 = {
      _entityId,
      waypoints,
      currentWaypoint: 1,
      // Start moving to waypoint 1 (destination)
      speed,
      arrived: false,
      callback
    };
    this.activePaths.set(_entityId, path2);
    console.log(
      `[NavigationSystem] Entity ${_entityId} navigating to [${destination.x}, ${destination.y}, ${destination.z}]`
    );
  }
  /**
   * Update navigation paths
   */
  fixedUpdate(delta) {
    const deltaSeconds = delta / 1e3;
    for (const [_entityId, path2] of this.activePaths) {
      if (path2.arrived) {
        continue;
      }
      this.updatePath(path2, deltaSeconds);
    }
    for (const [_entityId, path2] of this.activePaths) {
      if (path2.arrived) {
        this.activePaths.delete(_entityId);
      }
    }
  }
  /**
   * Update a single navigation path
   */
  updatePath(path2, deltaSeconds) {
    const entity = this.getEntity(path2._entityId);
    if (!entity) {
      path2.arrived = true;
      return;
    }
    const currentPosition = entity.position || entity.data?.position;
    if (!currentPosition) {
      path2.arrived = true;
      return;
    }
    const currentPos = Array.isArray(currentPosition) ? { x: currentPosition[0] || 0, y: currentPosition[1] || 0, z: currentPosition[2] || 0 } : currentPosition;
    const targetWaypoint = path2.waypoints[path2.currentWaypoint];
    if (!targetWaypoint) {
      path2.arrived = true;
      if (path2.callback) {
        path2.callback();
      }
      return;
    }
    const direction = {
      x: targetWaypoint.x - currentPos.x,
      y: targetWaypoint.y - currentPos.y,
      z: targetWaypoint.z - currentPos.z
    };
    const distance = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (distance <= this.ARRIVAL_THRESHOLD) {
      path2.currentWaypoint++;
      if (path2.currentWaypoint >= path2.waypoints.length) {
        path2.arrived = true;
        console.log(`[NavigationSystem] Entity ${path2._entityId} arrived at destination`);
        if (path2.callback) {
          path2.callback();
        }
        return;
      }
      return;
    }
    const normalizedDirection = {
      x: direction.x / distance,
      y: direction.y / distance,
      z: direction.z / distance
    };
    const moveDistance = path2.speed * deltaSeconds;
    const actualMoveDistance = Math.min(moveDistance, distance);
    const newPosition = {
      x: currentPos.x + normalizedDirection.x * actualMoveDistance,
      y: currentPos.y + normalizedDirection.y * actualMoveDistance,
      z: currentPos.z + normalizedDirection.z * actualMoveDistance
    };
    if (entity.position) {
      entity.position = newPosition;
    } else if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        entity.data.position = [newPosition.x, newPosition.y, newPosition.z];
      } else {
        entity.data.position = newPosition;
      }
    }
    if (entity.node) {
      entity.node.position.set(newPosition.x, newPosition.y, newPosition.z);
    }
  }
  /**
   * Stop navigation for entity
   */
  stopNavigation(_entityId) {
    const path2 = this.activePaths.get(_entityId);
    if (path2) {
      path2.arrived = true;
      console.log(`[NavigationSystem] Stopped navigation for entity ${_entityId}`);
    }
  }
  /**
   * Check if entity is currently navigating
   */
  isNavigating(_entityId) {
    if (!_entityId || typeof _entityId !== "string") {
      console.warn(`[NavigationSystem] isNavigating called with invalid _entityId: ${_entityId}`);
      return false;
    }
    const path2 = this.activePaths.get(_entityId);
    return path2 ? !path2.arrived : false;
  }
  /**
   * Get distance between two positions
   */
  getDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /**
   * Get entity by ID with comprehensive fallback strategies
   */
  getEntity(_entityId) {
    if (!_entityId) {
      console.error("[NavigationSystem] getEntity called with undefined/null _entityId");
      return void 0;
    }
    if (this.world.entities?.items) {
      const testEntity = this.world.entities.items.get(_entityId);
      if (testEntity) {
        return testEntity;
      }
    }
    if (this.world.entities?.get) {
      const prodEntity = this.world.entities.get(_entityId);
      if (prodEntity && typeof prodEntity.getComponent === "function") {
        return prodEntity;
      }
    }
    if (this.world.entityManager?.entities) {
      const managerEntity = this.world.entityManager.entities.get(_entityId);
      if (managerEntity) {
        return managerEntity;
      }
    }
    if (this.world[_entityId]) {
      const directEntity = this.world[_entityId];
      if (directEntity && (directEntity.position || directEntity.data?.position)) {
        return directEntity;
      }
    }
    console.warn(`[NavigationSystem] Entity ${_entityId} not found in any storage strategy`);
    return void 0;
  }
  destroy() {
    this.activePaths.clear();
    super.destroy();
  }
};

// src/rpg/systems/loot/LootTableManager.ts
var LootTableManager = class {
  constructor() {
    this.lootTables = /* @__PURE__ */ new Map();
  }
  /**
   * Register a loot table
   */
  register(table) {
    this.lootTables.set(table.id, table);
    console.log(`[LootTableManager] Registered loot table: ${table.name}`);
  }
  /**
   * Get a loot table by ID
   */
  get(id) {
    return this.lootTables.get(id);
  }
  /**
   * Check if a loot table exists
   */
  has(id) {
    return this.lootTables.has(id);
  }
  /**
   * Get all registered loot tables
   */
  getAll() {
    return Array.from(this.lootTables.values());
  }
  /**
   * Remove a loot table
   */
  remove(id) {
    return this.lootTables.delete(id);
  }
  /**
   * Clear all loot tables
   */
  clear() {
    this.lootTables.clear();
  }
  /**
   * Get the count of registered loot tables
   */
  get size() {
    return this.lootTables.size;
  }
};

// src/rpg/systems/loot/DropCalculator.ts
var DropCalculator = class {
  /**
   * Calculate drops from a loot table
   */
  calculateDrops(lootTable, _killer) {
    const drops = [];
    for (const drop of lootTable.drops) {
      if (drop.rarity === "always") {
        drops.push(this.createDrop(drop));
      }
    }
    const regularDrops = lootTable.drops.filter((d) => d.rarity !== "always");
    if (regularDrops.length > 0) {
      const rolled = this.rollWeightedDrop(regularDrops);
      if (rolled) {
        drops.push(this.createDrop(rolled));
      }
    }
    if (lootTable.rareDropTable && Math.random() < 0.01) {
      console.log("[DropCalculator] Rare drop table access!");
    }
    return drops;
  }
  /**
   * Roll for a weighted drop
   */
  rollWeightedDrop(drops) {
    const totalWeight = drops.reduce((sum, drop) => sum + drop.weight, 0);
    if (totalWeight === 0) {
      return null;
    }
    let roll = Math.random() * totalWeight;
    for (const drop of drops) {
      roll -= drop.weight;
      if (roll <= 0) {
        if (this.checkRarity(drop.rarity)) {
          return drop;
        }
        break;
      }
    }
    return null;
  }
  /**
   * Check if rarity roll succeeds
   */
  checkRarity(rarity) {
    const rarityChances = {
      common: 1,
      uncommon: 0.25,
      rare: 0.05,
      very_rare: 0.01,
      ultra_rare: 1e-3
    };
    const chance = rarityChances[rarity] || 1;
    return Math.random() < chance;
  }
  /**
   * Create a drop with rolled quantity
   */
  createDrop(template) {
    return {
      itemId: template.itemId,
      quantity: template.quantity,
      weight: template.weight,
      rarity: template.rarity
    };
  }
  /**
   * Roll quantity within range (for future use with range-based drops)
   */
  // private rollQuantity(range: { min: number; max: number }): number {
  //   if (range.min === range.max) return range.min;
  //   return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  // }
  /**
   * Apply drop modifiers (e.g., ring of wealth)
   */
  applyModifiers(drops, killer) {
    if (!killer) {
      return drops;
    }
    const stats = killer.getComponent("stats");
    if (!stats) {
      return drops;
    }
    return this.applyDropModifiers(drops, killer);
  }
  /**
   * Apply drop modifiers (ring of wealth, etc.)
   */
  applyDropModifiers(drops, killer) {
    if (killer) {
      const hasRingOfWealth = this.hasRingOfWealth(killer);
      if (hasRingOfWealth) {
        drops = drops.filter((drop) => drop.itemId !== 0);
        drops = drops.map((drop) => {
          const isRareDrop = this.isRareDrop(drop.itemId);
          if (isRareDrop) {
            if (Math.random() < 0.1) {
              return {
                ...drop,
                quantity: drop.quantity + Math.floor(Math.random() * 2) + 1
              };
            }
          }
          return drop;
        });
      }
      const hasLootingEnchant = this.hasLootingEnchantment(killer);
      if (hasLootingEnchant) {
        drops = drops.map((drop) => ({
          ...drop,
          quantity: Math.floor(drop.quantity * 1.2)
          // 20% increase
        }));
      }
    }
    return drops;
  }
  /**
   * Check if player has ring of wealth equipped
   */
  hasRingOfWealth(entity) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const ring = inventory.equipment?.ring;
    return ring && (ring.name === "Ring of wealth" || ring.name === "Ring of wealth (i)");
  }
  /**
   * Check if player has looting enchantment
   */
  hasLootingEnchantment(entity) {
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const weapon = inventory.equipment?.weapon;
    return weapon && weapon.enchantments?.includes("looting");
  }
  /**
   * Check if item is considered a rare drop
   */
  isRareDrop(itemId) {
    const rareItems = [
      1249,
      // Dragon spear
      4087,
      // Dragon platelegs
      4585,
      // Dragon plateskirt
      11840,
      // Dragon boots
      6571,
      // Uncut onyx
      2577
      // Ranger boots
      // Add more rare item IDs
    ];
    return rareItems.includes(itemId);
  }
};

// src/rpg/systems/LootSystem.ts
var LootSystem = class extends System {
  // Performance limit
  constructor(world) {
    super(world);
    // Core management
    this.lootDrops = /* @__PURE__ */ new Map();
    // Configuration
    this.LOOT_DESPAWN_TIME = 12e4;
    // 2 minutes
    this.LOOT_VISIBLE_TIME = 6e4;
    // 1 minute private, then public
    this.MAX_DROPS_PER_AREA = 100;
    this.lootTableManager = new LootTableManager();
    this.dropCalculator = new DropCalculator();
    this.itemRegistry = new ItemRegistry();
    this.itemRegistry.loadDefaults();
    this.registerDefaultLootTables();
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    console.log("[LootSystem] Initializing...");
    this.world.events.on("entity:death", (event) => {
      this.handleEntityDeath(event.entityId, event.killerId);
    });
    this.world.events.on("inventory:item-dropped", (event) => {
      this.handleItemDrop(event);
    });
    this.world.events.on("player:pickup", (event) => {
      this.handlePickupAttempt(event.playerId, event.lootId);
    });
  }
  /**
   * Update method
   */
  update(_delta) {
    const now = Date.now();
    for (const [lootId, loot] of Array.from(this.lootDrops)) {
      if (now - loot.spawnTime > this.LOOT_DESPAWN_TIME) {
        this.despawnLoot(lootId);
        continue;
      }
      if (loot.owner && now - loot.spawnTime > this.LOOT_VISIBLE_TIME) {
        loot.owner = null;
        this.syncLoot(lootId);
      }
    }
    this.enforceDropLimit();
  }
  /**
   * Handle entity death and generate loot
   */
  async handleEntityDeath(entityId, killerId) {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return;
    }
    const lootTableId = this.getLootTableId(entity);
    if (!lootTableId) {
      return;
    }
    const lootTable = this.lootTableManager.get(lootTableId);
    if (!lootTable) {
      return;
    }
    const itemDrops = this.generateDrops(entityId);
    if (itemDrops.length === 0) {
      return;
    }
    const drops = itemDrops.map((drop) => ({
      itemId: drop.itemId,
      quantity: drop.quantity,
      weight: 100,
      rarity: "common"
    }));
    const position = entity.data.position || { x: 0, y: 0, z: 0 };
    const vector3Position = Array.isArray(position) ? { x: position[0] || 0, y: position[1] || 0, z: position[2] || 0 } : position;
    await this.createLootDrop({
      position: vector3Position,
      items: drops,
      owner: killerId,
      source: entityId
    });
  }
  /**
   * Handle manual item drop
   */
  async handleItemDrop(event) {
    await this.createLootDrop({
      position: event.position,
      items: [
        {
          itemId: event.itemId,
          quantity: event.quantity,
          weight: 100,
          rarity: "always"
        }
      ],
      owner: event.entityId,
      source: event.entityId
    });
  }
  /**
   * Create loot drop in world
   */
  async createLootDrop(config) {
    const stackedItems = this.stackItems(config.items);
    const lootId = `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const lootComponent = {
      type: "loot",
      entity: null,
      // Loot doesn't have an entity yet
      data: {},
      items: stackedItems,
      owner: config.owner,
      spawnTime: Date.now(),
      position: config.position,
      source: config.source
    };
    this.lootDrops.set(lootId, lootComponent);
    const lootEntity = {
      id: lootId,
      type: "loot",
      position: config.position,
      items: stackedItems,
      owner: config.owner,
      spawnTime: Date.now(),
      source: config.source,
      getComponent: (type) => {
        if (type === "loot") {
          return lootComponent;
        }
        return null;
      }
    };
    if (this.world.entities.items instanceof Map) {
      this.world.entities.items.set(lootId, lootEntity);
    } else if (this.world.entities.set) {
      this.world.entities.set(lootId, lootEntity);
    }
    this.world.events.emit("loot:spawned", {
      lootId,
      position: config.position,
      owner: config.owner,
      items: stackedItems
    });
    for (let i = 0; i < stackedItems.length; i++) {
      const item = stackedItems[i];
      if (!item) {
        continue;
      }
      const dropPosition = {
        x: config.position.x + (Math.random() - 0.5) * 2,
        y: config.position.y,
        z: config.position.z + (Math.random() - 0.5) * 2
      };
      this.world.events.emit("loot:dropped", {
        position: dropPosition,
        itemId: item.itemId,
        quantity: item.quantity,
        owner: config.owner,
        ownershipTimer: config.owner ? 6e4 : 0,
        despawnTimer: 18e4
      });
    }
    console.log(`[LootSystem] Created loot drop with ${stackedItems.length} items`);
  }
  /**
   * Handle pickup attempt
   */
  async handlePickupAttempt(playerId, lootId) {
    const loot = this.lootDrops.get(lootId);
    const player = this.getEntity(playerId);
    const lootEntity = this.getEntity(lootId);
    if (!loot || !player || !lootEntity) {
      return;
    }
    if (loot.owner && loot.owner !== playerId) {
      const now = Date.now();
      if (now - loot.spawnTime < this.LOOT_VISIBLE_TIME) {
        this.sendMessage(playerId, "This loot belongs to another player.");
        return;
      }
    }
    const distance = this.calculateDistance(player, lootEntity);
    if (distance > 2) {
      this.sendMessage(playerId, "You're too far away to pick that up.");
      return;
    }
    const inventorySystem = this.getInventorySystem();
    if (!inventorySystem) {
      return;
    }
    const pickedUp = [];
    const remaining = [];
    for (const item of loot.items) {
      const added = await inventorySystem.addItem(playerId, item.itemId, item.quantity);
      if (added) {
        pickedUp.push(item);
      } else {
        remaining.push(item);
      }
    }
    if (remaining.length === 0) {
      this.despawnLoot(lootId);
    } else {
      loot.items = remaining;
      this.syncLoot(lootId);
    }
    if (pickedUp.length > 0) {
      const itemNames = pickedUp.map((item) => `${item.quantity}x ${this.getItemName(item.itemId)}`).join(", ");
      this.sendMessage(playerId, `You picked up: ${itemNames}`);
    }
    this.emit("loot:pickup", {
      playerId,
      lootId,
      items: pickedUp
    });
  }
  /**
   * Despawn loot
   */
  despawnLoot(lootId) {
    const loot = this.lootDrops.get(lootId);
    if (!loot) {
      return;
    }
    this.lootDrops.delete(lootId);
    this.world.events.emit("loot:despawned", {
      lootId,
      reason: "timeout"
    });
  }
  /**
   * Stack similar items
   */
  stackItems(items) {
    if (!items || !Array.isArray(items)) {
      return [];
    }
    const stacked = {};
    for (const item of items) {
      const existing = stacked[item.itemId];
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        stacked[item.itemId] = { ...item };
      }
    }
    return Object.values(stacked);
  }
  /**
   * Get loot table ID for entity
   */
  getLootTableId(entity) {
    const npc = entity.getComponent("npc");
    if (npc) {
      if (npc.lootTable) {
        return npc.lootTable;
      }
      if (npc.dropTable) {
        return npc.dropTable;
      }
    }
    switch (entity.data.type) {
      case "npc":
        return `${entity.data.name?.toLowerCase().replace(/\s+/g, "_")}_drops`;
      default:
        return null;
    }
  }
  /**
   * Get loot model based on items
   */
  // private getLootModel(items: LootDrop[]): string {
  //   // Priority: coins > equipment > resources > default
  //   if (items.some(item => item.itemId === 1)) { // Coins
  //     return 'loot_coins.glb';
  //   }
  //   if (items.some(item => item.itemId > 1000)) { // Equipment IDs
  //     return 'loot_equipment.glb';
  //   }
  //   return 'loot_default.glb';
  // }
  /**
   * Get item name
   */
  getItemName(itemId) {
    const names = {
      1: "Coins",
      1038: "Red partyhat"
      // Add more...
    };
    return names[itemId] || `Item ${itemId}`;
  }
  /**
   * Enforce drop limit per area
   */
  enforceDropLimit() {
    if (this.lootDrops.size <= this.MAX_DROPS_PER_AREA) {
      return;
    }
    const drops = Array.from(this.lootDrops.entries()).sort((a, b) => a[1].spawnTime - b[1].spawnTime);
    const toRemove = drops.slice(0, drops.length - this.MAX_DROPS_PER_AREA);
    for (const [lootId] of toRemove) {
      this.despawnLoot(lootId);
    }
  }
  /**
   * Sync loot state to clients
   */
  syncLoot(lootId) {
    const loot = this.lootDrops.get(lootId);
    if (!loot) {
      return;
    }
    this.emit("loot:sync", {
      lootId,
      owner: loot.owner,
      items: loot.items
    });
  }
  /**
   * Calculate distance between entities
   */
  calculateDistance(entity1, entity2) {
    const pos1Raw = entity1.data.position || { x: 0, y: 0, z: 0 };
    const pos2Raw = entity2.data.position || { x: 0, y: 0, z: 0 };
    const pos1 = Array.isArray(pos1Raw) ? { x: pos1Raw[0] || 0, y: pos1Raw[1] || 0, z: pos1Raw[2] || 0 } : pos1Raw;
    const pos2 = Array.isArray(pos2Raw) ? { x: pos2Raw[0] || 0, y: pos2Raw[1] || 0, z: pos2Raw[2] || 0 } : pos2Raw;
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /**
   * Get entity from world
   */
  getEntity(entityId) {
    const entity = this.world.entities.items.get(entityId);
    if (!entity || typeof entity.getComponent !== "function") {
      return void 0;
    }
    return entity;
  }
  /**
   * Get inventory system
   */
  getInventorySystem() {
    return this.world.systems.find((s) => s.constructor.name === "InventorySystem");
  }
  /**
   * Send message to player
   */
  sendMessage(playerId, message) {
    this.emit("chat:system", {
      targetId: playerId,
      message
    });
  }
  /**
   * Register default loot tables
   */
  registerDefaultLootTables() {
    this.lootTableManager.register({
      id: "goblin_drops",
      name: "Goblin Drops",
      drops: [
        {
          itemId: 1,
          // Coins
          quantity: 15,
          weight: 100,
          rarity: "common"
        },
        {
          itemId: 1173,
          // Bronze dagger
          quantity: 1,
          weight: 20,
          rarity: "uncommon"
        },
        {
          itemId: 1139,
          // Bronze med helm
          quantity: 1,
          weight: 10,
          rarity: "uncommon"
        },
        {
          itemId: 526,
          // Bones
          quantity: 1,
          weight: 100,
          rarity: "always"
        }
      ],
      rareDropTable: false
    });
    this.lootTableManager.register({
      id: "guard_drops",
      name: "Guard Drops",
      drops: [
        {
          itemId: 1,
          // Coins
          quantity: 50,
          weight: 100,
          rarity: "common"
        },
        {
          itemId: 1203,
          // Iron dagger
          quantity: 1,
          weight: 15,
          rarity: "uncommon"
        },
        {
          itemId: 526,
          // Bones
          quantity: 1,
          weight: 100,
          rarity: "always"
        }
      ],
      rareDropTable: true
    });
    this.lootTableManager.register({
      id: "rare_drop_table",
      name: "Rare Drop Table",
      drops: [
        {
          itemId: 1038,
          // Red partyhat
          quantity: 1,
          weight: 1,
          rarity: "very_rare"
        },
        {
          itemId: 985,
          // Tooth half of key
          quantity: 1,
          weight: 5,
          rarity: "rare"
        },
        {
          itemId: 987,
          // Loop half of key
          quantity: 1,
          weight: 5,
          rarity: "rare"
        }
      ],
      rareDropTable: false
    });
  }
  /**
   * Register a loot table
   */
  registerLootTable(table) {
    this.lootTableManager.register(table);
  }
  /**
   * Register the rare drop table
   */
  registerRareDropTable(table) {
    this.lootTableManager.register(table);
  }
  /**
   * Generate drops for an entity
   */
  generateDrops(entityId) {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return [];
    }
    const lootTableId = this.getLootTableId(entity);
    if (!lootTableId) {
      return [];
    }
    const lootTable = this.lootTableManager.get(lootTableId);
    if (!lootTable) {
      return [];
    }
    const drops = [];
    if (lootTable.drops && lootTable.drops.length > 0) {
      for (const drop of lootTable.drops) {
        let shouldDrop = false;
        switch (drop.rarity) {
          case "always":
            shouldDrop = true;
            break;
          case "common":
            shouldDrop = Math.random() < 0.5;
            break;
          case "uncommon":
            shouldDrop = Math.random() < 0.1;
            break;
          case "rare":
            shouldDrop = Math.random() < 0.01;
            break;
          case "very_rare":
            shouldDrop = Math.random() < 1e-3;
            break;
          default:
            shouldDrop = Math.random() < drop.weight / 100;
        }
        if (shouldDrop) {
          drops.push({
            itemId: drop.itemId,
            quantity: drop.quantity,
            noted: false
          });
        }
      }
    } else if (lootTable.alwaysDrops) {
      for (const drop of lootTable.alwaysDrops) {
        drops.push({
          itemId: drop.itemId,
          quantity: drop.quantity,
          noted: drop.noted
        });
      }
    }
    if (lootTable.rareTableAccess && Math.random() < lootTable.rareTableAccess) {
      const rareTable = this.lootTableManager.get("rare_drop_table");
      if (rareTable) {
        let rareDrop = null;
        if (rareTable.commonDrops && rareTable.commonDrops.length > 0) {
          rareDrop = this.rollFromEntries(rareTable.commonDrops);
        }
        if (!rareDrop && rareTable.uncommonDrops && rareTable.uncommonDrops.length > 0) {
          rareDrop = this.rollFromEntries(rareTable.uncommonDrops);
        }
        if (!rareDrop && rareTable.rareDrops && rareTable.rareDrops.length > 0) {
          rareDrop = this.rollFromEntries(rareTable.rareDrops);
        }
        if (rareDrop) {
          drops.push(rareDrop);
        }
      }
    }
    if (lootTable.commonDrops && lootTable.commonDrops.length > 0) {
      const maxDrops = lootTable.maxDrops || 1;
      for (let i = 0; i < maxDrops; i++) {
        const rolled = this.rollFromEntries(lootTable.commonDrops);
        if (rolled) {
          drops.push(rolled);
        }
      }
    }
    return drops;
  }
  /**
   * Roll from loot entries
   */
  rollFromEntries(entries) {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight === 0) {
      return null;
    }
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        const quantity = this.rollQuantity(entry.quantity);
        return {
          itemId: entry.itemId,
          quantity,
          noted: entry.noted
        };
      }
    }
    return null;
  }
  /**
   * Roll quantity within range
   */
  rollQuantity(range) {
    if (range.min === range.max) {
      return range.min;
    }
    const roll = Math.random();
    if (roll >= 0.999999) {
      return range.max;
    }
    return Math.floor(roll * (range.max - range.min + 1)) + range.min;
  }
  /**
   * Get loot tables for testing
   */
  get lootTables() {
    return this.lootTableManager;
  }
  /**
   * Get rare drop table for testing
   */
  get rareDropTable() {
    return this.lootTableManager.get("rare_drop_table");
  }
  /**
   * Calculate drop value
   */
  calculateDropValue(drops) {
    let totalValue = 0;
    for (const drop of drops) {
      if (drop.itemId === 995) {
        totalValue += drop.quantity;
      } else {
        totalValue += drop.quantity * 10;
      }
    }
    return totalValue;
  }
  /**
   * Get total value of drops
   */
  getDropsValue(drops) {
    let totalValue = 0;
    for (const drop of drops) {
      const itemDef = this.itemRegistry.get(drop.itemId);
      if (itemDef) {
        totalValue += itemDef.value * drop.quantity;
      }
    }
    return totalValue;
  }
};

// src/core/extras/three.ts
var three_exports = {};
__export(three_exports, {
  BufferGeometry: () => BufferGeometry2,
  Camera: () => Camera2,
  CanvasTexture: () => CanvasTexture2,
  Color: () => Color2,
  DataTexture: () => DataTexture2,
  Euler: () => Euler2,
  Fog: () => Fog2,
  Group: () => Group2,
  InstancedBufferAttribute: () => InstancedBufferAttribute2,
  InstancedMesh: () => InstancedMesh2,
  Layers: () => Layers2,
  LinearFilter: () => LinearFilter2,
  LinearSRGBColorSpace: () => LinearSRGBColorSpace2,
  Material: () => Material2,
  Matrix4: () => Matrix42,
  Mesh: () => Mesh2,
  MeshBasicMaterial: () => MeshBasicMaterial2,
  Object3D: () => Object3D2,
  PerspectiveCamera: () => PerspectiveCamera2,
  PlaneGeometry: () => PlaneGeometry2,
  Quaternion: () => Quaternion3,
  Raycaster: () => Raycaster2,
  SRGBColorSpace: () => SRGBColorSpace2,
  Scene: () => Scene2,
  SphereGeometry: () => SphereGeometry2,
  THREE: () => THREE,
  Texture: () => Texture2,
  TextureLoader: () => TextureLoader2,
  Vector3: () => Vector3Enhanced,
  Vector3Enhanced: () => Vector3Enhanced,
  VideoTexture: () => VideoTexture2,
  WebGLRenderer: () => WebGLRenderer2,
  default: () => three_default
});
var import_three_mesh_bvh = __toESM(require_index_umd(), 1);
import * as THREE_ORIGINAL2 from "three";
import * as SkeletonUtilsImport from "three/examples/jsm/utils/SkeletonUtils.js";

// src/core/extras/Vector3Enhanced.ts
import * as THREE_ORIGINAL from "three";
var _vector = null;
var Vector3Enhanced = class _Vector3Enhanced {
  constructor(x = 0, y = 0, z = 0) {
    this.isVector3 = true;
    this.isVector3Enhanced = true;
    this._x = x;
    this._y = y;
    this._z = z;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  set(x, y, z) {
    if (z === void 0) {
      z = this._z;
    }
    this._x = x;
    this._y = y;
    this._z = z;
    this._onChangeCallback();
    return this;
  }
  setScalar(scalar) {
    this._x = scalar;
    this._y = scalar;
    this._z = scalar;
    this._onChangeCallback();
    return this;
  }
  setX(x) {
    this._x = x;
    this._onChangeCallback();
    return this;
  }
  setY(y) {
    this._y = y;
    this._onChangeCallback();
    return this;
  }
  setZ(z) {
    this._z = z;
    this._onChangeCallback();
    return this;
  }
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error(`index is out of range: ${index}`);
    }
    return this;
  }
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error(`index is out of range: ${index}`);
    }
  }
  clone() {
    return new _Vector3Enhanced(this._x, this._y, this._z);
  }
  copy(v) {
    this._x = v.x;
    this._y = v.y;
    this._z = v.z;
    this._onChangeCallback();
    return this;
  }
  add(v) {
    this._x += v.x;
    this._y += v.y;
    this._z += v.z;
    this._onChangeCallback();
    return this;
  }
  addScalar(s) {
    this._x += s;
    this._y += s;
    this._z += s;
    this._onChangeCallback();
    return this;
  }
  addVectors(a, b) {
    this._x = a.x + b.x;
    this._y = a.y + b.y;
    this._z = a.z + b.z;
    this._onChangeCallback();
    return this;
  }
  addScaledVector(v, s) {
    this._x += v.x * s;
    this._y += v.y * s;
    this._z += v.z * s;
    this._onChangeCallback();
    return this;
  }
  sub(v) {
    this._x -= v.x;
    this._y -= v.y;
    this._z -= v.z;
    this._onChangeCallback();
    return this;
  }
  subScalar(s) {
    this._x -= s;
    this._y -= s;
    this._z -= s;
    this._onChangeCallback();
    return this;
  }
  subVectors(a, b) {
    this._x = a.x - b.x;
    this._y = a.y - b.y;
    this._z = a.z - b.z;
    this._onChangeCallback();
    return this;
  }
  multiply(v) {
    this._x *= v.x;
    this._y *= v.y;
    this._z *= v.z;
    this._onChangeCallback();
    return this;
  }
  multiplyScalar(scalar) {
    this._x *= scalar;
    this._y *= scalar;
    this._z *= scalar;
    this._onChangeCallback();
    return this;
  }
  multiplyVectors(a, b) {
    this._x = a.x * b.x;
    this._y = a.y * b.y;
    this._z = a.z * b.z;
    this._onChangeCallback();
    return this;
  }
  applyEuler(euler) {
    return this.applyQuaternion(new THREE_ORIGINAL.Quaternion().setFromEuler(euler));
  }
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(new THREE_ORIGINAL.Quaternion().setFromAxisAngle(axis, angle));
  }
  applyMatrix3(m) {
    const x = this._x, y = this._y, z = this._z;
    const e = m.elements;
    this._x = e[0] * x + e[3] * y + e[6] * z;
    this._y = e[1] * x + e[4] * y + e[7] * z;
    this._z = e[2] * x + e[5] * y + e[8] * z;
    this._onChangeCallback();
    return this;
  }
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  applyMatrix4(m) {
    const x = this._x, y = this._y, z = this._z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this._x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this._y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this._z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    this._onChangeCallback();
    return this;
  }
  applyQuaternion(q) {
    const vx = this._x, vy = this._y, vz = this._z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this._x = vx + qw * tx + qy * tz - qz * ty;
    this._y = vy + qw * ty + qz * tx - qx * tz;
    this._z = vz + qw * tz + qx * ty - qy * tx;
    this._onChangeCallback();
    return this;
  }
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  transformDirection(m) {
    const x = this._x, y = this._y, z = this._z;
    const e = m.elements;
    this._x = e[0] * x + e[4] * y + e[8] * z;
    this._y = e[1] * x + e[5] * y + e[9] * z;
    this._z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  divide(v) {
    this._x /= v.x;
    this._y /= v.y;
    this._z /= v.z;
    this._onChangeCallback();
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  min(v) {
    this._x = Math.min(this._x, v.x);
    this._y = Math.min(this._y, v.y);
    this._z = Math.min(this._z, v.z);
    this._onChangeCallback();
    return this;
  }
  max(v) {
    this._x = Math.max(this._x, v.x);
    this._y = Math.max(this._y, v.y);
    this._z = Math.max(this._z, v.z);
    this._onChangeCallback();
    return this;
  }
  clamp(min, max) {
    this._x = Math.max(min.x, Math.min(max.x, this._x));
    this._y = Math.max(min.y, Math.min(max.y, this._y));
    this._z = Math.max(min.z, Math.min(max.z, this._z));
    this._onChangeCallback();
    return this;
  }
  clampScalar(minVal, maxVal) {
    this._x = Math.max(minVal, Math.min(maxVal, this._x));
    this._y = Math.max(minVal, Math.min(maxVal, this._y));
    this._z = Math.max(minVal, Math.min(maxVal, this._z));
    this._onChangeCallback();
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
  }
  floor() {
    this._x = Math.floor(this._x);
    this._y = Math.floor(this._y);
    this._z = Math.floor(this._z);
    this._onChangeCallback();
    return this;
  }
  ceil() {
    this._x = Math.ceil(this._x);
    this._y = Math.ceil(this._y);
    this._z = Math.ceil(this._z);
    this._onChangeCallback();
    return this;
  }
  round() {
    this._x = Math.round(this._x);
    this._y = Math.round(this._y);
    this._z = Math.round(this._z);
    this._onChangeCallback();
    return this;
  }
  roundToZero() {
    this._x = Math.trunc(this._x);
    this._y = Math.trunc(this._y);
    this._z = Math.trunc(this._z);
    this._onChangeCallback();
    return this;
  }
  negate() {
    this._x = -this._x;
    this._y = -this._y;
    this._z = -this._z;
    this._onChangeCallback();
    return this;
  }
  dot(v) {
    return this._x * v.x + this._y * v.y + this._z * v.z;
  }
  // TODO lengthSquared?
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z;
  }
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z);
  }
  manhattanLength() {
    return Math.abs(this._x) + Math.abs(this._y) + Math.abs(this._z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this._x += (v.x - this._x) * alpha;
    this._y += (v.y - this._y) * alpha;
    this._z += (v.z - this._z) * alpha;
    this._onChangeCallback();
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this._x = v1.x + (v2.x - v1.x) * alpha;
    this._y = v1.y + (v2.y - v1.y) * alpha;
    this._z = v1.z + (v2.z - v1.z) * alpha;
    this._onChangeCallback();
    return this;
  }
  cross(v) {
    return this.crossVectors(this, v);
  }
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    this._x = ay * bz - az * by;
    this._y = az * bx - ax * bz;
    this._z = ax * by - ay * bx;
    this._onChangeCallback();
    return this;
  }
  projectOnVector(v) {
    const isEnhanced = "lengthSq" in v && "dot" in v;
    const denominator = isEnhanced ? v.lengthSq() : v.x * v.x + v.y * v.y + v.z * v.z;
    if (denominator === 0) {
      return this.set(0, 0, 0);
    }
    const scalar = isEnhanced ? v.dot(this) / denominator : this.dot(v) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  projectOnPlane(planeNormal) {
    if (!_vector) {
      _vector = new _Vector3Enhanced();
    }
    _vector.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector);
  }
  reflect(normal) {
    if (!_vector) {
      _vector = new _Vector3Enhanced();
    }
    return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  angleTo(v) {
    const vLengthSq = v.x * v.x + v.y * v.y + v.z * v.z;
    const denominator = Math.sqrt(this.lengthSq() * vLengthSq);
    if (denominator === 0) {
      return Math.PI / 2;
    }
    const theta = this.dot(v) / denominator;
    return Math.acos(THREE_ORIGINAL.MathUtils.clamp(theta, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this._x - v.x, dy = this._y - v.y, dz = this._z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this._x - v.x) + Math.abs(this._y - v.y) + Math.abs(this._z - v.z);
  }
  setFromSpherical(s) {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  setFromSphericalCoords(radius, phi, theta) {
    const sinPhiRadius = Math.sin(phi) * radius;
    this._x = sinPhiRadius * Math.sin(theta);
    this._y = Math.cos(phi) * radius;
    this._z = sinPhiRadius * Math.cos(theta);
    this._onChangeCallback();
    return this;
  }
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  setFromCylindricalCoords(radius, theta, y) {
    this._x = radius * Math.sin(theta);
    this._y = y;
    this._z = radius * Math.cos(theta);
    this._onChangeCallback();
    return this;
  }
  setFromMatrixPosition(m) {
    const e = m.elements;
    this._x = e[12];
    this._y = e[13];
    this._z = e[14];
    this._onChangeCallback();
    return this;
  }
  setFromMatrixScale(m) {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this._x = sx;
    this._y = sy;
    this._z = sz;
    this._onChangeCallback();
    return this;
  }
  setFromMatrixColumn(m, index) {
    return this.fromArray(m.elements, index * 4);
  }
  setFromMatrix3Column(m, index) {
    return this.fromArray(m.elements, index * 3);
  }
  setFromEuler(e) {
    if ("_x" in e && "_y" in e && "_z" in e) {
      this._x = e._x;
      this._y = e._y;
      this._z = e._z;
    } else if ("x" in e && "y" in e && "z" in e) {
      this._x = e.x;
      this._y = e.y;
      this._z = e.z;
    }
    this._onChangeCallback();
    return this;
  }
  setFromColor(c) {
    this._x = c.r;
    this._y = c.g;
    this._z = c.b;
    this._onChangeCallback();
    return this;
  }
  equals(v) {
    return v.x === this._x && v.y === this._y && v.z === this._z;
  }
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._onChangeCallback();
    return this;
  }
  toArray(array, offset) {
    if (array === void 0) {
      return [this._x, this._y, this._z];
    }
    if (offset === void 0) {
      offset = 0;
    }
    ;
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this._x = attribute.getX(index);
    this._y = attribute.getY(index);
    this._z = attribute.getZ(index);
    this._onChangeCallback();
    return this;
  }
  random() {
    this._x = Math.random();
    this._y = Math.random();
    this._z = Math.random();
    this._onChangeCallback();
    return this;
  }
  randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const c = Math.sqrt(1 - u * u);
    this._x = c * Math.cos(theta);
    this._y = u;
    this._z = c * Math.sin(theta);
    this._onChangeCallback();
    return this;
  }
  // PhysX extension methods
  fromPxVec3(pxVec3) {
    this._x = pxVec3.x;
    this._y = pxVec3.y;
    this._z = pxVec3.z;
    this._onChangeCallback();
    return this;
  }
  toPxVec3(pxVec3) {
    if (!pxVec3 && typeof PHYSX !== "undefined") {
      pxVec3 = new PHYSX.PxVec3();
    }
    if (pxVec3) {
      pxVec3.x = this._x;
      pxVec3.y = this._y;
      pxVec3.z = this._z;
    }
    return pxVec3;
  }
  toPxExtVec3(pxExtVec3) {
    if (!pxExtVec3 && typeof PHYSX !== "undefined") {
      pxExtVec3 = new PHYSX.PxExtendedVec3();
    }
    if (pxExtVec3) {
      pxExtVec3.x = this._x;
      pxExtVec3.y = this._y;
      pxExtVec3.z = this._z;
    }
    return pxExtVec3;
  }
  toPxTransform(pxTransform) {
    if (pxTransform && pxTransform.p) {
      pxTransform.p.x = this._x;
      pxTransform.p.y = this._y;
      pxTransform.p.z = this._z;
    }
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
  }
};

// src/core/extras/three.ts
__reExport(three_exports, three_star);
import * as three_star from "three";
try {
  if (THREE_ORIGINAL2.BufferGeometry) {
    ;
    THREE_ORIGINAL2.BufferGeometry.prototype.computeBoundsTree = import_three_mesh_bvh.computeBoundsTree;
    THREE_ORIGINAL2.BufferGeometry.prototype.disposeBoundsTree = import_three_mesh_bvh.disposeBoundsTree;
  }
  if (THREE_ORIGINAL2.Mesh) {
    ;
    THREE_ORIGINAL2.Mesh.prototype.raycast = import_three_mesh_bvh.acceleratedRaycast;
  }
  if (THREE_ORIGINAL2.InstancedMesh && THREE_ORIGINAL2.InstancedBufferAttribute) {
    ;
    THREE_ORIGINAL2.InstancedMesh.prototype.resize = function(size) {
      const prevSize = this.instanceMatrix.array.length / 16;
      if (size <= prevSize) {
        return;
      }
      const array = new Float32Array(size * 16);
      array.set(this.instanceMatrix.array);
      this.instanceMatrix = new THREE_ORIGINAL2.InstancedBufferAttribute(array, 16);
      this.instanceMatrix.needsUpdate = true;
    };
  }
} catch (e) {
  console.warn("Failed to install three-mesh-bvh extensions:", e);
}
var THREE_ENHANCED = {
  ...THREE_ORIGINAL2,
  Vector3: Vector3Enhanced
};
var Quaternion3 = THREE_ORIGINAL2.Quaternion;
var Euler2 = THREE_ORIGINAL2.Euler;
var Object3D2 = THREE_ORIGINAL2.Object3D;
var Mesh2 = THREE_ORIGINAL2.Mesh;
var SphereGeometry2 = THREE_ORIGINAL2.SphereGeometry;
var MeshBasicMaterial2 = THREE_ORIGINAL2.MeshBasicMaterial;
var Color2 = THREE_ORIGINAL2.Color;
var Fog2 = THREE_ORIGINAL2.Fog;
var Scene2 = THREE_ORIGINAL2.Scene;
var Group2 = THREE_ORIGINAL2.Group;
var Camera2 = THREE_ORIGINAL2.Camera;
var WebGLRenderer2 = THREE_ORIGINAL2.WebGLRenderer;
var TextureLoader2 = THREE_ORIGINAL2.TextureLoader;
var InstancedMesh2 = THREE_ORIGINAL2.InstancedMesh;
var InstancedBufferAttribute2 = THREE_ORIGINAL2.InstancedBufferAttribute;
var Raycaster2 = THREE_ORIGINAL2.Raycaster;
var Layers2 = THREE_ORIGINAL2.Layers;
var Matrix42 = THREE_ORIGINAL2.Matrix4;
var Material2 = THREE_ORIGINAL2.Material;
var Texture2 = THREE_ORIGINAL2.Texture;
var BufferGeometry2 = THREE_ORIGINAL2.BufferGeometry;
var PlaneGeometry2 = THREE_ORIGINAL2.PlaneGeometry;
var PerspectiveCamera2 = THREE_ORIGINAL2.PerspectiveCamera;
var CanvasTexture2 = THREE_ORIGINAL2.CanvasTexture;
var DataTexture2 = THREE_ORIGINAL2.DataTexture;
var VideoTexture2 = THREE_ORIGINAL2.VideoTexture;
var LinearFilter2 = THREE_ORIGINAL2.LinearFilter;
var LinearSRGBColorSpace2 = THREE_ORIGINAL2.LinearSRGBColorSpace;
var SRGBColorSpace2 = THREE_ORIGINAL2.SRGBColorSpace;
var THREE = {
  // Spread all original THREE exports
  ...THREE_ORIGINAL2,
  // Override with our enhanced Vector3
  Vector3: Vector3Enhanced,
  Vector3Enhanced,
  // Add SkeletonUtils
  SkeletonUtils: SkeletonUtilsImport,
  // Ensure key missing exports are available
  WebGLRenderer: THREE_ORIGINAL2.WebGLRenderer,
  TextureLoader: THREE_ORIGINAL2.TextureLoader,
  Raycaster: THREE_ORIGINAL2.Raycaster,
  Layers: THREE_ORIGINAL2.Layers,
  Matrix4: THREE_ORIGINAL2.Matrix4,
  Material: THREE_ORIGINAL2.Material,
  Texture: THREE_ORIGINAL2.Texture,
  BufferGeometry: THREE_ORIGINAL2.BufferGeometry,
  PlaneGeometry: THREE_ORIGINAL2.PlaneGeometry,
  PerspectiveCamera: THREE_ORIGINAL2.PerspectiveCamera,
  CanvasTexture: THREE_ORIGINAL2.CanvasTexture,
  DataTexture: THREE_ORIGINAL2.DataTexture,
  VideoTexture: THREE_ORIGINAL2.VideoTexture,
  LinearFilter: THREE_ORIGINAL2.LinearFilter,
  LinearSRGBColorSpace: THREE_ORIGINAL2.LinearSRGBColorSpace,
  SRGBColorSpace: THREE_ORIGINAL2.SRGBColorSpace,
  InstancedMesh: THREE_ORIGINAL2.InstancedMesh,
  InstancedBufferAttribute: THREE_ORIGINAL2.InstancedBufferAttribute
};
var three_default = THREE_ENHANCED;

// src/rpg/systems/spawning/CircularSpawnArea.ts
var CircularSpawnArea = class {
  constructor(center, radius, minSpacing = 1, avoidOverlap = true, maxHeight = 0) {
    this.center = center;
    this.radius = radius;
    this.type = "circle";
    this.minSpacing = minSpacing;
    this.avoidOverlap = avoidOverlap;
    this.maxHeight = maxHeight;
  }
  /**
   * Get a random position within the circular area
   */
  getRandomPosition() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * this.radius;
    const yOffset = this.maxHeight > 0 ? (Math.random() - 0.5) * this.maxHeight * 2 : 0;
    return {
      x: this.center.x + Math.cos(angle) * distance,
      y: this.center.y + yOffset,
      z: this.center.z + Math.sin(angle) * distance
    };
  }
  /**
   * Check if position is valid within the area
   */
  isValidPosition(position) {
    const distance = this.distance(position, this.center);
    return distance <= this.radius;
  }
  /**
   * Calculate distance between two positions
   */
  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
};

// src/rpg/systems/spawning/SpatialIndex.ts
var SpatialIndex = class {
  constructor(cellSize = 50) {
    this.grid = /* @__PURE__ */ new Map();
    this.cellSize = cellSize;
  }
  /**
   * Add item to spatial index
   */
  add(item) {
    const key = this.getGridKey(item.position);
    if (!this.grid.has(key)) {
      this.grid.set(key, /* @__PURE__ */ new Set());
    }
    this.grid.get(key).add(item);
  }
  /**
   * Remove item from spatial index
   */
  remove(item) {
    const key = this.getGridKey(item.position);
    const cell = this.grid.get(key);
    if (cell) {
      cell.delete(item);
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
  }
  /**
   * Get all items within range of position
   */
  getInRange(position, range) {
    const results = [];
    const cellRange = Math.ceil(range / this.cellSize);
    const centerCell = this.getCellCoords(position);
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dz = -cellRange; dz <= cellRange; dz++) {
        const cellKey = `${centerCell.x + dx},${centerCell.z + dz}`;
        const cell = this.grid.get(cellKey);
        if (cell) {
          for (const item of cell) {
            const distance = this.distance(position, item.position);
            if (distance <= range) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
  /**
   * Clear all items
   */
  clear() {
    this.grid.clear();
  }
  /**
   * Get total item count
   */
  get size() {
    let count = 0;
    for (const cell of this.grid.values()) {
      count += cell.size;
    }
    return count;
  }
  /**
   * Get grid key for position
   */
  getGridKey(position) {
    const cell = this.getCellCoords(position);
    return `${cell.x},${cell.z}`;
  }
  /**
   * Get cell coordinates for position
   */
  getCellCoords(position) {
    return {
      x: Math.floor(position.x / this.cellSize),
      z: Math.floor(position.z / this.cellSize)
    };
  }
  /**
   * Calculate distance between two positions
   */
  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
};

// src/rpg/systems/spawning/SpawnConditionChecker.ts
var SpawnConditionChecker = class {
  /**
   * Check if all conditions are met for spawning
   */
  checkConditions(spawner, world) {
    const conditions = spawner.conditions;
    if (!conditions) {
      return true;
    }
    if (conditions.timeOfDay) {
      const currentTime = this.getTimeOfDay(world);
      const { start, end } = conditions.timeOfDay;
      if (start <= end) {
        if (currentTime < start || currentTime > end) {
          return false;
        }
      } else {
        if (currentTime < start && currentTime > end) {
          return false;
        }
      }
    }
    if (conditions.minPlayers !== void 0 || conditions.maxPlayers !== void 0) {
      const playerCount = this.getPlayersInRange(spawner, world).length;
      if (conditions.minPlayers !== void 0 && playerCount < conditions.minPlayers) {
        return false;
      }
      if (conditions.maxPlayers !== void 0 && playerCount > conditions.maxPlayers) {
        return false;
      }
    }
    if (conditions.playerLevel) {
      const players = this.getPlayersInRange(spawner, world);
      if (players.length === 0) {
        return false;
      }
      const avgLevel = this.getAveragePlayerLevel(players);
      const { min, max } = conditions.playerLevel;
      if (min !== void 0 && avgLevel < min) {
        return false;
      }
      if (max !== void 0 && avgLevel > max) {
        return false;
      }
    }
    if (conditions.customCondition) {
      if (!conditions.customCondition(spawner, world)) {
        return false;
      }
    }
    return true;
  }
  /**
   * Get current time of day (0-24)
   */
  getTimeOfDay(world) {
    const timeSystem = world.timeSystem;
    if (timeSystem && typeof timeSystem.getHour === "function") {
      return timeSystem.getHour();
    }
    const dayNightCycle = world.dayNightCycle;
    if (dayNightCycle && typeof dayNightCycle.getCurrentHour === "function") {
      return dayNightCycle.getCurrentHour();
    }
    const now = /* @__PURE__ */ new Date();
    return now.getHours() + now.getMinutes() / 60;
  }
  /**
   * Get players in range of spawner
   */
  getPlayersInRange(spawner, world) {
    const players = [];
    const entities = world.getEntitiesInRange?.(spawner.position, spawner.activationRange) || [];
    for (const entity of entities) {
      if (entity.type === "player" || entity.data?.type === "player") {
        players.push(entity);
      }
    }
    return players;
  }
  /**
   * Get average level of players
   */
  getAveragePlayerLevel(players) {
    if (players.length === 0) {
      return 0;
    }
    let totalLevel = 0;
    for (const player of players) {
      const stats = player.getComponent?.("stats");
      if (stats?.combatLevel) {
        totalLevel += stats.combatLevel;
      }
    }
    return totalLevel / players.length;
  }
};

// src/core/entities/Entity.ts
var Entity = class {
  constructor(world, data, local) {
    this.world = world;
    this.data = data;
    this.id = data.id;
    this.name = data.name || "entity";
    this.type = data.type || "generic";
    this.isPlayer = data.type === "player";
    this.components = /* @__PURE__ */ new Map();
    this.node = new THREE.Object3D();
    this.node.name = this.name;
    this.node.userData.entity = this;
    if (data.position) {
      this.node.position.set(data.position[0], data.position[1], data.position[2]);
    }
    if (data.quaternion) {
      this.node.quaternion.set(data.quaternion[0], data.quaternion[1], data.quaternion[2], data.quaternion[3]);
    }
    if (data.scale) {
      this.node.scale.set(data.scale[0], data.scale[1], data.scale[2]);
    }
    this.velocity = { x: 0, y: 0, z: 0 };
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(this.node);
    }
    if (local && this.world.network) {
      ;
      this.world.network.send("entityAdded", this.serialize());
    }
  }
  // Transform getters
  get position() {
    return {
      x: this.node.position.x,
      y: this.node.position.y,
      z: this.node.position.z
    };
  }
  set position(value) {
    this.node.position.set(value.x, value.y, value.z);
    this.syncPhysicsTransform();
  }
  get rotation() {
    return {
      x: this.node.quaternion.x,
      y: this.node.quaternion.y,
      z: this.node.quaternion.z,
      w: this.node.quaternion.w
    };
  }
  set rotation(value) {
    this.node.quaternion.set(value.x, value.y, value.z, value.w);
    this.syncPhysicsTransform();
  }
  get scale() {
    return {
      x: this.node.scale.x,
      y: this.node.scale.y,
      z: this.node.scale.z
    };
  }
  set scale(value) {
    this.node.scale.set(value.x, value.y, value.z);
  }
  // Component management
  addComponent(type, data) {
    if (this.components.has(type)) {
      console.warn(`Entity ${this.id} already has component ${type}`);
      return this.components.get(type);
    }
    const component = {
      type,
      entity: this,
      data: data || {}
    };
    this.components.set(type, component);
    if (component.init) {
      component.init();
    }
    this.handleSpecialComponent(type, component);
    this.world.events?.emit("entity:component:added", {
      entityId: this.id,
      componentType: type,
      component
    });
    return component;
  }
  removeComponent(type) {
    const component = this.components.get(type);
    if (!component) {
      return;
    }
    if (component.destroy) {
      component.destroy();
    }
    this.handleSpecialComponentRemoval(type, component);
    this.components.delete(type);
    this.world.events?.emit("entity:component:removed", {
      entityId: this.id,
      componentType: type
    });
  }
  getComponent(type) {
    const component = this.components.get(type);
    if (!component) {
      return null;
    }
    if (component.data && typeof component.data === "object") {
      return component.data;
    }
    return component;
  }
  hasComponent(type) {
    return this.components.has(type);
  }
  // Physics methods
  applyForce(force) {
    if (!this.rigidBody) {
      return;
    }
    if (this.world.physics?.world) {
      const physicsForce = new this.world.physics.world.PxVec3(force.x, force.y, force.z);
      this.rigidBody.addForce(physicsForce);
      physicsForce.delete();
    }
  }
  applyImpulse(impulse) {
    if (!this.rigidBody) {
      return;
    }
    if (this.world.physics?.world) {
      const physicsImpulse = new this.world.physics.world.PxVec3(impulse.x, impulse.y, impulse.z);
      this.rigidBody.addImpulse(physicsImpulse);
      physicsImpulse.delete();
    }
  }
  setVelocity(velocity) {
    this.velocity = { ...velocity };
    if (this.rigidBody && this.world.physics?.world) {
      const physicsVelocity = new this.world.physics.world.PxVec3(velocity.x, velocity.y, velocity.z);
      this.rigidBody.setLinearVelocity(physicsVelocity);
      physicsVelocity.delete();
    }
  }
  getVelocity() {
    if (this.rigidBody && this.world.physics?.world) {
      const vel = this.rigidBody.getLinearVelocity();
      this.velocity = { x: vel.x, y: vel.y, z: vel.z };
    }
    return { ...this.velocity };
  }
  // Update methods
  fixedUpdate(delta) {
    for (const component of this.components.values()) {
      if (component.fixedUpdate) {
        component.fixedUpdate(delta);
      }
    }
  }
  update(delta) {
    for (const component of this.components.values()) {
      if (component.update) {
        component.update(delta);
      }
    }
  }
  lateUpdate(delta) {
    for (const component of this.components.values()) {
      if (component.lateUpdate) {
        component.lateUpdate(delta);
      }
    }
  }
  // Event handling
  on(event, callback) {
    this.world.events?.emit(`entity:${this.id}:${event}`, callback);
  }
  off(event, callback) {
    this.world.events?.emit(`entity:${this.id}:${event}:off`, callback);
  }
  emit(event, data) {
    this.world.events?.emit(`entity:${this.id}:${event}`, data);
  }
  // Serialization
  serialize() {
    const serialized = {
      id: this.id,
      name: this.name,
      type: this.type,
      position: [this.position.x, this.position.y, this.position.z],
      quaternion: [this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w]
    };
    if (this.data.scale || !this.isDefaultScale()) {
      serialized.scale = [this.scale.x, this.scale.y, this.scale.z];
    }
    for (const key in this.data) {
      if (key !== "id" && key !== "name" && key !== "type" && key !== "position" && key !== "quaternion" && key !== "scale" && this.data.hasOwnProperty(key)) {
        ;
        serialized[key] = this.data[key];
      }
    }
    return serialized;
  }
  // Modification from network/data
  modify(data) {
    Object.assign(this.data, data);
    if (data.position) {
      this.node.position.set(data.position[0], data.position[1], data.position[2]);
    }
    if (data.quaternion) {
      this.node.quaternion.set(data.quaternion[0], data.quaternion[1], data.quaternion[2], data.quaternion[3]);
    }
    if (data.scale) {
      this.node.scale.set(data.scale[0], data.scale[1], data.scale[2]);
    }
  }
  // Network event handling
  onEvent(version, name, data, networkId) {
    this.world.events?.emit(`entity:${this.id}:network:${name}`, {
      version,
      data,
      networkId
    });
  }
  // Destruction
  destroy(local) {
    for (const type of Array.from(this.components.keys())) {
      this.removeComponent(type);
    }
    if (this.node.parent) {
      this.node.parent.remove(this.node);
    }
    if (this.rigidBody && this.world.physics?.world) {
    }
    if (local && this.world.network) {
      ;
      this.world.network.send("entityRemoved", this.id);
    }
    this.world.events?.emit("entity:destroyed", {
      entityId: this.id
    });
  }
  // Helper methods
  syncPhysicsTransform() {
    if (!this.rigidBody || !this.world.physics?.world) {
      return;
    }
    const pos = this.position;
    const rot = this.rotation;
    const transform = new this.world.physics.world.PxTransform(
      new this.world.physics.world.PxVec3(pos.x, pos.y, pos.z),
      new this.world.physics.world.PxQuat(rot.x, rot.y, rot.z, rot.w)
    );
    this.rigidBody.setGlobalPose(transform);
    transform.p.delete();
    transform.q.delete();
    transform.delete();
  }
  handleSpecialComponent(type, component) {
    switch (type) {
      case "rigidbody":
        this.createPhysicsBody(component);
        break;
      case "collider":
        this.updateCollider(component);
        break;
      case "mesh":
        this.updateMesh(component);
        break;
    }
  }
  handleSpecialComponentRemoval(type, component) {
    switch (type) {
      case "rigidbody":
        this.removePhysicsBody();
        break;
      case "mesh":
        this.removeMesh(component);
        break;
    }
  }
  createPhysicsBody(component) {
  }
  removePhysicsBody() {
    if (this.rigidBody) {
      this.rigidBody = void 0;
    }
  }
  updateCollider(component) {
  }
  updateMesh(component) {
    const meshData = component.data;
    if (meshData.geometry && meshData.material) {
    }
  }
  removeMesh(component) {
  }
  isDefaultRotation() {
    return this.rotation.x === 0 && this.rotation.y === 0 && this.rotation.z === 0 && this.rotation.w === 1;
  }
  isDefaultScale() {
    return this.scale.x === 1 && this.scale.y === 1 && this.scale.z === 1;
  }
};

// src/rpg/entities/RPGEntity.ts
var RPGEntity4 = class extends Entity {
  constructor(world, type, data) {
    const entityData = {
      id: data.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: data.name || type,
      position: data.position ? [data.position.x, data.position.y, data.position.z] : [0, 0, 0],
      quaternion: data.quaternion || [0, 0, 0, 1],
      ...data
    };
    super(world, entityData);
    this.components = /* @__PURE__ */ new Map();
  }
  /**
   * Add a component to the entity
   */
  addComponent(type, data) {
    const component = {
      type,
      entity: this,
      data: data || {},
      entityId: this.data.id,
      ...data
    };
    this.components.set(type, component);
    return component;
  }
  /**
   * Get a component by type
   */
  getComponent(type) {
    return this.components.get(type) || null;
  }
  /**
   * Remove a component by type
   */
  removeComponent(type) {
    this.components.delete(type);
  }
  /**
   * Check if entity has a component
   */
  hasComponent(type) {
    return this.components.has(type);
  }
  /**
   * Get all components
   */
  getAllComponents() {
    return Array.from(this.components.values());
  }
  /**
   * Update entity - called every frame
   */
  update(_delta) {
  }
  /**
   * Fixed update - called at fixed intervals
   */
  fixedUpdate(_delta) {
  }
  /**
   * Late update - called after all updates
   */
  lateUpdate(_delta) {
  }
  /**
   * Serialize entity data
   */
  serialize() {
    const data = super.serialize();
    const componentData = {};
    this.components.forEach((component, type) => {
      componentData[type] = component;
    });
    return {
      ...data,
      components: componentData
    };
  }
  destroy(local) {
    for (const [type, _] of this.components) {
      this.removeComponent(type);
    }
    super.destroy(local);
  }
};

// src/rpg/systems/SpawningSystem.ts
var SpawningSystem = class extends System {
  constructor(world) {
    super(world);
    // Core components
    this.spawners = /* @__PURE__ */ new Map();
    this.activeSpawns = /* @__PURE__ */ new Map();
    // entityId -> spawnerId
    this.spawnQueue = [];
    this.visualSystem = null;
    // Configuration
    this.DEFAULT_ACTIVATION_RANGE = 50;
    this.DEFAULT_DEACTIVATION_RANGE = 75;
    this.UPDATE_INTERVAL = 1e3;
    // 1 second
    this.lastUpdateTime = 0;
    this.spatialIndex = new SpatialIndex(50);
    this.conditionChecker = new SpawnConditionChecker();
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    console.log("[SpawningSystem] Initializing...");
    this.visualSystem = this.world.getSystem?.("visualRepresentation");
    this.world.events.on("entity:death", (event) => {
      this.handleEntityDeath(event.entityId);
    });
    this.world.events.on("entity:despawned", (event) => {
      this.handleEntityDespawn(event.entityId);
    });
    this.registerDefaultSpawners();
  }
  /**
   * Fixed update cycle
   */
  fixedUpdate(delta) {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
      return;
    }
    this.lastUpdateTime = now;
    this.processSpawnQueue(now);
    for (const [_id, spawner] of this.spawners) {
      this.updateSpawner(spawner, delta);
    }
    this.cleanupDestroyedEntities();
  }
  /**
   * Register a spawner
   */
  registerSpawner(config) {
    const id = `spawner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const spawner = {
      id,
      type: config.type,
      position: config.position,
      entityDefinitions: config.entityDefinitions || [],
      maxEntities: config.maxEntities || 1,
      respawnTime: config.respawnTime || 3e4,
      activationRange: config.activationRange || this.DEFAULT_ACTIVATION_RANGE,
      deactivationRange: config.deactivationRange || this.DEFAULT_DEACTIVATION_RANGE,
      requiresLineOfSight: config.requiresLineOfSight || false,
      activeEntities: /* @__PURE__ */ new Set(),
      lastSpawnTime: 0,
      isActive: false,
      spawnArea: config.spawnArea || new CircularSpawnArea(config.position, 5, 1),
      conditions: config.conditions
    };
    this.spawners.set(id, spawner);
    this.spatialIndex.add(spawner);
    console.log(`[SpawningSystem] Registered spawner ${id} at ${JSON.stringify(config.position)}`);
    return id;
  }
  /**
   * Unregister a spawner
   */
  unregisterSpawner(spawnerId) {
    const spawner = this.spawners.get(spawnerId);
    if (!spawner) {
      return;
    }
    for (const entityId of spawner.activeEntities) {
      this.despawnEntity(entityId);
    }
    this.spawners.delete(spawnerId);
    this.spatialIndex.remove(spawner);
    console.log(`[SpawningSystem] Unregistered spawner ${spawnerId}`);
  }
  /**
   * Spawn entity from spawner
   */
  spawnEntity(spawner) {
    const definition = this.selectSpawnDefinition(spawner.entityDefinitions);
    if (!definition) {
      return null;
    }
    const position = this.getSpawnPosition(spawner);
    if (!position) {
      return null;
    }
    const entity = this.createEntity(definition, position, spawner);
    if (!entity) {
      return null;
    }
    this.registerSpawn(spawner, entity);
    this.world.events.emit("entity:spawned", {
      entityId: entity.id || entity.data?.id,
      spawnerId: spawner.id,
      position,
      entityType: definition.entityType
    });
    return entity;
  }
  /**
   * Despawn entity
   */
  despawnEntity(entityId) {
    const spawnerId = this.activeSpawns.get(entityId);
    if (!spawnerId) {
      return;
    }
    const spawner = this.spawners.get(spawnerId);
    if (spawner) {
      spawner.activeEntities.delete(entityId);
    }
    this.activeSpawns.delete(entityId);
    const entity = this.getEntity(entityId);
    if (entity) {
      ;
      this.world.removeEntity?.(entity);
    }
    console.log(`[SpawningSystem] Despawned entity ${entityId}`);
  }
  /**
   * Get active players in range
   */
  getActivePlayersInRange(position, range) {
    const players = [];
    const entities = this.world.getEntitiesInRange?.(position, range) || [];
    for (const entity of entities) {
      if (entity.data?.type === "player") {
        players.push(entity);
      }
    }
    return players;
  }
  /**
   * Update spawner
   */
  updateSpawner(spawner, _delta) {
    const wasActive = spawner.isActive;
    spawner.isActive = this.checkActivation(spawner);
    if (!wasActive && spawner.isActive) {
      this.onSpawnerActivated(spawner);
    } else if (wasActive && !spawner.isActive) {
      this.onSpawnerDeactivated(spawner);
    }
    if (!spawner.isActive) {
      return;
    }
    if (this.shouldSpawn(spawner)) {
      this.spawnFromSpawner(spawner);
    }
  }
  /**
   * Check spawner activation
   */
  checkActivation(spawner) {
    const players = this.getActivePlayersInRange(spawner.position, spawner.activationRange);
    if (players.length > 0) {
      if (spawner.requiresLineOfSight) {
        const hasLOS = players.some((player) => {
          const playerPos = player.data?.position || player.position;
          const playerVector3 = Array.isArray(playerPos) ? { x: playerPos[0] || 0, y: playerPos[1] || 0, z: playerPos[2] || 0 } : playerPos;
          return this.hasLineOfSight(playerVector3, spawner.position);
        });
        if (!hasLOS) {
          return false;
        }
      }
      return true;
    }
    if (spawner.isActive) {
      const deactivationPlayers = this.getActivePlayersInRange(spawner.position, spawner.deactivationRange);
      return deactivationPlayers.length > 0;
    }
    return false;
  }
  /**
   * Check if should spawn
   */
  shouldSpawn(spawner) {
    if (spawner.activeEntities.size >= spawner.maxEntities) {
      return false;
    }
    const now = Date.now();
    if (now - spawner.lastSpawnTime < spawner.respawnTime) {
      return false;
    }
    if (!this.conditionChecker.checkConditions(spawner, this.world)) {
      return false;
    }
    return true;
  }
  /**
   * Spawn from spawner
   */
  spawnFromSpawner(spawner) {
    const entity = this.spawnEntity(spawner);
    if (entity) {
      spawner.lastSpawnTime = Date.now();
      console.log(`[SpawningSystem] Spawned ${entity.data?.type || "entity"} from spawner ${spawner.id}`);
    }
  }
  /**
   * Select spawn definition based on weights
   */
  selectSpawnDefinition(definitions) {
    if (definitions.length === 0) {
      return null;
    }
    const totalWeight = definitions.reduce((sum, def) => sum + def.weight, 0);
    if (totalWeight === 0) {
      return null;
    }
    let roll = Math.random() * totalWeight;
    for (const definition of definitions) {
      roll -= definition.weight;
      if (roll <= 0) {
        return definition;
      }
    }
    return definitions[0] || null;
  }
  /**
   * Get spawn position
   */
  getSpawnPosition(spawner) {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const position = spawner.spawnArea.getRandomPosition();
      if (!position) {
        continue;
      }
      if (!this.isValidSpawnPosition(position, spawner)) {
        continue;
      }
      if (spawner.spawnArea.avoidOverlap && position) {
        const nearby = this.getEntitiesNear(position, spawner.spawnArea.minSpacing);
        if (nearby.length > 0) {
          continue;
        }
      }
      position.y = this.getGroundHeight(position);
      return position;
    }
    return null;
  }
  /**
   * Create entity based on type
   */
  createEntity(definition, position, spawner) {
    switch (spawner.type) {
      case "npc" /* NPC */:
        return this.createNPC(definition, position, spawner);
      case "resource" /* RESOURCE */:
        return this.spawnResource(definition, position, spawner);
      case "chest" /* CHEST */:
        return this.spawnChest(definition, position, spawner);
      case "boss" /* BOSS */:
        return this.spawnBoss(definition, position, spawner);
      default:
        console.warn(`[SpawningSystem] Unknown spawner type: ${spawner.type}`);
        return null;
    }
  }
  /**
   * Create NPC
   */
  createNPC(definition, position, spawner) {
    const npcSystem = this.world.getSystem?.("npc");
    if (!npcSystem) {
      console.warn("[SpawningSystem] NPC system not found");
      return null;
    }
    const npc = npcSystem.spawnNPC?.(definition.entityId || 1, position, spawner.id);
    if (npc) {
      console.log(
        `[SpawningSystem] Successfully created NPC ${npc.id} (entityId: ${definition.entityId}) at position [${position.x}, ${position.y}, ${position.z}]`
      );
    } else {
      console.warn(
        `[SpawningSystem] Failed to create NPC with entityId ${definition.entityId}. This usually means the NPC definition is missing from the config files.`
      );
    }
    return npc;
  }
  /**
   * Spawn resource entity (trees, rocks, items, etc.)
   */
  spawnResource(definition, position, spawner) {
    if (definition.entityType === "sword") {
      return this.spawnSwordItem(definition, position, spawner);
    }
    const resourceId = `resource_${Date.now()}_${Math.random()}`;
    const resource = new RPGEntity4(this.world, "resource", {
      id: resourceId,
      type: "resource",
      position,
      resourceType: definition.entityType,
      spawnPointId: spawner.id,
      depleted: false,
      respawnTime: spawner.respawnTime || 6e4
      // 1 minute default
    });
    const resourceComponent = {
      type: "resource",
      resourceType: definition.entityType,
      skillRequired: this.getResourceSkill(definition.entityType),
      levelRequired: definition.minLevel || 1,
      depleted: false,
      harvestTime: 3e3,
      // 3 seconds
      drops: this.getResourceDrops(definition.entityType),
      respawnTime: spawner.respawnTime || 6e4
    };
    resource.components.set("resource", resourceComponent);
    resource.components.set("visual", {
      type: "visual",
      model: this.getResourceModel(definition.entityType),
      scale: definition.metadata?.scale || 1
    });
    resource.components.set("collider", {
      type: "collider",
      shape: "box",
      size: { x: 1, y: 2, z: 1 },
      blocking: true
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(resourceId, resource);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(resourceId, resource);
    }
    if (this.visualSystem) {
      this.visualSystem.createVisual(resource, definition.entityType);
    }
    return resource;
  }
  /**
   * Spawn sword item for quest
   */
  spawnSwordItem(definition, position, spawner) {
    const swordId = `sword_${Date.now()}_${Math.random()}`;
    const sword = new RPGEntity4(this.world, "item", {
      id: swordId,
      type: "item",
      position,
      itemType: "sword",
      spawnPointId: spawner.id,
      collected: false
    });
    const itemComponent = {
      type: "item",
      itemId: 1001,
      // Bronze sword
      itemType: "weapon",
      name: "Bronze Sword",
      stackable: false,
      maxStack: 1,
      value: 50,
      collected: false,
      interactable: true
    };
    sword.components.set("item", itemComponent);
    sword.components.set("visual", {
      type: "visual",
      model: "models/sword_bronze.glb",
      scale: 1
    });
    sword.components.set("interactable", {
      type: "interactable",
      interactionType: "pickup",
      range: 2,
      action: "pick_up_sword"
    });
    sword.components.set("collider", {
      type: "collider",
      shape: "box",
      size: { x: 0.2, y: 0.1, z: 1.2 },
      blocking: false
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(swordId, sword);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(swordId, sword);
    }
    if (this.visualSystem) {
      this.visualSystem.createVisual(sword, "sword");
    }
    console.log(
      `[SpawningSystem] Spawned sword item ${swordId} at position [${position.x}, ${position.y}, ${position.z}]`
    );
    return sword;
  }
  /**
   * Get resource skill requirement
   */
  getResourceSkill(resourceType) {
    const skillMap = {
      tree: "woodcutting",
      oak_tree: "woodcutting",
      willow_tree: "woodcutting",
      rock: "mining",
      iron_rock: "mining",
      gold_rock: "mining",
      fishing_spot: "fishing"
    };
    return skillMap[resourceType] || "woodcutting";
  }
  /**
   * Get resource drops
   */
  getResourceDrops(resourceType) {
    const dropMap = {
      tree: [{ itemId: 1511, quantity: 1 }],
      // Logs
      oak_tree: [{ itemId: 1521, quantity: 1 }],
      // Oak logs
      rock: [{ itemId: 436, quantity: 1 }],
      // Copper ore
      iron_rock: [{ itemId: 440, quantity: 1 }]
      // Iron ore
    };
    return dropMap[resourceType] || [];
  }
  /**
   * Get resource model
   */
  getResourceModel(resourceType) {
    const modelMap = {
      tree: "models/tree_normal.glb",
      oak_tree: "models/tree_oak.glb",
      rock: "models/rock_normal.glb",
      iron_rock: "models/rock_iron.glb"
    };
    return modelMap[resourceType] || "models/tree_normal.glb";
  }
  /**
   * Spawn chest entity
   */
  spawnChest(definition, position, spawner) {
    const chestId = `chest_${Date.now()}_${Math.random()}`;
    const chest = new RPGEntity4(this.world, "chest", {
      id: chestId,
      type: "chest",
      position,
      chestType: definition.entityType,
      spawnPointId: spawner.id,
      locked: definition.metadata?.locked || false,
      keyRequired: definition.metadata?.keyRequired || null
    });
    const chestComponent = {
      type: "chest",
      chestType: definition.entityType,
      lootTable: definition.metadata?.lootTable || "chest_common",
      locked: definition.metadata?.locked || false,
      keyRequired: definition.metadata?.keyRequired || null,
      opened: false,
      respawnTime: spawner.respawnTime || 3e5
      // 5 minutes
    };
    chest.components.set("chest", chestComponent);
    chest.components.set("visual", {
      type: "visual",
      model: this.getChestModel(definition.entityType),
      scale: definition.metadata?.scale || 1
    });
    chest.components.set("interactable", {
      type: "interactable",
      interactionType: "open",
      range: 2
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(chestId, chest);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(chestId, chest);
    }
    if (this.visualSystem) {
      this.visualSystem.createVisual(chest, "chest");
    }
    return chest;
  }
  /**
   * Get chest model
   */
  getChestModel(chestType) {
    const modelMap = {
      chest_common: "models/chest_wooden.glb",
      chest_rare: "models/chest_ornate.glb",
      chest_epic: "models/chest_golden.glb"
    };
    return modelMap[chestType] || "models/chest_wooden.glb";
  }
  /**
   * Spawn boss entity
   */
  spawnBoss(definition, position, spawner) {
    const bossId = `boss_${Date.now()}_${Math.random()}`;
    const bossDef = this.getBossDefinition(definition.entityType);
    if (!bossDef) {
      return null;
    }
    const boss = new RPGEntity4(this.world, "npc", {
      id: bossId,
      type: "npc",
      position,
      npcId: bossDef.id,
      spawnPointId: spawner.id
    });
    const npcComponent = {
      type: "npc",
      npcId: bossDef.id,
      name: bossDef.name,
      examine: bossDef.examine,
      npcType: "boss" /* BOSS */,
      behavior: "aggressive" /* AGGRESSIVE */,
      faction: bossDef.faction || "hostile",
      state: "idle" /* IDLE */,
      level: bossDef.level,
      combatLevel: bossDef.combatLevel,
      maxHitpoints: bossDef.maxHitpoints,
      currentHitpoints: bossDef.maxHitpoints,
      attackStyle: bossDef.attackStyle || "melee" /* MELEE */,
      aggressionLevel: 100,
      aggressionRange: bossDef.aggressionRange || 10,
      attackBonus: bossDef.combat.attackBonus,
      strengthBonus: bossDef.combat.strengthBonus,
      defenseBonus: bossDef.combat.defenseBonus,
      maxHit: bossDef.combat.maxHit,
      attackSpeed: bossDef.combat.attackSpeed,
      respawnTime: spawner.respawnTime || 6e5,
      // 10 minutes
      wanderRadius: 0,
      // Bosses don't wander
      spawnPoint: position,
      lootTable: bossDef.lootTable,
      currentTarget: null,
      lastInteraction: 0
    };
    boss.components.set("npc", npcComponent);
    boss.components.set("boss", {
      type: "boss",
      phase: 1,
      maxPhases: bossDef.phases || 1,
      specialAttacks: bossDef.specialAttacks || [],
      immunities: bossDef.immunities || [],
      mechanics: bossDef.mechanics || []
    });
    boss.components.set("stats", this.createBossStats(bossDef));
    boss.components.set("movement", {
      type: "movement",
      position: { ...position },
      destination: null,
      targetPosition: null,
      path: [],
      currentSpeed: 0,
      moveSpeed: bossDef.moveSpeed || 3,
      isMoving: false,
      canMove: true,
      runEnergy: 100,
      isRunning: false,
      facingDirection: 0,
      pathfindingFlags: 0,
      lastMoveTime: 0,
      teleportDestination: null,
      teleportTime: 0,
      teleportAnimation: ""
    });
    boss.components.set("visual", {
      type: "visual",
      model: bossDef.model || "models/boss_default.glb",
      scale: bossDef.scale || 2
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(bossId, boss);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(bossId, boss);
    }
    if (this.visualSystem) {
      this.visualSystem.createVisual(boss, definition.entityType);
    }
    this.emit("boss:spawned", {
      bossId,
      bossName: bossDef.name,
      position
    });
    return boss;
  }
  /**
   * Get boss definition
   */
  getBossDefinition(bossType) {
    const bosses = {
      king_black_dragon: {
        id: 239,
        name: "King Black Dragon",
        examine: "The biggest, meanest dragon around!",
        level: 276,
        combatLevel: 276,
        maxHitpoints: 240,
        attackStyle: "magic" /* MAGIC */,
        aggressionRange: 15,
        combat: {
          attackBonus: 240,
          strengthBonus: 240,
          defenseBonus: 240,
          maxHit: 25,
          attackSpeed: 4
        },
        lootTable: "kbd_drops",
        phases: 1,
        specialAttacks: ["dragonfire", "poison_breath", "freeze_breath"],
        model: "models/boss_kbd.glb",
        scale: 3
      }
    };
    return bosses[bossType];
  }
  /**
   * Create boss stats
   */
  createBossStats(bossDef) {
    return {
      type: "stats",
      hitpoints: {
        current: bossDef.maxHitpoints,
        max: bossDef.maxHitpoints,
        level: 99,
        xp: 13034431
      },
      attack: { level: 99, xp: 13034431 },
      strength: { level: 99, xp: 13034431 },
      defense: { level: 99, xp: 13034431 },
      ranged: { level: 99, xp: 13034431 },
      magic: { level: 99, xp: 13034431 },
      prayer: {
        level: 99,
        xp: 13034431,
        points: 99,
        maxPoints: 99
      },
      combatBonuses: {
        attackStab: bossDef.combat.attackBonus,
        attackSlash: bossDef.combat.attackBonus,
        attackCrush: bossDef.combat.attackBonus,
        attackMagic: bossDef.combat.attackBonus,
        attackRanged: bossDef.combat.attackBonus,
        defenseStab: bossDef.combat.defenseBonus,
        defenseSlash: bossDef.combat.defenseBonus,
        defenseCrush: bossDef.combat.defenseBonus,
        defenseMagic: bossDef.combat.defenseBonus,
        defenseRanged: bossDef.combat.defenseBonus,
        meleeStrength: bossDef.combat.strengthBonus,
        rangedStrength: bossDef.combat.strengthBonus,
        magicDamage: bossDef.combat.strengthBonus,
        prayerBonus: 0
      },
      combatLevel: bossDef.combatLevel,
      totalLevel: 2277
    };
  }
  /**
   * Register spawn
   */
  registerSpawn(spawner, entity) {
    const entityId = entity.id || entity.data?.id;
    spawner.activeEntities.add(entityId);
    this.activeSpawns.set(entityId, spawner.id);
  }
  /**
   * Handle entity death
   */
  handleEntityDeath(entityId) {
    const spawnerId = this.activeSpawns.get(entityId);
    if (!spawnerId) {
      return;
    }
    const spawner = this.spawners.get(spawnerId);
    if (!spawner) {
      return;
    }
    spawner.activeEntities.delete(entityId);
    this.activeSpawns.delete(entityId);
    this.scheduleRespawn(spawner);
  }
  /**
   * Handle entity despawn
   */
  handleEntityDespawn(entityId) {
    this.handleEntityDeath(entityId);
  }
  /**
   * Schedule respawn
   */
  scheduleRespawn(spawner) {
    const task = {
      spawnerId: spawner.id,
      scheduledTime: Date.now() + spawner.respawnTime,
      priority: 1
    };
    this.spawnQueue.push(task);
    this.spawnQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
  }
  /**
   * Process spawn queue
   */
  processSpawnQueue(now) {
    while (this.spawnQueue.length > 0) {
      const task = this.spawnQueue[0];
      if (!task || task.scheduledTime > now) {
        break;
      }
      this.spawnQueue.shift();
      this.executeSpawnTask(task);
    }
  }
  /**
   * Execute spawn task
   */
  executeSpawnTask(task) {
    const spawner = this.spawners.get(task.spawnerId);
    if (!spawner) {
      return;
    }
    if (spawner.isActive && this.shouldSpawn(spawner)) {
      this.spawnFromSpawner(spawner);
    }
  }
  /**
   * Clean up destroyed entities
   */
  cleanupDestroyedEntities() {
    const toRemove = [];
    for (const [entityId, _spawnerId] of this.activeSpawns) {
      const entity = this.getEntity(entityId);
      if (!entity) {
        toRemove.push(entityId);
      }
    }
    for (const entityId of toRemove) {
      this.handleEntityDeath(entityId);
    }
  }
  /**
   * Get entity by ID
   */
  getEntity(entityId) {
    if (this.world.entities?.items) {
      return this.world.entities.items.get(entityId);
    }
    const entity = this.world.entities?.get?.(entityId);
    if (!entity || typeof entity.getComponent !== "function") {
      return void 0;
    }
    return entity;
  }
  /**
   * Get entities near position
   */
  getEntitiesNear(position, range) {
    const entities = this.spatialQuery(position, range);
    const rpgEntities = [];
    for (const entity of entities) {
      if (entity && typeof entity.getComponent === "function") {
        rpgEntities.push(entity);
      }
    }
    return rpgEntities;
  }
  /**
   * Check if spawn position is valid
   */
  isValidSpawnPosition(position, spawner) {
    if (!this.isTerrainWalkable(position)) {
      return false;
    }
    if (spawner.spawnArea && !spawner.spawnArea.isValidPosition(position)) {
      return false;
    }
    return true;
  }
  /**
   * Get ground height at position
   */
  getGroundHeight(position) {
    return this.getTerrainHeight(position);
  }
  /**
   * Check line of sight
   */
  hasLineOfSight(from, to) {
    const physics = this.world.physics;
    if (!physics) {
      return true;
    }
    const rayStart = new THREE.Vector3(from.x, from.y, from.z);
    const rayEnd = new THREE.Vector3(to.x, to.y, to.z);
    const rayDirection = new THREE.Vector3().subVectors(rayEnd, rayStart).normalize();
    const maxDistance = this.getDistance(from, to);
    const hit = physics.raycast(rayStart, rayDirection, maxDistance);
    return !hit;
  }
  /**
   * Calculate distance between two positions
   */
  getDistance(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /**
   * Handle spawner activation
   */
  onSpawnerActivated(spawner) {
    console.log(`[SpawningSystem] Spawner ${spawner.id} activated`);
    const entitiesToSpawn = spawner.maxEntities - spawner.activeEntities.size;
    for (let i = 0; i < entitiesToSpawn; i++) {
      const originalLastSpawnTime = spawner.lastSpawnTime;
      spawner.lastSpawnTime = 0;
      if (this.shouldSpawn(spawner)) {
        this.spawnFromSpawner(spawner);
      } else {
        spawner.lastSpawnTime = originalLastSpawnTime;
        break;
      }
    }
  }
  /**
   * Handle spawner deactivation
   */
  onSpawnerDeactivated(spawner) {
    console.log(`[SpawningSystem] Spawner ${spawner.id} deactivated`);
  }
  /**
   * Register default spawners for testing
   */
  registerDefaultSpawners() {
    console.log("[SpawningSystem] Registering default spawners near spawn point...");
    const goblinSpawnerId = this.registerSpawner({
      type: "npc" /* NPC */,
      position: { x: 5, y: 0, z: 5 },
      entityDefinitions: [
        {
          entityType: "npc",
          entityId: 1,
          // Goblin ID
          weight: 100
        }
      ],
      maxEntities: 2,
      respawnTime: 8e3,
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 5, y: 0, z: 5 }, 3, 1)
    });
    const guardSpawnerId = this.registerSpawner({
      type: "npc" /* NPC */,
      position: { x: -5, y: 0, z: -5 },
      entityDefinitions: [
        {
          entityType: "npc",
          entityId: 2,
          // Guard ID
          weight: 100
        }
      ],
      maxEntities: 1,
      respawnTime: 1e4,
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: -5, y: 0, z: -5 }, 2, 1)
    });
    const questNpcSpawnerId = this.registerSpawner({
      type: "npc" /* NPC */,
      position: { x: 0, y: 0, z: 5 },
      entityDefinitions: [
        {
          entityType: "npc",
          entityId: 100,
          // Quest Giver ID
          weight: 100
        }
      ],
      maxEntities: 1,
      respawnTime: 999999,
      // Never respawn
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 0, y: 0, z: 5 }, 1, 0)
    });
    const chestSpawnerId = this.registerSpawner({
      type: "chest" /* CHEST */,
      position: { x: 8, y: 0, z: -8 },
      entityDefinitions: [
        {
          entityType: "chest_common",
          weight: 100,
          metadata: {
            lootTable: "chest_common",
            locked: false
          }
        }
      ],
      maxEntities: 1,
      respawnTime: 6e4,
      // 1 minute
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 8, y: 0, z: -8 }, 1, 0)
    });
    const rareChestSpawnerId = this.registerSpawner({
      type: "chest" /* CHEST */,
      position: { x: -8, y: 0, z: 8 },
      entityDefinitions: [
        {
          entityType: "chest_rare",
          weight: 100,
          metadata: {
            lootTable: "chest_rare",
            locked: true,
            keyRequired: "brass_key"
          }
        }
      ],
      maxEntities: 1,
      respawnTime: 3e5,
      // 5 minutes
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: -8, y: 0, z: 8 }, 1, 0)
    });
    const swordSpawnerId = this.registerSpawner({
      type: "resource" /* RESOURCE */,
      // Using resource type for items
      position: { x: 0, y: 0, z: 0 },
      entityDefinitions: [
        {
          entityType: "sword",
          weight: 100
        }
      ],
      maxEntities: 1,
      respawnTime: 1e4,
      // 10 seconds
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 0, y: 0, z: 0 }, 1, 0)
    });
    const treeSpawnerId = this.registerSpawner({
      type: "resource" /* RESOURCE */,
      position: { x: 12, y: 0, z: 0 },
      entityDefinitions: [
        {
          entityType: "tree",
          weight: 70
        },
        {
          entityType: "oak_tree",
          weight: 30
        }
      ],
      maxEntities: 3,
      respawnTime: 3e4,
      // 30 seconds
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 12, y: 0, z: 0 }, 5, 2)
    });
    const rockSpawnerId = this.registerSpawner({
      type: "resource" /* RESOURCE */,
      position: { x: -12, y: 0, z: 0 },
      entityDefinitions: [
        {
          entityType: "rock",
          weight: 60
        },
        {
          entityType: "iron_rock",
          weight: 40
        }
      ],
      maxEntities: 2,
      respawnTime: 45e3,
      // 45 seconds
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: -12, y: 0, z: 0 }, 4, 2)
    });
    const bossSpawnerId = this.registerSpawner({
      type: "boss" /* BOSS */,
      position: { x: 0, y: 0, z: 20 },
      entityDefinitions: [
        {
          entityType: "king_black_dragon",
          weight: 100
        }
      ],
      maxEntities: 1,
      respawnTime: 6e5,
      // 10 minutes
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 0, y: 0, z: 20 }, 2, 0)
    });
    const mixedMobSpawnerId = this.registerSpawner({
      type: "npc" /* NPC */,
      position: { x: 0, y: 0, z: -15 },
      entityDefinitions: [
        {
          entityType: "npc",
          entityId: 1,
          // Goblin
          weight: 50
        },
        {
          entityType: "npc",
          entityId: 2,
          // Guard
          weight: 30
        },
        {
          entityType: "npc",
          entityId: 3,
          // Cow
          weight: 20
        }
      ],
      maxEntities: 4,
      respawnTime: 12e3,
      activationRange: 200,
      spawnArea: new CircularSpawnArea({ x: 0, y: 0, z: -15 }, 8, 2)
    });
    const spawnerIds = [
      goblinSpawnerId,
      guardSpawnerId,
      questNpcSpawnerId,
      chestSpawnerId,
      rareChestSpawnerId,
      swordSpawnerId,
      treeSpawnerId,
      rockSpawnerId,
      bossSpawnerId,
      mixedMobSpawnerId
    ];
    setTimeout(() => {
      console.log("[SpawningSystem] Force activating all test spawners...");
      for (const spawnerId of spawnerIds) {
        const spawner = this.spawners.get(spawnerId);
        if (spawner) {
          console.log(`[SpawningSystem] Force activating spawner ${spawnerId} (${spawner.type})`);
          spawner.isActive = true;
          const entitiesToSpawn = spawner.maxEntities;
          for (let i = 0; i < entitiesToSpawn; i++) {
            const originalLastSpawnTime = spawner.lastSpawnTime;
            spawner.lastSpawnTime = 0;
            if (this.shouldSpawn(spawner)) {
              this.spawnFromSpawner(spawner);
            } else {
              spawner.lastSpawnTime = originalLastSpawnTime;
              break;
            }
          }
        }
      }
      console.log("[SpawningSystem] All test spawners activated and initial entities spawned");
    }, 2e3);
    console.log(`[SpawningSystem] Registered ${spawnerIds.length} test spawners near spawn point`);
  }
  /**
   * Check if position is available for spawning
   */
  isPositionAvailable(position, radius) {
    const nearbyEntities = this.spatialQuery(position, radius);
    for (const entity of nearbyEntities) {
      const collider = entity.getComponent("collider");
      if (collider && collider.blocking) {
        return false;
      }
    }
    if (!this.isTerrainWalkable(position)) {
      return false;
    }
    return true;
  }
  /**
   * Perform spatial query to find entities within radius
   */
  spatialQuery(position, radius) {
    const results = [];
    const spatialIndex = this.world.spatialIndex;
    if (spatialIndex) {
      return spatialIndex.query(position, radius);
    }
    const radiusSquared = radius * radius;
    for (const entity of this.world.entities.items.values()) {
      if (!entity.position) {
        continue;
      }
      const dx = entity.position.x - position.x;
      const dy = entity.position.y - position.y;
      const dz = entity.position.z - position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared <= radiusSquared) {
        results.push(entity);
      }
    }
    return results;
  }
  /**
   * Check if terrain is walkable at position
   */
  isTerrainWalkable(position) {
    const collisionMap = this.world.collisionMap;
    if (collisionMap) {
      const tileX = Math.floor(position.x);
      const tileZ = Math.floor(position.z);
      if (collisionMap[tileZ] && collisionMap[tileZ][tileX]) {
        return false;
      }
    }
    const terrainHeight = this.getTerrainHeight(position);
    if (Math.abs(position.y - terrainHeight) > 0.5) {
      return false;
    }
    return true;
  }
  /**
   * Get terrain height at position
   */
  getTerrainHeight(position) {
    const terrain = this.world.terrain;
    if (terrain && terrain.getHeightAt) {
      return terrain.getHeightAt(position.x, position.z);
    }
    const rayHeight = this.raycastGround(position);
    if (rayHeight !== null) {
      return rayHeight;
    }
    return 0;
  }
  /**
   * Raycast to find ground level
   */
  raycastGround(position) {
    const physics = this.world.physics;
    if (!physics) {
      return null;
    }
    const rayStart = new THREE.Vector3(position.x, position.y + 100, position.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    const hit = physics.raycast(rayStart, rayDirection, 200);
    if (hit) {
      return hit.point.y;
    }
    return null;
  }
};

// src/rpg/entities/NPCEntity.ts
var NPCEntity = class extends RPGEntity4 {
  constructor(world, id, data) {
    super(world, "npc", {
      id,
      position: data.position,
      definition: data.definition
    });
    this.lastInteraction = 0;
    this.currentTarget = null;
    this.deathTime = 0;
    this.aiState = "idle";
    this.stateTimer = 0;
    this.spawnPoint = { ...data.position };
  }
  /**
   * Get the NPC component
   */
  getNPCComponent() {
    return this.getComponent("npc");
  }
  /**
   * Update position
   */
  setPosition(position) {
    this.position = { ...position };
    const movement = this.getComponent("movement");
    if (movement) {
      movement.position = { ...position };
    }
    this.data.position = position;
  }
  /**
   * Check if NPC is alive
   */
  isAlive() {
    const npc = this.getNPCComponent();
    return npc ? npc.currentHitpoints > 0 : false;
  }
  /**
   * Take damage
   */
  takeDamage(damage) {
    const npc = this.getNPCComponent();
    if (!npc) {
      return;
    }
    npc.currentHitpoints = Math.max(0, npc.currentHitpoints - damage);
    if (npc.currentHitpoints <= 0) {
      this.die();
    }
  }
  /**
   * Handle death
   */
  die() {
    const npc = this.getNPCComponent();
    if (!npc) {
      return;
    }
    npc.state = "dead";
    this.world.events.emit("entity:death", {
      entityId: this.id,
      entityType: "npc",
      position: this.position
    });
  }
  /**
   * Respawn the NPC
   */
  respawn() {
    const npc = this.getNPCComponent();
    if (!npc) {
      return;
    }
    npc.currentHitpoints = npc.maxHitpoints;
    npc.state = "idle";
    if (npc.spawnPoint) {
      this.setPosition(npc.spawnPoint);
    }
    npc.currentTarget = null;
  }
  /**
   * Check if player is in interaction range
   */
  isInInteractionRange(playerPosition, range = 3) {
    const dx = this.position.x - playerPosition.x;
    const dy = this.position.y - playerPosition.y;
    const dz = this.position.z - playerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance <= range;
  }
};

// src/rpg/systems/npc/NPCBehaviorManager.ts
var NPCBehaviorManager = class {
  constructor(world) {
    this.movementSystem = null;
    // Behavior update intervals
    this.BEHAVIOR_UPDATE_INTERVAL = 500;
    // 500ms
    this.lastBehaviorUpdate = /* @__PURE__ */ new Map();
    this.world = world;
  }
  /**
   * Initialize the behavior manager - called after all systems are ready
   */
  init() {
    this.movementSystem = this.world.movement || {
      moveEntity: (id, pos) => {
        const entity = this.world.entities.get?.(id);
        if (entity) {
          entity.position = pos;
        }
      }
    };
  }
  /**
   * Update NPC behavior
   */
  updateBehavior(npc, _delta) {
    if (!this.movementSystem) {
      this.init();
    }
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent) {
      return;
    }
    const lastUpdate = this.lastBehaviorUpdate.get(npc.id) || 0;
    const now = Date.now();
    if (now - lastUpdate < this.BEHAVIOR_UPDATE_INTERVAL) {
      return;
    }
    this.lastBehaviorUpdate.set(npc.id, now);
    switch (npcComponent.behavior) {
      case "aggressive" /* AGGRESSIVE */:
        this.updateAggressiveBehavior(npc, npcComponent);
        break;
      case "defensive" /* DEFENSIVE */:
        this.updateDefensiveBehavior(npc, npcComponent);
        break;
      case "passive" /* PASSIVE */:
        this.updatePassiveBehavior(npc, npcComponent);
        break;
      case "friendly" /* FRIENDLY */:
        this.updateFriendlyBehavior(npc, npcComponent);
        break;
      case "patrol" /* PATROL */:
        this.updatePatrolBehavior(npc, npcComponent);
        break;
      case "wander" /* WANDER */:
        this.updateWanderBehavior(npc, npcComponent);
        break;
    }
    this.updateMovement(npc, npcComponent);
  }
  /**
   * Aggressive behavior - attacks players on sight
   */
  updateAggressiveBehavior(npc, npcComponent) {
    if (npcComponent.state === "combat" /* COMBAT */) {
      if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
        this.findNewTarget(npc, npcComponent);
      }
      return;
    }
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return;
    }
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
    for (const player of nearbyPlayers) {
      if (this.canAttackPlayer(npc, player)) {
        const playerId = player.id;
        this.startCombat(npc, npcComponent, playerId);
        break;
      }
    }
    if (npcComponent.state === "idle" /* IDLE */) {
      this.startWandering(npc, npcComponent);
    }
  }
  /**
   * Defensive behavior - only attacks when attacked
   */
  updateDefensiveBehavior(npc, npcComponent) {
    if (npcComponent.state === "combat" /* COMBAT */) {
      if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
        npcComponent.state = "idle" /* IDLE */;
        npcComponent.currentTarget = null;
      }
      return;
    }
    const npcPos = this.getEntityPosition(npc);
    if (npcPos && this.getDistance(npcPos, npcComponent.spawnPoint) > npcComponent.wanderRadius * 2) {
      this.moveToPosition(npc, npcComponent.spawnPoint);
    }
  }
  /**
   * Passive behavior - never attacks
   */
  updatePassiveBehavior(npc, npcComponent) {
    const combat = npc.getComponent("combat");
    if (combat?.inCombat) {
      this.flee(npc, npcComponent);
      return;
    }
    if (npcComponent.state === "idle" /* IDLE */) {
      this.startWandering(npc, npcComponent);
    }
  }
  /**
   * Friendly behavior - interactable NPCs
   */
  updateFriendlyBehavior(npc, _npcComponent) {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return;
    }
    const nearbyPlayers = this.getPlayersInRange(npcPos, 5);
    if (nearbyPlayers.length > 0) {
      const closest = this.getClosestPlayer(npcPos, nearbyPlayers);
      if (closest) {
        const closestPos = this.getEntityPosition(closest);
        if (closestPos) {
          this.faceEntity(npc, { position: closestPos });
        }
      }
    }
  }
  /**
   * Patrol behavior - follows waypoints
   */
  updatePatrolBehavior(npc, npcComponent) {
    this.executePatrol(npc, npcComponent);
  }
  /**
   * Wander behavior - random movement
   */
  updateWanderBehavior(npc, npcComponent) {
    const movement = npc.getComponent("movement");
    if (!movement) {
      return;
    }
    if (!movement.destination || this.hasReachedDestination(npc, movement)) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * npcComponent.wanderRadius;
      const newDestination = {
        x: npcComponent.spawnPoint.x + Math.cos(angle) * distance,
        y: npcComponent.spawnPoint.y,
        z: npcComponent.spawnPoint.z + Math.sin(angle) * distance
      };
      movement.destination = newDestination;
      npcComponent.state = "wandering" /* WANDERING */;
    }
  }
  /**
   * Update movement towards destination
   */
  updateMovement(npc, npcComponent) {
    const movement = npc.getComponent("movement");
    if (!movement || !movement.destination) {
      return;
    }
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return;
    }
    const dx = movement.destination.x - npcPos.x;
    const dz = movement.destination.z - npcPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 0.5) {
      movement.destination = null;
      movement.isMoving = false;
      if (npcComponent.state === "wandering" /* WANDERING */) {
        npcComponent.state = "idle" /* IDLE */;
      }
      return;
    }
    if (this.movementSystem && typeof this.movementSystem.moveEntity === "function") {
      this.movementSystem.moveEntity(npc.id, movement.destination);
    } else {
      const speed = movement.moveSpeed * 0.016;
      const moveX = dx / distance * speed;
      const moveZ = dz / distance * speed;
      const newPosition = {
        x: npcPos.x + moveX,
        y: npcPos.y,
        z: npcPos.z + moveZ
      };
      npc.position = newPosition;
      movement.position = newPosition;
    }
    movement.isMoving = true;
  }
  /**
   * Start combat with a target
   */
  startCombat(npc, npcComponent, targetId) {
    npcComponent.currentTarget = targetId;
    npcComponent.state = "combat" /* COMBAT */;
    this.world.events.emit("combat:start", {
      attackerId: npc.id,
      targetId
    });
  }
  /**
   * Find a new target
   */
  findNewTarget(npc, npcComponent) {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return;
    }
    const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
    for (const player of nearbyPlayers) {
      if (this.canAttackPlayer(npc, player)) {
        npcComponent.currentTarget = player.id;
        return;
      }
    }
    npcComponent.currentTarget = null;
    npcComponent.state = "idle" /* IDLE */;
  }
  /**
   * Make NPC flee from danger
   */
  flee(npc, npcComponent) {
    const combat = npc.getComponent("combat");
    if (!combat || !combat.target) {
      return;
    }
    const attacker = this.getEntity(combat.target);
    if (!attacker) {
      return;
    }
    const npcPos = this.getEntityPosition(npc);
    const attackerPos = this.getEntityPosition(attacker);
    if (!npcPos || !attackerPos) {
      return;
    }
    const dx = npcPos.x - attackerPos.x;
    const dz = npcPos.z - attackerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance === 0) {
      return;
    }
    const fleeDistance = 10;
    const fleePoint = {
      x: npcPos.x + dx / distance * fleeDistance,
      y: npcPos.y,
      z: npcPos.z + dz / distance * fleeDistance
    };
    this.moveToPosition(npc, fleePoint);
    npcComponent.state = "fleeing" /* FLEEING */;
  }
  /**
   * Move to a specific position
   */
  moveToPosition(npc, position) {
    const movement = npc.getComponent("movement");
    if (!movement) {
      return;
    }
    movement.destination = { ...position };
    movement.isMoving = true;
  }
  /**
   * Make NPC face another entity
   */
  faceEntity(npc, target) {
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return;
    }
    const dx = target.position.x - npcPos.x;
    const dz = target.position.z - npcPos.z;
    const angle = Math.atan2(dz, dx);
    const movement = npc.getComponent("movement");
    if (movement) {
      movement.facingDirection = angle;
    }
  }
  /**
   * Start wandering behavior
   */
  startWandering(npc, npcComponent) {
    if (Math.random() < 0.1) {
      npcComponent.state = "wandering" /* WANDERING */;
      this.updateWanderBehavior(npc, npcComponent);
    }
  }
  /**
   * Check if target is valid
   */
  isValidTarget(npc, targetId) {
    if (!targetId) {
      return false;
    }
    const target = this.getEntity(targetId);
    if (!target) {
      return false;
    }
    const stats = target.getComponent("stats");
    if (stats && stats.hitpoints?.current <= 0) {
      return false;
    }
    const npcPos = this.getEntityPosition(npc);
    const targetPos = this.getEntityPosition(target);
    if (!npcPos || !targetPos) {
      return false;
    }
    const distance = this.getDistance(npcPos, targetPos);
    if (distance > 20) {
      return false;
    }
    return true;
  }
  /**
   * Check if NPC can attack player
   */
  canAttackPlayer(npc, player) {
    const stats = player.getComponent("stats");
    if (stats && stats.hitpoints?.current <= 0) {
      return false;
    }
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent) {
      return false;
    }
    const playerLevel = stats?.combatLevel || 1;
    const levelDiff = playerLevel - npcComponent.combatLevel;
    if (levelDiff > npcComponent.aggressionLevel * 10) {
      return false;
    }
    return true;
  }
  /**
   * Check if reached destination
   */
  hasReachedDestination(npc, movement) {
    if (!movement.destination) {
      return true;
    }
    const npcPos = this.getEntityPosition(npc);
    if (!npcPos) {
      return true;
    }
    const distance = this.getDistance(npcPos, movement.destination);
    return distance < 0.5;
  }
  /**
   * Get players in range
   */
  getPlayersInRange(position, range) {
    const nearbyEntities = this.spatialQuery(position, range);
    const players = [];
    for (const entity of nearbyEntities) {
      if (this.isPlayer(entity)) {
        players.push(entity);
      }
    }
    return players;
  }
  /**
   * Get closest player from list
   */
  getClosestPlayer(position, players) {
    let closest = null;
    let minDistance = Infinity;
    for (const player of players) {
      const playerPos = this.getEntityPosition(player);
      if (playerPos) {
        const distance = this.getDistance(position, playerPos);
        if (distance < minDistance) {
          minDistance = distance;
          closest = player;
        }
      }
    }
    return closest;
  }
  /**
   * Get entity position
   */
  getEntityPosition(entity) {
    if (entity.position && typeof entity.position === "object") {
      return entity.position;
    }
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    return null;
  }
  /**
   * Get entity from world
   */
  getEntity(entityId) {
    if (this.world.entities.items instanceof Map) {
      return this.world.entities.items.get(entityId);
    }
    return this.world.entities.get?.(entityId);
  }
  /**
   * Check if entity is a player
   */
  isPlayer(entity) {
    return entity.type === "player" || entity.data?.type === "player";
  }
  /**
   * Calculate distance between positions
   */
  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /**
   * Execute patrol behavior
   */
  executePatrol(npc, component) {
    const movement = npc.getComponent("movement");
    if (!movement) {
      return;
    }
    if (!movement.destination || this.hasReachedDestination(npc, movement)) {
      const waypoints = this.generateDefaultWaypoints(component.spawnPoint);
      const nextWaypoint = waypoints[Math.floor(Math.random() * waypoints.length)];
      this.moveToPosition(npc, nextWaypoint);
    }
  }
  /**
   * Generate default waypoints for patrol
   */
  generateDefaultWaypoints(spawnPoint) {
    const waypoints = [];
    const radius = 10;
    waypoints.push({ x: spawnPoint.x + radius, y: spawnPoint.y, z: spawnPoint.z });
    waypoints.push({ x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z + radius });
    waypoints.push({ x: spawnPoint.x - radius, y: spawnPoint.y, z: spawnPoint.z });
    waypoints.push({ x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z - radius });
    return waypoints;
  }
  /**
   * Spatial query for nearby entities
   */
  spatialQuery(position, radius) {
    const spatialIndex = this.world.spatialIndex;
    if (spatialIndex && typeof spatialIndex.query === "function") {
      return spatialIndex.query({
        position: { x: position.x, y: position.y, z: position.z },
        radius
      });
    }
    const entities = [];
    const entityMap = this.world.entities.items || /* @__PURE__ */ new Map();
    for (const entity of entityMap.values()) {
      if (!entity) {
        continue;
      }
      const entityPos = this.getEntityPosition(entity);
      if (entityPos && this.getDistance(position, entityPos) <= radius) {
        entities.push(entity);
      }
    }
    return entities;
  }
};

// src/rpg/systems/npc/NPCDialogueManager.ts
var NPCDialogueManager = class {
  constructor(world) {
    this.sessions = /* @__PURE__ */ new Map();
    this.dialogues = /* @__PURE__ */ new Map();
    this.world = world;
    this.registerDefaultDialogues();
  }
  /**
   * Update dialogue sessions
   */
  update(_delta) {
    const now = Date.now();
    for (const [_sessionId, session] of this.sessions) {
      if (now - session.startTime > 3e5) {
        this.endDialogue(session.playerId);
      }
    }
  }
  /**
   * Start dialogue between player and NPC
   */
  startDialogue(playerId, npcId) {
    if (this.sessions.has(playerId)) {
      this.endDialogue(playerId);
    }
    const npc = this.getNPC(npcId);
    if (!npc) {
      return;
    }
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent || !npcComponent.dialogue) {
      return;
    }
    const session = {
      playerId,
      npcId,
      currentNode: "start",
      startTime: Date.now(),
      variables: /* @__PURE__ */ new Map()
    };
    this.sessions.set(playerId, session);
    this.sendDialogueNode(playerId, session);
    this.world.events.emit("dialogue:start", {
      playerId,
      npcId
    });
  }
  /**
   * Handle player dialogue choice
   */
  handleChoice(playerId, optionIndex) {
    const session = this.sessions.get(playerId);
    if (!session) {
      return;
    }
    const dialogue = this.getDialogue(session.npcId, session.currentNode);
    if (!dialogue || !dialogue.options || optionIndex >= dialogue.options.length) {
      this.endDialogue(playerId);
      return;
    }
    const option = dialogue.options[optionIndex];
    if (!option) {
      this.endDialogue(playerId);
      return;
    }
    if (option.condition && !option.condition()) {
      this.sendMessage(playerId, "You can't do that right now.");
      return;
    }
    if (option.action) {
      option.action();
    }
    if (option.nextNode === "end") {
      this.endDialogue(playerId);
    } else {
      session.currentNode = option.nextNode;
      this.sendDialogueNode(playerId, session);
    }
  }
  /**
   * End dialogue session
   */
  endDialogue(playerId) {
    const session = this.sessions.get(playerId);
    if (!session) {
      return;
    }
    this.sessions.delete(playerId);
    this.world.events.emit("dialogue:end", {
      playerId,
      npcId: session.npcId
    });
  }
  /**
   * Send dialogue node to player
   */
  sendDialogueNode(playerId, session) {
    const dialogue = this.getDialogue(session.npcId, session.currentNode);
    if (!dialogue) {
      this.endDialogue(playerId);
      return;
    }
    if (dialogue.condition && !dialogue.condition()) {
      this.endDialogue(playerId);
      return;
    }
    if (dialogue.action) {
      dialogue.action();
    }
    const options = dialogue.options?.filter((opt) => !opt.condition || opt.condition()).map((opt) => opt.text) || [];
    this.world.events.emit("dialogue:node", {
      playerId,
      npcId: session.npcId,
      text: dialogue.text,
      options
    });
  }
  /**
   * Register dialogue for an NPC
   */
  registerDialogue(npcId, dialogues) {
    this.dialogues.set(npcId, dialogues);
  }
  /**
   * Get dialogue node
   */
  getDialogue(npcId, nodeId) {
    const npcDialogues = this.dialogues.get(npcId);
    return npcDialogues?.get(nodeId);
  }
  /**
   * Get NPC entity
   */
  getNPC(npcId) {
    if (this.world.entities.items instanceof Map) {
      const entity2 = this.world.entities.items.get(npcId);
      if (entity2 && typeof entity2.getComponent === "function") {
        return entity2;
      }
    }
    const entity = this.world.entities.get?.(npcId);
    if (entity && typeof entity.getComponent === "function") {
      return entity;
    }
    return void 0;
  }
  /**
   * Send message to player
   */
  sendMessage(playerId, message) {
    this.world.events.emit("chat:system", {
      targetId: playerId,
      message
    });
  }
  /**
   * Register default dialogues
   */
  registerDefaultDialogues() {
    const shopkeeperDialogue = /* @__PURE__ */ new Map();
    shopkeeperDialogue.set("start", {
      id: "start",
      text: "Welcome to my shop! Would you like to see my wares?",
      options: [
        {
          text: "Yes, show me what you have.",
          nextNode: "shop",
          action: () => {
            this.world.events.emit("shop:open", {
              npcId: "100"
              // Bob's shop
            });
          }
        },
        {
          text: "No thanks.",
          nextNode: "end"
        }
      ]
    });
    shopkeeperDialogue.set("shop", {
      id: "shop",
      text: "Take your time browsing!",
      options: [
        {
          text: "Thanks!",
          nextNode: "end"
        }
      ]
    });
    this.registerDialogue("100", shopkeeperDialogue);
    const questGiverDialogue = /* @__PURE__ */ new Map();
    questGiverDialogue.set("start", {
      id: "start",
      text: "Greetings, adventurer. Our village faces many threats.",
      options: [
        {
          text: "What kind of threats?",
          nextNode: "threats"
        },
        {
          text: "Do you have any quests for me?",
          nextNode: "quests"
        },
        {
          text: "Goodbye.",
          nextNode: "end"
        }
      ]
    });
    questGiverDialogue.set("threats", {
      id: "threats",
      text: "Goblins have been raiding our farms, and strange creatures lurk in the nearby caves.",
      options: [
        {
          text: "I can help with the goblins.",
          nextNode: "goblin_quest"
        },
        {
          text: "Tell me about the caves.",
          nextNode: "cave_info"
        },
        {
          text: "I see.",
          nextNode: "start"
        }
      ]
    });
    questGiverDialogue.set("quests", {
      id: "quests",
      text: "I have several tasks that need doing. Which interests you?",
      options: [
        {
          text: "The goblin problem.",
          nextNode: "goblin_quest"
        },
        {
          text: "Exploring the caves.",
          nextNode: "cave_quest"
        },
        {
          text: "Maybe later.",
          nextNode: "end"
        }
      ]
    });
    questGiverDialogue.set("goblin_quest", {
      id: "goblin_quest",
      text: "Excellent! Please eliminate 10 goblins from the area. They can be found east of here.",
      action: () => {
        this.world.events.emit("quest:start", {
          questId: "goblin_menace",
          npcId: "200"
        });
      },
      options: [
        {
          text: "I'll get right on it!",
          nextNode: "end"
        }
      ]
    });
    this.registerDialogue("200", questGiverDialogue);
  }
};

// src/rpg/systems/npc/NPCSpawnManager.ts
var NPCSpawnManager = class {
  constructor(world, npcSystem) {
    this.spawnPoints = /* @__PURE__ */ new Map();
    this.respawnQueue = [];
    // Persistence
    this.pendingSaves = false;
    this.lastSaveTime = 0;
    this.world = world;
    this.npcSystem = npcSystem;
    this.setupEventListeners();
    this.startAutoSave();
    this.loadSpawnData();
    this.registerDefaultSpawnPoints();
  }
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.world.events.on("world:shutdown", this.handleShutdown.bind(this));
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      if (this.pendingSaves) {
        this.saveSpawnData();
      }
    }, 3e4);
  }
  /**
   * Handle world shutdown
   */
  async handleShutdown() {
    await this.saveSpawnData();
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
  }
  /**
   * Load spawn data from persistence
   */
  async loadSpawnData() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const entities = await persistence.loadWorldEntities();
      for (const entity of entities) {
        if (entity.entityType === "spawn_point") {
          const metadata = entity.metadata || {};
          const spawnPoint = this.spawnPoints.get(entity.entityId);
          if (spawnPoint) {
            spawnPoint.currentCount = metadata.currentCount || 0;
            spawnPoint.lastSpawnTime = metadata.lastSpawnTime ? new Date(metadata.lastSpawnTime).getTime() : 0;
            spawnPoint.active = metadata.active !== false;
          }
        } else if (entity.entityType === "respawn_task") {
          const metadata = entity.metadata || {};
          const task = {
            spawnerId: metadata.spawnerId,
            npcId: metadata.npcId,
            respawnTime: metadata.respawnTime,
            scheduledTime: new Date(metadata.scheduledTime).getTime()
          };
          if (task.scheduledTime > Date.now()) {
            this.respawnQueue.push(task);
          }
        }
      }
      console.log(`[NPCSpawnManager] Loaded ${this.respawnQueue.length} pending respawns`);
    } catch (error) {
      console.error(`[NPCSpawnManager] Failed to load spawn data:`, error);
    }
  }
  /**
   * Save spawn data to persistence
   */
  async saveSpawnData() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const now = Date.now();
    if (now - this.lastSaveTime < 6e4) return;
    try {
      const entities = [];
      for (const [id, spawnPoint] of this.spawnPoints) {
        entities.push({
          entityId: id,
          worldId: this.world.id || "default",
          entityType: "spawn_point",
          position: JSON.stringify(spawnPoint.position),
          metadata: {
            currentCount: spawnPoint.currentCount,
            lastSpawnTime: new Date(spawnPoint.lastSpawnTime).toISOString(),
            active: spawnPoint.active
          }
        });
      }
      for (let i = 0; i < this.respawnQueue.length; i++) {
        const task = this.respawnQueue[i];
        entities.push({
          entityId: `respawn_task_${i}`,
          worldId: this.world.id || "default",
          entityType: "respawn_task",
          position: JSON.stringify({ x: 0, y: 0, z: 0 }),
          metadata: {
            spawnerId: task.spawnerId,
            npcId: task.npcId,
            respawnTime: task.respawnTime,
            scheduledTime: new Date(task.scheduledTime).toISOString()
          }
        });
      }
      await persistence.saveWorldEntities(entities);
      this.pendingSaves = false;
      this.lastSaveTime = now;
      console.log(`[NPCSpawnManager] Saved spawn data`);
    } catch (error) {
      console.error(`[NPCSpawnManager] Failed to save spawn data:`, error);
    }
  }
  /**
   * Mark for save
   */
  markForSave() {
    this.pendingSaves = true;
  }
  /**
   * Update spawn points and respawn queue
   */
  update(_delta) {
    const now = Date.now();
    const tasksToProcess = this.respawnQueue.filter((task) => now >= task.scheduledTime);
    for (const task of tasksToProcess) {
      this.processRespawn(task);
    }
    const oldQueueLength = this.respawnQueue.length;
    this.respawnQueue = this.respawnQueue.filter((task) => now < task.scheduledTime);
    if (this.respawnQueue.length !== oldQueueLength) {
      this.markForSave();
    }
    for (const [_id, spawnPoint] of this.spawnPoints) {
      if (!spawnPoint.active) {
        continue;
      }
      if (spawnPoint.currentCount < spawnPoint.maxCount) {
        if (now - spawnPoint.lastSpawnTime >= spawnPoint.respawnTime) {
          this.spawnAtPoint(spawnPoint);
        }
      }
    }
  }
  /**
   * Register a spawn point
   */
  registerSpawnPoint(config) {
    const spawnPoint = {
      id: config.id,
      position: config.position,
      npcId: config.npcId,
      maxCount: config.maxCount || 1,
      respawnTime: config.respawnTime || 6e4,
      // 1 minute default
      radius: config.radius || 5,
      active: true,
      currentCount: 0,
      lastSpawnTime: 0
    };
    this.spawnPoints.set(config.id, spawnPoint);
    for (let i = 0; i < spawnPoint.maxCount; i++) {
      this.spawnAtPoint(spawnPoint);
    }
  }
  /**
   * Schedule a respawn
   */
  scheduleRespawn(spawnerId, npcId, respawnTime) {
    const task = {
      spawnerId,
      npcId,
      respawnTime,
      scheduledTime: Date.now() + respawnTime
    };
    this.respawnQueue.push(task);
    this.markForSave();
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.currentCount = Math.max(0, spawnPoint.currentCount - 1);
      this.markForSave();
    }
  }
  /**
   * Activate/deactivate spawn point
   */
  setSpawnPointActive(spawnerId, active) {
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.active = active;
      this.markForSave();
    }
  }
  /**
   * Get all spawn points
   */
  getSpawnPoints() {
    return Array.from(this.spawnPoints.values());
  }
  /**
   * Spawn NPC at spawn point
   */
  spawnAtPoint(spawnPoint) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnPoint.radius;
    const position = {
      x: spawnPoint.position.x + Math.cos(angle) * distance,
      y: spawnPoint.position.y,
      z: spawnPoint.position.z + Math.sin(angle) * distance
    };
    const npc = this.npcSystem.spawnNPC(spawnPoint.npcId, position, spawnPoint.id);
    if (npc) {
      spawnPoint.currentCount++;
      spawnPoint.lastSpawnTime = Date.now();
      this.markForSave();
      this.world.events.emit("spawn:npc", {
        spawnerId: spawnPoint.id,
        npcId: npc.id || npc.data?.id,
        position
      });
    }
  }
  /**
   * Process respawn task
   */
  processRespawn(task) {
    const spawnPoint = this.spawnPoints.get(task.spawnerId);
    if (!spawnPoint || !spawnPoint.active) {
      return;
    }
    this.spawnAtPoint(spawnPoint);
  }
  /**
   * Register default spawn points
   */
  registerDefaultSpawnPoints() {
    this.registerSpawnPoint({
      id: "goblin_spawn_1",
      position: { x: 100, y: 0, z: 100 },
      npcId: 1,
      // Goblin
      maxCount: 3,
      respawnTime: 3e4,
      // 30 seconds
      radius: 10
    });
    this.registerSpawnPoint({
      id: "goblin_spawn_2",
      position: { x: 150, y: 0, z: 120 },
      npcId: 1,
      // Goblin
      maxCount: 2,
      respawnTime: 3e4,
      radius: 8
    });
    this.registerSpawnPoint({
      id: "guard_post_1",
      position: { x: 0, y: 0, z: 50 },
      npcId: 2,
      // Guard
      maxCount: 2,
      respawnTime: 6e4,
      // 1 minute
      radius: 2
    });
    this.registerSpawnPoint({
      id: "guard_post_2",
      position: { x: 0, y: 0, z: -50 },
      npcId: 2,
      // Guard
      maxCount: 2,
      respawnTime: 6e4,
      radius: 2
    });
    this.registerSpawnPoint({
      id: "shop_spawn",
      position: { x: -20, y: 0, z: 0 },
      npcId: 100,
      // Bob the shopkeeper
      maxCount: 1,
      respawnTime: 3e5,
      // 5 minutes
      radius: 0
    });
    this.registerSpawnPoint({
      id: "quest_giver_spawn",
      position: { x: 10, y: 0, z: 10 },
      npcId: 200,
      // Elder Grimwald
      maxCount: 1,
      respawnTime: 3e5,
      radius: 0
    });
  }
};

// src/core/env.ts
var isNode = typeof process !== "undefined" && process.versions && process.versions.node;
function getEnvVar(key, defaultValue) {
  if (typeof import.meta?.env !== "undefined") {
    const value = import.meta.env[key];
    if (value !== void 0) {
      return value;
    }
  }
  if (isNode && typeof process.env !== "undefined") {
    const value = process.env[key];
    if (value !== void 0) {
      return value;
    }
  }
  return defaultValue;
}
var ENV = {
  // Environment mode
  MODE: getEnvVar("MODE", "development"),
  NODE_ENV: getEnvVar("NODE_ENV", "development"),
  PROD: getEnvVar("PROD") === "true" || getEnvVar("NODE_ENV") === "production",
  DEV: getEnvVar("DEV") === "true" || getEnvVar("NODE_ENV") === "development",
  TEST: getEnvVar("TEST") === "true" || getEnvVar("NODE_ENV") === "test" || getEnvVar("VITEST") === "true",
  // Server configuration
  PORT: getEnvVar("PORT", "3000"),
  WS_PORT: getEnvVar("WS_PORT", "4445"),
  WORLD: getEnvVar("WORLD", "world"),
  SAVE_INTERVAL: getEnvVar("SAVE_INTERVAL", "60"),
  ENABLE_RPG: getEnvVar("ENABLE_RPG", "true"),
  RPG_SYSTEMS: getEnvVar("RPG_SYSTEMS"),
  RPG_WORLD_TYPE: getEnvVar("RPG_WORLD_TYPE", "runescape"),
  // LiveKit configuration (client-safe)
  LIVEKIT_URL: getEnvVar("LIVEKIT_URL") || getEnvVar("LIVEKIT_WS_URL"),
  LIVEKIT_API_KEY: getEnvVar("LIVEKIT_API_KEY"),
  // Note: Sensitive variables like JWT_SECRET, ADMIN_CODE, and LIVEKIT_API_SECRET
  // are now in env-server.ts and should only be imported on the server side
  // Public environment variables (exposed to client)
  PUBLIC_API_URL: getEnvVar("PUBLIC_API_URL"),
  PUBLIC_ASSETS_URL: getEnvVar("PUBLIC_ASSETS_URL", "/assets/"),
  PUBLIC_MAX_UPLOAD_SIZE: getEnvVar("PUBLIC_MAX_UPLOAD_SIZE"),
  // Hyperfy configuration
  HYPERFY_ASSETS_URL: getEnvVar("HYPERFY_ASSETS_URL"),
  HYPERFY_ASSETS_DIR: getEnvVar("HYPERFY_ASSETS_DIR"),
  HYPERFY_NETWORK_RATE: getEnvVar("HYPERFY_NETWORK_RATE", "8"),
  HYPERFY_MAX_DELTA_TIME: getEnvVar("HYPERFY_MAX_DELTA_TIME", String(1 / 30)),
  HYPERFY_FIXED_DELTA_TIME: getEnvVar("HYPERFY_FIXED_DELTA_TIME", String(1 / 60)),
  HYPERFY_LOG_LEVEL: getEnvVar("HYPERFY_LOG_LEVEL"),
  HYPERFY_PHYSICS_ENABLED: getEnvVar("HYPERFY_PHYSICS_ENABLED", "true"),
  HYPERFY_GRAVITY_X: getEnvVar("HYPERFY_GRAVITY_X", "0"),
  HYPERFY_GRAVITY_Y: getEnvVar("HYPERFY_GRAVITY_Y", "-9.81"),
  HYPERFY_GRAVITY_Z: getEnvVar("HYPERFY_GRAVITY_Z", "0"),
  // Build configuration
  CLIENT_BUILD_DIR: getEnvVar("CLIENT_BUILD_DIR"),
  NO_CLIENT_SERVE: getEnvVar("NO_CLIENT_SERVE"),
  // Git information
  COMMIT_HASH: getEnvVar("COMMIT_HASH"),
  // Helper function to get any environment variable
  get: getEnvVar,
  // Helper to check if a variable exists
  has: (key) => getEnvVar(key) !== void 0,
  // Get all public environment variables
  getPublicVars: () => {
    const publicVars = {};
    const envVars = isNode ? process.env : import.meta.env;
    if (envVars) {
      for (const [key, value] of Object.entries(envVars)) {
        if (key.startsWith("PUBLIC_") && typeof value === "string") {
          publicVars[key] = value;
        }
      }
    }
    return publicVars;
  }
};

// src/rpg/config/ConfigLoader.ts
var isServer = typeof window === "undefined" && typeof process !== "undefined";
var fs = null;
var path = null;
if (isServer) {
  try {
    fs = __require("fs/promises");
    path = __require("path");
  } catch (error) {
    console.warn("[ConfigLoader] Failed to import fs/path modules:", error);
  }
}
var ConfigLoader = class _ConfigLoader {
  constructor() {
    this.configLoaded = false;
    // Configuration data
    this.npcs = {};
    this.items = {};
    this.lootTables = {};
    this.skills = {};
    this.quests = {};
  }
  static getInstance() {
    if (!_ConfigLoader.instance) {
      _ConfigLoader.instance = new _ConfigLoader();
    }
    return _ConfigLoader.instance;
  }
  /**
   * Enable test mode with hardcoded data
   */
  enableTestMode() {
    this.loadTestData();
    this.configLoaded = true;
  }
  /**
   * Load all configurations
   */
  async loadAllConfigurations() {
    if (this.configLoaded) {
      return;
    }
    if (ENV.TEST) {
      this.enableTestMode();
      return;
    }
    try {
      await this.loadFromFiles();
      this.configLoaded = true;
    } catch (error) {
      throw new Error(
        `Failed to load configuration files: ${error}. Configuration files are required in non-test environments.`
      );
    }
  }
  /**
   * Load configurations from files
   */
  async loadFromFiles() {
    if (!isServer || !fs || !path) {
      console.log("[ConfigLoader] Not running on server or fs/path not available - using default configurations");
      return;
    }
    const configDir = path.join(process.cwd(), "src/rpg/config");
    try {
      const npcFiles = ["monsters.json", "guards.json", "quest_givers.json", "shops.json"];
      for (const file of npcFiles) {
        try {
          const filePath = path.join(configDir, "npcs", file);
          const data = await fs.readFile(filePath, "utf-8");
          const npcs = JSON.parse(data);
          if (Array.isArray(npcs)) {
            npcs.forEach((npc) => {
              this.npcs[npc.id] = npc;
            });
          } else {
            Object.assign(this.npcs, npcs);
          }
        } catch (error) {
          console.warn(`Failed to load NPC file ${file}:`, error);
        }
      }
      const itemFiles = ["basic_items.json", "food_items.json", "bones.json"];
      for (const file of itemFiles) {
        try {
          const filePath = path.join(configDir, "items", file);
          const data = await fs.readFile(filePath, "utf-8");
          const items = JSON.parse(data);
          Object.assign(this.items, items);
        } catch (error) {
          console.warn(`Failed to load item file ${file}:`, error);
        }
      }
      const lootFiles = [
        "goblin_drops.json",
        "skeleton_drops.json",
        "hill_giant_drops.json",
        "common_drops.json",
        "cow_drops.json"
      ];
      for (const file of lootFiles) {
        try {
          const filePath = path.join(configDir, "loot", file);
          const data = await fs.readFile(filePath, "utf-8");
          const lootTable = JSON.parse(data);
          this.lootTables[lootTable.id] = lootTable;
        } catch (error) {
          console.warn(`Failed to load loot file ${file}:`, error);
        }
      }
      const skillFiles = ["combat.json", "gathering.json"];
      for (const file of skillFiles) {
        try {
          const filePath = path.join(configDir, "skills", file);
          const data = await fs.readFile(filePath, "utf-8");
          const skills = JSON.parse(data);
          Object.assign(this.skills, skills);
        } catch (error) {
          console.warn(`Failed to load skill file ${file}:`, error);
        }
      }
      const questFiles = ["tutorial_quest.json", "goblin_menace.json"];
      for (const file of questFiles) {
        try {
          const filePath = path.join(configDir, "quests", file);
          const data = await fs.readFile(filePath, "utf-8");
          const quest = JSON.parse(data);
          this.quests[quest.id] = quest;
        } catch (error) {
          console.warn(`Failed to load quest file ${file}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load configurations: ${error}`);
    }
  }
  /**
   * Load test data for development and testing
   */
  loadTestData() {
    this.npcs = {
      1: {
        id: 1,
        name: "Goblin",
        type: "monster",
        level: 2,
        combatLevel: 2,
        behavior: "aggressive",
        aggressionRange: 10,
        wanderRadius: 5,
        aggressionLevel: 1,
        dropTable: "goblin_drops",
        attackSpeed: 3e3,
        combatStyle: "melee",
        stats: {
          hitpoints: 25,
          attack: 5,
          strength: 5,
          defence: 1,
          speed: 4
        }
      },
      2: {
        id: 2,
        name: "Guard",
        type: "guard",
        level: 10,
        combatLevel: 15,
        behavior: "defensive",
        aggressionRange: 5,
        wanderRadius: 3,
        aggressionLevel: 0,
        stats: {
          hitpoints: 100,
          attack: 20,
          strength: 20,
          defence: 25,
          speed: 6
        }
      },
      100: {
        id: 100,
        name: "Test Boss",
        type: "boss",
        level: 50,
        combatLevel: 50,
        behavior: "aggressive",
        aggressionRange: 15,
        wanderRadius: 10,
        aggressionLevel: 2,
        dropTable: "goblin_drops",
        attackSpeed: 2e3,
        combatStyle: "melee",
        stats: {
          hitpoints: 500,
          attack: 50,
          strength: 50,
          defence: 50,
          speed: 8
        }
      },
      3: {
        id: 3,
        name: "Cow",
        type: "animal",
        level: 2,
        combatLevel: 2,
        behavior: "passive",
        aggressionRange: 0,
        wanderRadius: 10,
        aggressionLevel: 0,
        dropTable: "cow_drops",
        attackSpeed: 4e3,
        combatStyle: "melee",
        stats: {
          hitpoints: 8,
          attack: 0,
          strength: 0,
          defence: 0,
          speed: 2
        }
      },
      200: {
        id: 200,
        name: "Test NPC",
        type: "citizen",
        level: 1,
        combatLevel: 1,
        behavior: "passive",
        aggressionRange: 0,
        wanderRadius: 5,
        aggressionLevel: 0,
        stats: {
          hitpoints: 10,
          attack: 1,
          strength: 1,
          defence: 1,
          speed: 3
        }
      }
    };
    this.items = {
      1: {
        id: 1,
        name: "Bronze Sword",
        type: "weapon",
        value: 10,
        stackable: false,
        equipable: true,
        slot: "weapon",
        stats: { attack: 5 }
      },
      2: {
        id: 2,
        name: "Bread",
        type: "food",
        value: 5,
        stackable: true,
        equipable: false
      },
      3: {
        id: 3,
        name: "Bones",
        type: "material",
        value: 1,
        stackable: true,
        equipable: false
      }
    };
    this.lootTables = {
      goblin_drops: {
        id: "goblin_drops",
        name: "Goblin Drops",
        drops: [
          { itemId: 3, chance: 1, minQuantity: 1, maxQuantity: 1 },
          // Always drop bones
          { itemId: 2, chance: 0.3, minQuantity: 1, maxQuantity: 2 },
          // 30% chance for bread
          { itemId: 1, chance: 0.05, minQuantity: 1, maxQuantity: 1 }
          // 5% chance for bronze sword
        ]
      },
      common_drops: {
        id: "common_drops",
        name: "Common Drops",
        drops: [{ itemId: 2, chance: 0.5, minQuantity: 1, maxQuantity: 1 }]
      },
      cow_drops: {
        id: "cow_drops",
        name: "Cow Drops",
        drops: [
          { itemId: 3, chance: 1, minQuantity: 1, maxQuantity: 1 },
          // Always drop bones
          { itemId: 2132, chance: 1, minQuantity: 1, maxQuantity: 1 },
          // Raw beef (if available)
          { itemId: 1739, chance: 1, minQuantity: 1, maxQuantity: 1 }
          // Cowhide (if available)
        ]
      }
    };
    this.skills = {
      attack: {
        name: "Attack",
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      strength: {
        name: "Strength",
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      defence: {
        name: "Defence",
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      },
      hitpoints: {
        name: "Hitpoints",
        baseExperience: 83,
        experienceTable: [0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358]
      }
    };
    this.quests = {
      1: {
        id: 1,
        name: "Tutorial Quest",
        description: "Learn the basics of the game",
        requirements: {},
        rewards: { experience: { attack: 100 }, items: [{ id: 1, quantity: 1 }] },
        steps: []
      },
      2: {
        id: 2,
        name: "Goblin Menace",
        description: "Defeat 5 goblins",
        requirements: { level: 2 },
        rewards: { experience: { attack: 500 }, items: [{ id: 2, quantity: 5 }] },
        steps: []
      }
    };
  }
  /**
   * Get NPC configuration by ID
   */
  getNPC(id) {
    return this.npcs[id] || null;
  }
  /**
   * Get all NPCs
   */
  getAllNPCs() {
    return this.npcs;
  }
  /**
   * Get item configuration by ID
   */
  getItem(id) {
    return this.items[id] || null;
  }
  /**
   * Get all items
   */
  getAllItems() {
    return this.items;
  }
  /**
   * Get loot table by ID
   */
  getLootTable(id) {
    return this.lootTables[id] || null;
  }
  /**
   * Get all loot tables
   */
  getAllLootTables() {
    return this.lootTables;
  }
  /**
   * Get skill configuration by name
   */
  getSkill(name) {
    return this.skills[name] || null;
  }
  /**
   * Get all skills
   */
  getAllSkills() {
    return this.skills;
  }
  /**
   * Get quest configuration by ID
   */
  getQuest(id) {
    return this.quests[id] || null;
  }
  /**
   * Get all quests
   */
  getAllQuests() {
    return this.quests;
  }
  /**
   * Check if configuration is loaded
   */
  isConfigLoaded() {
    return this.configLoaded;
  }
  /**
   * Reload all configurations
   */
  async reload() {
    this.configLoaded = false;
    this.npcs = {};
    this.items = {};
    this.lootTables = {};
    this.skills = {};
    this.quests = {};
    await this.loadAllConfigurations();
  }
};

// src/core/config.ts
var ConfigurationManager = class _ConfigurationManager {
  constructor() {
    this.config = this.loadConfiguration();
  }
  static getInstance() {
    if (!_ConfigurationManager.instance) {
      _ConfigurationManager.instance = new _ConfigurationManager();
    }
    return _ConfigurationManager.instance;
  }
  loadConfiguration() {
    const isProduction = ENV.PROD;
    const isDevelopment = ENV.DEV;
    const isTest = ENV.TEST;
    return {
      // Asset configuration - no more hardcoded localhost!
      assetsUrl: ENV.HYPERFY_ASSETS_URL || (isProduction ? "https://assets.hyperfy.io/" : "https://test-assets.hyperfy.io/"),
      assetsDir: ENV.HYPERFY_ASSETS_DIR || (isTest ? "./world/assets" : null),
      // Environment flags
      isProduction,
      isDevelopment,
      isTest,
      // Network configuration
      networkRate: parseFloat(ENV.HYPERFY_NETWORK_RATE || "8"),
      maxDeltaTime: parseFloat(ENV.HYPERFY_MAX_DELTA_TIME || String(1 / 30)),
      fixedDeltaTime: parseFloat(ENV.HYPERFY_FIXED_DELTA_TIME || String(1 / 60)),
      // Logging configuration
      logLevel: ENV.HYPERFY_LOG_LEVEL || (isProduction ? "warn" : "info"),
      // Physics configuration
      physics: {
        enabled: ENV.HYPERFY_PHYSICS_ENABLED === "true",
        gravity: {
          x: parseFloat(ENV.HYPERFY_GRAVITY_X || "0"),
          y: parseFloat(ENV.HYPERFY_GRAVITY_Y || "-9.81"),
          z: parseFloat(ENV.HYPERFY_GRAVITY_Z || "0")
        }
      }
    };
  }
  get() {
    return this.config;
  }
  /**
   * Get a specific configuration value
   */
  getValue(key) {
    return this.config[key];
  }
  /**
   * Update configuration (mainly for testing)
   */
  update(updates) {
    this.config = { ...this.config, ...updates };
  }
  /**
   * Reset to default configuration
   */
  reset() {
    this.config = this.loadConfiguration();
  }
};
var Config = ConfigurationManager.getInstance();

// src/core/logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  return LogLevel2;
})(LogLevel || {});
var Logger = class _Logger {
  static {
    this.globalLogLevel = null;
  }
  constructor(options = {}) {
    this.prefix = options.prefix || "";
    if (_Logger.globalLogLevel !== null) {
      this.logLevel = _Logger.globalLogLevel;
    } else {
      const configLevel = options.logLevel || Config.getValue("logLevel").toUpperCase();
      this.logLevel = LogLevel[configLevel] || 1 /* INFO */;
    }
  }
  /**
   * Set global log level for all loggers
   */
  static setGlobalLogLevel(level) {
    _Logger.globalLogLevel = LogLevel[level];
  }
  /**
   * Create a child logger with a prefix
   */
  child(prefix) {
    return new _Logger({
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      logLevel: LogLevel[this.logLevel]
    });
  }
  shouldLog(level) {
    return level >= this.logLevel && !Config.getValue("isProduction");
  }
  formatMessage(message) {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }
  debug(message, ...args) {
    if (this.shouldLog(0 /* DEBUG */)) {
      console.debug(this.formatMessage(message), ...args);
    }
  }
  info(message, ...args) {
    if (this.shouldLog(1 /* INFO */)) {
      console.info(this.formatMessage(message), ...args);
    }
  }
  warn(message, ...args) {
    if (this.shouldLog(2 /* WARN */)) {
      console.warn(this.formatMessage(message), ...args);
    }
  }
  error(message, ...args) {
    if (this.shouldLog(3 /* ERROR */)) {
      console.error(this.formatMessage(message), ...args);
    }
  }
  /**
   * Log performance timing
   */
  time(label) {
    if (this.shouldLog(0 /* DEBUG */)) {
      console.time(this.formatMessage(label));
    }
  }
  timeEnd(label) {
    if (this.shouldLog(0 /* DEBUG */)) {
      console.timeEnd(this.formatMessage(label));
    }
  }
  /**
   * Create a scoped timer
   */
  timer(label) {
    const start = performance.now();
    return () => {
      if (this.shouldLog(0 /* DEBUG */)) {
        const duration = performance.now() - start;
        this.debug(`${label} took ${duration.toFixed(2)}ms`);
      }
    };
  }
};
var logger = new Logger();
function createLogger(prefix, options) {
  return new Logger({ ...options, prefix });
}

// src/rpg/systems/NPCSystem.ts
var NPCSystem = class extends System {
  constructor(world) {
    super(world);
    // Core management
    this.npcs = /* @__PURE__ */ new Map();
    this.npcDefinitions = /* @__PURE__ */ new Map();
    this.visualSystem = null;
    // Configuration
    this.INTERACTION_RANGE = 3;
    // Add counter for unique IDs
    this.npcIdCounter = 0;
    // Logger
    this.logger = createLogger("NPCSystem");
    this.behaviorManager = new NPCBehaviorManager(world);
    this.dialogueManager = new NPCDialogueManager(world);
    this.spawnManager = new NPCSpawnManager(world, this);
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    this.logger.info("Initializing...");
    this.visualSystem = this.world.getSystem?.("visualRepresentation");
    this.behaviorManager.init();
    const configLoader = ConfigLoader.getInstance();
    if (!configLoader.isConfigLoaded()) {
      await configLoader.loadAllConfigurations();
    }
    const npcConfigs = configLoader.getAllNPCs();
    this.logger.debug(`Found ${Object.keys(npcConfigs).length} NPC configs`);
    for (const config of Object.values(npcConfigs)) {
      const definition = this.convertConfigToDefinition(config);
      this.registerNPCDefinition(definition);
      this.logger.debug(`Registered NPC: ${definition.name} (ID: ${definition.id})`);
    }
    this.logger.info(`Loaded ${this.npcDefinitions.size} NPC definitions from config`);
    this.world.events.on("entity:created", (event) => {
      const entity = this.getEntity(event.entityId);
      if (entity && this.isNPCEntity(entity)) {
        this.onNPCCreated(entity);
      }
    });
    this.world.events.on("entity:destroyed", (event) => {
      this.npcs.delete(event.entityId);
    });
    this.world.events.on("entity:death", (event) => {
      const npc = this.npcs.get(event.entityId);
      if (npc) {
        this.onNPCDeath(npc, event.killerId);
      }
    });
  }
  /**
   * Fixed update for AI and behavior
   */
  fixedUpdate(_delta) {
    for (const [_npcId, npc] of this.npcs) {
      this.behaviorManager.updateBehavior(npc, _delta);
    }
    this.spawnManager.update(_delta);
  }
  /**
   * Regular update for animations and visuals
   */
  update(_delta) {
    this.dialogueManager.update(_delta);
  }
  /**
   * Convert NPCConfig to NPCDefinition
   */
  convertConfigToDefinition(config) {
    const npcTypeMap = {
      monster: "monster" /* MONSTER */,
      guard: "guard" /* GUARD */,
      quest_giver: "quest_giver" /* QUEST_GIVER */,
      shop: "shopkeeper" /* SHOPKEEPER */,
      shopkeeper: "shopkeeper" /* SHOPKEEPER */,
      banker: "banker" /* BANKER */,
      boss: "boss" /* BOSS */,
      animal: "animal" /* ANIMAL */,
      citizen: "citizen" /* CITIZEN */
    };
    const behaviorMap = {
      aggressive: "aggressive" /* AGGRESSIVE */,
      passive: "passive" /* PASSIVE */,
      defensive: "defensive" /* DEFENSIVE */,
      friendly: "friendly" /* FRIENDLY */,
      shop: "shop" /* SHOP */,
      quest: "quest" /* QUEST */,
      banker: "banker" /* BANKER */,
      wander: "wander" /* WANDER */,
      patrol: "patrol" /* PATROL */,
      follow: "follow" /* FOLLOW */
    };
    return {
      id: config.id,
      name: config.name,
      examine: config.examine || `A ${config.name}.`,
      npcType: npcTypeMap[config.type?.toLowerCase()] || "citizen" /* CITIZEN */,
      behavior: behaviorMap[config.behavior?.toLowerCase()] || "passive" /* PASSIVE */,
      faction: config.faction || "neutral",
      level: config.level,
      combatLevel: config.combatLevel,
      maxHitpoints: config.stats?.hitpoints,
      attackStyle: "melee" /* MELEE */,
      // Default to melee
      aggressionLevel: config.aggressionLevel,
      aggressionRange: config.aggressionRange,
      combat: config.stats ? {
        attackBonus: config.stats.attack || 0,
        strengthBonus: config.stats.strength || 0,
        defenseBonus: config.stats.defence || 0,
        maxHit: Math.floor((config.stats.strength || 0) / 4) + 1,
        attackSpeed: config.attackSpeed || 4e3
      } : void 0,
      lootTable: config.dropTable,
      respawnTime: 6e4,
      // Default 1 minute
      wanderRadius: config.wanderRadius,
      moveSpeed: config.stats?.speed || 1,
      dialogue: config.dialogue ? { text: config.dialogue } : void 0
    };
  }
  /**
   * Register an NPC definition
   */
  registerNPCDefinition(definition) {
    this.logger.debug(`Registering NPC definition: ${definition.id} - ${definition.name}`);
    this.npcDefinitions.set(definition.id, definition);
  }
  /**
   * Spawn an NPC at a position
   */
  spawnNPC(definitionId, position, spawnerId) {
    if (this.npcDefinitions.size === 0) {
      const configLoader = ConfigLoader.getInstance();
      try {
        if (!configLoader.isConfigLoaded()) {
          configLoader.enableTestMode();
        }
        const npcConfigs = configLoader.getAllNPCs();
        for (const config of Object.values(npcConfigs)) {
          const definition2 = this.convertConfigToDefinition(config);
          this.registerNPCDefinition(definition2);
        }
        this.logger.debug(`Loaded ${this.npcDefinitions.size} NPC definitions on-demand`);
      } catch (error) {
        this.logger.error(`Failed to load NPC definitions: ${error}`);
        return null;
      }
    }
    const definition = this.npcDefinitions.get(definitionId);
    if (!definition) {
      this.logger.warn(
        `[NPCSystem] Unknown NPC definition: ${definitionId}. Available definitions: ${Array.from(this.npcDefinitions.keys()).join(", ")}`
      );
      this.logger.debug(`[NPCSystem] Total loaded definitions: ${this.npcDefinitions.size}`);
      this.logger.debug(
        `[NPCSystem] Config loader status: ${ConfigLoader.getInstance().isConfigLoaded() ? "loaded" : "not loaded"}`
      );
      return null;
    }
    const npc = this.createNPCEntity(definition, position);
    if (spawnerId) {
      npc.spawnerId = spawnerId;
    }
    this.addNPCToWorld(npc);
    return npc;
  }
  /**
   * Despawn an NPC
   */
  despawnNPC(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      return;
    }
    this.npcs.delete(npcId);
    this.world.events.emit("npc:despawned", {
      npcId,
      position: npc.position
    });
    this.world.entities.destroyEntity(npcId);
  }
  /**
   * Handle player interaction with NPC
   */
  interactWithNPC(playerId, npcId) {
    const player = this.getEntity(playerId);
    const npc = this.npcs.get(npcId);
    if (!player || !npc) {
      return;
    }
    const playerPos = this.getEntityPosition(player);
    const npcPos = this.getEntityPosition(npc);
    if (!playerPos || !npcPos) {
      return;
    }
    const distance = this.getDistance(playerPos, npcPos);
    if (distance > this.INTERACTION_RANGE) {
      this.sendMessage(playerId, "You're too far away.");
      return;
    }
    const npcCombat = npc.getComponent("combat");
    if (npcCombat?.inCombat && npc.npcType !== "boss" /* BOSS */) {
      this.sendMessage(playerId, "The NPC is busy fighting!");
      return;
    }
    switch (npc.npcType) {
      case "quest_giver" /* QUEST_GIVER */:
        this.handleQuestGiverInteraction(playerId, npc);
        break;
      case "shopkeeper" /* SHOPKEEPER */:
        this.handleShopInteraction(playerId, npc);
        break;
      case "banker" /* BANKER */:
        this.handleBankerInteraction(playerId, npc);
        break;
      case "skill_master" /* SKILL_MASTER */:
        this.handleSkillMasterInteraction(playerId, npc);
        break;
      default:
        this.handleGenericInteraction(playerId, npc);
    }
    npc.lastInteraction = Date.now();
  }
  /**
   * Get NPC by ID
   */
  getNPC(npcId) {
    return this.npcs.get(npcId);
  }
  /**
   * Get all NPCs
   */
  getAllNPCs() {
    return Array.from(this.npcs.values());
  }
  /**
   * Get NPCs in range of a position
   */
  getNPCsInRange(position, range) {
    const npcsInRange = [];
    for (const npc of this.npcs.values()) {
      const distance = this.getDistance(position, npc.position);
      if (distance <= range) {
        npcsInRange.push(npc);
      }
    }
    return npcsInRange;
  }
  /**
   * Create NPC entity from definition
   */
  createNPCEntity(definition, position) {
    const npc = new NPCEntity(this.world, `npc_${definition.id}_${Date.now()}_${this.npcIdCounter++}`, {
      position,
      definition
    });
    const npcComponent = {
      type: "npc",
      entity: npc,
      // Will be set by addComponent
      data: {},
      // Will be set by addComponent
      npcId: definition.id,
      name: definition.name,
      examine: definition.examine,
      npcType: definition.npcType,
      behavior: definition.behavior,
      faction: definition.faction || "neutral",
      state: "idle" /* IDLE */,
      level: definition.level || 1,
      // Combat stats
      combatLevel: definition.combatLevel || 1,
      maxHitpoints: definition.maxHitpoints || 10,
      currentHitpoints: definition.maxHitpoints || 10,
      attackStyle: definition.attackStyle || "melee" /* MELEE */,
      aggressionLevel: definition.aggressionLevel || 0,
      aggressionRange: definition.aggressionRange || 5,
      // Combat abilities
      attackBonus: definition.combat?.attackBonus || 0,
      strengthBonus: definition.combat?.strengthBonus || 0,
      defenseBonus: definition.combat?.defenseBonus || 0,
      maxHit: definition.combat?.maxHit || 1,
      attackSpeed: definition.combat?.attackSpeed || 4,
      // Spawning
      respawnTime: definition.respawnTime || 6e4,
      wanderRadius: definition.wanderRadius || 5,
      spawnPoint: { ...position },
      // Interaction
      lootTable: definition.lootTable,
      dialogue: definition.dialogue,
      shop: definition.shop,
      questGiver: definition.questGiver ? true : false,
      // State
      currentTarget: null,
      lastInteraction: 0
    };
    npc.addComponent("npc", npcComponent);
    if (this.isCombatNPC(definition)) {
      const stats = {
        type: "stats",
        entity: npc,
        // Will be set by addComponent
        data: {},
        // Will be set by addComponent
        hitpoints: {
          current: definition.maxHitpoints || 10,
          max: definition.maxHitpoints || 10,
          level: definition.combatLevel || 1,
          xp: 0
        },
        attack: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        strength: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        defense: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
        ranged: { level: 1, xp: 0, bonus: 0 },
        magic: { level: 1, xp: 0, bonus: 0 },
        prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
        combatBonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 0,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: definition.combat?.strengthBonus || 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0
        },
        combatLevel: definition.combatLevel || 1,
        totalLevel: definition.combatLevel || 1
      };
      npc.addComponent("stats", stats);
      const combat = {
        type: "combat",
        entity: npc,
        // Will be set by addComponent
        data: {},
        // Will be set by addComponent
        inCombat: false,
        target: null,
        lastAttackTime: 0,
        attackSpeed: definition.combat?.attackSpeed || 4,
        combatStyle: "accurate" /* ACCURATE */,
        autoRetaliate: definition.behavior === "aggressive" /* AGGRESSIVE */ || definition.behavior === "defensive" /* DEFENSIVE */,
        hitSplatQueue: [],
        animationQueue: [],
        specialAttackEnergy: 100,
        specialAttackActive: false,
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false
        }
      };
      npc.addComponent("combat", combat);
    }
    const movement = {
      type: "movement",
      entity: npc,
      // Will be set by addComponent
      data: {},
      // Will be set by addComponent
      position: { ...position },
      destination: null,
      targetPosition: null,
      path: [],
      moveSpeed: definition.moveSpeed || 1,
      isMoving: false,
      canMove: true,
      runEnergy: 100,
      isRunning: false,
      currentSpeed: 0,
      facingDirection: 0,
      pathfindingFlags: 0,
      lastMoveTime: 0,
      teleportDestination: null,
      teleportTime: 0,
      teleportAnimation: ""
    };
    npc.addComponent("movement", movement);
    return npc;
  }
  /**
   * Add NPC to world
   */
  addNPCToWorld(npc) {
    this.npcs.set(npc.id, npc);
    this.world.entities.items.set(npc.id, npc);
    if (this.visualSystem) {
      const npcComponent = npc.getComponent("npc");
      if (npcComponent) {
        this.visualSystem.createVisual(npc, npcComponent.name.toLowerCase());
      }
    }
    this.world.events.emit("npc:spawned", {
      npcId: npc.id,
      definitionId: npc.getComponent("npc")?.npcId,
      position: npc.position
    });
  }
  /**
   * Handle NPC creation
   */
  onNPCCreated(npc) {
    this.npcs.set(npc.id, npc);
  }
  /**
   * Handle NPC death
   */
  onNPCDeath(npc, killerId) {
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent) {
      return;
    }
    if (npcComponent.lootTable && killerId) {
      this.world.events.emit("npc:death:loot", {
        npcId: npc.id,
        killerId,
        lootTable: npcComponent.lootTable,
        position: npc.position
      });
    }
    if (npcComponent.respawnTime > 0 && npc.spawnerId) {
      this.spawnManager.scheduleRespawn(npc.spawnerId, npcComponent.npcId, npcComponent.respawnTime);
    }
    this.npcs.delete(npc.id);
  }
  /**
   * Handle quest giver interaction
   */
  handleQuestGiverInteraction(playerId, npc) {
    this.dialogueManager.startDialogue(playerId, npc.id);
    this.world.events.emit("quest:interact", {
      playerId,
      npcId: npc.id
    });
  }
  /**
   * Handle shop interaction
   */
  handleShopInteraction(playerId, npc) {
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent?.shop) {
      return;
    }
    this.world.events.emit("shop:open", {
      playerId,
      npcId: npc.id,
      shop: npcComponent.shop
    });
  }
  /**
   * Handle banker interaction
   */
  handleBankerInteraction(playerId, npc) {
    this.world.events.emit("bank:open", {
      playerId,
      npcId: npc.id
    });
  }
  /**
   * Handle skill master interaction
   */
  handleSkillMasterInteraction(playerId, npc) {
    this.dialogueManager.startDialogue(playerId, npc.id);
  }
  /**
   * Handle generic interaction
   */
  handleGenericInteraction(playerId, npc) {
    const npcComponent = npc.getComponent("npc");
    if (!npcComponent) {
      return;
    }
    if (npcComponent.dialogue) {
      this.dialogueManager.startDialogue(playerId, npc.id);
    } else {
      this.sendMessage(playerId, npcComponent.examine);
    }
  }
  /**
   * Check if entity is an NPC
   */
  isNPCEntity(entity) {
    return entity.hasComponent?.("npc") || entity.getComponent?.("npc") !== null;
  }
  /**
   * Check if NPC is combat-capable
   */
  isCombatNPC(definition) {
    return definition.npcType === "monster" /* MONSTER */ || definition.npcType === "boss" /* BOSS */ || definition.npcType === "guard" /* GUARD */;
  }
  /**
   * Get entity from world
   */
  getEntity(entityId) {
    if (this.world.entities.items instanceof Map) {
      const entity2 = this.world.entities.items.get(entityId);
      if (!entity2 || typeof entity2.getComponent !== "function") {
        return void 0;
      }
      return entity2;
    }
    const entity = this.world.entities.get?.(entityId);
    if (!entity || typeof entity.getComponent !== "function") {
      return void 0;
    }
    return entity;
  }
  /**
   * Calculate distance between two positions
   */
  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /**
   * Send message to player
   */
  sendMessage(playerId, message) {
    this.world.events.emit("chat:system", {
      targetId: playerId,
      message
    });
  }
  /**
   * Get entity position
   */
  getEntityPosition(entity) {
    if (entity.position && typeof entity.position === "object") {
      return entity.position;
    }
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0
        };
      }
      return entity.data.position;
    }
    return null;
  }
};

// src/rpg/systems/StatsSystem.ts
var StatsSystem = class extends System {
  constructor(world) {
    super(world);
    this.name = "StatsSystem";
    this.enabled = true;
    // Player stats storage
    this.playerStats = /* @__PURE__ */ new Map();
  }
  /**
   * Get XP required for a specific level (public interface for tests)
   */
  getXPForLevel(level) {
    return this.levelToXp(level);
  }
  /**
   * Get level for a specific XP amount (public interface for tests) 
   */
  getLevelForXP(xp) {
    return this.xpToLevel(xp);
  }
  /**
   * Grant XP to a player and handle level ups
   */
  grantXP(playerId, skill, amount, source) {
    let stats = this.getPlayerStats(playerId);
    if (!stats) {
      stats = this.createInitialStats();
      this.setPlayerStats(playerId, stats);
    }
    const normalizedSkill = skill === "defense" ? "defence" : skill;
    const skillData = stats[normalizedSkill];
    if (!skillData) {
      console.warn(`Unknown skill: ${skill}`);
      return;
    }
    const oldLevel = skillData.level;
    const oldXp = skillData.xp;
    skillData.xp += amount;
    skillData.experience = skillData.xp;
    const newLevel = this.xpToLevel(skillData.xp);
    skillData.level = newLevel;
    if (normalizedSkill === "hitpoints") {
      const oldMax = stats.hitpoints.max;
      stats.hitpoints.max = newLevel * 10;
      if (newLevel > oldLevel) {
        stats.hitpoints.current = stats.hitpoints.max;
      }
      skillData.current = stats.hitpoints.current;
    } else {
      skillData.current = newLevel;
    }
    stats.combatLevel = this.calculateCombatLevel({
      attack: stats.attack,
      strength: stats.strength,
      defense: stats.defense,
      // Use 'defence' as the canonical skill
      ranged: stats.ranged,
      magic: stats.magic,
      hitpoints: stats.hitpoints,
      prayer: stats.prayer
    });
    stats.totalLevel = this.calculateTotalLevel(stats);
    this.setPlayerStats(playerId, stats);
    this.world.events.emit("rpg:xp_gained", {
      playerId,
      skill: normalizedSkill,
      amount,
      source,
      oldXp,
      newXp: skillData.xp
    });
    if (newLevel > oldLevel) {
      this.world.events.emit("rpg:level_up", {
        playerId,
        skill: normalizedSkill,
        oldLevel,
        newLevel
      });
    }
  }
  /**
   * Get player stats from storage
   */
  getPlayerStats(playerId) {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      return stats;
    }
    const entity = this.world.entities.players?.get(playerId);
    if (entity && entity.data) {
      const statsComponent = entity.data.stats;
      if (statsComponent) {
        this.playerStats.set(playerId, statsComponent);
        return statsComponent;
      }
    }
    return null;
  }
  /**
   * Set player stats in storage
   */
  setPlayerStats(playerId, stats) {
    this.playerStats.set(playerId, stats);
    const entity = this.world.entities.players?.get(playerId);
    if (entity && entity.data) {
      entity.data.stats = stats;
    }
  }
  /**
   * Check if player meets skill requirements
   */
  meetsRequirements(playerId, requirements) {
    const stats = this.getPlayerStats(playerId);
    if (!stats) {
      return false;
    }
    for (const [skill, requiredLevel] of Object.entries(requirements)) {
      const normalizedSkill = skill === "defense" ? "defence" : skill;
      const skillData = stats[normalizedSkill];
      if (!skillData || skillData.level < requiredLevel) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculate total level from all skills
   */
  calculateTotalLevel(stats) {
    const skills = [
      "attack",
      "strength",
      "defence",
      "hitpoints",
      "ranged",
      "prayer",
      "magic",
      "cooking",
      "crafting",
      "fletching",
      "herblore",
      "runecrafting",
      "smithing",
      "mining",
      "fishing",
      "woodcutting",
      "agility",
      "construction",
      "firemaking",
      "slayer",
      "thieving",
      "farming",
      "hunter"
    ];
    return skills.reduce((total, skill) => {
      const skillData = stats[skill];
      return total + (skillData?.level || 1);
    }, 0);
  }
  /**
   * Handle combat XP distribution (private method for combat system integration)
   */
  handleCombatXP(event) {
    const { attackerId, damage, weaponType } = event;
    if (!attackerId || !damage) {
      return;
    }
    const baseXp = damage * 4;
    const hpXp = damage * 1.33;
    switch (weaponType) {
      case "melee":
        this.grantXP(attackerId, "attack", baseXp, "combat");
        this.grantXP(attackerId, "strength", baseXp, "combat");
        this.grantXP(attackerId, "defence", baseXp, "combat");
        this.grantXP(attackerId, "hitpoints", hpXp, "combat");
        break;
      case "ranged":
        this.grantXP(attackerId, "ranged", baseXp, "combat");
        this.grantXP(attackerId, "defence", baseXp, "combat");
        this.grantXP(attackerId, "hitpoints", hpXp, "combat");
        break;
      case "magic":
        this.grantXP(attackerId, "magic", damage * 2, "combat");
        this.grantXP(attackerId, "hitpoints", hpXp, "combat");
        break;
    }
  }
  /**
   * Initialize the stats system
   */
  async init(_options) {
    console.log("[StatsSystem] Initializing...");
    this.world.events.on("rpg:xp_gain", this.handleXpGain.bind(this));
    this.world.events.on("rpg:level_up", this.handleLevelUp.bind(this));
    this.world.events.on("rpg:combat_xp", this.handleCombatXP.bind(this));
  }
  /**
   * Create initial stats for a new player
   */
  createInitialStats() {
    const initialCombatBonuses = {
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayerBonus: 0
    };
    const createSkill = (level) => ({
      level,
      xp: this.levelToXp(level),
      current: level,
      experience: this.levelToXp(level)
    });
    const stats = {
      type: "stats",
      data: {},
      entityId: void 0,
      // Combat skills
      hitpoints: {
        current: 100,
        max: 100,
        level: 10,
        xp: this.levelToXp(10),
        experience: this.levelToXp(10)
      },
      attack: createSkill(1),
      strength: createSkill(1),
      defense: createSkill(1),
      ranged: createSkill(1),
      magic: createSkill(1),
      prayer: {
        level: 1,
        xp: 0,
        points: 1,
        maxPoints: 1,
        current: 1,
        experience: 0
      },
      // Non-combat skills (all 23 skills from RuneScape)
      mining: createSkill(1),
      fishing: createSkill(1),
      woodcutting: createSkill(1),
      firemaking: createSkill(1),
      smithing: createSkill(1),
      cooking: createSkill(1),
      crafting: createSkill(1),
      fletching: createSkill(1),
      construction: createSkill(1),
      herblore: createSkill(1),
      agility: createSkill(1),
      thieving: createSkill(1),
      slayer: createSkill(1),
      farming: createSkill(1),
      runecrafting: createSkill(1),
      hunter: createSkill(1),
      // Combat bonuses
      combatBonuses: initialCombatBonuses,
      // Computed values (temporarily set to 0, will be calculated below)
      combatLevel: 0,
      totalLevel: 32
      // 22 skills at level 1 + hitpoints at level 10 = 32
    };
    stats.combatLevel = this.calculateCombatLevel({
      attack: stats.attack,
      strength: stats.strength,
      defense: stats.defense,
      // Use the actual defence skill we created
      ranged: stats.ranged,
      magic: stats.magic,
      hitpoints: stats.hitpoints,
      prayer: stats.prayer
    });
    return stats;
  }
  /**
   * Handle XP gain events
   */
  handleXpGain(event) {
    const { playerId, skill, amount, source } = event;
    console.log(`[StatsSystem] XP Gain: ${playerId} gained ${amount} ${skill} XP from ${source}`);
  }
  /**
   * Handle level up events
   */
  handleLevelUp(event) {
    const { playerId, skill, newLevel } = event;
    console.log(`[StatsSystem] Level Up: ${playerId} reached level ${newLevel} in ${skill}`);
    this.world.events.emit("rpg:level_up_celebration", {
      playerId,
      skill,
      level: newLevel
    });
  }
  /**
   * Calculate combat level from stats
   */
  calculateCombatLevel(stats) {
    const { attack, strength, defence, defense, ranged, magic, hitpoints, prayer } = stats;
    const defenseLevel = defence?.level ?? defense?.level ?? 1;
    const base = (defenseLevel + hitpoints.level + Math.floor(prayer.level / 2)) * 0.25;
    const melee = (attack.level + strength.level) * 0.325;
    const rangedLevel = Math.floor(ranged.level * 1.5) * 0.325;
    const magicLevel = Math.floor(magic.level * 1.5) * 0.325;
    const highest = Math.max(melee, rangedLevel, magicLevel);
    return Math.floor(base + highest);
  }
  /**
   * Convert level to XP using RuneScape formula
   */
  levelToXp(level) {
    if (level <= 1) return 0;
    let xp = 0;
    for (let i = 1; i < level; i++) {
      xp += Math.floor(i + 300 * Math.pow(2, i / 7)) / 4;
    }
    return Math.floor(xp);
  }
  /**
   * Convert XP to level
   */
  xpToLevel(xp) {
    for (let level = 1; level <= 99; level++) {
      if (this.levelToXp(level + 1) > xp) {
        return level;
      }
    }
    return 99;
  }
  /**
   * Add XP to a skill
   */
  addXp(stats, skill, amount) {
    const skillData = stats[skill];
    if (!skillData) {
      return { leveledUp: false, newLevel: 0 };
    }
    const oldLevel = skillData.level;
    skillData.xp += amount;
    skillData.experience = skillData.xp;
    const newLevel = this.xpToLevel(skillData.xp);
    skillData.level = newLevel;
    skillData.current = newLevel;
    stats.combatLevel = this.calculateCombatLevel({
      attack: stats.attack,
      strength: stats.strength,
      defense: stats.defense,
      // Use 'defence' as the canonical skill
      ranged: stats.ranged,
      magic: stats.magic,
      hitpoints: stats.hitpoints,
      prayer: stats.prayer
    });
    return {
      leveledUp: newLevel > oldLevel,
      newLevel
    };
  }
  /**
   * Update hitpoints
   */
  updateHitpoints(stats, current) {
    stats.hitpoints.current = Math.max(0, Math.min(current, stats.hitpoints.max));
  }
  /**
   * Heal hitpoints
   */
  heal(stats, amount) {
    const oldHp = stats.hitpoints.current;
    const newHp = Math.min(stats.hitpoints.max, oldHp + amount);
    stats.hitpoints.current = newHp;
    return newHp - oldHp;
  }
  /**
   * Take damage
   */
  takeDamage(stats, damage) {
    const newHp = Math.max(0, stats.hitpoints.current - damage);
    stats.hitpoints.current = newHp;
    return {
      newHp,
      isDead: newHp <= 0
    };
  }
};

// src/rpg/systems/MovementSystem.ts
var MovementSystem = class _MovementSystem extends System {
  constructor(world) {
    super(world);
    this.movingEntities = /* @__PURE__ */ new Map();
    this.spatialIndex = null;
    this.setupEventListeners();
  }
  static {
    this.WALK_SPEED = 4;
  }
  static {
    // Units per second
    this.RUN_SPEED = 8;
  }
  static {
    // Units per second
    this.RUN_ENERGY_DRAIN = 1;
  }
  static {
    // Per second
    this.RUN_ENERGY_RESTORE = 0.5;
  }
  static {
    // Per second when walking
    this.PATHFINDING_GRID_SIZE = 0.5;
  }
  static {
    this.MAX_PATH_LENGTH = 100;
  }
  static {
    this.COLLISION_CHECK_RADIUS = 0.5;
  }
  async init(_options) {
    this.spatialIndex = this.world.spatialIndex;
    if (!this.spatialIndex) {
      if (!process.env.BUN_ENV?.includes("test")) {
        console.warn("[MovementSystem] No spatial index available - using fallback collision detection");
      }
    }
  }
  setupEventListeners() {
    this.world.events.on("player:move", this.handlePlayerMove.bind(this));
    this.world.events.on("player:toggleRun", this.handleToggleRun.bind(this));
    this.world.events.on("player:stop", this.handlePlayerStop.bind(this));
    this.world.events.on("player:directMove", this.handleDirectMove.bind(this));
    this.world.events.on("ui:keybinding", this.handleKeybinding.bind(this));
  }
  update(deltaTime) {
    for (const [entityId, moveData] of this.movingEntities) {
      const entity = this.world.entities.get(entityId);
      if (!entity) {
        this.movingEntities.delete(entityId);
        continue;
      }
      const movement = entity.getComponent("movement");
      if (!movement) {
        continue;
      }
      if (moveData.isRunning && movement.runEnergy > 0) {
        movement.runEnergy = Math.max(0, movement.runEnergy - _MovementSystem.RUN_ENERGY_DRAIN * deltaTime);
        if (movement.runEnergy === 0) {
          moveData.isRunning = false;
          movement.isRunning = false;
        }
      } else if (!moveData.isRunning && movement.runEnergy < 100) {
        movement.runEnergy = Math.min(100, movement.runEnergy + _MovementSystem.RUN_ENERGY_RESTORE * deltaTime);
      }
      this.moveAlongPath(entity, moveData, deltaTime);
    }
  }
  handlePlayerMove(data) {
    const { playerId, targetPosition } = data;
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const movement = player.getComponent("movement");
    if (!movement || !movement.canMove) {
      return;
    }
    const path2 = this.findPathOptimized(player.position, targetPosition);
    if (path2.length === 0) {
      this.world.events.emit("player:moveBlocked", { playerId, reason: "No path found" });
      return;
    }
    this.movingEntities.set(playerId, {
      path: path2,
      currentIndex: 0,
      targetPosition,
      isRunning: movement.isRunning && movement.runEnergy > 0
    });
    movement.isMoving = true;
    movement.targetPosition = targetPosition;
    this.world.events.emit("player:moveStarted", {
      playerId,
      targetPosition,
      path: path2,
      isRunning: movement.isRunning
    });
  }
  handleToggleRun(data) {
    const { playerId } = data;
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const movement = player.getComponent("movement");
    if (!movement) {
      return;
    }
    movement.isRunning = !movement.isRunning;
    const moveData = this.movingEntities.get(playerId);
    if (moveData && movement.runEnergy > 0) {
      moveData.isRunning = movement.isRunning;
    }
    this.world.events.emit("player:runToggled", {
      playerId,
      isRunning: movement.isRunning
    });
  }
  handlePlayerStop(data) {
    const { playerId } = data;
    this.stopMovement(playerId);
  }
  moveAlongPath(entity, moveData, deltaTime) {
    const movement = entity.getComponent("movement");
    if (!movement) {
      return;
    }
    const speed = moveData.isRunning ? _MovementSystem.RUN_SPEED : _MovementSystem.WALK_SPEED;
    const moveDistance = speed * deltaTime;
    let remainingDistance = moveDistance;
    const oldPosition = { ...entity.position };
    while (remainingDistance > 0 && moveData.currentIndex < moveData.path.length) {
      const targetNode = moveData.path[moveData.currentIndex];
      const direction = this.getDirection(entity.position, targetNode);
      const distanceToNode = this.getDistance(entity.position, targetNode);
      if (distanceToNode <= remainingDistance) {
        entity.position = { ...targetNode };
        moveData.currentIndex++;
        remainingDistance -= distanceToNode;
        if (moveData.currentIndex >= moveData.path.length) {
          this.onReachedDestination(entity.id);
          break;
        }
      } else {
        const newPosition = {
          x: entity.position.x + direction.x * remainingDistance,
          y: entity.position.y + direction.y * remainingDistance,
          z: entity.position.z + direction.z * remainingDistance
        };
        if (this.checkCollisionOptimized(newPosition, entity.id)) {
          this.recalculatePath(entity.id);
          break;
        }
        entity.position = newPosition;
        remainingDistance = 0;
      }
      if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
        movement.facingDirection = Math.atan2(direction.x, direction.z);
      }
    }
    if (this.spatialIndex && (Math.abs(entity.position.x - oldPosition.x) > 0.1 || Math.abs(entity.position.z - oldPosition.z) > 0.1)) {
      this.spatialIndex.markDirty(entity);
    }
    movement.currentSpeed = speed;
    movement.position = entity.position;
    this.world.events.emit("entity:positionUpdate", {
      entityId: entity.id,
      position: entity.position,
      facingDirection: movement.facingDirection,
      isRunning: moveData.isRunning
    });
  }
  // Optimized pathfinding using spatial index for collision detection
  findPathOptimized(start, end) {
    if (this.hasLineOfSightOptimized(start, end)) {
      return [end];
    }
    return this.findPath(start, end);
  }
  // Optimized collision detection using spatial index
  checkCollisionOptimized(position, excludeEntityId) {
    if (!this.spatialIndex) {
      return this.checkCollision(position);
    }
    const nearbyEntities = this.spatialIndex.query({
      position: new THREE.Vector3(position.x, position.y, position.z),
      radius: _MovementSystem.COLLISION_CHECK_RADIUS,
      filter: (entity) => {
        if (entity.id === excludeEntityId) {
          return false;
        }
        const collider = entity.getComponent("collider");
        return collider && collider.blocking;
      }
    });
    for (const entity of nearbyEntities) {
      const entityPos = entity.position || { x: 0, y: 0, z: 0 };
      const distance = this.getDistance(position, entityPos);
      if (distance < _MovementSystem.COLLISION_CHECK_RADIUS) {
        return true;
      }
    }
    const terrain = this.world.terrain;
    if (terrain && !terrain.isWalkable(position.x, position.z)) {
      return true;
    }
    return !this.isInBounds(position);
  }
  // Optimized line-of-sight check using spatial index
  hasLineOfSightOptimized(start, end) {
    if (!this.spatialIndex) {
      return this.hasLineOfSight(start, end);
    }
    const _direction = this.getDirection(start, end);
    const distance = this.getDistance(start, end);
    const steps = Math.ceil(distance / _MovementSystem.PATHFINDING_GRID_SIZE);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t
      };
      if (this.checkCollisionOptimized(point)) {
        return false;
      }
    }
    return true;
  }
  // Original pathfinding for fallback
  findPath(start, end) {
    const openSet = [];
    const closedSet = /* @__PURE__ */ new Set();
    const startNode = {
      position: this.snapToGrid(start),
      g: 0,
      h: this.getDistance(start, end),
      f: 0
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);
    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const nodeKey = this.getNodeKey(current.position);
      closedSet.add(nodeKey);
      if (this.getDistance(current.position, end) < _MovementSystem.PATHFINDING_GRID_SIZE) {
        return this.reconstructPath(current);
      }
      if (current.g > _MovementSystem.MAX_PATH_LENGTH) {
        continue;
      }
      const neighbors = this.getNeighbors(current.position);
      for (const neighborPos of neighbors) {
        const neighborKey = this.getNodeKey(neighborPos);
        if (closedSet.has(neighborKey)) {
          continue;
        }
        if (this.checkCollisionOptimized(neighborPos)) {
          continue;
        }
        const g = current.g + this.getDistance(current.position, neighborPos);
        const h = this.getDistance(neighborPos, end);
        const f = g + h;
        const existingNode = openSet.find((n) => this.getNodeKey(n.position) === neighborKey);
        if (!existingNode || g < existingNode.g) {
          const neighbor = {
            position: neighborPos,
            g,
            h,
            f,
            parent: current
          };
          if (existingNode) {
            const index = openSet.indexOf(existingNode);
            openSet[index] = neighbor;
          } else {
            openSet.push(neighbor);
          }
        }
      }
    }
    return [end];
  }
  // Performance monitoring
  getPerformanceMetrics() {
    let totalPathLength = 0;
    for (const moveData of this.movingEntities.values()) {
      totalPathLength += moveData.path.length;
    }
    return {
      activeMovements: this.movingEntities.size,
      spatialIndexAvailable: this.spatialIndex !== null,
      averagePathLength: this.movingEntities.size > 0 ? totalPathLength / this.movingEntities.size : 0
    };
  }
  getNeighbors(position) {
    const neighbors = [];
    const gridSize = _MovementSystem.PATHFINDING_GRID_SIZE;
    const offsets = [
      { x: -gridSize, z: 0 },
      { x: gridSize, z: 0 },
      { x: 0, z: -gridSize },
      { x: 0, z: gridSize },
      { x: -gridSize, z: -gridSize },
      { x: -gridSize, z: gridSize },
      { x: gridSize, z: -gridSize },
      { x: gridSize, z: gridSize }
    ];
    for (const offset of offsets) {
      neighbors.push({
        x: position.x + offset.x,
        y: position.y,
        z: position.z + offset.z
      });
    }
    return neighbors;
  }
  isWalkable(position) {
    return !this.checkCollisionOptimized(position);
  }
  checkCollision(position) {
    const physics = this.world.physics;
    if (physics) {
      const rayStart = new THREE.Vector3(position.x, position.y + 1, position.z);
      const rayEnd = new THREE.Vector3(position.x, position.y - 0.1, position.z);
      const rayDirection = new THREE.Vector3().subVectors(rayEnd, rayStart).normalize();
      const hit = physics.raycast(rayStart, rayDirection, 1.1);
      if (hit) {
        const hitEntity = this.world.entities?.get(hit.entityId);
        if (hitEntity) {
          const blocker = hitEntity.getComponent("blocker");
          if (blocker && blocker.active) {
            return true;
          }
        }
      }
    }
    const tileX = Math.floor(position.x);
    const tileZ = Math.floor(position.z);
    const collisionMap = this.world.collisionMap;
    if (collisionMap && collisionMap[tileZ] && collisionMap[tileZ][tileX]) {
      return true;
    }
    return false;
  }
  isInBounds(position) {
    const worldSettings = this.world.settings;
    const bounds = worldSettings?.worldBounds || {
      min: { x: -1e3, y: -100, z: -1e3 },
      max: { x: 1e3, y: 1e3, z: 1e3 }
    };
    return position.x >= bounds.min.x && position.x <= bounds.max.x && position.y >= bounds.min.y && position.y <= bounds.max.y && position.z >= bounds.min.z && position.z <= bounds.max.z;
  }
  reconstructPath(endNode) {
    const path2 = [];
    let current = endNode;
    while (current) {
      path2.unshift(current.position);
      current = current.parent;
    }
    return this.smoothPath(path2);
  }
  smoothPath(path2) {
    if (path2.length <= 2) {
      return path2;
    }
    const smoothed = [path2[0]];
    let current = 0;
    while (current < path2.length - 1) {
      let farthest = current + 1;
      for (let i = current + 2; i < path2.length; i++) {
        if (this.hasLineOfSightOptimized(path2[current], path2[i])) {
          farthest = i;
        } else {
          break;
        }
      }
      smoothed.push(path2[farthest]);
      current = farthest;
    }
    return smoothed;
  }
  hasLineOfSight(start, end) {
    const steps = Math.max(
      Math.abs(end.x - start.x) / _MovementSystem.PATHFINDING_GRID_SIZE,
      Math.abs(end.z - start.z) / _MovementSystem.PATHFINDING_GRID_SIZE
    );
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t
      };
      if (!this.isWalkable(point)) {
        return false;
      }
    }
    return true;
  }
  onReachedDestination(entityId) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const movement = entity.getComponent("movement");
    if (movement) {
      movement.isMoving = false;
      movement.currentSpeed = 0;
    }
    this.movingEntities.delete(entityId);
    this.world.events.emit("entity:reachedDestination", {
      entityId,
      position: entity.position
    });
  }
  stopMovement(entityId) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const movement = entity.getComponent("movement");
    if (movement) {
      movement.isMoving = false;
      movement.currentSpeed = 0;
      movement.targetPosition = null;
    }
    this.movingEntities.delete(entityId);
    this.world.events.emit("entity:movementStopped", {
      entityId,
      position: entity.position
    });
  }
  recalculatePath(entityId) {
    const moveData = this.movingEntities.get(entityId);
    if (!moveData) {
      return;
    }
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const newPath = this.findPathOptimized(entity.position, moveData.targetPosition);
    if (newPath.length > 0) {
      moveData.path = newPath;
      moveData.currentIndex = 0;
    } else {
      this.stopMovement(entityId);
      this.world.events.emit("player:moveBlocked", {
        playerId: entityId,
        reason: "Path blocked"
      });
    }
  }
  getDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = this.getDistance(from, to);
    if (distance === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    return {
      x: dx / distance,
      y: dy / distance,
      z: dz / distance
    };
  }
  snapToGrid(position) {
    const gridSize = _MovementSystem.PATHFINDING_GRID_SIZE;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: position.y,
      z: Math.round(position.z / gridSize) * gridSize
    };
  }
  getNodeKey(position) {
    return `${position.x.toFixed(1)},${position.z.toFixed(1)}`;
  }
  // Public API methods
  moveEntity(entityId, targetPosition) {
    this.handlePlayerMove({ playerId: entityId, targetPosition });
  }
  stopEntity(entityId) {
    this.stopMovement(entityId);
  }
  setRunning(entityId, isRunning) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const movement = entity.getComponent("movement");
    if (!movement) {
      return;
    }
    movement.isRunning = isRunning;
    const moveData = this.movingEntities.get(entityId);
    if (moveData && movement.runEnergy > 0) {
      moveData.isRunning = isRunning;
    }
  }
  teleportEntity(entityId, position) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const oldPosition = { ...entity.position };
    entity.position = { ...position };
    if (this.spatialIndex) {
      this.spatialIndex.updateEntity(entity);
    }
    this.stopMovement(entityId);
    this.world.events.emit("entity:teleported", {
      entityId,
      fromPosition: oldPosition,
      toPosition: position
    });
  }
  /**
   * Handle direct movement from keyboard input (WASD)
   */
  handleDirectMove(data) {
    const { playerId, direction, speed } = data;
    const player = this.world.entities.get(playerId);
    if (!player) return;
    const movement = player.getComponent("movement");
    if (!movement || !movement.canMove) return;
    const newPosition = {
      x: player.position.x + direction.x * speed,
      y: player.position.y,
      z: player.position.z + direction.z * speed
    };
    if (!this.checkCollisionOptimized(newPosition, playerId)) {
      const oldPosition = { ...player.position };
      player.position = newPosition;
      if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
        movement.facingDirection = Math.atan2(direction.x, direction.z);
      }
      movement.isMoving = true;
      movement.currentSpeed = speed;
      movement.position = player.position;
      if (this.spatialIndex && (Math.abs(player.position.x - oldPosition.x) > 0.1 || Math.abs(player.position.z - oldPosition.z) > 0.1)) {
        this.spatialIndex.markDirty(player);
      }
      this.world.events.emit("entity:positionUpdate", {
        entityId: player.id,
        position: player.position,
        facingDirection: movement.facingDirection,
        isRunning: speed > _MovementSystem.WALK_SPEED
      });
    }
  }
  /**
   * Handle keybinding events for movement
   */
  handleKeybinding(data) {
    switch (data.action) {
      case "toggle_run":
        this.world.events.emit("toggle:run:requested", { pressed: data.pressed });
        break;
    }
  }
  /**
   * Move entity directly without pathfinding (for keyboard movement)
   */
  moveEntityDirect(entity, direction, deltaTime) {
    const movement = entity.getComponent("movement");
    if (!movement || !movement.canMove) return;
    const baseSpeed = movement.isRunning && movement.runEnergy > 0 ? _MovementSystem.RUN_SPEED : _MovementSystem.WALK_SPEED;
    const speed = baseSpeed * deltaTime;
    const newPosition = {
      x: entity.position.x + direction.x * speed,
      y: entity.position.y,
      z: entity.position.z + direction.z * speed
    };
    if (!this.checkCollisionOptimized(newPosition, entity.id)) {
      const oldPosition = { ...entity.position };
      entity.position = newPosition;
      if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
        movement.facingDirection = Math.atan2(direction.x, direction.z);
      }
      movement.isMoving = true;
      movement.currentSpeed = baseSpeed;
      movement.position = entity.position;
      if (movement.isRunning && movement.runEnergy > 0) {
        movement.runEnergy = Math.max(0, movement.runEnergy - _MovementSystem.RUN_ENERGY_DRAIN * deltaTime);
        if (movement.runEnergy === 0) {
          movement.isRunning = false;
        }
      } else if (!movement.isRunning && movement.runEnergy < 100) {
        movement.runEnergy = Math.min(100, movement.runEnergy + _MovementSystem.RUN_ENERGY_RESTORE * deltaTime);
      }
      if (this.spatialIndex && (Math.abs(entity.position.x - oldPosition.x) > 0.1 || Math.abs(entity.position.z - oldPosition.z) > 0.1)) {
        this.spatialIndex.markDirty(entity);
      }
      this.world.events.emit("entity:positionUpdate", {
        entityId: entity.id,
        position: entity.position,
        facingDirection: movement.facingDirection,
        isRunning: movement.isRunning
      });
    } else {
      movement.isMoving = false;
      movement.currentSpeed = 0;
    }
  }
};

// src/rpg/systems/DeathRespawnSystem.ts
var DeathRespawnSystem = class extends System {
  constructor(world) {
    super(world);
    this.gravestones = /* @__PURE__ */ new Map();
    this.deathTimers = /* @__PURE__ */ new Map();
    this.gravestoneEntities = /* @__PURE__ */ new Map();
    this.config = {
      defaultRespawnPoint: { x: 3200, y: 0, z: 3200 },
      // Lumbridge
      respawnPoints: /* @__PURE__ */ new Map([
        [
          "lumbridge",
          {
            id: "lumbridge",
            name: "Lumbridge",
            position: { x: 3200, y: 0, z: 3200 },
            isDefault: true
          }
        ],
        [
          "edgeville",
          {
            id: "edgeville",
            name: "Edgeville",
            position: { x: 3090, y: 0, z: 3490 },
            requirements: { questId: "death_to_the_dorgeshuun" }
          }
        ],
        [
          "falador",
          {
            id: "falador",
            name: "Falador",
            position: { x: 2960, y: 0, z: 3380 }
          }
        ],
        [
          "varrock",
          {
            id: "varrock",
            name: "Varrock",
            position: { x: 3210, y: 0, z: 3424 }
          }
        ],
        [
          "camelot",
          {
            id: "camelot",
            name: "Camelot",
            position: { x: 2757, y: 0, z: 3477 },
            requirements: { questId: "king_arthurs_realm" }
          }
        ]
      ]),
      itemsKeptOnDeath: 3,
      protectItemPrayer: true,
      skullItemsKept: 0,
      gravestoneEnabled: true,
      gravestoneBaseDuration: 5 * 60 * 1e3,
      // 5 minutes
      gravestoneTierMultipliers: /* @__PURE__ */ new Map([
        ["wooden" /* WOODEN */, 1],
        ["stone" /* STONE */, 2],
        ["ornate" /* ORNATE */, 3],
        ["angel" /* ANGEL */, 4],
        ["mystic" /* MYSTIC */, 6]
      ]),
      safeZones: [
        {
          id: "lumbridge",
          name: "Lumbridge",
          bounds: {
            min: { x: 3150, y: 0, z: 3150 },
            max: { x: 3250, y: 100, z: 3250 }
          },
          allowPvP: false
        },
        {
          id: "edgeville_bank",
          name: "Edgeville Bank",
          bounds: {
            min: { x: 3090, y: 0, z: 3488 },
            max: { x: 3098, y: 10, z: 3499 }
          },
          allowPvP: false
        }
      ],
      freeReclaimThreshold: 1e5,
      // 100k GP
      reclaimFeePercentage: 5
      // 5% of item value
    };
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    console.log("[DeathRespawnSystem] Initializing...");
    this.world.events.on("entity:death", this.handleDeath.bind(this));
    this.world.events.on("player:respawn", this.handleRespawnRequest.bind(this));
    this.world.events.on("gravestone:interact", this.handleGravestoneInteraction.bind(this));
    this.world.events.on("gravestone:bless", this.handleGravestoneBless.bind(this));
  }
  /**
   * Handle entity death
   */
  handleDeath(event) {
    const entity = this.world.entities.get(event.entityId);
    if (!entity) {
      return;
    }
    if (entity.type === "player") {
      this.handlePlayerDeath(entity, event.killerId);
    } else if (entity.type === "npc") {
      this.handleNPCDeath(entity, event.killerId);
    }
  }
  /**
   * Handle player death
   */
  handlePlayerDeath(player, killerId) {
    const inventory = player.getComponent("inventory");
    const movement = player.getComponent("movement");
    const combat = player.getComponent("combat");
    const stats = player.getComponent("stats");
    if (!inventory || !movement || !stats) {
      return;
    }
    const position = movement.data?.position;
    if (!position) {
      return;
    }
    let death = player.getComponent("death");
    if (!death) {
      death = {
        type: "death",
        isDead: true,
        deathTime: Date.now(),
        deathLocation: { ...position },
        killer: killerId || null,
        gravestoneId: null,
        gravestoneTimer: 0,
        respawnPoint: null,
        respawnTimer: 5e3,
        // 5 seconds
        itemsKeptOnDeath: [],
        itemsLostOnDeath: [],
        deathCount: 1,
        lastDeathTime: Date.now()
      };
      player.addComponent("death", death);
    } else {
      const deathData2 = death.data;
      if (deathData2) {
        deathData2.isDead = true;
      }
    }
    const currentDeath = player.getComponent("death");
    let deathData = currentDeath.data;
    if (!deathData) {
      deathData = currentDeath;
    }
    deathData.deathTime = Date.now();
    deathData.deathLocation = { ...position };
    deathData.killer = killerId || null;
    deathData.deathCount = (deathData.deathCount || 0) + 1;
    deathData.lastDeathTime = Date.now();
    if (this.isInSafeZone(position)) {
      const items = inventory.data?.items || inventory.items || [];
      deathData.itemsKeptOnDeath = [...items.filter((item) => item !== null)];
      deathData.itemsLostOnDeath = [];
    } else {
      const isSkull = player.skullTimer && player.skullTimer > 0;
      const protectItem = false;
      let itemsToKeep = isSkull ? this.config.skullItemsKept : this.config.itemsKeptOnDeath;
      if (protectItem && this.config.protectItemPrayer) {
        itemsToKeep += 1;
      }
      const { kept, lost } = this.calculateItemsKeptOnDeath(inventory, itemsToKeep);
      deathData.itemsKeptOnDeath = kept;
      deathData.itemsLostOnDeath = lost;
      if (lost.length > 0 && this.config.gravestoneEnabled) {
        const gravestone = this.createGravestone(player, lost, position);
        deathData.gravestoneId = gravestone.id;
      }
    }
    const inventoryItems = inventory.data?.items || inventory.items;
    if (inventoryItems) {
      inventoryItems.fill(null);
      deathData.itemsKeptOnDeath.forEach((item, index) => {
        if (index < inventoryItems.length) {
          inventoryItems[index] = item;
        }
      });
    }
    const equipment = inventory.data?.equipment || inventory.equipment;
    if (equipment) {
      Object.keys(equipment).forEach((slot) => {
        equipment[slot] = null;
      });
    }
    if (combat) {
      const combatData = combat.data || combat;
      combatData.inCombat = false;
      combatData.target = null;
    }
    if (player.skullTimer) {
      ;
      player.skullTimer = 0;
    }
    this.world.events.emit("player:died", {
      playerId: player.id,
      killerId,
      position,
      keptItems: deathData.itemsKeptOnDeath,
      lostItems: deathData.itemsLostOnDeath,
      gravestoneId: deathData.gravestoneId
    });
  }
  /**
   * Handle NPC death
   */
  handleNPCDeath(npc, killerId) {
    this.world.events.emit("npc:died", {
      npcId: npc.id,
      killerId,
      position: npc.position
    });
  }
  /**
   * Calculate items kept on death
   */
  calculateItemsKeptOnDeath(inventory, itemsToKeep) {
    const allItems = [];
    const items = inventory.data?.items || inventory.items || [];
    for (const item of items) {
      if (item) {
        allItems.push({ ...item });
      }
    }
    const equipment = inventory.data?.equipment || inventory.equipment;
    if (equipment) {
      for (const slot of Object.values(equipment)) {
        if (slot) {
          allItems.push({ itemId: slot.id, quantity: 1 });
        }
      }
    }
    const sortedItems = allItems.sort((a, b) => {
      const valueA = this.getItemValue(a.itemId) * a.quantity;
      const valueB = this.getItemValue(b.itemId) * b.quantity;
      return valueB - valueA;
    });
    const kept = [];
    const lost = [];
    let keptStacks = 0;
    for (const item of sortedItems) {
      if (keptStacks < itemsToKeep) {
        kept.push({ ...item });
        keptStacks += 1;
      } else {
        lost.push({ ...item });
      }
    }
    return { kept, lost };
  }
  /**
   * Create gravestone
   */
  createGravestone(player, items, position) {
    const tier = this.getPlayerGravestoneTier(player);
    const multiplier = this.config.gravestoneTierMultipliers.get(tier) || 1;
    const duration = this.config.gravestoneBaseDuration * multiplier;
    const gravestone = {
      id: `gravestone_${player.id}_${Date.now()}`,
      ownerId: player.id,
      position: { ...position },
      items,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
      tier,
      model: this.getGravestoneModel(tier),
      isBlessed: false
    };
    this.gravestones.set(gravestone.id, gravestone);
    const gravestoneEntity = {
      id: gravestone.id,
      type: "gravestone",
      position: { ...position },
      components: /* @__PURE__ */ new Map(),
      getComponent(type) {
        return this.components.get(type) || null;
      },
      hasComponent(type) {
        return this.components.has(type);
      },
      addComponent(type, component) {
        this.components.set(type, component);
      }
    };
    gravestoneEntity.addComponent("visual", {
      type: "visual",
      model: gravestone.model || "gravestone_wooden",
      scale: 1
    });
    gravestoneEntity.addComponent("interaction", {
      type: "interaction",
      interactType: "gravestone",
      ownerId: player.id,
      data: gravestone
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(gravestone.id, gravestoneEntity);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(gravestone.id, gravestoneEntity);
    }
    this.gravestoneEntities.set(gravestone.id, gravestoneEntity);
    setTimeout(() => {
      this.expireGravestone(gravestone.id);
    }, duration);
    return gravestone;
  }
  /**
   * Respawn player
   */
  respawn(player, respawnPoint) {
    const death = player.getComponent("death");
    const stats = player.getComponent("stats");
    const movement = player.getComponent("movement");
    if (!death || !stats || !movement) {
      return;
    }
    const timerId = this.deathTimers.get(player.id);
    if (timerId) {
      clearTimeout(timerId);
      this.deathTimers.delete(player.id);
    }
    const location = this.getRespawnLocation(player, respawnPoint);
    const statsData = stats.data || stats;
    if (statsData.hitpoints) {
      statsData.hitpoints.current = statsData.hitpoints.max;
    }
    if (statsData.prayer) {
      statsData.prayer.points = Math.floor(statsData.prayer.maxPoints * 0.5);
    }
    const deathData = death.data;
    deathData.isDead = false;
    deathData.respawnTimer = 5e3;
    movement.data.position = { ...location };
    movement.data.teleportDestination = { ...location };
    movement.data.teleportTime = Date.now();
    movement.data.teleportAnimation = "respawn";
    this.world.events.emit("player:respawned", {
      playerId: player.id,
      position: location,
      gravestoneId: deathData.gravestoneId
    });
  }
  /**
   * Handle respawn request
   */
  handleRespawnRequest(event) {
    const player = this.world.entities.get(event.playerId);
    if (!player) {
      return;
    }
    const death = player.getComponent("death");
    if (!death || !death.data?.isDead) {
      return;
    }
    this.respawn(player, event.respawnPoint);
  }
  /**
   * Get respawn location
   */
  getRespawnLocation(player, customPoint) {
    if (customPoint) {
      const point = this.config.respawnPoints.get(customPoint);
      if (point && this.canUseRespawnPoint(player, point)) {
        return { ...point.position };
      }
    }
    const death = player.getComponent("death");
    if (death?.data?.respawnPoint) {
      const point = this.config.respawnPoints.get(death.data.respawnPoint);
      if (point && this.canUseRespawnPoint(player, point)) {
        return { ...point.position };
      }
    }
    return { ...this.config.defaultRespawnPoint };
  }
  /**
   * Check if player can use respawn point
   */
  canUseRespawnPoint(player, point) {
    if (!point.requirements) {
      return true;
    }
    if (point.requirements.questId) {
      return false;
    }
    if (point.requirements.skillLevel) {
      const stats = player.getComponent("stats");
      if (!stats) {
        return false;
      }
      const skill = stats[point.requirements.skillLevel.skill];
      if (skill && skill.level >= point.requirements.skillLevel.level) {
        return true;
      }
      return false;
    }
    return true;
  }
  /**
   * Handle gravestone interaction
   */
  handleGravestoneInteraction(event) {
    const gravestone = this.gravestones.get(event.gravestoneId);
    if (!gravestone) {
      return;
    }
    const player = this.world.entities.get(event.playerId);
    if (!player) {
      return;
    }
    if (gravestone.ownerId !== event.playerId) {
      if (Date.now() < gravestone.expiresAt) {
        this.sendMessage(event.playerId, "This is not your gravestone.");
        return;
      }
    }
    const totalValue = this.calculateGravestoneValue(gravestone);
    const fee = totalValue > this.config.freeReclaimThreshold ? Math.floor(totalValue * this.config.reclaimFeePercentage / 100) : 0;
    this.world.events.emit("gravestone:options", {
      playerId: event.playerId,
      gravestoneId: event.gravestoneId,
      items: gravestone.items,
      fee,
      isOwner: gravestone.ownerId === event.playerId
    });
  }
  /**
   * Reclaim items from gravestone
   */
  reclaimItems(playerId, gravestoneId, payFee = true) {
    const gravestone = this.gravestones.get(gravestoneId);
    const player = this.world.entities.get(playerId);
    if (!gravestone || !player) {
      return false;
    }
    if (gravestone.ownerId !== playerId && Date.now() < gravestone.expiresAt) {
      return false;
    }
    if (payFee && gravestone.ownerId === playerId) {
      const totalValue = this.calculateGravestoneValue(gravestone);
      const fee = totalValue > this.config.freeReclaimThreshold ? Math.floor(totalValue * this.config.reclaimFeePercentage / 100) : 0;
      if (fee > 0) {
        const inventory = player.getComponent("inventory");
        if (!inventory) {
          return false;
        }
        const goldAmount = this.getPlayerGold(inventory);
        if (goldAmount < fee) {
          this.sendMessage(playerId, `You need ${fee} coins to reclaim your items.`);
          return false;
        }
        if (!this.removePlayerGold(player, fee)) {
          return false;
        }
      }
    }
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    for (const item of gravestone.items) {
      inventorySystem.addItem(playerId, item.itemId, item.quantity);
    }
    this.removeGravestone(gravestoneId);
    const death = player.getComponent("death");
    if (death) {
      ;
      death.data.gravestoneId = null;
    }
    this.sendMessage(playerId, "You have reclaimed your items.");
    return true;
  }
  /**
   * Handle gravestone blessing
   */
  handleGravestoneBless(event) {
    const gravestone = this.gravestones.get(event.gravestoneId);
    if (!gravestone || gravestone.isBlessed) {
      return;
    }
    gravestone.expiresAt += 60 * 60 * 1e3;
    gravestone.isBlessed = true;
    const entity = this.gravestoneEntities.get(event.gravestoneId);
    if (entity) {
      const visual = entity.getComponent("visual");
      if (visual) {
        visual.effect = "blessed";
      }
    }
    this.sendMessage(event.playerId, "The gravestone has been blessed and will last longer.");
  }
  /**
   * Expire gravestone
   */
  expireGravestone(gravestoneId) {
    const gravestone = this.gravestones.get(gravestoneId);
    if (!gravestone) {
      return;
    }
    const lootSystem = this.world.getSystem("loot");
    if (lootSystem && gravestone.items.length > 0) {
      lootSystem.createLootPile(gravestone.position, gravestone.items, null);
    }
    this.removeGravestone(gravestoneId);
  }
  /**
   * Remove gravestone
   */
  removeGravestone(gravestoneId) {
    this.gravestones.delete(gravestoneId);
    const entity = this.gravestoneEntities.get(gravestoneId);
    if (entity) {
      ;
      this.world.entities?.items?.delete(gravestoneId);
      this.gravestoneEntities.delete(gravestoneId);
    }
  }
  /**
   * Check if position is in safe zone
   */
  isInSafeZone(position) {
    if (!position) {
      return false;
    }
    for (const zone of this.config.safeZones) {
      if (position.x >= zone.bounds.min.x && position.x <= zone.bounds.max.x && position.y >= zone.bounds.min.y && position.y <= zone.bounds.max.y && position.z >= zone.bounds.min.z && position.z <= zone.bounds.max.z) {
        return true;
      }
    }
    return false;
  }
  /**
   * Get player gravestone tier
   */
  getPlayerGravestoneTier(_player) {
    return "wooden" /* WOODEN */;
  }
  /**
   * Get gravestone model
   */
  getGravestoneModel(tier) {
    const models = {
      ["basic" /* BASIC */]: "gravestone_basic",
      ["wooden" /* WOODEN */]: "gravestone_wooden",
      ["stone" /* STONE */]: "gravestone_stone",
      ["ornate" /* ORNATE */]: "gravestone_ornate",
      ["angel" /* ANGEL */]: "gravestone_angel",
      ["mystic" /* MYSTIC */]: "gravestone_mystic",
      ["royal" /* ROYAL */]: "gravestone_royal"
    };
    return models[tier];
  }
  /**
   * Calculate gravestone value
   */
  calculateGravestoneValue(gravestone) {
    let total = 0;
    for (const item of gravestone.items) {
      total += this.getItemValue(item.itemId) * item.quantity;
    }
    return total;
  }
  /**
   * Get item value
   */
  getItemValue(itemId) {
    const inventorySystem = this.world.getSystem("inventory");
    if (inventorySystem && inventorySystem.itemRegistry && typeof inventorySystem.itemRegistry.getItem === "function") {
      const item = inventorySystem.itemRegistry.getItem(itemId);
      if (item && item.value) {
        return item.value;
      }
    }
    const fallbackValues = {
      1: 15,
      // Bronze sword
      995: 1,
      // Coins
      315: 5,
      // Shrimps
      526: 1
      // Bones
    };
    return fallbackValues[itemId] || 1;
  }
  /**
   * Get player gold amount
   */
  getPlayerGold(inventory) {
    let total = 0;
    const items = inventory.data?.items || inventory.items || [];
    for (const item of items) {
      if (item && item.itemId === 995) {
        total += item.quantity;
      }
    }
    return total;
  }
  /**
   * Remove gold from player
   */
  removePlayerGold(player, amount) {
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    return inventorySystem.removeItem(player.id, 995, amount);
  }
  /**
   * Send message to player
   */
  sendMessage(playerId, message) {
    this.world.events.emit("chat:message", {
      playerId,
      message,
      type: "system"
    });
  }
  /**
   * Update system
   */
  update(_delta) {
    const now = Date.now();
    for (const [id, gravestone] of this.gravestones) {
      if (now >= gravestone.expiresAt) {
        this.expireGravestone(id);
      }
    }
  }
};

// src/rpg/systems/PvPSystem.ts
var PvPSystem = class extends System {
  // 10 seconds to leave combat in safe zone
  constructor(world) {
    super(world);
    this.pvpZones = /* @__PURE__ */ new Map();
    this.skulledPlayers = /* @__PURE__ */ new Map();
    this.combatProtection = /* @__PURE__ */ new Map();
    // New player protection
    // Configuration
    this.SKULL_DURATION = 20 * 60 * 1e3;
    // 20 minutes
    this.NEW_PLAYER_PROTECTION = 6 * 60 * 60 * 1e3;
    // 6 hours
    this.COMBAT_LEVEL_RANGE = 5;
    // Default wilderness combat range
    this.SAFE_ZONE_DELAY = 1e4;
    this.initializeZones();
  }
  /**
   * Initialize the system
   */
  async init(_options) {
    console.log("[PvPSystem] Initializing...");
    this.world.events.on("combat:attack", this.handleCombatAttack.bind(this));
    this.world.events.on("player:death", this.handlePlayerDeath.bind(this));
    this.world.events.on("player:spawned", this.handlePlayerSpawn.bind(this));
    this.world.events.on("player:move", this.handlePlayerMove.bind(this));
    this.world.events.on("player:zone:enter", this.handleZoneEnter.bind(this));
    this.world.events.on("player:zone:leave", this.handleZoneLeave.bind(this));
  }
  /**
   * Initialize PvP zones
   */
  initializeZones() {
    this.registerZone({
      id: "wilderness_low",
      name: "Low Wilderness",
      type: "wilderness",
      bounds: {
        min: { x: 2944, y: 0, z: 3520 },
        max: { x: 3391, y: 50, z: 3648 }
      },
      rules: {
        skulling: true,
        itemLoss: true,
        multiCombat: true
      }
    });
    this.registerZone({
      id: "wilderness_deep",
      name: "Deep Wilderness",
      type: "wilderness",
      bounds: {
        min: { x: 2944, y: 0, z: 3648 },
        max: { x: 3391, y: 50, z: 3967 }
      },
      rules: {
        skulling: true,
        itemLoss: true,
        multiCombat: true
      }
    });
    this.registerZone({
      id: "edgeville_safe",
      name: "Edgeville Safe Zone",
      type: "safe",
      bounds: {
        min: { x: 3073, y: 0, z: 3457 },
        max: { x: 3108, y: 20, z: 3518 }
      },
      rules: {
        skulling: false,
        itemLoss: false
      }
    });
    this.registerZone({
      id: "clan_wars_dangerous",
      name: "Clan Wars Dangerous Portal",
      type: "dangerous",
      bounds: {
        min: { x: 3327, y: 0, z: 4751 },
        max: { x: 3378, y: 20, z: 4801 }
      },
      rules: {
        skulling: false,
        itemLoss: true,
        singleCombat: false,
        multiCombat: true
      }
    });
  }
  /**
   * Register a PvP zone
   */
  registerZone(zone) {
    this.pvpZones.set(zone.id, zone);
  }
  /**
   * Handle combat attack
   */
  handleCombatAttack(event) {
    const attacker = this.world.entities.get(event.attackerId);
    const target = this.world.entities.get(event.targetId);
    if (!attacker || !target) {
      return;
    }
    if (attacker.type !== "player" || target.type !== "player") {
      return;
    }
    if (!this.canAttackPlayer(attacker, target)) {
      this.world.events.emit("combat:cancel", {
        attackerId: event.attackerId,
        reason: "PvP not allowed"
      });
      return;
    }
    this.handleSkulling(attacker, target);
  }
  /**
   * Check if player can attack another player
   */
  canAttackPlayer(attacker, target) {
    const attackerPos = attacker.position;
    const targetPos = target.position;
    const attackerZone = this.getPlayerZone(attackerPos);
    const targetZone = this.getPlayerZone(targetPos);
    if (!attackerZone || !targetZone || attackerZone.id !== targetZone.id) {
      this.sendMessage(attacker.id, "You can't attack players in different zones.");
      return false;
    }
    if (attackerZone.type === "safe") {
      this.sendMessage(attacker.id, "You can't attack players in safe zones.");
      return false;
    }
    if (this.hasNewPlayerProtection(target)) {
      this.sendMessage(attacker.id, "That player is under new player protection.");
      return false;
    }
    if (attackerZone.type === "wilderness") {
      const wildLevel = this.getWildernessLevel(attackerPos);
      if (!this.isWithinCombatRange(attacker, target, wildLevel)) {
        this.sendMessage(attacker.id, "Your combat level difference is too great.");
        return false;
      }
    }
    if (attackerZone.rules.singleCombat) {
      const attackerCombat = attacker.getComponent("combat");
      const targetCombat = target.getComponent("combat");
      if (attackerCombat?.inCombat || targetCombat?.inCombat) {
        this.sendMessage(attacker.id, "You can't attack in single combat areas when already in combat.");
        return false;
      }
    }
    return true;
  }
  /**
   * Handle skulling mechanics
   */
  handleSkulling(attacker, target) {
    const zone = this.getPlayerZone(attacker.position);
    if (!zone || !zone.rules.skulling) {
      return;
    }
    const targetSkull = this.skulledPlayers.get(target.id);
    const attackerSkull = this.skulledPlayers.get(attacker.id);
    if (attackerSkull?.attackedPlayers.has(target.id)) {
      return;
    }
    if (!targetSkull || !targetSkull.attackedPlayers.has(attacker.id)) {
      this.skullPlayer(attacker, target);
    }
  }
  /**
   * Skull a player
   */
  skullPlayer(player, victim) {
    let skullData = this.skulledPlayers.get(player.id);
    if (!skullData) {
      skullData = {
        playerId: player.id,
        skullTime: Date.now(),
        expiresAt: Date.now() + this.SKULL_DURATION,
        attackedPlayers: /* @__PURE__ */ new Set()
      };
      this.skulledPlayers.set(player.id, skullData);
    } else {
      skullData.skullTime = Date.now();
      skullData.expiresAt = Date.now() + this.SKULL_DURATION;
    }
    skullData.attackedPlayers.add(victim.id);
    player.skullTimer = this.SKULL_DURATION;
    this.world.events.emit("player:skulled", {
      playerId: player.id,
      duration: this.SKULL_DURATION
    });
    this.sendMessage(player.id, "A skull appears above your head.");
  }
  /**
   * Handle player death in PvP
   */
  handlePlayerDeath(event) {
    if (!event.killerId) {
      return;
    }
    const victim = this.world.entities.get(event.playerId);
    const killer = this.world.entities.get(event.killerId);
    if (!victim || !killer || killer.type !== "player") {
      return;
    }
    this.skulledPlayers.delete(event.playerId);
    victim.skullTimer = 0;
    this.awardPvPKill(killer, victim);
    this.world.events.emit("pvp:death", {
      victimId: event.playerId,
      killerId: event.killerId,
      position: event.position
    });
  }
  /**
   * Award PvP kill
   */
  awardPvPKill(killer, victim) {
    const killerStats = killer.pvpStats || {
      kills: 0,
      deaths: 0,
      killStreak: 0,
      bestKillStreak: 0
    };
    killerStats.kills++;
    killerStats.killStreak++;
    if (killerStats.killStreak > killerStats.bestKillStreak) {
      killerStats.bestKillStreak = killerStats.killStreak;
    }
    ;
    killer.pvpStats = killerStats;
    const riskValue = this.calculateRiskValue(victim);
    if (riskValue > 0) {
      this.world.events.emit("pvp:reward", {
        playerId: killer.id,
        victimId: victim.id,
        riskValue
      });
    }
    const zone = this.getPlayerZone(killer.position);
    if (zone?.type === "wilderness") {
      this.sendGlobalMessage(`${killer.displayName} has defeated ${victim.displayName} in the Wilderness!`);
    }
  }
  /**
   * Handle player spawn
   */
  handlePlayerSpawn(event) {
    if (event.firstTime) {
      this.combatProtection.set(event.playerId, Date.now() + this.NEW_PLAYER_PROTECTION);
    }
  }
  /**
   * Handle player movement
   */
  handlePlayerMove(event) {
    const player = this.world.entities.get(event.playerId);
    if (!player) {
      return;
    }
    const fromZone = this.getPlayerZone(event.from);
    const toZone = this.getPlayerZone(event.to);
    if (fromZone?.id !== toZone?.id) {
      if (fromZone) {
        this.world.events.emit("player:zone:leave", {
          playerId: event.playerId,
          zoneId: fromZone.id
        });
      }
      if (toZone) {
        this.world.events.emit("player:zone:enter", {
          playerId: event.playerId,
          zoneId: toZone.id
        });
      }
    }
    if (toZone?.type === "wilderness") {
      const wildLevel = this.getWildernessLevel(event.to);
      player.wildernessLevel = wildLevel;
    } else {
      ;
      player.wildernessLevel = 0;
    }
  }
  /**
   * Handle zone enter
   */
  handleZoneEnter(event) {
    const zone = this.pvpZones.get(event.zoneId);
    if (!zone) {
      return;
    }
    switch (zone.type) {
      case "wilderness":
        this.sendMessage(event.playerId, "You have entered the Wilderness!");
        this.sendMessage(event.playerId, "Other players can now attack you!");
        break;
      case "dangerous":
        this.sendMessage(event.playerId, `You have entered ${zone.name}.`);
        this.sendMessage(event.playerId, "This is a dangerous area!");
        break;
      case "safe":
        this.sendMessage(event.playerId, "You have entered a safe zone.");
        break;
    }
  }
  /**
   * Handle zone leave
   */
  handleZoneLeave(event) {
    const zone = this.pvpZones.get(event.zoneId);
    if (!zone) {
      return;
    }
    if (zone.type === "wilderness") {
      this.sendMessage(event.playerId, "You have left the Wilderness.");
    }
  }
  /**
   * Get player's current zone
   */
  getPlayerZone(position) {
    for (const zone of this.pvpZones.values()) {
      if (this.isInBounds(position, zone.bounds)) {
        return zone;
      }
    }
    return null;
  }
  /**
   * Get wilderness level at position
   */
  getWildernessLevel(position) {
    const wildernessStart = 3520;
    if (position.z < wildernessStart) {
      return 0;
    }
    const level = Math.floor((position.z - wildernessStart) / 8) + 1;
    return Math.min(level, 56);
  }
  /**
   * Check if players are within combat range
   */
  isWithinCombatRange(attacker, target, wildLevel) {
    const attackerStats = attacker.getComponent("stats");
    const targetStats = target.getComponent("stats");
    if (!attackerStats || !targetStats) {
      return false;
    }
    const attackerCombat = attackerStats.combatLevel;
    const targetCombat = targetStats.combatLevel;
    const range = wildLevel || this.COMBAT_LEVEL_RANGE;
    const minLevel = attackerCombat - range;
    const maxLevel = attackerCombat + range;
    return targetCombat >= minLevel && targetCombat <= maxLevel;
  }
  /**
   * Check if player has new player protection
   */
  hasNewPlayerProtection(player) {
    const protection = this.combatProtection.get(player.id);
    if (!protection) {
      return false;
    }
    if (Date.now() < protection) {
      return true;
    }
    this.combatProtection.delete(player.id);
    return false;
  }
  /**
   * Calculate risk value
   */
  calculateRiskValue(player) {
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return 0;
    }
    let totalValue = 0;
    for (const item of inventory.items) {
      if (item) {
        totalValue += this.getItemValue(item.itemId) * item.quantity;
      }
    }
    for (const slot of Object.values(inventory.equipment)) {
      if (slot) {
        totalValue += this.getItemValue(slot.id || 0);
      }
    }
    return totalValue;
  }
  /**
   * Get item value from registry
   */
  getItemValue(itemId) {
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (inventorySystem && "itemRegistry" in inventorySystem) {
      const item = inventorySystem.itemRegistry.get(itemId);
      if (item) {
        return item.value;
      }
    }
    return 1;
  }
  /**
   * Check if position is in bounds
   */
  isInBounds(position, bounds) {
    return position.x >= bounds.min.x && position.x <= bounds.max.x && position.y >= bounds.min.y && position.y <= bounds.max.y && position.z >= bounds.min.z && position.z <= bounds.max.z;
  }
  /**
   * Send message to player
   */
  sendMessage(playerId, message) {
    this.world.events.emit("chat:message", {
      playerId,
      message,
      type: "system"
    });
  }
  /**
   * Send global message
   */
  sendGlobalMessage(message) {
    this.world.events.emit("chat:broadcast", {
      message,
      type: "pvp"
    });
  }
  /**
   * Update system
   */
  update(_delta) {
    const now = Date.now();
    for (const [playerId, skullData] of this.skulledPlayers) {
      if (now >= skullData.expiresAt) {
        this.skulledPlayers.delete(playerId);
        const player = this.world.entities.get(playerId);
        if (player) {
          ;
          player.skullTimer = 0;
          this.world.events.emit("player:skull:removed", {
            playerId
          });
          this.sendMessage(playerId, "Your PK skull has disappeared.");
        }
      }
    }
  }
  /**
   * Get PvP stats for player
   */
  getPlayerPvPStats(playerId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return null;
    }
    return player.pvpStats || {
      kills: 0,
      deaths: 0,
      killStreak: 0,
      bestKillStreak: 0
    };
  }
  /**
   * Check if player is skulled
   */
  isPlayerSkulled(playerId) {
    return this.skulledPlayers.has(playerId);
  }
};

// src/rpg/systems/ShopSystem.ts
var ShopSystem = class extends System {
  constructor(world) {
    super(world);
    this.shops = /* @__PURE__ */ new Map();
    this.playerShops = /* @__PURE__ */ new Map();
    // For per-player stock
    this.activeSessions = /* @__PURE__ */ new Map();
    // Configuration
    this.RESTOCK_INTERVAL = 6e4;
    // 1 minute
    this.DEFAULT_BUY_MODIFIER = 1;
    this.DEFAULT_SELL_MODIFIER = 0.4;
    // 40% of item value
    this.GENERAL_STORE_ID = "general_store";
    this.registerDefaultShops();
  }
  /**
   * Register default shops
   */
  registerDefaultShops() {
    this.registerShop({
      id: this.GENERAL_STORE_ID,
      name: "General Store",
      npcId: "shopkeeper_general",
      items: [
        { itemId: 1931, stock: 30, maxStock: 30, restockRate: 1, lastRestock: Date.now() },
        // Pot
        { itemId: 1925, stock: 30, maxStock: 30, restockRate: 1, lastRestock: Date.now() },
        // Bucket
        { itemId: 590, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() },
        // Tinderbox
        { itemId: 36, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() },
        // Candle
        { itemId: 1351, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() },
        // Bronze axe
        { itemId: 1265, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() },
        // Bronze pickaxe
        { itemId: 946, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() },
        // Knife
        { itemId: 1785, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() },
        // Gloves
        { itemId: 1129, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() },
        // Leather body
        { itemId: 1095, stock: 10, maxStock: 10, restockRate: 0.5, lastRestock: Date.now() }
        // Leather chaps
      ],
      currency: "gp",
      buyModifier: this.DEFAULT_BUY_MODIFIER,
      sellModifier: this.DEFAULT_SELL_MODIFIER,
      specialStock: false,
      lastUpdate: Date.now()
    });
    this.registerShop({
      id: "sword_shop",
      name: "Varrock Swords",
      npcId: "shopkeeper_sword",
      items: [
        { itemId: 1277, stock: 5, maxStock: 5, restockRate: 0.2, lastRestock: Date.now() },
        // Bronze sword
        { itemId: 1279, stock: 4, maxStock: 4, restockRate: 0.15, lastRestock: Date.now() },
        // Iron sword
        { itemId: 1281, stock: 3, maxStock: 3, restockRate: 0.1, lastRestock: Date.now() },
        // Steel sword
        { itemId: 1285, stock: 2, maxStock: 2, restockRate: 0.05, lastRestock: Date.now() },
        // Mithril sword
        { itemId: 1287, stock: 1, maxStock: 1, restockRate: 0.02, lastRestock: Date.now() }
        // Adamant sword
      ],
      currency: "gp",
      buyModifier: 1.3,
      // Specialist shops charge more
      sellModifier: 0.5,
      specialStock: false,
      lastUpdate: Date.now()
    });
    this.registerShop({
      id: "rune_shop",
      name: "Aubury's Rune Shop",
      npcId: "shopkeeper_rune",
      items: [
        { itemId: 556, stock: 1e3, maxStock: 1e3, restockRate: 10, lastRestock: Date.now() },
        // Air rune
        { itemId: 555, stock: 1e3, maxStock: 1e3, restockRate: 10, lastRestock: Date.now() },
        // Water rune
        { itemId: 557, stock: 1e3, maxStock: 1e3, restockRate: 10, lastRestock: Date.now() },
        // Earth rune
        { itemId: 554, stock: 1e3, maxStock: 1e3, restockRate: 10, lastRestock: Date.now() },
        // Fire rune
        { itemId: 558, stock: 500, maxStock: 500, restockRate: 5, lastRestock: Date.now() },
        // Mind rune
        { itemId: 562, stock: 250, maxStock: 250, restockRate: 2, lastRestock: Date.now() }
        // Chaos rune
      ],
      currency: "gp",
      buyModifier: 1,
      sellModifier: 0.4,
      specialStock: false,
      lastUpdate: Date.now()
    });
  }
  /**
   * Register a shop
   */
  registerShop(shop) {
    this.shops.set(shop.id, shop);
  }
  /**
   * Open shop for player
   */
  openShop(playerId, shopId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const shop = this.shops.get(shopId);
    if (!shop) {
      return false;
    }
    const shopNPC = this.findShopNPC(shop.npcId);
    if (shopNPC) {
      const distance = this.getDistance(player, shopNPC);
      if (distance > 5) {
        this.sendMessage(playerId, "You are too far away from the shop.");
        return false;
      }
    }
    const session = {
      playerId,
      shopId,
      startTime: Date.now()
    };
    this.activeSessions.set(playerId, session);
    this.updateShopStock(shop);
    const stock = this.getShopStock(shop, playerId);
    this.world.events.emit("shop:opened", {
      playerId,
      shopId,
      shopName: shop.name,
      stock,
      buyModifier: shop.buyModifier,
      sellModifier: shop.sellModifier
    });
    return true;
  }
  /**
   * Close shop
   */
  closeShop(playerId) {
    const session = this.activeSessions.get(playerId);
    if (!session) {
      return;
    }
    this.activeSessions.delete(playerId);
    this.world.events.emit("shop:closed", {
      playerId,
      shopId: session.shopId
    });
  }
  /**
   * Buy item from shop
   */
  buyItem(playerId, shopId, itemIndex, quantity = 1) {
    const session = this.activeSessions.get(playerId);
    if (!session || session.shopId !== shopId) {
      return false;
    }
    const shop = this.shops.get(shopId);
    if (!shop) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const stock = this.getShopStock(shop, playerId);
    if (itemIndex < 0 || itemIndex >= stock.length) {
      return false;
    }
    const shopItem = stock[itemIndex];
    if (!shopItem || shopItem.stock < quantity) {
      this.sendMessage(playerId, "The shop doesn't have that many in stock.");
      return false;
    }
    const itemDef = this.getItemDefinition(shopItem.itemId);
    if (!itemDef) {
      return false;
    }
    const basePrice = shopItem.customPrice || itemDef.value;
    const totalPrice = Math.floor(basePrice * shop.buyModifier * quantity);
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const playerGold = this.getPlayerCurrency(inventory, shop.currency);
    if (playerGold < totalPrice) {
      this.sendMessage(playerId, "You don't have enough coins.");
      return false;
    }
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    const hasSpace = inventorySystem.hasSpace(playerId, shopItem.itemId, quantity);
    if (!hasSpace) {
      this.sendMessage(playerId, "You don't have enough inventory space.");
      return false;
    }
    if (!this.removeCurrency(playerId, shop.currency, totalPrice)) {
      return false;
    }
    inventorySystem.addItem(playerId, shopItem.itemId, quantity);
    shopItem.stock -= quantity;
    this.world.events.emit("shop:bought", {
      playerId,
      shopId,
      itemId: shopItem.itemId,
      quantity,
      price: totalPrice
    });
    this.sendMessage(playerId, `You buy ${quantity} ${itemDef.name} for ${totalPrice} coins.`);
    return true;
  }
  /**
   * Sell item to shop
   */
  sellItem(playerId, shopId, inventorySlot, quantity = 1) {
    const session = this.activeSessions.get(playerId);
    if (!session || session.shopId !== shopId) {
      return false;
    }
    const shop = this.shops.get(shopId);
    if (!shop) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const item = inventory.items[inventorySlot];
    if (!item || item.quantity < quantity) {
      return false;
    }
    const itemDef = this.getItemDefinition(item.itemId);
    if (!itemDef) {
      return false;
    }
    if (!itemDef.tradeable) {
      this.sendMessage(playerId, "You can't sell this item.");
      return false;
    }
    const basePrice = itemDef.value;
    const totalPrice = Math.floor(basePrice * shop.sellModifier * quantity);
    const shopStock = this.getShopStock(shop, playerId);
    const existingItem = shopStock.find((si) => si.itemId === item.itemId);
    if (shop.id !== this.GENERAL_STORE_ID && !existingItem) {
      this.sendMessage(playerId, "This shop doesn't buy that type of item.");
      return false;
    }
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    if (!inventorySystem.removeItem(playerId, inventorySlot, quantity)) {
      return false;
    }
    this.addCurrency(playerId, shop.currency, totalPrice);
    if (shop.id === this.GENERAL_STORE_ID && !existingItem) {
      shopStock.push({
        itemId: item.itemId,
        stock: quantity,
        maxStock: quantity,
        restockRate: -1,
        // Sold items don't restock
        lastRestock: Date.now()
      });
    } else if (existingItem) {
      existingItem.stock = Math.min(existingItem.stock + quantity, existingItem.maxStock * 2);
    }
    this.world.events.emit("shop:sold", {
      playerId,
      shopId,
      itemId: item.itemId,
      quantity,
      price: totalPrice
    });
    this.sendMessage(playerId, `You sell ${quantity} ${itemDef.name} for ${totalPrice} coins.`);
    return true;
  }
  /**
   * Get value of item at shop
   */
  getItemValue(shopId, itemId, buying) {
    const shop = this.shops.get(shopId);
    if (!shop) {
      return 0;
    }
    const itemDef = this.getItemDefinition(itemId);
    if (!itemDef) {
      return 0;
    }
    const basePrice = itemDef.value;
    const modifier = buying ? shop.buyModifier : shop.sellModifier;
    return Math.floor(basePrice * modifier);
  }
  /**
   * Update shop stock (restock items)
   */
  updateShopStock(shop) {
    const now = Date.now();
    const timeDiff = now - shop.lastUpdate;
    if (timeDiff < this.RESTOCK_INTERVAL) {
      return;
    }
    const restockTicks = Math.floor(timeDiff / this.RESTOCK_INTERVAL);
    shop.lastUpdate = now;
    for (const item of shop.items) {
      if (item.restockRate > 0 && item.stock < item.maxStock) {
        const restockAmount = Math.floor(item.restockRate * restockTicks);
        item.stock = Math.min(item.stock + restockAmount, item.maxStock);
        item.lastRestock = now;
      }
    }
  }
  /**
   * Update all shops
   */
  update(_delta) {
    const now = Date.now();
    for (const shop of this.shops.values()) {
      if (now - shop.lastUpdate >= this.RESTOCK_INTERVAL) {
        this.updateShopStock(shop);
      }
    }
  }
  /**
   * Get shop stock (handles per-player stock)
   */
  getShopStock(shop, playerId) {
    if (!shop.specialStock) {
      return shop.items;
    }
    let playerShopMap = this.playerShops.get(playerId);
    if (!playerShopMap) {
      playerShopMap = /* @__PURE__ */ new Map();
      this.playerShops.set(playerId, playerShopMap);
    }
    let playerStock = playerShopMap.get(shop.id);
    if (!playerStock) {
      playerStock = shop.items.map((item) => ({ ...item }));
      playerShopMap.set(shop.id, playerStock);
    }
    return playerStock;
  }
  /**
   * Helper methods
   */
  findShopNPC(npcId) {
    const allEntities = this.world.entities.getAll();
    for (const entity of allEntities) {
      const npcComponent = entity.getComponent("npc");
      if (npcComponent && npcComponent.npcId.toString() === npcId) {
        return entity;
      }
    }
    return null;
  }
  getDistance(entity1, entity2) {
    const pos1 = entity1.position;
    const pos2 = entity2.position;
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  getItemDefinition(itemId) {
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return null;
    }
    return inventorySystem.itemRegistry?.getItem(itemId);
  }
  getPlayerCurrency(inventory, currency) {
    if (currency !== "gp") {
      return 0;
    }
    let total = 0;
    for (const item of inventory.items) {
      if (item && item.itemId === 995) {
        total += item.quantity;
      }
    }
    return total;
  }
  removeCurrency(playerId, currency, amount) {
    if (currency !== "gp") {
      return false;
    }
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    return inventorySystem.removeItem(playerId, 995, amount);
  }
  addCurrency(playerId, currency, amount) {
    if (currency !== "gp") {
      return false;
    }
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return false;
    }
    return inventorySystem.addItem(playerId, 995, amount);
  }
  sendMessage(playerId, message) {
    this.world.events.emit("chat:system", {
      targetId: playerId,
      message
    });
  }
  /**
   * Get shop by ID
   */
  getShop(shopId) {
    return this.shops.get(shopId);
  }
  /**
   * Get all shops
   */
  getAllShops() {
    return Array.from(this.shops.values());
  }
  /**
   * Check if player has shop open
   */
  hasShopOpen(playerId) {
    return this.activeSessions.has(playerId);
  }
  /**
   * Get player's open shop
   */
  getOpenShop(playerId) {
    const session = this.activeSessions.get(playerId);
    return session ? session.shopId : null;
  }
};

// src/rpg/systems/items/ItemDefinitions.ts
var ITEM_DEFINITIONS = {
  // === WEAPONS ===
  // Bronze weapons
  bronze_dagger: {
    id: "bronze_dagger",
    name: "Bronze Dagger",
    description: "A sharp bronze dagger.",
    category: "weapon" /* WEAPON */,
    rarity: "common" /* COMMON */,
    value: 5,
    weight: 0.5,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 1 }],
    stats: {
      attackBonus: 1,
      strengthBonus: 1,
      weight: 0.5
    },
    visual: {
      color: "#CD7F32",
      model: "dagger"
    }
  },
  bronze_sword: {
    id: "bronze_sword",
    name: "Bronze Sword",
    description: "A bronze sword.",
    category: "weapon" /* WEAPON */,
    rarity: "common" /* COMMON */,
    value: 15,
    weight: 1,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 1 }],
    stats: {
      attackBonus: 3,
      strengthBonus: 2,
      weight: 1
    },
    visual: {
      color: "#CD7F32",
      model: "sword"
    }
  },
  // Iron weapons
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    description: "An iron sword.",
    category: "weapon" /* WEAPON */,
    rarity: "common" /* COMMON */,
    value: 50,
    weight: 1.2,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 1 }],
    stats: {
      attackBonus: 10,
      strengthBonus: 9,
      weight: 1.2
    },
    visual: {
      color: "#C0C0C0",
      model: "sword"
    }
  },
  // Steel weapons
  steel_sword: {
    id: "steel_sword",
    name: "Steel Sword",
    description: "A steel sword.",
    category: "weapon" /* WEAPON */,
    rarity: "common" /* COMMON */,
    value: 150,
    weight: 1.4,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 5 }],
    stats: {
      attackBonus: 21,
      strengthBonus: 20,
      weight: 1.4
    },
    visual: {
      color: "#71797E",
      model: "sword"
    }
  },
  // Mithril weapons
  mithril_sword: {
    id: "mithril_sword",
    name: "Mithril Sword",
    description: "A mithril sword.",
    category: "weapon" /* WEAPON */,
    rarity: "uncommon" /* UNCOMMON */,
    value: 500,
    weight: 1,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 20 }],
    stats: {
      attackBonus: 35,
      strengthBonus: 34,
      weight: 1
    },
    visual: {
      color: "#4A90E2",
      model: "sword"
    }
  },
  // Adamant weapons
  adamant_sword: {
    id: "adamant_sword",
    name: "Adamant Sword",
    description: "An adamant sword.",
    category: "weapon" /* WEAPON */,
    rarity: "rare" /* RARE */,
    value: 1500,
    weight: 1.6,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 30 }],
    stats: {
      attackBonus: 50,
      strengthBonus: 49,
      weight: 1.6
    },
    visual: {
      color: "#50C878",
      model: "sword"
    }
  },
  // Rune weapons
  rune_sword: {
    id: "rune_sword",
    name: "Rune Sword",
    description: "A rune sword.",
    category: "weapon" /* WEAPON */,
    rarity: "very_rare" /* VERY_RARE */,
    value: 5e3,
    weight: 1.8,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "attack" /* ATTACK */, level: 40 }],
    stats: {
      attackBonus: 67,
      strengthBonus: 66,
      weight: 1.8
    },
    visual: {
      color: "#4169E1",
      model: "sword"
    }
  },
  // === ARMOR ===
  // Bronze armor
  bronze_helmet: {
    id: "bronze_helmet",
    name: "Bronze Helmet",
    description: "A bronze helmet.",
    category: "armor" /* ARMOR */,
    rarity: "common" /* COMMON */,
    value: 20,
    weight: 1,
    stackable: false,
    tradeable: true,
    equipmentSlot: "helmet" /* HELMET */,
    requirements: [{ skill: "defence" /* DEFENCE */, level: 1 }],
    stats: {
      defenceBonus: 6,
      weight: 1
    },
    visual: {
      color: "#CD7F32",
      model: "helmet"
    }
  },
  bronze_platebody: {
    id: "bronze_platebody",
    name: "Bronze Platebody",
    description: "A bronze platebody.",
    category: "armor" /* ARMOR */,
    rarity: "common" /* COMMON */,
    value: 80,
    weight: 5,
    stackable: false,
    tradeable: true,
    equipmentSlot: "body" /* BODY */,
    requirements: [{ skill: "defence" /* DEFENCE */, level: 1 }],
    stats: {
      defenceBonus: 15,
      weight: 5
    },
    visual: {
      color: "#CD7F32",
      model: "platebody"
    }
  },
  // Iron armor
  iron_helmet: {
    id: "iron_helmet",
    name: "Iron Helmet",
    description: "An iron helmet.",
    category: "armor" /* ARMOR */,
    rarity: "common" /* COMMON */,
    value: 100,
    weight: 1.2,
    stackable: false,
    tradeable: true,
    equipmentSlot: "helmet" /* HELMET */,
    requirements: [{ skill: "defence" /* DEFENCE */, level: 1 }],
    stats: {
      defenceBonus: 15,
      weight: 1.2
    },
    visual: {
      color: "#C0C0C0",
      model: "helmet"
    }
  },
  // === CONSUMABLES ===
  // Cooked food
  cooked_shrimp: {
    id: "cooked_shrimp",
    name: "Cooked Shrimp",
    description: "Some nicely cooked shrimp.",
    category: "consumable" /* CONSUMABLE */,
    rarity: "common" /* COMMON */,
    value: 3,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 3,
      consumeTime: 1800
    },
    visual: {
      color: "#FFA500",
      model: "food"
    }
  },
  cooked_lobster: {
    id: "cooked_lobster",
    name: "Cooked Lobster",
    description: "A delicious cooked lobster.",
    category: "consumable" /* CONSUMABLE */,
    rarity: "uncommon" /* UNCOMMON */,
    value: 150,
    weight: 0.5,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 12,
      consumeTime: 1800
    },
    visual: {
      color: "#FF6347",
      model: "food"
    }
  },
  cooked_shark: {
    id: "cooked_shark",
    name: "Cooked Shark",
    description: "A perfectly cooked shark.",
    category: "consumable" /* CONSUMABLE */,
    rarity: "rare" /* RARE */,
    value: 1e3,
    weight: 1,
    stackable: true,
    tradeable: true,
    consumable: {
      healAmount: 20,
      consumeTime: 1800
    },
    visual: {
      color: "#708090",
      model: "food"
    }
  },
  // Potions
  attack_potion: {
    id: "attack_potion",
    name: "Attack Potion",
    description: "A potion that temporarily boosts attack.",
    category: "consumable" /* CONSUMABLE */,
    rarity: "uncommon" /* UNCOMMON */,
    value: 50,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      effects: [
        {
          skill: "attack" /* ATTACK */,
          boost: 3,
          duration: 5
          // 5 minutes
        }
      ],
      consumeTime: 1800
    },
    visual: {
      color: "#FF0000",
      model: "potion"
    }
  },
  strength_potion: {
    id: "strength_potion",
    name: "Strength Potion",
    description: "A potion that temporarily boosts strength.",
    category: "consumable" /* CONSUMABLE */,
    rarity: "uncommon" /* UNCOMMON */,
    value: 50,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    consumable: {
      effects: [
        {
          skill: "strength" /* STRENGTH */,
          boost: 3,
          duration: 5
        }
      ],
      consumeTime: 1800
    },
    visual: {
      color: "#800080",
      model: "potion"
    }
  },
  // === MATERIALS ===
  // Raw materials
  raw_shrimp: {
    id: "raw_shrimp",
    name: "Raw Shrimp",
    description: "Some raw shrimp.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 1,
    weight: 0.1,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#FFEFD5",
      model: "food"
    }
  },
  raw_lobster: {
    id: "raw_lobster",
    name: "Raw Lobster",
    description: "A raw lobster.",
    category: "material" /* MATERIAL */,
    rarity: "uncommon" /* UNCOMMON */,
    value: 100,
    weight: 0.5,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#8B0000",
      model: "food"
    }
  },
  raw_shark: {
    id: "raw_shark",
    name: "Raw Shark",
    description: "A raw shark.",
    category: "material" /* MATERIAL */,
    rarity: "rare" /* RARE */,
    value: 800,
    weight: 1,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#2F4F4F",
      model: "food"
    }
  },
  // Ore and bars
  copper_ore: {
    id: "copper_ore",
    name: "Copper Ore",
    description: "An ore containing copper.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 5,
    weight: 2,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#B87333",
      model: "ore"
    }
  },
  tin_ore: {
    id: "tin_ore",
    name: "Tin Ore",
    description: "An ore containing tin.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 5,
    weight: 2,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#D3D3D3",
      model: "ore"
    }
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    description: "An ore containing iron.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 25,
    weight: 2.5,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#696969",
      model: "ore"
    }
  },
  coal: {
    id: "coal",
    name: "Coal",
    description: "A lump of coal.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 100,
    weight: 2,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#36454F",
      model: "ore"
    }
  },
  bronze_bar: {
    id: "bronze_bar",
    name: "Bronze Bar",
    description: "A bar of bronze.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 50,
    weight: 1,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#CD7F32",
      model: "bar"
    }
  },
  iron_bar: {
    id: "iron_bar",
    name: "Iron Bar",
    description: "A bar of iron.",
    category: "material" /* MATERIAL */,
    rarity: "common" /* COMMON */,
    value: 150,
    weight: 1.2,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#C0C0C0",
      model: "bar"
    }
  },
  // === TOOLS ===
  bronze_pickaxe: {
    id: "bronze_pickaxe",
    name: "Bronze Pickaxe",
    description: "A pickaxe made of bronze.",
    category: "tool" /* TOOL */,
    rarity: "common" /* COMMON */,
    value: 100,
    weight: 2,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "mining" /* MINING */, level: 1 }],
    stats: {
      attackBonus: 1,
      weight: 2
    },
    visual: {
      color: "#CD7F32",
      model: "pickaxe"
    }
  },
  iron_pickaxe: {
    id: "iron_pickaxe",
    name: "Iron Pickaxe",
    description: "A pickaxe made of iron.",
    category: "tool" /* TOOL */,
    rarity: "common" /* COMMON */,
    value: 500,
    weight: 2.5,
    stackable: false,
    tradeable: true,
    equipmentSlot: "weapon" /* WEAPON */,
    requirements: [{ skill: "mining" /* MINING */, level: 1 }],
    stats: {
      attackBonus: 3,
      weight: 2.5
    },
    visual: {
      color: "#C0C0C0",
      model: "pickaxe"
    }
  },
  // === MISC ===
  coins: {
    id: "coins",
    name: "Coins",
    description: "Shiny gold coins.",
    category: "misc" /* MISC */,
    rarity: "common" /* COMMON */,
    value: 1,
    weight: 0,
    stackable: true,
    tradeable: true,
    visual: {
      color: "#FFD700",
      model: "coin"
    }
  }
};
function getItemDefinition(itemId) {
  return ITEM_DEFINITIONS[itemId] || null;
}

// src/rpg/systems/GrandExchangeSystem.ts
var GrandExchangeSystem = class extends System {
  // per item
  constructor(world) {
    super(world);
    this.offers = /* @__PURE__ */ new Map();
    this.marketData = /* @__PURE__ */ new Map();
    this.priceHistory = /* @__PURE__ */ new Map();
    this.offerCounter = 0;
    this.OFFER_DURATION = 7 * 24 * 60 * 60 * 1e3;
    // 7 days
    this.MAX_OFFERS_PER_PLAYER = 8;
    // RuneScape limit
    this.PRICE_UPDATE_INTERVAL = 6e4;
    // 1 minute
    this.MAX_PRICE_HISTORY = 1e3;
    this.initializeMarketData();
  }
  async initialize() {
    console.log("[GrandExchangeSystem] Initializing...");
    this.world.events.on("player:joined", this.handlePlayerJoined.bind(this));
    this.world.events.on("ge:place_buy_offer", this.handlePlaceBuyOffer.bind(this));
    this.world.events.on("ge:place_sell_offer", this.handlePlaceSellOffer.bind(this));
    this.world.events.on("ge:cancel_offer", this.handleCancelOffer.bind(this));
    this.world.events.on("ge:collect_offer", this.handleCollectOffer.bind(this));
    this.world.events.on("ge:view_market_data", this.handleViewMarketData.bind(this));
    this.world.events.on("ge:view_price_history", this.handleViewPriceHistory.bind(this));
    this.world.events.on("ge:search_items", this.handleSearchItems.bind(this));
    setInterval(() => this.updateMarketData(), this.PRICE_UPDATE_INTERVAL);
    console.log("[GrandExchangeSystem] Initialized with market tracking");
  }
  initializeMarketData() {
    const allItems = Object.values(ITEM_DEFINITIONS);
    for (const item of allItems) {
      if (item.tradeable) {
        this.marketData.set(item.id, {
          itemId: item.id,
          currentPrice: item.value,
          // Start with item's base value
          dailyVolume: 0,
          highPrice24h: item.value,
          lowPrice24h: item.value,
          priceChange24h: 0,
          priceChangePercent: 0,
          lastUpdated: Date.now(),
          activeOffers: {
            buy: 0,
            sell: 0
          }
        });
        this.priceHistory.set(item.id, []);
      }
    }
  }
  handlePlayerJoined(data) {
    const { entityId } = data;
    this.createGrandExchangeComponent(entityId);
  }
  createGrandExchangeComponent(entityId) {
    const entity = this.world.getEntityById(entityId);
    if (!entity) {
      return null;
    }
    const geComponent = {
      type: "grand_exchange",
      activeOffers: [],
      completedOffers: [],
      totalTradeValue: 0,
      tradesCompleted: 0,
      lastActivity: Date.now()
    };
    entity.addComponent(geComponent);
    return geComponent;
  }
  handlePlaceBuyOffer(data) {
    const { playerId, itemId, quantity, pricePerItem } = data;
    this.placeBuyOffer(playerId, itemId, quantity, pricePerItem);
  }
  handlePlaceSellOffer(data) {
    const { playerId, itemId, quantity, pricePerItem } = data;
    this.placeSellOffer(playerId, itemId, quantity, pricePerItem);
  }
  handleCancelOffer(data) {
    const { playerId, offerId } = data;
    this.cancelOffer(playerId, offerId);
  }
  handleCollectOffer(data) {
    const { playerId, offerId } = data;
    this.collectOffer(playerId, offerId);
  }
  handleViewMarketData(data) {
    const { playerId, itemId } = data;
    const marketData = this.getMarketData(itemId);
    this.world.events.emit("ge:market_data_response", {
      playerId,
      itemId,
      marketData
    });
  }
  handleViewPriceHistory(data) {
    const { playerId, itemId, timeframe } = data;
    const history = this.getPriceHistory(itemId, timeframe);
    this.world.events.emit("ge:price_history_response", {
      playerId,
      itemId,
      history
    });
  }
  handleSearchItems(data) {
    const { playerId, searchTerm } = data;
    const results = this.searchTradeableItems(searchTerm);
    this.world.events.emit("ge:search_results", {
      playerId,
      searchTerm,
      results
    });
  }
  placeBuyOffer(playerId, itemId, quantity, pricePerItem) {
    const entity = this.world.getEntityById(playerId);
    const itemDef = getItemDefinition(itemId);
    if (!entity || !itemDef) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Invalid item or player"
      });
      return false;
    }
    if (!itemDef.tradeable) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "This item cannot be traded"
      });
      return false;
    }
    const geComponent = entity.getComponent("grand_exchange");
    if (!geComponent) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Grand Exchange component not found"
      });
      return false;
    }
    if (geComponent.activeOffers.length >= this.MAX_OFFERS_PER_PLAYER) {
      this.world.events.emit("ge:error", {
        playerId,
        message: `Maximum ${this.MAX_OFFERS_PER_PLAYER} active offers allowed`
      });
      return false;
    }
    if (quantity <= 0 || pricePerItem <= 0) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Invalid quantity or price"
      });
      return false;
    }
    const totalCost = quantity * pricePerItem;
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (!inventorySystem || !inventorySystem.hasItem(playerId, "coins", totalCost)) {
      this.world.events.emit("ge:error", {
        playerId,
        message: `You need ${totalCost} coins to place this buy offer`
      });
      return false;
    }
    ;
    inventorySystem.removeItem(playerId, "coins", totalCost);
    const offerId = `buy_${this.offerCounter++}_${Date.now()}`;
    const offer = {
      id: offerId,
      playerId,
      playerName: this.getPlayerName(playerId),
      itemId,
      type: "buy" /* BUY */,
      quantity,
      pricePerItem,
      totalValue: totalCost,
      quantityRemaining: quantity,
      status: "active" /* ACTIVE */,
      created: Date.now(),
      expires: Date.now() + this.OFFER_DURATION,
      lastUpdated: Date.now()
    };
    this.offers.set(offerId, offer);
    geComponent.activeOffers.push(offerId);
    geComponent.lastActivity = Date.now();
    this.updateActiveOfferCount(itemId);
    this.attemptMatching(offer);
    this.world.events.emit("ge:buy_offer_placed", {
      playerId,
      offerId,
      itemId,
      itemName: itemDef.name,
      quantity,
      pricePerItem,
      totalCost
    });
    return true;
  }
  placeSellOffer(playerId, itemId, quantity, pricePerItem) {
    const entity = this.world.getEntityById(playerId);
    const itemDef = getItemDefinition(itemId);
    if (!entity || !itemDef) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Invalid item or player"
      });
      return false;
    }
    if (!itemDef.tradeable) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "This item cannot be traded"
      });
      return false;
    }
    const geComponent = entity.getComponent("grand_exchange");
    if (!geComponent) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Grand Exchange component not found"
      });
      return false;
    }
    if (geComponent.activeOffers.length >= this.MAX_OFFERS_PER_PLAYER) {
      this.world.events.emit("ge:error", {
        playerId,
        message: `Maximum ${this.MAX_OFFERS_PER_PLAYER} active offers allowed`
      });
      return false;
    }
    if (quantity <= 0 || pricePerItem <= 0) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Invalid quantity or price"
      });
      return false;
    }
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (!inventorySystem || !inventorySystem.hasItem(playerId, itemId, quantity)) {
      this.world.events.emit("ge:error", {
        playerId,
        message: `You need ${quantity} ${itemDef.name} to place this sell offer`
      });
      return false;
    }
    ;
    inventorySystem.removeItem(playerId, itemId, quantity);
    const offerId = `sell_${this.offerCounter++}_${Date.now()}`;
    const offer = {
      id: offerId,
      playerId,
      playerName: this.getPlayerName(playerId),
      itemId,
      type: "sell" /* SELL */,
      quantity,
      pricePerItem,
      totalValue: quantity * pricePerItem,
      quantityRemaining: quantity,
      status: "active" /* ACTIVE */,
      created: Date.now(),
      expires: Date.now() + this.OFFER_DURATION,
      lastUpdated: Date.now()
    };
    this.offers.set(offerId, offer);
    geComponent.activeOffers.push(offerId);
    geComponent.lastActivity = Date.now();
    this.updateActiveOfferCount(itemId);
    this.attemptMatching(offer);
    this.world.events.emit("ge:sell_offer_placed", {
      playerId,
      offerId,
      itemId,
      itemName: itemDef.name,
      quantity,
      pricePerItem,
      totalValue: quantity * pricePerItem
    });
    return true;
  }
  attemptMatching(newOffer) {
    const oppositeType = newOffer.type === "buy" /* BUY */ ? "sell" /* SELL */ : "buy" /* BUY */;
    const matchingOffers = Array.from(this.offers.values()).filter(
      (offer) => offer.itemId === newOffer.itemId && offer.type === oppositeType && offer.status === "active" /* ACTIVE */ && offer.playerId !== newOffer.playerId && // Can't trade with yourself
      this.canOffersMatch(newOffer, offer)
    ).sort((a, b) => {
      if (oppositeType === "buy" /* BUY */) {
        return b.pricePerItem - a.pricePerItem;
      } else {
        return a.pricePerItem - b.pricePerItem;
      }
    });
    for (const matchingOffer of matchingOffers) {
      if (newOffer.quantityRemaining <= 0) {
        break;
      }
      this.executeTrade(newOffer, matchingOffer);
    }
  }
  canOffersMatch(buyOffer, sellOffer) {
    const actualBuyOffer = buyOffer.type === "buy" /* BUY */ ? buyOffer : sellOffer;
    const actualSellOffer = buyOffer.type === "sell" /* SELL */ ? buyOffer : sellOffer;
    return actualBuyOffer.pricePerItem >= actualSellOffer.pricePerItem;
  }
  executeTrade(offer1, offer2) {
    const buyOffer = offer1.type === "buy" /* BUY */ ? offer1 : offer2;
    const sellOffer = offer1.type === "sell" /* SELL */ ? offer1 : offer2;
    const tradeQuantity = Math.min(buyOffer.quantityRemaining, sellOffer.quantityRemaining);
    const tradePrice = sellOffer.pricePerItem;
    const totalTradeValue = tradeQuantity * tradePrice;
    buyOffer.quantityRemaining -= tradeQuantity;
    sellOffer.quantityRemaining -= tradeQuantity;
    buyOffer.lastUpdated = Date.now();
    sellOffer.lastUpdated = Date.now();
    if (buyOffer.quantityRemaining === 0) {
      buyOffer.status = "completed" /* COMPLETED */;
    } else {
      buyOffer.status = "partially_filled" /* PARTIALLY_FILLED */;
    }
    if (sellOffer.quantityRemaining === 0) {
      sellOffer.status = "completed" /* COMPLETED */;
    } else {
      sellOffer.status = "partially_filled" /* PARTIALLY_FILLED */;
    }
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (inventorySystem) {
      ;
      inventorySystem.addItem(buyOffer.playerId, buyOffer.itemId, tradeQuantity);
      inventorySystem.addItem(sellOffer.playerId, "coins", totalTradeValue);
      const buyerOverpayment = (buyOffer.pricePerItem - tradePrice) * tradeQuantity;
      if (buyerOverpayment > 0) {
        ;
        inventorySystem.addItem(buyOffer.playerId, "coins", buyerOverpayment);
      }
    }
    this.updatePlayerTradeStats(buyOffer.playerId, totalTradeValue);
    this.updatePlayerTradeStats(sellOffer.playerId, totalTradeValue);
    this.recordPriceHistory(buyOffer.itemId, tradePrice, tradeQuantity);
    this.updateMarketDataFromTrade(buyOffer.itemId, tradePrice, tradeQuantity);
    this.world.events.emit("ge:trade_executed", {
      buyerId: buyOffer.playerId,
      sellerId: sellOffer.playerId,
      itemId: buyOffer.itemId,
      quantity: tradeQuantity,
      pricePerItem: tradePrice,
      totalValue: totalTradeValue,
      buyOfferId: buyOffer.id,
      sellOfferId: sellOffer.id
    });
    if (buyOffer.status === "completed" /* COMPLETED */) {
      this.moveOfferToCompleted(buyOffer.playerId, buyOffer.id);
    }
    if (sellOffer.status === "completed" /* COMPLETED */) {
      this.moveOfferToCompleted(sellOffer.playerId, sellOffer.id);
    }
  }
  cancelOffer(playerId, offerId) {
    const offer = this.offers.get(offerId);
    if (!offer || offer.playerId !== playerId) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Offer not found or not owned by you"
      });
      return false;
    }
    if (offer.status !== "active" /* ACTIVE */ && offer.status !== "partially_filled" /* PARTIALLY_FILLED */) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Cannot cancel completed or cancelled offer"
      });
      return false;
    }
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (inventorySystem) {
      if (offer.type === "buy" /* BUY */) {
        const refundAmount = offer.quantityRemaining * offer.pricePerItem;
        inventorySystem.addItem(playerId, "coins", refundAmount);
      } else {
        ;
        inventorySystem.addItem(playerId, offer.itemId, offer.quantityRemaining);
      }
    }
    offer.status = "cancelled" /* CANCELLED */;
    offer.lastUpdated = Date.now();
    const entity = this.world.getEntityById(playerId);
    if (entity) {
      const geComponent = entity.getComponent("grand_exchange");
      if (geComponent) {
        const index = geComponent.activeOffers.indexOf(offerId);
        if (index !== -1) {
          geComponent.activeOffers.splice(index, 1);
        }
        geComponent.completedOffers.push(offerId);
      }
    }
    this.updateActiveOfferCount(offer.itemId);
    this.world.events.emit("ge:offer_cancelled", {
      playerId,
      offerId,
      itemId: offer.itemId,
      refundAmount: offer.type === "buy" /* BUY */ ? offer.quantityRemaining * offer.pricePerItem : offer.quantityRemaining,
      refundType: offer.type === "buy" /* BUY */ ? "coins" : "items"
    });
    return true;
  }
  collectOffer(playerId, offerId) {
    const offer = this.offers.get(offerId);
    if (!offer || offer.playerId !== playerId) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Offer not found or not owned by you"
      });
      return false;
    }
    if (offer.status !== "completed" /* COMPLETED */) {
      this.world.events.emit("ge:error", {
        playerId,
        message: "Offer is not ready for collection"
      });
      return false;
    }
    const entity = this.world.getEntityById(playerId);
    if (entity) {
      const geComponent = entity.getComponent("grand_exchange");
      if (geComponent) {
        const index = geComponent.completedOffers.indexOf(offerId);
        if (index !== -1) {
          geComponent.completedOffers.splice(index, 1);
        }
      }
    }
    this.offers.delete(offerId);
    this.world.events.emit("ge:offer_collected", {
      playerId,
      offerId,
      itemId: offer.itemId
    });
    return true;
  }
  moveOfferToCompleted(playerId, offerId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const geComponent = entity.getComponent("grand_exchange");
    if (!geComponent) {
      return;
    }
    const activeIndex = geComponent.activeOffers.indexOf(offerId);
    if (activeIndex !== -1) {
      geComponent.activeOffers.splice(activeIndex, 1);
      geComponent.completedOffers.push(offerId);
    }
  }
  updatePlayerTradeStats(playerId, tradeValue) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return;
    }
    const geComponent = entity.getComponent("grand_exchange");
    if (!geComponent) {
      return;
    }
    geComponent.totalTradeValue += tradeValue;
    geComponent.tradesCompleted++;
    geComponent.lastActivity = Date.now();
  }
  recordPriceHistory(itemId, price, quantity) {
    const history = this.priceHistory.get(itemId) || [];
    history.push({
      itemId,
      timestamp: Date.now(),
      price,
      quantity,
      type: "trade"
    });
    if (history.length > this.MAX_PRICE_HISTORY) {
      history.splice(0, history.length - this.MAX_PRICE_HISTORY);
    }
    this.priceHistory.set(itemId, history);
  }
  updateMarketDataFromTrade(itemId, price, quantity) {
    const marketData = this.marketData.get(itemId);
    if (!marketData) {
      return;
    }
    const oldPrice = marketData.currentPrice;
    const weight = Math.min(quantity / 100, 0.1);
    marketData.currentPrice = Math.round(marketData.currentPrice * (1 - weight) + price * weight);
    marketData.dailyVolume += quantity;
    marketData.highPrice24h = Math.max(marketData.highPrice24h, price);
    marketData.lowPrice24h = Math.min(marketData.lowPrice24h, price);
    marketData.priceChange24h = marketData.currentPrice - oldPrice;
    marketData.priceChangePercent = oldPrice > 0 ? marketData.priceChange24h / oldPrice * 100 : 0;
    marketData.lastUpdated = Date.now();
  }
  updateActiveOfferCount(itemId) {
    const marketData = this.marketData.get(itemId);
    if (!marketData) {
      return;
    }
    const activeOffers = Array.from(this.offers.values()).filter(
      (offer) => offer.itemId === itemId && offer.status === "active" /* ACTIVE */
    );
    marketData.activeOffers.buy = activeOffers.filter((o) => o.type === "buy" /* BUY */).length;
    marketData.activeOffers.sell = activeOffers.filter((o) => o.type === "sell" /* SELL */).length;
  }
  updateMarketData() {
    this.cleanupExpiredOffers();
    for (const [itemId, marketData] of this.marketData) {
      this.updateActiveOfferCount(itemId);
      const now = Date.now();
      const daysSinceUpdate = (now - marketData.lastUpdated) / (24 * 60 * 60 * 1e3);
      if (daysSinceUpdate >= 1) {
        marketData.dailyVolume = 0;
        marketData.priceChange24h = 0;
        marketData.priceChangePercent = 0;
        marketData.highPrice24h = marketData.currentPrice;
        marketData.lowPrice24h = marketData.currentPrice;
      }
    }
  }
  cleanupExpiredOffers() {
    const now = Date.now();
    const expiredOffers = Array.from(this.offers.values()).filter(
      (offer) => offer.status === "active" /* ACTIVE */ && offer.expires < now
    );
    for (const offer of expiredOffers) {
      this.cancelOffer(offer.playerId, offer.id);
    }
  }
  getPlayerName(playerId) {
    const entity = this.world.getEntityById(playerId);
    return entity?.data?.name || `Player_${playerId.slice(-6)}`;
  }
  searchTradeableItems(searchTerm) {
    const allItems = Object.values(ITEM_DEFINITIONS);
    return allItems.filter(
      (item) => item.tradeable && item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  getMarketData(itemId) {
    return this.marketData.get(itemId) || null;
  }
  getPriceHistory(itemId, timeframe) {
    const history = this.priceHistory.get(itemId) || [];
    if (!timeframe) {
      return history;
    }
    const cutoff = Date.now() - timeframe;
    return history.filter((entry) => entry.timestamp >= cutoff);
  }
  getPlayerOffers(playerId) {
    const entity = this.world.getEntityById(playerId);
    if (!entity) {
      return { active: [], completed: [] };
    }
    const geComponent = entity.getComponent("grand_exchange");
    if (!geComponent) {
      return { active: [], completed: [] };
    }
    const active = geComponent.activeOffers.map((id) => this.offers.get(id)).filter((offer) => offer);
    const completed = geComponent.completedOffers.map((id) => this.offers.get(id)).filter((offer) => offer);
    return { active, completed };
  }
  getGrandExchangeComponent(playerId) {
    const entity = this.world.getEntityById(playerId);
    return entity ? entity.getComponent("grand_exchange") : null;
  }
  update(deltaTime) {
  }
  serialize() {
    return {
      offers: Object.fromEntries(this.offers),
      marketData: Object.fromEntries(this.marketData),
      priceHistory: Object.fromEntries(this.priceHistory),
      offerCounter: this.offerCounter
    };
  }
  deserialize(data) {
    if (data.offers) {
      this.offers = new Map(Object.entries(data.offers));
    }
    if (data.marketData) {
      this.marketData = new Map(Object.entries(data.marketData));
    }
    if (data.priceHistory) {
      this.priceHistory = new Map(Object.entries(data.priceHistory));
    }
    if (data.offerCounter) {
      this.offerCounter = data.offerCounter;
    }
  }
};

// src/rpg/systems/PrayerSystem.ts
var PrayerSystem = class extends System {
  constructor(world) {
    super(world);
    this.prayers = /* @__PURE__ */ new Map();
    this.activePrayers = /* @__PURE__ */ new Map();
    // entityId -> Set of prayer IDs
    this.prayerDrainTimers = /* @__PURE__ */ new Map();
    // Configuration
    this.PRAYER_TICK_RATE = 600;
    // milliseconds (game tick)
    this.BASE_DRAIN_RESISTANCE = 120;
    // Base time in seconds per prayer point
    this.originalStats = /* @__PURE__ */ new Map();
    this.registerDefaultPrayers();
  }
  /**
   * Register default prayers
   */
  registerDefaultPrayers() {
    this.registerPrayer({
      id: "thick_skin",
      name: "Thick Skin",
      level: 1,
      drainRate: 3,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "defense",
          modifier: 5
          // +5% defense
        }
      ]
    });
    this.registerPrayer({
      id: "burst_of_strength",
      name: "Burst of Strength",
      level: 4,
      drainRate: 3,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "strength",
          modifier: 5
          // +5% strength
        }
      ]
    });
    this.registerPrayer({
      id: "clarity_of_thought",
      name: "Clarity of Thought",
      level: 7,
      drainRate: 3,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "attack",
          modifier: 5
          // +5% attack
        }
      ]
    });
    this.registerPrayer({
      id: "rock_skin",
      name: "Rock Skin",
      level: 10,
      drainRate: 6,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "defense",
          modifier: 10
          // +10% defense
        }
      ]
    });
    this.registerPrayer({
      id: "superhuman_strength",
      name: "Superhuman Strength",
      level: 13,
      drainRate: 6,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "strength",
          modifier: 10
          // +10% strength
        }
      ]
    });
    this.registerPrayer({
      id: "improved_reflexes",
      name: "Improved Reflexes",
      level: 16,
      drainRate: 6,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "attack",
          modifier: 10
          // +10% attack
        }
      ]
    });
    this.registerPrayer({
      id: "protect_from_magic",
      name: "Protect from Magic",
      level: 37,
      drainRate: 12,
      overhead: true,
      category: "protection" /* PROTECTION */,
      effects: [
        {
          type: "protection",
          stat: "magic",
          modifier: 100
          // 100% protection from NPCs, 40% from players
        }
      ]
    });
    this.registerPrayer({
      id: "protect_from_missiles",
      name: "Protect from Missiles",
      level: 40,
      drainRate: 12,
      overhead: true,
      category: "protection" /* PROTECTION */,
      effects: [
        {
          type: "protection",
          stat: "ranged",
          modifier: 100
          // 100% protection from NPCs, 40% from players
        }
      ]
    });
    this.registerPrayer({
      id: "protect_from_melee",
      name: "Protect from Melee",
      level: 43,
      drainRate: 12,
      overhead: true,
      category: "protection" /* PROTECTION */,
      effects: [
        {
          type: "protection",
          stat: "melee",
          modifier: 100
          // 100% protection from NPCs, 40% from players
        }
      ]
    });
    this.registerPrayer({
      id: "eagle_eye",
      name: "Eagle Eye",
      level: 44,
      drainRate: 12,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "ranged",
          modifier: 15
          // +15% ranged
        }
      ]
    });
    this.registerPrayer({
      id: "mystic_might",
      name: "Mystic Might",
      level: 45,
      drainRate: 12,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "magic",
          modifier: 15
          // +15% magic
        }
      ]
    });
    this.registerPrayer({
      id: "steel_skin",
      name: "Steel Skin",
      level: 28,
      drainRate: 12,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "defense",
          modifier: 15
          // +15% defense
        }
      ]
    });
    this.registerPrayer({
      id: "ultimate_strength",
      name: "Ultimate Strength",
      level: 31,
      drainRate: 12,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "strength",
          modifier: 15
          // +15% strength
        }
      ]
    });
    this.registerPrayer({
      id: "incredible_reflexes",
      name: "Incredible Reflexes",
      level: 34,
      drainRate: 12,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "attack",
          modifier: 15
          // +15% attack
        }
      ]
    });
    this.registerPrayer({
      id: "piety",
      name: "Piety",
      level: 70,
      drainRate: 24,
      category: "combat" /* COMBAT */,
      effects: [
        {
          type: "stat_boost",
          stat: "attack",
          modifier: 20
          // +20% attack
        },
        {
          type: "stat_boost",
          stat: "strength",
          modifier: 23
          // +23% strength
        },
        {
          type: "stat_boost",
          stat: "defense",
          modifier: 25
          // +25% defense
        }
      ]
    });
  }
  /**
   * Register a prayer
   */
  registerPrayer(prayer) {
    this.prayers.set(prayer.id, prayer);
  }
  /**
   * Activate prayer for entity
   */
  activatePrayer(entityId, prayerId) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return false;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return false;
    }
    const prayer = this.prayers.get(prayerId);
    if (!prayer) {
      return false;
    }
    if (stats.prayer.level < prayer.level) {
      this.sendMessage(entityId, `You need level ${prayer.level} Prayer to use ${prayer.name}.`);
      return false;
    }
    if (stats.prayer.points <= 0) {
      this.sendMessage(entityId, "You have run out of Prayer points.");
      return false;
    }
    let entityPrayers = this.activePrayers.get(entityId);
    if (!entityPrayers) {
      entityPrayers = /* @__PURE__ */ new Set();
      this.activePrayers.set(entityId, entityPrayers);
    }
    this.deactivateConflictingPrayers(entityId, prayer);
    entityPrayers.add(prayerId);
    this.applyPrayerEffects(entity, prayer);
    if (prayer.overhead) {
      const combat = entity.getComponent("combat");
      if (combat) {
        this.updateProtectionPrayers(combat, prayer, true);
      }
    }
    this.world.events.emit("prayer:activated", {
      entityId,
      prayerId,
      prayerName: prayer.name
    });
    return true;
  }
  /**
   * Deactivate prayer
   */
  deactivatePrayer(entityId, prayerId) {
    const entityPrayers = this.activePrayers.get(entityId);
    if (!entityPrayers || !entityPrayers.has(prayerId)) {
      return false;
    }
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return false;
    }
    const prayer = this.prayers.get(prayerId);
    if (!prayer) {
      return false;
    }
    entityPrayers.delete(prayerId);
    this.removePrayerEffects(entity, prayer);
    if (prayer.overhead) {
      const combat = entity.getComponent("combat");
      if (combat) {
        this.updateProtectionPrayers(combat, prayer, false);
      }
    }
    this.world.events.emit("prayer:deactivated", {
      entityId,
      prayerId,
      prayerName: prayer.name
    });
    return true;
  }
  /**
   * Deactivate all prayers
   */
  deactivateAllPrayers(entityId) {
    const entityPrayers = this.activePrayers.get(entityId);
    if (!entityPrayers) {
      return;
    }
    for (const prayerId of Array.from(entityPrayers)) {
      this.deactivatePrayer(entityId, prayerId);
    }
  }
  /**
   * Update prayer drain
   */
  update(_delta) {
    const tickTime = Date.now();
    for (const [entityId, prayerSet] of this.activePrayers) {
      if (prayerSet.size === 0) {
        continue;
      }
      const entity = this.world.entities.get(entityId);
      if (!entity) {
        continue;
      }
      const stats = entity.getComponent("stats");
      if (!stats) {
        continue;
      }
      const lastDrain = this.prayerDrainTimers.get(entityId) || 0;
      if (tickTime - lastDrain >= this.PRAYER_TICK_RATE) {
        this.prayerDrainTimers.set(entityId, tickTime);
        let totalDrainRate = 0;
        for (const prayerId of prayerSet) {
          const prayer = this.prayers.get(prayerId);
          if (prayer) {
            totalDrainRate += prayer.drainRate;
          }
        }
        const prayerBonus = stats.combatBonuses.prayerBonus || 0;
        const drainResistance = this.BASE_DRAIN_RESISTANCE + prayerBonus * 2;
        const drainPerTick = totalDrainRate / (drainResistance / (this.PRAYER_TICK_RATE / 1e3));
        stats.prayer.points = Math.max(0, stats.prayer.points - drainPerTick);
        if (stats.prayer.points <= 0) {
          this.deactivateAllPrayers(entityId);
          this.sendMessage(entityId, "You have run out of Prayer points.");
        }
      }
    }
  }
  /**
   * Restore prayer points
   */
  restorePrayer(entityId, amount) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return;
    }
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const previousPoints = stats.prayer.points;
    stats.prayer.points = Math.min(stats.prayer.maxPoints, stats.prayer.points + amount);
    const restored = stats.prayer.points - previousPoints;
    if (restored > 0) {
      this.world.events.emit("prayer:restored", {
        entityId,
        amount: restored,
        current: stats.prayer.points,
        max: stats.prayer.maxPoints
      });
    }
  }
  /**
   * Get active prayers
   */
  getActivePrayers(entityId) {
    const entityPrayers = this.activePrayers.get(entityId);
    return entityPrayers ? Array.from(entityPrayers) : [];
  }
  /**
   * Check if prayer is active
   */
  isPrayerActive(entityId, prayerId) {
    const entityPrayers = this.activePrayers.get(entityId);
    return entityPrayers ? entityPrayers.has(prayerId) : false;
  }
  /**
   * Get prayer by ID
   */
  getPrayer(prayerId) {
    return this.prayers.get(prayerId);
  }
  /**
   * Get all prayers
   */
  getAllPrayers() {
    return Array.from(this.prayers.values());
  }
  /**
   * Get prayers for level
   */
  getPrayersForLevel(level) {
    return Array.from(this.prayers.values()).filter((p) => p.level <= level);
  }
  /**
   * Apply prayer effects
   */
  applyPrayerEffects(entity, prayer) {
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    let originalStats = this.originalStats.get(entity.id);
    if (!originalStats) {
      originalStats = {
        attack: { ...stats.attack },
        strength: { ...stats.strength },
        defense: { ...stats.defense },
        ranged: { ...stats.ranged },
        magic: { ...stats.magic }
      };
      this.originalStats.set(entity.id, originalStats);
    }
    for (const effect of prayer.effects) {
      switch (effect.type) {
        case "stat_boost":
          if (effect.stat && effect.modifier) {
            switch (effect.stat) {
              case "attack":
                stats.attack.level = Math.floor(originalStats.attack.level * (1 + effect.modifier / 100));
                break;
              case "strength":
                stats.strength.level = Math.floor(originalStats.strength.level * (1 + effect.modifier / 100));
                break;
              case "defense":
                stats.defense.level = Math.floor(originalStats.defense.level * (1 + effect.modifier / 100));
                break;
              case "ranged":
                stats.ranged.level = Math.floor(originalStats.ranged.level * (1 + effect.modifier / 100));
                break;
              case "magic":
                stats.magic.level = Math.floor(originalStats.magic.level * (1 + effect.modifier / 100));
                break;
            }
          }
          break;
        case "protection":
          break;
      }
    }
  }
  /**
   * Remove prayer effects
   */
  removePrayerEffects(entity, prayer) {
    const stats = entity.getComponent("stats");
    if (!stats) {
      return;
    }
    const originalStats = this.originalStats.get(entity.id);
    if (!originalStats) {
      return;
    }
    const entityPrayers = this.activePrayers.get(entity.id);
    if (!entityPrayers) {
      return;
    }
    stats.attack.level = originalStats.attack.level;
    stats.strength.level = originalStats.strength.level;
    stats.defense.level = originalStats.defense.level;
    stats.ranged.level = originalStats.ranged.level;
    stats.magic.level = originalStats.magic.level;
    for (const prayerId of entityPrayers) {
      if (prayerId === prayer.id) {
        continue;
      }
      const activePrayer = this.prayers.get(prayerId);
      if (activePrayer) {
        for (const effect of activePrayer.effects) {
          if (effect.type === "stat_boost" && effect.stat && effect.modifier) {
            switch (effect.stat) {
              case "attack":
                stats.attack.level = Math.floor(originalStats.attack.level * (1 + effect.modifier / 100));
                break;
              case "strength":
                stats.strength.level = Math.floor(originalStats.strength.level * (1 + effect.modifier / 100));
                break;
              case "defense":
                stats.defense.level = Math.floor(originalStats.defense.level * (1 + effect.modifier / 100));
                break;
              case "ranged":
                stats.ranged.level = Math.floor(originalStats.ranged.level * (1 + effect.modifier / 100));
                break;
              case "magic":
                stats.magic.level = Math.floor(originalStats.magic.level * (1 + effect.modifier / 100));
                break;
            }
          }
        }
      }
    }
    if (entityPrayers.size === 0) {
      this.originalStats.delete(entity.id);
    }
  }
  /**
   * Update protection prayers on combat component
   */
  updateProtectionPrayers(combat, prayer, active) {
    const protectionEffect = prayer.effects.find((e) => e.type === "protection");
    if (!protectionEffect) {
      return;
    }
    switch (protectionEffect.stat) {
      case "melee":
        combat.protectionPrayers.melee = active;
        break;
      case "ranged":
        combat.protectionPrayers.ranged = active;
        break;
      case "magic":
        combat.protectionPrayers.magic = active;
        break;
    }
  }
  /**
   * Deactivate conflicting prayers
   */
  deactivateConflictingPrayers(entityId, newPrayer) {
    const entityPrayers = this.activePrayers.get(entityId);
    if (!entityPrayers) {
      return;
    }
    if (newPrayer.overhead) {
      for (const prayerId of Array.from(entityPrayers)) {
        const prayer = this.prayers.get(prayerId);
        if (prayer && prayer.overhead && prayer.id !== newPrayer.id) {
          this.deactivatePrayer(entityId, prayerId);
        }
      }
    }
    for (const effect of newPrayer.effects) {
      if (effect.type === "stat_boost" && effect.stat) {
        for (const prayerId of Array.from(entityPrayers)) {
          const prayer = this.prayers.get(prayerId);
          if (prayer && prayer.id !== newPrayer.id) {
            const hasConflict = prayer.effects.some((e) => e.type === "stat_boost" && e.stat === effect.stat);
            if (hasConflict) {
              this.deactivatePrayer(entityId, prayerId);
            }
          }
        }
      }
    }
  }
  /**
   * Send message to entity
   */
  sendMessage(entityId, message) {
    this.world.events.emit("chat:system", {
      targetId: entityId,
      message
    });
  }
  /**
   * Calculate prayer drain modifier for PvP
   */
  getPvPProtectionModifier() {
    return 0.4;
  }
  /**
   * Check if entity has protection prayer active
   */
  hasProtectionPrayer(entityId, damageType) {
    const entityPrayers = this.activePrayers.get(entityId);
    if (!entityPrayers) {
      return false;
    }
    for (const prayerId of entityPrayers) {
      const prayer = this.prayers.get(prayerId);
      if (prayer) {
        const hasProtection = prayer.effects.some((e) => e.type === "protection" && e.stat === damageType);
        if (hasProtection) {
          return true;
        }
      }
    }
    return false;
  }
};

// src/rpg/systems/MagicSystem.ts
var MagicSystem = class extends System {
  constructor(world) {
    super(world);
    this.spells = /* @__PURE__ */ new Map();
    this.activeSpells = /* @__PURE__ */ new Map();
    this.spellCooldowns = /* @__PURE__ */ new Map();
    // entityId -> spellId -> cooldown end time
    this.poisonEffects = /* @__PURE__ */ new Map();
    this.weakenedStats = /* @__PURE__ */ new Map();
    // Rune IDs
    this.RUNES = {
      AIR: 556,
      WATER: 555,
      EARTH: 557,
      FIRE: 554,
      MIND: 558,
      BODY: 559,
      COSMIC: 564,
      CHAOS: 562,
      NATURE: 561,
      LAW: 563,
      DEATH: 560,
      BLOOD: 565,
      SOUL: 566,
      ASTRAL: 9075,
      // Combination runes
      DUST: 4696,
      // Air + Earth
      MIST: 4695,
      // Air + Water
      MUD: 4698,
      // Water + Earth
      SMOKE: 4697,
      // Air + Fire
      STEAM: 4694,
      // Water + Fire
      LAVA: 4699
      // Earth + Fire
    };
    this.registerDefaultSpells();
  }
  /**
   * Register default spells
   */
  registerDefaultSpells() {
    this.registerSpell({
      id: "wind_strike",
      name: "Wind Strike",
      level: 1,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.AIR, quantity: 1 },
        { runeId: this.RUNES.MIND, quantity: 1 }
      ],
      experience: 5.5,
      damage: { max: 2, type: "air" },
      range: 10
    });
    this.registerSpell({
      id: "water_strike",
      name: "Water Strike",
      level: 5,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.WATER, quantity: 1 },
        { runeId: this.RUNES.AIR, quantity: 1 },
        { runeId: this.RUNES.MIND, quantity: 1 }
      ],
      experience: 7.5,
      damage: { max: 4, type: "water" },
      range: 10
    });
    this.registerSpell({
      id: "earth_strike",
      name: "Earth Strike",
      level: 9,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.EARTH, quantity: 2 },
        { runeId: this.RUNES.AIR, quantity: 1 },
        { runeId: this.RUNES.MIND, quantity: 1 }
      ],
      experience: 9.5,
      damage: { max: 6, type: "earth" },
      range: 10
    });
    this.registerSpell({
      id: "fire_strike",
      name: "Fire Strike",
      level: 13,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 3 },
        { runeId: this.RUNES.AIR, quantity: 2 },
        { runeId: this.RUNES.MIND, quantity: 1 }
      ],
      experience: 11.5,
      damage: { max: 8, type: "fire" },
      range: 10
    });
    this.registerSpell({
      id: "wind_bolt",
      name: "Wind Bolt",
      level: 17,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.AIR, quantity: 2 },
        { runeId: this.RUNES.CHAOS, quantity: 1 }
      ],
      experience: 13.5,
      damage: { max: 9, type: "air" },
      range: 10
    });
    this.registerSpell({
      id: "fire_bolt",
      name: "Fire Bolt",
      level: 35,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 4 },
        { runeId: this.RUNES.AIR, quantity: 3 },
        { runeId: this.RUNES.CHAOS, quantity: 1 }
      ],
      experience: 22.5,
      damage: { max: 12, type: "fire" },
      range: 10
    });
    this.registerSpell({
      id: "wind_blast",
      name: "Wind Blast",
      level: 41,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.AIR, quantity: 3 },
        { runeId: this.RUNES.DEATH, quantity: 1 }
      ],
      experience: 25.5,
      damage: { max: 13, type: "air" },
      range: 10
    });
    this.registerSpell({
      id: "fire_blast",
      name: "Fire Blast",
      level: 59,
      spellbook: "standard",
      type: "combat",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 5 },
        { runeId: this.RUNES.AIR, quantity: 4 },
        { runeId: this.RUNES.DEATH, quantity: 1 }
      ],
      experience: 34.5,
      damage: { max: 16, type: "fire" },
      range: 10
    });
    this.registerSpell({
      id: "varrock_teleport",
      name: "Varrock Teleport",
      level: 25,
      spellbook: "standard",
      type: "teleport",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 1 },
        { runeId: this.RUNES.AIR, quantity: 3 },
        { runeId: this.RUNES.LAW, quantity: 1 }
      ],
      experience: 35,
      effects: [
        {
          type: "teleport",
          value: { x: 3213, y: 0, z: 3428 }
          // Varrock coordinates
        }
      ]
    });
    this.registerSpell({
      id: "lumbridge_teleport",
      name: "Lumbridge Teleport",
      level: 31,
      spellbook: "standard",
      type: "teleport",
      runes: [
        { runeId: this.RUNES.EARTH, quantity: 1 },
        { runeId: this.RUNES.AIR, quantity: 3 },
        { runeId: this.RUNES.LAW, quantity: 1 }
      ],
      experience: 41,
      effects: [
        {
          type: "teleport",
          value: { x: 3222, y: 0, z: 3218 }
          // Lumbridge coordinates
        }
      ]
    });
    this.registerSpell({
      id: "low_alchemy",
      name: "Low Level Alchemy",
      level: 21,
      spellbook: "standard",
      type: "alchemy",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 3 },
        { runeId: this.RUNES.NATURE, quantity: 1 }
      ],
      experience: 31,
      cooldown: 3e3
      // 3 seconds
    });
    this.registerSpell({
      id: "high_alchemy",
      name: "High Level Alchemy",
      level: 55,
      spellbook: "standard",
      type: "alchemy",
      runes: [
        { runeId: this.RUNES.FIRE, quantity: 5 },
        { runeId: this.RUNES.NATURE, quantity: 1 }
      ],
      experience: 65,
      cooldown: 3e3
      // 3 seconds
    });
    this.registerSpell({
      id: "ice_rush",
      name: "Ice Rush",
      level: 58,
      spellbook: "ancient",
      type: "combat",
      runes: [
        { runeId: this.RUNES.WATER, quantity: 2 },
        { runeId: this.RUNES.CHAOS, quantity: 2 },
        { runeId: this.RUNES.DEATH, quantity: 2 }
      ],
      experience: 34,
      damage: { max: 16, type: "water" },
      effects: [
        {
          type: "freeze",
          duration: 5e3
          // 5 seconds
        }
      ],
      range: 10
    });
    this.registerSpell({
      id: "ice_barrage",
      name: "Ice Barrage",
      level: 94,
      spellbook: "ancient",
      type: "combat",
      runes: [
        { runeId: this.RUNES.WATER, quantity: 6 },
        { runeId: this.RUNES.BLOOD, quantity: 2 },
        { runeId: this.RUNES.DEATH, quantity: 4 }
      ],
      experience: 52,
      damage: { max: 30, type: "water" },
      effects: [
        {
          type: "freeze",
          duration: 2e4
          // 20 seconds
        }
      ],
      range: 10
    });
  }
  /**
   * Register a spell
   */
  registerSpell(spell) {
    this.spells.set(spell.id, spell);
  }
  /**
   * Cast a spell
   */
  castSpell(casterId, spellId, targetId, position) {
    const caster = this.world.entities.get(casterId);
    if (!caster) {
      return false;
    }
    const stats = caster.getComponent("stats");
    if (!stats) {
      return false;
    }
    const spell = this.spells.get(spellId);
    if (!spell) {
      return false;
    }
    if (stats.magic.level < spell.level) {
      this.sendMessage(casterId, `You need level ${spell.level} Magic to cast ${spell.name}.`);
      return false;
    }
    if (this.isSpellOnCooldown(casterId, spellId)) {
      this.sendMessage(casterId, "That spell is still on cooldown.");
      return false;
    }
    if (!this.hasRunes(casterId, spell.runes)) {
      this.sendMessage(casterId, "You don't have the required runes to cast this spell.");
      return false;
    }
    if (spell.type === "combat" && !targetId) {
      this.sendMessage(casterId, "You need a target to cast this spell.");
      return false;
    }
    this.consumeRunes(casterId, spell.runes);
    const activeSpell = {
      spellId,
      targetId,
      castTime: Date.now(),
      position
    };
    this.activeSpells.set(casterId, activeSpell);
    if (spell.cooldown) {
      this.setSpellCooldown(casterId, spellId, spell.cooldown);
    }
    switch (spell.type) {
      case "combat":
        this.executeCombatSpell(caster, spell, targetId);
        break;
      case "teleport":
        this.executeTeleportSpell(caster, spell);
        break;
      case "alchemy":
        this.executeAlchemySpell(caster, spell);
        break;
      default:
        break;
    }
    this.grantMagicExperience(casterId, spell.experience);
    this.world.events.emit("spell:cast", {
      casterId,
      spellId,
      targetId,
      position
    });
    return true;
  }
  /**
   * Execute combat spell
   */
  executeCombatSpell(caster, spell, targetId) {
    const target = this.world.entities.get(targetId);
    if (!target) {
      return;
    }
    const distance = this.getDistance(caster, target);
    if (spell.range && distance > spell.range) {
      this.sendMessage(caster.id, "Your target is too far away.");
      return;
    }
    const casterStats = caster.getComponent("stats");
    if (!casterStats || !spell.damage) {
      return;
    }
    const magicLevel = casterStats.magic.level;
    const _magicBonus = casterStats.combatBonuses.attackMagic;
    const damage = Math.floor(Math.random() * (spell.damage.max + 1)) + Math.floor(magicLevel / 10);
    const hit = {
      damage,
      type: "normal",
      attackType: "magic" /* MAGIC */,
      attackerId: caster.id,
      targetId,
      timestamp: Date.now()
    };
    const combatSystem = this.world.getSystem("combat");
    if (combatSystem) {
      combatSystem.applyDamage(target, hit);
    }
    if (spell.effects) {
      for (const effect of spell.effects) {
        this.applySpellEffect(target, effect);
      }
    }
  }
  /**
   * Execute teleport spell
   */
  executeTeleportSpell(caster, spell) {
    const teleportEffect = spell.effects?.find((e) => e.type === "teleport");
    if (!teleportEffect || !teleportEffect.value) {
      return;
    }
    const position = teleportEffect.value;
    this.world.events.emit("player:teleport", {
      playerId: caster.id,
      position,
      spellId: spell.id
    });
    this.sendMessage(caster.id, `You teleport to ${spell.name.replace(" Teleport", "")}.`);
  }
  /**
   * Execute alchemy spell
   */
  executeAlchemySpell(caster, spell) {
    const inventory = caster.getComponent("inventory");
    if (!inventory) {
      return;
    }
    let targetSlot = -1;
    for (let i = 0; i < inventory.items.length; i++) {
      if (inventory.items[i] !== null) {
        targetSlot = i;
        break;
      }
    }
    if (targetSlot === -1) {
      this.sendMessage(caster.id, "You don't have any items to alchemize.");
      return;
    }
    const item = inventory.items[targetSlot];
    if (!item) {
      return;
    }
    const inventorySystem = this.world.getSystemByType(InventorySystem) || this.world.getSystem("inventory");
    if (!inventorySystem) {
      return;
    }
    const itemDef = inventorySystem.itemRegistry?.getItem(item.itemId);
    if (!itemDef) {
      this.sendMessage(caster.id, "That item cannot be alchemized.");
      return;
    }
    if (!itemDef.tradeable) {
      this.sendMessage(caster.id, "That item cannot be alchemized.");
      return;
    }
    let goldAmount = 0;
    if (spell.id === "high_alchemy") {
      goldAmount = Math.floor(itemDef.value * 0.6);
    } else if (spell.id === "low_alchemy") {
      goldAmount = Math.floor(itemDef.value * 0.4);
    }
    inventory.items[targetSlot] = null;
    inventorySystem.addItem(caster.id, 995, goldAmount);
    this.sendMessage(caster.id, `You cast ${spell.name} and receive ${goldAmount} coins.`);
    this.world.events.emit("spell:alchemy", {
      casterId: caster.id,
      spellId: spell.id,
      itemId: item.itemId,
      goldReceived: goldAmount
    });
  }
  /**
   * Apply spell effect to target
   */
  applySpellEffect(target, effect) {
    switch (effect.type) {
      case "freeze":
        this.world.events.emit("effect:freeze", {
          targetId: target.id,
          duration: effect.duration || 5e3
        });
        break;
      case "poison":
        const stats = target.getComponent("stats");
        if (!stats) {
          return;
        }
        const poisonData = {
          targetId: target.id,
          damage: effect.value?.damage || 2,
          // Default 2 damage per tick
          duration: effect.duration || 3e4,
          // Default 30 seconds
          tickRate: effect.value?.tickRate || 3e3,
          // Default damage every 3 seconds
          startTime: Date.now()
        };
        this.poisonEffects.set(target.id, poisonData);
        this.world.events.emit("effect:poison", poisonData);
        this.sendMessage(target.id, "You have been poisoned!");
        break;
      case "weaken":
        const targetStats = target.getComponent("stats");
        if (!targetStats) {
          return;
        }
        if (!this.weakenedStats.has(target.id)) {
          this.weakenedStats.set(target.id, {
            attack: targetStats.attack.level,
            strength: targetStats.strength.level,
            defense: targetStats.defense.level
          });
        }
        const reduction = effect.value?.reduction || 0.1;
        targetStats.attack.level = Math.floor(targetStats.attack.level * (1 - reduction));
        targetStats.strength.level = Math.floor(targetStats.strength.level * (1 - reduction));
        targetStats.defense.level = Math.floor(targetStats.defense.level * (1 - reduction));
        setTimeout(() => {
          const originalStats = this.weakenedStats.get(target.id);
          if (originalStats && targetStats) {
            targetStats.attack.level = originalStats.attack;
            targetStats.strength.level = originalStats.strength;
            targetStats.defense.level = originalStats.defense;
            this.weakenedStats.delete(target.id);
          }
        }, effect.duration || 6e4);
        this.sendMessage(target.id, "You feel weakened!");
        break;
    }
  }
  /**
   * Check if player has required runes
   */
  hasRunes(entityId, requirements) {
    const entity = this.world.entities.get(entityId);
    if (!entity) {
      return false;
    }
    const inventory = entity.getComponent("inventory");
    if (!inventory) {
      return false;
    }
    const runeAmounts = this.calculateRuneAmounts(inventory);
    for (const req of requirements) {
      if ((runeAmounts.get(req.runeId) || 0) < req.quantity) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculate rune amounts including combination runes
   */
  calculateRuneAmounts(inventory) {
    const amounts = /* @__PURE__ */ new Map();
    for (const item of inventory.items) {
      if (!item) {
        continue;
      }
      const current = amounts.get(item.itemId) || 0;
      amounts.set(item.itemId, current + item.quantity);
      switch (item.itemId) {
        case this.RUNES.DUST:
          amounts.set(this.RUNES.AIR, (amounts.get(this.RUNES.AIR) || 0) + item.quantity);
          amounts.set(this.RUNES.EARTH, (amounts.get(this.RUNES.EARTH) || 0) + item.quantity);
          break;
        case this.RUNES.MIST:
          amounts.set(this.RUNES.AIR, (amounts.get(this.RUNES.AIR) || 0) + item.quantity);
          amounts.set(this.RUNES.WATER, (amounts.get(this.RUNES.WATER) || 0) + item.quantity);
          break;
      }
    }
    return amounts;
  }
  /**
   * Consume runes for spell
   */
  consumeRunes(entityId, requirements) {
    const inventorySystem = this.world.getSystem("inventory");
    if (!inventorySystem) {
      return;
    }
    for (const req of requirements) {
      inventorySystem.removeItem(entityId, req.runeId, req.quantity);
    }
  }
  /**
   * Grant magic experience
   */
  grantMagicExperience(entityId, experience) {
    const skillsSystem = this.world.getSystem("skills");
    if (skillsSystem) {
      skillsSystem.grantXP(entityId, "magic", experience);
    }
  }
  /**
   * Check if spell is on cooldown
   */
  isSpellOnCooldown(entityId, spellId) {
    const cooldowns = this.spellCooldowns.get(entityId);
    if (!cooldowns) {
      return false;
    }
    const cooldownEnd = cooldowns.get(spellId);
    if (!cooldownEnd) {
      return false;
    }
    return Date.now() < cooldownEnd;
  }
  /**
   * Set spell cooldown
   */
  setSpellCooldown(entityId, spellId, duration) {
    let cooldowns = this.spellCooldowns.get(entityId);
    if (!cooldowns) {
      cooldowns = /* @__PURE__ */ new Map();
      this.spellCooldowns.set(entityId, cooldowns);
    }
    cooldowns.set(spellId, Date.now() + duration);
  }
  /**
   * Helper methods
   */
  getDistance(entity1, entity2) {
    const pos1 = entity1.position;
    const pos2 = entity2.position;
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  sendMessage(entityId, message) {
    this.world.events.emit("chat:system", {
      targetId: entityId,
      message
    });
  }
  /**
   * Get spell by ID
   */
  getSpell(spellId) {
    return this.spells.get(spellId);
  }
  /**
   * Get all spells for level
   */
  getSpellsForLevel(level, spellbook = "standard") {
    return Array.from(this.spells.values()).filter((s) => s.level <= level && s.spellbook === spellbook);
  }
  /**
   * Get active spell for entity
   */
  getActiveSpell(entityId) {
    return this.activeSpells.get(entityId);
  }
  /**
   * Update spell cooldowns
   */
  update(_delta) {
    const now = Date.now();
    for (const [_entityId, cooldowns] of this.spellCooldowns) {
      for (const [spellId, cooldownEnd] of cooldowns) {
        if (now >= cooldownEnd) {
          cooldowns.delete(spellId);
        }
      }
    }
    for (const [entityId, poisonData] of this.poisonEffects) {
      const entity = this.world.entities.get(entityId);
      if (!entity) {
        this.poisonEffects.delete(entityId);
        continue;
      }
      const stats = entity.getComponent("stats");
      if (!stats) {
        continue;
      }
      if (now >= poisonData.startTime + poisonData.duration) {
        this.poisonEffects.delete(entityId);
        this.sendMessage(entityId, "The poison has worn off.");
        continue;
      }
      const lastTick = poisonData.lastTick || poisonData.startTime;
      if (now >= lastTick + poisonData.tickRate) {
        poisonData.lastTick = now;
        stats.hitpoints.current = Math.max(0, stats.hitpoints.current - poisonData.damage);
        this.world.events.emit("combat:damage", {
          targetId: entityId,
          damage: poisonData.damage,
          type: "poison",
          timestamp: now
        });
        if (stats.hitpoints.current <= 0) {
          this.poisonEffects.delete(entityId);
          this.world.events.emit("entity:death", {
            entityId,
            cause: "poison"
          });
        }
      }
    }
  }
};

// src/rpg/systems/MinigameSystem.ts
var MinigameSystem = class extends System {
  constructor(world) {
    super(world);
    this.sessions = /* @__PURE__ */ new Map();
    this.playerSessions = /* @__PURE__ */ new Map();
    // playerId -> sessionId
    this.queuedPlayers = /* @__PURE__ */ new Map();
    this.minigameDefinitions = /* @__PURE__ */ new Map();
    // Configuration
    this.MAX_QUEUE_TIME = 3e5;
    // 5 minutes
    this.MIN_PLAYERS_TO_START = 2;
    this.initializeMinigames();
  }
  /**
   * Initialize minigame definitions
   */
  initializeMinigames() {
    this.minigameDefinitions.set("castle_wars" /* CASTLE_WARS */, {
      id: "castle_wars",
      name: "Castle Wars",
      type: "castle_wars" /* CASTLE_WARS */,
      minPlayers: 2,
      maxPlayers: 50,
      duration: 12e5,
      // 20 minutes
      requirements: {
        combatLevel: 10
      },
      rewards: {
        points: 100,
        experience: { attack: 500, strength: 500, defence: 500 }
      },
      status: "waiting" /* WAITING */
    });
    this.minigameDefinitions.set("fight_caves" /* FIGHT_CAVES */, {
      id: "fight_caves",
      name: "Fight Caves",
      type: "fight_caves" /* FIGHT_CAVES */,
      minPlayers: 1,
      maxPlayers: 1,
      duration: 36e5,
      // 1 hour
      requirements: {
        combatLevel: 40
      },
      rewards: {
        points: 1e3,
        items: [{ itemId: 6570, quantity: 1, chance: 1 }]
        // Fire cape
      },
      status: "waiting" /* WAITING */
    });
    console.log("[MinigameSystem] Initialized with basic minigames");
  }
  /**
   * Join minigame queue
   */
  joinQueue(playerId, minigameType) {
    if (this.playerSessions.has(playerId)) {
      this.emit("minigame:error", {
        playerId,
        error: "You are already in a minigame"
      });
      return false;
    }
    for (const [type, queue2] of this.queuedPlayers) {
      if (queue2.has(playerId)) {
        if (type === minigameType) {
          this.emit("minigame:error", {
            playerId,
            error: "You are already in this queue"
          });
          return false;
        } else {
          queue2.delete(playerId);
        }
      }
    }
    const minigame = this.minigameDefinitions.get(minigameType);
    if (!minigame) {
      return false;
    }
    if (!this.checkRequirements(playerId, minigame.requirements)) {
      return false;
    }
    let queue = this.queuedPlayers.get(minigameType);
    if (!queue) {
      queue = /* @__PURE__ */ new Set();
      this.queuedPlayers.set(minigameType, queue);
    }
    queue.add(playerId);
    const player = this.world.entities.get(playerId);
    if (player) {
      const component = this.getOrCreateMinigameComponent(player);
      component.currentMinigame = minigameType;
    }
    if (queue.size >= minigame.minPlayers) {
      this.tryStartMinigame(minigameType);
    }
    this.emit("minigame:joined-queue", {
      playerId,
      minigameType,
      queueSize: queue.size,
      minPlayers: minigame.minPlayers
    });
    return true;
  }
  /**
   * Leave minigame queue
   */
  leaveQueue(playerId) {
    for (const [type, queue] of this.queuedPlayers) {
      if (queue.has(playerId)) {
        queue.delete(playerId);
        const player = this.world.entities.get(playerId);
        if (player) {
          const component = player.getComponent("minigame");
          if (component) {
            component.currentMinigame = null;
          }
        }
        this.emit("minigame:left-queue", {
          playerId,
          minigameType: type
        });
        return true;
      }
    }
    return false;
  }
  /**
   * Leave active minigame
   */
  leaveMinigame(playerId) {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) {
      return false;
    }
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "completed") {
      return false;
    }
    session.players = session.players.filter((id) => id !== playerId);
    this.playerSessions.delete(playerId);
    if (session.teams) {
      for (const team of session.teams.values()) {
        team.players.delete(playerId);
      }
    }
    const player = this.world.entities.get(playerId);
    if (player) {
      const component = player.getComponent("minigame");
      if (component) {
        component.currentMinigame = null;
        component.sessionId = null;
        component.team = null;
      }
    }
    this.teleportToLobby(playerId);
    const minigame = this.minigameDefinitions.get(session.type);
    if (minigame && session.players.length < minigame.minPlayers) {
      this.endMinigame(sessionId, "insufficient_players");
    }
    this.emit("minigame:player-left", {
      playerId,
      sessionId,
      minigameType: session.type
    });
    return true;
  }
  /**
   * Try to start a minigame
   */
  tryStartMinigame(minigameType) {
    const queue = this.queuedPlayers.get(minigameType);
    if (!queue) {
      return false;
    }
    const minigame = this.minigameDefinitions.get(minigameType);
    if (!minigame) {
      return false;
    }
    if (queue.size < minigame.minPlayers) {
      return false;
    }
    const players = [];
    const maxToTake = Math.min(queue.size, minigame.maxPlayers);
    let count = 0;
    for (const playerId of queue) {
      if (count >= maxToTake) {
        break;
      }
      players.push(playerId);
      count++;
    }
    for (const playerId of players) {
      queue.delete(playerId);
    }
    const sessionId = this.createSession(minigameType, players);
    return sessionId !== null;
  }
  /**
   * Create minigame session
   */
  createSession(minigameType, playerIds) {
    const minigame = this.minigameDefinitions.get(minigameType);
    if (!minigame) {
      return null;
    }
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      type: minigameType,
      players: playerIds,
      teams: this.createTeams(minigameType, playerIds),
      startTime: Date.now(),
      status: "waiting",
      data: this.createMinigameData(minigameType)
    };
    this.sessions.set(sessionId, session);
    for (const playerId of playerIds) {
      this.playerSessions.set(playerId, sessionId);
      const player = this.world.entities.get(playerId);
      if (player) {
        const component = player.getComponent("minigame");
        if (component) {
          component.sessionId = sessionId;
          if (session.teams) {
            for (const [teamName, team] of session.teams) {
              if (team.players.has(playerId)) {
                component.team = teamName;
                break;
              }
            }
          }
        }
      }
    }
    setTimeout(() => {
      this.startMinigame(sessionId);
    }, 3e4);
    this.emit("minigame:session-created", {
      sessionId,
      minigameType,
      players: playerIds,
      startTime: session.startTime + 3e4
    });
    for (const playerId of playerIds) {
      this.teleportToMinigame(playerId, minigameType, session);
    }
    return sessionId;
  }
  /**
   * Start minigame
   */
  startMinigame(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "waiting") {
      return;
    }
    session.status = "in_progress";
    this.initializeGameplay(session);
    this.emit("minigame:started", {
      sessionId,
      minigameType: session.type,
      players: session.players
    });
  }
  /**
   * End minigame
   */
  endMinigame(sessionId, reason) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "completed") {
      return;
    }
    session.status = "completed";
    session.endTime = Date.now();
    const results = this.calculateResults(session);
    for (const playerId of session.players) {
      const player = this.world.entities.get(playerId);
      if (!player) {
        continue;
      }
      const playerResults = results.get(playerId);
      if (playerResults) {
        this.grantRewards(playerId, session.type, playerResults);
        this.updateStats(playerId, session.type, playerResults);
      }
      this.playerSessions.delete(playerId);
      const component = player.getComponent("minigame");
      if (component) {
        component.currentMinigame = null;
        component.sessionId = null;
        component.team = null;
      }
      this.teleportToLobby(playerId);
    }
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 6e4);
    this.emit("minigame:ended", {
      sessionId,
      minigameType: session.type,
      reason,
      results: Array.from(results.entries())
    });
  }
  /**
   * Update player score
   */
  updatePlayerScore(sessionId, playerId, points) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "in_progress") {
      return;
    }
    const minigamePlayer = this.getMinigamePlayer(session, playerId);
    if (minigamePlayer) {
      minigamePlayer.score += points;
      if (session.teams && minigamePlayer.teamId) {
        const team = session.teams.get(minigamePlayer.teamId);
        if (team) {
          team.score += points;
        }
      }
      this.emit("minigame:score-updated", {
        sessionId,
        playerId,
        score: minigamePlayer.score,
        teamId: minigamePlayer.teamId,
        teamScore: session.teams?.get(minigamePlayer.teamId || "")?.score
      });
    }
  }
  /**
   * Check if player meets requirements
   */
  checkRequirements(playerId, requirements) {
    if (!requirements) {
      return true;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    if (requirements.combatLevel) {
      const stats = player.getComponent("stats");
      if (!stats || stats.combatLevel < requirements.combatLevel) {
        this.emit("minigame:error", {
          playerId,
          error: `You need combat level ${requirements.combatLevel}`
        });
        return false;
      }
    }
    if (requirements.skills) {
      const stats = player.getComponent("stats");
      if (!stats) {
        return false;
      }
      for (const [skill, level] of Object.entries(requirements.skills)) {
        const skillData = stats[skill];
        if (!skillData || skillData.level < level) {
          this.emit("minigame:error", {
            playerId,
            error: `You need level ${level} ${skill}`
          });
          return false;
        }
      }
    }
    if (requirements.quests) {
      const questLog = player.getComponent("questLog");
      if (!questLog) {
        return false;
      }
      for (const questId of requirements.quests) {
        const quest = questLog.getQuest?.(questId);
        if (!quest || quest.status !== "completed") {
          this.emit("minigame:error", {
            playerId,
            error: "You must complete required quests first"
          });
          return false;
        }
      }
    }
    if (requirements.items) {
      const inventory = player.getComponent("inventory");
      if (!inventory) {
        return false;
      }
      for (const itemId of requirements.items) {
        if (!inventory.hasItem?.(itemId)) {
          this.emit("minigame:error", {
            playerId,
            error: "You need the required items"
          });
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Grant rewards to player
   */
  grantRewards(playerId, minigameType, results) {
    const minigame = this.minigameDefinitions.get(minigameType);
    if (!minigame) {
      return;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const rewards = this.calculateRewards(minigame.rewards, results);
    if (rewards.points > 0) {
      const component = player.getComponent("minigame");
      if (component) {
        const currentPoints = component.points.get(minigameType) || 0;
        component.points.set(minigameType, currentPoints + rewards.points);
      }
    }
    if (rewards.experience) {
      for (const [skill, xp] of Object.entries(rewards.experience)) {
        this.emit("skill:grant-xp", {
          playerId,
          skill,
          amount: xp
        });
      }
    }
    if (rewards.items) {
      const inventory = player.getComponent("inventory");
      if (inventory) {
        for (const item of rewards.items) {
          if (Math.random() < item.chance) {
            ;
            inventory.addItem?.({
              id: item.itemId,
              quantity: item.quantity
            });
          }
        }
      }
    }
    if (rewards.currency) {
      for (const [type, amount] of Object.entries(rewards.currency)) {
        this.emit("currency:grant", {
          playerId,
          type,
          amount
        });
      }
    }
    this.emit("minigame:rewards-granted", {
      playerId,
      minigameType,
      rewards
    });
  }
  /**
   * Update player statistics
   */
  updateStats(playerId, minigameType, results) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    const component = player.getComponent("minigame");
    if (!component) {
      return;
    }
    let stats = component.stats.get(minigameType);
    if (!stats) {
      stats = {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        bestScore: 0,
        totalScore: 0,
        achievements: [],
        personalBest: {}
      };
      component.stats.set(minigameType, stats);
    }
    stats.gamesPlayed++;
    if (results.won) {
      stats.wins++;
    } else {
      stats.losses++;
    }
    stats.totalScore += results.score || 0;
    if (results.score > stats.bestScore) {
      stats.bestScore = results.score;
    }
    const newAchievements = this.checkAchievements(minigameType, stats, results);
    for (const achievement of newAchievements) {
      if (!stats.achievements.includes(achievement)) {
        stats.achievements.push(achievement);
        this.emit("minigame:achievement-unlocked", {
          playerId,
          minigameType,
          achievement
        });
      }
    }
  }
  /**
   * Get or create minigame component
   */
  getOrCreateMinigameComponent(player) {
    let component = player.getComponent("minigame");
    if (!component) {
      const newComponent = {
        type: "minigame",
        entity: player,
        data: {},
        currentMinigame: null,
        sessionId: null,
        team: null,
        stats: /* @__PURE__ */ new Map(),
        points: /* @__PURE__ */ new Map(),
        unlockedRewards: []
      };
      player.addComponent("minigame", newComponent);
      component = newComponent;
    }
    return component;
  }
  /**
   * Basic implementations for minigame methods
   */
  createTeams(minigameType, playerIds) {
    if (minigameType === "castle_wars" /* CASTLE_WARS */) {
      const teams = /* @__PURE__ */ new Map();
      teams.set("red", {
        id: "red",
        name: "Red Team",
        players: /* @__PURE__ */ new Set(),
        score: 0,
        color: "#ff0000"
      });
      teams.set("blue", {
        id: "blue",
        name: "Blue Team",
        players: /* @__PURE__ */ new Set(),
        score: 0,
        color: "#0000ff"
      });
      for (let i = 0; i < playerIds.length; i++) {
        const teamName = i % 2 === 0 ? "red" : "blue";
        teams.get(teamName)?.players.add(playerIds[i]);
      }
      return teams;
    }
    return void 0;
  }
  createMinigameData(minigameType) {
    switch (minigameType) {
      case "castle_wars" /* CASTLE_WARS */:
        return {
          flags: { red: null, blue: null },
          captures: { red: 0, blue: 0 },
          respawnTimes: /* @__PURE__ */ new Map()
        };
      case "fight_caves" /* FIGHT_CAVES */:
        return {
          wave: 1,
          currentEnemies: [],
          playerPosition: { x: 0, y: 0, z: 0 }
        };
      default:
        return {};
    }
  }
  initializeGameplay(session) {
    console.log(`[MinigameSystem] Initializing gameplay for ${session.type}`);
    if (session.type === "castle_wars" /* CASTLE_WARS */) {
      this.emit("minigame:message", {
        sessionId: session.id,
        message: "Castle Wars has begun! Capture the enemy flag!"
      });
    } else if (session.type === "fight_caves" /* FIGHT_CAVES */) {
      this.emit("minigame:message", {
        sessionId: session.id,
        message: "Fight Caves: Survive 63 waves to earn your Fire Cape!"
      });
    }
  }
  calculateResults(session) {
    const results = /* @__PURE__ */ new Map();
    for (const playerId of session.players) {
      const baseResult = {
        playerId,
        score: 100,
        // Base score
        won: false,
        participated: true,
        duration: Date.now() - session.startTime
      };
      if (session.teams) {
        for (const [_teamName, team] of session.teams) {
          if (team.players.has(playerId)) {
            baseResult.won = team.score > 0;
            baseResult.score += team.score * 10;
            break;
          }
        }
      } else {
        baseResult.won = true;
        baseResult.score += 50;
      }
      results.set(playerId, baseResult);
    }
    return results;
  }
  calculateRewards(baseRewards, results) {
    const rewards = {
      points: baseRewards.points || 0,
      experience: { ...baseRewards.experience },
      items: baseRewards.items ? [...baseRewards.items] : void 0,
      currency: baseRewards.currency ? { ...baseRewards.currency } : void 0
    };
    if (results.won) {
      rewards.points = Math.floor(rewards.points * 1.5);
      if (rewards.experience) {
        for (const [skill, xp] of Object.entries(rewards.experience)) {
          rewards.experience[skill] = Math.floor(xp * 1.2);
        }
      }
    }
    if (results.participated) {
      rewards.points = Math.max(rewards.points, 25);
    }
    return rewards;
  }
  checkAchievements(minigameType, stats, results) {
    const achievements = [];
    if (stats.gamesPlayed === 1) {
      achievements.push(`${minigameType}_first_game`);
    }
    if (results.won) {
      if (stats.wins === 1) {
        achievements.push(`${minigameType}_first_win`);
      } else if (stats.wins === 10) {
        achievements.push(`${minigameType}_veteran`);
      } else if (stats.wins === 100) {
        achievements.push(`${minigameType}_master`);
      }
    }
    if (results.score >= 1e3) {
      achievements.push(`${minigameType}_high_score`);
    }
    return achievements;
  }
  teleportToMinigame(playerId, minigameType, _session) {
    this.emit("player:teleport", {
      playerId,
      destination: this.getMinigameLocation(minigameType),
      reason: "minigame_start"
    });
    console.log(`[MinigameSystem] Teleported player ${playerId} to ${minigameType}`);
  }
  teleportToLobby(playerId) {
    this.emit("player:teleport", {
      playerId,
      destination: { x: 0, y: 0, z: 0 },
      // Lobby position
      reason: "minigame_end"
    });
    console.log(`[MinigameSystem] Teleported player ${playerId} back to lobby`);
  }
  /**
   * Get minigame location
   */
  getMinigameLocation(minigameType) {
    switch (minigameType) {
      case "castle_wars" /* CASTLE_WARS */:
        return { x: -100, y: 0, z: -100 };
      case "fight_caves" /* FIGHT_CAVES */:
        return { x: 100, y: 0, z: 100 };
      default:
        return { x: 0, y: 0, z: 50 };
    }
  }
  /**
   * Helper methods
   */
  getMinigamePlayer(_session, _playerId) {
    return null;
  }
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Update loop
   */
  update(_delta) {
    const _now = Date.now();
    for (const [type, queue] of this.queuedPlayers) {
      for (const _playerId of queue) {
        if (queue.size >= this.MIN_PLAYERS_TO_START) {
          this.tryStartMinigame(type);
        }
      }
    }
    for (const session of this.sessions.values()) {
      if (session.status === "in_progress") {
        this.updateMinigame(session, _delta);
      }
    }
  }
  /**
   * Update specific minigame
   */
  updateMinigame(session, _delta) {
    const minigame = this.minigameDefinitions.get(session.type);
    if (!minigame) {
      return;
    }
    const elapsed = Date.now() - session.startTime;
    if (elapsed >= minigame.duration) {
      this.endMinigame(session.id, "time_limit");
      return;
    }
    switch (session.type) {
      case "castle_wars" /* CASTLE_WARS */:
        this.updateCastleWars(session, _delta);
        break;
      case "fight_caves" /* FIGHT_CAVES */:
        this.updateFightCaves(session, _delta);
        break;
    }
  }
  /**
   * Update Castle Wars minigame
   */
  updateCastleWars(session, _delta) {
    const _data = session.data;
    if (Math.random() < 0.01) {
      if (session.teams) {
        const teams = Array.from(session.teams.values());
        const scoringTeam = teams[Math.floor(Math.random() * teams.length)];
        scoringTeam.score++;
        this.emit("minigame:team-scored", {
          sessionId: session.id,
          teamId: scoringTeam.id,
          score: scoringTeam.score
        });
        if (scoringTeam.score >= 3) {
          this.endMinigame(session.id, "victory");
        }
      }
    }
  }
  /**
   * Update Fight Caves minigame
   */
  updateFightCaves(session, _delta) {
    const data = session.data;
    if (data.currentEnemies.length === 0) {
      data.wave++;
      if (data.wave > 63) {
        this.endMinigame(session.id, "victory");
        return;
      }
      const enemyCount = Math.min(data.wave, 5);
      data.currentEnemies = Array(enemyCount).fill(0).map((_, i) => ({
        id: `enemy_${data.wave}_${i}`,
        type: "tzhaar",
        health: 100 * data.wave
      }));
      this.emit("minigame:wave-started", {
        sessionId: session.id,
        wave: data.wave,
        enemies: data.currentEnemies.length
      });
    }
  }
};

// src/rpg/systems/ClanSystem.ts
var ClanSystem = class extends System {
  constructor(world) {
    super(world);
    this.clans = /* @__PURE__ */ new Map();
    this.playerClans = /* @__PURE__ */ new Map();
    // playerId -> clanId
    this.clanWars = /* @__PURE__ */ new Map();
    this.clanInvites = /* @__PURE__ */ new Map();
    // playerId -> Set<clanId>
    // Configuration
    this.MIN_CLAN_NAME_LENGTH = 3;
    this.MAX_CLAN_NAME_LENGTH = 20;
    this.MIN_CLAN_TAG_LENGTH = 2;
    this.MAX_CLAN_TAG_LENGTH = 5;
    this.CLAN_CREATION_COST = 1e5;
    // 100k gold
    this.CLAN_WAR_PREPARATION_TIME = 3e5;
    // 5 minutes
    this.MAX_CLAN_SIZE = 500;
    this.INACTIVE_KICK_DAYS = 30;
    // Persistence
    this.pendingSaves = /* @__PURE__ */ new Set();
    // Default permissions by rank
    this.DEFAULT_PERMISSIONS = /* @__PURE__ */ new Map([
      [
        "recruit" /* RECRUIT */,
        {
          invite: false,
          kick: false,
          promote: false,
          demote: false,
          accessTreasury: false,
          editSettings: false,
          startWars: false,
          editMotd: false,
          manageCitadel: false
        }
      ],
      [
        "corporal" /* CORPORAL */,
        {
          invite: true,
          kick: false,
          promote: false,
          demote: false,
          accessTreasury: false,
          editSettings: false,
          startWars: false,
          editMotd: false,
          manageCitadel: false
        }
      ],
      [
        "sergeant" /* SERGEANT */,
        {
          invite: true,
          kick: true,
          promote: false,
          demote: false,
          accessTreasury: false,
          editSettings: false,
          startWars: false,
          editMotd: false,
          manageCitadel: false
        }
      ],
      [
        "lieutenant" /* LIEUTENANT */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: false,
          startWars: true,
          editMotd: true,
          manageCitadel: false
        }
      ],
      [
        "captain" /* CAPTAIN */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: false,
          startWars: true,
          editMotd: true,
          manageCitadel: true
        }
      ],
      [
        "general" /* GENERAL */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: true,
          startWars: true,
          editMotd: true,
          manageCitadel: true
        }
      ],
      [
        "admin" /* ADMIN */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: true,
          startWars: true,
          editMotd: true,
          manageCitadel: true
        }
      ],
      [
        "deputy_owner" /* DEPUTY_OWNER */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: true,
          startWars: true,
          editMotd: true,
          manageCitadel: true
        }
      ],
      [
        "owner" /* OWNER */,
        {
          invite: true,
          kick: true,
          promote: true,
          demote: true,
          accessTreasury: true,
          editSettings: true,
          startWars: true,
          editMotd: true,
          manageCitadel: true
        }
      ]
    ]);
  }
  async initialize() {
    console.log("[ClanSystem] Initializing...");
    this.world.events.on("world:shutdown", this.handleShutdown.bind(this));
    this.startAutoSave();
    await this.loadClanData();
    console.log("[ClanSystem] Initialized with clan management");
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      this.savePendingClans();
    }, 3e4);
  }
  /**
   * Handle world shutdown
   */
  async handleShutdown() {
    await this.saveAllClans();
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
  }
  /**
   * Load clan data from persistence
   */
  async loadClanData() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const entities = await persistence.loadWorldEntities();
      for (const entity of entities) {
        if (entity.entityType === "clan") {
          const metadata = entity.metadata || {};
          const clan = {
            id: entity.entityId,
            name: metadata.name,
            tag: metadata.tag,
            description: metadata.description,
            owner: metadata.owner,
            created: new Date(metadata.created).getTime(),
            members: new Map(Object.entries(metadata.members || {})),
            maxMembers: metadata.maxMembers,
            level: metadata.level,
            experience: metadata.experience,
            treasury: metadata.treasury,
            settings: metadata.settings,
            features: metadata.features,
            permissions: new Map(Object.entries(metadata.permissions || {}).map(([k, v]) => [k, v]))
          };
          this.clans.set(clan.id, clan);
          for (const [playerId] of clan.members) {
            this.playerClans.set(playerId, clan.id);
          }
        }
      }
      console.log(`[ClanSystem] Loaded ${this.clans.size} clans`);
    } catch (error) {
      console.error(`[ClanSystem] Failed to load clan data:`, error);
    }
  }
  /**
   * Save a specific clan
   */
  async saveClan(clanId) {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    const clan = this.clans.get(clanId);
    if (!clan) return;
    try {
      const entity = {
        entityId: clanId,
        worldId: this.world.id || "default",
        entityType: "clan",
        position: JSON.stringify({ x: 0, y: 0, z: 0 }),
        metadata: {
          name: clan.name,
          tag: clan.tag,
          description: clan.description,
          owner: clan.owner,
          created: new Date(clan.created).toISOString(),
          members: Object.fromEntries(clan.members),
          maxMembers: clan.maxMembers,
          level: clan.level,
          experience: clan.experience,
          treasury: clan.treasury,
          settings: clan.settings,
          features: clan.features,
          permissions: Object.fromEntries(clan.permissions)
        }
      };
      await persistence.saveWorldEntities([entity]);
      console.log(`[ClanSystem] Saved clan ${clanId}`);
    } catch (error) {
      console.error(`[ClanSystem] Failed to save clan ${clanId}:`, error);
    }
  }
  /**
   * Save all pending clans
   */
  async savePendingClans() {
    if (this.pendingSaves.size === 0) return;
    const toSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();
    for (const clanId of toSave) {
      await this.saveClan(clanId);
    }
  }
  /**
   * Save all clans
   */
  async saveAllClans() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const entities = [];
      for (const [clanId, clan] of this.clans) {
        entities.push({
          entityId: clanId,
          worldId: this.world.id || "default",
          entityType: "clan",
          position: JSON.stringify({ x: 0, y: 0, z: 0 }),
          metadata: {
            name: clan.name,
            tag: clan.tag,
            description: clan.description,
            owner: clan.owner,
            created: new Date(clan.created).toISOString(),
            members: Object.fromEntries(clan.members),
            maxMembers: clan.maxMembers,
            level: clan.level,
            experience: clan.experience,
            treasury: clan.treasury,
            settings: clan.settings,
            features: clan.features,
            permissions: Object.fromEntries(clan.permissions)
          }
        });
      }
      await persistence.saveWorldEntities(entities);
      console.log(`[ClanSystem] Saved ${entities.length} clans`);
    } catch (error) {
      console.error(`[ClanSystem] Failed to save clans:`, error);
    }
  }
  /**
   * Mark clan for saving
   */
  markClanForSave(clanId) {
    this.pendingSaves.add(clanId);
  }
  /**
   * Create a new clan
   */
  createClan(founderId, name, tag, description = "") {
    if (!this.validateClanName(name)) {
      this.emit("clan:error", {
        playerId: founderId,
        error: "Invalid clan name"
      });
      return null;
    }
    if (!this.validateClanTag(tag)) {
      this.emit("clan:error", {
        playerId: founderId,
        error: "Invalid clan tag"
      });
      return null;
    }
    if (this.playerClans.has(founderId)) {
      this.emit("clan:error", {
        playerId: founderId,
        error: "You must leave your current clan first"
      });
      return null;
    }
    for (const clan2 of this.clans.values()) {
      if (clan2.name.toLowerCase() === name.toLowerCase()) {
        this.emit("clan:error", {
          playerId: founderId,
          error: "Clan name already exists"
        });
        return null;
      }
      if (clan2.tag.toLowerCase() === tag.toLowerCase()) {
        this.emit("clan:error", {
          playerId: founderId,
          error: "Clan tag already exists"
        });
        return null;
      }
    }
    const founder = this.world.entities.get(founderId);
    if (!founder) {
      return null;
    }
    const inventory = founder.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, this.CLAN_CREATION_COST)) {
      this.emit("clan:error", {
        playerId: founderId,
        error: "Insufficient gold"
      });
      return null;
    }
    this.removeGold(inventory, this.CLAN_CREATION_COST);
    const clanId = this.generateClanId();
    const founderMember = {
      playerId: founderId,
      username: founder.displayName || "Unknown",
      rank: "owner" /* OWNER */,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      contributions: this.CLAN_CREATION_COST,
      clanXp: 0
    };
    const clan = {
      id: clanId,
      name,
      tag,
      description,
      owner: founderId,
      created: Date.now(),
      members: /* @__PURE__ */ new Map([[founderId, founderMember]]),
      maxMembers: 50,
      // Start with 50, can be upgraded
      level: 1,
      experience: 0,
      treasury: 0,
      settings: {
        joinType: "invite",
        minCombatLevel: 3,
        minTotalLevel: 50,
        kickInactiveDays: this.INACTIVE_KICK_DAYS,
        clanColor: "#ffffff",
        motd: `Welcome to ${name}!`
      },
      features: {
        citadel: false,
        clanWars: true,
        clanChat: true,
        events: true
      },
      permissions: new Map(this.DEFAULT_PERMISSIONS)
    };
    this.clans.set(clanId, clan);
    this.playerClans.set(founderId, clanId);
    this.updatePlayerClanComponent(founderId, clanId, "owner" /* OWNER */);
    this.markClanForSave(clanId);
    this.emit("clan:created", {
      clanId,
      name,
      tag,
      founderId
    });
    return clanId;
  }
  /**
   * Invite a player to clan
   */
  invitePlayer(inviterId, targetPlayerId) {
    const inviterClanId = this.playerClans.get(inviterId);
    if (!inviterClanId) {
      return false;
    }
    const clan = this.clans.get(inviterClanId);
    if (!clan) {
      return false;
    }
    const inviterMember = clan.members.get(inviterId);
    if (!inviterMember) {
      return false;
    }
    const permissions = clan.permissions.get(inviterMember.rank);
    if (!permissions?.invite) {
      this.emit("clan:error", {
        playerId: inviterId,
        error: "You do not have permission to invite"
      });
      return false;
    }
    if (this.playerClans.has(targetPlayerId)) {
      this.emit("clan:error", {
        playerId: inviterId,
        error: "Player is already in a clan"
      });
      return false;
    }
    if (clan.members.size >= clan.maxMembers) {
      this.emit("clan:error", {
        playerId: inviterId,
        error: "Clan is full"
      });
      return false;
    }
    let invites = this.clanInvites.get(targetPlayerId);
    if (!invites) {
      invites = /* @__PURE__ */ new Set();
      this.clanInvites.set(targetPlayerId, invites);
    }
    invites.add(inviterClanId);
    const targetPlayer = this.world.entities.get(targetPlayerId);
    if (targetPlayer) {
      const clanComponent = targetPlayer.getComponent("clan");
      if (clanComponent) {
        clanComponent.invites.push(inviterClanId);
      }
    }
    this.emit("clan:invite-sent", {
      clanId: inviterClanId,
      inviterId,
      targetPlayerId,
      clanName: clan.name
    });
    return true;
  }
  /**
   * Accept clan invite
   */
  acceptInvite(playerId, clanId) {
    const invites = this.clanInvites.get(playerId);
    if (!invites || !invites.has(clanId)) {
      this.emit("clan:error", {
        playerId,
        error: "No invite from this clan"
      });
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const stats = player.getComponent("stats");
    if (stats) {
      if (stats.combatLevel < clan.settings.minCombatLevel) {
        this.emit("clan:error", {
          playerId,
          error: `Combat level ${clan.settings.minCombatLevel} required`
        });
        return false;
      }
      if (stats.totalLevel < clan.settings.minTotalLevel) {
        this.emit("clan:error", {
          playerId,
          error: `Total level ${clan.settings.minTotalLevel} required`
        });
        return false;
      }
    }
    if (clan.members.size >= clan.maxMembers) {
      this.emit("clan:error", {
        playerId,
        error: "Clan is full"
      });
      return false;
    }
    const member = {
      playerId,
      username: player.displayName || "Unknown",
      rank: "recruit" /* RECRUIT */,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      contributions: 0,
      clanXp: 0
    };
    clan.members.set(playerId, member);
    this.playerClans.set(playerId, clanId);
    this.clanInvites.delete(playerId);
    this.updatePlayerClanComponent(playerId, clanId, "recruit" /* RECRUIT */);
    this.markClanForSave(clanId);
    this.emit("clan:member-joined", {
      clanId,
      playerId,
      playerName: member.username
    });
    this.broadcastToClan(clanId, `${member.username} has joined the clan!`);
    return true;
  }
  /**
   * Leave clan
   */
  leaveClan(playerId) {
    const clanId = this.playerClans.get(playerId);
    if (!clanId) {
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const member = clan.members.get(playerId);
    if (!member) {
      return false;
    }
    if (member.rank === "owner" /* OWNER */) {
      let newOwner = null;
      for (const m of clan.members.values()) {
        if (m.playerId === playerId) {
          continue;
        }
        if (m.rank === "deputy_owner" /* DEPUTY_OWNER */) {
          newOwner = m;
          break;
        }
        if (!newOwner || this.getRankLevel(m.rank) > this.getRankLevel(newOwner.rank)) {
          newOwner = m;
        }
      }
      if (newOwner) {
        newOwner.rank = "owner" /* OWNER */;
        clan.owner = newOwner.playerId;
        this.markClanForSave(clanId);
        this.emit("clan:ownership-transferred", {
          clanId,
          oldOwnerId: playerId,
          newOwnerId: newOwner.playerId
        });
      } else {
        this.disbandClan(clanId);
        return true;
      }
    }
    clan.members.delete(playerId);
    this.playerClans.delete(playerId);
    this.updatePlayerClanComponent(playerId, null, null);
    this.markClanForSave(clanId);
    this.emit("clan:member-left", {
      clanId,
      playerId,
      playerName: member.username
    });
    this.broadcastToClan(clanId, `${member.username} has left the clan.`);
    return true;
  }
  /**
   * Kick member from clan
   */
  kickMember(kickerId, targetId) {
    const clanId = this.playerClans.get(kickerId);
    if (!clanId) {
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const kicker = clan.members.get(kickerId);
    const target = clan.members.get(targetId);
    if (!kicker || !target) {
      return false;
    }
    const permissions = clan.permissions.get(kicker.rank);
    if (!permissions?.kick) {
      this.emit("clan:error", {
        playerId: kickerId,
        error: "You do not have permission to kick"
      });
      return false;
    }
    if (this.getRankLevel(target.rank) >= this.getRankLevel(kicker.rank)) {
      this.emit("clan:error", {
        playerId: kickerId,
        error: "Cannot kick members of equal or higher rank"
      });
      return false;
    }
    clan.members.delete(targetId);
    this.playerClans.delete(targetId);
    this.updatePlayerClanComponent(targetId, null, null);
    this.markClanForSave(clanId);
    this.emit("clan:member-kicked", {
      clanId,
      kickerId,
      targetId,
      targetName: target.username
    });
    this.sendMessage(targetId, `You have been kicked from ${clan.name}`);
    this.broadcastToClan(clanId, `${target.username} has been kicked from the clan.`);
    return true;
  }
  /**
   * Promote clan member
   */
  promoteMember(promoterId, targetId) {
    const clanId = this.playerClans.get(promoterId);
    if (!clanId) {
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const promoter = clan.members.get(promoterId);
    const target = clan.members.get(targetId);
    if (!promoter || !target) {
      return false;
    }
    const permissions = clan.permissions.get(promoter.rank);
    if (!permissions?.promote) {
      this.emit("clan:error", {
        playerId: promoterId,
        error: "You do not have permission to promote"
      });
      return false;
    }
    const nextRank = this.getNextRank(target.rank);
    if (!nextRank) {
      this.emit("clan:error", {
        playerId: promoterId,
        error: "Member is already at highest rank"
      });
      return false;
    }
    if (this.getRankLevel(nextRank) >= this.getRankLevel(promoter.rank)) {
      this.emit("clan:error", {
        playerId: promoterId,
        error: "Cannot promote to equal or higher rank than yourself"
      });
      return false;
    }
    const oldRank = target.rank;
    target.rank = nextRank;
    this.updatePlayerClanComponent(targetId, clanId, nextRank);
    this.markClanForSave(clanId);
    this.emit("clan:member-promoted", {
      clanId,
      promoterId,
      targetId,
      oldRank,
      newRank: nextRank
    });
    this.sendMessage(targetId, `You have been promoted to ${nextRank}!`);
    this.broadcastToClan(clanId, `${target.username} has been promoted to ${nextRank}.`);
    return true;
  }
  /**
   * Start clan war
   */
  startClanWar(initiatorId, targetClanId, rules) {
    const initiatorClanId = this.playerClans.get(initiatorId);
    if (!initiatorClanId) {
      return null;
    }
    const initiatorClan = this.clans.get(initiatorClanId);
    const targetClan = this.clans.get(targetClanId);
    if (!initiatorClan || !targetClan) {
      return null;
    }
    const initiator = initiatorClan.members.get(initiatorId);
    if (!initiator) {
      return null;
    }
    const permissions = initiatorClan.permissions.get(initiator.rank);
    if (!permissions?.startWars) {
      this.emit("clan:error", {
        playerId: initiatorId,
        error: "You do not have permission to start wars"
      });
      return null;
    }
    for (const war2 of this.clanWars.values()) {
      if (war2.status === "active" || war2.status === "pending") {
        if (war2.clan1Id === initiatorClanId || war2.clan2Id === initiatorClanId || war2.clan1Id === targetClanId || war2.clan2Id === targetClanId) {
          this.emit("clan:error", {
            playerId: initiatorId,
            error: "One or both clans are already in a war"
          });
          return null;
        }
      }
    }
    const warId = this.generateWarId();
    const war = {
      id: warId,
      clan1Id: initiatorClanId,
      clan2Id: targetClanId,
      startTime: Date.now() + this.CLAN_WAR_PREPARATION_TIME,
      endTime: 0,
      status: "pending",
      participants: /* @__PURE__ */ new Map(),
      scores: {
        clan1: 0,
        clan2: 0
      },
      rules,
      winner: void 0
    };
    this.clanWars.set(warId, war);
    this.emit("clan:war-declared", {
      warId,
      clan1Id: initiatorClanId,
      clan1Name: initiatorClan.name,
      clan2Id: targetClanId,
      clan2Name: targetClan.name,
      startTime: war.startTime
    });
    this.broadcastToClan(initiatorClanId, `War declared against ${targetClan.name}! Prepare for battle!`);
    this.broadcastToClan(targetClanId, `${initiatorClan.name} has declared war! Prepare for battle!`);
    return warId;
  }
  /**
   * Join clan war
   */
  joinClanWar(playerId, warId) {
    const war = this.clanWars.get(warId);
    if (!war || war.status !== "pending") {
      return false;
    }
    const playerClanId = this.playerClans.get(playerId);
    if (!playerClanId) {
      return false;
    }
    if (playerClanId !== war.clan1Id && playerClanId !== war.clan2Id) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    const stats = player?.getComponent("stats");
    if (stats && stats.combatLevel && war.rules.combatLevelRange) {
      const combatLevel = stats.combatLevel;
      if (combatLevel < war.rules.combatLevelRange[0] || combatLevel > war.rules.combatLevelRange[1]) {
        this.emit("clan:error", {
          playerId,
          error: "Your combat level does not meet the war requirements"
        });
        return false;
      }
    }
    const participant = {
      playerId,
      clanId: playerClanId,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      healingDone: 0
    };
    war.participants.set(playerId, participant);
    this.emit("clan:war-participant-joined", {
      warId,
      playerId,
      clanId: playerClanId
    });
    return true;
  }
  /**
   * Update clan war stats
   */
  updateWarStats(warId, playerId, stat, value) {
    const war = this.clanWars.get(warId);
    if (!war || war.status !== "active") {
      return;
    }
    const participant = war.participants.get(playerId);
    if (!participant) {
      return;
    }
    participant[stat] += value;
    if (stat === "kills") {
      if (participant.clanId === war.clan1Id) {
        war.scores.clan1 += value;
      } else {
        war.scores.clan2 += value;
      }
      this.checkWarWinCondition(war);
    }
  }
  /**
   * Get clan by ID
   */
  getClan(clanId) {
    return this.clans.get(clanId) || null;
  }
  /**
   * Get player's clan
   */
  getPlayerClan(playerId) {
    const clanId = this.playerClans.get(playerId);
    if (!clanId) {
      return null;
    }
    return this.clans.get(clanId) || null;
  }
  /**
   * Search clans
   */
  searchClans(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    for (const clan of this.clans.values()) {
      if (clan.settings.joinType === "closed") {
        continue;
      }
      if (clan.name.toLowerCase().includes(lowerQuery) || clan.tag.toLowerCase().includes(lowerQuery) || clan.description.toLowerCase().includes(lowerQuery)) {
        results.push(clan);
      }
    }
    return results.slice(0, 20);
  }
  /**
   * Update clan settings
   */
  updateClanSettings(playerId, settings) {
    const clanId = this.playerClans.get(playerId);
    if (!clanId) {
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const member = clan.members.get(playerId);
    if (!member) {
      return false;
    }
    const permissions = clan.permissions.get(member.rank);
    if (!permissions?.editSettings) {
      this.emit("clan:error", {
        playerId,
        error: "You do not have permission to edit settings"
      });
      return false;
    }
    Object.assign(clan.settings, settings);
    this.markClanForSave(clanId);
    this.emit("clan:settings-updated", {
      clanId,
      updatedBy: playerId,
      settings
    });
    return true;
  }
  /**
   * Deposit to clan treasury
   */
  depositToTreasury(playerId, amount) {
    const clanId = this.playerClans.get(playerId);
    if (!clanId) {
      return false;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return false;
    }
    const member = clan.members.get(playerId);
    if (!member) {
      return false;
    }
    const player = this.world.entities.get(playerId);
    if (!player) {
      return false;
    }
    const inventory = player.getComponent("inventory");
    if (!inventory || !this.hasGold(inventory, amount)) {
      this.emit("clan:error", {
        playerId,
        error: "Insufficient gold"
      });
      return false;
    }
    this.removeGold(inventory, amount);
    clan.treasury += amount;
    member.contributions += amount;
    const xpGained = Math.floor(amount / 100);
    this.grantClanXP(clanId, xpGained);
    member.clanXp += xpGained;
    this.markClanForSave(clanId);
    this.emit("clan:treasury-deposit", {
      clanId,
      playerId,
      amount,
      newTotal: clan.treasury
    });
    return true;
  }
  /**
   * Clan chat message
   */
  sendClanMessage(senderId, message) {
    const clanId = this.playerClans.get(senderId);
    if (!clanId) {
      return;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return;
    }
    const member = clan.members.get(senderId);
    if (!member) {
      return;
    }
    if (clan.settings.joinType === "closed" && member.rank === "recruit" /* RECRUIT */) {
      this.sendMessage(senderId, "Recruits cannot talk in closed clans");
      return;
    }
    const playerComponent = this.getPlayerClanComponent(senderId);
    if (playerComponent) {
      playerComponent.lastClanChat = Date.now();
    }
    this.emit("clan:chat-message", {
      clanId,
      senderId,
      senderName: member.username,
      senderRank: member.rank,
      message,
      timestamp: Date.now()
    });
  }
  /**
   * Update member activity
   */
  updateMemberActivity(playerId) {
    const clanId = this.playerClans.get(playerId);
    if (!clanId) {
      return;
    }
    const clan = this.clans.get(clanId);
    if (!clan) {
      return;
    }
    const member = clan.members.get(playerId);
    if (!member) {
      return;
    }
    member.lastSeen = Date.now();
  }
  /**
   * Clean up inactive members
   */
  cleanupInactiveMembers() {
    const now = Date.now();
    const _inactiveThreshold = this.INACTIVE_KICK_DAYS * 24 * 60 * 60 * 1e3;
    for (const clan of this.clans.values()) {
      if (clan.settings.kickInactiveDays <= 0) {
        continue;
      }
      const threshold = clan.settings.kickInactiveDays * 24 * 60 * 60 * 1e3;
      const toKick = [];
      for (const [playerId, member] of clan.members) {
        if (this.getRankLevel(member.rank) >= this.getRankLevel("lieutenant" /* LIEUTENANT */)) {
          continue;
        }
        if (now - member.lastSeen > threshold) {
          toKick.push(playerId);
        }
      }
      for (const playerId of toKick) {
        const member = clan.members.get(playerId);
        if (member) {
          clan.members.delete(playerId);
          this.playerClans.delete(playerId);
          this.updatePlayerClanComponent(playerId, null, null);
          this.emit("clan:member-kicked", {
            clanId: clan.id,
            targetId: playerId,
            targetName: member.username,
            reason: "inactivity"
          });
        }
      }
    }
  }
  /**
   * Helper methods
   */
  validateClanName(name) {
    if (name.length < this.MIN_CLAN_NAME_LENGTH || name.length > this.MAX_CLAN_NAME_LENGTH) {
      return false;
    }
    return /^[a-zA-Z0-9 ]+$/.test(name);
  }
  validateClanTag(tag) {
    if (tag.length < this.MIN_CLAN_TAG_LENGTH || tag.length > this.MAX_CLAN_TAG_LENGTH) {
      return false;
    }
    return /^[a-zA-Z0-9]+$/.test(tag);
  }
  getRankLevel(rank) {
    const levels = {
      ["recruit" /* RECRUIT */]: 0,
      ["corporal" /* CORPORAL */]: 1,
      ["sergeant" /* SERGEANT */]: 2,
      ["lieutenant" /* LIEUTENANT */]: 3,
      ["captain" /* CAPTAIN */]: 4,
      ["general" /* GENERAL */]: 5,
      ["admin" /* ADMIN */]: 6,
      ["deputy_owner" /* DEPUTY_OWNER */]: 7,
      ["owner" /* OWNER */]: 8
    };
    return levels[rank] || 0;
  }
  getNextRank(currentRank) {
    const progression = [
      "recruit" /* RECRUIT */,
      "corporal" /* CORPORAL */,
      "sergeant" /* SERGEANT */,
      "lieutenant" /* LIEUTENANT */,
      "captain" /* CAPTAIN */,
      "general" /* GENERAL */,
      "admin" /* ADMIN */,
      "deputy_owner" /* DEPUTY_OWNER */
    ];
    const currentIndex = progression.indexOf(currentRank);
    if (currentIndex === -1 || currentIndex === progression.length - 1) {
      return null;
    }
    return progression[currentIndex + 1];
  }
  grantClanXP(clanId, xp) {
    const clan = this.clans.get(clanId);
    if (!clan) {
      return;
    }
    clan.experience += xp;
    const newLevel = Math.floor(Math.sqrt(clan.experience / 100)) + 1;
    if (newLevel > clan.level) {
      clan.level = newLevel;
      if (newLevel % 5 === 0) {
        clan.maxMembers += 10;
      }
      this.emit("clan:level-up", {
        clanId,
        newLevel,
        benefits: {
          maxMembers: clan.maxMembers
        }
      });
      this.broadcastToClan(clanId, `The clan has reached level ${newLevel}!`);
    }
    this.markClanForSave(clanId);
  }
  updatePlayerClanComponent(playerId, clanId, rank) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return;
    }
    let component = player.getComponent("clan");
    if (!component) {
      component = {
        type: "clan",
        entity: player,
        data: {},
        clanId,
        rank,
        invites: [],
        joinDate: clanId ? Date.now() : 0,
        contributions: 0,
        clanXp: 0,
        lastClanChat: 0
      };
      player.addComponent("clan", component);
    } else {
      component.clanId = clanId;
      component.rank = rank;
      if (!clanId) {
        component.joinDate = 0;
        component.contributions = 0;
        component.clanXp = 0;
      }
    }
  }
  getPlayerClanComponent(playerId) {
    const player = this.world.entities.get(playerId);
    if (!player) {
      return null;
    }
    return player.getComponent("clan");
  }
  disbandClan(clanId) {
    const clan = this.clans.get(clanId);
    if (!clan) {
      return;
    }
    for (const playerId of clan.members.keys()) {
      this.playerClans.delete(playerId);
      this.updatePlayerClanComponent(playerId, null, null);
    }
    for (const [warId, war] of this.clanWars) {
      if ((war.clan1Id === clanId || war.clan2Id === clanId) && (war.status === "pending" || war.status === "active")) {
        war.status = "completed";
        this.emit("clan:war-cancelled", {
          warId,
          reason: "clan_disbanded"
        });
      }
    }
    this.clans.delete(clanId);
    this.emit("clan:disbanded", {
      clanId,
      clanName: clan.name
    });
  }
  checkWarWinCondition(war) {
    const winScore = 100;
    let winner;
    if (war.scores.clan1 >= winScore) {
      winner = war.clan1Id;
    } else if (war.scores.clan2 >= winScore) {
      winner = war.clan2Id;
    }
    if (winner) {
      war.status = "completed";
      war.endTime = Date.now();
      const winnerClan = this.clans.get(winner);
      const loserClan = this.clans.get(winner === war.clan1Id ? war.clan2Id : war.clan1Id);
      this.emit("clan:war-ended", {
        warId: war.id,
        winnerId: winner,
        winnerName: winnerClan?.name,
        loserId: winner === war.clan1Id ? war.clan2Id : war.clan1Id,
        loserName: loserClan?.name,
        finalScore: war.scores
      });
      if (winnerClan) {
        this.grantClanXP(winner, 1e3);
        winnerClan.treasury += 5e4;
        this.markClanForSave(winner);
      }
      if (winner === war.clan1Id) {
        war.scores.clan1 += 10;
      } else {
        war.scores.clan2 += 10;
      }
    }
  }
  broadcastToClan(clanId, message) {
    this.emit("clan:broadcast", {
      clanId,
      message,
      timestamp: Date.now()
    });
  }
  sendMessage(playerId, message) {
    this.emit("chat:message", {
      playerId,
      message,
      type: "system"
    });
  }
  hasGold(inventory, amount) {
    return inventory.getItemCount(995) >= amount;
  }
  removeGold(inventory, amount) {
    inventory.removeItem(995, amount);
  }
  generateClanId() {
    return `clan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  generateWarId() {
    return `war_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Update loop
   */
  update(_delta) {
    const now = Date.now();
    for (const war of this.clanWars.values()) {
      if (war.status === "pending" && war.startTime && now >= war.startTime) {
        war.status = "active";
        this.emit("clan:war-started", {
          warId: war.id,
          clan1Id: war.clan1Id,
          clan2Id: war.clan2Id
        });
      }
    }
    if (now % 36e5 < _delta) {
      this.cleanupInactiveMembers();
    }
  }
  /**
   * Serialize clan system data
   */
  serialize() {
    return {
      clans: Object.fromEntries(
        Array.from(this.clans.entries()).map(([id, clan]) => [
          id,
          {
            ...clan,
            members: Object.fromEntries(clan.members),
            permissions: Object.fromEntries(clan.permissions)
          }
        ])
      ),
      playerClans: Object.fromEntries(this.playerClans),
      clanWars: Object.fromEntries(
        Array.from(this.clanWars.entries()).map(([id, war]) => [
          id,
          {
            ...war,
            participants: Object.fromEntries(war.participants)
          }
        ])
      ),
      clanInvites: Object.fromEntries(
        Array.from(this.clanInvites.entries()).map(([playerId, invites]) => [
          playerId,
          Array.from(invites)
        ])
      )
    };
  }
  /**
   * Deserialize clan system data
   */
  deserialize(data) {
    if (data.clans) {
      this.clans = new Map(
        Object.entries(data.clans).map(([id, clan]) => [
          id,
          {
            ...clan,
            members: new Map(Object.entries(clan.members || {})),
            permissions: new Map(Object.entries(clan.permissions || {}).map(([k, v]) => [k, v]))
          }
        ])
      );
    }
    if (data.playerClans) {
      this.playerClans = new Map(Object.entries(data.playerClans));
    }
    if (data.clanWars) {
      this.clanWars = new Map(
        Object.entries(data.clanWars).map(([id, war]) => [
          id,
          {
            ...war,
            participants: new Map(Object.entries(war.participants || {}))
          }
        ])
      );
    }
    if (data.clanInvites) {
      this.clanInvites = new Map(
        Object.entries(data.clanInvites).map(([playerId, invites]) => [
          playerId,
          new Set(invites || [])
        ])
      );
    }
  }
};

// ../../node_modules/lodash-es/_freeGlobal.js
var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
var freeGlobal_default = freeGlobal;

// ../../node_modules/lodash-es/_root.js
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root = freeGlobal_default || freeSelf || Function("return this")();
var root_default = root;

// ../../node_modules/lodash-es/_Symbol.js
var Symbol2 = root_default.Symbol;
var Symbol_default = Symbol2;

// ../../node_modules/lodash-es/_getRawTag.js
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var nativeObjectToString = objectProto.toString;
var symToStringTag = Symbol_default ? Symbol_default.toStringTag : void 0;
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
  try {
    value[symToStringTag] = void 0;
    var unmasked = true;
  } catch (e) {
  }
  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}
var getRawTag_default = getRawTag;

// ../../node_modules/lodash-es/_objectToString.js
var objectProto2 = Object.prototype;
var nativeObjectToString2 = objectProto2.toString;
function objectToString(value) {
  return nativeObjectToString2.call(value);
}
var objectToString_default = objectToString;

// ../../node_modules/lodash-es/_baseGetTag.js
var nullTag = "[object Null]";
var undefinedTag = "[object Undefined]";
var symToStringTag2 = Symbol_default ? Symbol_default.toStringTag : void 0;
function baseGetTag(value) {
  if (value == null) {
    return value === void 0 ? undefinedTag : nullTag;
  }
  return symToStringTag2 && symToStringTag2 in Object(value) ? getRawTag_default(value) : objectToString_default(value);
}
var baseGetTag_default = baseGetTag;

// ../../node_modules/lodash-es/isObjectLike.js
function isObjectLike(value) {
  return value != null && typeof value == "object";
}
var isObjectLike_default = isObjectLike;

// ../../node_modules/lodash-es/isBoolean.js
var boolTag = "[object Boolean]";
function isBoolean(value) {
  return value === true || value === false || isObjectLike_default(value) && baseGetTag_default(value) == boolTag;
}
var isBoolean_default = isBoolean;

// ../../node_modules/lodash-es/isNumber.js
var numberTag = "[object Number]";
function isNumber(value) {
  return typeof value == "number" || isObjectLike_default(value) && baseGetTag_default(value) == numberTag;
}
var isNumber_default = isNumber;

// src/core/nodes/Node.ts
function isBoolean2(value) {
  return typeof value === "boolean";
}
var _v1 = new THREE.Vector3();
var _v2 = new THREE.Vector3();
var _q1 = new THREE.Quaternion();
var _m1 = new THREE.Matrix4();
var defaults = {
  active: true,
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]
};
var nodeIds = -1;
var EPSILON = 1e-9;
var secure = { allowRef: false };
function getRef(pNode) {
  if (!pNode || !pNode._isRef) {
    return pNode;
  }
  secure.allowRef = true;
  const node = pNode._ref;
  secure.allowRef = false;
  return node;
}
function secureRef(obj = {}, getRef2) {
  const tpl = {
    get _ref() {
      if (!secure.allowRef) {
        return null;
      }
      return getRef2();
    }
  };
  obj._isRef = true;
  const descriptor = Object.getOwnPropertyDescriptor(tpl, "_ref");
  if (descriptor) {
    Object.defineProperty(obj, "_ref", descriptor);
  }
  return obj;
}
var Node = class {
  constructor(data = {}) {
    this.id = data.id || `${++nodeIds}`;
    this.name = "node";
    this.parent = null;
    this.children = [], this.ctx = null;
    this.position = new THREE.Vector3();
    this.position.fromArray(data.position || defaults.position);
    this.quaternion = new THREE.Quaternion();
    this.quaternion.fromArray(data.quaternion || defaults.quaternion);
    this.rotation = new THREE.Euler().setFromQuaternion(this.quaternion);
    this.rotation.reorder("YXZ");
    this.scale = new THREE.Vector3();
    this.scale.fromArray(data.scale || defaults.scale);
    this.matrix = new THREE.Matrix4();
    this.matrixWorld = new THREE.Matrix4();
    this.position._onChange(() => {
      this.setTransformed();
    });
    this.rotation._onChange(() => {
      this.quaternion.setFromEuler(this.rotation, false);
      this.setTransformed();
    });
    this.quaternion._onChange(() => {
      this.rotation.setFromQuaternion(this.quaternion, void 0, false);
      this.setTransformed();
    });
    this.scale._onChange(() => {
      if (this.scale.x === 0 || this.scale.y === 0 || this.scale.z === 0) {
        return this.scale.set(this.scale.x || EPSILON, this.scale.y || EPSILON, this.scale.z || EPSILON);
      }
      this.setTransformed();
      return this.scale;
    });
    this._onPointerEnter = data.onPointerEnter;
    this._onPointerLeave = data.onPointerLeave;
    this._onPointerDown = data.onPointerDown;
    this._onPointerUp = data.onPointerUp;
    this._cursor = data.cursor;
    this._active = isBoolean2(data.active) ? data.active : defaults.active;
    this.isDirty = false;
    this.isTransformed = true;
    this.mounted = false;
  }
  activate(ctx) {
    if (ctx) {
      this.ctx = ctx;
    }
    if (!this._active) {
      return;
    }
    if (this.mounted) {
      return;
    }
    this.updateTransform();
    this.mounted = true;
    this.mount();
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child) {
        child.activate(ctx);
      }
    }
  }
  deactivate() {
    if (!this.mounted) {
      return;
    }
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child) {
        child.deactivate();
      }
    }
    this.unmount();
    this.isDirty = false;
    this.isTransformed = true;
    this.mounted = false;
  }
  add(node) {
    if (!node) {
      return console.error("no node to add");
    }
    if (node.parent) {
      node.parent.remove(node);
    }
    node.parent = this;
    this.children.push(node);
    if (this.mounted) {
      node.activate(this.ctx);
    }
    return this;
  }
  remove(node) {
    const idx = this.children.indexOf(node);
    if (idx === -1) {
      return;
    }
    node.deactivate();
    node.parent = null;
    this.children.splice(idx, 1);
    return this;
  }
  // detach(node) {
  //   if (node) {
  //     const idx = this.children.indexOf(node)
  //     if (idx === -1) return
  //     this.project()
  //     node.parent = null
  //     this.children.splice(idx, 1)
  //     node.matrix.copy(node.matrixWorld)
  //     node.matrix.decompose(node.position, node.quaternion, node.scale)
  //     node.project()
  //     node.update()
  //   } else {
  //     this.parent?.detach(this)
  //   }
  // }
  setTransformed() {
    if (this.isTransformed) {
      return;
    }
    this.traverse((node) => {
      if (node === this) {
        node.isTransformed = true;
        node.setDirty();
      } else if (node.isDirty) {
        this.ctx.world.stage.dirtyNodes.delete(node);
      } else {
        node.isDirty = true;
      }
    });
  }
  setDirty() {
    if (!this.mounted) {
      return;
    }
    if (this.isDirty) {
      return;
    }
    this.isDirty = true;
    this.ctx.world.stage.dirtyNodes.add(this);
  }
  get active() {
    return this._active;
  }
  set active(value) {
    if (this._active === value) {
      return;
    }
    this._active = value;
    if (!this._active && this.mounted) {
      this.deactivate();
    } else if (this._active && this.parent?.mounted) {
      this.activate(this.parent.ctx);
    } else if (this._active && !this.parent) {
      this.activate(this.ctx);
    }
  }
  clean() {
    if (!this.isDirty) {
      return;
    }
    let top = this;
    while (top.parent && top.parent.isDirty) {
      top = top.parent;
    }
    let didTransform;
    top.traverse((node) => {
      if (node.isTransformed) {
        didTransform = true;
      }
      if (didTransform) {
        node.updateTransform();
      }
      if (node.mounted) {
        node.commit(didTransform || false);
      }
      node.isDirty = false;
    });
  }
  mount() {
  }
  commit(_didTransform) {
  }
  unmount() {
  }
  updateTransform() {
    if (this.isTransformed) {
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.isTransformed = false;
    }
    if (this.parent) {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    } else {
      this.matrixWorld.copy(this.matrix);
    }
  }
  traverse(callback) {
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child) {
        child.traverse(callback);
      }
    }
  }
  clone(recursive) {
    return new this.constructor().copy(this, recursive);
  }
  copy(source, recursive) {
    this.id = source.id;
    this.position.copy(source.position);
    this.quaternion.copy(source.quaternion);
    this.scale.copy(source.scale);
    this._onPointerEnter = source._onPointerEnter;
    this._onPointerLeave = source._onPointerLeave;
    this._onPointerDown = source._onPointerDown;
    this._onPointerUp = source._onPointerUp;
    this._cursor = source._cursor;
    this._active = source._active;
    if (recursive) {
      for (let i = 0; i < source.children.length; i++) {
        const child = source.children[i];
        if (child) {
          this.add(child.clone(recursive));
        }
      }
    }
    return this;
  }
  get(id) {
    if (this.id === id) {
      return this;
    }
    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i];
      if (child) {
        const found = child.get(id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }
  // todo: getWorldQuaternion etc
  getWorldPosition(vec3 = _v1) {
    this.matrixWorld.decompose(vec3, _q1, _v2);
    return vec3;
  }
  getWorldMatrix(mat = _m1) {
    return mat.copy(this.matrixWorld);
  }
  getStats(recursive, stats) {
    if (!stats) {
      stats = {
        geometries: /* @__PURE__ */ new Set(),
        materials: /* @__PURE__ */ new Set(),
        triangles: 0,
        textureBytes: 0
      };
    }
    this.applyStats(stats);
    if (recursive) {
      for (const child of this.children) {
        child.getStats(recursive, stats);
      }
    }
    return stats;
  }
  applyStats(_stats) {
  }
  get onPointerEnter() {
    return this._onPointerEnter;
  }
  set onPointerEnter(value) {
    this._onPointerEnter = value;
  }
  get onPointerLeave() {
    return this._onPointerLeave;
  }
  set onPointerLeave(value) {
    this._onPointerLeave = value;
  }
  get onPointerDown() {
    return this._onPointerDown;
  }
  set onPointerDown(value) {
    this._onPointerDown = value;
  }
  get onPointerUp() {
    return this._onPointerUp;
  }
  set onPointerUp(value) {
    this._onPointerUp = value;
  }
  get cursor() {
    return this._cursor;
  }
  set cursor(value) {
    this._cursor = value;
  }
  getProxy() {
    if (!this.proxy) {
      const self2 = this;
      const proxy = {
        get id() {
          return self2.id;
        },
        set id(_value) {
          throw new Error("Setting ID not currently supported");
        },
        get name() {
          return self2.name;
        },
        get position() {
          return self2.position;
        },
        set position(_value) {
          throw new Error("Cannot replace node position");
        },
        get quaternion() {
          return self2.quaternion;
        },
        set quaternion(_value) {
          throw new Error("Cannot replace node quaternion");
        },
        get rotation() {
          return self2.rotation;
        },
        set rotation(_value) {
          throw new Error("Cannot replace node position");
        },
        get scale() {
          return self2.scale;
        },
        set scale(_value) {
          throw new Error("Cannot replace node scale");
        },
        get matrixWorld() {
          return self2.matrixWorld;
        },
        get active() {
          return self2.active;
        },
        set active(value) {
          self2.active = value;
        },
        get parent() {
          return self2.parent?.getProxy();
        },
        set parent(_value) {
          throw new Error("Cannot set parent directly");
        },
        get children() {
          return self2.children.map((child) => {
            return child.getProxy();
          });
        },
        get(id) {
          const node = self2.get(id);
          return node?.getProxy() || null;
        },
        getWorldMatrix(mat) {
          return self2.getWorldMatrix(mat);
        },
        add(pNode) {
          const node = getRef(pNode);
          self2.add(node);
          return this;
        },
        remove(pNode) {
          const node = getRef(pNode);
          self2.remove(node);
          return this;
        },
        traverse(callback) {
          self2.traverse((node) => {
            callback(node.getProxy());
          });
        },
        // detach(node) {
        //   self.detach(node)
        // },
        clone(recursive) {
          const node = self2.clone(recursive);
          return node.getProxy();
        },
        clean() {
          self2.clean();
        },
        get _ref() {
          if (!secure.allowRef) {
            return null;
          }
          return self2;
        },
        get _isRef() {
          return true;
        },
        get onPointerEnter() {
          return self2.onPointerEnter;
        },
        set onPointerEnter(value) {
          self2.onPointerEnter = value;
        },
        get onPointerLeave() {
          return self2.onPointerLeave;
        },
        set onPointerLeave(value) {
          self2.onPointerLeave = value;
        },
        get onPointerDown() {
          return self2.onPointerDown;
        },
        set onPointerDown(value) {
          self2.onPointerDown = value;
        },
        get onPointerUp() {
          return self2.onPointerUp;
        },
        set onPointerUp(value) {
          self2.onPointerUp = value;
        },
        get cursor() {
          return self2.cursor;
        },
        set cursor(value) {
          self2.cursor = value;
        }
      };
      this.proxy = proxy;
    }
    return this.proxy;
  }
};

// src/core/extras/getTrianglesFromGeometry.ts
function getTrianglesFromGeometry(geometry) {
  if (!geometry) {
    return 0;
  }
  return geometry.index !== null ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

// src/core/extras/getTextureBytesFromMaterial.ts
var slots = [
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "map",
  "metalnessMap",
  "normalMap",
  "roughnessMap"
];
function getTextureBytesFromMaterial(material) {
  let bytes = 0;
  if (material) {
    const checked = /* @__PURE__ */ new Set();
    for (const slot of slots) {
      const texture = material[slot];
      if (texture && texture.image && !checked.has(texture.uuid)) {
        checked.add(texture.uuid);
        const image = texture.image;
        bytes += image.width * image.height * 4;
      }
    }
  }
  return bytes;
}

// src/core/nodes/Mesh.ts
var defaults2 = {
  type: "box",
  width: 1,
  height: 1,
  depth: 1,
  radius: 0.5,
  geometry: null,
  material: null,
  linked: true,
  castShadow: true,
  receiveShadow: true,
  visible: true
  // DEPRECATED: use Node.active
};
var types = ["box", "sphere", "geometry"];
var boxes = {};
var getBox = (width, height, depth) => {
  const key = `${width},${height},${depth}`;
  if (!boxes[key]) {
    boxes[key] = new THREE.BoxGeometry(width, height, depth);
  }
  return boxes[key];
};
var spheres = {};
var getSphere = (radius) => {
  const key = radius;
  if (!spheres[key]) {
    spheres[key] = new THREE.SphereGeometry(radius, 16, 12);
  }
  return spheres[key];
};
var Mesh3 = class extends Node {
  constructor(data = {}) {
    super(data);
    this.needsRebuild = false;
    this._geometry = null;
    this._type = defaults2.type;
    this._visible = defaults2.visible;
    this.handle = null;
    this._material = null;
    this._linked = defaults2.linked;
    this._castShadow = defaults2.castShadow;
    this._receiveShadow = defaults2.receiveShadow;
    this.sItem = null;
    this._width = defaults2.width;
    this._height = defaults2.height;
    this._depth = defaults2.depth;
    this._radius = defaults2.radius;
    this.name = "mesh";
    this.type = data.type;
    this.width = data.width;
    this.height = data.height;
    this.depth = data.depth;
    this.radius = data.radius;
    this.geometry = data.geometry;
    this.material = data.material;
    this.linked = data.linked;
    this.castShadow = data.castShadow;
    this.receiveShadow = data.receiveShadow;
    this.visible = data.visible;
  }
  mount() {
    this.needsRebuild = false;
    if (!this._geometry) {
      return;
    }
    let geometry;
    if (this._type === "box") {
      geometry = getBox(this._width, this._height, this._depth);
    } else if (this._type === "sphere") {
      geometry = getSphere(this._radius);
    } else if (this._type === "geometry") {
      geometry = this._geometry;
    }
    if (this._visible) {
      this.handle = this.ctx.world.stage.insert({
        geometry,
        material: this._material,
        linked: this._linked,
        castShadow: this._castShadow,
        receiveShadow: this._receiveShadow,
        matrix: this.matrixWorld,
        node: this
      });
    } else {
      this.sItem = {
        matrix: this.matrixWorld,
        geometry,
        material: this._material,
        getEntity: () => this.ctx.entity,
        node: this
      };
      this.ctx.world.stage.octree.insert(this.sItem);
    }
  }
  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount();
      this.mount();
      return;
    }
    if (didMove) {
      if (this.handle) {
        this.handle.move(this.matrixWorld);
      }
      if (this.sItem) {
        this.ctx.world.stage.octree.move(this.sItem);
      }
    }
  }
  unmount() {
    this.handle?.destroy();
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem);
      this.sItem = null;
    }
    this.handle = null;
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this._type = source._type;
    this._width = source._width;
    this._height = source._height;
    this._depth = source._depth;
    this._radius = source._radius;
    this._geometry = source._geometry;
    this._material = source._material;
    this._linked = source._linked;
    this._castShadow = source._castShadow;
    this._receiveShadow = source._receiveShadow;
    this._visible = source._visible;
    return this;
  }
  applyStats(stats) {
    if (this._geometry && !stats.geometries.has(this._geometry.uuid)) {
      stats.geometries.add(this._geometry.uuid);
      stats.triangles += getTrianglesFromGeometry(this._geometry);
    }
    if (this._material && !stats.materials.has(this._material.uuid)) {
      stats.materials.add(this._material.uuid);
      stats.textureBytes += getTextureBytesFromMaterial(this._material);
    }
  }
  get type() {
    return this._type;
  }
  set type(value) {
    if (value === void 0) {
      value = defaults2.type;
    }
    if (!isType(value)) {
      throw new Error("[mesh] type invalid");
    }
    if (this._type === value) {
      return;
    }
    this._type = value;
    if (this.handle) {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get width() {
    return this._width;
  }
  set width(value) {
    if (value === void 0) {
      value = defaults2.width;
    }
    if (!isNumber_default(value)) {
      throw new Error("[mesh] width not a number");
    }
    if (this._width === value) {
      return;
    }
    this._width = value;
    if (this.handle && this._type === "box") {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get height() {
    return this._height;
  }
  set height(value) {
    if (value === void 0) {
      value = defaults2.height;
    }
    if (!isNumber_default(value)) {
      throw new Error("[mesh] height not a number");
    }
    if (this._height === value) {
      return;
    }
    this._height = value;
    if (this.handle && this._type === "box") {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get depth() {
    return this._depth;
  }
  set depth(value) {
    if (value === void 0) {
      value = defaults2.depth;
    }
    if (!isNumber_default(value)) {
      throw new Error("[mesh] depth not a number");
    }
    if (this._depth === value) {
      return;
    }
    this._depth = value;
    if (this.handle && this._type === "box") {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  setSize(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }
  get radius() {
    return this._radius;
  }
  set radius(value) {
    if (value === void 0) {
      value = defaults2.radius;
    }
    if (!isNumber_default(value)) {
      throw new Error("[mesh] radius not a number");
    }
    if (this._radius === value) {
      return;
    }
    this._radius = value;
    if (this.handle && this._type === "sphere") {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get geometry() {
    return secureRef({}, () => this._geometry);
  }
  set geometry(value) {
    if (value === void 0) {
      value = defaults2.geometry;
    }
    if (value && !value.isBufferGeometry) {
      throw new Error("[mesh] geometry invalid");
    }
    if (this._geometry === value) {
      return;
    }
    this._geometry = value;
    this.needsRebuild = true;
    this.setDirty();
  }
  get material() {
    return this.handle?.material;
  }
  set material(value) {
    if (value === void 0) {
      value = defaults2.material;
    }
    if (value && !value.isMaterial) {
      throw new Error("[mesh] material invalid");
    }
    if (this._material === value) {
      return;
    }
    this._material = value;
    this.needsRebuild = true;
    this.setDirty();
  }
  get linked() {
    return this._linked;
  }
  set linked(value) {
    if (value === void 0) {
      value = defaults2.linked;
    }
    if (!isBoolean_default(value)) {
      throw new Error("[mesh] linked not a boolean");
    }
    if (this._linked === value) {
      return;
    }
    this._linked = value;
    this.needsRebuild = true;
    this.setDirty();
  }
  get castShadow() {
    return this._castShadow;
  }
  set castShadow(value) {
    if (value === void 0) {
      value = defaults2.castShadow;
    }
    if (!isBoolean_default(value)) {
      throw new Error("[mesh] castShadow not a boolean");
    }
    if (this._castShadow === value) {
      return;
    }
    this._castShadow = value;
    if (this.handle) {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get receiveShadow() {
    return this._receiveShadow;
  }
  set receiveShadow(value) {
    if (value === void 0) {
      value = defaults2.receiveShadow;
    }
    if (!isBoolean_default(value)) {
      throw new Error("[mesh] receiveShadow not a boolean");
    }
    if (this._receiveShadow === value) {
      return;
    }
    this._receiveShadow = value;
    if (this.handle) {
      this.needsRebuild = true;
      this.setDirty();
    }
  }
  get visible() {
    return this._visible;
  }
  set visible(value) {
    if (value === void 0) {
      value = defaults2.visible;
    }
    if (!isBoolean_default(value)) {
      throw new Error("[mesh] visible not a boolean");
    }
    if (this._visible === value) {
      return;
    }
    this._visible = value;
    this.needsRebuild = true;
    this.setDirty();
  }
  getProxy() {
    if (!this.proxy) {
      const self2 = this;
      let proxy = {
        get type() {
          return self2.type;
        },
        set type(value) {
          self2.type = value;
        },
        get width() {
          return self2.width;
        },
        set width(value) {
          self2.width = value;
        },
        get height() {
          return self2.height;
        },
        set height(value) {
          self2.height = value;
        },
        get depth() {
          return self2.depth;
        },
        set depth(value) {
          self2.depth = value;
        },
        setSize(width, height, depth) {
          self2.setSize(width, height, depth);
        },
        get radius() {
          return self2.radius;
        },
        set radius(value) {
          self2.radius = value;
        },
        get geometry() {
          return self2.geometry;
        },
        set geometry(value) {
          self2.geometry = value;
        },
        get material() {
          return self2.material;
        },
        set material(value) {
          throw new Error("[mesh] set material not supported");
        },
        get linked() {
          return self2.linked;
        },
        set linked(value) {
          self2.linked = value;
        },
        get castShadow() {
          return self2.castShadow;
        },
        set castShadow(value) {
          self2.castShadow = value;
        },
        get receiveShadow() {
          return self2.receiveShadow;
        },
        set receiveShadow(value) {
          self2.receiveShadow = value;
        },
        get visible() {
          return self2.visible;
        },
        set visible(value) {
          self2.visible = value;
        }
      };
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()));
      this.proxy = proxy;
    }
    return this.proxy;
  }
};
function isType(value) {
  return types.includes(value);
}

// src/rpg/systems/VisualRepresentationSystem.ts
import visualTemplatesConfig from "./templates-C4VKSJGR.json";
import testTemplatesConfig from "./test-templates-6DGVI6B2.json";
var DEFAULT_CONFIG = {
  enableShadows: true,
  maxViewDistance: 100,
  lodDistances: [20, 50, 80],
  debug: false
};
var VisualRepresentationSystem = class extends System {
  constructor(world) {
    super(world);
    this.templates = /* @__PURE__ */ new Map();
    this.entityVisuals = /* @__PURE__ */ new Map();
    this.activeAnimations = /* @__PURE__ */ new Map();
    this.scene = null;
    this.sceneRoot = null;
    this.config = DEFAULT_CONFIG;
  }
  /**
   * Initialize the system
   */
  async init(options) {
    const visualOptions = options;
    this.config = { ...DEFAULT_CONFIG, ...visualOptions };
    this.loadTemplates();
    if (this.world.stage?.scene) {
      this.scene = this.world.stage.scene;
      this.sceneRoot = new THREE.Group();
      this.sceneRoot.name = "rpg-visuals";
      if (this.scene && typeof this.scene.add === "function" && this.sceneRoot) {
        this.scene.add(this.sceneRoot);
      }
    } else {
      console.warn("[VisualRepresentationSystem] No scene available, visuals will not be rendered");
    }
    if (this.world.events) {
      this.world.events.on("update", this.update.bind(this));
    }
    console.log("[VisualRepresentationSystem] Initialized with config:", this.config);
  }
  /**
   * Load templates from configuration
   */
  loadTemplates() {
    const isTestMode = process.env.VISUAL_TEST === "true" || process.env.BUN_ENV?.includes("test");
    if (isTestMode) {
      const testCategories = ["quest_entities"];
      for (const category of testCategories) {
        const categoryTemplates = testTemplatesConfig[category];
        if (categoryTemplates) {
          for (const [key, template] of Object.entries(categoryTemplates)) {
            this.templates.set(key, template);
          }
        }
      }
      console.log(
        `[VisualRepresentationSystem] Loaded ${this.templates.size} TEST visual templates for visual validation`
      );
    } else {
      const categories = ["items", "npcs", "containers", "resources", "special"];
      for (const category of categories) {
        const categoryTemplates = visualTemplatesConfig[category];
        if (categoryTemplates) {
          for (const [key, template] of Object.entries(categoryTemplates)) {
            this.templates.set(key, template);
          }
        }
      }
      console.log(`[VisualRepresentationSystem] Loaded ${this.templates.size} visual templates`);
    }
  }
  /**
   * Add visual representation for an entity (alias for createVisual)
   */
  addVisual(entity, templateName) {
    this.createVisual(entity, templateName);
  }
  /**
   * Create visual representation for an entity
   */
  createVisual(entity, templateName) {
    try {
      this.removeVisual(entity.id || entity.data?.id);
      const entityId = entity.id || entity.data?.id;
      if (!entityId) {
        console.error("[VisualRepresentationSystem] Entity has no ID");
        return;
      }
      const template = this.getTemplate(entity, templateName);
      if (!template) {
        console.warn(`[VisualRepresentationSystem] No template found for entity ${entityId}`);
        return;
      }
      if (entity.node) {
        this.applyVisualToEntityNode(entity, template, templateName);
      } else {
        console.warn(`[VisualRepresentationSystem] Entity ${entityId} has no node for visual modification`);
      }
      if (template.animations && template.animations.includes("idle")) {
        this.playAnimation(entityId, "idle", true);
      }
      this.syncVisualWithEntity(entityId, entity);
      console.log(
        `[VisualRepresentationSystem] Created visual for ${entityId} using template ${templateName || "auto-detected"}`
      );
    } catch (error) {
      console.error("[VisualRepresentationSystem] Error creating visual:", error);
    }
  }
  /**
   * Apply visual template to entity's existing Three.js node
   */
  applyVisualToEntityNode(entity, template, templateName) {
    const entityId = entity.id || entity.data?.id;
    while (entity.node.children.length > 0) {
      entity.node.remove(entity.node.children[0]);
    }
    let threeGeometry;
    switch (template.geometryType) {
      case "sphere":
        threeGeometry = new THREE.SphereGeometry(template.size.width / 2, 16, 16);
        break;
      case "cylinder":
        threeGeometry = new THREE.CylinderGeometry(
          template.size.width / 2,
          template.size.width / 2,
          template.size.height,
          16
        );
        break;
      default:
        threeGeometry = new THREE.BoxGeometry(template.size.width, template.size.height, template.size.depth);
    }
    const material = new THREE.MeshStandardMaterial({
      color: template.color || 16711680,
      // Default red if no color
      metalness: template.material?.metalness || 0.1,
      roughness: template.material?.roughness || 0.8,
      opacity: template.material?.opacity || 1,
      transparent: (template.material?.opacity || 1) < 1
    });
    if (template.material?.emissive) {
      material.emissive.setHex(template.material.emissive);
    }
    const mesh = new THREE.Mesh(threeGeometry, material);
    mesh.name = `${templateName || "npc"}-mesh`;
    if (entity.position || entity.data?.position) {
      const pos = entity.position || entity.data.position;
      entity.node.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
    }
    entity.node.add(mesh);
    const visual = {
      mesh,
      group: entity.node,
      // Reference the entity's node
      template,
      visible: true,
      lodLevel: 0
    };
    this.entityVisuals.set(entityId, visual);
    console.log(`[VisualRepresentationSystem] Applied ${templateName || "default"} template to entity ${entityId} node`);
  }
  /**
   * Create visual component from template
   */
  createVisualComponent(template, entity) {
    const group = new THREE.Group();
    group.name = `visual-${entity.id || entity.data?.id}`;
    let threeGeometry;
    let meshType = "box";
    switch (template.geometryType) {
      case "sphere":
        threeGeometry = new THREE.SphereGeometry(template.size.width / 2, 16, 16);
        meshType = "sphere";
        break;
      case "cylinder":
        threeGeometry = new THREE.CylinderGeometry(
          template.size.width / 2,
          template.size.width / 2,
          template.size.height,
          16
        );
        meshType = "geometry";
        break;
      case "cone":
        threeGeometry = new THREE.ConeGeometry(template.size.width / 2, template.size.height, 16);
        meshType = "geometry";
        break;
      default:
        threeGeometry = new THREE.BoxGeometry(template.size.width, template.size.height, template.size.depth);
        meshType = "box";
    }
    const material = this.createMaterial(template);
    const threeMesh = new THREE.Mesh(threeGeometry, material);
    if (this.config.enableShadows) {
      threeMesh.castShadow = true;
      threeMesh.receiveShadow = true;
    }
    const mesh = new Mesh3({
      type: meshType,
      width: template.size.width,
      height: template.size.height,
      depth: template.size.depth,
      radius: meshType === "sphere" ? template.size.width / 2 : void 0,
      geometry: meshType === "geometry" ? threeGeometry : void 0,
      material
    });
    mesh._threeMesh = threeMesh;
    group.add(threeMesh);
    return {
      mesh,
      group,
      template,
      visible: true,
      lodLevel: 0
    };
  }
  /**
   * Get template for entity
   */
  getTemplate(entity, templateName) {
    if (templateName && this.templates.has(templateName)) {
      return this.templates.get(templateName);
    }
    const entityType = (entity.type || entity.data?.type || "").toLowerCase();
    const entityName = (entity.name || entity.data?.name || "").toLowerCase();
    for (const [key, template] of this.templates) {
      if (entityType.includes(key) || entityName.includes(key)) {
        return template;
      }
    }
    if (entity.getComponent) {
      const itemComponent = entity.getComponent("item");
      if (itemComponent?.itemType) {
        const itemType = itemComponent.itemType.toLowerCase();
        for (const [key, template] of this.templates) {
          if (itemType.includes(key) || key.includes(itemType)) {
            return template;
          }
        }
      }
      const npcComponent = entity.getComponent("npc");
      if (npcComponent?.name) {
        const npcName = npcComponent.name.toLowerCase();
        for (const [key, template] of this.templates) {
          if (npcName.includes(key) || key.includes(npcName)) {
            return template;
          }
        }
      }
    }
    return this.templates.get("default");
  }
  /**
   * Create material from template
   */
  createMaterial(template) {
    const materialProps = {
      color: new THREE.Color(template.color),
      transparent: true,
      opacity: template.material?.opacity ?? 0.9
    };
    if (template.material?.metalness !== void 0 || template.material?.roughness !== void 0) {
      return new THREE.MeshStandardMaterial({
        ...materialProps,
        metalness: template.material.metalness ?? 0,
        roughness: template.material.roughness ?? 1,
        emissive: template.material?.emissive ? new THREE.Color(template.material.emissive) : void 0,
        emissiveIntensity: template.material?.emissiveIntensity ?? 0
      });
    } else {
      return new THREE.MeshBasicMaterial(materialProps);
    }
  }
  /**
   * Sync visual position with entity
   */
  syncVisualWithEntity(entityId, entity) {
    const visual = this.entityVisuals.get(entityId);
    if (!visual) {
      return;
    }
    const position = entity.position || entity.data?.position;
    if (position) {
      visual.group.position.set(position.x || 0, position.y || 0, position.z || 0);
    }
    const rotation = entity.rotation || entity.data?.rotation;
    if (rotation) {
      visual.group.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }
  }
  /**
   * Play animation for entity
   */
  playAnimation(entityId, animationType, loop = false, duration = 1e3) {
    const visual = this.entityVisuals.get(entityId);
    if (!visual) {
      return;
    }
    this.stopAnimation(entityId);
    const animationState = {
      entityId,
      animationType,
      startTime: Date.now(),
      duration,
      loop,
      originalPosition: {
        x: visual.group.position.x,
        y: visual.group.position.y,
        z: visual.group.position.z
      },
      originalRotation: {
        x: visual.group.rotation.x,
        y: visual.group.rotation.y,
        z: visual.group.rotation.z
      }
    };
    this.activeAnimations.set(entityId, animationState);
  }
  /**
   * Stop animation for entity
   */
  stopAnimation(entityId) {
    const animation = this.activeAnimations.get(entityId);
    if (!animation) {
      return;
    }
    const visual = this.entityVisuals.get(entityId);
    if (visual && animation.originalPosition && animation.originalRotation) {
      visual.group.position.set(
        animation.originalPosition.x,
        animation.originalPosition.y,
        animation.originalPosition.z
      );
      visual.group.rotation.set(
        animation.originalRotation.x,
        animation.originalRotation.y,
        animation.originalRotation.z
      );
    }
    this.activeAnimations.delete(entityId);
  }
  /**
   * Update animations and sync with entities
   */
  update(_delta) {
    const currentTime = Date.now();
    for (const [entityId, animation] of this.activeAnimations) {
      const visual = this.entityVisuals.get(entityId);
      if (!visual) {
        this.activeAnimations.delete(entityId);
        continue;
      }
      const elapsed = currentTime - animation.startTime;
      const progress = Math.min(elapsed / animation.duration, 1);
      this.applyAnimation(visual, animation, progress);
      if (progress >= 1) {
        if (animation.loop) {
          animation.startTime = currentTime;
        } else {
          this.stopAnimation(entityId);
        }
      }
    }
    for (const [entityId, _visual] of this.entityVisuals) {
      const entity = this.world.entities?.items?.get(entityId);
      if (entity) {
        this.syncVisualWithEntity(entityId, entity);
      }
    }
  }
  /**
   * Apply animation to visual
   */
  applyAnimation(visual, animation, progress) {
    const group = visual.group;
    const origPos = animation.originalPosition;
    const origRot = animation.originalRotation;
    switch (animation.animationType) {
      case "walk":
        group.position.y = origPos.y + Math.sin(progress * Math.PI * 4) * 0.1;
        group.position.x = origPos.x + Math.sin(progress * Math.PI * 2) * 0.05;
        break;
      case "attack":
      case "swing_down":
        group.rotation.x = origRot.x - Math.sin(progress * Math.PI) * 0.5;
        group.position.y = origPos.y - Math.sin(progress * Math.PI) * 0.2;
        break;
      case "die":
        group.rotation.z = origRot.z + progress * Math.PI / 2;
        group.position.y = origPos.y - progress * 0.5;
        this.setOpacity(visual, 1 - progress * 0.5);
        break;
      case "open":
        group.rotation.x = origRot.x - progress * 0.3;
        break;
      case "close":
        group.rotation.x = origRot.x + (1 - progress) * 0.3;
        break;
      case "pulse":
        const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.2;
        group.scale.set(scale, scale, scale);
        break;
      case "rotate":
        group.rotation.y = origRot.y + progress * Math.PI * 2;
        break;
      case "bounce":
        group.position.y = origPos.y + Math.abs(Math.sin(progress * Math.PI * 2)) * 0.3;
        break;
      case "shimmer":
        const shimmer = 0.7 + Math.sin(progress * Math.PI * 4) * 0.3;
        this.setOpacity(visual, shimmer);
        break;
      case "sparkle":
        const sparkleScale = 1 + Math.sin(progress * Math.PI * 8) * 0.1;
        group.scale.set(sparkleScale, sparkleScale, sparkleScale);
        group.rotation.y = origRot.y + progress * Math.PI;
        break;
      case "idle":
        group.position.y = origPos.y + Math.sin(progress * Math.PI * 2) * 0.05;
        break;
      case "sway":
        group.rotation.z = origRot.z + Math.sin(progress * Math.PI * 2) * 0.1;
        break;
      case "ripple":
        const rippleScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
        group.scale.set(rippleScale, 1, rippleScale);
        break;
      // Add more animation types as needed
      default:
        break;
    }
  }
  /**
   * Set opacity for visual
   */
  setOpacity(visual, opacity) {
    const threeMesh = visual.mesh._threeMesh;
    if (threeMesh?.material) {
      threeMesh.material.opacity = Math.max(0, Math.min(1, opacity));
    }
  }
  /**
   * Remove visual representation
   */
  removeVisual(entityId) {
    if (!entityId) {
      return;
    }
    this.stopAnimation(entityId);
    const visual = this.entityVisuals.get(entityId);
    if (visual) {
      if (this.sceneRoot && visual.group.parent) {
        this.sceneRoot.remove(visual.group);
      }
      const threeMesh = visual.mesh._threeMesh;
      if (threeMesh) {
        if (threeMesh.geometry) {
          threeMesh.geometry.dispose();
        }
        if (threeMesh.material) {
          if (Array.isArray(threeMesh.material)) {
            threeMesh.material.forEach((m) => m.dispose());
          } else {
            threeMesh.material.dispose();
          }
        }
      }
      if (visual.group.deactivate) {
        visual.group.deactivate();
      }
      this.entityVisuals.delete(entityId);
    }
  }
  /**
   * Get visual for entity
   */
  getVisual(entityId) {
    return this.entityVisuals.get(entityId);
  }
  /**
   * Clean up
   */
  destroy() {
    if (this.world.events) {
      this.world.events.off("update", this.update.bind(this));
    }
    for (const entityId of Array.from(this.entityVisuals.keys())) {
      this.removeVisual(entityId);
    }
    if (this.sceneRoot && this.scene) {
      this.scene.remove(this.sceneRoot);
    }
    this.entityVisuals.clear();
    this.activeAnimations.clear();
    this.templates.clear();
    super.destroy();
  }
};

// src/rpg/systems/AgentPlayerSystem.ts
var AgentPlayerSystem = class extends System {
  constructor(world) {
    super(world);
    this.TEST_MODE_DURATION = 6e4;
    // 1 minute for testing
    this.agent = null;
    this.navigationSystem = null;
    this.questSystem = null;
    this.currentTask = null;
    this.actionTimer = 0;
    this.updateInterval = null;
    // Quest locations (simple coordinates for testing)
    this.LOCATIONS = {
      SPAWN: { x: 0, y: 0, z: 0 },
      QUEST_NPC: { x: 0, y: 0, z: 5 },
      SWORD: { x: 0, y: 0, z: 0 },
      GOBLIN_AREA: { x: 5, y: 0, z: 5 }
    };
  }
  async init(_options) {
    console.log("[AgentPlayerSystem] Initializing...");
    this.navigationSystem = this.world.getSystem?.("navigation");
    this.questSystem = this.world.getSystem?.("quest");
    if (!this.navigationSystem) {
      console.warn("[AgentPlayerSystem] Navigation system not found");
    }
    if (!this.questSystem) {
      console.warn("[AgentPlayerSystem] Quest system not found");
    }
    if (process.env.TEST_MODE === "true") {
      this.testModeTimeout = setTimeout(() => {
        console.log("[AgentPlayerSystem] Test mode timeout reached, shutting down...");
        this.destroy();
        process.exit(0);
      }, this.TEST_MODE_DURATION);
    }
    setTimeout(() => {
      console.log("[AgentPlayerSystem] Creating agent player...");
      this.createAgentPlayer();
      console.log("[AgentPlayerSystem] Starting quest demo...");
      this.startQuestDemo();
      setTimeout(() => {
        console.log("[AgentPlayerSystem] Starting continuous update loop...");
        this.startUpdateLoop();
      }, 1e3);
    }, 3e3);
  }
  /**
   * Start the continuous update loop for agent actions
   */
  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(() => {
      this.fixedUpdate(100);
    }, 100);
    console.log("[AgentPlayerSystem] Update loop started");
  }
  /**
   * Create the automated agent player
   */
  createAgentPlayer() {
    const agentId = `agent_player_${Date.now()}`;
    this.agent = new RPGEntity4(this.world, "player", {
      id: agentId,
      type: "player",
      name: "Agent Player",
      position: this.LOCATIONS.SPAWN,
      isAgent: true
    });
    this.agent.components.set("stats", {
      type: "stats",
      hitpoints: { current: 100, max: 100, level: 10, xp: 1200 },
      attack: { level: 5, xp: 300 },
      strength: { level: 5, xp: 300 },
      defense: { level: 5, xp: 300 },
      combatLevel: 5,
      totalLevel: 20
    });
    this.agent.components.set("inventory", {
      type: "inventory",
      items: /* @__PURE__ */ new Map(),
      capacity: 28,
      gold: 0
    });
    this.agent.components.set("movement", {
      type: "movement",
      position: this.LOCATIONS.SPAWN,
      moveSpeed: 3,
      isMoving: false,
      canMove: true
    });
    if (this.world.entities?.items) {
      ;
      this.world.entities.items.set(agentId, this.agent);
    } else {
      ;
      this.world.entities = /* @__PURE__ */ new Map();
      this.world.entities.set(agentId, this.agent);
    }
    const visualSystem = this.world.getSystem?.("visualRepresentation");
    if (visualSystem) {
      visualSystem.createVisual(this.agent, "player");
    }
    console.log(`[AgentPlayerSystem] Created agent player at spawn ${JSON.stringify(this.LOCATIONS.SPAWN)}`);
  }
  /**
   * Start the quest demonstration
   */
  startQuestDemo() {
    if (!this.agent) {
      console.error("[AgentPlayerSystem] No agent player created");
      return;
    }
    console.log("[AgentPlayerSystem] Starting quest demonstration...");
    const questTask = {
      id: "complete_goblin_quest",
      name: "Complete Kill Goblin Quest",
      currentAction: 0,
      completed: false,
      actions: [
        {
          type: "wait",
          duration: 2e3,
          description: "Wait for world to stabilize",
          completed: false
        },
        {
          type: "move",
          target: this.LOCATIONS.QUEST_NPC,
          description: "Walk to Quest NPC",
          completed: false,
          callback: () => console.log("[Agent] Arrived at Quest NPC")
        },
        {
          type: "interact",
          target: "quest_giver_1",
          description: "Talk to Quest NPC and accept quest",
          completed: false,
          callback: () => console.log("[Agent] Accepted quest")
        },
        {
          type: "move",
          target: this.LOCATIONS.SWORD,
          description: "Walk to sword location",
          completed: false,
          callback: () => console.log("[Agent] Arrived at sword")
        },
        {
          type: "pickup",
          target: "sword",
          description: "Pick up sword",
          completed: false,
          callback: () => console.log("[Agent] Picked up sword")
        },
        {
          type: "move",
          target: this.LOCATIONS.GOBLIN_AREA,
          description: "Walk to goblin area",
          completed: false,
          callback: () => console.log("[Agent] Arrived at goblin area")
        },
        {
          type: "attack",
          target: "goblin",
          description: "Attack and kill goblin",
          completed: false,
          callback: () => console.log("[Agent] Killed goblin")
        },
        {
          type: "move",
          target: this.LOCATIONS.QUEST_NPC,
          description: "Return to Quest NPC",
          completed: false,
          callback: () => console.log("[Agent] Returned to Quest NPC")
        },
        {
          type: "interact",
          target: "quest_giver_1",
          description: "Complete quest with NPC",
          completed: false,
          callback: () => console.log("[Agent] Completed quest!")
        }
      ]
    };
    this.currentTask = questTask;
    console.log("[AgentPlayerSystem] Quest task created with", questTask.actions.length, "actions");
  }
  /**
   * Update agent behavior
   */
  fixedUpdate(delta) {
    if (!this.agent || !this.currentTask || this.currentTask.completed) {
      return;
    }
    this.actionTimer += delta;
    const currentAction = this.currentTask.actions[this.currentTask.currentAction];
    if (!currentAction) {
      return;
    }
    if (currentAction.completed) {
      this.moveToNextAction();
      return;
    }
    if (this.actionTimer % 5e3 < delta) {
      console.log(
        `[AgentPlayerSystem] Current action: ${currentAction.description} (${this.currentTask.currentAction + 1}/${this.currentTask.actions.length})`
      );
    }
    this.executeAction(currentAction, delta);
  }
  /**
   * Execute a specific action
   */
  executeAction(action, delta) {
    switch (action.type) {
      case "wait":
        this.executeWaitAction(action, delta);
        break;
      case "move":
        this.executeMoveAction(action);
        break;
      case "interact":
        this.executeInteractAction(action);
        break;
      case "pickup":
        this.executePickupAction(action);
        break;
      case "attack":
        this.executeAttackAction(action);
        break;
    }
  }
  /**
   * Execute wait action
   */
  executeWaitAction(action, delta) {
    if (!action.duration) {
      action.completed = true;
      return;
    }
    action.duration -= delta;
    if (action.duration <= 0) {
      action.completed = true;
      console.log(`[Agent] ${action.description} - completed`);
      if (action.callback) {
        action.callback();
      }
    }
  }
  /**
   * Execute move action
   */
  executeMoveAction(action) {
    if (!this.navigationSystem || !this.agent) {
      console.error("[Agent] No navigation system or agent available");
      action.completed = true;
      return;
    }
    const agentId = this.agent.id || this.agent.data?.id;
    if (!agentId) {
      console.error("[Agent] Cannot check navigation - agent ID is undefined");
      action.completed = true;
      return;
    }
    if (!action.startTime) {
      action.startTime = Date.now();
    }
    const elapsedTime = Date.now() - action.startTime;
    if (elapsedTime > 3e4) {
      console.warn(`[Agent] Navigation timeout for action: ${action.description}`);
      action.completed = true;
      if (action.callback) {
        action.callback();
      }
      return;
    }
    const target = action.target;
    const agentPos = this.agent.position || this.agent.components.get("movement")?.position;
    if (agentPos) {
      const distance = Math.sqrt(
        Math.pow(agentPos.x - target.x, 2) + Math.pow(agentPos.z - target.z, 2)
      );
      if (distance < 1) {
        console.log(`[Agent] Reached destination for: ${action.description}`);
        action.completed = true;
        if (action.callback) {
          action.callback();
        }
        return;
      }
    }
    const isNavigating = this.navigationSystem.isNavigating(agentId);
    if (!action.navigationStarted || !isNavigating) {
      console.log(`[Agent] ${action.description} - starting/restarting navigation to [${target.x}, ${target.y}, ${target.z}]`);
      action.navigationStarted = true;
      try {
        this.navigationSystem.navigateTo({
          _entityId: agentId,
          destination: target,
          speed: 3,
          callback: () => {
            console.log(`[Agent] Navigation callback triggered for: ${action.description}`);
            action.completed = true;
            if (action.callback) {
              action.callback();
            }
          }
        });
      } catch (error) {
        console.error(`[Agent] Failed to start navigation for: ${action.description}`, error);
        action.completed = true;
        if (action.callback) {
          action.callback();
        }
      }
    }
  }
  /**
   * Execute interact action
   */
  executeInteractAction(action) {
    console.log(`[Agent] ${action.description} - simulating interaction`);
    if (this.questSystem && this.agent && action.target === "quest_giver_1") {
      const agentId = this.agent.id || this.agent.data?.id;
      if (agentId) {
        const availableQuests = this.questSystem.getAvailableQuests(agentId);
        const cookQuest = availableQuests.find((q) => q.id === "cooks_assistant");
        if (cookQuest) {
          console.log("[Agent] Starting quest: cooks_assistant");
          this.questSystem.startQuest(agentId, "cooks_assistant");
        } else {
          console.log("[Agent] No available quests from this NPC");
        }
      }
    }
    action.completed = true;
    if (action.callback) {
      action.callback();
    }
  }
  /**
   * Execute pickup action
   */
  executePickupAction(action) {
    console.log(`[Agent] ${action.description} - looking for item`);
    const entities = this.world.entities?.items || /* @__PURE__ */ new Map();
    let swordEntity = null;
    for (const [_id, entity] of entities) {
      if (entity.data?.type === "item" && entity.data?.itemType === "sword") {
        swordEntity = entity;
        break;
      }
    }
    if (swordEntity) {
      console.log("[Agent] Found sword, picking up");
      const inventory = this.agent?.getComponent("inventory");
      if (inventory) {
        inventory.items.set("sword", { itemId: 1001, name: "Bronze Sword", quantity: 1 });
        console.log("[Agent] Added sword to inventory");
      }
      entities.delete(swordEntity.id || swordEntity.data?.id);
      console.log("[Agent] Removed sword from world");
    } else {
      console.log("[Agent] No sword found nearby");
    }
    action.completed = true;
    if (action.callback) {
      action.callback();
    }
  }
  /**
   * Execute attack action
   */
  executeAttackAction(action) {
    console.log(`[Agent] ${action.description} - looking for goblin`);
    const entities = this.world.entities?.items || /* @__PURE__ */ new Map();
    let goblinEntity = null;
    for (const [_id, entity] of entities) {
      const npcComponent = entity.getComponent?.("npc");
      if (npcComponent && (npcComponent.npcId === 1 || npcComponent.name?.toLowerCase().includes("goblin"))) {
        goblinEntity = entity;
        break;
      }
    }
    if (goblinEntity) {
      console.log("[Agent] Found goblin, attacking!");
      setTimeout(() => {
        entities.delete(goblinEntity.id || goblinEntity.data?.id);
        console.log("[Agent] Goblin defeated!");
        const inventory = this.agent?.getComponent("inventory");
        if (inventory) {
          inventory.gold = (inventory.gold || 0) + 25;
          console.log("[Agent] Gained 25 gold from goblin");
        }
        action.completed = true;
        if (action.callback) {
          action.callback();
        }
      }, 2e3);
    } else {
      console.log("[Agent] No goblin found, retrying...");
    }
  }
  /**
   * Move to next action in task
   */
  moveToNextAction() {
    if (!this.currentTask) {
      return;
    }
    this.currentTask.currentAction++;
    if (this.currentTask.currentAction >= this.currentTask.actions.length) {
      this.currentTask.completed = true;
      console.log(`[AgentPlayerSystem] Task "${this.currentTask.name}" completed!`);
      if (this.currentTask.callback) {
        this.currentTask.callback();
      }
    } else {
      const nextAction = this.currentTask.actions[this.currentTask.currentAction];
      console.log(`[AgentPlayerSystem] Starting next action: ${nextAction.description}`);
    }
  }
  /**
   * Get current task status
   */
  getTaskStatus() {
    if (!this.currentTask) {
      return null;
    }
    const currentAction = this.currentTask.actions[this.currentTask.currentAction];
    const progress = `${this.currentTask.currentAction + 1}/${this.currentTask.actions.length}`;
    return {
      task: this.currentTask.name,
      action: currentAction?.description || "None",
      progress
    };
  }
  destroy() {
    if (this.testModeTimeout) {
      clearTimeout(this.testModeTimeout);
      this.testModeTimeout = void 0;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.agent) {
      const agentId = this.agent.id || this.agent.data?.id;
      const entities = this.world.entities?.items;
      if (entities) {
        entities.delete(agentId);
      }
    }
    super.destroy();
  }
};

// src/rpg/systems/ItemSpawnSystem.ts
var ItemSpawnSystem = class extends System {
  constructor(world) {
    super(world);
    this.groundItems = /* @__PURE__ */ new Map();
    this.itemCounter = 0;
    this.DEFAULT_DESPAWN_TIME = 3e5;
    // 5 minutes
    this.PLAYER_DROP_VISIBLE_TIME = 6e4;
    // 1 minute private to dropper
    // Persistence
    this.pendingSaves = false;
  }
  async initialize() {
    console.log("[ItemSpawnSystem] Initializing...");
    this.world.events.on("item:drop", this.handleItemDrop.bind(this));
    this.world.events.on("item:pickup", this.handleItemPickup.bind(this));
    this.world.events.on("player:death", this.handlePlayerDeath.bind(this));
    this.world.events.on("world:shutdown", this.handleShutdown.bind(this));
    this.startAutoSave();
    await this.loadGroundItems();
    console.log("[ItemSpawnSystem] Initialized with ground item management");
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      if (this.pendingSaves) {
        this.saveGroundItems();
      }
    }, 3e4);
  }
  /**
   * Handle world shutdown
   */
  async handleShutdown() {
    await this.saveGroundItems();
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
  }
  /**
   * Load ground items from persistence
   */
  async loadGroundItems() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const items = await persistence.loadWorldItems();
      for (const itemData of items) {
        const groundItem = {
          id: itemData.itemId,
          itemId: itemData.itemType,
          quantity: itemData.quantity,
          position: JSON.parse(itemData.position),
          droppedBy: itemData.droppedBy || void 0,
          droppedAt: new Date(itemData.droppedAt).getTime(),
          despawnAt: new Date(itemData.despawnAt).getTime(),
          visibleTo: itemData.visibleTo ? JSON.parse(itemData.visibleTo) : []
        };
        if (groundItem.despawnAt > Date.now()) {
          this.groundItems.set(groundItem.id, groundItem);
        }
      }
      console.log(`[ItemSpawnSystem] Loaded ${this.groundItems.size} ground items`);
    } catch (error) {
      console.error(`[ItemSpawnSystem] Failed to load ground items:`, error);
    }
  }
  /**
   * Save ground items to persistence
   */
  async saveGroundItems() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const items = [];
      for (const [id, item] of this.groundItems) {
        items.push({
          itemId: id,
          worldId: this.world.id || "default",
          itemType: item.itemId.toString(),
          quantity: item.quantity,
          position: JSON.stringify(item.position),
          droppedBy: item.droppedBy,
          droppedAt: new Date(item.droppedAt).toISOString(),
          despawnAt: new Date(item.despawnAt).toISOString(),
          visibleTo: JSON.stringify(item.visibleTo)
        });
      }
      await persistence.saveWorldItems(items);
      this.pendingSaves = false;
      console.log(`[ItemSpawnSystem] Saved ${items.length} ground items`);
    } catch (error) {
      console.error(`[ItemSpawnSystem] Failed to save ground items:`, error);
    }
  }
  /**
   * Mark for save
   */
  markForSave() {
    this.pendingSaves = true;
  }
  handleItemDrop(data) {
    const { playerId, itemId, quantity, position } = data;
    this.dropItem(playerId, itemId, quantity, position);
  }
  handleItemPickup(data) {
    const { playerId, groundItemId } = data;
    this.pickupItem(playerId, groundItemId);
  }
  handlePlayerDeath(data) {
    const { playerId, position, items } = data;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        this.dropItem(playerId, item.itemId, item.quantity, position, false);
      }
    }
  }
  /**
   * Drop an item on the ground
   */
  dropItem(droppedBy, itemId, quantity, position, privateToDropper = true) {
    const groundItemId = `ground_item_${this.itemCounter++}_${Date.now()}`;
    const now = Date.now();
    const groundItem = {
      id: groundItemId,
      itemId,
      quantity,
      position: { ...position },
      // Clone position
      droppedBy,
      droppedAt: now,
      despawnAt: now + this.DEFAULT_DESPAWN_TIME,
      visibleTo: privateToDropper ? [droppedBy] : []
    };
    this.groundItems.set(groundItemId, groundItem);
    this.markForSave();
    if (privateToDropper) {
      setTimeout(() => {
        const item = this.groundItems.get(groundItemId);
        if (item) {
          item.visibleTo = [];
          this.markForSave();
          this.world.events.emit("item:visibility_changed", {
            groundItemId,
            visibleToAll: true
          });
        }
      }, this.PLAYER_DROP_VISIBLE_TIME);
    }
    this.world.events.emit("item:dropped", {
      groundItemId,
      itemId,
      quantity,
      position,
      droppedBy,
      visibleTo: groundItem.visibleTo
    });
    return groundItemId;
  }
  /**
   * Pickup a ground item
   */
  pickupItem(playerId, groundItemId) {
    const groundItem = this.groundItems.get(groundItemId);
    if (!groundItem) {
      this.world.events.emit("item:error", {
        playerId,
        message: "Item not found"
      });
      return false;
    }
    if (groundItem.visibleTo.length > 0 && !groundItem.visibleTo.includes(playerId)) {
      this.world.events.emit("item:error", {
        playerId,
        message: "You cannot see this item yet"
      });
      return false;
    }
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (!inventorySystem) {
      return false;
    }
    const added = inventorySystem.addItem(playerId, groundItem.itemId, groundItem.quantity);
    if (!added) {
      this.world.events.emit("item:error", {
        playerId,
        message: "Inventory full"
      });
      return false;
    }
    this.groundItems.delete(groundItemId);
    this.markForSave();
    this.world.events.emit("item:picked_up", {
      playerId,
      groundItemId,
      itemId: groundItem.itemId,
      quantity: groundItem.quantity
    });
    return true;
  }
  /**
   * Get visible ground items for a player
   */
  getVisibleItems(playerId, position, range = 50) {
    const visibleItems = [];
    for (const item of this.groundItems.values()) {
      if (item.visibleTo.length > 0 && !item.visibleTo.includes(playerId)) {
        continue;
      }
      const dx = item.position.x - position.x;
      const dz = item.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance <= range) {
        visibleItems.push(item);
      }
    }
    return visibleItems;
  }
  /**
   * Spawn an item at a position (not player-dropped)
   */
  spawnItem(itemId, quantity, position, despawnTime) {
    const groundItemId = `spawn_item_${this.itemCounter++}_${Date.now()}`;
    const now = Date.now();
    const groundItem = {
      id: groundItemId,
      itemId,
      quantity,
      position: { ...position },
      droppedAt: now,
      despawnAt: now + (despawnTime || this.DEFAULT_DESPAWN_TIME),
      visibleTo: []
      // Visible to all
    };
    this.groundItems.set(groundItemId, groundItem);
    this.markForSave();
    this.world.events.emit("item:spawned", {
      groundItemId,
      itemId,
      quantity,
      position
    });
    return groundItemId;
  }
  /**
   * Update system - clean up despawned items
   */
  update(_deltaTime) {
    const now = Date.now();
    const itemsToRemove = [];
    for (const [id, item] of this.groundItems) {
      if (now >= item.despawnAt) {
        itemsToRemove.push(id);
      }
    }
    if (itemsToRemove.length > 0) {
      for (const id of itemsToRemove) {
        this.groundItems.delete(id);
        this.world.events.emit("item:despawned", { groundItemId: id });
      }
      this.markForSave();
    }
  }
  serialize() {
    return {
      groundItems: Object.fromEntries(this.groundItems),
      itemCounter: this.itemCounter
    };
  }
  deserialize(data) {
    if (data.groundItems) {
      this.groundItems = new Map(Object.entries(data.groundItems));
    }
    if (data.itemCounter) {
      this.itemCounter = data.itemCounter;
    }
  }
};

// src/rpg/systems/ResourceSpawnSystem.ts
var ResourceSpawnSystem = class extends System {
  constructor(world) {
    super(world);
    this.resourceDefinitions = /* @__PURE__ */ new Map();
    this.resourceSpawns = /* @__PURE__ */ new Map();
    this.harvestingPlayers = /* @__PURE__ */ new Map();
    // playerId -> resourceId
    // Persistence
    this.pendingSaves = false;
    this.registerDefaultResources();
  }
  async initialize() {
    console.log("[ResourceSpawnSystem] Initializing...");
    this.world.events.on("resource:harvest", this.handleHarvestResource.bind(this));
    this.world.events.on("resource:stop_harvest", this.handleStopHarvest.bind(this));
    this.world.events.on("world:shutdown", this.handleShutdown.bind(this));
    this.startAutoSave();
    await this.loadResourceStates();
    this.createDefaultSpawns();
    console.log("[ResourceSpawnSystem] Initialized with resource management");
  }
  /**
   * Register default resource definitions
   */
  registerDefaultResources() {
    this.registerResource({
      id: "tree_normal",
      name: "Tree",
      type: "tree" /* TREE */,
      skillRequired: "woodcutting",
      levelRequired: 1,
      toolRequired: "axe",
      harvestTime: 3e3,
      respawnTime: 3e4,
      yields: [{ itemId: "logs", quantity: 1, chance: 1 }],
      experience: 25
    });
    this.registerResource({
      id: "tree_oak",
      name: "Oak tree",
      type: "tree" /* TREE */,
      skillRequired: "woodcutting",
      levelRequired: 15,
      toolRequired: "axe",
      harvestTime: 4e3,
      respawnTime: 45e3,
      yields: [{ itemId: "oak_logs", quantity: 1, chance: 1 }],
      experience: 37.5
    });
    this.registerResource({
      id: "tree_willow",
      name: "Willow tree",
      type: "tree" /* TREE */,
      skillRequired: "woodcutting",
      levelRequired: 30,
      toolRequired: "axe",
      harvestTime: 5e3,
      respawnTime: 6e4,
      yields: [{ itemId: "willow_logs", quantity: 1, chance: 1 }],
      experience: 67.5
    });
    this.registerResource({
      id: "rock_copper",
      name: "Copper rock",
      type: "rock" /* ROCK */,
      skillRequired: "mining",
      levelRequired: 1,
      toolRequired: "pickaxe",
      harvestTime: 3e3,
      respawnTime: 5e3,
      yields: [{ itemId: "copper_ore", quantity: 1, chance: 1 }],
      experience: 17.5
    });
    this.registerResource({
      id: "rock_tin",
      name: "Tin rock",
      type: "rock" /* ROCK */,
      skillRequired: "mining",
      levelRequired: 1,
      toolRequired: "pickaxe",
      harvestTime: 3e3,
      respawnTime: 5e3,
      yields: [{ itemId: "tin_ore", quantity: 1, chance: 1 }],
      experience: 17.5
    });
    this.registerResource({
      id: "rock_iron",
      name: "Iron rock",
      type: "rock" /* ROCK */,
      skillRequired: "mining",
      levelRequired: 15,
      toolRequired: "pickaxe",
      harvestTime: 5e3,
      respawnTime: 1e4,
      yields: [{ itemId: "iron_ore", quantity: 1, chance: 1 }],
      experience: 35
    });
    this.registerResource({
      id: "fishing_shrimp",
      name: "Fishing spot",
      type: "fishing_spot" /* FISHING_SPOT */,
      skillRequired: "fishing",
      levelRequired: 1,
      toolRequired: "small_net",
      harvestTime: 4e3,
      respawnTime: 0,
      // Fishing spots don't deplete
      yields: [
        { itemId: "raw_shrimps", quantity: 1, chance: 0.7 },
        { itemId: "raw_anchovies", quantity: 1, chance: 0.3 }
      ],
      experience: 10
    });
  }
  /**
   * Register a resource definition
   */
  registerResource(definition) {
    this.resourceDefinitions.set(definition.id, definition);
  }
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    this.saveTimer = setInterval(() => {
      if (this.pendingSaves) {
        this.saveResourceStates();
      }
    }, 3e4);
  }
  /**
   * Handle world shutdown
   */
  async handleShutdown() {
    await this.saveResourceStates();
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
  }
  /**
   * Load resource states from persistence
   */
  async loadResourceStates() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const entities = await persistence.loadWorldEntities();
      for (const entity of entities) {
        if (entity.entityType === "resource_spawn") {
          const metadata = entity.metadata || {};
          const spawn = {
            id: entity.entityId,
            definitionId: metadata.definitionId,
            position: JSON.parse(entity.position),
            currentState: metadata.state || "available",
            depletedAt: metadata.depletedAt ? new Date(metadata.depletedAt).getTime() : void 0,
            respawnsAt: metadata.respawnsAt ? new Date(metadata.respawnsAt).getTime() : void 0
          };
          this.resourceSpawns.set(spawn.id, spawn);
          if (spawn.currentState === "depleted") {
            this.createResourceEntity(spawn);
          }
        }
      }
      console.log(`[ResourceSpawnSystem] Loaded ${this.resourceSpawns.size} resource spawns`);
    } catch (error) {
      console.error(`[ResourceSpawnSystem] Failed to load resource states:`, error);
    }
  }
  /**
   * Save resource states to persistence
   */
  async saveResourceStates() {
    const persistence = this.world.getSystem("persistence");
    if (!persistence) return;
    try {
      const entities = [];
      for (const [id, spawn] of this.resourceSpawns) {
        entities.push({
          entityId: id,
          worldId: this.world.id || "default",
          entityType: "resource_spawn",
          position: JSON.stringify(spawn.position),
          metadata: {
            definitionId: spawn.definitionId,
            state: spawn.currentState,
            depletedAt: spawn.depletedAt ? new Date(spawn.depletedAt).toISOString() : null,
            respawnsAt: spawn.respawnsAt ? new Date(spawn.respawnsAt).toISOString() : null
          }
        });
      }
      await persistence.saveWorldEntities(entities);
      this.pendingSaves = false;
      console.log(`[ResourceSpawnSystem] Saved ${entities.length} resource states`);
    } catch (error) {
      console.error(`[ResourceSpawnSystem] Failed to save resource states:`, error);
    }
  }
  /**
   * Mark for save
   */
  markForSave() {
    this.pendingSaves = true;
  }
  /**
   * Create default resource spawns
   */
  createDefaultSpawns() {
    this.createResourceSpawn("tree_normal", { x: 10, y: 0, z: 10 });
    this.createResourceSpawn("tree_normal", { x: 15, y: 0, z: 8 });
    this.createResourceSpawn("tree_normal", { x: 12, y: 0, z: 15 });
    this.createResourceSpawn("tree_oak", { x: 20, y: 0, z: 10 });
    this.createResourceSpawn("tree_oak", { x: 25, y: 0, z: 15 });
    this.createResourceSpawn("tree_willow", { x: 30, y: 0, z: 20 });
    this.createResourceSpawn("rock_copper", { x: -20, y: 0, z: 20 });
    this.createResourceSpawn("rock_copper", { x: -22, y: 0, z: 22 });
    this.createResourceSpawn("rock_tin", { x: -18, y: 0, z: 22 });
    this.createResourceSpawn("rock_tin", { x: -20, y: 0, z: 24 });
    this.createResourceSpawn("rock_iron", { x: -25, y: 0, z: 25 });
    this.createResourceSpawn("rock_iron", { x: -27, y: 0, z: 23 });
    this.createResourceSpawn("fishing_shrimp", { x: 0, y: 0, z: 30 });
    this.createResourceSpawn("fishing_shrimp", { x: 5, y: 0, z: 32 });
  }
  /**
   * Create a resource spawn
   */
  createResourceSpawn(definitionId, position) {
    const definition = this.resourceDefinitions.get(definitionId);
    if (!definition) {
      console.error(`[ResourceSpawnSystem] Unknown resource definition: ${definitionId}`);
      return "";
    }
    const spawnId = `resource_${definitionId}_${Date.now()}_${Math.random()}`;
    const existingSpawn = Array.from(this.resourceSpawns.values()).find(
      (spawn2) => spawn2.position.x === position.x && spawn2.position.z === position.z
    );
    if (existingSpawn) {
      return existingSpawn.id;
    }
    const spawn = {
      id: spawnId,
      definitionId,
      position: { ...position },
      currentState: "available"
    };
    this.resourceSpawns.set(spawnId, spawn);
    this.createResourceEntity(spawn);
    this.markForSave();
    return spawnId;
  }
  /**
   * Create visual entity for resource
   */
  createResourceEntity(spawn) {
    const definition = this.resourceDefinitions.get(spawn.definitionId);
    if (!definition) return null;
    const entity = this.world.entities.create(spawn.id);
    if (!entity) return null;
    entity.position = spawn.position;
    entity.addComponent({
      type: "resource",
      definitionId: spawn.definitionId,
      state: spawn.currentState,
      harvestedBy: /* @__PURE__ */ new Set()
    });
    this.updateResourceVisual(entity, definition, spawn.currentState);
    return entity;
  }
  /**
   * Update resource visual based on state
   */
  updateResourceVisual(entity, definition, state) {
    entity.removeComponent("mesh");
    if (state === "available") {
      switch (definition.type) {
        case "tree" /* TREE */:
          entity.addComponent("mesh", {
            type: "box",
            size: { x: 1, y: 3, z: 1 },
            material: {
              type: "basic",
              color: "#228B22",
              emissive: "#0F4F0F"
            }
          });
          break;
        case "rock" /* ROCK */:
          entity.addComponent("mesh", {
            type: "box",
            size: { x: 1.5, y: 1, z: 1.5 },
            material: {
              type: "basic",
              color: "#696969",
              emissive: "#2F2F2F"
            }
          });
          break;
        case "fishing_spot" /* FISHING_SPOT */:
          entity.addComponent("mesh", {
            type: "box",
            size: { x: 2, y: 0.1, z: 2 },
            material: {
              type: "basic",
              color: "#1E90FF",
              emissive: "#0F4F8F",
              opacity: 0.7
            }
          });
          break;
      }
    } else {
      switch (definition.type) {
        case "tree" /* TREE */:
          entity.addComponent("mesh", {
            type: "box",
            size: { x: 0.8, y: 0.5, z: 0.8 },
            material: {
              type: "basic",
              color: "#8B4513"
            }
          });
          break;
        case "rock" /* ROCK */:
          entity.addComponent("mesh", {
            type: "box",
            size: { x: 1.2, y: 0.3, z: 1.2 },
            material: {
              type: "basic",
              color: "#3F3F3F"
            }
          });
          break;
      }
    }
    entity.addComponent("nameTag", {
      text: definition.name + (state === "depleted" ? " (Depleted)" : ""),
      offset: { x: 0, y: 2, z: 0 },
      size: 0.5,
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.5)"
    });
  }
  handleHarvestResource(data) {
    const { playerId, resourceId } = data;
    this.startHarvesting(playerId, resourceId);
  }
  handleStopHarvest(data) {
    const { playerId } = data;
    this.stopHarvesting(playerId);
  }
  /**
   * Start harvesting a resource
   */
  startHarvesting(playerId, resourceId) {
    const spawn = this.resourceSpawns.get(resourceId);
    if (!spawn || spawn.currentState === "depleted") {
      this.world.events.emit("resource:error", {
        playerId,
        message: "Resource is not available"
      });
      return false;
    }
    const definition = this.resourceDefinitions.get(spawn.definitionId);
    if (!definition) return false;
    const skillsSystem = this.world.systems.find((s) => s.constructor.name === "SkillsSystem");
    if (skillsSystem) {
      const level = skillsSystem.getSkillLevel(playerId, definition.skillRequired);
      if (level < definition.levelRequired) {
        this.world.events.emit("resource:error", {
          playerId,
          message: `You need level ${definition.levelRequired} ${definition.skillRequired} to harvest this`
        });
        return false;
      }
    }
    if (definition.toolRequired) {
      const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
      if (inventorySystem && !inventorySystem.hasItemEquipped(playerId, definition.toolRequired)) {
        this.world.events.emit("resource:error", {
          playerId,
          message: `You need a ${definition.toolRequired} to harvest this`
        });
        return false;
      }
    }
    this.harvestingPlayers.set(playerId, resourceId);
    const entity = this.world.getEntityById(resourceId);
    if (entity) {
      const resourceComp = entity.getComponent("resource");
      if (resourceComp) {
        resourceComp.harvestedBy?.add(playerId);
      }
    }
    setTimeout(() => {
      if (this.harvestingPlayers.get(playerId) === resourceId) {
        this.completeHarvest(playerId, resourceId);
      }
    }, definition.harvestTime);
    this.world.events.emit("resource:harvest_started", {
      playerId,
      resourceId,
      resourceName: definition.name,
      duration: definition.harvestTime
    });
    return true;
  }
  /**
   * Stop harvesting
   */
  stopHarvesting(playerId) {
    const resourceId = this.harvestingPlayers.get(playerId);
    if (!resourceId) return;
    this.harvestingPlayers.delete(playerId);
    const entity = this.world.getEntityById(resourceId);
    if (entity) {
      const resourceComp = entity.getComponent("resource");
      if (resourceComp) {
        resourceComp.harvestedBy?.delete(playerId);
      }
    }
    this.world.events.emit("resource:harvest_cancelled", {
      playerId,
      resourceId
    });
  }
  /**
   * Complete harvest
   */
  completeHarvest(playerId, resourceId) {
    const spawn = this.resourceSpawns.get(resourceId);
    if (!spawn || spawn.currentState === "depleted") return;
    const definition = this.resourceDefinitions.get(spawn.definitionId);
    if (!definition) return;
    this.harvestingPlayers.delete(playerId);
    const inventorySystem = this.world.systems.find((s) => s.constructor.name === "InventorySystem");
    if (inventorySystem) {
      for (const resourceYield of definition.yields) {
        if (Math.random() <= resourceYield.chance) {
          inventorySystem.addItem(playerId, resourceYield.itemId, resourceYield.quantity);
        }
      }
    }
    const skillsSystem = this.world.systems.find((s) => s.constructor.name === "SkillsSystem");
    if (skillsSystem) {
      skillsSystem.addExperience(playerId, definition.skillRequired, definition.experience);
    }
    if (definition.respawnTime > 0) {
      spawn.currentState = "depleted";
      spawn.depletedAt = Date.now();
      spawn.respawnsAt = Date.now() + definition.respawnTime;
      this.markForSave();
      const entity = this.world.getEntityById(resourceId);
      if (entity) {
        this.updateResourceVisual(entity, definition, "depleted");
        const resourceComp = entity.getComponent("resource");
        if (resourceComp) {
          resourceComp.state = "depleted";
          resourceComp.harvestedBy?.clear();
        }
      }
    }
    this.world.events.emit("resource:harvested", {
      playerId,
      resourceId,
      resourceName: definition.name,
      experience: definition.experience
    });
  }
  /**
   * Update system - handle respawns
   */
  update(_deltaTime) {
    const now = Date.now();
    let hasChanges = false;
    for (const [id, spawn] of this.resourceSpawns) {
      if (spawn.currentState === "depleted" && spawn.respawnsAt && now >= spawn.respawnsAt) {
        spawn.currentState = "available";
        spawn.depletedAt = void 0;
        spawn.respawnsAt = void 0;
        hasChanges = true;
        const entity = this.world.getEntityById(id);
        if (entity) {
          const definition = this.resourceDefinitions.get(spawn.definitionId);
          if (definition) {
            this.updateResourceVisual(entity, definition, "available");
            const resourceComp = entity.getComponent("resource");
            if (resourceComp) {
              resourceComp.state = "available";
            }
          }
        }
        this.world.events.emit("resource:respawned", {
          resourceId: id,
          definitionId: spawn.definitionId
        });
      }
    }
    if (hasChanges) {
      this.markForSave();
    }
  }
  serialize() {
    return {
      resourceSpawns: Object.fromEntries(this.resourceSpawns),
      harvestingPlayers: Object.fromEntries(this.harvestingPlayers)
    };
  }
  deserialize(data) {
    if (data.resourceSpawns) {
      this.resourceSpawns = new Map(Object.entries(data.resourceSpawns));
    }
    if (data.harvestingPlayers) {
      this.harvestingPlayers = new Map(Object.entries(data.harvestingPlayers));
    }
  }
};

// src/rpg/ui/UIRenderer.ts
var UIRenderer = class {
  constructor(world, theme) {
    this.context = null;
    this.imageCache = /* @__PURE__ */ new Map();
    this.fontLoaded = false;
    this.world = world;
    this.theme = theme;
  }
  /**
   * Initialize renderer with canvas
   */
  async initialize(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.context = {
      canvas,
      ctx,
      width: canvas.width,
      height: canvas.height,
      scale: window.devicePixelRatio || 1
    };
    await this.loadFonts();
    await this.loadImages();
    console.log("[UIRenderer] Initialized");
  }
  /**
   * Load custom fonts
   */
  async loadFonts() {
    try {
      const fonts = [
        new FontFace("RuneScape", "url(/assets/fonts/runescape.ttf)"),
        new FontFace("RuneScape Bold", "url(/assets/fonts/runescape-bold.ttf)"),
        new FontFace("RuneScape Chat", "url(/assets/fonts/runescape-chat.ttf)")
      ];
      await Promise.all(fonts.map((font) => font.load()));
      fonts.forEach((font) => document.fonts.add(font));
      this.fontLoaded = true;
    } catch (error) {
      console.warn("[UIRenderer] Failed to load custom fonts, using fallback", error);
      this.theme.fonts = {
        main: "Arial",
        heading: "Arial Black",
        chat: "Courier New"
      };
    }
  }
  /**
   * Load UI images
   */
  async loadImages() {
    const imagePaths = {
      // Skill icons
      "skill_attack": "/assets/icons/skills/attack.png",
      "skill_strength": "/assets/icons/skills/strength.png",
      "skill_defence": "/assets/icons/skills/defence.png",
      "skill_ranged": "/assets/icons/skills/ranged.png",
      "skill_prayer": "/assets/icons/skills/prayer.png",
      "skill_magic": "/assets/icons/skills/magic.png",
      "skill_runecraft": "/assets/icons/skills/runecraft.png",
      "skill_construction": "/assets/icons/skills/construction.png",
      "skill_hitpoints": "/assets/icons/skills/hitpoints.png",
      "skill_agility": "/assets/icons/skills/agility.png",
      "skill_herblore": "/assets/icons/skills/herblore.png",
      "skill_thieving": "/assets/icons/skills/thieving.png",
      "skill_crafting": "/assets/icons/skills/crafting.png",
      "skill_fletching": "/assets/icons/skills/fletching.png",
      "skill_slayer": "/assets/icons/skills/slayer.png",
      "skill_hunter": "/assets/icons/skills/hunter.png",
      "skill_mining": "/assets/icons/skills/mining.png",
      "skill_smithing": "/assets/icons/skills/smithing.png",
      "skill_fishing": "/assets/icons/skills/fishing.png",
      "skill_cooking": "/assets/icons/skills/cooking.png",
      "skill_firemaking": "/assets/icons/skills/firemaking.png",
      "skill_woodcutting": "/assets/icons/skills/woodcutting.png",
      "skill_farming": "/assets/icons/skills/farming.png",
      // UI elements
      "ui_close": "/assets/icons/ui/close.png",
      "ui_minimize": "/assets/icons/ui/minimize.png",
      "ui_settings": "/assets/icons/ui/settings.png",
      "ui_inventory": "/assets/icons/ui/inventory.png",
      "ui_quest": "/assets/icons/ui/quest.png",
      "ui_skills": "/assets/icons/ui/skills.png",
      "ui_prayer": "/assets/icons/ui/prayer.png",
      "ui_magic": "/assets/icons/ui/magic.png",
      "ui_clan": "/assets/icons/ui/clan.png",
      "ui_friends": "/assets/icons/ui/friends.png",
      "ui_logout": "/assets/icons/ui/logout.png",
      // Inventory slot
      "slot_empty": "/assets/icons/ui/slot_empty.png",
      "slot_hover": "/assets/icons/ui/slot_hover.png",
      "slot_selected": "/assets/icons/ui/slot_selected.png"
    };
    const loadPromises = Object.entries(imagePaths).map(async ([key, path2]) => {
      try {
        const img = new Image();
        img.src = path2;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        this.imageCache.set(key, img);
      } catch (error) {
        console.warn(`[UIRenderer] Failed to load image: ${path2}`);
      }
    });
    await Promise.all(loadPromises);
  }
  /**
   * Render all UI elements
   */
  render(elements) {
    if (!this.context) return;
    const { ctx } = this.context;
    const sortedElements = [...elements].sort((a, b) => a.layer - b.layer);
    for (const element of sortedElements) {
      if (!element.visible) continue;
      this.renderElement(element);
    }
  }
  /**
   * Render individual UI element
   */
  renderElement(element) {
    if (!this.context) return;
    const { ctx } = this.context;
    const pos = this.calculatePosition(element.position);
    switch (element.type) {
      case "panel":
        this.renderPanel(ctx, pos, element.size, element.data);
        break;
      case "button":
        this.renderButton(ctx, pos, element.size, element.data);
        break;
      case "text":
        this.renderText(ctx, pos, element.size, element.data);
        break;
      case "icon":
        this.renderIcon(ctx, pos, element.size, element.data);
        break;
      case "progress_bar":
        this.renderProgressBar(ctx, pos, element.size, element.data);
        break;
      case "inventory_slot":
        this.renderInventorySlot(ctx, pos, element.size, element.data);
        break;
      case "chat_box":
        this.renderChatBox(ctx, pos, element.size, element.data);
        break;
      case "minimap":
        this.renderMinimap(ctx, pos, element.size, element.data);
        break;
      case "context_menu":
        this.renderContextMenu(ctx, pos, element.size, element.data);
        break;
    }
    if (element.children) {
      for (const child of element.children) {
        this.renderElement(child);
      }
    }
  }
  /**
   * Calculate absolute position (handle negative values for right/bottom alignment)
   */
  calculatePosition(position) {
    if (!this.context) return position;
    const { width, height } = this.context;
    return {
      x: position.x < 0 ? width + position.x : position.x,
      y: position.y < 0 ? height + position.y : position.y
    };
  }
  /**
   * Render panel
   */
  renderPanel(ctx, pos, size, data) {
    ctx.fillStyle = data.backgroundColor || this.theme.colors.background;
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    if (data.border !== false) {
      ctx.strokeStyle = data.borderColor || this.theme.colors.border;
      ctx.lineWidth = data.borderWidth || 2;
      ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    }
    if (data.title) {
      ctx.fillStyle = this.theme.colors.primary;
      ctx.fillRect(pos.x, pos.y, size.x, 30);
      ctx.fillStyle = this.theme.colors.text;
      ctx.font = `16px ${this.theme.fonts.heading}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.title, pos.x + size.x / 2, pos.y + 15);
    }
  }
  /**
   * Render button
   */
  renderButton(ctx, pos, size, data) {
    const isHovered = data.hovered || false;
    const isPressed = data.pressed || false;
    if (isPressed) {
      ctx.fillStyle = this.theme.colors.active;
    } else if (isHovered) {
      ctx.fillStyle = this.theme.colors.hover;
    } else {
      ctx.fillStyle = this.theme.colors.secondary;
    }
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    ctx.strokeStyle = this.theme.colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    if (data.icon) {
      const icon = this.imageCache.get(`ui_${data.icon}`);
      if (icon) {
        const iconSize = Math.min(size.x, size.y) - 8;
        ctx.drawImage(
          icon,
          pos.x + (size.x - iconSize) / 2,
          pos.y + (size.y - iconSize) / 2,
          iconSize,
          iconSize
        );
      }
    } else if (data.text) {
      ctx.fillStyle = this.theme.colors.text;
      ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.main}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.text, pos.x + size.x / 2, pos.y + size.y / 2);
    }
  }
  /**
   * Render text
   */
  renderText(ctx, pos, size, data) {
    ctx.fillStyle = data.color || this.theme.colors.text;
    ctx.font = `${data.fontSize || this.theme.sizes.text}px ${data.font || this.theme.fonts.main}`;
    ctx.textAlign = data.align || "left";
    ctx.textBaseline = data.baseline || "top";
    if (data.editable) {
      ctx.fillStyle = this.theme.colors.background;
      ctx.fillRect(pos.x, pos.y, size.x, size.y);
      ctx.strokeStyle = this.theme.colors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x, pos.y, size.x, size.y);
      ctx.fillStyle = data.color || this.theme.colors.text;
      ctx.fillText(data.text || data.placeholder || "", pos.x + 5, pos.y + size.y / 2);
    } else {
      ctx.fillText(data.text || "", pos.x, pos.y);
    }
  }
  /**
   * Render icon
   */
  renderIcon(ctx, pos, size, data) {
    if (data.skill) {
      const icon = this.imageCache.get(`skill_${data.skill}`);
      if (icon) {
        ctx.drawImage(icon, pos.x, pos.y, this.theme.sizes.iconMedium, this.theme.sizes.iconMedium);
        ctx.fillStyle = this.theme.colors.text;
        ctx.font = `12px ${this.theme.fonts.main}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${data.level}`, pos.x + size.x - 5, pos.y + size.y - 5);
      }
    }
  }
  /**
   * Render progress bar
   */
  renderProgressBar(ctx, pos, size, data) {
    ctx.fillStyle = this.theme.colors.background;
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    const progress = Math.min(1, Math.max(0, data.current / data.max));
    ctx.fillStyle = data.color || this.theme.colors.primary;
    ctx.fillRect(pos.x, pos.y, size.x * progress, size.y);
    ctx.strokeStyle = this.theme.colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    if (data.label) {
      ctx.fillStyle = this.theme.colors.text;
      ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.main}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${data.label}: ${data.current}/${data.max}`,
        pos.x + size.x / 2,
        pos.y + size.y / 2
      );
    }
  }
  /**
   * Render inventory slot
   */
  renderInventorySlot(ctx, pos, size, data) {
    const slotImage = data.hovered ? this.imageCache.get("slot_hover") : data.selected ? this.imageCache.get("slot_selected") : this.imageCache.get("slot_empty");
    if (slotImage) {
      ctx.drawImage(slotImage, pos.x, pos.y, size.x, size.y);
    } else {
      ctx.fillStyle = data.hovered ? this.theme.colors.hover : this.theme.colors.background;
      ctx.fillRect(pos.x, pos.y, size.x, size.y);
      ctx.strokeStyle = this.theme.colors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    }
    if (data.item) {
      ctx.fillStyle = "#888";
      ctx.fillRect(pos.x + 8, pos.y + 8, size.x - 16, size.y - 16);
      if (data.item.quantity > 1) {
        ctx.fillStyle = this.theme.colors.text;
        ctx.font = `10px ${this.theme.fonts.main}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${data.item.quantity}`, pos.x + size.x - 2, pos.y + size.y - 2);
      }
    }
    if (data.showPrice && data.item) {
      ctx.fillStyle = "#ffff00";
      ctx.font = `10px ${this.theme.fonts.main}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${data.item.price}gp`, pos.x + size.x / 2, pos.y + size.y + 12);
    }
  }
  /**
   * Render chat box
   */
  renderChatBox(ctx, pos, size, data) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    const messages = data.messages || [];
    const lineHeight = 16;
    const maxLines = Math.floor(size.y / lineHeight);
    const startIndex = Math.max(0, messages.length - maxLines);
    ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.chat}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < maxLines && startIndex + i < messages.length; i++) {
      const message = messages[startIndex + i];
      ctx.fillStyle = message.color || this.theme.colors.text;
      const text = message.sender ? `${message.sender}: ${message.text}` : message.text;
      ctx.fillText(text, pos.x + 5, pos.y + 5 + i * lineHeight);
    }
  }
  /**
   * Render minimap
   */
  renderMinimap(ctx, pos, size, data) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    ctx.strokeStyle = this.theme.colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    ctx.fillStyle = "#333";
    ctx.fillRect(pos.x + 10, pos.y + 10, size.x - 20, size.y - 20);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pos.x + size.x / 2, pos.y + size.y / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  /**
   * Render context menu
   */
  renderContextMenu(ctx, pos, size, data) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = this.theme.colors.background;
    ctx.fillRect(pos.x, pos.y, size.x, size.y);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = this.theme.colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x, pos.y, size.x, size.y);
  }
  /**
   * Update theme
   */
  updateTheme(theme) {
    this.theme = theme;
  }
  /**
   * Resize canvas
   */
  resize(width, height) {
    if (!this.context) return;
    this.context.canvas.width = width;
    this.context.canvas.height = height;
    this.context.width = width;
    this.context.height = height;
  }
  /**
   * Clear canvas
   */
  clear() {
    if (!this.context) return;
    this.context.ctx.clearRect(0, 0, this.context.width, this.context.height);
  }
};

// src/rpg/ui/InputHandler.ts
var InputHandler = class {
  constructor(world, playerId) {
    this.canvas = null;
    // Input configuration
    this.mouseSensitivity = 1;
    this.keyBindings = /* @__PURE__ */ new Map();
    this.preventDefaultKeys = /* @__PURE__ */ new Set();
    // Drag tracking
    this.dragStart = null;
    this.isDragging = false;
    this.dragThreshold = 5;
    this.world = world;
    this.playerId = playerId;
    this.state = {
      mouse: {
        position: { x: 0, y: 0 },
        buttons: [false, false, false],
        wheel: 0
      },
      keyboard: {
        keys: /* @__PURE__ */ new Set(),
        shift: false,
        ctrl: false,
        alt: false
      },
      touch: {
        touches: []
      }
    };
    this.setupDefaultKeyBindings();
  }
  /**
   * Initialize input handler with canvas
   */
  initialize(canvas) {
    this.canvas = canvas;
    canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    canvas.addEventListener("wheel", this.handleMouseWheel.bind(this));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    canvas.addEventListener("touchstart", this.handleTouchStart.bind(this));
    canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
    canvas.style.userSelect = "none";
    canvas.style.touchAction = "none";
    console.log("[InputHandler] Initialized");
  }
  /**
   * Setup default key bindings
   */
  setupDefaultKeyBindings() {
    this.keyBindings.set("w", "move_north");
    this.keyBindings.set("s", "move_south");
    this.keyBindings.set("a", "move_west");
    this.keyBindings.set("d", "move_east");
    this.keyBindings.set("ArrowUp", "camera_up");
    this.keyBindings.set("ArrowDown", "camera_down");
    this.keyBindings.set("ArrowLeft", "camera_left");
    this.keyBindings.set("ArrowRight", "camera_right");
    this.keyBindings.set("i", "toggle_inventory");
    this.keyBindings.set("Tab", "toggle_inventory");
    this.keyBindings.set("q", "toggle_quest");
    this.keyBindings.set("p", "toggle_prayer");
    this.keyBindings.set("m", "toggle_magic");
    this.keyBindings.set("k", "toggle_skills");
    this.keyBindings.set("f", "toggle_friends");
    this.keyBindings.set("c", "toggle_clan");
    this.keyBindings.set("Escape", "close_interface");
    this.keyBindings.set("Enter", "focus_chat");
    this.keyBindings.set(" ", "interact");
    this.keyBindings.set("Shift", "modifier_shift");
    this.keyBindings.set("Control", "modifier_ctrl");
    this.keyBindings.set("Alt", "modifier_alt");
    for (let i = 1; i <= 12; i++) {
      this.keyBindings.set(`F${i}`, `quick_slot_${i}`);
    }
    this.preventDefaultKeys = /* @__PURE__ */ new Set([
      "Tab",
      "Enter",
      "Escape",
      " ",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
    ]);
  }
  /**
   * Handle mouse move
   */
  handleMouseMove(event) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * this.mouseSensitivity;
    const y = (event.clientY - rect.top) * this.mouseSensitivity;
    const oldPosition = { ...this.state.mouse.position };
    this.state.mouse.position = { x, y };
    if (this.dragStart && !this.isDragging) {
      const distance = Math.sqrt(
        Math.pow(x - this.dragStart.x, 2) + Math.pow(y - this.dragStart.y, 2)
      );
      if (distance > this.dragThreshold) {
        this.isDragging = true;
        this.world.events.emit("ui:drag_start", {
          playerId: this.playerId,
          start: this.dragStart,
          current: { x, y }
        });
      }
    }
    this.world.events.emit("input:mouse_move", {
      playerId: this.playerId,
      position: { x, y },
      delta: { x: x - oldPosition.x, y: y - oldPosition.y },
      buttons: this.state.mouse.buttons,
      isDragging: this.isDragging
    });
    this.updateHoveredElement({ x, y });
  }
  /**
   * Handle mouse down
   */
  handleMouseDown(event) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * this.mouseSensitivity;
    const y = (event.clientY - rect.top) * this.mouseSensitivity;
    this.state.mouse.buttons[event.button] = true;
    this.dragStart = { x, y };
    this.world.events.emit("input:mouse_down", {
      playerId: this.playerId,
      position: { x, y },
      button: event.button,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    });
    this.handleElementClick({ x, y }, event.button);
  }
  /**
   * Handle mouse up
   */
  handleMouseUp(event) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * this.mouseSensitivity;
    const y = (event.clientY - rect.top) * this.mouseSensitivity;
    this.state.mouse.buttons[event.button] = false;
    if (this.isDragging && this.dragStart) {
      this.world.events.emit("ui:drag_end", {
        playerId: this.playerId,
        start: this.dragStart,
        end: { x, y }
      });
    }
    this.dragStart = null;
    this.isDragging = false;
    this.world.events.emit("input:mouse_up", {
      playerId: this.playerId,
      position: { x, y },
      button: event.button
    });
  }
  /**
   * Handle mouse wheel
   */
  handleMouseWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -1 : 1;
    this.state.mouse.wheel = delta;
    this.world.events.emit("input:mouse_wheel", {
      playerId: this.playerId,
      delta,
      position: { ...this.state.mouse.position }
    });
  }
  /**
   * Handle key down
   */
  handleKeyDown(event) {
    if (this.preventDefaultKeys.has(event.key)) {
      event.preventDefault();
    }
    if (this.state.keyboard.keys.has(event.key)) return;
    this.state.keyboard.keys.add(event.key);
    this.state.keyboard.shift = event.shiftKey;
    this.state.keyboard.ctrl = event.ctrlKey;
    this.state.keyboard.alt = event.altKey;
    const action = this.keyBindings.get(event.key);
    this.world.events.emit("input:key_down", {
      playerId: this.playerId,
      key: event.key,
      action,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    });
    if (action) {
      this.handleKeyAction(action);
    }
  }
  /**
   * Handle key up
   */
  handleKeyUp(event) {
    this.state.keyboard.keys.delete(event.key);
    this.state.keyboard.shift = event.shiftKey;
    this.state.keyboard.ctrl = event.ctrlKey;
    this.state.keyboard.alt = event.altKey;
    const action = this.keyBindings.get(event.key);
    this.world.events.emit("input:key_up", {
      playerId: this.playerId,
      key: event.key,
      action
    });
  }
  /**
   * Handle touch start
   */
  handleTouchStart(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const touchPoint = {
        id: touch.identifier,
        position: { x, y },
        startPosition: { x, y },
        startTime: Date.now()
      };
      this.state.touch.touches.push(touchPoint);
      this.world.events.emit("input:touch_start", {
        playerId: this.playerId,
        touchId: touch.identifier,
        position: { x, y },
        touches: this.state.touch.touches.length
      });
      if (this.state.touch.touches.length === 1) {
        this.state.mouse.position = { x, y };
        this.state.mouse.buttons[0] = true;
        this.dragStart = { x, y };
        this.handleElementClick({ x, y }, 0);
      }
    }
  }
  /**
   * Handle touch move
   */
  handleTouchMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const touchPoint = this.state.touch.touches.find((t) => t.id === touch.identifier);
      if (touchPoint) {
        touchPoint.position = { x, y };
        if (this.state.touch.touches[0]?.id === touch.identifier) {
          this.state.mouse.position = { x, y };
          this.updateHoveredElement({ x, y });
        }
      }
    }
    this.world.events.emit("input:touch_move", {
      playerId: this.playerId,
      touches: this.state.touch.touches
    });
  }
  /**
   * Handle touch end
   */
  handleTouchEnd(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const index = this.state.touch.touches.findIndex((t) => t.id === touch.identifier);
      if (index !== -1) {
        const touchPoint = this.state.touch.touches[index];
        const duration = Date.now() - touchPoint.startTime;
        const distance = Math.sqrt(
          Math.pow(touchPoint.position.x - touchPoint.startPosition.x, 2) + Math.pow(touchPoint.position.y - touchPoint.startPosition.y, 2)
        );
        if (distance < this.dragThreshold && duration < 500) {
          this.world.events.emit("input:tap", {
            playerId: this.playerId,
            position: touchPoint.position,
            duration
          });
        }
        this.state.touch.touches.splice(index, 1);
        if (index === 0) {
          this.state.mouse.buttons[0] = false;
          this.dragStart = null;
          this.isDragging = false;
        }
      }
    }
    this.world.events.emit("input:touch_end", {
      playerId: this.playerId,
      remainingTouches: this.state.touch.touches.length
    });
  }
  /**
   * Handle key action
   */
  handleKeyAction(action) {
    switch (action) {
      case "toggle_inventory":
        this.world.events.emit("ui:toggle_interface", {
          playerId: this.playerId,
          interface: "inventory"
        });
        break;
      case "toggle_quest":
        this.world.events.emit("ui:toggle_interface", {
          playerId: this.playerId,
          interface: "quest"
        });
        break;
      case "toggle_skills":
        this.world.events.emit("ui:toggle_interface", {
          playerId: this.playerId,
          interface: "skills"
        });
        break;
      case "close_interface":
        this.world.events.emit("ui:close_all", {
          playerId: this.playerId
        });
        break;
      case "focus_chat":
        this.world.events.emit("ui:focus_chat", {
          playerId: this.playerId
        });
        break;
      default:
        this.world.events.emit("input:action", {
          playerId: this.playerId,
          action
        });
    }
  }
  /**
   * Update hovered element
   */
  updateHoveredElement(position) {
    this.world.events.emit("ui:hover", {
      playerId: this.playerId,
      position,
      elementId: null
      // Would be determined by checking UI elements
    });
  }
  /**
   * Handle element click
   */
  handleElementClick(position, button) {
    this.world.events.emit("ui:click", {
      playerId: this.playerId,
      position,
      button,
      elementId: null
      // Would be determined by checking UI elements
    });
  }
  /**
   * Set key binding
   */
  setKeyBinding(key, action) {
    this.keyBindings.set(key, action);
  }
  /**
   * Remove key binding
   */
  removeKeyBinding(key) {
    this.keyBindings.delete(key);
  }
  /**
   * Get current input state
   */
  getState() {
    return this.state;
  }
  /**
   * Is key pressed
   */
  isKeyPressed(key) {
    return this.state.keyboard.keys.has(key);
  }
  /**
   * Is mouse button pressed
   */
  isMouseButtonPressed(button) {
    return this.state.mouse.buttons[button] || false;
  }
  /**
   * Get mouse position
   */
  getMousePosition() {
    return { ...this.state.mouse.position };
  }
  /**
   * Set mouse sensitivity
   */
  setMouseSensitivity(sensitivity) {
    this.mouseSensitivity = Math.max(0.1, Math.min(2, sensitivity));
  }
  /**
   * Cleanup
   */
  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener("mousemove", this.handleMouseMove.bind(this));
      this.canvas.removeEventListener("mousedown", this.handleMouseDown.bind(this));
      this.canvas.removeEventListener("mouseup", this.handleMouseUp.bind(this));
      this.canvas.removeEventListener("wheel", this.handleMouseWheel.bind(this));
      this.canvas.removeEventListener("touchstart", this.handleTouchStart.bind(this));
      this.canvas.removeEventListener("touchmove", this.handleTouchMove.bind(this));
      this.canvas.removeEventListener("touchend", this.handleTouchEnd.bind(this));
    }
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window.removeEventListener("keyup", this.handleKeyUp.bind(this));
  }
};

// src/rpg/ui/KeybindingSystem.ts
var KeybindingSystem = class {
  constructor() {
    this.bindings = /* @__PURE__ */ new Map();
    this.activeKeys = /* @__PURE__ */ new Set();
    this.enabled = true;
    this.setupDefaultBindings();
    this.setupEventListeners();
  }
  /**
   * Set up all default keybindings
   */
  setupDefaultBindings() {
    this.addBinding({ key: "w", action: "move_forward", description: "Move forward", category: "Movement" });
    this.addBinding({ key: "s", action: "move_backward", description: "Move backward", category: "Movement" });
    this.addBinding({ key: "a", action: "move_left", description: "Move left", category: "Movement" });
    this.addBinding({ key: "d", action: "move_right", description: "Move right", category: "Movement" });
    this.addBinding({ key: "shift", action: "run", description: "Run/Walk toggle", category: "Movement" });
    this.addBinding({ key: " ", action: "jump", description: "Jump", category: "Movement" });
    this.addBinding({ key: "q", action: "rotate_camera_left", description: "Rotate camera left", category: "Camera" });
    this.addBinding({ key: "e", action: "rotate_camera_right", description: "Rotate camera right", category: "Camera" });
    this.addBinding({ key: "r", action: "reset_camera", description: "Reset camera", category: "Camera" });
    this.addBinding({ key: "1", action: "combat_style_accurate", description: "Accurate combat style", category: "Combat" });
    this.addBinding({ key: "2", action: "combat_style_aggressive", description: "Aggressive combat style", category: "Combat" });
    this.addBinding({ key: "3", action: "combat_style_defensive", description: "Defensive combat style", category: "Combat" });
    this.addBinding({ key: "4", action: "combat_style_controlled", description: "Controlled combat style", category: "Combat" });
    this.addBinding({ key: "f", action: "auto_retaliate", description: "Toggle auto-retaliate", category: "Combat" });
    this.addBinding({ key: "i", action: "toggle_inventory", description: "Toggle inventory", category: "Interface" });
    this.addBinding({ key: "b", action: "toggle_bank", description: "Toggle bank", category: "Interface" });
    this.addBinding({ key: "k", action: "toggle_skills", description: "Toggle skills", category: "Interface" });
    this.addBinding({ key: "j", action: "toggle_quest_journal", description: "Toggle quest journal", category: "Interface" });
    this.addBinding({ key: "m", action: "toggle_world_map", description: "Toggle world map", category: "Interface" });
    this.addBinding({ key: "p", action: "toggle_prayer", description: "Toggle prayer", category: "Interface" });
    this.addBinding({ key: "o", action: "toggle_options", description: "Toggle options", category: "Interface" });
    this.addBinding({ key: "escape", action: "close_all_windows", description: "Close all windows", category: "Interface" });
    this.addBinding({ key: "x", action: "examine", description: "Examine target", category: "Actions" });
    this.addBinding({ key: "g", action: "pickup_item", description: "Pick up nearest item", category: "Actions" });
    this.addBinding({ key: "t", action: "talk_to_npc", description: "Talk to nearest NPC", category: "Actions" });
    this.addBinding({ key: "u", action: "use_item", description: "Use selected item", category: "Actions" });
    this.addBinding({ key: "c", action: "skill_woodcutting", description: "Chop nearest tree", category: "Skills" });
    this.addBinding({ key: "v", action: "skill_mining", description: "Mine nearest rock", category: "Skills" });
    this.addBinding({ key: "n", action: "skill_fishing", description: "Fish at nearest spot", category: "Skills" });
    this.addBinding({ key: "F1", action: "quick_prayer_1", description: "Quick prayer 1", category: "Magic" });
    this.addBinding({ key: "F2", action: "quick_prayer_2", description: "Quick prayer 2", category: "Magic" });
    this.addBinding({ key: "F3", action: "quick_prayer_3", description: "Quick prayer 3", category: "Magic" });
    this.addBinding({ key: "F4", action: "quick_prayer_4", description: "Quick prayer 4", category: "Magic" });
    this.addBinding({ key: "enter", action: "open_chat", description: "Open chat", category: "Communication" });
    this.addBinding({ key: "/", action: "quick_chat", description: "Quick chat", category: "Communication" });
    this.addBinding({ key: "tab", action: "reply_last", description: "Reply to last PM", category: "Communication" });
    this.addBinding({ key: "F5", action: "toggle_run", description: "Toggle run mode", category: "Settings" });
    this.addBinding({ key: "F6", action: "toggle_music", description: "Toggle music", category: "Settings" });
    this.addBinding({ key: "F7", action: "toggle_effects", description: "Toggle sound effects", category: "Settings" });
    this.addBinding({ key: "F12", action: "screenshot", description: "Take screenshot", category: "Settings" });
    this.addBinding({ key: "`", action: "toggle_debug", description: "Toggle debug info", category: "Debug" });
    this.addBinding({ key: "F9", action: "spawn_test_npc", description: "Spawn test NPC", category: "Debug" });
    this.addBinding({ key: "F10", action: "spawn_test_item", description: "Spawn test item", category: "Debug" });
    this.addBinding({ key: "F11", action: "teleport_home", description: "Teleport to home", category: "Debug" });
  }
  /**
   * Add a keybinding
   */
  addBinding(binding) {
    const key = this.getBindingKey(binding);
    this.bindings.set(key, binding);
  }
  /**
   * Get unique key for binding
   */
  getBindingKey(binding) {
    let key = binding.key.toLowerCase();
    if (binding.ctrl) key = "ctrl+" + key;
    if (binding.shift && binding.key !== "shift") key = "shift+" + key;
    if (binding.alt) key = "alt+" + key;
    return key;
  }
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    window.addEventListener("blur", this.handleBlur.bind(this));
  }
  /**
   * Handle key down event
   */
  handleKeyDown(event) {
    if (!this.enabled) return;
    if (this.isTypingInInput(event)) return;
    const key = this.getEventKey(event);
    if (this.activeKeys.has(key)) return;
    this.activeKeys.add(key);
    const binding = this.bindings.get(key);
    if (binding) {
      event.preventDefault();
      this.executeAction(binding.action, true);
    }
  }
  /**
   * Handle key up event
   */
  handleKeyUp(event) {
    if (!this.enabled) return;
    const key = this.getEventKey(event);
    this.activeKeys.delete(key);
    const binding = this.bindings.get(key);
    if (binding) {
      if (this.isHoldAction(binding.action)) {
        this.executeAction(binding.action, false);
      }
    }
  }
  /**
   * Handle window blur
   */
  handleBlur() {
    this.activeKeys.clear();
  }
  /**
   * Get key from event
   */
  getEventKey(event) {
    let key = event.key.toLowerCase();
    if (key === " ") key = "space";
    if (key === "arrowup") key = "up";
    if (key === "arrowdown") key = "down";
    if (key === "arrowleft") key = "left";
    if (key === "arrowright") key = "right";
    if (event.ctrlKey && key !== "control") key = "ctrl+" + key;
    if (event.shiftKey && key !== "shift") key = "shift+" + key;
    if (event.altKey && key !== "alt") key = "alt+" + key;
    return key;
  }
  /**
   * Check if typing in input
   */
  isTypingInInput(event) {
    const target = event.target;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";
  }
  /**
   * Check if action is hold-based
   */
  isHoldAction(action) {
    return action.startsWith("move_") || action === "run" || action.startsWith("rotate_camera_");
  }
  /**
   * Execute an action
   */
  executeAction(action, pressed) {
    window.dispatchEvent(new CustomEvent("rpg:keybinding", {
      detail: { action, pressed }
    }));
  }
  /**
   * Get all bindings
   */
  getBindings() {
    return Array.from(this.bindings.values());
  }
  /**
   * Get bindings by category
   */
  getBindingsByCategory(category) {
    return this.getBindings().filter((b) => b.category === category);
  }
  /**
   * Get categories
   */
  getCategories() {
    const categories = /* @__PURE__ */ new Set();
    this.bindings.forEach((b) => categories.add(b.category));
    return Array.from(categories);
  }
  /**
   * Update binding
   */
  updateBinding(oldKey, newBinding) {
    this.bindings.delete(oldKey);
    this.addBinding(newBinding);
  }
  /**
   * Enable/disable system
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.activeKeys.clear();
    }
  }
  /**
   * Check if key is active
   */
  isKeyActive(key) {
    return this.activeKeys.has(key);
  }
  /**
   * Get active movement keys
   */
  getActiveMovement() {
    return {
      forward: this.activeKeys.has("w"),
      backward: this.activeKeys.has("s"),
      left: this.activeKeys.has("a"),
      right: this.activeKeys.has("d"),
      run: this.activeKeys.has("shift")
    };
  }
};

// src/rpg/ui/UISystem.ts
var UISystem = class extends System {
  constructor(world) {
    super(world);
    this.interfaces = /* @__PURE__ */ new Map();
    this.elementIdCounter = 0;
    // UI state
    this.activeInterfaces = /* @__PURE__ */ new Set();
    this.draggedElement = null;
    this.tooltipElement = null;
    this.canvas = null;
    this.renderer = null;
    this.inputHandler = null;
    this.keybindingSystem = null;
    this.theme = this.getDefaultTheme();
  }
  async initialize() {
    console.log("[UISystem] Initializing...");
    this.canvas = document.createElement("canvas");
    this.canvas.id = "rpg-ui-canvas";
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "auto";
    this.canvas.style.zIndex = "1000";
    if (typeof document !== "undefined") {
      document.body.appendChild(this.canvas);
      this.renderer = new UIRenderer(this.canvas);
      this.inputHandler = new InputHandler(this.canvas, this);
      this.keybindingSystem = new KeybindingSystem();
      this.setupKeybindingListener();
    }
    this.createHUD();
    this.createInventoryInterface();
    this.createChatInterface();
    this.createBankInterface();
    this.createShopInterface();
    this.createQuestInterface();
    this.createSkillsInterface();
    this.createContextMenu();
    this.createSettingsInterface();
    this.world.events.on("player:connect", this.handlePlayerConnect.bind(this));
    this.world.events.on("player:disconnect", this.handlePlayerDisconnect.bind(this));
    this.world.events.on("ui:click", this.handleClick.bind(this));
    this.world.events.on("ui:hover", this.handleHover.bind(this));
    this.world.events.on("ui:drag", this.handleDrag.bind(this));
    console.log("[UISystem] Initialized with game interfaces");
  }
  /**
   * Get default theme
   */
  getDefaultTheme() {
    return {
      colors: {
        primary: "#4a3c28",
        secondary: "#8b7355",
        background: "#2c2416",
        text: "#f4e4bc",
        border: "#6b5d54",
        hover: "#5a4a3a",
        active: "#7a6a5a",
        disabled: "#3a3026"
      },
      fonts: {
        main: "RuneScape",
        heading: "RuneScape Bold",
        chat: "RuneScape Chat"
      },
      sizes: {
        text: 14,
        iconSmall: 24,
        iconMedium: 32,
        iconLarge: 48,
        borderRadius: 4,
        padding: 8
      }
    };
  }
  /**
   * Create HUD interface
   */
  createHUD() {
    const hud = {
      id: "hud",
      name: "HUD",
      elements: /* @__PURE__ */ new Map(),
      layout: "fixed",
      visible: true,
      alwaysVisible: true
    };
    const healthBar = this.createElement({
      type: "progress_bar" /* PROGRESS_BAR */,
      position: { x: 10, y: 10 },
      size: { x: 200, y: 30 },
      data: {
        current: 10,
        max: 10,
        color: "#ff0000",
        label: "Health"
      }
    });
    hud.elements.set(healthBar.id, healthBar);
    const prayerBar = this.createElement({
      type: "progress_bar" /* PROGRESS_BAR */,
      position: { x: 10, y: 45 },
      size: { x: 200, y: 30 },
      data: {
        current: 1,
        max: 1,
        color: "#00ff00",
        label: "Prayer"
      }
    });
    hud.elements.set(prayerBar.id, prayerBar);
    const runEnergy = this.createElement({
      type: "progress_bar" /* PROGRESS_BAR */,
      position: { x: 10, y: 80 },
      size: { x: 200, y: 30 },
      data: {
        current: 100,
        max: 100,
        color: "#ffff00",
        label: "Run Energy"
      }
    });
    hud.elements.set(runEnergy.id, runEnergy);
    const minimap = this.createElement({
      type: "minimap" /* MINIMAP */,
      position: { x: -220, y: 10 },
      // Negative x for right alignment
      size: { x: 200, y: 200 },
      data: {
        zoom: 2,
        showPlayers: true,
        showNPCs: true,
        showItems: false
      }
    });
    hud.elements.set(minimap.id, minimap);
    const combatLevel = this.createElement({
      type: "text" /* TEXT */,
      position: { x: 220, y: 10 },
      size: { x: 100, y: 30 },
      data: {
        text: "Combat: 3",
        fontSize: 16,
        color: this.theme.colors.text
      }
    });
    hud.elements.set(combatLevel.id, combatLevel);
    this.interfaces.set("hud", hud);
  }
  /**
   * Create inventory interface
   */
  createInventoryInterface() {
    const inventory = {
      id: "inventory",
      name: "Inventory",
      elements: /* @__PURE__ */ new Map(),
      layout: "grid",
      visible: false,
      position: { x: -280, y: 220 },
      size: { x: 260, y: 340 }
    };
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        const slot = this.createElement({
          type: "inventory_slot" /* INVENTORY_SLOT */,
          position: {
            x: 10 + col * 62,
            y: 40 + row * 44
          },
          size: { x: 56, y: 40 },
          data: {
            slotIndex: row * 4 + col,
            item: null
          }
        });
        inventory.elements.set(slot.id, slot);
      }
    }
    const closeBtn = this.createElement({
      type: "button" /* BUTTON */,
      position: { x: 230, y: 5 },
      size: { x: 24, y: 24 },
      data: {
        icon: "close",
        action: "toggle_inventory"
      }
    });
    inventory.elements.set(closeBtn.id, closeBtn);
    this.interfaces.set("inventory", inventory);
  }
  /**
   * Create chat interface
   */
  createChatInterface() {
    const chat = {
      id: "chat",
      name: "Chat",
      elements: /* @__PURE__ */ new Map(),
      layout: "fixed",
      visible: true,
      alwaysVisible: true,
      position: { x: 10, y: -200 },
      // Bottom left
      size: { x: 500, y: 180 }
    };
    const chatBox = this.createElement({
      type: "chat_box" /* CHAT_BOX */,
      position: { x: 0, y: 0 },
      size: { x: 500, y: 150 },
      data: {
        messages: [],
        maxMessages: 100,
        tabs: ["All", "Game", "Public", "Private", "Clan", "Trade"]
      }
    });
    chat.elements.set(chatBox.id, chatBox);
    const inputField = this.createElement({
      type: "text" /* TEXT */,
      position: { x: 0, y: 155 },
      size: { x: 500, y: 25 },
      interactive: true,
      data: {
        placeholder: "Press Enter to chat...",
        maxLength: 128,
        editable: true
      }
    });
    chat.elements.set(inputField.id, inputField);
    this.interfaces.set("chat", chat);
  }
  /**
   * Create bank interface
   */
  createBankInterface() {
    const bank = {
      id: "bank",
      name: "Bank",
      elements: /* @__PURE__ */ new Map(),
      layout: "tabs",
      visible: false,
      position: { x: 100, y: 50 },
      size: { x: 600, y: 400 }
    };
    for (let i = 0; i < 9; i++) {
      const tab = this.createElement({
        type: "button" /* BUTTON */,
        position: { x: 10 + i * 60, y: 10 },
        size: { x: 50, y: 30 },
        data: {
          text: i === 0 ? "All" : `Tab ${i}`,
          tabIndex: i,
          action: "switch_bank_tab"
        }
      });
      bank.elements.set(tab.id, tab);
    }
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        const slot = this.createElement({
          type: "inventory_slot" /* INVENTORY_SLOT */,
          position: {
            x: 10 + col * 70,
            y: 50 + row * 50
          },
          size: { x: 64, y: 44 },
          data: {
            slotIndex: row * 8 + col,
            item: null,
            isBank: true
          }
        });
        bank.elements.set(slot.id, slot);
      }
    }
    const closeBtn = this.createElement({
      type: "button" /* BUTTON */,
      position: { x: 560, y: 10 },
      size: { x: 30, y: 30 },
      data: {
        icon: "close",
        action: "close_bank"
      }
    });
    bank.elements.set(closeBtn.id, closeBtn);
    this.interfaces.set("bank", bank);
  }
  /**
   * Create shop interface
   */
  createShopInterface() {
    const shop = {
      id: "shop",
      name: "Shop",
      elements: /* @__PURE__ */ new Map(),
      layout: "fixed",
      visible: false,
      position: { x: 150, y: 100 },
      size: { x: 500, y: 350 }
    };
    const title = this.createElement({
      type: "text" /* TEXT */,
      position: { x: 10, y: 10 },
      size: { x: 480, y: 30 },
      data: {
        text: "General Store",
        fontSize: 20,
        align: "center"
      }
    });
    shop.elements.set(title.id, title);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 5; col++) {
        const slot = this.createElement({
          type: "inventory_slot" /* INVENTORY_SLOT */,
          position: {
            x: 10 + col * 95,
            y: 50 + row * 35
          },
          size: { x: 90, y: 30 },
          data: {
            slotIndex: row * 5 + col,
            item: null,
            isShop: true,
            showPrice: true
          }
        });
        shop.elements.set(slot.id, slot);
      }
    }
    const closeBtn = this.createElement({
      type: "button" /* BUTTON */,
      position: { x: 460, y: 10 },
      size: { x: 30, y: 30 },
      data: {
        icon: "close",
        action: "close_shop"
      }
    });
    shop.elements.set(closeBtn.id, closeBtn);
    this.interfaces.set("shop", shop);
  }
  /**
   * Create quest interface
   */
  createQuestInterface() {
    const quest = {
      id: "quest",
      name: "Quest Journal",
      elements: /* @__PURE__ */ new Map(),
      layout: "list",
      visible: false,
      position: { x: 200, y: 50 },
      size: { x: 400, y: 500 }
    };
    const questList = this.createElement({
      type: "panel" /* PANEL */,
      position: { x: 10, y: 40 },
      size: { x: 380, y: 450 },
      data: {
        scrollable: true,
        quests: []
      }
    });
    quest.elements.set(questList.id, questList);
    this.interfaces.set("quest", quest);
  }
  /**
   * Create skills interface
   */
  createSkillsInterface() {
    const skills = {
      id: "skills",
      name: "Skills",
      elements: /* @__PURE__ */ new Map(),
      layout: "grid",
      visible: false,
      position: { x: -280, y: 50 },
      size: { x: 260, y: 400 }
    };
    const skillNames = [
      "Attack",
      "Strength",
      "Defence",
      "Ranged",
      "Prayer",
      "Magic",
      "Runecraft",
      "Construction",
      "Hitpoints",
      "Agility",
      "Herblore",
      "Thieving",
      "Crafting",
      "Fletching",
      "Slayer",
      "Hunter",
      "Mining",
      "Smithing",
      "Fishing",
      "Cooking",
      "Firemaking",
      "Woodcutting",
      "Farming"
    ];
    skillNames.forEach((skill, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const skillIcon = this.createElement({
        type: "icon" /* ICON */,
        position: {
          x: 10 + col * 80,
          y: 40 + row * 45
        },
        size: { x: 75, y: 40 },
        data: {
          skill: skill.toLowerCase(),
          level: 1,
          experience: 0,
          showTooltip: true
        }
      });
      skills.elements.set(skillIcon.id, skillIcon);
    });
    this.interfaces.set("skills", skills);
  }
  /**
   * Create context menu
   */
  createContextMenu() {
    const contextMenu = {
      id: "context_menu",
      name: "Context Menu",
      elements: /* @__PURE__ */ new Map(),
      layout: "vertical",
      visible: false,
      position: { x: 0, y: 0 },
      size: { x: 150, y: 0 }
      // Height calculated dynamically
    };
    this.interfaces.set("context_menu", contextMenu);
  }
  /**
   * Create settings interface
   */
  createSettingsInterface() {
    const settings = {
      id: "settings",
      name: "Settings",
      elements: /* @__PURE__ */ new Map(),
      layout: "tabs",
      visible: false,
      position: { x: 150, y: 50 },
      size: { x: 500, y: 400 }
    };
    const categories = ["Graphics", "Audio", "Controls", "Gameplay"];
    categories.forEach((category, index) => {
      const tab = this.createElement({
        type: "button" /* BUTTON */,
        position: { x: 10 + index * 120, y: 10 },
        size: { x: 110, y: 30 },
        data: {
          text: category,
          action: "switch_settings_tab"
        }
      });
      settings.elements.set(tab.id, tab);
    });
    this.interfaces.set("settings", settings);
  }
  /**
   * Create UI element
   */
  createElement(options) {
    return {
      id: `ui_element_${this.elementIdCounter++}`,
      type: options.type || "panel" /* PANEL */,
      position: options.position || { x: 0, y: 0 },
      size: options.size || { x: 100, y: 100 },
      visible: options.visible !== false,
      interactive: options.interactive !== false,
      layer: options.layer || 0,
      children: options.children || [],
      data: options.data || {}
    };
  }
  /**
   * Handle player connect
   */
  handlePlayerConnect(data) {
    const player = this.world.entities.get(data.playerId);
    if (!player) return;
    const uiComponent = {
      type: "ui",
      elements: /* @__PURE__ */ new Map(),
      activeInterface: void 0,
      hoveredElement: void 0,
      focusedElement: void 0
    };
    player.addComponent("ui", uiComponent);
    this.showInterface(data.playerId, "hud");
    this.showInterface(data.playerId, "chat");
  }
  /**
   * Handle player disconnect
   */
  handlePlayerDisconnect(data) {
  }
  /**
   * Show interface
   */
  showInterface(playerId, interfaceId) {
    const player = this.world.entities.get(playerId);
    if (!player) return;
    const uiComponent = player.getComponent("ui");
    if (!uiComponent) return;
    const ui = this.interfaces.get(interfaceId);
    if (!ui) return;
    this.activeInterfaces.add(interfaceId);
    uiComponent.activeInterface = interfaceId;
    this.world.events.emit("ui:interface_shown", {
      playerId,
      interfaceId
    });
  }
  /**
   * Hide interface
   */
  hideInterface(playerId, interfaceId) {
    const player = this.world.entities.get(playerId);
    if (!player) return;
    const uiComponent = player.getComponent("ui");
    if (!uiComponent) return;
    this.activeInterfaces.delete(interfaceId);
    if (uiComponent.activeInterface === interfaceId) {
      uiComponent.activeInterface = void 0;
    }
    this.world.events.emit("ui:interface_hidden", {
      playerId,
      interfaceId
    });
  }
  /**
   * Toggle interface
   */
  toggleInterface(playerId, interfaceId) {
    if (this.activeInterfaces.has(interfaceId)) {
      this.hideInterface(playerId, interfaceId);
    } else {
      this.showInterface(playerId, interfaceId);
    }
  }
  /**
   * Handle click
   */
  handleClick(data) {
    const element = this.findElement(data.elementId);
    if (!element || !element.interactive) return;
    if (element.data.action) {
      this.handleAction(data.playerId, element.data.action, element);
    }
    this.world.events.emit("ui:element_clicked", {
      playerId: data.playerId,
      element,
      button: data.button
    });
  }
  /**
   * Handle hover
   */
  handleHover(data) {
    const player = this.world.entities.get(data.playerId);
    if (!player) return;
    const uiComponent = player.getComponent("ui");
    if (!uiComponent) return;
    uiComponent.hoveredElement = data.elementId || void 0;
    if (data.elementId) {
      const element = this.findElement(data.elementId);
      if (element?.data.showTooltip) {
        this.showTooltip(data.playerId, element);
      }
    } else {
      this.hideTooltip(data.playerId);
    }
  }
  /**
   * Handle drag
   */
  handleDrag(data) {
    const element = this.findElement(data.elementId);
    if (!element || !element.data.draggable) return;
    this.world.events.emit("ui:element_dragged", {
      playerId: data.playerId,
      element,
      start: data.start,
      end: data.end
    });
  }
  /**
   * Find element by ID
   */
  findElement(elementId) {
    for (const ui of this.interfaces.values()) {
      const element = ui.elements.get(elementId);
      if (element) return element;
    }
    return null;
  }
  /**
   * Handle UI action
   */
  handleAction(playerId, action, element) {
    switch (action) {
      case "toggle_inventory":
        this.toggleInterface(playerId, "inventory");
        break;
      case "close_bank":
        this.hideInterface(playerId, "bank");
        break;
      case "close_shop":
        this.hideInterface(playerId, "shop");
        break;
      case "switch_bank_tab":
        this.switchBankTab(playerId, element.data.tabIndex);
        break;
      case "switch_settings_tab":
        this.switchSettingsTab(playerId, element.data.text);
        break;
      default:
        console.warn(`[UISystem] Unknown action: ${action}`);
    }
  }
  /**
   * Switch bank tab
   */
  switchBankTab(playerId, tabIndex) {
    this.world.events.emit("bank:switch_tab", {
      playerId,
      tabIndex
    });
  }
  /**
   * Switch settings tab
   */
  switchSettingsTab(playerId, category) {
  }
  /**
   * Show tooltip
   */
  showTooltip(playerId, element) {
  }
  /**
   * Hide tooltip
   */
  hideTooltip(playerId) {
  }
  /**
   * Update UI element
   */
  updateElement(elementId, updates) {
    const element = this.findElement(elementId);
    if (!element) return;
    Object.assign(element, updates);
    this.world.events.emit("ui:element_updated", {
      elementId,
      updates
    });
  }
  /**
   * Update HUD
   */
  updateHUD(playerId, data) {
    const player = this.world.entities.get(playerId);
    if (!player) return;
  }
  /**
   * Add chat message
   */
  addChatMessage(message) {
    const chat = this.interfaces.get("chat");
    if (!chat) return;
    const chatBox = Array.from(chat.elements.values()).find((e) => e.type === "chat_box" /* CHAT_BOX */);
    if (!chatBox) return;
    chatBox.data.messages.push({
      ...message,
      timestamp: message.timestamp || Date.now()
    });
    if (chatBox.data.messages.length > chatBox.data.maxMessages) {
      chatBox.data.messages.shift();
    }
    this.world.events.emit("chat:message_added", message);
  }
  /**
   * Show context menu
   */
  showContextMenu(playerId, position, options) {
    const contextMenu = this.interfaces.get("context_menu");
    if (!contextMenu) return;
    contextMenu.elements.clear();
    options.forEach((option, index) => {
      const button = this.createElement({
        type: "button" /* BUTTON */,
        position: { x: 0, y: index * 25 },
        size: { x: 150, y: 25 },
        data: {
          text: option,
          action: `context_${option.toLowerCase().replace(" ", "_")}`
        }
      });
      contextMenu.elements.set(button.id, button);
    });
    contextMenu.position = position;
    contextMenu.size.y = options.length * 25;
    contextMenu.visible = true;
    this.showInterface(playerId, "context_menu");
  }
  /**
   * Get active interfaces for player
   */
  getActiveInterfaces(playerId) {
    const player = this.world.entities.get(playerId);
    if (!player) return [];
    const uiComponent = player.getComponent("ui");
    if (!uiComponent) return [];
    return Array.from(this.activeInterfaces);
  }
  /**
   * Serialize UI state
   */
  serialize() {
    return {
      interfaces: Object.fromEntries(
        Array.from(this.interfaces.entries()).map(([id, ui]) => [
          id,
          {
            ...ui,
            elements: Object.fromEntries(ui.elements)
          }
        ])
      ),
      activeInterfaces: Array.from(this.activeInterfaces),
      theme: this.theme
    };
  }
  /**
   * Deserialize UI state
   */
  deserialize(data) {
    if (data.interfaces) {
      this.interfaces = new Map(
        Object.entries(data.interfaces).map(([id, ui]) => [
          id,
          {
            ...ui,
            elements: new Map(Object.entries(ui.elements || {}))
          }
        ])
      );
    }
    if (data.activeInterfaces) {
      this.activeInterfaces = new Set(data.activeInterfaces);
    }
    if (data.theme) {
      this.theme = data.theme;
    }
  }
  /**
   * Update loop
   */
  update(_delta) {
  }
  /**
   * Set up keybinding listener
   */
  setupKeybindingListener() {
    window.addEventListener("rpg:keybinding", (event) => {
      const { action, pressed } = event.detail;
      this.handleKeybinding(action, pressed);
    });
  }
  /**
   * Handle keybinding action
   */
  handleKeybinding(action, pressed) {
    if (pressed) {
      switch (action) {
        case "toggle_inventory":
          this.toggleWindow("inventory");
          break;
        case "toggle_bank":
          this.toggleWindow("bank");
          break;
        case "toggle_skills":
          this.toggleWindow("skills");
          break;
        case "toggle_quest_journal":
          this.toggleWindow("quest");
          break;
        case "toggle_world_map":
          this.toggleWindow("worldMap");
          break;
        case "toggle_prayer":
          this.toggleWindow("prayer");
          break;
        case "toggle_options":
          this.toggleWindow("settings");
          break;
        case "close_all_windows":
          this.closeAllWindows();
          break;
        case "open_chat":
          this.focusChat();
          break;
      }
    }
    if (action.startsWith("move_") || action === "run") {
      this.handleMovement(action, pressed);
    }
    if (pressed && action.startsWith("skill_")) {
      this.handleSkillAction(action);
    }
    if (pressed && action.startsWith("combat_style_")) {
      this.handleCombatStyle(action);
    }
    this.world.events.emit("ui:keybinding", { action, pressed });
  }
  /**
   * Toggle a window
   */
  toggleWindow(windowName) {
    const iface = this.interfaces.get(windowName);
    if (iface && !iface.alwaysVisible) {
      iface.visible = !iface.visible;
      if (iface.visible) {
        this.activeInterfaces.add(windowName);
      } else {
        this.activeInterfaces.delete(windowName);
      }
    }
  }
  /**
   * Close all windows
   */
  closeAllWindows() {
    this.interfaces.forEach((iface, name) => {
      if (!iface.alwaysVisible) {
        iface.visible = false;
        this.activeInterfaces.delete(name);
      }
    });
  }
  /**
   * Focus chat
   */
  focusChat() {
    const chatInterface = this.interfaces.get("chat");
    if (chatInterface) {
      chatInterface.visible = true;
      this.activeInterfaces.add("chat");
    }
  }
  /**
   * Handle movement keys
   */
  handleMovement(action, pressed) {
    if (!this.keybindingSystem) return;
    const localPlayerId = this.getLocalPlayerId();
    if (!localPlayerId) return;
    const player = this.world.entities.get(localPlayerId);
    if (!player) return;
    const movement = this.world.getSystem("movement");
    if (!movement) return;
    const moveState = this.keybindingSystem.getActiveMovement();
    let dx = 0, dz = 0;
    if (moveState.forward) dz += 1;
    if (moveState.backward) dz -= 1;
    if (moveState.left) dx -= 1;
    if (moveState.right) dx += 1;
    if (dx !== 0 && dz !== 0) {
      const mag = Math.sqrt(dx * dx + dz * dz);
      dx /= mag;
      dz /= mag;
    }
    if (dx !== 0 || dz !== 0) {
      const speed = moveState.run ? 2 : 1;
      const position = player.position;
      if (position) {
        const newPosition = {
          x: position.x + dx * speed,
          y: position.y,
          z: position.z + dz * speed
        };
        movement.moveEntity(player, newPosition);
      }
    }
  }
  /**
   * Get local player ID
   */
  getLocalPlayerId() {
    for (const [id, entity] of this.world.entities) {
      if (entity.type === "player") {
        return id;
      }
    }
    return null;
  }
  /**
   * Handle skill actions
   */
  handleSkillAction(action) {
    const localPlayerId = this.getLocalPlayerId();
    if (!localPlayerId) return;
    const player = this.world.entities.get(localPlayerId);
    if (!player) return;
    switch (action) {
      case "skill_woodcutting":
        this.performNearestAction("tree", "chop");
        break;
      case "skill_mining":
        this.performNearestAction("rock", "mine");
        break;
      case "skill_fishing":
        this.performNearestAction("fishing_spot", "fish");
        break;
    }
  }
  /**
   * Perform action on nearest entity
   */
  performNearestAction(entityType, action) {
    const localPlayerId = this.getLocalPlayerId();
    if (!localPlayerId) return;
    const player = this.world.entities.get(localPlayerId);
    if (!player) return;
    const playerPos = player.position;
    if (!playerPos) return;
    let nearest = null;
    let nearestDist = Infinity;
    for (const [id, entity] of this.world.entities) {
      if (entity.type === entityType) {
        const entityPos = entity.position;
        if (entityPos) {
          const dist = this.getDistance(playerPos, entityPos);
          if (dist < nearestDist) {
            nearest = entity;
            nearestDist = dist;
          }
        }
      }
    }
    if (nearest && nearestDist < 10) {
      this.world.events.emit("ui:interact", {
        playerId: localPlayerId,
        entity: nearest,
        action
      });
    }
  }
  /**
   * Handle combat style
   */
  handleCombatStyle(action) {
    const localPlayerId = this.getLocalPlayerId();
    if (!localPlayerId) return;
    const style = action.replace("combat_style_", "");
    const combat = this.world.getSystem("combat");
    if (combat && typeof combat.setCombatStyle === "function") {
      const player = this.world.entities.get(localPlayerId);
      if (player) {
        combat.setCombatStyle(player, style);
      }
    }
  }
  /**
   * Get distance between positions
   */
  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  /**
   * Get keybinding system
   */
  getKeybindingSystem() {
    return this.keybindingSystem;
  }
};

// src/rpg/index.ts
init_RPGWorldManager();
var HyperfyRPGPlugin = {
  name: "hyperfy-rpg",
  description: "RuneScape-style RPG mechanics for Hyperfy",
  systems: [],
  /**
   * Initialize the RPG plugin with the given world
   */
  async init(world, config) {
    console.log("[HyperfyRPGPlugin] Initializing RPG plugin...", {
      worldType: config?.worldType || "unknown",
      isServer: config?.isServer || false,
      systems: config?.systems || []
    });
    const systems = [
      { name: "stats", system: StatsSystem },
      { name: "movement", system: MovementSystem },
      { name: "combat", system: CombatSystem },
      { name: "inventory", system: InventorySystem },
      { name: "quest", system: QuestSystem },
      { name: "skills", system: SkillsSystem },
      { name: "banking", system: BankingSystem },
      { name: "trading", system: TradingSystem },
      { name: "navigation", system: NavigationSystem },
      { name: "loot", system: LootSystem },
      { name: "spawning", system: SpawningSystem },
      { name: "npc", system: NPCSystem },
      { name: "deathRespawn", system: DeathRespawnSystem },
      { name: "pvp", system: PvPSystem },
      { name: "shop", system: ShopSystem },
      { name: "grandExchange", system: GrandExchangeSystem },
      { name: "prayer", system: PrayerSystem },
      { name: "magic", system: MagicSystem },
      { name: "construction", system: ConstructionSystem },
      { name: "minigame", system: MinigameSystem },
      { name: "clan", system: ClanSystem },
      { name: "visualRepresentation", system: VisualRepresentationSystem },
      { name: "agentPlayer", system: AgentPlayerSystem },
      { name: "itemSpawn", system: ItemSpawnSystem },
      { name: "resourceSpawn", system: ResourceSpawnSystem },
      { name: "ui", system: UISystem }
    ];
    for (const { name, system } of systems) {
      try {
        world.register?.(name, system);
        console.log(`[HyperfyRPGPlugin] Registered ${name} system`);
      } catch (error) {
        console.error(`[HyperfyRPGPlugin] Failed to register ${name} system:`, error);
      }
    }
    ;
    world.rpgSystems = {};
    for (const { name } of systems) {
      const systemInstance = world.getSystem?.(name);
      if (systemInstance) {
        ;
        world.rpgSystems[name] = systemInstance;
      }
    }
    console.log("[HyperfyRPGPlugin] RPG plugin initialized successfully with", Object.keys(world.rpgSystems || {}).length, "systems");
  }
};

// ugc-apps/rpg/index.ts
async function init(world, config) {
  console.log("[RPG UGC App] Initializing RPG world...");
  const rpgConfig = {
    worldType: config?.worldType || "rpg",
    isServer: true,
    systems: manifest.capabilities.systems
  };
  await HyperfyRPGPlugin.init(world, rpgConfig);
  console.log("[RPG UGC App] RPG world initialized successfully");
}
async function destroy() {
  console.log("[RPG UGC App] Cleaning up RPG world...");
}
function getCapabilities() {
  return {
    actions: manifest.capabilities.actions,
    providers: manifest.capabilities.providers,
    systems: manifest.capabilities.systems,
    evaluators: manifest.capabilities.evaluators
  };
}
export {
  destroy,
  getCapabilities,
  init,
  manifest
};
/*! Bundled license information:

lodash-es/lodash.js:
  (**
   * @license
   * Lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="es" -o ./`
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)
*/
//# sourceMappingURL=bundle.js.map
