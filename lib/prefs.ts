export const HALL_STYLES = ["wall", "orbit", "device"] as const;

export type HallStyle = (typeof HALL_STYLES)[number];
export type ThemePref = "light" | "dark" | "system";

export type Prefs = {
  theme: ThemePref;
  hall: HallStyle;
  sound: boolean;
};

export const DEFAULT_PREFS: Prefs = { theme: "system", hall: "wall", sound: true };

export const PREF_KEYS = {
  theme: "anykey.theme",
  hall: "anykey.hall",
  sound: "anykey.sound",
} as const;

/**
 * Runs in <head> before first paint so the saved theme and hall style are on
 * <html> before anything renders (no flash of the wrong hall).
 */
export const PREFS_SCRIPT = `(function(){var d=document.documentElement,t="system",h=null;try{t=localStorage.getItem("${PREF_KEYS.theme}")||"system";h=localStorage.getItem("${PREF_KEYS.hall}")}catch(e){}var dark=t==="dark"||(t!=="light"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);d.setAttribute("data-theme",dark?"dark":"light");d.setAttribute("data-theme-pref",t);if(${JSON.stringify(HALL_STYLES)}.indexOf(h)>-1)d.setAttribute("data-hall",h)})()`;
