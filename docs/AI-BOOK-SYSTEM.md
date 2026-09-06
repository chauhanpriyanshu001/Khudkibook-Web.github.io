# KhudKibook AI Book System — Full Plan & Architecture

Status: **IN PROGRESS**
Phases: 1–4. Each phase is marked DONE in this document and in the working todo list as it completes.

---

## 0. Goal

Turn every GTU subject without a real book into an **AI-generated self-study book** delivered as static HTML reader pages on KhudKibook, managed from the private admin panel, generated on the **local machine using Ollama** (no cloud), with diagrams, worked examples, Gujarati translation, print/PDF watermarking, and copy protection.

Deliverable per subject (full run):
- English chapter per unit (`unit-<n>.html`)
- Gujarati chapter per unit (`unit-<n>-gu.html`)
- Full-book page assembling all units (`full-book.html`)
- Structured JSON sidecars for the Flutter app / WebView (`unit-<n>.json`, `book.json`)
- Materials registered in `data/site_db.json` and site rebuilt via `scripts/generate.js`

## 1. Architecture Overview

```
                  ┌──────────────────────────────┐
 Admin Panel (admin-panel/)                       │
   AI Corner view ──► POST /api/ai/jobs           │
        │                                         │
        ▼                                         ▼
┌───────────────────────────┐      ┌──────────────────────────────────┐
│ scripts/server.js         │      │           JOB QUEUE             │
│  • REST + SSE endpoints   │      │  data/ai_jobs.json (persisted)  │
│  • Node job runner        │─1→1─►│  state.json per subject (cached)│
│  • queues jobs, streams   │      └──────────────┬───────────────────┘
│    progress to admin      │                     │ runs one subject at
└───────────────┬───────────┘                     │ a time (CPU bound)
                │                                 ▼
                │   ┌──────────────────────────────────────────────┐
                │   │ data/ai_books/<code>/                         │
                │   │  syllabus.txt        parsed unitdef.json      │
                │   │  part-s<key>.md[.gu]  unit-<n>.md[.gu]        │
                │   │  state.json                                   │
                │   └──────────────────────────────────────────────┘
                │                                 │
                ▼                                 ▼
        scripts/parse_syllabus.js  scripts/ollama_gen.js  scripts/translate_gu.js
        scripts/build_book_page.js scripts/assemble_book.js
                          │
                          ▼
       public/books/<code>/unit-<n>.html (+-gu) full-book.html unit-<n>.json book.json
                          │
                          ▼
        materials patched in data/site_db.json  →  scripts/generate.js rebuilds site
```

- **Hardware**: Ollama listens on `http://localhost:11434`; all generation is local.
- **Runtime**: Node 22 (scripts/server.js job manager). The browser side only renders static HTML.

## 2. Data & Material Conventions (`data/site_db.json`)

Material object shape used across the site:

```json
{ "type": "book", "label": "Unit-1", "link": "/books/4360302/unit-1.html", "year": "all", "language": "english", "ai": true }
```

- Types: `syllabus`, `book`, `paper`, `notes`, `solution`, `other`.
- `book` is split by the front-end `orderBooks()` into **Real books** (Drive links, `/books/…`) and **Backfill** ("GTU Book (Syllabus PDF)" pointing at the GTU S3 syllabus bucket).
- **"Real book" heuristic** (used by AI Corner):

```js
const isBackfillBook = m => m.type === 'book'
  && /gtusitecirculars/i.test(m.link || '')
  && /syallbus/i.test(m.link || '')
  && (m.label || '') === 'GTU Book (Syllabus PDF)';
```

- A subject "missing a real book" ⇒ none of its `book` materials are real.
- Baseline measured: **17,958 book materials → 17,087 backfill, 871 real, only 148 codes with ≥1 real book.**

## 3. File Layout

| Path | Purpose |
|---|---|
| `scripts/ai_book/ollama_gen.js` | EN generation per unit (streaming Ollama, cached parts) |
| `scripts/ai_book/translate_gu.js` | EN→Gujarati translation pass (cached) |
| `scripts/ai_book/build_book_page.js` | markdown→HTML reader page (mermaid, examples, print, protection, JSON sidecar) |
| `scripts/ai_book/assemble_book.js` | stitches `unit-*.html` into `full-book.html` + appends real-book materials |
| `scripts/ai_book/parse_syllabus.js` | syllabus PDF → text → unit/topic/outcome defs (`unitdef.json`) |
| `scripts/ai_book/run_subject.js` | chained job executor (syllabus → defs → gen → translate → build → assemble → DB → rebuild) |
| `data/ai_books/<code>/` | per-subject inputs, cached parts, state, output markdown |
| `public/books/<code>/` | published HTML + JSON sidecars |
| `data/ai_jobs.json` | persisted job queue for the Node runner |
| `scripts/server.js` | admin API + `/api/ai/*` endpoints + Job Runner |
| `admin-panel/ai.html` | AI Corner admin UI (catalog + jobs + progress) |

## 4. Generation Pipeline Details

