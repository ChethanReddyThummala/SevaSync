// ================================================================
//  SevaSync.jsx — Complete Frontend (wired to real backend)
//
//  What changed from the mock version:
//  ✅ Real login/register screen using api.js
//  ✅ All data fetched from backend (surveys, stats, insights)
//  ✅ Survey form submits to backend (offline-queue when no network)
//  ✅ AI chat calls real /api/ai/ask via askAI()
//  ✅ Report generation calls /api/reports/generate
//  ✅ Auto-sync offline queue when network returns
//  ✅ Role-based UI (field workers see limited views)
//  ✅ Real-time poll every 30s to stay fresh
// ================================================================

import { useState, useEffect, useCallback } from "react";
import {
  login, register, logout, getUser, getToken,
  getSurveys, createSurvey,
  getStats, getInsights, askAI,
  generateReport, getReports,
  getUsers, updateUserRole, updateSurveyStatus,
  registerOnlineSync, getOfflineQueue,
  APIError,
} from "./api";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:      "#070D1A",
  surface: "#0E1624",
  card:    "#131C2E",
  card2:   "#182236",
  border:  "#1D2B45",
  accent:  "#00D4AA",
  blue:    "#3B82F6",
  amber:   "#F59E0B",
  danger:  "#EF4444",
  green:   "#10B981",
  purple:  "#8B5CF6",
  text:    "#EEF2FF",
  muted:   "#7A8FAD",
};

const sevColor = (s) =>
  ({ Critical: T.danger, High: T.amber, Medium: T.blue, Low: T.green }[s] || T.muted);

// ── Small reusable primitives ─────────────────────────────────
const Badge = ({ children, color }) => (
  <span style={{
    background: color + "20", color, border: `1px solid ${color}40`,
    borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Card = ({ children, style, glow }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: 20, boxShadow: glow ? `0 0 28px ${glow}18` : "0 2px 12px #00000050",
    ...style,
  }}>{children}</div>
);

const Btn = ({ children, onClick, color = T.accent, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: color, color: [T.accent, T.green].includes(color) ? T.bg : "#fff",
    border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700,
    fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit", transition: "opacity 0.2s", ...style,
  }}>{children}</button>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ color: T.muted, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>}
    <input {...props} style={{
      width: "100%", background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "10px 14px", color: T.text, fontSize: 14,
      outline: "none", fontFamily: "inherit", boxSizing: "border-box",
      ...props.style,
    }} />
  </div>
);

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 32, height: 32, border: `3px solid ${T.border}`,
      borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>
);

