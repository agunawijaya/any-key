"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import styles from "./ForgetButton.module.css";

type Props = {
  gameTitle: string;
  /** What else stays, for the question ("Your flag stays."). */
  keeps?: string;
  onForget: () => void;
  className?: string;
};

/** "Forget my data" for one game, asked first in the collection's own dialog. */
export function ForgetButton({ gameTitle, keeps, onForget, className }: Props) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setAsking(true)}>
        Forget my data
      </button>
      {asking && (
        <Dialog title={`Forget ${gameTitle}?`} size="confirm" role="alertdialog" onClose={() => setAsking(false)}>
          <p className={styles.question}>
            Its progress, its keycaps and its dailies go from this browser. {keeps ?? ""} This can&rsquo;t be undone.
          </p>
          <div className={styles.answers}>
            <button type="button" className={styles.keep} data-autofocus onClick={() => setAsking(false)}>
              Keep it
            </button>
            <button
              type="button"
              className={styles.forget}
              onClick={() => {
                onForget();
                setAsking(false);
              }}
            >
              Forget
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
