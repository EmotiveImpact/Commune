import { useLayoutEffect, useRef, useState } from "react";
import { coverSource, coverTone, type CoverHub, type CoverPlacement } from "../data/covers";
import { cx } from "./cx";

/** The class that gives a cover's container the calm tone for its commune type. */
export function coverToneClass(hub: CoverHub): string {
  return `c-cover-${coverTone(hub)}`;
}

/**
 * A commune's cover photo, filling its container. The container carries
 * coverToneClass(hub), so its tone shows while the photo loads; if the photo
 * cannot load, it is removed rather than left as a broken image. A photo
 * that has to be fetched fades up from that tone over the medium time once it
 * is decoded; one the browser already has is simply there.
 */
export function CoverImage({ hub, placement, className }: { hub: CoverHub; placement: CoverPlacement; className?: string }) {
  const source = coverSource(hub, placement);
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState("");
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setReady(source.src);
  }, [source.src]);
  if (failed === source.src) return null;
  return (
    <img
      ref={ref}
      className={cx("c-cover-photo", "c-fade-photo", ready === source.src && "is-ready", className)}
      src={source.src}
      srcSet={source.srcSet}
      sizes={source.sizes}
      alt=""
      decoding="async"
      onLoad={() => setReady(source.src)}
      onError={() => setFailed(source.src)}
    />
  );
}
