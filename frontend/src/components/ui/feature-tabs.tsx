import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface TabContent {
  badge:       string;
  title:       string;
  description: string;
  stats?:      { label: string; value: string }[];
  visual?:     React.ReactNode;
}

interface Tab {
  value:   string;
  label:   string;
  content: TabContent;
}

interface FeatureTabsProps {
  heading?:     string;
  subheading?:  string;
  tabs?:        Tab[];
  className?:   string;
}

export function FeatureTabs({
  heading     = "Built different.",
  subheading  = "Three signals. One hybrid score.",
  tabs        = [],
  className,
}: FeatureTabsProps) {
  const [active, setActive] = React.useState(tabs[0]?.value ?? "");

  return (
    <section className={cn("py-28 px-4", className)}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/20 uppercase mb-5">
            {subheading}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
            {heading}
          </h2>
        </div>

        <Tabs value={active} onValueChange={setActive}>
          {/* Tab list */}
          <TabsList className="flex gap-1 mb-10 border-b border-white/[0.06] pb-0 -mb-px">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "relative px-5 py-3 text-sm font-medium transition-colors duration-200 outline-none",
                  "text-white/35 hover:text-white/70",
                  "data-[state=active]:text-white",
                  "border-b-2 border-transparent data-[state=active]:border-white",
                  "-mb-px"
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab panels */}
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="outline-none">
              <AnimatePresence mode="wait">
                {active === tab.value && (
                  <motion.div
                    key={tab.value}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="grid lg:grid-cols-2 gap-8"
                  >
                    {/* Text side */}
                    <div className="flex flex-col justify-center">
                      <span className="inline-block text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase mb-5 border border-white/[0.1] rounded-full px-3 py-1 w-fit">
                        {tab.content.badge}
                      </span>
                      <h3 className="text-3xl font-bold text-white font-display tracking-tight mb-4 leading-tight">
                        {tab.content.title}
                      </h3>
                      <p className="text-white/28 text-sm leading-relaxed mb-8">
                        {tab.content.description}
                      </p>
                      {tab.content.stats && (
                        <div className="flex gap-8">
                          {tab.content.stats.map(({ label, value }) => (
                            <div key={label}>
                              <div className="text-2xl font-bold text-white font-display">{value}</div>
                              <div className="text-xs text-white/22 mt-0.5">{label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Visual side */}
                    <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] min-h-[260px] flex items-center justify-center">
                      {tab.content.visual ?? (
                        <div className="p-8 w-full">
                          <div className="space-y-3">
                            {[80, 55, 90, 40, 70].map((w, i) => (
                              <motion.div
                                key={i}
                                className="h-1.5 rounded-full bg-white/10 overflow-hidden"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                                style={{ transformOrigin: "left" }}
                              >
                                <div className="h-full bg-white/60 rounded-full" style={{ width: `${w}%` }} />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}