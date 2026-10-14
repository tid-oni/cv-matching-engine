import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Upload, FileText, Zap, AlertCircle, Link2, RefreshCw } from "lucide-react";
import { matchingClient } from "@/api/client";
import { ScoreCard } from "@/components/ui/score-card";
import { SkillsPanel } from "@/components/ui/skills-panel";
import { MetalButton } from "@/components/ui/metal-button";

const SAMPLE_CV = `John Smith
Senior Software Engineer | 8 years experience
GitHub: github.com/johnsmith

SKILLS
Python, FastAPI, PostgreSQL, Docker, AWS, React, Git, CI/CD

EXPERIENCE
Senior Backend Engineer - TechCorp (2020-2024)
- Built REST APIs using FastAPI serving 1M+ requests/day
- Managed PostgreSQL databases with complex query optimization
- Deployed microservices on AWS ECS with Docker
`;

const SAMPLE_JOB = `Senior Python Backend Engineer

Requirements:
- 5+ years Python experience
- FastAPI or Django REST framework
- PostgreSQL or MySQL database expertise
- Docker and Kubernetes knowledge
- AWS or GCP cloud experience
- CI/CD pipeline experience
`;

interface MatchResult {
  total_score:           number;
  semantic_score:        number;
  skill_proximity_score: number;
  tfidf_score:           number;
  url_boost:             number;
  matched_skills:        string[];
  missing_skills:        string[];
  partial_skills:        string[];
  urls_found:            string[];
  language_detected:     string;
  model_used:            string;
  confidence:            number;
}

export default function Match() {
  const [cvText, setCvText]   = useState(SAMPLE_CV);
  const [jobText, setJobText] = useState(SAMPLE_JOB);
  const [mode, setMode]       = useState<"text" | "pdf">("text");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<MatchResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const fileRef               = useRef<HTMLInputElement>(null);
  const resultRef             = useRef<HTMLDivElement>(null);

  const handleMatch = async () => {
    if (!jobText.trim()) { setError("Please provide a job description."); return; }
    if (mode === "text" && !cvText.trim()) { setError("Please provide CV text."); return; }
    if (mode === "pdf" && !pdfFile) { setError("Please upload a PDF file."); return; }
    setError(null);
    setLoading(true);
    try {
      let data: MatchResult;
      if (mode === "text") {
        const res = await matchingClient.post("/match/text", { cv_text: cvText, job_text: jobText });
        data = res.data;
      } else {
        const form = new FormData();
        form.append("cv_file", pdfFile!);
        form.append("job_text", jobText);
        const res = await matchingClient.post("/match/pdf", form, { headers: { "Content-Type": "multipart/form-data" } });
        data = res.data;
      }
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API call failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000] text-white pt-20 pb-16">
      <div className="relative z-10 max-w-6xl mx-auto px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] mb-5">
            <Zap size={12} className="text-white/60" />
            <span className="text-xs font-semibold text-white/50 tracking-wide">SINGLE CV MATCH</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              Match a CV
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white/80 to-white/50">
              to a Job Description
            </span>
          </h1>
          <p className="text-white/35 text-lg max-w-xl mx-auto">
            Hybrid semantic + skill graph + URL signal scoring in under 3 seconds.
          </p>
        </motion.div>

        {/* Input panels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="grid lg:grid-cols-2 gap-6 mb-8"
        >
          {/* CV panel */}
          <div className="rounded-3xl p-6 flex flex-col gap-4 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-white/40" />
                <span className="font-semibold text-sm text-white">CV Input</span>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-white/[0.08] text-xs font-semibold">
                {(["text", "pdf"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 transition-colors ${
                      mode === m
                        ? "bg-white text-black"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {m === "text" ? "Text" : "PDF"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "text" ? (
              <textarea
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                className="flex-1 min-h-[280px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors font-mono"
                placeholder="Paste CV text here…"
              />
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex-1 min-h-[280px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer group"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                <Upload size={28} className="text-white/20 group-hover:text-white/50 transition-colors mb-3" />
                {pdfFile ? (
                  <p className="text-sm text-white/70 font-medium">{pdfFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-white/30">Click to upload PDF</p>
                    <p className="text-xs text-white/15 mt-1">Max 10 MB</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* JD panel */}
          <div className="rounded-3xl p-6 flex flex-col gap-4 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-white/40" />
              <span className="font-semibold text-sm text-white">Job Description</span>
            </div>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="flex-1 min-h-[280px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors font-mono"
              placeholder="Paste job description here…"
            />
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/60 text-sm"
          >
            <AlertCircle size={15} className="shrink-0 text-white/40" />
            {error}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-16"
        >
          <MetalButton
            onClick={handleMatch}
            disabled={loading}
            className="h-12 px-10 text-sm gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><RefreshCw size={15} className="animate-spin" /> Matching…</>
            ) : (
              <><Zap size={15} /> Match Now</>
            )}
          </MetalButton>
        </motion.div>

        {/* Results */}
        {result && (
          <motion.div
            ref={resultRef}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs font-semibold text-white/25 tracking-wide uppercase">Results</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <ScoreCard
                score={result.total_score}
                semanticScore={result.semantic_score}
                skillScore={result.skill_proximity_score}
                tfidfScore={result.tfidf_score}
                urlBoost={result.url_boost}
              />

              <div className="lg:col-span-2">
                <SkillsPanel
                  matched={result.matched_skills}
                  missing={result.missing_skills}
                  partial={result.partial_skills}
                />

                {/* Meta */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "Language",   val: result.language_detected.toUpperCase() },
                    { label: "Confidence", val: `${(result.confidence * 100).toFixed(0)}%` },
                    { label: "Model",      val: result.model_used.split(":").pop() ?? result.model_used },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-2xl p-3 text-center bg-white/[0.03] border border-white/[0.07]">
                      <div className="text-sm font-bold text-white">{val}</div>
                      <div className="text-xs text-white/30 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* URLs */}
                {result.urls_found.length > 0 && (
                  <div className="mt-4 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08]">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 size={12} className="text-white/50" />
                      <span className="text-xs font-semibold text-white/50">
                        URLs Detected (+{result.url_boost.toFixed(1)} pts)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.urls_found.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/40 hover:text-white/70 truncate max-w-[260px] transition-colors"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}