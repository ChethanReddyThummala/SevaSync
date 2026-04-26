// ================================================================
//  SevaSync — Frontend API Client  (api.js)
//
//  BUGS FIXED from original:
//  ✅ FIX 1 — Authorization header added to ALL requests (was missing)
//  ✅ FIX 2 — askAI sends { message } not { query } (backend expects "message")
//  ✅ FIX 3 — Proper error handling on every call (was silently failing)
//
//  NEW ADDITIONS:
//  ✅ login / register / logout with automatic token management
//  ✅ getStats, getInsights, generateReport, getReports, getUsers
//  ✅ Offline survey queue — saves locally, syncs when back online
//  ✅ APIError class — structured errors for clean UI messages
//  ✅ Auto-sync listener — uploads queued surveys when network returns
// ================================================================

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
// ── Token & user helpers ──────────────────────────────────────
export const saveToken  = (t) => localStorage.setItem("seva_token", t);
export const getToken   = ()  => localStorage.getItem("seva_token");
export const clearToken = ()  => localStorage.removeItem("seva_token");
export const saveUser   = (u) => localStorage.setItem("seva_user", JSON.stringify(u));
export const getUser    = ()  => {
  try { return JSON.parse(localStorage.getItem("seva_user")); } catch { return null; }
};
export const clearUser = () => localStorage.removeItem("seva_user");

// ── Offline queue helpers ─────────────────────────────────────
const QUEUE_KEY = "seva_offline_queue";

export const getOfflineQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
};

const saveQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

export const addToOfflineQueue = (survey) => {
  const entry = {
    ...survey,
    offlineId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    savedAt: new Date().toISOString(),
  };
  saveQueue([...getOfflineQueue(), entry]);
  return entry;
};

export const clearOfflineQueue = () => localStorage.removeItem(QUEUE_KEY);

// ── Structured error ──────────────────────────────────────────
export class APIError extends Error {
  constructor(message, status = 0, isOffline = false) {
    super(message);
    this.name      = "APIError";
    this.status    = status;
    this.isOffline = isOffline;
  }
}

// ── Core fetch wrapper ────────────────────────────────────────
// All API calls go through this function.
// Handles: token injection, 401 auto-logout, error parsing.

async function request(path, options = {}) {
  if (!navigator.onLine) {
    throw new APIError("You are offline. Data will sync when reconnected.", 0, true);
  }

  const token = getToken();

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // ✅ FIX 1 — Authorization header now automatically included on every request
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, config);
  } catch {
    throw new APIError("Cannot reach the server. Is the backend running on port 8080?", 0);
  }

  // 401 → expired token, auto logout
  if (res.status === 401) {
    clearToken();
    clearUser();
    window.dispatchEvent(new Event("seva:logout"));
    throw new APIError("Session expired — please log in again.", 401);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new APIError(`Unexpected server response (HTTP ${res.status})`, res.status);
  }

  if (!res.ok) {
    const msg = body?.error || body?.message || `Request failed (${res.status})`;
    throw new APIError(msg, res.status);
  }

  return body;
}

// ================================================================
//  AUTH ROUTES
// ================================================================

/** Register a new user account. */
export async function register({ name, email, password, role = "field_worker", region = "All", lang = "English" }) {
  const body = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role, region, lang }),
  });
  if (body.token) saveToken(body.token);
  if (body.user)  saveUser(body.user);
  return body; // { message, user, token }
}

/** Login with email + password. Saves token automatically. */
export async function login(email, password) {
  const body = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (body.token) saveToken(body.token);
  if (body.user)  saveUser(body.user);
  return body; // { message, user, token }
}

/** Fetch the current logged-in user's profile from backend. */
export async function getMe() {
  return request("/auth/me");
}

/** Clear token + user data and fire logout event. */
export function logout() {
  clearToken();
  clearUser();
  window.dispatchEvent(new Event("seva:logout"));
}

// ================================================================
//  SURVEY ROUTES
// ================================================================

/**
 * Submit a new field survey.
 * If device is offline, saves to local queue and returns { offline: true }.
 *
 * @param {{
 *   category: "Health"|"Water"|"Food"|"Education"|"Shelter"|"Sanitation",
 *   severity: "Critical"|"High"|"Medium"|"Low",
 *   region:   string,
 *   notes?:   string,
 *   photo?:   string,   // base64 string or image URL
 *   location?: { lat: number, lng: number, accuracy: number },
 *   lang?:    string,
 * }} data
 */
