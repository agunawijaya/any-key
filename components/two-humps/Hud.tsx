import type { Units } from "@/lib/two-humps/progress";
import type { PursuerKind } from "@/lib/two-humps/rules";
import { CampIcon, CanteenIcon, DropIcon, GallopIcon, HumpIcon, LadleIcon, OasisIcon, PennantIcon, ReinsIcon, ScanIcon, SignalIcon, StormIcon, WalkIcon } from "./icons";
import styles from "./Hud.module.css";

/*
 * The trek's chrome: the route across the top, what's left in the canteen
 * and the camel, the six commands along the bottom, and the meter that shows
 * when the camel is running on by itself. Every number a player decides on is
 * printed; nothing is hidden but the dice.
 */

const PURSUER_ICON: Record<PursuerKind, (p: { size?: number }) => React.ReactNode> = {
  haboob: StormIcon,
  rival: PennantIcon,
  gang: LadleIcon,
};

const PURSUER_SHORT: Record<PursuerKind, string> = {
  haboob: "The Haboob",
  rival: "The rival",
  gang: "The Ladle Gang",
};

const KM = 1.609344;

type RouteProps = {
  miles: number;
  pursuer: PursuerKind;
  pursuerAt: number;
  /** Oases you know of, by mile. */
  oases: number[];
  /** Oases the rival has drunk dry. */
  dry?: number[];
  goal?: number;
  units?: Units;
};

export function RouteStrip({ miles, pursuer, pursuerAt, oases, dry = [], goal = 40, units = "mi" }: RouteProps) {
  const at = (m: number) => `${(Math.max(0, Math.min(goal, m)) / goal) * 100}%`;
  const show = (m: number) => Math.round(units === "km" ? m * KM : m);
  const Pursuer = PURSUER_ICON[pursuer];
  const rival = pursuer === "rival";
  const gap = rival ? pursuerAt - miles : miles - pursuerAt;
  const gapText = rival ? (gap > 0 ? `${show(gap)} ${units} ahead of you` : `${show(-gap)} ${units} behind you`) : `${show(Math.max(0, gap))} ${units} behind`;
  return (
    <div className={styles.route} role="img" aria-label={`${show(miles)} of ${show(goal)} ${units}. ${PURSUER_SHORT[pursuer]} is ${gapText}.`}>
      <p className={styles.routeMiles}>
        <strong>{show(miles)}</strong>
        <span>
          of {show(goal)} {units}
        </span>
      </p>
      <div className={styles.track}>
        <div className={styles.done} style={{ width: at(miles) }} />
        {!rival && pursuerAt < miles && <div className={styles.danger} style={{ left: at(pursuerAt), width: `calc(${at(miles)} - ${at(pursuerAt)})` }} />}
        {Array.from({ length: goal / 5 + 1 }, (_, i) => (
          <span key={i} className={styles.tick} style={{ left: at(i * 5) }} data-major={i % 2 === 0 || undefined}>
            {i % 2 === 0 && <span className={styles.tickLabel}>{show(i * 5)}</span>}
          </span>
        ))}
        {oases.map((m) => (
          <span key={m} className={styles.oasis} style={{ left: at(m) }} data-dry={dry.includes(m) || undefined} title={dry.includes(m) ? `Dry oasis at mile ${m}` : `Oasis at mile ${m}`}>
            <OasisIcon size={18} />
          </span>
        ))}
        {pursuerAt > -2 && (
          <span className={styles.pursuer} style={{ left: at(pursuerAt) }} data-kind={pursuer}>
            <Pursuer size={18} />
          </span>
        )}
        <span className={styles.camel} style={{ left: at(miles) }}>
          <WalkIcon size={20} />
        </span>
        <span className={styles.finish} style={{ left: at(goal) }}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 15V1.5h9l-2 3 2 3H3" fill="currentColor" />
          </svg>
        </span>
      </div>
      <p className={styles.gap} data-kind={pursuer}>
        <Pursuer size={16} />
        <span>
          <strong>
            {show(Math.abs(gap))} {units}
          </strong>{" "}
          {rival ? (gap > 0 ? "rival ahead" : "rival behind") : `${PURSUER_SHORT[pursuer]} behind`}
        </span>
      </p>
    </div>
  );
}

