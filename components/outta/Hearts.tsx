import { HeartIcon } from "@/components/kit/icons";

/** Hearts left, drawn; an endless supply (Chill) shows one heart and the infinity sign. */
export function Hearts({ count }: { count: number }) {
  if (!Number.isFinite(count)) {
    return (
      <span aria-hidden>
        <HeartIcon size={15} /> ∞
      </span>
    );
  }
  if (count <= 0) return <span aria-hidden>–</span>;
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 2, verticalAlign: "-0.15em" }}>
      {Array.from({ length: count }, (_, i) => (
        <HeartIcon key={i} size={15} />
      ))}
    </span>
  );
}
