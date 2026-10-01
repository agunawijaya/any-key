import { LEVELS, type Settings } from "./levels";

/*
 * Screens: thirty screens on five old computers. Each computer teaches one
 * thing, most of them taken from the 1980 program's own bugs, and its six
 * screens get harder one step at a time. Every screen is a fixed seed, so it
 * is the same for everyone; scripts/check-outta.ts plays each one with
 * human-like bots to keep them all winnable.
 */

export type ComputerId = "green" | "amber" | "micro" | "lcd" | "last";

export type Computer = {
  id: ComputerId;
  name: string;
  era: string;
  twist: string;
  text: string;
};

export type Screen = {
  id: string;
  computer: ComputerId;
  index: number;
  seed: number;
  settings: Settings;
};

export const COMPUTERS: Computer[] = [
  { id: "green", name: "Green Screen", era: "1980 · green phosphor", twist: "The rain", text: "Blocks fall while you hesitate, and Bouncers guard the corridors. Learn to bomb glass and push wood." },
  { id: "amber", name: "Amber Terminal", era: "1982 · amber glow", twist: "Edge tunnels", text: "Off the right edge, in on the next row's left. The gaps sit at the ends: the tunnels are the quick way down." },
  { id: "micro", name: "Home Micro", era: "1983 · eight colours", twist: "Under the keys", text: "Pillars cut the top corridor. Step off the top row, walk under the keyboard and drop in past them. Glitch can't follow you there." },
  { id: "lcd", name: "Pocket LCD", era: "1989 · grey-green LCD", twist: "Falling sand", text: "Blocks slide down their column and pile up. Corridors fill from the bottom: stay high and move fast." },
  { id: "last", name: "The Last Machine", era: "the finale", twist: "Crash it", text: "There is no exit. The way out is the corner where the 1980 program crashed the computer: the bottom-left." },
];

const normal = LEVELS.normal;

function settingsFor(computer: ComputerId, i: number): Settings {
  const ramp = (from: number, to: number) => from + ((to - from) * i) / 5;
  const common: Settings = {
    ...normal,
    id: `${computer}-${i + 1}`,
    name: `${COMPUTERS.find((c) => c.id === computer)!.name} ${i + 1}`,
    blurb: COMPUTERS.find((c) => c.id === computer)!.twist,
    hearts: 3,
    prefill: 0.04,
    floors: i < 2 ? 3 : 4,
    rain: ramp(2.2, 3),
    bouncers: 2,
  };
  switch (computer) {
    case "green":
      return { ...common, floors: i < 2 ? 2 : i < 4 ? 3 : 4, rain: ramp(1.6, 2.6), bouncers: 1 + Math.floor(i / 2), eraser: null, glitch: null, par: 0 };
    case "amber":
      return { ...common, gapStyle: "ends", eraser: { delay: 7, step: ramp(0.34, 0.3) }, glitch: null, par: 0 };
    case "micro":
      return { ...common, pillars: 1 + Math.floor(i / 2), eraser: null, glitch: { delay: 6, step: ramp(0.4, 0.34) }, par: 0 };
    case "lcd":
      return { ...common, rainStyle: "sand", rain: ramp(2.4, 3.2), eraser: { delay: 7, step: ramp(0.34, 0.3) }, glitch: null, par: 0 };
    case "last":
      return {
        ...common,
        exitMode: "crash",
        floors: i < 3 ? 3 : 5,
        rain: ramp(2.6, 3.2),
        rainHits: i >= 3,
        eraser: { delay: 7, step: ramp(0.34, 0.3) },
        glitch: i >= 2 ? { delay: 8, step: 0.38 } : null,
        par: 0,
      };
  }
}

/*
 * Each screen's seed was picked by scripts/check-outta.ts's bots from a run of
 * candidates: the first one that was winnable enough for its place in the
 * order (and, on the Amber Terminal and the Home Micro, that made the bots use
 * that computer's trick). The par is the bots' median time plus a tenth,
 * rounded up to five seconds.
 */
const PICKS: Record<ComputerId, [seed: number, par: number][]> = {
  green: [[101, 25], [1101, 25], [2101, 35], [3101, 35], [4101, 65], [5101, 45]],
  amber: [[6139, 20], [7101, 35], [8102, 30], [9106, 40], [10109, 45], [11104, 50]],
  micro: [[12101, 40], [13101, 40], [14101, 70], [15101, 80], [16101, 65], [17101, 60]],
  lcd: [[18101, 40], [19101, 25], [20101, 65], [21101, 60], [22101, 50], [23101, 40]],
  last: [[24101, 35], [25101, 40], [26101, 40], [27106, 40], [28101, 60], [29105, 50]],
};

export const SCREENS: Screen[] = COMPUTERS.flatMap((c) =>
  PICKS[c.id].map(([seed, par], i) => {
    const settings = settingsFor(c.id, i);
    return { id: settings.id, computer: c.id, index: i, seed, settings: { ...settings, par } };
  }),
);

export const screenById = (id: string) => SCREENS.find((s) => s.id === id);

/** The screen after this one, if any. */
export const nextScreen = (id: string) => SCREENS[SCREENS.findIndex((s) => s.id === id) + 1];
