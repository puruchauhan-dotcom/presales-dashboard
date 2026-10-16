# Presales Command Center (Paytm Pi)

Interactive web dashboard for **Puru - Personal Presales Tracker** (Google Sheet).
Stack: **Vite + React 18 + TypeScript + Tailwind + Recharts** frontend, **Express 5 (Node 20)** server, Google Sheets API (read-only).

## Features
- KPI overview (deals, demos & delivery rate, meetings held & notes coverage, presales effort)
- Global filters: period, deal stage, sales rep, demo status, demo type, free-text search (charts are click-to-filter)
- Deal pipeline: Kanban board by stage + sortable/searchable table, drill-down drawer (SPOC, use case, notes, next steps, blockers, POC owners…)
- Demo pipeline: status tiles, type mix, requester chart, table + drawer
- Meetings: month calendar heatmap, timeline with Gemini summaries/decisions/actions, prep briefs, F2F reimbursement
- Weekly trend charts (12 weeks), "attention needed" signals
- Data-quality panel: completeness score, per-field gaps, worst rows, possible duplicate reps
- Dark/light theme, password gate (HMAC-signed httpOnly cookie, rate-limited login), auto refresh every 5 min + manual refresh

## Data layer
`server/data.ts` reads tabs `Presales Tracker`, `Demo Pipeline`, `Meetings`, `Prep`, `F2F Reimbursement` via the Sheets API
using a service account (`GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`), caches 5 min (`CACHE_TTL_SECONDS`), serves the last good copy on errors,
and falls back to `data/snapshot.json` when env vars are missing. Normalisation (mixed dates like `2026-10-16 (Fri)`) lives in `shared/model.ts`.
`data/snapshot.json` contains real client data: it is git-ignored and excluded from the Docker image.

## Run locally
```bash
npm install
npm run dev            # vite on :5173, API on :8787
# or production mode
npm run build && DASHBOARD_PASSWORD=choose-one npm start   # http://localhost:8787
```

## Deploy to Railway
1. Google Cloud: create a service account with no roles (or reuse an approved one), enable the Google Sheets API, create a JSON key.
2. Share the sheet with the service-account email as **Viewer**.
3. Push this folder to a private GitHub repo → Railway → New project → Deploy from repo (uses `Dockerfile` + `railway.json`, healthcheck `/api/health`).
4. Set variables: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (one-line JSON or base64), `DASHBOARD_PASSWORD`, `SESSION_SECRET` (random string). `PORT` is injected by Railway.
5. Generate a domain under Settings → Networking.

Never commit `.env` or key files (already in `.gitignore`).

## AI chat + "Ask CREATOR" escalation
- Floating chat (bottom-right on every page) → `POST /api/chat` (session-protected, 30 req/min per IP). Gemini REST, grounded only in the
  current dataset (compact JSON, long text trimmed, **email addresses removed** before sending). Optional "use active filters".
- If the model says the data is insufficient, or the user clicks **Ask CREATOR to check Gmail/Calendar**, the question is queued
  (`POST /api/escalate`, `GET /api/inbox` for the UI tab "Ask CREATOR").
- CREATOR bot API (header `Authorization: Bearer $CREATOR_API_TOKEN`, independent of the user session):
  - `GET /api/questions?status=open`
  - `POST /api/questions/:id/answer` with JSON `{ "answer": "...", "answeredBy": "CREATOR" }`
- Queue persists to `$DATA_DIR/questions.json`. **Without a Railway volume it is wiped on every redeploy.**
- Note: the chat sends tracker data (client names, deal notes) to Google's Gemini API. Confirm this is approved before enabling `GEMINI_API_KEY` in production.
