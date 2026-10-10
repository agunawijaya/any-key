import { classicEngagement, classicScore } from "./classic";
import type { Engagement } from "./engagement";
import { buildMission, medalFor, missionById, type Medal, type MissionSpec } from "./missions";

/*
 * The play-style layer. A play style turns a session (what the player chose)
 * into an engagement, and an engagement that has ended into a verdict. The
 * firing screen, the observer's map and the records read only engagements
 * and verdicts, so a new play style (Field Artillery comes next) is one more
 * entry here and nothing else changes.
 */

export type ClassicSession = { style: "classic"; seed: string };
export type CampaignSession = { style: "campaign"; mission: string; seed: string };
export type Session = ClassicSession | CampaignSession;
export type PlayStyleId = Session["style"];

export type Verdict = {
  won: boolean;
  /** Rounds fired in all. */
  rounds: number;
  /** Campaign: the medal a win earned (null for a loss or outside the Campaign). */
  medal: Medal | null;
  /** Classic: all five down within the 18-round standard. */
  standard: boolean | null;
};

export type PlayStyle<S extends Session> = {
  id: S["style"];
  title: string;
  engage(session: S): Engagement;
  verdict(session: S, engagement: Engagement): Verdict;
};

export const classicStyle: PlayStyle<ClassicSession> = {
  id: "classic",
  title: "Classic",
  engage: (session) => classicEngagement(session.seed),
  verdict: (_, e) => {
    const score = classicScore(e);
    return { won: e.outcome === "won", rounds: score.total, medal: null, standard: score.metStandard };
  },
};

export const campaignStyle: PlayStyle<CampaignSession> = {
  id: "campaign",
  title: "Campaign",
  engage: (session) => buildMission(missionOf(session), session.seed),
  verdict: (session, e) => {
    const won = e.outcome === "won";
    return { won, rounds: e.shots.length, medal: won ? medalFor(missionOf(session), e.shots.length) : null, standard: null };
  },
};

function missionOf(session: CampaignSession): MissionSpec {
  const spec = missionById(session.mission);
  if (!spec) throw new Error(`No mission ${session.mission}`);
  return spec;
}

export function engage(session: Session): Engagement {
  return session.style === "classic" ? classicStyle.engage(session) : campaignStyle.engage(session);
}

export function verdictOf(session: Session, engagement: Engagement): Verdict {
  return session.style === "classic" ? classicStyle.verdict(session, engagement) : campaignStyle.verdict(session, engagement);
}

/** A fresh seed for every game: no two wars the same. */
export const freshSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 2 ** 31).toString(36)}`;

