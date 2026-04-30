/**
 * ModelThumbnail — small inline preview of a 3D model. Rendered
 * lazily via the singleton `modelThumbnailRenderer` so cards in
 * a grid can show actual model previews instead of generic
 * icons. While the render is in-flight (or before the card has
 * scrolled into view) the component renders a fallback element
 * supplied by the caller — typically a typed icon tile.
 *
 * Lazy load: an `IntersectionObserver` waits until the wrapper
 * is within ~200px of the viewport before kicking off the render.
 * Cards far below the fold don't burn GPU work; cards just below
 * the fold pre-render so they're ready by the time the user
 * scrolls.
 *
 * URL handling: identical to the singleton — `asset://` URLs are
 * proxy-resolved internally; HTTP and `/api/assets/.../model`
 * URLs pass through. Pass `null`/empty to render only the
 * fallback.
 */

import React, { useEffect, useRef, useState } from "react";

import { modelThumbnailRenderer } from "../../utils/modelThumbnailRenderer";

interface ModelThumbnailProps {
  /** Model URL — `asset://...`, HTTP URL, or `/api/assets/<id>/model`. */
  modelUrl: string | null | undefined;
  /**
   * Wrapper class — controls aspect/size/background. The rendered
   * `<img>` fills with `object-cover`; the fallback fills with
   * its own layout.
   */
  className?: string;
  /** Alt text for the rendered preview. */
  alt?: string;
  /**
   * Element to render while loading or when render fails. Usually
   * a typed-icon tile via `getTypeStyle()`. The fallback covers
   * the entire wrapper.
   */
  fallback: React.ReactNode;
  /** When true, skip lazy-loading and start rendering immediately. */
  eager?: boolean;
}

export function ModelThumbnail({
  modelUrl,
  className,
  alt = "",
  fallback,
  eager = false,
}: ModelThumbnailProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const [isVisible, setIsVisible] = useState(eager);

  // IntersectionObserver — flip `isVisible` once the wrapper is
  // near the viewport. We never flip back to false; once a card
  // has been seen, we keep its rendered preview.
  useEffect(() => {
    if (eager || isVisible) return;
    const node = wrapRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR / very old browser fallback — load immediately.
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, isVisible]);

  // Kick off render once visible + url available.
  useEffect(() => {
    if (!isVisible) return;
    if (!modelUrl) return;
    let cancelled = false;
    setErrored(false);
    modelThumbnailRenderer
      .get(modelUrl)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isVisible, modelUrl]);

  return (
    <div ref={wrapRef} className={className}>
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        fallback
      )}
    </div>
  );
}
