"use client";

import { useMemo } from "react";
import { useDarkAppearance } from "@/components/two-humps/hooks";
import { SceneCanvas } from "@/components/two-humps/SceneCanvas";
import { demoScene } from "@/components/two-humps/scene/demo";
import styles from "./TwoHumpsPreview.module.css";

/** The camel trekking on for ever: the Haboob behind it on a golden morning, or the Ladle Gang after dark. */
export function TwoHumpsPreview() {
  const dark = useDarkAppearance();
  const scene = useMemo(() => (dark ? demoScene("gang", 21.5, { seed: 7 }) : demoScene("haboob", 7.1, { seed: 7 })), [dark]);
  return (
    <div className={styles.preview}>
      <SceneCanvas
        className={styles.canvas}
        hooks={scene.hooks}
        frame={scene.frame}
        seed={404}
        label={dark ? "Animated preview: a camel walks through the Gobi at night, with a gang of jerboas hopping behind" : "Animated preview: a camel walks across golden dunes with a wall of sand rolling in behind"}
      />
    </div>
  );
}
