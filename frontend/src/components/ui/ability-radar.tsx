import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { useI18n } from "@/context/I18nContext";
import type { Application, ScoreBreakdown } from "@/types";

/* ── Competency categories — maps a skill to a strength area ─────────
   Every axis is grounded in the candidate's OWN matched vs missing
   skills, so the radar shows where THIS candidate is strong / weak
   against the role.                                                   */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Languages": [
    "python", "javascript", "typescript", "java", "go", "golang", "c++", "c#",
    ".net", "ruby", "php", "swift", "kotlin", "scala", "rust", "bash", "powershell",
  ],
  "Frameworks": [
    "react", "react native", "vue", "angular", "next.js", "nextjs", "next",
    "node.js", "nodejs", "node", "express", "fastapi", "flask", "django",
    "spring", "rails", "svelte", "tailwind", "tailwind css",
  ],
  "Cloud & DevOps": [
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
    "terraform", "helm", "ansible", "ci/cd", "github actions", "gitlab ci",
    "jenkins", "prometheus", "grafana", "lambda", "ecs", "eks", "vpc",
    "cloudformation", "sagemaker", "aws sagemaker", "bentoml",
  ],
  "Data & AI": [
    "pytorch", "tensorflow", "scikit-learn", "sklearn", "pandas", "numpy",
    "spark", "airflow", "dbt", "mlflow", "hugging face", "transformers", "bert",
    "sentence transformers", "faiss", "opencv", "onnx", "tensorrt", "yolo",
    "detectron2", "spacy", "cuda", "langchain", "llm", "nlp", "distributed training",
  ],
  "Databases": [
    "postgresql", "postgres", "mysql", "mongodb", "redis", "dynamodb",
    "snowflake", "bigquery", "elasticsearch", "elastic", "cassandra", "sqlite",
    "sql", "looker",
  ],
  "Security": [
    "owasp", "burp suite", "metasploit", "nmap", "snyk", "semgrep", "trivy",
    "splunk", "siem", "mitre att&ck", "crowdstrike", "wireshark", "okta",
    "azure ad", "saml", "oidc", "scim", "auth0", "iam", "opa", "soc 2",
    "active directory", "threat modeling",
  ],
  "Tools & Practices": [
    "git", "jest", "pytest", "playwright", "cypress", "vitest", "storybook",
    "rest", "rest apis", "graphql", "grpc", "agile", "scrum", "tdd",
    "microservices", "oauth", "jwt", "figma", "jira", "kafka", "flink",
    "firebase", "statistics",
  ],
};

function categorize(skill: string): string | null {
  const s = skill.toLowerCase().trim();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.includes(s)) return cat;
  }
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => s.includes(k) || k.includes(s))) return cat;
  }
  return null;
}

export interface RadarPoint { axis: string; value: number }

/* Build a per-candidate radar with 5–6 axes. Leads with the candidate's
   competency areas (real strong/weak points from matched vs missing skills),
   then tops up with per-candidate fit signals so there are always ≥5 axes.  */
export function buildRadarData(app: Application): RadarPoint[] {
  const matched = app.matched_skills ?? [];
  const missing = app.missing_skills ?? [];
  const b: ScoreBreakdown | undefined = app.explanation?.metric_breakdown ?? app.score_breakdown;
  const total   = matched.length + missing.length;
  const overall = b?.composite?.score ?? app.match_score ?? 0;

  // ── Competency areas from the candidate's own skills ──
  const buckets: Record<string, { m: number; t: number }> = {};
  for (const sk of matched) {
    const c = categorize(sk);
    if (c) { (buckets[c] ??= { m: 0, t: 0 }); buckets[c].m++; buckets[c].t++; }
  }
  for (const sk of missing) {
    const c = categorize(sk);
    if (c) { (buckets[c] ??= { m: 0, t: 0 }); buckets[c].t++; }
  }
  const competency = Object.entries(buckets)
    .map(([axis, { m, t }]) => ({ axis, value: Math.round((m / t) * 100), n: t }))
    .sort((a, b) => b.n - a.n)            // most role-relevant areas first
    .map(({ axis, value }) => ({ axis, value }));

  // ── Per-candidate fit signals (always computable) ──
  const semantic = Math.round(b?.semantic_match?.score ?? overall * 0.95);
  const lexical  = Math.round(b?.tfidf_lexical?.score ?? overall * 0.8);
  const breadth  = Math.min(100, matched.length * 12);          // how many skills they bring
  const required = Math.round(total ? (matched.length / total) * 100 : 0);
  const signals: RadarPoint[] = [
    { axis: "Required Skills", value: required },
    { axis: "Experience Fit", value: semantic },
    { axis: "Skill Breadth",  value: breadth },
    { axis: "Keyword Match",  value: lexical },
    { axis: "Overall Fit",    value: Math.round(overall) },
  ];

  // ── Compose: competency areas first, padded with signals to reach 6 ──
  const axes: RadarPoint[] = competency.slice(0, 6);
  for (const s of signals) {
    if (axes.length >= 6) break;
    if (!axes.some((a) => a.axis === s.axis)) axes.push(s);
  }
  return axes;
}

export function AbilityRadar({ app, height = 300 }: { app: Application; height?: number }) {
  const { t } = useI18n();
  // Translate axis labels for display (keeps the underlying data intact).
  const data = buildRadarData(app).map((d) => ({ ...d, axis: t(d.axis) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <defs>
          <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#22d3ee" />
            <stop offset="50%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <PolarGrid stroke="rgba(255,255,255,0.10)" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          className="radar-angle-axis"
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 9 }}
          axisLine={false}
          tickCount={5}
        />
        <Radar
          name="Coverage"
          dataKey="value"
          stroke="url(#radarGrad)"
          strokeWidth={2}
          fill="url(#radarGrad)"
          fillOpacity={0.3}
          isAnimationActive
          animationDuration={1100}
        />
        <Tooltip
          contentStyle={{
            background: "var(--panel-2)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
          }}
          labelStyle={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}
          itemStyle={{ color: "#fff", fontSize: 12 }}
          formatter={(v) => [`${v}% ${t("covered")}`, t("Strength")]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
