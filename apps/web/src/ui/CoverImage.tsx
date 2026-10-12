import { useState } from "react";
import { coverSource, coverTone, type CoverHub, type CoverPlacement } from "../data/covers";
import { cx } from "./cx";

/** The class that gives a cover's container the calm tone for its commune type. */
export function coverToneClass(hub: CoverHub): string {
  return `c-cover-${coverTone(hub)}`;
}

/**
 * A commune's cover photo, filling its container. The container carries
 * coverToneClass(hub), so its tone shows while the photo loads; if the photo
 * cannot load, it is removed rather than left as a broken image.
 */
export function CoverImage({ hub, placement, className }: { hub: CoverHub; placement: CoverPlacement; className?: string }) {
  const source = coverSource(hub, placement);
  const [failed, setFailed] = useState("");
  if (failed === source.src) return null;
  return (
    <img
      className={cx("c-cover-photo", className)}
      src={source.src}
      srcSet={source.srcSet}
      sizes={source.sizes}
      alt=""
      decoding="async"
      onError={() => setFailed(source.src)}
    />
  );
}
