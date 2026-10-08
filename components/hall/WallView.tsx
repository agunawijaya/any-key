"use client";

import { useState } from "react";
import { games, oldestYear } from "@/lib/catalog";
import { isPlayable, yearLabel, type GameManifest } from "@/lib/kit/manifest";
import { ProgramPreview } from "@/components/previews/ProgramPreview";
import { Sticker } from "@/components/ui/Sticker";
import { pressAnyKey } from "./AnyKeyToy";
import { Tile } from "./Tile";
import { RefreshIcon } from "@/components/kit/icons";
import styles from "./WallView.module.css";

const HERO_KEYS = [
  { key: "A", color: "#ffffff" },
  { key: "N", color: "var(--pink)" },
  { key: "Y", color: "var(--cyan)" },
  { key: "K", color: "var(--orange)" },
  { key: "E", color: "#ffffff" },
  { key: "Y", color: "var(--violet)" },
];

const THIS_YEAR = new Date().getFullYear();

const playable = games.filter(isPlayable);
const upcoming = games.filter((game) => !isPlayable(game));
const playableCount = playable.length;

export function WallView() {
  const [featured, ...rest] = playable;

  return (
    <section data-view="wall" aria-label="Wall" className={styles.wall}>
      <div className={styles.grid}>
        <Tile className={styles.hero} label="Welcome">
          <SpinBadge />
          <p className={styles.eyebrow}>
            <span className={styles.liveDot} aria-hidden /> The BASIC classics hall
          </p>
          <h2 className={styles.headline}>
            Old code.
            <br />
            <em>New</em> tricks.
          </h2>
          <p className={styles.lede}>
            Programs people typed into computers in the ’70s and ’80s, rebuilt for right now:
            louder, brighter and way more fun.
          </p>
          <div className={styles.keys}>
            {HERO_KEYS.map(({ key, color }, i) => (
              <button
                key={i}
                type="button"
                className={styles.key}
                style={{ "--key": color } as React.CSSProperties}
                onClick={() => pressAnyKey(key)}
                aria-label={`Play the ${key} key`}
              >
                {key}
              </button>
            ))}
            <span className={styles.keysHint}>Tap them. Or mash your keyboard.</span>
          </div>
        </Tile>

        <ProgramTile program={featured} />

        <TriviaTile />

        {/* What's on the drawing board gets the top slot; with nothing in design, the years tile has it. */}
        {upcoming.length ? <ComingSoonTile game={upcoming[0]} /> : <YearsTile />}

        {rest.map((game) => (
          <ProgramTile key={game.id} program={game} wide />
        ))}

        <Tile className={styles.how} label="How it works">
          <h3 className={styles.tileTitle}>How it works</h3>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepKey}>1</span>
              <strong>Pick a program</strong>
              <span>Every tile is a real program from the ’70s or ’80s.</span>
            </li>
            <li>
              <span className={styles.stepKey}>2</span>
              <strong>Play it your way</strong>
              <span>New controls, new visuals, same soul.</span>
            </li>
            <li>
              <span className={styles.stepKey}>3</span>
              <strong>Read the story</strong>
              <span>Who made it, how it worked, what we changed.</span>
            </li>
          </ol>
        </Tile>

        {upcoming.length ? (
          <YearsTile wide />
        ) : (
          <Tile className={styles.more} label="More coming">
            <h3 className={styles.tileTitle}>More classics are loading</h3>
            <div className={styles.loader} aria-hidden>
              <span />
            </div>
            <p className={styles.moreText}>
              {playableCount} program{playableCount === 1 ? "" : "s"} in the hall so far. New ones
              drop as they’re rebuilt.
            </p>
          </Tile>
        )}
      </div>
    </section>
  );
}

