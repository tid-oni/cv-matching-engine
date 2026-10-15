import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Check, ChevronRight, Sparkles, Zap, Building2, Rocket } from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { WebGLShader } from "@/components/ui/web-gl-shader";

/* ── InViewOnly — mounts the shader only while the section is on screen,
   keeping the global WebGL context count low (matches the landing page). */
function InViewOnly({ children, rootMargin = "200px" }: { children: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setMounted(e.isIntersecting), { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none">
      {mounted ? children : null}
    </div>
  );
}

type Plan = {
  id: string;
  name: string;
  icon: typeof Zap;
  blurb: string;
  monthly: number | null;   // null → custom / contact sales
  annual: number | null;    // per-seat-equivalent monthly price, billed yearly
  priceNote: string;
  cta: string;
  to: string;
  featured?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    blurb: "For small teams making their first data-driven hires.",
    monthly: 249,
    annual: 199,
    priceNote: "base · per seat / month · volume tiers",
    cta: "Start free trial",
    to: "/register?role=recruiter",
    features: [
      "3 recruiter seats",
      "10 active job posts",
      "500 candidates scored / month",
      "AI match scores + explanations",
      "150-skill proximity graph",
      "Email support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    icon: Zap,
    blurb: "Base 249 + premium option (+99 MAD), for teams hiring continuously.",
    monthly: 348,
    annual: 279,
    priceNote: "per seat / month",
    cta: "Start free trial",
    to: "/register?role=recruiter",
    featured: true,
    features: [
      "Everything in Starter, plus:",
      "50 active job posts",
      "5,000 candidates scored / month",
      "Batch ranking & leaderboards",
      "URL signal extraction (GitHub, LinkedIn)",
      "Analytics & scoring dashboards",
      "Premium API access + priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    blurb: "For large orgs with high volume and compliance needs.",
    monthly: null,
    annual: null,
    priceNote: "tailored to your org",
    cta: "Contact sales",
    to: "/register?role=recruiter",
    features: [
      "Unlimited seats & job posts",
      "Unlimited candidate scoring",
      "Unlimited premium API",
      "Dedicated HR services & onboarding",
      "SSO / SAML & audit logs",
      "Custom model fine-tuning",
      "Dedicated success manager + SLA",
    ],
  },
];

function PriceDisplay({ plan, annual }: { plan: Plan; annual: boolean }) {
  if (plan.monthly == null) {
    return (
      <div className="flex items-baseline gap-1">
        <span
          className={`text-5xl font-bold font-display tracking-tight ${
            plan.featured ? "text-iridescent-animated" : "text-white"
          }`}
        >
          Custom
        </span>
      </div>
    );
  }
  const value = annual ? plan.annual! : plan.monthly;
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={`text-5xl font-bold font-display tracking-tight tabular-nums ${
          plan.featured ? "text-iridescent-animated" : "text-white"
        }`}
      >
        {value}
      </span>
      <span className="text-2xl font-semibold text-white/40 font-display ml-1">MAD</span>
      <span className="text-sm text-white/35 ml-1">/ mo</span>
    </div>
  );
}

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="relative z-10 py-28 px-4 bg-[#000] overflow-hidden">
      {/* WebGL atmosphere — dim, lazy-mounted */}
      <InViewOnly>
        <div className="w-full h-full" style={{ opacity: 0.045, mixBlendMode: "screen" as const }}>
          <WebGLShader />
        </div>
      </InViewOnly>

      {/* Drifting color blobs — dimmed to match the page */}
      <div className="blob-cyan    animate-blob-1 absolute -top-24 left-[12%]"  style={{ width: 460, height: 460, opacity: 0.34 }} />
      <div className="blob-violet  animate-blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 560, height: 560, opacity: 0.36 }} />
      <div className="blob-magenta animate-blob-2 absolute -bottom-24 right-[10%]" style={{ width: 440, height: 440, opacity: 0.34 }} />

      {/* Vignette so the grid reads cleanly over the atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 78% 72% at 50% 45%, transparent 15%, rgba(0,0,0,0.82) 68%, #000 100%)" }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
            Pricing · Built for teams
          </p>
          <h2 className="gs-heading text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
            Plans that scale<br />with your hiring
          </h2>
          <p className="gs-reveal text-white/30 text-sm sm:text-base max-w-xl mx-auto mt-5 leading-relaxed">
            Transparent, per-seat pricing for recruiting teams of every size.
            Every plan includes the full explainable-AI matching engine —
            and it's always <span className="text-white/60 font-medium">free for candidates</span>.
          </p>

          {/* Billing toggle */}
          <div className="gs-reveal mt-8 inline-flex items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/[0.1] bg-white/[0.03]">
              {(["monthly", "annual"] as const).map((mode) => {
                const isActive = (mode === "annual") === annual;
                return (
                  <button
                    key={mode}
                    onClick={() => setAnnual(mode === "annual")}
                    className="relative px-5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors duration-200"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="billing-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-full"
                        style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}
                      />
                    )}
                    <span className={`relative ${isActive ? "text-black" : "text-white/45 hover:text-white"}`}>
                      {mode}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] font-semibold text-iridescent-soft">Save 20% annually</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 44 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={`card-3d-hover relative rounded-3xl border overflow-hidden ${
                  plan.featured ? "md:-translate-y-3" : ""
                }`}
                style={{
                  background: plan.featured ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.016)",
                  borderColor: plan.featured ? "transparent" : "rgba(255,255,255,0.08)",
                }}
              >
                {/* Iridescent border for the featured plan */}
                {plan.featured && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{
                      padding: 1,
                      background: "linear-gradient(135deg, rgba(34,211,238,0.7), rgba(167,139,250,0.7), rgba(244,114,182,0.7))",
                      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                    }}
                  />
                )}

                {/* Mouse-follow spotlight */}
                <Spotlight size={260} springOptions={{ bounce: 0 }} />

                {/* Top glow for featured */}
                {plan.featured && (
                  <div
                    className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(167,139,250,0.16), transparent 70%)" }}
                  />
                )}

                <div className="relative z-10 p-7 flex flex-col h-full">
                  {/* Most popular badge */}
                  {plan.featured && (
                    <div className="absolute top-5 right-5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-black"
                      style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}>
                      <Sparkles size={10} /> Most Popular
                    </div>
                  )}

                  {/* Plan head */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: plan.featured
                          ? "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(167,139,250,0.18))"
                          : "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}>
                      <Icon size={16} className={plan.featured ? "text-iridescent-soft" : "text-white/55"} />
                    </div>
                    <span className="text-lg font-bold font-display text-white">{plan.name}</span>
                  </div>

                  <p className="text-xs text-white/35 leading-relaxed mb-6 min-h-[2.5rem]">{plan.blurb}</p>

                  {/* Price */}
                  <PriceDisplay plan={plan} annual={annual} />
                  <p className="text-[11px] text-white/30 mt-1.5 mb-6">
                    {plan.priceNote}
                    {plan.monthly != null && annual && (
                      <span className="text-white/20"> · billed yearly</span>
                    )}
                  </p>

                  {/* CTA */}
                  {plan.featured ? (
                    <Link to={plan.to} className="group relative block mb-7">
                      <span className="btn-halo" />
                      <span
                        className="relative flex items-center justify-center gap-2 w-full h-11 px-6 rounded-full text-sm font-bold text-black overflow-hidden transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%)",
                          boxShadow: "0 10px 30px rgba(167,139,250,0.38), inset 0 1px 0 rgba(255,255,255,0.55)",
                        }}
                      >
                        {/* glossy top highlight */}
                        <span className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
                          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.45), transparent)" }} />
                        {/* sweeping shine on hover */}
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"
                          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)" }} />
                        <span className="relative flex items-center gap-2">
                          {plan.cta} <ChevronRight size={14} />
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <Link
                      to={plan.to}
                      className="liquid-glass mb-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white/80 hover:text-white whitespace-nowrap"
                    >
                      {plan.cta} <ChevronRight size={14} className="shrink-0" />
                    </Link>
                  )}

                  {/* Features */}
                  <ul className="space-y-3 mt-auto">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: plan.featured
                              ? "linear-gradient(135deg, rgba(34,211,238,0.25), rgba(167,139,250,0.25))"
                              : "rgba(255,255,255,0.07)",
                          }}
                        >
                          <Check size={10} className={plan.featured ? "text-iridescent-soft" : "text-white/55"} />
                        </span>
                        <span className="text-[13px] text-white/55 leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Reassurance strip */}
        <div className="gs-reveal mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/25">
          {["14-day free trial", "No credit card to start", "Cancel anytime", "Volume discounts available"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Check size={11} className="text-iridescent-soft" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
