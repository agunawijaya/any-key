"use client";

import { Dialog } from "./Dialog";
import { onMenuArrows } from "./hooks";
import { BookIcon, GearIcon, HallIcon, MenuIcon, PlayIcon, RestartIcon } from "./icons";
import type { PauseItem } from "./shell-context";
import styles from "./PauseMenu.module.css";

type Props = {
  gameTitle: string;
  items: PauseItem[];
  onResume: () => void;
  onHowToPlay: () => void;
  onSettings: () => void;
  onMenu: () => void;
  onHall: () => void;
};

/** The fixed order: Resume · the game's items · How to play · Settings · Game menu · Back to the Hall. */
export function PauseMenu({ gameTitle, items, onResume, onHowToPlay, onSettings, onMenu, onHall }: Props) {
  return (
    <Dialog title="Paused" kicker={gameTitle} className={styles.panel}>
      <div className={styles.list} role="group" aria-label="Pause menu" onKeyDown={onMenuArrows}>
        <Row primary icon={<PlayIcon size={18} />} label="Resume" shortcut="Esc" onSelect={onResume} autofocus />
        {items.length > 0 && (
          <div className={styles.gameItems}>
            {items.map((item) => (
              <Row key={item.label} icon={<RestartIcon size={18} />} label={item.label} shortcut={item.shortcut} onSelect={item.onSelect} />
            ))}
          </div>
        )}
        <Row icon={<BookIcon size={18} />} label="How to play" onSelect={onHowToPlay} />
        <Row icon={<GearIcon size={18} />} label="Settings" onSelect={onSettings} />
        <div className={styles.leave}>
          <Row icon={<MenuIcon size={18} />} label="Game menu" onSelect={onMenu} />
          <Row icon={<HallIcon size={18} />} label="Back to the Hall" onSelect={onHall} />
        </div>
      </div>
    </Dialog>
  );
}

type RowProps = { icon: React.ReactNode; label: string; shortcut?: string; onSelect: () => void; primary?: boolean; autofocus?: boolean };

function Row({ icon, label, shortcut, onSelect, primary, autofocus }: RowProps) {
  return (
    <button type="button" className={styles.row} data-primary={primary || undefined} data-autofocus={autofocus || undefined} onClick={onSelect}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      {shortcut && <kbd className={styles.key}>{shortcut}</kbd>}
    </button>
  );
}
