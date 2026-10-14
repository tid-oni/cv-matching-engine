import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Users, Search, Shield, Loader2, ToggleLeft, ToggleRight,
  UserCheck, UserX, Crown, User,
} from "lucide-react";
import { getAdminUsers, toggleUser } from "../../api/platform";
import { useI18n } from "../../context/I18nContext";
import type { User as UserType } from "../../types";

function BriefcaseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

const roleMeta: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  admin:     { label: "Admin",     cls: "bg-white/[0.1] text-white/70 border-white/15",   icon: <Crown size={10} /> },
  recruiter: { label: "Recruiter", cls: "bg-white/[0.07] text-white/55 border-white/10",  icon: <BriefcaseIcon size={10} /> },
  candidate: { label: "Candidate", cls: "bg-white/[0.05] text-white/45 border-white/8",   icon: <User size={10} /> },
};

export default function AdminUsers() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    getAdminUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: number) => {
    setToggling(id);
    try {
      await toggleUser(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u));
    } finally {
      setToggling(null);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchR = roleFilter === "all" || u.role === roleFilter;
    return matchQ && matchR;
  });

  const counts = {
    all:       users.length,
    candidate: users.filter(u => u.role === "candidate").length,
    recruiter: users.filter(u => u.role === "recruiter").length,
    admin:     users.filter(u => u.role === "admin").length,
    active:    users.filter(u => u.is_active).length,
    inactive:  users.filter(u => !u.is_active).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 right-1/4" style={{ width: 320, height: 320, opacity: 0.20 }} />
      <div className="blob-magenta animate-blob-2 absolute bottom-0 -left-20" style={{ width: 300, height: 300, opacity: 0.18 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
              {t("Admin · Users")}
            </p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">{t("User Management")}</h1>
            <p className="text-white/40 text-sm">
              <span className="text-iridescent-soft font-semibold">{counts.all}</span> users · {counts.active} active · {counts.inactive} inactive
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.10] text-iridescent-soft text-xs font-medium"
            style={{ background: "rgba(167,139,250,0.06)" }}>
            <Shield size={12} /> {t("Admin view")}
          </div>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Candidates", count: counts.candidate, opacity: 0.9 },
          { label: "Recruiters", count: counts.recruiter, opacity: 0.65 },
          { label: "Admins",     count: counts.admin,     opacity: 0.45 },
        ].map(({ label, count, opacity }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="text-xl font-bold text-white" style={{ opacity }}>{count}</div>
            <div className="text-xs mt-0.5 text-white/35">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Search + filter */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3 mb-5"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 transition-all"
            placeholder="Search users by name or email…"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/60 text-sm focus:outline-none focus:border-white/20 transition-all"
        >
          <option value="all" className="bg-black">All roles</option>
          <option value="candidate" className="bg-black">Candidate</option>
          <option value="recruiter" className="bg-black">Recruiter</option>
          <option value="admin" className="bg-black">Admin</option>
        </select>
      </motion.div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <Users size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/30">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u, i) => {
            const rm = roleMeta[u.role] || roleMeta.candidate;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  u.is_active
                    ? "border-white/[0.06] bg-white/[0.02]"
                    : "border-white/[0.03] bg-white/[0.01] opacity-50"
                }`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  u.is_active
                    ? "bg-white/[0.12] text-white"
                    : "bg-white/[0.05] text-white/40"
                }`}>
                  {u.full_name[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white truncate">{u.full_name}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${rm.cls}`}>
                      {rm.icon} {rm.label}
                    </span>
                    {!u.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/5">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/30 truncate">{u.email}</p>
                  {u.company && <p className="text-xs text-white/20">{u.company}</p>}
                </div>

                {/* Date */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/20">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    {u.is_active
                      ? <UserCheck size={11} className="text-white/50" />
                      : <UserX size={11} className="text-white/25" />
                    }
                    <span className={`text-[10px] ${u.is_active ? "text-white/50" : "text-white/25"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                {u.role !== "admin" && (
                  <button
                    onClick={() => handleToggle(u.id)}
                    disabled={toggling === u.id}
                    title={u.is_active ? "Suspend user" : "Reactivate user"}
                    className={`p-1.5 rounded-lg transition-all ${
                      u.is_active
                        ? "text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                        : "text-white/25 hover:text-white/50 hover:bg-white/[0.06]"
                    }`}
                  >
                    {toggling === u.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : u.is_active ? (
                      <ToggleRight size={20} />
                    ) : (
                      <ToggleLeft size={20} />
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}