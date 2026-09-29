import styles from "./Sticker.module.css";

type Props = {
  children: React.ReactNode;
  color?: string;
  tilt?: number;
  className?: string;
};

export function Sticker({ children, color = "var(--surface)", tilt = 0, className = "" }: Props) {
  return (
    <span
      className={`${styles.sticker} ${className}`}
      style={{ "--sticker": color, "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      {children}
    </span>
  );
}
