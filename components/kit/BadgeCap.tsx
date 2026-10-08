import type { AchievementSpec, GameManifest } from "@/lib/kit/manifest";
import { Keycap } from "./Keycap";

type Props = { game: Pick<GameManifest, "id" | "accent" | "emblem">; achievement: AchievementSpec; earned: boolean; size?: number };

/** One achievement as its keycap: lit when earned, plain while still to earn, blank with "?" while secret. */
export function BadgeCap({ game, achievement, earned, size = 40 }: Props) {
  const state = earned ? "earned" : achievement.secret ? "secret" : "locked";
  return <Keycap id={`badge-${game.id}-${achievement.id}`} accent={game.accent} emblem={game.emblem} tier={achievement.tier} state={state} size={size} />;
}

/** What a badge list shows for an achievement: secret ones stay secret until earned. */
export const badgeText = (achievement: AchievementSpec, earned: boolean) =>
  achievement.secret && !earned ? { title: "Secret", hint: "Earn it to see it" } : { title: achievement.title, hint: achievement.hint };
