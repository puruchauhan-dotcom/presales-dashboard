import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { getData } from "./data.js";

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

if (process.env.NODE_ENV === "production") {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`Presales dashboard on :${PORT} (gate ${PASSWORD ? "on" : "off"})`));
