import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  motion, useInView, animate,
  useScroll, useTransform, useMotionValue, useSpring,
} from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  Brain, Layers, Globe, BarChart3, Shield, Target,
  CheckCircle, ChevronRight, Zap, GitBranch,
  type LucideProps,
} from "lucide-react";

/* ── Existing UI components — one import per blueprint ─────────── */
import { Card }                from "@/components/ui/card";
import { Spotlight }           from "@/components/ui/spotlight";
import { SplineScene }         from "@/components/ui/splite";
import { WebGLShader }         from "@/components/ui/web-gl-shader";
import { ShaderAnimation }     from "@/components/ui/shader-animation";
import { GooeyText }           from "@/components/ui/gooey-text-morphing";
import { ContainerScroll }     from "@/components/ui/container-scroll-animation";
import { FeatureTabs }         from "@/components/ui/feature-tabs";
import { FeatureCard }         from "@/components/ui/grid-feature-cards";
import { WorldMap }            from "@/components/ui/world-map";
import { Testimonials }        from "@/components/ui/testimonials-columns";
import { HeroGeometric }       from "@/components/ui/shape-landing-hero";
import { CanvasRevealEffect }  from "@/components/ui/canvas-reveal-effect";
import { MetalButton }         from "@/components/ui/metal-button";
import { PricingSection }      from "@/components/ui/pricing-section";
import { LiveMatch }           from "@/components/ui/live-match";

gsap.registerPlugin(ScrollTrigger);

/* ── InViewOnly — keeps WebGL contexts under control ──────────── */
function InViewOnly({ children, rootMargin = "200px" }: { children: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setMounted(e.isIntersecting),
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none">
      {mounted ? children : null}
    </div>
  );
}

/* ── Count-up stat ─────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1.8, inView: boolean) {
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);
  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;
    const c = animate(0, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return c.stop;
  }, [target, duration, inView]);
  return value;
}

function StatCounter({ value, suffix = "", label, inView }: {
  value: number; suffix?: string; label: string; inView: boolean;
}) {
  const count = useCountUp(value, 2, inView);
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold font-display text-iridescent-soft mb-2 tabular-nums tracking-tight">
        {count}{suffix}
      </div>
      <p className="text-white/22 text-xs tracking-[0.22em] uppercase">{label}</p>
    </div>
  );
}

/* ── Data ──────────────────────────────────────────────────────── */
type LucideIcon = React.ComponentType<LucideProps>;

const HERO_STATS = [
  { label: "+251%", desc: "Spearman gain"   },
  { label: "8,733", desc: "Training pairs"  },
  { label: "< 3s",  desc: "Batch latency"   },
];

const TICKER_ITEMS = [
  "Semantic AI Matching", "150+ Skill Graph", "URL Signal Extraction",
  "Explainable Scores", "Batch Ranking", "Multi-Language Support",
  "Domain-Adapted Models", "Real-time Analysis", "Privacy-First Scoring",
  "Open-Weight Models",
];

const featureTabs = [
  {
    value: "semantic",
    label: "Semantic AI",
    content: {
      badge: "NLP · Embeddings",
      title: "Fine-tuned domain embeddings",
      description:
        "BAAI/bge-large-en-v1.5 fine-tuned on 8,733 CV-JD pairs. Goes beyond keywords — understands that React experience signals Vue capability. Spearman correlation jumped from 0.23 to 0.82 after domain adaptation.",
      stats: [
        { label: "Spearman gain",  value: "+250.9%" },
        { label: "Training pairs", value: "8,733" },
      ],
    },
  },
  {
    value: "skill",
    label: "Skill Graph",
    content: {
      badge: "Graph · Proximity",
      title: "150+ skill proximity graph",
      description:
        "Skills are nodes; edges encode semantic distance. React↔Vue: 0.85. Docker→Kubernetes: 0.65. Partial credit flows automatically — a candidate with Vue gets recognised for React-adjacent roles.",
      stats: [
        { label: "Skills mapped",  value: "150+" },
        { label: "Skill clusters", value: "11" },
      ],
    },
  },
  {
    value: "url",
    label: "URL Signals",
    content: {
      badge: "GitHub · LinkedIn",
      title: "Real-world signal extraction",
      description:
        "Fetches GitHub repos, LinkedIn profiles, and portfolio sites. Evaluates actual code contributions — not just what's written on the CV. Adds up to +15 points for verified, demonstrated expertise.",
      stats: [
        { label: "Max boost",      value: "+15 pts" },
        { label: "Signal sources", value: "3+" },
      ],
    },
  },
];