export async function createSurvey(data) {
  if (!navigator.onLine) {
    const queued = addToOfflineQueue(data);
    return { offline: true, queued, message: "Saved offline — will sync when connected ✅" };
  }
  // ✅ FIX 1 — Authorization header now injected via request()
  return request("/surveys", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get surveys list with optional filters.
 * Field workers only see their own (enforced server-side).
 *
 * @param {{ region?, category?, severity?, status? }} filters
 */
export async function getSurveys(filters = {}) {
  // ✅ FIX 1 — Authorization header now injected via request()
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== "All"))
  ).toString();
  return request(`/surveys${params ? `?${params}` : ""}`);
}

/** Get a single survey by ID. */
export async function getSurvey(id) {
  return request(`/surveys/${id}`);
}

/**
 * Update a survey's workflow status. (admin / analyst only)
 * @param {"Submitted"|"Under Review"|"Resolved"|"Escalated"} status
 */
export async function updateSurveyStatus(id, status) {
  return request(`/surveys/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Delete a survey. (admin only) */
export async function deleteSurvey(id) {
  return request(`/surveys/${id}`, { method: "DELETE" });
}

// ================================================================
//  OFFLINE SYNC
// ================================================================

/**
 * Upload all locally queued offline surveys to the backend.
 * Call this when the network comes back online.
 */
export async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: [], skipped: [], message: "Nothing to sync" };

  const result = await request("/sync/offline", {
    method: "POST",
    body: JSON.stringify({ surveys: queue }),
  });
  clearOfflineQueue(); // wipe local queue after successful sync
  return result; // { message, synced: [ids], skipped: [offlineIds] }
}

// ================================================================
//  STATS
// ================================================================

/** Get dashboard stats — totals, category/severity/region breakdowns. */
export async function getStats() {
  return request("/stats");
}

// ================================================================
//  AI ROUTES
// ================================================================

/**
 * Ask the AI analyst a question about live field data.
 * The backend injects full survey context automatically.
 *
 * @param {string} message   — the question to ask
 * @param {Array}  history   — previous { role, content } turns for multi-turn chat
 *
 * ✅ FIX 2 — was sending { query } — backend requires { message }
 */
export async function askAI(message, history = []) {
  return request("/ai/ask", {
    method: "POST",
    // ✅ FIX 2 — correct field name is "message", not "query"
    body: JSON.stringify({ message, history }),
  });
  // Returns: { reply, surveysAnalyzed, criticalCount }
}

/**
 * Get instant rule-based pattern insights. Free — no AI API call.
 */
export async function getInsights() {
  return request("/ai/insights");
  // Returns: { insights: [{ type, icon, title, desc, action, regions? }] }
}

// ================================================================
//  REPORTS
// ================================================================

/**
 * Generate an AI-written field report. (admin / analyst / ngo only)
 * @param {{ type?: "weekly"|"monthly"|"emergency", region?: string }} opts
 */
export async function generateReport(opts = {}) {
  return request("/reports/generate", {
    method: "POST",
    body: JSON.stringify({ type: "weekly", region: "All", ...opts }),
  });
}

/** List all past reports (content preview only). */
export async function getReports() {
  return request("/reports");
}

/** Get one full report by ID. */
export async function getReport(id) {
  return request(`/reports/${id}`);
}

// ================================================================
//  USER MANAGEMENT  (admin only)
// ================================================================

/** List all platform users. */
export async function getUsers() {
  return request("/users");
}

/**
 * Change a user's role.
 * @param {"admin"|"field_worker"|"ngo"|"analyst"} role
 */
export async function updateUserRole(userId, role) {
  return request(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// ================================================================
//  NETWORK LISTENER — auto-sync when device comes back online
// ================================================================

/**
 * Call this once in your root App component's useEffect.
 * Automatically uploads offline queue whenever network reconnects.
 *
 * @param {Function} onSynced  — callback receives sync result
 * @returns cleanup function (pass to useEffect return)
 *
 * Usage:
 *   useEffect(() => registerOnlineSync((result) => console.log(result)), []);
 */
export function registerOnlineSync(onSynced) {
  const handler = async () => {
    const queue = getOfflineQueue();
    if (!queue.length) return;
    try {
      const result = await syncOfflineQueue();
      if (onSynced) onSynced(result);
    } catch (err) {
      console.error("Auto-sync failed:", err.message);
    }
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
