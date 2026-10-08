"use client";

import { useEffect, useId, useRef } from "react";
import { useModalFocus } from "./hooks";
import { CloseIcon } from "./icons";
import styles from "./Dialog.module.css";

type Props = {
  title: React.ReactNode;
  /** Small line above the title. */
  kicker?: React.ReactNode;
  children: React.ReactNode;
  /** Shows a close button, and lets Esc close the dialog. */
  onClose?: () => void;
  size?: "menu" | "sheet" | "confirm";
  role?: "dialog" | "alertdialog";
  className?: string;
};

/**
 * A modal panel over the game. Focus moves in and stays in until it closes;
 * the backdrop dims the game but leaves the top bar visible.
 */
export function Dialog({ title, kicker, children, onClose, size = "menu", role = "dialog", className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(ref, true);

  // A dialog that can close takes Esc for itself; the page behind (the shell) leaves that press alone.
  useEffect(() => {
    if (!onClose) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className={styles.backdrop} data-size={size}>
      <div ref={ref} className={`${styles.panel} ${className}`} role={role} aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.head}>
          <div>
            {kicker && <p className={styles.kicker}>{kicker}</p>}
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          </div>
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <CloseIcon size={18} />
              <kbd>Esc</kbd>
            </button>
          )}
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