### 4.1 parse_syllabus.js
1. Build syllabus URL: `https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/<code>.pdf` (fallback: `data/crawled_gtu_syllabus.json` + `data/gtu_full_subjects.json`).
2. `pdf-parse` (≥ v2.4.5, CJS entry `dist/pdf-parse/cjs/index.cjs`, `new PDFParse({data})` → `parser.getText()` → `parser.destroy()`).
3. Regex extraction:
   - Unit headers: `/Unit[\s–-]*([IVX]+|–?\d+)\b/i` … `.+`
   - Outcomes: `/(\d+[a-z])\.\s*(Define|Classify|Enlist|Explain|Describe|Compare|…).+?/`
   - Topic lines inside each unit block.
4. Writes `unitdef.json` (editable): `{ subject, branchLabel, unitSafe, units: [ { n, title, examWeight, uos[], topics[] } ] }`.

### 4.2 ollama_gen.js (EN)
- Single unit at a time; per-section streaming `POST /api/generate` (`stream:true` — mandatory; `stream:false` is killed by the 5-min server timeout).
- Content rules (SYSTEM prompt): diploma-level simple English, cover ONLY syllabus topics, define terms in bold, per-section **worked example** as blockquote `> **Example:** …`, **Mermaid diagrams** where they aid understanding (classification → `flowchart TD`; sequence → `flowchart LR`/`sequenceDiagram`), markdown tables, exam-oriented verbs.
- `promptVersion` in `state.json`: bump forces re-generation of all sections of a unit.
- Output: `part-s<key>.md` per section → assembled `unit-<n>.md`.
- Budget: ~900–1,100 words per theory section; ~3,000–3,500 words per unit.

### 4.3 translate_gu.js
- Reads `unit-<n>.md`, splits on `---` part separators, translates per chunk with `OLLAMA_GU_MODEL` (default `aya-expanse:8b`; qwen2.5 is not officially Gujarati-capable).
- Rules: keep markdown structure, tables, and ```mermaid blocks **verbatim** (translate only prose/headings/examples/glossary).
- Output: `unit-<n>.gu.md` → separate page `unit-<n>-gu.html` (`<html lang="gu">`, Noto Sans Gujarati fallback).
- Cache keys: `unit<n>:s<key>:gu`.

### 4.4 build_book_page.js (EN and GU pages)
Full feature set implemented in Phase 1/2:
- Face-lift (progress bar, sticky TOC, reading time, prev/next, EN⇄GU toggle).
- Ads (≤3 slots: top leaderboard, in-article mat, sticky mobile footer; lazy; hidden in print).
- Print/PDF with KHUDKIBOOK watermark + `@page` margin footer.
- Light copy protection (user-select:none, blocked context/copy/long-press on article).
- WebView-ready layout + JSON sidecar `unit-<n>.json`.
- Mermaid render + example cards (Phase 2).

### 4.5 run_subject.js (chained executor)
Order of operations for one subject:
1. `parse_syllabus` → `unitdef.json`
2. For each unit: `ollama_gen` (EN) → `translate_gu` (GU)
3. For each unit: `build_book_page` (EN) → (GU)
4. `assemble_book` → `full-book.html`
5. Patch `site_db.json`: keep real books, replace backfill with Unit-N/Full-Book, add GU variants, `ai:true`
6. Rebuild site (spawn `node scripts/generate.js`)
7. Update `data/ai_books/<code>/book.json` + log tail

## 5. Job Queue & Admin API (`server.js`)

- Queue persisted at `data/ai_jobs.json`:
```json
{ "jobs": [ { "id": "j_168…", "code": "4360302", "name": "Biomaterials & Implants",
  "type": "fullbook", "units": [1,2,3,4,5], "status": "running", "step": "unit3:translate",
  "progress": 0.62, "elapsedMs": 3600000, "etaMs": 2400000,
  "logFile": "data/ai_books/4360302/run.log", "createdAt": "…", "updatedAt": "…", "error": null } ] }