const Empty = ({ msg }) => (
  <div style={{ textAlign: "center", padding: "48px 0", color: T.muted }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
    <div style={{ fontSize: 14 }}>{msg}</div>
  </div>
);

const ErrBanner = ({ err, onClose }) =>
  err ? (
    <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`,
      borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.danger,
      fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      ⚠️ {err}
      <span onClick={onClose} style={{ cursor: "pointer", fontSize: 16 }}>✕</span>
    </div>
  ) : null;

const SuccessBanner = ({ msg, onClose }) =>
  msg ? (
    <div style={{ background: T.green + "18", border: `1px solid ${T.green}44`,
      borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.green,
      fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      ✅ {msg}
      <span onClick={onClose} style={{ cursor: "pointer", fontSize: 16 }}>✕</span>
    </div>
  ) : null;

// ================================================================
//  LOGIN / REGISTER SCREEN
// ================================================================
function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState("login");   // "login" | "register"
  const [form, setForm]       = useState({ name: "", email: "", password: "", role: "field_worker", region: "All", lang: "English" });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const result = mode === "login"
        ? await login(form.email, form.password)
        : await register(form);
      onAuth(result.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, background: `linear-gradient(135deg,${T.accent},${T.blue})`,
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 14px" }}>🌿</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.text }}>SevaSync</div>
          <div style={{ fontSize: 12, color: T.muted, letterSpacing: "0.12em", marginTop: 2 }}>
            HUMANITARIAN DATA PLATFORM
          </div>
        </div>

        <Card>
          {/* Tab switcher */}
          <div style={{ display: "flex", background: T.surface, borderRadius: 10,
            padding: 4, marginBottom: 24, gap: 4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
                flex: 1, background: mode === m ? T.card2 : "transparent",
                border: "none", borderRadius: 8, padding: "8px 0", color: mode === m ? T.text : T.muted,
                fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize",
              }}>{m}</button>
            ))}
          </div>

          <ErrBanner err={err} onClose={() => setErr("")} />

          {mode === "register" && (
            <Input label="Full Name" value={form.name} onChange={set("name")} placeholder="Priya Mehta" />
          )}
          <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@sevasync.org" />
          <Input label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />

          {mode === "register" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 6 }}>Role</div>
                <select value={form.role} onChange={set("role")} style={{
                  width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: "10px 14px", color: T.text, fontSize: 14,
                  outline: "none", fontFamily: "inherit",
                }}>
                  <option value="field_worker">Field Worker</option>
                  <option value="ngo">NGO Partner</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Input label="Region" value={form.region} onChange={set("region")} placeholder="e.g. Rayalaseema" />
            </>
          )}

          <Btn onClick={submit} disabled={loading} style={{ width: "100%", padding: "12px 0", fontSize: 15 }}>
            {loading ? "Please wait…" : mode === "login" ? "🔐 Sign In" : "🚀 Create Account"}
          </Btn>

          {mode === "login" && (
            <div style={{ marginTop: 16, padding: 12, background: T.surface, borderRadius: 8,
              fontSize: 12, color: T.muted, textAlign: "center" }}>
              Demo → <strong style={{ color: T.text }}>admin@sevasync.org</strong> / <strong style={{ color: T.text }}>admin123</strong>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ================================================================
//  SURVEY MODAL  (create new survey — real backend call)
// ================================================================
function SurveyModal({ onClose, onSubmitted }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({ category: "", severity: "", region: "", notes: "", photo: false, location: false, lang: "English" });
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(null);
  const [err, setErr]     = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const payload = {
        category: form.category, severity: form.severity,
        region:   form.region,   notes:    form.notes,
        lang:     form.lang,
        location: form.location ? { lat: 14.4426, lng: 78.8489, accuracy: 4 } : null,
      };
      const result = await createSurvey(payload);
      setDone(result.offline ? "offline" : "synced");
      if (onSubmitted) onSubmitted();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const CATS  = ["Health","Water","Food","Education","Shelter","Sanitation"];
  const SEVS  = ["Critical","High","Medium","Low"];
  const LANGS = ["English","Telugu","Hindi","Urdu","Tamil"];

  const SelRow = ({ options, val, onChange, colorFn }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(o => {
        const c = colorFn ? colorFn(o) : T.accent;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            background: val === o ? c + "30" : T.surface,
            border: `1px solid ${val === o ? c : T.border}`,
            borderRadius: 8, padding: "6px 14px", color: val === o ? c : T.muted,
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          }}>{o}</button>
        );
      })}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000C", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto",
        boxShadow: `0 0 60px ${T.accent}18` }}>

        {done ? (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{done === "offline" ? "💾" : "✅"}</div>
            <div style={{ color: T.accent, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {done === "offline" ? "Saved Offline!" : "Survey Submitted!"}
            </div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>
              {done === "offline" ? "Will sync to cloud when you're back online" : "Synced to cloud database"}
            </div>
            <Btn onClick={onClose}>Back to Dashboard</Btn>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ color: T.accent, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 4 }}>NEW FIELD SURVEY</div>
                <div style={{ color: T.text, fontSize: 18, fontWeight: 800 }}>Data Collection</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                    background: step >= s ? T.accent : T.border,
                    color: step >= s ? T.bg : T.muted }}>{s}</div>
                ))}
              </div>
            </div>

            <ErrBanner err={err} onClose={() => setErr("")} />

            {step === 1 && (
              <div>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Language</div>
                <SelRow options={LANGS} val={form.lang} onChange={v => set("lang", v)} />
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, marginTop: 18 }}>Issue Category</div>
                <SelRow options={CATS} val={form.category} onChange={v => set("category", v)} />
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, marginTop: 18 }}>Severity</div>
                <SelRow options={SEVS} val={form.severity} onChange={v => set("severity", v)} colorFn={sevColor} />
                <Input label="Region / Village" value={form.region} onChange={e => set("region", e.target.value)}
                  placeholder="e.g. Rayalaseema" style={{ marginTop: 18 }} />
                <Btn onClick={() => setStep(2)} disabled={!form.category || !form.severity || !form.region}
                  style={{ width: "100%", marginTop: 8 }}>Continue →</Btn>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Field Notes</div>
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                  placeholder="Describe the situation, number of people affected, urgency…"
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, color: T.text, padding: 12, fontSize: 14, resize: "vertical",
                    minHeight: 110, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  {[["📷","Photo",  "photo"],["📍","GPS Tag","location"]].map(([ic, lb, key]) => (
                    <button key={key} onClick={() => set(key, !form[key])} style={{
                      flex: 1, background: form[key] ? T.accent + "20" : T.surface,
                      border: `1px solid ${form[key] ? T.accent : T.border}`,
                      borderRadius: 10, padding: "10px 0", color: form[key] ? T.accent : T.muted,
                      cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    }}>{ic} {lb}</button>
                  ))}
                </div>
                {form.location && (
                  <div style={{ background: T.surface, border: `1px solid ${T.accent}30`,
                    borderRadius: 8, padding: "8px 12px", marginTop: 10, color: T.accent, fontSize: 12 }}>
                    📍 GPS: 14.4426°N, 78.8489°E · Accuracy: 4m
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <Btn onClick={() => setStep(1)} color={T.border} style={{ flex: 1, color: T.muted }}>← Back</Btn>
                  <Btn onClick={() => setStep(3)} style={{ flex: 2 }}>Review →</Btn>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Review Before Submit</div>
                {[
                  ["Category", form.category], ["Severity", form.severity],
                  ["Region",   form.region],   ["Language", form.lang],
                  ["Notes",    form.notes || "—"],
                  ["Photo",    form.photo    ? "Attached" : "None"],
                  ["Location", form.location ? "GPS Tagged" : "Not tagged"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between",
                    padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                    <span style={{ color: T.muted }}>{k}</span>
                    <span style={{ color: T.text, fontWeight: 600, maxWidth: "60%", textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                {!navigator.onLine && (
                  <div style={{ marginTop: 12, padding: 10, background: T.amber + "15",
                    border: `1px solid ${T.amber}40`, borderRadius: 8, color: T.amber, fontSize: 12 }}>
                    🔌 Offline — will save locally and sync when connected
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <Btn onClick={() => setStep(2)} color={T.border} style={{ flex: 1, color: T.muted }}>← Edit</Btn>
                  <Btn onClick={submit} disabled={busy} style={{ flex: 2 }}>
                    {busy ? "Submitting…" : "🚀 Submit Survey"}
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ================================================================
//  REPORT MODAL
// ================================================================
function ReportModal({ onClose }) {
  const [busy, setBusy]     = useState(false);
  const [done, setDone]     = useState(null);
  const [err, setErr]       = useState("");
  const [type, setType]     = useState("weekly");

  const generate = async () => {
    setBusy(true); setErr("");
    try {
      const result = await generateReport({ type });
      setDone(result.report);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000C", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 28, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        boxShadow: `0 0 60px ${T.blue}18` }}>
        <div style={{ color: T.blue, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 4 }}>AUTOMATED REPORT</div>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Generate Field Report</div>
        <ErrBanner err={err} onClose={() => setErr("")} />

        {!done ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Report Type</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["weekly","monthly","emergency"].map(t => (
                  <button key={t} onClick={() => setType(t)} style={{
                    flex: 1, background: type === t ? T.blue + "25" : T.surface,
                    border: `1px solid ${type === t ? T.blue : T.border}`,
                    borderRadius: 8, padding: "8px 0", color: type === t ? T.blue : T.muted,
                    cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                    textTransform: "capitalize",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <Btn onClick={generate} disabled={busy} color={T.blue} style={{ width: "100%" }}>
              {busy ? "⚙️ AI Generating Report…" : "⚡ Generate Report"}
            </Btn>
          </>
        ) : (
          <div>
            <div style={{ background: T.green + "15", border: `1px solid ${T.green}40`,
              borderRadius: 10, padding: "10px 14px", color: T.green, fontSize: 12, marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8 }}>
              ✅ Report ready · Generated by Claude AI
            </div>
            <div style={{ background: T.surface, borderRadius: 10, padding: 16,
              color: T.text, fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap",
              maxHeight: 340, overflowY: "auto", border: `1px solid ${T.border}` }}>
              {done.content}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={onClose} color={T.blue} style={{ flex: 1 }}>📥 Save Report</Btn>
              <Btn onClick={onClose} color={T.green} style={{ flex: 1 }}>✕ Close</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
//  MAIN APP
// ================================================================
export default function SevaSync() {
  const [user,    setUser]    = useState(() => getUser());
  const [tab,     setTab]     = useState("dashboard");
  const [modal,   setModal]   = useState(null);

  // Data state
  const [stats,    setStats]    = useState(null);
  const [surveys,  setSurveys]  = useState([]);
  const [insights, setInsights] = useState([]);
  const [users,    setUsers]    = useState([]);

  // AI chat
  const [aiMsg,     setAiMsg]     = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // UI state
  const [loading, setLoading]   = useState(false);
  const [err,     setErr]       = useState("");
  const [success, setSuccess]   = useState("");
  const [filter,  setFilter]    = useState({});
  const [syncNote, setSyncNote] = useState("");
  const [online,  setOnline]    = useState(navigator.onLine);

  // ── Auth guard ───────────────────────────────────────────────
  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener("seva:logout", handleLogout);
    return () => window.removeEventListener("seva:logout", handleLogout);
  }, []);

  // ── Network status ───────────────────────────────────────────
  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // ── Auto-sync offline queue ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    return registerOnlineSync((result) => {
      setSyncNote(`Synced ${result.synced.length} offline surveys ✅`);
      fetchAll();
      setTimeout(() => setSyncNote(""), 5000);
    });
  }, [user]);

  // ── Fetch all data ───────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, sv, ins] = await Promise.all([
        getStats(),
        getSurveys(filter),
        getInsights(),
      ]);
      setStats(s);
      setSurveys(sv.surveys || []);
      setInsights(ins.insights || []);

      if (user.role === "admin") {
        const u = await getUsers();
        setUsers(u.users || []);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    fetchAll();
    // Poll every 30 seconds for real-time feel
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── AI ask ───────────────────────────────────────────────────
  const sendAI = async () => {
    if (!aiMsg.trim() || aiLoading) return;
    const userMsg = aiMsg.trim();
    setAiMsg("");
    setAiLoading(true);
    const newHistory = [...aiHistory, { role: "user", content: userMsg }];
    setAiHistory(newHistory);
    try {
      const result = await askAI(userMsg, aiHistory);
      setAiHistory([...newHistory, { role: "assistant", content: result.reply }]);
    } catch (e) {
      setAiHistory([...newHistory, { role: "assistant", content: `⚠️ Error: ${e.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Not logged in ────────────────────────────────────────────
  if (!user || !getToken()) {
    return <AuthScreen onAuth={u => { setUser(u); }} />;
  }

  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "surveys",   icon: "📋", label: "Surveys" },
    { id: "ai",        icon: "🤖", label: "AI Lab" },
    ...(["admin","analyst","ngo"].includes(user.role) ? [{ id: "reports", icon: "📄", label: "Reports" }] : []),
    ...(user.role === "admin" ? [{ id: "users", icon: "👥", label: "Team" }] : []),
  ];

  const offlineCount = getOfflineQueue().length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .fade{animation:fadeUp .35s ease both}
        .hov:hover{border-color:${T.accent}55!important;transform:translateY(-1px);transition:all .2s}
        textarea:focus,input:focus{border-color:${T.accent}!important}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: `linear-gradient(135deg,${T.accent},${T.blue})`,
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>SevaSync</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.1em" }}>HUMANITARIAN DATA PLATFORM</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              background: tab === n.id ? T.accent + "20" : "transparent",
              border: `1px solid ${tab === n.id ? T.accent + "60" : "transparent"}`,
              borderRadius: 9, padding: "6px 13px", color: tab === n.id ? T.accent : T.muted,
              cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            }}>{n.icon} {n.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Network status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
            color: online ? T.green : T.amber }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%",
              background: online ? T.green : T.amber,
              animation: "pulse 2s infinite" }} />
            {online ? "Live" : "Offline"}
            {offlineCount > 0 && <Badge color={T.amber}>{offlineCount} queued</Badge>}
          </div>
          {/* User badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: "capitalize" }}>{user.role}</div>
            </div>
            <button onClick={() => { logout(); setUser(null); }} style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "5px 10px", color: T.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Sync / offline banners */}
      {syncNote && (
        <div style={{ background: T.green + "18", borderBottom: `1px solid ${T.green}30`,
          padding: "8px 24px", color: T.green, fontSize: 13 }}>{syncNote}</div>
      )}
      {!online && (
        <div style={{ background: T.amber + "18", borderBottom: `1px solid ${T.amber}30`,
          padding: "8px 24px", color: T.amber, fontSize: 13 }}>
          🔌 You are offline — surveys will be saved locally and synced when you reconnect
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
        <ErrBanner err={err} onClose={() => setErr("")} />
        <SuccessBanner msg={success} onClose={() => setSuccess("")} />

        {/* ════ DASHBOARD ════ */}
        {tab === "dashboard" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Good day, {user.name} 👋</h1>
                <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
                  {stats ? `${stats.total} surveys · ${stats.critical} critical · ${stats.regions} regions active` : "Loading…"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {["admin","analyst","ngo"].includes(user.role) && (
                  <Btn onClick={() => setModal("report")} color={T.blue}>📄 Generate Report</Btn>
                )}
                <Btn onClick={() => setModal("survey")}>+ New Survey</Btn>
              </div>
            </div>

            {loading && !stats ? <Spinner /> : (
              <>
                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
                  {[
                    { label: "Total Surveys",   value: stats?.total    ?? "—", icon: "📋", color: T.accent },
                    { label: "Critical Issues", value: stats?.critical ?? "—", icon: "🚨", color: T.danger },
                    { label: "Active Regions",  value: stats?.regions  ?? "—", icon: "📍", color: T.blue   },
                    { label: "Field Workers",   value: stats?.workers  ?? "—", icon: "👥", color: T.green  },
                  ].map((s, i) => (
                    <Card key={i} glow={s.color} style={{ cursor: "default" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
                          <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                        </div>
                        <div style={{ fontSize: 28 }}>{s.icon}</div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Category breakdown */}
                {stats?.byCategory && (
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>📊 Issues by Category</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {Object.entries(stats.byCategory).map(([cat, count]) => {
                        const total = stats.total || 1;
                        const pct   = Math.round((count / total) * 100);
                        const color = { Health: T.danger, Water: T.blue, Food: T.green, Education: T.purple, Shelter: T.amber, Sanitation: T.accent }[cat] || T.muted;
                        return (
                          <div key={cat} style={{ flex: "1 1 140px", background: T.surface,
                            borderRadius: 10, padding: 12, border: `1px solid ${color}30` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color }}>{cat}</span>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{count}</span>
                            </div>
                            <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1s" }} />
                            </div>
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{pct}% of total</div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* AI Insights */}
                {insights.length > 0 && (
                  <Card glow={T.purple}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🤖 AI Pattern Detection</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
                      {insights.map((ins, i) => (
                        <div key={i} className="hov" style={{
                          background: T.surface, borderRadius: 12, padding: 14,
                          border: `1px solid ${T.border}`, cursor: "pointer",
                        }}>
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{ins.icon}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ins.title}</div>
                          <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{ins.desc}</div>
                          <Badge color={ins.type === "critical" ? T.danger : ins.type === "high" ? T.amber : ins.type === "medium" ? T.blue : T.green}>
                            {ins.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ SURVEYS ════ */}
        {tab === "surveys" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>📋 Field Surveys</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All","Critical","High","Health","Water","Food"].map(f => (
                  <button key={f} onClick={() => {
                    const newFilter = f === "All" ? {} :
                      ["Critical","High","Medium","Low"].includes(f) ? { severity: f } : { category: f };
                    setFilter(newFilter);
                  }} style={{
                    background: (JSON.stringify(filter) === JSON.stringify(f === "All" ? {} : ["Critical","High"].includes(f) ? { severity: f } : { category: f }))
                      ? T.accent + "25" : T.card,
                    border: `1px solid ${T.border}`,
                    color: T.muted, borderRadius: 8, padding: "5px 14px",
                    cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                  }}>{f}</button>
                ))}
                <Btn onClick={() => setModal("survey")}>+ Add Survey</Btn>
              </div>
            </div>

            {loading ? <Spinner /> : surveys.length === 0 ? (
              <Empty msg="No surveys found. Submit your first survey using the button above." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {surveys.map((s, i) => (
                  <div key={s.id} className="hov" style={{
                    background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                    padding: 16, display: "flex", alignItems: "center", gap: 14,
                    animation: `fadeUp .3s ease ${i * 0.04}s both`,
                  }}>
                    <div style={{ width: 44, height: 44, background: sevColor(s.severity) + "20",
                      borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {{ Health:"🏥", Water:"💧", Food:"🌾", Education:"📚", Shelter:"🏠", Sanitation:"🚿" }[s.category] || "📋"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.workerName || "Field Worker"}</span>
                        <Badge color={T.muted}>{s.region}</Badge>
                        <Badge color={sevColor(s.severity)}>{s.severity}</Badge>
                        {s.location && <Badge color={T.blue}>📍 GPS</Badge>}
                        {s.photo    && <Badge color={T.accent}>📷 Photo</Badge>}
                      </div>
                      <div style={{ color: T.muted, fontSize: 13, marginBottom: 3 }}>{s.notes || "—"}</div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.muted }}>
                        <span>📁 {s.category}</span>
                        <span>🌐 {s.lang}</span>
                        <span>🕐 {new Date(s.createdAt?.seconds ? s.createdAt.seconds * 1000 : s.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <Badge color={s.status === "Resolved" ? T.green : s.status === "Submitted" ? T.blue : s.status === "Escalated" ? T.danger : T.amber}>
                        {s.status}
                      </Badge>
                      {["admin","analyst"].includes(user.role) && s.status !== "Resolved" && (
                        <button onClick={async () => {
                          await updateSurveyStatus(s.id, s.status === "Submitted" ? "Under Review" : "Resolved");
                          fetchAll();
                        }} style={{ background: "transparent", border: `1px solid ${T.border}`,
                          borderRadius: 6, padding: "3px 8px", color: T.muted,
                          cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          {s.status === "Submitted" ? "Mark Reviewing" : "Resolve"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ AI LAB ════ */}
        {tab === "ai" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>🤖 AI Analysis Lab</h2>
                <p style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
                  Powered by Claude · Analyzes {stats?.total || 0} live surveys
                </p>
              </div>
              <Badge color={T.purple}>claude-opus-4-5</Badge>
            </div>

            {/* Insights cards */}
            {insights.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12, marginBottom: 20 }}>
                {insights.map((ins, i) => (
                  <Card key={i} glow={ins.type === "critical" ? T.danger : T.purple}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>{ins.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{ins.title}</div>
                    <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{ins.desc}</div>
                    <Badge color={ins.type === "critical" ? T.danger : ins.type === "high" ? T.amber : T.blue}>{ins.action}</Badge>
                  </Card>
                ))}
              </div>
            )}

            {/* AI Chat */}
            <Card glow={T.purple}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>💬 Ask the AI Analyst</div>

              {/* Chat history */}
              <div style={{ background: T.surface, borderRadius: 12, padding: 16, marginBottom: 14,
                minHeight: 180, maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {aiHistory.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13, textAlign: "center", margin: "auto" }}>
                    Ask anything about your field data…
                  </div>
                ) : aiHistory.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    background: m.role === "user" ? T.accent + "20" : T.card2,
                    border: `1px solid ${m.role === "user" ? T.accent + "40" : T.border}`,
                    borderRadius: 12, padding: "10px 14px", maxWidth: "82%",
                    fontSize: 13, lineHeight: 1.65, color: T.text, whiteSpace: "pre-wrap",
                  }}>
                    {m.role === "assistant" && <div style={{ color: T.purple, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>AI ANALYST</div>}
                    {m.content}
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ alignSelf: "flex-start", background: T.card2, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: "10px 14px", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0,1,2].map(j => (
                      <div key={j} style={{ width: 7, height: 7, background: T.purple, borderRadius: "50%",
                        animation: `pulse 0.9s ${j * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick prompts */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  "Which regions need urgent medical teams?",
                  "Summarise today's critical issues",
                  "What's the biggest water risk right now?",
                  "Predict next week's hotspots",
                ].map(q => (
                  <button key={q} onClick={() => setAiMsg(q)} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: "5px 12px", color: T.muted,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}>{q}</button>
                ))}
              </div>

              {/* Input */}
              <div style={{ display: "flex", gap: 10 }}>
                <input value={aiMsg} onChange={e => setAiMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAI()}
                  placeholder="Ask about patterns, regions, urgent actions…"
                  style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, padding: "11px 16px", color: T.text, fontSize: 14,
                    outline: "none", fontFamily: "inherit" }} />
                <Btn onClick={sendAI} disabled={aiLoading || !aiMsg.trim()} color={T.purple}>
                  {aiLoading ? "⏳" : "Ask AI"}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ════ REPORTS ════ */}
        {tab === "reports" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>📄 Field Reports</h2>
              <Btn onClick={() => setModal("report")} color={T.blue}>⚡ Generate New Report</Btn>
            </div>
            <Card>
              <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                Click "Generate New Report" to create an AI-written field summary.<br />
                Generated reports will appear here.
              </div>
            </Card>
          </div>
        )}

        {/* ════ TEAM (admin only) ════ */}
        {tab === "users" && user.role === "admin" && (
          <div className="fade">
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>👥 Team & Access</h2>
            {loading ? <Spinner /> : users.length === 0 ? (
              <Empty msg="No users found." />
            ) : (
              <Card>
                {users.map((u, i) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 0", borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 40, height: 40, background: T.accent + "20", borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {{ admin:"👨🏾‍💻", field_worker:"🧑🏽‍🌾", ngo:"🏢", analyst:"📊" }[u.role] || "👤"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                      <div style={{ color: T.muted, fontSize: 12 }}>{u.email} · {u.region}</div>
                    </div>
                    <select value={u.role} onChange={async e => {
                      await updateUserRole(u.id, e.target.value);
                      setSuccess(`${u.name}'s role updated to ${e.target.value}`);
                      fetchAll();
                    }} style={{ background: T.surface, border: `1px solid ${T.border}`,
                      color: T.text, borderRadius: 8, padding: "5px 10px", fontSize: 12,
                      cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                      {["admin","field_worker","ngo","analyst"].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <Badge color={u.status === "active" ? T.green : T.amber}>{u.status}</Badge>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === "survey" && (
        <SurveyModal onClose={() => setModal(null)} onSubmitted={() => { fetchAll(); setSuccess("Survey submitted successfully!"); }} />
      )}
      {modal === "report" && <ReportModal onClose={() => setModal(null)} />}

      {/* ── Footer ── */}
      <div style={{ background: T.surface, borderTop: `1px solid ${T.border}`,
        padding: "10px 24px", display: "flex", justifyContent: "space-between",
        alignItems: "center", fontSize: 11, color: T.muted }}>
        <span>🌿 SevaSync v2.0 · Humanitarian Data Platform</span>
        <div style={{ display: "flex", gap: 16 }}>
          <span>🔌 Offline-ready</span>
          <span>🔐 JWT secured</span>
          <span>🌐 Multi-language</span>
          <span style={{ color: online ? T.green : T.amber }}>● {online ? "Connected" : "Offline"}</span>
        </div>
      </div>
    </div>
  );
}
