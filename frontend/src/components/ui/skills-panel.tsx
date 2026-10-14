import { motion } from "motion/react";
import { CheckCircle2, XCircle, GitBranch, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

type IconComponent = React.ComponentType<LucideProps>;

interface SkillsPanelProps {
  matched?:   string[];
  missing?:   string[];
  partial?:   string[];
  className?: string;
}

function SkillChip({ label, chipClass, icon: Icon }: { label: string; chipClass: string; icon: IconComponent }) {
  return (
    <motion.span layout className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border", chipClass)}>
      <Icon size={10} />
      {label}
    </motion.span>
  );
}

function Section({ title, skills, textClass, chipClass, icon: Icon, delay }: {
  title: string; skills: string[]; textClass: string; chipClass: string; icon: IconComponent; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={13} className={textClass} />
        <span className={cn("text-xs font-semibold", textClass)}>{title}</span>
        <span className={cn("ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums bg-white/[0.06] border border-white/[0.1]", textClass)}>
          {skills.length}
        </span>
      </div>
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s, i) => (
            <motion.span key={s} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay + i * 0.04, duration: 0.3 }}>
              <SkillChip label={s} chipClass={chipClass} icon={Icon} />
            </motion.span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/20 italic">None detected</p>
      )}
    </motion.div>
  );
}

export function SkillsPanel({ matched = [], missing = [], partial = [], className }: SkillsPanelProps) {
  return (
    <div className={cn("rounded-3xl p-6 space-y-5 border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm", className)}>
      <Section title="Matched Skills"    skills={matched} textClass="text-white"    chipClass="text-white border-white/20 bg-white/[0.08]"       icon={CheckCircle2} delay={0.0} />
      <div className="h-px bg-white/[0.05]" />
      <Section title="Missing Skills"    skills={missing} textClass="text-white/45" chipClass="text-white/45 border-white/[0.1] bg-white/[0.04]"  icon={XCircle}      delay={0.1} />
      <div className="h-px bg-white/[0.05]" />
      <Section title="Related / Partial" skills={partial} textClass="text-white/60" chipClass="text-white/60 border-white/[0.12] bg-white/[0.05]" icon={GitBranch}    delay={0.2} />
    </div>
  );
}