type SuppliesProps = {
  sips: number;
  canteen?: number;
  thirst: number;
  stamina: number;
  /** Hours on the trek's clock, shown as a time of day. */
  clock?: number;
  noThirst?: boolean;
  children?: React.ReactNode;
};

export function Supplies({ sips, canteen = 6, thirst, stamina, clock, noThirst = false, children }: SuppliesProps) {
  const night = clock !== undefined && (clock >= 18 || clock < 6);
  return (
    <div className={styles.supplies}>
      {clock !== undefined && (
        <div className={styles.supply} aria-label={`${night ? "Night" : "Day"}, ${clockText(clock)}`}>
          <span className={styles.supplyLabel}>{night ? "Night" : "Day"}</span>
          <span className={styles.clock}>{clockText(clock)}</span>
        </div>
      )}
      <div className={styles.supply} aria-label={`${sips} of ${canteen} sips in the canteen`}>
        <span className={styles.supplyLabel}>
          <CanteenIcon size={16} /> Canteen
        </span>
        <span className={styles.pips}>
          {Array.from({ length: canteen }, (_, i) => (
            <span key={i} className={styles.drop} data-full={i < sips || undefined}>
              <DropIcon size={15} />
            </span>
          ))}
        </span>
      </div>
      <div className={styles.supply} aria-label={noThirst ? "No thirst here: it's cold" : `${thirst} of 4 turns before you must drink`}>
        <span className={styles.supplyLabel}>Thirst</span>
        <span className={styles.bars} data-cold={noThirst || undefined}>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={styles.bar} data-full={noThirst || i < thirst || undefined} data-low={(!noThirst && thirst <= 1) || undefined} />
          ))}
        </span>
      </div>
      <div className={styles.supply} aria-label={`Camel strength ${stamina} of 7`}>
        <span className={styles.supplyLabel}>Camel</span>
        <span className={styles.pips}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={styles.hump} data-full={i < stamina || undefined}>
              <HumpIcon size={15} />
            </span>
          ))}
        </span>
      </div>
      {children}
    </div>
  );
}

const clockText = (hours: number) => {
  const h = Math.floor(((hours % 24) + 24) % 24);
  return `${String(h).padStart(2, "0")}:00`;
};

export type Command = { key: string; title: string; preview: string; icon: (p: { size?: number }) => React.ReactNode };

export const COMMANDS: Command[] = [
  { key: "1", title: "Drink", preview: "One sip · free", icon: CanteenIcon },
  { key: "2", title: "Walk", preview: "0–9 mi · tired +1", icon: WalkIcon },
  { key: "3", title: "Gallop", preview: "0–18 mi · tired +3", icon: GallopIcon },
  { key: "4", title: "Make camp", preview: "Fresh camel · time passes", icon: CampIcon },
  { key: "5", title: "Scan", preview: "Costs a sip · see the odds", icon: ScanIcon },
  { key: "6", title: "Signal", preview: "1 in 10 that help comes", icon: SignalIcon },
];

/** What a card says about its command right now: the outcome, and what the pursuer gains meanwhile. */
export type CardDetail = { main: string; gain?: string };

type CardsProps = {
  selected?: string;
  details?: Record<string, CardDetail>;
  /** Why a command can't be used now, by key. */
  disabled?: Record<string, string | undefined>;
  /** A refused command shakes and says why. */
  shake?: { command: string; reason: string };
  onCommand?: (key: string) => void;
  /** In the tutorial, the only cards on offer. */
  only?: string[];
};

