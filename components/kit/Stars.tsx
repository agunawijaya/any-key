import { StarIcon } from "./icons";
import styles from "./Stars.module.css";

/** A star rating drawn as icons: earned stars in the current colour, the rest faint. */
export function Stars({ value, max = 3, size = 16, className = "" }: { value: number; max?: number; size?: number; className?: string }) {
  return (
    <span className={`${styles.stars} ${className}`} role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} size={size} filled={i < value} className={i < value ? styles.on : styles.off} />
      ))}
    </span>
  );
}
