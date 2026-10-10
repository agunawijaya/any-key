import { awari1978 } from "./awari1978";
import { kalah } from "./kalah";
import { oware } from "./oware";
import type { RuleId, Rules } from "./types";

export const RULES: Record<RuleId, Rules> = { awari1978, oware, kalah };

export const RULE_ORDER: RuleId[] = ["awari1978", "oware", "kalah"];

export * from "./types";