const features: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Domain-Adapted Semantic Matching", description: "Fine-tuned BAAI/bge-large-en-v1.5 on 8.7K CV-JD pairs. Understands technical-domain nuance far beyond keyword overlap.", icon: Brain     },
  { title: "Skill Proximity Graph",           description: "150+ skills across 11 clusters. React↔Vue: 0.85. Docker→Kubernetes: 0.65. Partial credit for related skills.",         icon: Layers    },
  { title: "URL Signal Extraction",           description: "GitHub API: repo count, languages, stars. LinkedIn scraping. Portfolio keyword detection. Up to +15 pts.",            icon: Globe     },
  { title: "Explainable Scores",              description: "Every score comes with matched/missing skills, why-hire / why-not paragraphs, and section-level breakdowns.",         icon: BarChart3 },
  { title: "Batch Ranking",                   description: "POST /match/batch ranks 50–200 CVs against one JD in seconds. Full leaderboard, sorted best-first.",                  icon: Shield    },
  { title: "Multi-Language Support",          description: "langdetect routes non-English CVs to BGE-M3 (100+ languages). French, Arabic, Spanish — all handled.",                icon: Target    },
];

type FormulaItem = { label: string; weight: string; icon: LucideIcon };
const scoreFormula: FormulaItem[] = [
  { label: "Semantic",    weight: "40%",   icon: Brain     },
  { label: "Skill Graph", weight: "30%",   icon: Layers    },
  { label: "TF-IDF",      weight: "15%",   icon: BarChart3 },
  { label: "URL Boost",   weight: "≤15pt", icon: GitBranch },
];

const mapDots = [
  { start: { lat: 48.8566, lng: 2.3522 },    end: { lat: 37.7749, lng: -122.4194 } },
  { start: { lat: 51.5074, lng: -0.1278 },   end: { lat: 25.2048, lng: 55.2708   } },
  { start: { lat: 35.6762, lng: 139.6503 },  end: { lat: 1.3521,  lng: 103.8198  } },
  { start: { lat: -23.5558, lng: -46.6396 }, end: { lat: 40.7128, lng: -74.006   } },
  { start: { lat: 19.076,  lng: 72.8777 },   end: { lat: 37.5665, lng: 126.978   } },
];

