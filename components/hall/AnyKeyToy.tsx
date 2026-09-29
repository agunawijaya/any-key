"use client";

import { useEffect, useRef } from "react";
import { noteForKey, pluck } from "@/lib/sound";
import { getPrefs } from "@/lib/use-prefs";
import styles from "./AnyKeyToy.module.css";

const COLORS = ["var(--lime)", "var(--pink)", "var(--blue)", "var(--orange)", "var(--violet)", "var(--cyan)"];
const SHAPES = ["dot", "square", "star", "ring", "bar"];
const MAX_KEYCAPS = 14;

/** Lets on-screen keycaps (touch screens have no keyboard) join the fun. */
export function pressAnyKey(key: string) {
  window.dispatchEvent(new CustomEvent<string>("anykey", { detail: key }));
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function AnyKeyToy() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let releaseTimer = 0;

    function burst(key: string) {
      const root = document.documentElement;
      root.dataset.pressed = "";
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => delete root.dataset.pressed, 130);

      if (getPrefs().sound) pluck(noteForKey(key));

      const host = layer.current;
      if (!host || reduceMotion.matches) return;
      while (host.childElementCount > MAX_KEYCAPS * 7) host.firstElementChild?.remove();

      const x = 8 + Math.random() * 84;
      const y = 22 + Math.random() * 62;
      const color = pick(COLORS);

      const cap = document.createElement("span");
      cap.className = styles.keycap;
      cap.textContent = key.toUpperCase();
      cap.style.cssText = `left:${x}vw;top:${y}vh;--c:${color};--r:${(Math.random() * 30 - 15).toFixed(1)}deg`;
      cap.addEventListener("animationend", () => cap.remove());
      host.append(cap);

      for (let i = 0; i < 6; i++) {
        const bit = document.createElement("span");
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
        const distance = 70 + Math.random() * 70;
        bit.className = `${styles.bit} ${styles[pick(SHAPES)]}`;
        bit.style.cssText = `left:${x}vw;top:${y}vh;--c:${pick(COLORS)};--dx:${(Math.cos(angle) * distance).toFixed(0)}px;--dy:${(Math.sin(angle) * distance).toFixed(0)}px;--r:${Math.round(Math.random() * 360)}deg`;
        bit.addEventListener("animationend", () => bit.remove());
        host.append(bit);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!/^[a-z0-9]$/i.test(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      burst(event.key);
    }

    const onVirtualKey = (event: Event) => burst((event as CustomEvent<string>).detail);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("anykey", onVirtualKey);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("anykey", onVirtualKey);
      window.clearTimeout(releaseTimer);
    };
  }, []);

  return <div ref={layer} className={styles.layer} aria-hidden />;
}
