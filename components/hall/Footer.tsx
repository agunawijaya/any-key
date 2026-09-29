import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        <strong>Any Key</strong> is an open-source love letter to the programs people typed into
        home computers. Original programs belong to their publishers; this project is not affiliated
        with them.
      </p>
      <p className={styles.hint}>
        <kbd>A</kbd>–<kbd>Z</kbd> make noise · <kbd>Tab</kbd> moves around
      </p>
    </footer>
  );
}