/* ── Hero copy fade-up variants ────────────────────────────────── */
const heroFadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.9, delay: 0.45 + i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ── Main Landing ──────────────────────────────────────────────── */
export default function Landing() {
  const statsRef    = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-100px" });

  const heroSection = useRef<HTMLElement>(null);
  const splineRef   = useRef<HTMLDivElement>(null);

  /* Mouse parallax (subtle on the dots in hero copy) */
  const mouseX  = useMotionValue(0);
  const mouseY  = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 55, damping: 22 });
  const smoothY = useSpring(mouseY, { stiffness: 55, damping: 22 });
  const px = useTransform(smoothX, [-1, 1], [-10, 10]);
  const py = useTransform(smoothY, [-1, 1], [-8, 8]);

  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set((e.clientX / window.innerWidth) * 2 - 1);
      mouseY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    const rafFn = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(rafFn);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      /* gs-reveal: y/opacity */
      document.querySelectorAll<HTMLElement>(".gs-reveal").forEach((el) => {
        gsap.fromTo(el,
          { y: 50, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 1.0, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
          }
        );
      });

      /* gs-heading: clip-path bottom curtain */
      document.querySelectorAll<HTMLElement>(".gs-heading").forEach((el) => {
        gsap.fromTo(el,
          { clipPath: "inset(0 0 100% 0)" },
          {
            clipPath: "inset(0 0 0% 0)", duration: 1.0, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
          }
        );
      });

      /* gs-parallax-slow */
      document.querySelectorAll<HTMLElement>(".gs-parallax-slow").forEach((el) => {
        gsap.fromTo(el, { y: 20 }, {
          y: -55,
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 2.5 },
        });
      });

      /* Spline panel — subtle parallax with scroll */
      if (splineRef.current && heroSection.current) {
        gsap.to(splineRef.current, {
          y: -60,
          ease: "none",
          scrollTrigger: {
            trigger: heroSection.current,
            start: "top top",
            end: "bottom top",
            scrub: 1.4,
            invalidateOnRefresh: true,
          },
        });
      }

      /* Card stagger */
      const cards = document.querySelectorAll<HTMLElement>(".gs-card-reveal");
      if (cards.length) {
        gsap.fromTo(cards,
          { y: 50, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
            stagger: 0.07,
            scrollTrigger: { trigger: cards[0], start: "top 85%", toggleActions: "play none none none" },
          }
        );
      }
    });

    /* Custom cursor */
    const dot  = document.getElementById("cursor-dot");
    const ring = document.getElementById("cursor-ring");
    const onMove = (e: MouseEvent) => {
      if (dot)  { dot.style.left  = e.clientX + "px"; dot.style.top  = e.clientY + "px"; }
      if (ring) { ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px"; }
    };
    const onEnterLink = () => {
      if (ring) { ring.style.width = "48px"; ring.style.height = "48px"; }
    };
    const onLeaveLink = () => {
      if (ring) { ring.style.width = "32px"; ring.style.height = "32px"; }
    };
    document.querySelectorAll("a, button").forEach(el => {
      el.addEventListener("mouseenter", onEnterLink);
      el.addEventListener("mouseleave", onLeaveLink);
    });
    window.addEventListener("mousemove", onMove);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(rafFn);
      ctx.revert();
      window.removeEventListener("mousemove", onMove);
      document.querySelectorAll("a, button").forEach(el => {
        el.removeEventListener("mouseenter", onEnterLink);
        el.removeEventListener("mouseleave", onLeaveLink);
      });
    };
  }, []);

  return (
    <div className="bg-[#000] text-white overflow-x-hidden">
      {/* Custom cursor */}
      <div id="cursor-dot" />
      <div id="cursor-ring" />

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-[2px] z-[9999] origin-left"
        style={{
          width: progressWidth,
          background: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.55), rgba(255,255,255,0.15))",
        }}
      />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 1 — HERO (Card + Spotlight + SplineScene split)    *
       *  Anchor pattern from comp/1 SplineSceneBasic demo            *
       * ═══════════════════════════════════════════════════════════ */}
      <section
        ref={heroSection}
        className="relative min-h-screen px-4 sm:px-6 md:px-10 pt-28 pb-10 flex items-center bg-[#000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <Card className="relative w-full h-[calc(100vh-9rem)] min-h-[560px] bg-black/[0.96] border border-white/[0.06] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(255,255,255,0.02)_inset]">

            {/* Static spotlight blob — top-left, drifts slowly */}
            <div
              className="spotlight-static -top-40 left-0 md:left-60 md:-top-20"
              style={{ width: 700, height: 700 }}
            />

            {/* Always-on WebGL rainbow — bridges the whole card with chromatic atmosphere */}
            <div className="absolute inset-0" style={{ opacity: 0.14, mixBlendMode: "screen" }}>
              <WebGLShader />
            </div>

            {/* Drifting iridescent blobs — bleed across both halves to unify text + robot */}
            <div className="blob-cyan    animate-blob-1 absolute -top-32 -left-24"                                style={{ width: 520, height: 520 }} />
            <div className="blob-violet  animate-blob-2 absolute top-1/2 left-[42%] -translate-y-1/2"             style={{ width: 640, height: 640 }} />
            <div className="blob-magenta animate-blob-3 absolute -bottom-28 -right-16"                            style={{ width: 480, height: 480 }} />

            {/* Noise overlay */}
            <div
              className="absolute inset-0 pointer-events-none z-[1]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                opacity: 0.025,
              }}
            />

            <div className="relative z-10 flex flex-col md:flex-row h-full">

              {/* LEFT — copy */}
              <div className="flex-1 p-8 md:p-12 lg:p-14 flex flex-col justify-center">
                <motion.p
                  custom={0} variants={heroFadeUp} initial="initial" animate="animate"
                  className="text-[10px] tracking-[0.22em] text-white/22 uppercase mb-6 flex items-center gap-3"
                >
                  <span className="inline-block w-6 h-px bg-white/20" />
                  AI Matching Engine · PFA 2026
                </motion.p>

                <motion.h1
                  custom={1} variants={heroFadeUp} initial="initial" animate="animate"
                  className="font-display font-bold tracking-[-0.03em] leading-[0.95]
                             text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-300">
                    Match smarter.
                  </span>
                  <br />
                  <span className="text-iridescent-animated">
                    Hire faster.
                  </span>
                </motion.h1>

                <motion.p
                  custom={2} variants={heroFadeUp} initial="initial" animate="animate"
                  className="mt-6 text-neutral-300/75 max-w-lg leading-relaxed text-sm md:text-base"
                >
                  Domain-adapted embeddings, a 150-skill proximity graph, and live URL
                  signal extraction — every score explained.
                </motion.p>

                <motion.div
                  custom={3} variants={heroFadeUp} initial="initial" animate="animate"
                  className="mt-9 flex flex-wrap items-center gap-3"
                >
                  <Link to="/register" className="relative group inline-block">
                    <span className="btn-halo" />
                    <MetalButton className="relative h-11 px-8 text-sm gap-2">
                      Get Started <ChevronRight size={13} />
                    </MetalButton>
                  </Link>
                  <Link
                    to="/login"
                    className="liquid-glass inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-medium text-white/80 hover:text-white whitespace-nowrap"
                  >
                    Sign in
                  </Link>
                </motion.div>

                {/* Stat pills */}
                <motion.div
                  custom={4} variants={heroFadeUp} initial="initial" animate="animate"
                  className="mt-12 flex items-center gap-6 flex-wrap"
                >
                  {HERO_STATS.map(({ label, desc }) => (
                    <div key={desc} className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-white/60 font-mono">{label}</span>
                      <span className="text-[10px] text-white/22">{desc}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Subtle parallax accent line */}
                <motion.div
                  style={{ x: px, y: py }}
                  className="absolute bottom-8 left-8 md:left-14 w-px h-16 bg-gradient-to-b from-transparent via-white/15 to-transparent pointer-events-none"
                />
              </div>

              {/* RIGHT — Spline (extends into the text area for unified atmosphere) */}
              <div ref={splineRef} className="flex-1 relative will-change-transform">
                {/* Iridescent halo behind the robot */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 55% 65% at 50% 50%, rgba(34,211,238,0.10), rgba(167,139,250,0.08) 40%, transparent 75%)",
                  }}
                />
                <SplineScene
                  scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                  className="w-full h-full relative z-10"
                />
                {/* Soft color-tinted blend — thinner so robot bleeds into text side */}
                <div
                  className="absolute inset-y-0 left-0 w-[14%] pointer-events-none z-20"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(0,0,0,0.78), rgba(0,0,0,0.25) 55%, transparent 100%)",
                  }}
                />
              </div>
            </div>

            {/* Card bottom soft fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
            />
          </Card>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 2 — TRUST STRIP                                     *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-y border-white/[0.05] py-5 bg-[#000]">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {["No credit card required", "Open-weight models", "Full explainability", "Multi-language"].map((t) => (
            <span key={t} className="flex items-center gap-2 text-xs text-white/22">
              <CheckCircle size={11} className="text-white/30" />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 3 — MARQUEE ↻                                       *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-7 bg-[#000] overflow-hidden border-b border-white/[0.03]">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="marquee-track flex items-center gap-10 whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-4 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/22">
              <span className="w-1 h-1 rounded-full bg-white/18 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 4 — GOOEY MORPHING STATEMENT                       *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-36 flex flex-col items-center justify-center px-4 bg-[#000] overflow-hidden">
        <InViewOnly>
          <div className="w-full h-full" style={{ opacity: 0.10, mixBlendMode: "screen" as const }}>
            <WebGLShader />
          </div>
        </InViewOnly>

        {/* Atmospheric color blobs */}
        <div className="blob-cyan    animate-blob-1 absolute top-10 left-[18%]"  style={{ width: 380, height: 380 }} />
        <div className="blob-magenta animate-blob-2 absolute bottom-10 right-[18%]" style={{ width: 340, height: 340 }} />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, #000 100%)" }}
        />
        <div className="gs-reveal text-center mb-6 relative z-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
            Powered by Domain-Adapted Embeddings
          </p>
        </div>
        <div className="w-full max-w-2xl h-24 relative z-10">
          <GooeyText
            texts={[
              "Semantic Matching",
              "Skill Graph Analysis",
              "URL Signal Extraction",
              "Explainable Scores",
              "Batch Ranking",
            ]}
            morphTime={1.2}
            cooldownTime={2.5}
            textClassName="text-5xl sm:text-6xl font-bold font-display text-white"
          />
        </div>
        <div className="gs-reveal mt-8 text-center max-w-xl relative z-10">
          <p className="text-white/25 text-sm leading-relaxed">
            Trained on 8,733 CV-JD pairs · Spearman{" "}
            <span className="text-white/60 font-semibold">0.23 → 0.82</span>
            {" "}· Pearson{" "}
            <span className="text-white/60 font-semibold">0.22 → 0.84</span>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 5 — STATS BAR                                       *
       * ═══════════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="relative z-10 py-24 px-4 bg-[#000]">
        <div className="max-w-5xl mx-auto gs-parallax-slow">
          <div
            className="rounded-3xl p-12 border border-white/[0.06] relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.016)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{ background: "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)" }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 relative z-10">
              <StatCounter value={251}  suffix="%" label="Spearman gain"    inView={statsInView} />
              <StatCounter value={150}  suffix="+" label="Skills in graph"   inView={statsInView} />
              <StatCounter value={8733} suffix=""  label="Training pairs"    inView={statsInView} />
              <StatCounter value={3}    suffix="s" label="Avg batch latency" inView={statsInView} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 6 — CONTAINER SCROLL · LIVE DASHBOARD               *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 bg-[#000] pb-0 overflow-hidden">
        <InViewOnly>
          <div className="w-full h-full" style={{ opacity: 0.06 }}>
            <ShaderAnimation className="w-full h-full" />
          </div>
        </InViewOnly>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#000]/80 via-transparent to-[#000]/80" />

        <ContainerScroll
          titleComponent={
            <div className="mb-8 relative z-10">
              <div className="gs-reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-5">
                <Zap size={12} className="text-white/40" />
                <span className="text-xs font-semibold text-white/40 tracking-wide">LIVE INTERFACE</span>
              </div>
              <h2 className="gs-reveal text-4xl sm:text-5xl font-bold font-display text-white mb-4 tracking-tight leading-[1]">
                See the engine in action
              </h2>
              <p className="gs-reveal text-white/30 text-lg max-w-xl mx-auto">
                Paste a CV, paste a job description, hit match — scores and explanations in under 3 seconds.
              </p>
            </div>
          }
        >
          <DashboardPreview />
        </ContainerScroll>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION — LIVE MATCH PLAYGROUND (real engine)              *
       * ═══════════════════════════════════════════════════════════ */}
      <LiveMatch />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 7 — HOW IT WORKS                                    *
       *  Uses: Card primitive + CanvasRevealEffect + Spotlight       *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 px-4 bg-[#000]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
              Simple · Intelligent · Transparent
            </p>
            <h2 className="gs-heading text-5xl sm:text-6xl font-bold font-display text-white tracking-tight leading-[1]">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <HowItWorksCard
              title="For Candidates"
              steps={[
                { step: "01", title: "Upload CV",    desc: "Drop your PDF or paste text. AI extracts your full profile." },
                { step: "02", title: "Browse Jobs",  desc: "See recommended roles matched to your exact skill set." },
                { step: "03", title: "Get Feedback", desc: "Score + skill breakdown after recruiter review." },
              ]}
            />
            <HowItWorksCard
              title="For Recruiters"
              steps={[
                { step: "01", title: "Post Job",   desc: "Describe the role and required skills in any format." },
                { step: "02", title: "AI Ranking", desc: "One click to score and rank all applicants by fit." },
                { step: "03", title: "Decide",     desc: "See why-hire / why-not explanations, then shortlist." },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 8 — MARQUEE ↺                                       *
       * ═══════════════════════════════════════════════════════════ */}
      <div className="relative z-10 py-5 bg-[#000] overflow-hidden border-y border-white/[0.03]">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="marquee-track-reverse flex items-center gap-10 whitespace-nowrap">
          {[...TICKER_ITEMS.slice().reverse(), ...TICKER_ITEMS.slice().reverse()].map((item, i) => (
            <span key={i} className="flex items-center gap-4 text-[11px] font-medium tracking-[0.18em] uppercase text-white/15">
              <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 9 — MANIFESTO INTERLUDE (comp/3 HeroGeometric)     *
       * ═══════════════════════════════════════════════════════════ */}
      <HeroGeometric
        badge="Built for hiring teams"
        title1="Fast. Fair."
        title2="Explainable."
        subtitle="Every match score breaks down to the exact signals — semantic fit, skill coverage, lexical overlap, and verified external proof. Nothing hidden, nothing magical."
      />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 10 — FEATURE TABS (comp/8)                          *
       * ═══════════════════════════════════════════════════════════ */}
      <FeatureTabs
        heading="Built different."
        subheading="Three signals. One hybrid score."
        tabs={featureTabs}
        className="bg-[#000]"
      />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 11 — SHADER EDITORIAL (comp/5 full-bleed)           *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 h-[80vh] min-h-[520px] overflow-hidden bg-[#000]">
        <InViewOnly>
          <div className="w-full h-full">
            <ShaderAnimation className="w-full h-full" />
          </div>
        </InViewOnly>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 25%, rgba(0,0,0,0.85) 80%)" }}
        />
        <div className="relative z-10 h-full flex items-center justify-center px-4">
          <div className="text-center max-w-3xl">
            <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/35 uppercase mb-5">
              In motion
            </p>
            <h2 className="gs-heading text-5xl sm:text-7xl font-bold font-display tracking-tight leading-[0.95] mb-8">
              <span className="text-iridescent-animated">Real-time</span>
              <br />
              <span className="text-white">at scale</span>
            </h2>
            <p className="gs-reveal text-white/40 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Single-CV match under a second. Batch of 200 CVs in three seconds.
              No queues, no rate-limits, no surprises.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 12 — FEATURE GRID (comp/9)                          *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 px-4 bg-[#000]">
        <InViewOnly>
          <div className="w-full h-full" style={{ opacity: 0.04 }}>
            <WebGLShader />
          </div>
        </InViewOnly>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="mb-16">
            <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">Features</p>
            <h2 className="gs-heading text-5xl sm:text-6xl font-bold font-display text-white tracking-tight leading-[1]">
              Everything to hire<br />smarter
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-3xl overflow-hidden border border-white/[0.06]">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="gs-card-reveal bg-[#000] card-3d-hover hover:bg-white/[0.02] transition-colors duration-300 relative"
                style={{ transitionDelay: `${i * 45}ms` }}
              >
                <Spotlight size={220} springOptions={{ bounce: 0 }} />
                <FeatureCard feature={f} className="bg-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 13 — SCORING FORMULA                                *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 px-4 bg-[#000]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
              Scoring Formula
            </p>
            <h2 className="gs-heading text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
              Transparent by design
            </h2>
          </div>

          <div
            className="gs-reveal rounded-3xl p-8 border border-white/[0.06] relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.016)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,255,255,0.025) 0%, transparent 70%)" }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 relative z-10">
              {scoreFormula.map(({ label, weight, icon: Icon }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl p-4 text-center bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.14] transition-colors duration-300"
                >
                  <Icon size={18} className="mx-auto mb-2 text-white/40" />
                  <div className="text-xl font-bold text-white mb-0.5">{weight}</div>
                  <div className="text-xs text-white/25">{label}</div>
                </motion.div>
              ))}
            </div>

            {[
              { label: "Semantic Match",  score: 88 },
              { label: "Skill Coverage",  score: 72 },
              { label: "Lexical Overlap", score: 91 },
              { label: "URL Signals",     score: 65 },
            ].map(({ label, score }) => (
              <div key={label} className="mb-4 relative z-10">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/35">{label}</span>
                  <span className="font-bold font-mono text-white/55">{score}%</span>
                </div>
                <div className="h-px rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
                    style={{ opacity: 0.2 + (score / 100) * 0.45 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 14 — WORLD MAP (comp/10)                            *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 px-4 bg-[#000]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
              Global Reach
            </p>
            <h2 className="gs-heading text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
              Global candidates,<br />one engine
            </h2>
          </div>
          <div className="gs-reveal">
            <WorldMap dots={mapDots} lineColor="#ffffff" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 15 — TESTIMONIALS (comp/11)                         *
       * ═══════════════════════════════════════════════════════════ */}
      <Testimonials />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION — PRICING (B2B)                                     *
       * ═══════════════════════════════════════════════════════════ */}
      <PricingSection />

      {/* ═══════════════════════════════════════════════════════════ *
       *  SECTION 16 — CTA                                            *
       * ═══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-36 px-4 bg-[#000] overflow-hidden">
        <InViewOnly>
          <div className="w-full h-full" style={{ opacity: 0.07, mixBlendMode: "screen" as const }}>
            <WebGLShader />
          </div>
        </InViewOnly>

        {/* CTA color blobs — dimmed to match the page */}
        <div className="blob-cyan    animate-blob-1 absolute top-10  left-10"  style={{ width: 420, height: 420, opacity: 0.38 }} />
        <div className="blob-violet  animate-blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 520, height: 520, opacity: 0.4 }} />
        <div className="blob-magenta animate-blob-2 absolute bottom-10 right-10" style={{ width: 460, height: 460, opacity: 0.38 }} />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 8%, rgba(0,0,0,0.78) 55%, #000 100%)" }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-2">
          <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/30 uppercase mb-6">
            Get started today
          </p>
          <h2
            className="gs-heading font-display font-black tracking-[-0.02em] leading-[0.92] mb-10"
            style={{ fontSize: "clamp(2.75rem, 8vw, 6rem)" }}
          >
            <span className="text-white">Hire</span>{" "}
            <span className="text-iridescent-animated">smarter.</span>
            <br />
            <span className="text-white/85">Decide faster.</span>
          </h2>
          <p className="gs-reveal text-white/30 text-base sm:text-lg mb-12 max-w-xl mx-auto leading-relaxed">
            Upload a CV, paste a job description, and see the full AI analysis —
            scores, skill gaps, and a hire/no-hire rationale — in seconds.
          </p>

          <div className="gs-reveal flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Primary — iridescent gradient */}
            <Link
              to="/register?role=candidate"
              className="group relative inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full px-8 text-sm font-bold text-black whitespace-nowrap transition-transform duration-200 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}
            >
              <span className="btn-halo" />
              <span className="relative">I&apos;m a Candidate</span>
              <ChevronRight size={15} className="relative shrink-0" />
            </Link>

            {/* Secondary — iridescent outline */}
            <Link
              to="/register?role=recruiter"
              className="btn-iridescent-border inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold text-white/80 hover:text-white whitespace-nowrap transition-colors duration-200"
            >
              I&apos;m a Recruiter
              <ChevronRight size={15} className="shrink-0" />
            </Link>

            {/* Tertiary — liquid glass */}
            <Link
              to="/login"
              className="liquid-glass inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-full px-8 text-sm font-medium text-white/80 hover:text-white whitespace-nowrap"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ *
       *  FOOTER                                                       *
       * ═══════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-10 px-4 bg-[#000]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold text-white text-sm tracking-tight">MatchAI</span>
          <p className="text-xs text-white/15">© {new Date().getFullYear()} MatchAI — PFA Final Year Project</p>
          <div className="flex items-center gap-6 text-xs text-white/22">
            <Link to="/login"    className="hover:text-white/55 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-white/55 transition-colors">Get started</Link>
            <Link to="/about"    className="hover:text-white/55 transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ *
 *  How It Works Card — Card primitive + CanvasRevealEffect +       *
 *  motion Spotlight + 3D tilt on hover                              *
 * ════════════════════════════════════════════════════════════════ */
function HowItWorksCard({
  title,
  steps,
}: {
  title: string;
  steps: { step: string; title: string; desc: string }[];
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      className="gs-reveal rounded-3xl border border-white/[0.06] relative overflow-hidden group bg-transparent"
      style={{
        background: "rgba(255,255,255,0.016)",
        transform: hovered
          ? "perspective(1000px) rotateX(2deg) rotateY(-1deg) translateY(-6px)"
          : "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)",
        transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Canvas reveal — only mounted while hovered (WebGL budget) */}
      {hovered && (
        <div className="absolute inset-0 z-0">
          <CanvasRevealEffect
            animationSpeed={3}
            opacities={[0.1, 0.1, 0.1, 0.2, 0.2, 0.3, 0.4, 0.4, 0.5, 0.6]}
            colors={[[255, 255, 255]]}
            dotSize={2}
            showGradient={true}
          />
        </div>
      )}

      {/* Mouse-follow Spotlight */}
      <Spotlight size={240} springOptions={{ bounce: 0 }} />

      <div className="relative z-10 p-8">
        <p className="text-[10px] font-semibold text-white/25 tracking-[0.2em] uppercase mb-8">{title}</p>
        <div className="space-y-7">
          {steps.map(({ step, title: t, desc }) => (
            <div key={step} className="flex gap-5">
              <span className="text-xs font-bold text-white/15 font-mono mt-0.5 shrink-0 w-6 pt-0.5">{step}</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1.5">{t}</p>
                <p className="text-xs text-white/30 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════ *
 *  Dashboard preview (inside ContainerScroll)                       *
 * ════════════════════════════════════════════════════════════════ */
function DashboardPreview() {
  return (
    <div className="w-full h-full bg-[#060608] rounded-xl overflow-hidden flex flex-col border border-white/[0.05]">
      {/* Chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="flex-1 mx-3">
          <div className="h-3 max-w-[180px] mx-auto rounded-md bg-white/[0.04]" />
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.07]">
          <Brain size={9} className="text-white/35" />
          <span className="text-[9px] text-white/35 font-semibold">AI Active</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-5 gap-3 p-4 overflow-hidden">
        <div className="col-span-2 flex flex-col gap-3">
          <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-3 flex-1">
            <p className="text-[9px] text-white/25 mb-2 font-medium uppercase tracking-wider">CV Text</p>
            <div className="space-y-1.5">
              {[60, 90, 45, 75, 50, 80, 35].map((w, i) => (
                <div key={i} className="h-1.5 rounded bg-white/[0.06]" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-3" style={{ flex: "0 0 38%" }}>
            <p className="text-[9px] text-white/25 mb-2 font-medium uppercase tracking-wider">Job Description</p>
            <div className="space-y-1.5">
              {[80, 55, 70, 40].map((w, i) => (
                <div key={i} className="h-1.5 rounded bg-white/[0.06]" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-3">
          <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-3 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] text-white/25 font-medium uppercase tracking-wider">Match Score</p>
              <span className="text-lg font-bold text-white font-mono">87.4</span>
            </div>
            {[
              { label: "Semantic",  w: 88 },
              { label: "Skills",    w: 72 },
              { label: "TF-IDF",    w: 91 },
              { label: "URL Boost", w: 65 },
            ].map(({ label, w }) => (
              <div key={label} className="flex items-center gap-2 mb-1.5">
                <span className="text-[8px] text-white/22 w-12 shrink-0">{label}</span>
                <div className="flex-1 h-1 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-white/40" style={{ width: `${w}%` }} />
                </div>
                <span className="text-[8px] text-white/30 font-mono w-6">{w}%</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] p-3">
            <p className="text-[9px] text-white/25 mb-2 font-medium uppercase tracking-wider">Matched Skills</p>
            <div className="flex flex-wrap gap-1">
              {["Python", "FastAPI", "Docker", "AWS", "PostgreSQL"].map((s) => (
                <span key={s} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/45 border border-white/[0.07]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
