"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { games } from "@/lib/catalog";
import { setPrefs, type ThemePref } from "@/lib/kit/appearance";
import { levelOf, xpOf } from "@/lib/kit/keyring";
import { useHydrated, useKeyring, usePrefs } from "./hooks";
import { KeyringIcon, MoonIcon, SoundOffIcon, SoundOnIcon, SunIcon, SystemIcon } from "./icons";
import styles from "./BarTools.module.css";

/** The three tools at the right of every top bar: Keyring, sound, appearance. */
export function BarTools({ className = "", onKeyring }: { className?: string; onKeyring?: (event: React.MouseEvent) => void }) {
  return (
    <div className={`${styles.tools} ${className}`}>
      <KeyringButton onClick={onKeyring} />
      <SoundButton />
      <AppearanceMenu />
    </div>
  );
}

export function KeyringButton({ onClick }: { onClick?: (event: React.MouseEvent) => void }) {
  const keyring = useKeyring();
  const hydrated = useHydrated();
  const { level } = levelOf(xpOf(keyring, games));
  return (
    <Link href="/keyring" className={`${styles.tool} ${styles.keyring}`} aria-label={hydrated ? `Keyring, level ${level}` : "Keyring"} title="Keyring (K)" onClick={onClick}>
      <KeyringIcon size={22} />
      <span className={styles.label}>Keyring</span>
      {hydrated && <span className={styles.level}>{level}</span>}
    </Link>
  );
}

export function SoundButton() {
  const { sound } = usePrefs();
  return (
    <button
      type="button"
      className={styles.tool}
      aria-pressed={sound}
      aria-label={sound ? "Sound on" : "Sound off"}
      title={sound ? "Sound on: click to mute" : "Sound off: click to turn on"}
      onClick={() => setPrefs({ sound: !sound })}
    >
      {sound ? <SoundOnIcon size={22} /> : <SoundOffIcon size={22} />}
    </button>
  );
}

const THEMES: { id: ThemePref; label: string; Icon: typeof SunIcon }[] = [
  { id: "light", label: "Light", Icon: SunIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "system", label: "System", Icon: SystemIcon },
];

export function AppearanceMenu() {
  const { theme } = usePrefs();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[2];

  useEffect(() => {
    if (!open) return;
    const first = rootRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    first?.focus();
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function onMenuKey(event: React.KeyboardEvent) {
    const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      // The menu, not the page, owns this Esc.
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function choose(id: ThemePref) {
    setPrefs({ theme: id });
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={styles.menuRoot}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.tool}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Appearance: ${current.label}`}
        title="Appearance"
        onClick={() => setOpen((v) => !v)}
      >
        <current.Icon size={22} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Appearance" className={styles.menu} onKeyDown={onMenuKey}>
          {THEMES.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="menuitemradio" aria-checked={theme === id} className={styles.item} onClick={() => choose(id)}>
              <Icon size={18} />
              <span>{label}</span>
              {id === "system" && <small>follows your device</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
