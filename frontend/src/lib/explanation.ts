import type { AIExplanation, LocalizedExplanation } from "@/types";

/** Pick the language-appropriate slice of an explanation, with a graceful
 *  fallback to the flat English fields for scores generated before the
 *  bilingual generator existed. */
export function localized(expl: AIExplanation, lang: "en" | "fr"): LocalizedExplanation {
  const block = expl.i18n?.[lang] ?? expl.i18n?.en;
  if (block) return block;
  return {
    why_hire:             expl.why_hire,
    why_not_hire:         expl.why_not_hire,
    strengths:            expl.strengths ?? [],
    weaknesses:           expl.weaknesses ?? [],
    why_score:            expl.why_score ?? "",
    recommended_action:   expl.recommended_action ?? "",
    ramp_up:              expl.ramp_up ?? "",
    interview_probe_line: expl.interview_probe_line ?? "",
    metric_breakdown:     expl.metric_breakdown,
    candidate_message:    expl.candidate_message ?? {
      headline: "", feedback: "", improvement_areas: [], encouragement: "",
    },
  };
}
