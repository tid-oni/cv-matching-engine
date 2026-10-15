import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, Plus, X, ArrowLeft, Save } from "lucide-react";
import { createJob, updateJob, getJob } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";

export default function JobForm() {
  const { jobId } = useParams();
  const isEdit = !!jobId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const [form, setForm] = useState({
    title: "", company: user?.company || "", location: "",
    job_type: "full-time", experience_level: "mid",
    description: "", requirements: "",
    salary_min: "", salary_max: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    getJob(Number(jobId)).then(job => {
      setForm({
        title: job.title, company: job.company, location: job.location || "",
        job_type: job.job_type || "full-time", experience_level: job.experience_level || "mid",
        description: job.description, requirements: job.requirements || "",
        salary_min: job.salary_min?.toString() || "",
        salary_max: job.salary_max?.toString() || "",
      });
      setSkills(job.skills_required || []);
    }).finally(() => setFetchLoading(false));
  }, [isEdit, jobId]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
    setSkillInput("");
  };

  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        skills_required: skills,
        salary_min: form.salary_min ? parseInt(form.salary_min) : undefined,
        salary_max: form.salary_max ? parseInt(form.salary_max) : undefined,
      };
      if (isEdit) await updateJob(Number(jobId), payload);
      else await createJob(payload);
      navigate("/recruiter/jobs");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to save job");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-slate-400" size={28} />
    </div>
  );

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-20" style={{ width: 320, height: 320, opacity: 0.20 }} />
      <div className="blob-magenta animate-blob-2 absolute bottom-0 -right-10" style={{ width: 300, height: 300, opacity: 0.18 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
          <ArrowLeft size={15} /> {t("Back")}
        </button>
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-cyan-600 mb-1">
          {isEdit ? t("Edit Job") : t("New Job Post")}
        </p>
        <h1 className="text-3xl font-bold font-display text-slate-900 mb-1">{isEdit ? t("Edit job offer") : t("Post a job")}</h1>
        <p className="text-slate-500 text-sm mb-8">
          {isEdit ? t("Update the job details below") : t("Fill in the details to attract the best candidates")}
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Job title *</label>
              <input value={form.title} onChange={set("title")} className={inputCls} placeholder="Senior Frontend Engineer" required />
            </div>
            <div>
              <label className={labelCls}>Company *</label>
              <input value={form.company} onChange={set("company")} className={inputCls} placeholder="Acme Corp" required />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={set("location")} className={inputCls} placeholder="Paris, France" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.job_type} onChange={set("job_type")} className={inputCls}>
                {["full-time","part-time","remote","contract","internship"].map(t => (
                  <option key={t} value={t} className="bg-white text-slate-800">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Level</label>
              <select value={form.experience_level} onChange={set("experience_level")} className={inputCls}>
                {["junior","mid","senior","lead"].map(t => (
                  <option key={t} value={t} className="bg-white text-slate-800">{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Salary min (MAD/year)</label>
              <input type="number" value={form.salary_min} onChange={set("salary_min")} className={inputCls} placeholder="60000" />
            </div>
            <div>
              <label className={labelCls}>Salary max (MAD/year)</label>
              <input type="number" value={form.salary_max} onChange={set("salary_max")} className={inputCls} placeholder="120000" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Skills required</label>
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                className={`${inputCls} flex-1`} placeholder="e.g. Python, React…" />
              <button type="button" onClick={addSkill}
                className="px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-all">
                <Plus size={16} />
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-cyan-900 ml-0.5">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Job description *</label>
            <textarea value={form.description} onChange={set("description")} rows={6}
              className={`${inputCls} resize-none`} placeholder="Describe the role, responsibilities, team…" required />
          </div>

          <div>
            <label className={labelCls}>Requirements</label>
            <textarea value={form.requirements} onChange={set("requirements")} rows={4}
              className={`${inputCls} resize-none`} placeholder="Required experience, qualifications, soft skills…" />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {loading ? "Saving…" : isEdit ? "Save changes" : "Post job"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}