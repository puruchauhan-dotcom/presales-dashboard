import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

export interface Question { id: string; question: string; context?: string; reason: "insufficient-data" | "user-request"; status: "open" | "answered"; createdAt: string; answer?: string; answeredAt?: string; answeredBy?: string; }
const dir = () => path.resolve(process.env.DATA_DIR || "./runtime");
const file = () => path.join(dir(), "questions.json");
let chain: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Question[]> { try { return JSON.parse(await readFile(file(), "utf8")); } catch { return []; } }
async function writeAll(q: Question[]) { await mkdir(dir(), { recursive: true }); const tmp = file() + ".tmp"; await writeFile(tmp, JSON.stringify(q, null, 1)); await rename(tmp, file()); }
const locked = <T>(fn: () => Promise<T>) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };

export const listQuestions = (status?: string) => readAll().then(q => (status ? q.filter(x => x.status === status) : q).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export const addQuestion = (question: string, reason: Question["reason"], context?: string) => locked(async () => {
  const all = await readAll();
  const q: Question = { id: crypto.randomUUID(), question: question.slice(0, 2000), context: context?.slice(0, 2000), reason, status: "open", createdAt: new Date().toISOString() };
  all.push(q); await writeAll(all); return q;
});
export const answerQuestion = (id: string, answer: string, by = "CREATOR") => locked(async () => {
  const all = await readAll(); const q = all.find(x => x.id === id); if (!q) return null;
  Object.assign(q, { answer: answer.slice(0, 10000), status: "answered", answeredAt: new Date().toISOString(), answeredBy: by }); await writeAll(all); return q;
});
