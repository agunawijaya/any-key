import styles from "./ShareText.module.css";

/*
 * A share text as it will read once pasted, drawn rather than typed. Share
 * texts use coloured-square emoji because the apps they are pasted into draw
 * them; on our own page those squares are drawn in our palette, so nothing on
 * screen is an emoji. The text itself, emoji and all, is what gets copied.
 */

const SQUARE_COLOURS: Record<string, string> = {
  "\u{1F7E9}": "var(--share-green)",
  "\u{1F7E8}": "var(--share-yellow)",
  "\u{1F7E6}": "var(--share-blue)",
  "\u{1F7E7}": "var(--share-orange)",
  "\u{1F7E5}": "var(--share-red)",
  "\u{1F7EA}": "var(--share-purple)",
  "\u{2B1B}": "var(--share-black)",
  "\u{2B1C}": "var(--share-white)",
};

const MARKS: Record<string, React.ReactNode> = {
  "\u{2795}": <path d="M8 2.5v11M2.5 8h11" />,
  "\u{2716}": <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
};

/** The variation selector that asks for emoji presentation; it draws nothing by itself. */
const EMOJI_STYLE = "\u{FE0F}";

export function ShareText({ text, className = "" }: { text: string; className?: string }) {
  const pieces: React.ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (plain) pieces.push(plain);
    plain = "";
  };

  for (const char of Array.from(text)) {
    if (char === EMOJI_STYLE) continue;
    if (SQUARE_COLOURS[char]) {
      flush();
      pieces.push(<span key={pieces.length} className={styles.square} style={{ background: SQUARE_COLOURS[char] }} />);
    } else if (MARKS[char]) {
      flush();
      pieces.push(
        <svg key={pieces.length} className={styles.mark} viewBox="0 0 16 16" aria-hidden>
          {MARKS[char]}
        </svg>,
      );
    } else plain += char;
  }
  flush();

  return (
    <pre className={`${styles.text} ${className}`} role="img" aria-label={text}>
      {pieces}
    </pre>
  );
}
