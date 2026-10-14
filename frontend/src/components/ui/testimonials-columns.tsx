import React from "react";
import { motion } from "motion/react";

export interface Testimonial {
  text:  string;
  image: string;
  name:  string;
  role:  string;
}

export const TestimonialsColumn = ({
  testimonials,
  duration = 12,
  className,
}: {
  testimonials: Testimonial[];
  duration?: number;
  className?: string;
}) => (
  <div className={className} style={{ overflow: "hidden" }}>
    <motion.div
      animate={{ translateY: "-50%" }}
      transition={{ duration, repeat: Infinity, ease: "linear", repeatType: "loop" }}
      className="flex flex-col gap-5"
    >
      {[...new Array(2).fill(0)].map((_, outerIdx) => (
        <React.Fragment key={outerIdx}>
          {testimonials.map(({ text, image, name, role }, i) => (
            <div
              key={i}
              className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm max-w-xs w-full"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            >
              <p className="text-sm text-white/40 leading-relaxed">{text}</p>
              <div className="flex items-center gap-3 mt-5">
                <img
                  width={36}
                  height={36}
                  src={image}
                  alt={name}
                  className="h-9 w-9 rounded-full object-cover grayscale"
                />
                <div>
                  <div className="text-sm font-semibold text-white">{name}</div>
                  <div className="text-xs text-white/22 mt-0.5">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </motion.div>
  </div>
);

const defaultTestimonials: Testimonial[] = [
  { text: "Reduced our screening time by 70%. The skill graph feature is genuinely impressive — it understands that React experience transfers to Vue.", image: "https://randomuser.me/api/portraits/women/1.jpg", name: "Amira Benali", role: "Head of Talent, TechCorp" },
  { text: "The explainability is what sold us. Candidates get real feedback on why they matched or didn't. Completely changes the candidate experience.", image: "https://randomuser.me/api/portraits/men/2.jpg", name: "Jonas Weber", role: "Engineering Manager, Fintech" },
  { text: "We run 200+ CV batches weekly. MatchAI handles it in seconds with accuracy that outperforms our previous ATS by a wide margin.", image: "https://randomuser.me/api/portraits/women/3.jpg", name: "Priya Sharma", role: "People Ops Lead" },
  { text: "URL signal extraction is a game-changer. It actually fetches GitHub repos and evaluates real code contributions, not just listed skills.", image: "https://randomuser.me/api/portraits/men/4.jpg", name: "Omar Rashid", role: "CTO, Scale-up" },
  { text: "Multi-language support is flawless. We hire across 8 countries and the BGE-M3 fallback handles Arabic and French perfectly.", image: "https://randomuser.me/api/portraits/women/5.jpg", name: "Laila Mansouri", role: "Global HR Director" },
  { text: "Finally a matching engine that doesn't just keyword match. The semantic understanding catches qualified candidates our old system missed.", image: "https://randomuser.me/api/portraits/men/6.jpg", name: "Sven Eriksson", role: "Senior Recruiter" },
  { text: "The batch ranking leaderboard is exactly what we needed for high-volume roles. Clean, fast, and the scores actually make sense.", image: "https://randomuser.me/api/portraits/women/7.jpg", name: "Fatima Al-Zahra", role: "Talent Acquisition" },
  { text: "Integrated in two days. The API is clean, the docs are excellent, and the Python backend just works. Refreshing.", image: "https://randomuser.me/api/portraits/men/8.jpg", name: "Lucas Petit", role: "Product Engineer" },
  { text: "Our hiring quality improved measurably. The Spearman correlation with our own human rankings is astonishing for an automated system.", image: "https://randomuser.me/api/portraits/women/9.jpg", name: "Ingrid Larsen", role: "VP of Engineering" },
];

export function Testimonials() {
  const col1 = defaultTestimonials.slice(0, 3);
  const col2 = defaultTestimonials.slice(3, 6);
  const col3 = defaultTestimonials.slice(6, 9);

  return (
    <section className="py-28 px-4 overflow-hidden bg-[#000]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/20 uppercase mb-5">Social Proof</p>
          <h2 className="text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
            What teams say
          </h2>
        </div>

        <div
          className="flex justify-center gap-5 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] max-h-[680px] overflow-hidden"
        >
          <TestimonialsColumn testimonials={col1} duration={16} />
          <TestimonialsColumn testimonials={col2} duration={20} className="hidden md:flex flex-col" />
          <TestimonialsColumn testimonials={col3} duration={18} className="hidden lg:flex flex-col" />
        </div>
      </div>
    </section>
  );
}