import { readFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { TABS, normalise, type Dataset, type RawTabs } from "../shared/model.js";

const TTL = (Number(process.env.CACHE_TTL_SECONDS) || 300) * 1000;
let cache: { at: number; data: Dataset } | null = null;
let inflight: Promise<Dataset> | null = null;

function credentials(): Record<string, string> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const json = JSON.parse(text);
  if (json.private_key) json.private_key = String(json.private_key).replace(/\\n/g, "\n");
  return json;
}

async function fromSheets(sheetId: string, creds: Record<string, string>): Promise<RawTabs> {
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: TABS.map(t => `'${t}'!A1:AF2000`),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const out: RawTabs = {};
  res.data.valueRanges?.forEach((vr, i) => { out[TABS[i]] = (vr.values ?? []).map(r => r.map(v => String(v ?? ""))); });
  return out;
}

async function fromSnapshot(): Promise<RawTabs | null> {
  try {
    const file = path.join(process.cwd(), "data", "snapshot.json");
    return JSON.parse(await readFile(file, "utf8")).tabs as RawTabs;
  } catch { return null; }
}

async function load(): Promise<Dataset> {
  const sheetId = process.env.SHEET_ID?.trim();
  let error: string | undefined;
  try {
    const creds = credentials();
    if (sheetId && creds) {
      const tabs = await fromSheets(sheetId, creds);
      return { source: "google-sheets", fetchedAt: new Date().toISOString(), ...normalise(tabs) };
    }
  } catch (e) {
    error = `Google Sheets read failed: ${(e as Error).message}`;
    console.error(error);
    if (cache) return { ...cache.data, error }; // keep serving last good data
  }
  const snap = await fromSnapshot();
  if (snap) return { source: "snapshot", fetchedAt: new Date().toISOString(), error, ...normalise(snap) };
  return { source: "empty", fetchedAt: new Date().toISOString(), error: error ?? "No data source configured", ...normalise({}) };
}

export async function getData(force = false): Promise<Dataset> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  if (inflight) return inflight;
  inflight = load().then(d => { if (d.source !== "empty") cache = { at: Date.now(), data: d }; return d; }).finally(() => { inflight = null; });
  return inflight;
}