const COMMAND_IDS: Record<string, string> = { "1": "drink", "2": "walk", "3": "gallop", "4": "camp", "5": "scan", "6": "signal" };

export function CommandCards({ selected, details = {}, disabled = {}, shake, onCommand, only }: CardsProps) {
  return (
    <div className={styles.commands} role="toolbar" aria-label="Commands">
      {COMMANDS.map((command) => {
        const Glyph = command.icon;
        const shaking = shake?.command === COMMAND_IDS[command.key];
        const off = disabled[command.key];
        const offered = !only || only.includes(command.key);
        const detail = details[command.key];
        const text = shaking ? shake!.reason : off && off !== "Wait" ? off : (detail?.main ?? command.preview);
        return (
          <button
            key={command.key}
            type="button"
            className={styles.card}
            aria-pressed={selected === command.key}
            aria-keyshortcuts={command.key}
            aria-disabled={!!off || !offered || undefined}
            data-shake={shaking || undefined}
            data-dim={!offered || undefined}
            data-unready={off === "Wait" || undefined}
            onClick={() => onCommand?.(command.key)}
          >
            <span className={styles.key}>{command.key}</span>
            <span className={styles.cardHead}>
              <span className={styles.cardIcon}>
                <Glyph size={20} />
              </span>
              <span className={styles.cardTitle}>{command.title}</span>
            </span>
            <span className={styles.cardPreview}>{text}</span>
            {detail?.gain && !shaking && <span className={styles.cardGain}>{detail.gain}</span>}
          </button>
        );
      })}
    </div>
  );
}

type RollProps = {
  chance: number;
  stride: string;
  tired: number;
  /** The stride the camel would take next, counting from the command. */
  strides?: number;
  fatigue?: number;
  max?: number;
  onLetRun?: () => void;
  onReins?: () => void;
};

/** The camel running on by itself: the odds it keeps going, what one more stride costs, and the two ways out. */
export function RollMeter({ chance, stride, tired, strides, fatigue, max = 7, onLetRun, onReins }: RollProps) {
  const after = fatigue === undefined ? undefined : fatigue + tired;
  const collapse = after !== undefined && after > max;
  return (
    <div className={styles.roll} role="group" aria-label="The camel is running on">
      <span className={styles.rollKicker}>On a roll{strides ? ` · stride ${strides + 1}` : ""}</span>
      <span className={styles.rollDial} style={{ "--chance": chance } as React.CSSProperties}>
        <span>{Math.round(chance * 100)}%</span>
      </span>
      <span className={styles.rollText}>
        One more stride: <strong>{stride}</strong>, tired +{tired}
        {after !== undefined && (
          <>
            {" "}
            → {after}/{max}
          </>
        )}
        {collapse ? <strong className={styles.rollWarn}> The camel would collapse.</strong> : <> · then {Math.round(chance * 100)}% it runs on again</>}
      </span>
      {onLetRun ? (
        <span className={styles.rollActions}>
          <button type="button" className={styles.rollButton} data-danger={collapse || undefined} onClick={onLetRun}>
            Let it run <kbd>Enter</kbd>
          </button>
          <button type="button" className={`${styles.rollButton} ${styles.rollPrimary}`} onClick={onReins} data-autofocus>
            <ReinsIcon size={18} /> Pull the reins <kbd>Space</kbd>
          </button>
        </span>
      ) : (
        <span className={styles.reins}>
          <ReinsIcon size={18} /> Pull the reins <kbd>Space</kbd>
        </span>
      )}
    </div>
  );
}

export function EventCard({ kicker, title, children, actions }: { kicker: string; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={styles.event} aria-label={title} aria-live="polite">
      <p className={styles.eventKicker}>{kicker}</p>
      <h2 className={styles.eventTitle}>{title}</h2>
      <div className={styles.eventBody}>{children}</div>
      {actions && <div className={styles.eventActions}>{actions}</div>}
    </section>
  );
}
