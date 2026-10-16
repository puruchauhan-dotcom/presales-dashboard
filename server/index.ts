import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { getData } from "./data.js";
import { askGemini, compact, type ChatMsg } from "./chat.js";
import { addQuestion, answerQuestion, listQuestions } from "./questions.js";
import { applyFilters, defaultFilters, type Filters } from "../shared/filters.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "";
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("pd:" + PASSWORD).digest("hex");
const COOKIE = "pd_session";
const sign = (v: string) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
const token = () => { const exp = String(Date.now() + 7 * 864e5); return `${exp}.${sign(exp)}`; };
const valid = (t?: string) => {
  if (!t) return false; const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const attempts = new Map<string, { n: number; at: number }>();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// ---- CREATOR bot API (bearer token, independent of the user session) ----
const CREATOR_TOKEN = process.env.CREATOR_API_TOKEN ?? "";
const bearer: express.RequestHandler = (req, res, next) => {
  const got = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer\s+/i, "")); const want = Buffer.from(CREATOR_TOKEN);
  if (!CREATOR_TOKEN || got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: "Unauthorized" });
  next();
};
app.get("/api/questions", bearer, async (req, res) => res.json(await listQuestions(typeof req.query.status === "string" ? req.query.status : undefined)));
app.post("/api/questions/:id/answer", bearer, async (req, res) => {
  const answer = String(req.body?.answer ?? "").trim(); if (!answer) return res.status(400).json({ error: "answer required" });
  const q = await answerQuestion(String(req.params.id), answer, String(req.body?.answeredBy ?? "CREATOR")); q ? res.json(q) : res.status(404).json({ error: "not found" });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/session", (req, res) => res.json({ required: !!PASSWORD, authed: !PASSWORD || valid(req.cookies[COOKIE]) }));
app.post("/api/login", (req, res) => {
  const ip = req.ip ?? "x"; const a = attempts.get(ip) ?? { n: 0, at: Date.now() };
  if (Date.now() - a.at > 15 * 60e3) { a.n = 0; a.at = Date.now(); }
  if (a.n >= 10) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const given = Buffer.from(String(req.body?.password ?? "")); const want = Buffer.from(PASSWORD);
  const ok = !PASSWORD || (given.length === want.length && crypto.timingSafeEqual(given, want));
  if (!ok) { a.n++; attempts.set(ip, a); return res.status(401).json({ error: "Wrong password" }); }
  attempts.delete(ip);
  res.cookie(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 864e5 });
  res.json({ ok: true });
});
app.post("/api/logout", (_req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });

app.use("/api", (req, res, next) => (!PASSWORD || valid(req.cookies[COOKIE]) ? next() : res.status(401).json({ error: "Unauthorized" })));
app.get("/api/data", async (req, res) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json(await getData(req.query.refresh === "1")); }
  catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// ---- AI chat (user session) ----
const chatHits = new Map<string, number[]>();
app.post("/api/chat", async (req, res) => {
  const k = req.ip ?? "x"; const now = Date.now(); const hits = (chatHits.get(k) ?? []).filter(t => now - t < 60_000);
  if (hits.length >= 30) return res.status(429).json({ error: "Rate limit: 30 messages per minute" });
  hits.push(now); chatHits.set(k, hits);
  const messages = (Array.isArray(req.body?.messages) ? req.body.messages : []).filter((m: ChatMsg) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string") as ChatMsg[];
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "messages must end with a user message" });
  const useFilters = !!req.body?.useFilters; const f: Filters = { ...defaultFilters, ...(req.body?.filters ?? {}) };
  try {
    const data = await getData();
    const view = useFilters ? { ...data, ...applyFilters(data, f) } : data;
    const desc = useFilters ? Object.entries(f).filter(([key, v]) => v && v !== (defaultFilters as unknown as Record<string, string>)[key]).map(([key, v]) => `${key}=${v}`).join(", ") : "";
    const out = await askGemini(messages, compact(view), desc);
    let escalated: string | undefined;
    if (out.insufficient) escalated = (await addQuestion(messages[messages.length - 1].content, "insufficient-data", desc)).id;
    res.json({ answer: out.text, model: out.model, insufficient: out.insufficient, escalatedId: escalated });
  } catch (e) { const err = e as Error & { status?: number }; console.error("chat error:", err.message); res.status(err.status ?? 500).json({ error: err.message }); }
});
app.post("/api/escalate", async (req, res) => {
  const q = String(req.body?.question ?? "").trim(); if (!q) return res.status(400).json({ error: "question required" });
  res.json(await addQuestion(q, "user-request", String(req.body?.context ?? "")));
});
app.get("/api/inbox", async (_req, res) => res.json(await listQuestions()));

if (process.env.NODE_ENV === "production") {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`Presales dashboard on :${PORT} (gate ${PASSWORD ? "on" : "off"})`));
