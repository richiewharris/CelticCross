// Links between the ways to play the lock, shown under each version's heading.
import { VARIANTS, type Version } from "../useVersion";

export function VariantNav({ current }: { current: Version }) {
  return (
    <nav className="variants" aria-label="Ways to play">
      {VARIANTS.map(x => (
        <a key={x.v} href={x.hash} aria-current={x.v === current ? "page" : undefined} title={x.blurb}>{x.label}</a>
      ))}
    </nav>
  );
}
