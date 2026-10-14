import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, msg?: string) => void;
  error:   (title: string, msg?: string) => void;
  warn:    (title: string, msg?: string) => void;
  info:    (title: string, msg?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
});

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-white/70" />,
  error:   <XCircle    size={16} className="text-white/50" />,
  warning: <AlertCircle size={16} className="text-white/60" />,
  info:    <Info       size={16} className="text-white/60" />,
};

const BG: Record<ToastType, string> = {
  success: "rgba(255,255,255,0.07)",
  error:   "rgba(255,255,255,0.04)",
  warning: "rgba(255,255,255,0.05)",
  info:    "rgba(255,255,255,0.06)",
};

const BORDER: Record<ToastType, string> = {
  success: "rgba(255,255,255,0.18)",
  error:   "rgba(255,255,255,0.1)",
  warning: "rgba(255,255,255,0.12)",
  info:    "rgba(255,255,255,0.14)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-3), { id, type, title, message }]);
    setTimeout(() => remove(id), 4500);
  }, [remove]);

  const success = useCallback((t: string, m?: string) => toast("success", t, m), [toast]);
  const error   = useCallback((t: string, m?: string) => toast("error", t, m),   [toast]);
  const warn    = useCallback((t: string, m?: string) => toast("warning", t, m), [toast]);
  const info    = useCallback((t: string, m?: string) => toast("info", t, m),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warn, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="toast pointer-events-auto min-w-[280px] max-w-[360px]"
              style={{ background: BG[t.type], borderColor: BORDER[t.type] }}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 shrink-0">{ICONS[t.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                  {t.message && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{t.message}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);