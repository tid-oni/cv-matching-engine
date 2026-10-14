import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail, Lock, User, Briefcase, Building2, MapPin,
  ArrowRight, Eye, EyeOff, Loader2, CheckCircle,
} from "lucide-react";
import { register } from "../api/platform";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import { MetalButton } from "@/components/ui/metal-button";
import { SplineScene } from "@/components/ui/splite";

type Role = "candidate" | "recruiter";

export default function Register() {
  const { setAuth }                    = useAuth();
  const { success, error: toastError } = useToast();
  const navigate                       = useNavigate();
  const [params]                       = useSearchParams();

  const [role, setRole]         = useState<Role>((params.get("role") as Role) || "candidate");
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany]   = useState("");
  const [location, setLocation] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await register({
        email,
        password,
        full_name: fullName,
        role,
        company:  company  || undefined,
        location: location || undefined,
      });
      setAuth(data.access_token, data.user);
      success("Account created!", `Welcome to MatchAI, ${data.user.full_name.split(" ")[0]}!`);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Registration failed.";
      toastError("Could not create account", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex overflow-hidden">

      {/* ── LEFT PANEL: SplineScene 3D ─────────────────────────── */}
      <div className="hidden lg:flex w-1/2 relative flex-col overflow-hidden">
        <div className="absolute inset-0">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HlviYPeUi/scene.splinecode"
            className="w-full h-full"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        {/* Overlay copy */}
        <div className="absolute top-1/2 left-10 -translate-y-1/2 z-10 max-w-[280px]">
          <p
            className="font-display font-black text-white leading-[0.88] tracking-[-0.04em] mb-6"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
          >
            JOIN<br />
            <span
              style={{
                WebkitTextStroke: "1px rgba(255,255,255,0.3)",
                color: "transparent",
              }}
            >
              MATCHAI
            </span>
          </p>
          <p className="text-[11px] text-white/25 leading-relaxed tracking-wide">
            AI-powered CV matching with transparent scoring and full explainability.
          </p>
        </div>

        <div className="absolute bottom-10 left-10 z-10">
          <p className="text-[10px] text-white/20 tracking-[0.18em] uppercase">PFA 2026 · Final Year Project</p>
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ──────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative px-6 py-16">
        {/* Dot-canvas bg */}
        <div className="absolute inset-0">
          <CanvasRevealEffect
            colors={[[255, 255, 255]]}
            dotSize={2}
            opacities={[0.03, 0.03, 0.05, 0.05, 0.07, 0.07, 0.09, 0.09, 0.12, 0.15]}
            showGradient={false}
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,0,0.94) 25%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.3) 100%)",
          }}
        />

        {/* Mobile logo */}
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center px-6 lg:hidden">
          <Link to="/" className="text-white font-bold text-lg tracking-tight hover:text-white/60 transition-colors">
            MatchAI
          </Link>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[440px]"
        >
          <div
            className="rounded-3xl p-8 border border-white/[0.08]"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(28px)" }}
          >
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-white mb-1.5">Create account</h1>
              <p className="text-sm text-white/30">
                Already have one?{" "}
                <Link
                  to="/login"
                  className="text-white/60 hover:text-white transition-colors font-medium underline underline-offset-2"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {(["candidate", "recruiter"] as Role[]).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200"
                    style={{
                      background:  active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      borderColor: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                      style={{ background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)" }}
                    >
                      {r === "candidate"
                        ? <User size={16} className={active ? "text-white" : "text-white/30"} />
                        : <Briefcase size={16} className={active ? "text-white" : "text-white/30"} />
                      }
                    </div>
                    <span className={`text-sm font-semibold capitalize ${active ? "text-white" : "text-white/30"}`}>
                      {r}
                    </span>
                    <p className={`text-[11px] text-center leading-tight ${active ? "text-white/45" : "text-white/18"}`}>
                      {r === "candidate" ? "Looking for jobs" : "Hiring talent"}
                    </p>
                    {active && (
                      <motion.div
                        layoutId="role-check"
                        className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white flex items-center justify-center"
                      >
                        <CheckCircle size={10} className="text-black" />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Full name */}
              <div>
                <label className="block text-[10px] font-semibold text-white/35 mb-1.5 uppercase tracking-[0.14em]">
                  Full name
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-10 pr-4 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-semibold text-white/35 mb-1.5 uppercase tracking-[0.14em]">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-semibold text-white/35 mb-1.5 uppercase tracking-[0.14em]">
                  Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-11 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Recruiter extra fields */}
              <AnimatePresence>
                {role === "recruiter" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3.5"
                  >
                    <div>
                      <label className="block text-[10px] font-semibold text-white/35 mb-1.5 uppercase tracking-[0.14em]">
                        Company name
                      </label>
                      <div className="relative">
                        <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Acme Corp"
                          className="w-full pl-10 pr-4 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-white/35 mb-1.5 uppercase tracking-[0.14em]">
                        Location{" "}
                        <span className="text-white/18 normal-case tracking-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Paris, France"
                          className="w-full pl-10 pr-4 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <MetalButton
                type="submit"
                disabled={loading}
                className="w-full justify-center gap-2 h-12 text-sm mt-1 disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating account…</>
                ) : (
                  <>Create {role} account <ArrowRight size={14} /></>
                )}
              </MetalButton>
            </form>

            <p className="text-[10px] text-white/15 text-center mt-5">
              By registering you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}