```
- Endpoints:
  - `GET /api/ai/jobs` — list + status
  - `POST /api/ai/jobs` — enqueue `{code, type:"fullbook"|"unit", unit?, doTranslate?}`
  - `POST /api/ai/jobs/:id/cancel` — cancel a queued/running job
  - `POST /api/ai/jobs/:id/retry` — resume after error (state.json makes this safe)
  - `GET /api/ai/catalog` — AI Corner catalog (subjects missing a real book, plus badges)
  - `GET /api/ai/jobs/:id/events` — SSE (status/step/progress/log tail)
- Runner: single worker slot (one subject at a time — Ollama is CPU-bound). On boot, pending `running` jobs are reset to `queued`. If an earlier job is `running`, new jobs go to `queued`.
- Progress is derived from `state.json` done keys + log-file tail; SSE re-emits the tail.

### Implemented (Phase 4 — delivered)

- Queue persisted at `data/ai_jobs.json` (array of job objects, saved on every transition).
- Job `type` ∈ `fullbook | unit | regen | gu`, each driving `run_subject.js` with a fixed step set:
  - `fullbook` → `syllabus,generate,translate,build,fullbook,patch,rebuild,manifest`
  - `unit`/`regen` → `generate,build,patch,manifest` (+ `regen` wipes the unit's parts/state first)
  - `gu` → `translate,build,manifest`
- `regen` clears `part-*.md` + `state.json` keys for the unit before regenerating.
- Runner: single active worker enforced via `sweepAi()` (4s tick). On restart, orphaned `running` jobs are marked `interrupted` so the slot never wedges.
- Endpoints: `/api/ai/catalog`, `/api/ai/jobs`, `POST /api/ai/jobs`, `/api/ai/jobs/:id/cancel`, `/api/ai/jobs/:id/retry`, `/api/ai/jobs/:id/events` (SSE).
- Catalog re-scan: derives `aiUnits` / `aiGu` / `aiFull` by scanning `public/books/<code>/`; publishes subject page link, `realBook`, `hasSyllabus`, `hasPapers`; supports `q`, `filter=missing|core`, `badge=papers|ai`.
- Admin UI at `/admin/ai.html` (linked from the admin header as **AI Corner**): subject catalog w/ per-unit `select`, Gen U / Regen U / GU / Full Book actions, jobs pane with progress bars, per-job live log drawer via SSE, cancel/retry.

## 6. Admin AI Corner (admin-panel/ai.html)

- Catalog lists subjects with **no real book**, navigable like the user-side tree (univ → domain → branch → sem → subject), with badges:
  - `syllabus` ✓/✗, `papers: N`, `ai-units: N` (from `data/ai_books/<code>/book.json`), `real-book` ✓/✗
- Filters: text search (name/code), top-100-core toggle (excludes names matching `/project|report|dissertation|training|internship|seminar|workshop|design|studio|review/i`).
- Per-subject actions: `Generate Full Book`, `Generate Unit N only`, `Translate to GU`, `Regenerate`, `Cancel`.
- Jobs pane: running list with progress bar, step, elapsed/ETA, live log tail; results link to the published book page.

## 7. Estimated Runtime (local Ollama, CPU)

| Step | Per unit | Notes |
|---|---|---|
| EN generate | ~26 min | qwen2.5:7b, ~3 tok/s, CPU |
| GU translate | ~18–22 min | aya-expanse:8b (or qwen fallback) |
| Build/assemble/DB/rebuild | ~2 min | fast |
| **Full book (5 units)** | **~4–6 h** | sequential; resumable |

- `state.json` caching makes failures cheap to resume.
- Concurrency kept at 1; DO NOT parallelize units on one machine.

## 8. Print / PDF & Watermark Spec

- `.no-print` hides navbar, footer, ads, toc, toggle.
- `@media print`: article becomes single column, base font ~11pt, tables fit width, anchors hidden.
- Watermark: repeated diagonal low-opacity **KHUDKIBOOK** tiles via `.print-watermark` (screen only via print stylesheet) + `@page @bottom-center` text `KhudKibook · <subject> · page X of Y`.
- "Download PDF" button → `window.print()` (browser save-as-PDF).

## 9. Copy Protection Spec (light)

- On `.kb-article` only: `user-select:none`, `-webkit-user-select:none`, `-webkit-touch-callout:none`.
- JS guards on book pages: `contextmenu`, `copy`, `cut`, `keydown` (Ctrl/Cmd+C) prevented on the article; status message "This content is protected by KhudKibook." printed to console/alert-free.
- Print is allowed (watermarked). SEO text and JSON sidecars remain un-encoded.

## 10. WebView / Flutter App Readiness

- `unit-<n>.json` sidecar schema:
```json
{ "code": "4360302", "unit": 1, "lang": "en", "title": "…", "subject": "…", "sections": [
  { "heading": "1.1 …", "html": "<h3>…</h3><p>…</p>", "examples": ["…"], "mermaid": ["flowchart TD …"] } ] }
```
- `book.json` manifest gains: `{ code, subject, branchLabel, subjectPage, units:[{n,label,file,guFile,sections}] }`.
- Pages are self-contained enough for WebView (CSS inline in `<style>`, only fonts/FA/mermaid from CDN); no service worker dependency.

---

## Phase Checklist

- [x] **Phase 1 — Book reader upgrades** (face-lift, ads, print+watermark, copy protection, WebView/JSON sidecars) — DONE: `build_book_page.js` rewritten; unit-1 published for 4360302
- [x] **Phase 2 — Generation engine** (examples+mermaid prompts, translate_gu, renderer upgrades) — DONE: prompt v2 + `translate_gu.js` + mermaid/example rendering + `--lang gu`
- [x] **Phase 3 — Auto pipeline** (parse_syllabus, run_subject chained executor) — DONE: `parse_syllabus.js`, `assemble_book.js`, `run_subject.js`
- [x] **Phase 4 — Admin AI Corner + Job Runner** (catalog, queue, SSE, actions) — DONE: `admin-panel/ai.html`, `data/ai_jobs.json`, runner + endpoints in `scripts/server.js`

Progress: **All phases delivered** — system ready for on-demand book generation via `/admin/ai.html`