function ProgramTile({ program, wide = false }: { program: GameManifest; wide?: boolean }) {
  const [c1, c2, c3] = program.palette;
  const playable = isPlayable(program);
  const lead = program.stats[0];
  return (
    <Tile className={`${styles.program} ${wide ? styles.programWide : ""}`} label={program.title}>
      <div
        className={styles.programBg}
        style={{ "--c1": c1, "--c2": c2, "--c3": c3 } as React.CSSProperties}
        aria-hidden
      />
      <div className={styles.programTop}>
        <span className={styles.kind}>{program.kind}</span>
        <div className={styles.programStickers}>
          <Sticker color="var(--lime)" tilt={-6}>
            Est. {yearLabel(program)}
          </Sticker>
          {lead && (
            <Sticker color="#ffffff" tilt={4}>
              {lead.value} {lead.label}
            </Sticker>
          )}
        </div>
      </div>

      <h3 className={styles.programTitle}>{program.title}</h3>
      <p className={styles.programTagline}>{program.tagline}</p>

      <dl className={styles.stats}>
        {program.stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.previewPanel}>
        <ProgramPreview id={program.id} />
      </div>

      <div className={styles.marquee} aria-label={`Play styles: ${program.modes.join(", ")}`}>
        <div className={styles.marqueeTrack} aria-hidden>
          {[...program.modes, ...program.modes].map((mode, i) => (
            <span key={i} className={styles.mode}>
              {mode}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.programFoot}>
        {playable ? (
          <span className={styles.actions}>
            <a className={styles.play} href={program.route}>
              Play now
            </a>
            <a className={styles.story} href={`${program.route}#story`} aria-label={`Read the story of ${program.title}`}>
              Story
            </a>
          </span>
        ) : (
          <span className={styles.soon}>
            <span className={styles.pulse} aria-hidden /> On the drawing board · coming soon
          </span>
        )}
        <span className={styles.source}>
          Based on {program.inspiredBy.file} · {yearLabel(program)}
        </span>
      </div>
    </Tile>
  );
}

function YearsTile({ wide = false }: { wide?: boolean }) {
  return (
    <Tile className={`${styles.years} ${wide ? styles.yearsWide : ""}`} label="Years since">
      <p className={styles.eyebrowDark}>Since {oldestYear}</p>
      <p className={styles.bigNumber}>{THIS_YEAR - oldestYear}</p>
      <p className={styles.yearsText}>years since this code first ran. Still slaps.</p>
    </Tile>
  );
}

/** A game still being designed: a plain blueprint card, with no promise of art it hasn't got yet. */
function ComingSoonTile({ game }: { game: GameManifest }) {
  return (
    <Tile className={styles.soonTile} label={`${game.title}, coming soon`}>
      <div className={styles.soonHead}>
        <span className={styles.kindDark}>Next on the bench</span>
        <Sticker color="#ffffff" tilt={-5}>
          Est. {yearLabel(game)}
        </Sticker>
      </div>
      <div className={styles.soonPreview}>
        <ProgramPreview id={game.id} />
      </div>
      <h3 className={styles.soonTitle}>{game.title}</h3>
      <p className={styles.soonText}>
        <span className={styles.pulse} aria-hidden /> On the drawing board · based on {game.inspiredBy.file}
      </p>
    </Tile>
  );
}

/** Facts from every program in the hall, one at a time. */
function TriviaTile() {
  const facts = games.flatMap((g) => g.trivia.map((fact) => ({ title: g.title, fact })));
  const [index, setIndex] = useState(0);
  const current = facts[index];
  return (
    <Tile className={styles.trivia} label="Did you know?">
      <div className={styles.triviaHead}>
        <p className={styles.eyebrowDark}>Did you know? · {current.title}</p>
        <span className={styles.counter}>
          {index + 1}/{facts.length}
        </span>
      </div>
      <p className={styles.fact} aria-live="polite">
        {current.fact}
      </p>
      <button type="button" className={styles.nextFact} onClick={() => setIndex((index + 1) % facts.length)}>
        Another one <RefreshIcon size={16} />
      </button>
    </Tile>
  );
}

function SpinBadge() {
  return (
    <svg className={styles.badge} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <path id="badge-circle" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0" />
      </defs>
      <circle cx="60" cy="60" r="58" className={styles.badgeDisc} />
      <text className={styles.badgeText}>
        <textPath href="#badge-circle" textLength="270" lengthAdjust="spacing">
          PRESS ANY KEY • PRESS ANY KEY •
        </textPath>
      </text>
      <path
        className={styles.badgeStar}
        d="M60 38l5.5 15.5L81 60l-15.5 5.5L60 82l-5.5-16.5L39 60l15.5-6.5z"
      />
    </svg>
  );
}
