const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve the public folder for content (site_db.json, generated pages)
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: 0,
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
}));

// Serve the Admin Panel at /admin
app.use('/admin', express.static(path.join(__dirname, '../admin-panel')));

const DATA_FILE = path.join(__dirname, '../data/site_db.json');

// Get Database Endpoint (Admin only)
app.get('/api/db', (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
        res.sendFile(DATA_FILE);
    } else {
        res.status(404).json({ status: 'error', message: 'Database file not found at data/site_db.json' });
    }
});

// Save Database Endpoint
app.post('/api/save', (req, res) => {
    try {
        const newData = JSON.stringify(req.body, null, 2);
        fs.writeFileSync(DATA_FILE, newData);
        console.log("Database updated via Private Admin Panel.");
        res.json({ status: 'success', message: 'Database saved successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Build Site Endpoint
app.post('/api/build', (req, res) => {
    console.log("Triggering site generation...");
    exec('node scripts/generate.js', { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ status: 'error', message: stderr });
        }
        console.log(stdout);
        res.json({ status: 'success', message: 'Site generated successfully!' });
    });
});

// Import crawler lazily to keep startup cheap
let crawler = null;
function getCrawler() {
    if (!crawler) crawler = require('./crawler/gtu_crawler');
    return crawler;
}

function validateCrawlRequest(type, payload) {
    const allowed = {
        notices: ['limit'],
        syllabus: ['limit', 'subjectCodes', 'delay'],
        papers: ['limit', 'subjectCodes', 'years', 'extypes', 'delay'],
        sync: ['limit', 'subjectCodes', 'years', 'paperLimit', 'syllabusLimit', 'noticesLimit', 'skipNotices', 'skipSyllabus', 'skipPapers', 'delay']
    };
    const keys = allowed[type] || [];
    const clean = {};
    for (const k of keys) {
        if (payload[k] !== undefined) clean[k] = payload[k];
    }
    const intFields = ['limit', 'paperLimit', 'syllabusLimit', 'noticesLimit', 'delay'];
    for (const f of intFields) {
        if (clean[f] !== undefined && typeof clean[f] === 'string') clean[f] = parseInt(clean[f], 10);
    }
    return clean;
}

function streamCrawlLogs(res, logFn) {
    const logs = [];
    const send = (msg) => {
        logs.push(msg);
        try { res.write(`data: ${JSON.stringify({ log: msg })}\n\n`); } catch (e) { /* client closed */ }
    };
    const opts = { log: send };
    logFn(opts)
        .then(() => {
            try {
                res.write(`data: ${JSON.stringify({ status: 'done', logs })}\n\n`);
                res.end();
            } catch (e) { /* ignore */ }
        })
        .catch(err => {
            try {
                res.write(`data: ${JSON.stringify({ status: 'error', message: err.message, logs })}\n\n`);
                res.end();
            } catch (e) { /* ignore */ }
        });
}

function startCrawl(type, pay) {
    const c = getCrawler();
    switch (type) {
        case 'notices':
            return c.runNotices(pay).then(notices => ({ count: notices.length, notices }));
        case 'syllabus':
            return c.runSyllabus(pay).then(syllabus => ({ count: syllabus.length, syllabus }));
        case 'papers':
            return c.runPapers(pay).then(papers => ({ count: papers.length, papers }));
        case 'sync':
            return c.runSync(pay);
        default:
            throw new Error('Unknown crawl type');
    }
}

for (const type of ['notices', 'syllabus', 'papers', 'sync']) {
    app.post(`/api/crawl/${type}`, (req, res) => {
        console.log(`/api/crawl/${type} triggered`);
        const pay = validateCrawlRequest(type, req.body || {});
        const acceptSSE = (req.headers.accept || '').includes('text/event-stream');
        if (acceptSSE) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            streamCrawlLogs(res, (opts) => startCrawl(type, { ...pay, ...opts }));
        } else {
            startCrawl(type, pay)
                .then(result => res.json({ status: 'success', ...result }))
                .catch(err => res.status(500).json({ status: 'error', message: err.message }));
        }
    });
}

// ============================ Phase 4: AI Book Job Runner ============================
const { spawn } = require('child_process');
const crypto = require('crypto');

const AI_JOBS_FILE = path.join(__dirname, '../data/ai_jobs.json');
const AI_RUN_SCRIPT = path.join(__dirname, 'ai_book', 'run_subject.js');
const AI_BOOK_DEFS = path.join(__dirname, '../data/ai_books');
const AI_PUBLIC_BOOKS = path.join(__dirname, '../public/books');

const AI_STEP_SETS = {
    syllabus: ['syllabus'],
    fullbook: ['syllabus', 'generate', 'translate', 'build', 'fullbook', 'patch', 'rebuild', 'manifest'],
    unit: ['generate', 'build', 'patch', 'manifest'],
    regen: ['generate', 'build', 'patch', 'manifest'],
    gu: ['translate', 'build', 'manifest']
};

let aiJobs = [];
let aiRunning = null;
const aiListeners = {};   // jobId -> Set of callbacks
const aiChilds = {};      // jobId -> child process

function loadAiJobs() {
    try { aiJobs = JSON.parse(fs.readFileSync(AI_JOBS_FILE, 'utf8')); } catch (_) { aiJobs = []; }
}
function saveAiJobs() {
    fs.mkdirSync(path.dirname(AI_JOBS_FILE), { recursive: true });
    fs.writeFileSync(AI_JOBS_FILE, JSON.stringify(aiJobs, null, 1));
}
loadAiJobs();
// A server restart orphans any "running" job — mark it interrupted so the
// single slot frees up and stale jobs never wedge the queue.
for (const j of aiJobs) {
    if (j.status === 'running') {
        j.status = 'interrupted';
        j.error = 'Server restarted — job interrupted';
        j.finishedAt = new Date().toISOString();
    }
}
if (aiJobs.some(j => j.status === 'interrupted')) saveAiJobs();

function emitAi(id, patch) {
    const fns = aiListeners[id];
    if (fns) [...fns].forEach(f => { try { f(patch, id); } catch (_) { /* ignore */ } });
}
function attachAi(id, fn) {
    (aiListeners[id] = aiListeners[id] || new Set()).add(fn);
    return () => (aiListeners[id] || new Set()).delete(fn);
}
function aiLog(job, msg) {
    job.logs = [...(job.logs || []), msg];
    emitAi(job.id, { logs: [msg], progress: job.progress, stepLabel: job.stepLabel, status: job.status });
}
function jobTick(job, patch) {
    Object.assign(job, patch);
    saveAiJobs();
    emitAi(job.id, patch);
}

function wipeUnitCache(code, units) {
    const dataDir = path.join(AI_BOOK_DEFS, String(code));
    if (!fs.existsSync(dataDir)) return;
    const statePath = path.join(dataDir, 'state.json');
    let state = {};
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) { /* ignore */ }
    for (const n of units) {
        const prefix = `unit${n}:`;
        const toDelete = new Set([]);
        for (const k of Object.keys(state)) {
            if (!k.startsWith(prefix)) continue;
            const fileKey = `${k}:file`;
            if (state[fileKey] && String(state[fileKey]).startsWith('part-')) toDelete.add(state[fileKey]);
            delete state[k]; delete state[fileKey];
        }
        toDelete.forEach(f => { const p = path.join(dataDir, f); if (fs.existsSync(p)) fs.unlinkSync(p); });
        for (const f of [`unit-${n}.md`, `unit-${n}.gu.md`]) {
            const p = path.join(dataDir, f); if (fs.existsSync(p)) fs.unlinkSync(p);
        }
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function runJobArgs(job) {
    const args = ['scripts/ai_book/run_subject.js', '--code', String(job.code)];
    if (job.gu) args.push('--gu');
    if (job.units && job.units.length) args.push('--units', job.units.join(','));
    args.push('--steps', (job.steps || AI_STEP_SETS[job.type] || []).join(','));
    return args;
}

function finishAiJob(job, status, message) {
    job.status = status;
    job.finishedAt = new Date().toISOString();
    job.stepLabel = message || job.stepLabel;
    if (status === 'done') job.progress = 100;
    job.error = (status === 'error' || status === 'cancelled') ? message : undefined;
    delete aiChilds[job.id];
    saveAiJobs();
    emitAi(job.id, { status: job.status, finishedAt: job.finishedAt, progress: job.progress, error: job.error, stepLabel: job.stepLabel });
    aiRunning = null;
    sweepAi();
}

function spawnAiJob(job) {
    if (job.type === 'regen' && job.units) wipeUnitCache(job.code, job.units);
    job.status = 'running';
    job.progress = 0;
    job.stepIndex = 0;
    job.stepCount = Math.max(1, (job.steps || []).length);
    job.stepLabel = 'starting';
    job.startedAt = new Date().toISOString();
    job.logs = job.logs || [];
    saveAiJobs();

    const args = runJobArgs(job);
    const child = spawn(process.execPath, args, { cwd: path.join(__dirname, '..') });
    aiChilds[job.id] = child;

    emitAi(job.id, { status: 'running', startedAt: job.startedAt });

    const outBuf = { data: '' };
    child.stdout.on('data', d => {
        outBuf.data += d.toString();
        const lines = outBuf.data.split('\n');
        outBuf.data = lines.pop();
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            const m = line.match(/^── (.+?) ──$/);
            if (m) {
                job.stepIndex = Math.min(job.stepIndex + 1, job.stepCount);
                jobTick(job, { stepLabel: m[1], progress: Math.min(95, Math.round((job.stepIndex / job.stepCount) * 100)) });
            }
            aiLog(job, line);
        }
        if (job.cancelRequested) child.kill('SIGTERM');
    });
    child.stderr.on('data', d => aiLog(job, d.toString().trim()));

    child.on('error', err => finishAiJob(job, 'error', err.message || 'spawn error'));
    child.on('close', code => {
        if (job.cancelRequested) return finishAiJob(job, 'cancelled', 'Cancelled by admin');
        finishAiJob(job, code === 0 && statusLine(job) !== 'error' ? 'done' : 'error', code === 0 ? 'completed' : `exit code ${code}`);
    });
}
function statusLine(job) { return job.error || ''; }

function sweepAi() {
    if (aiRunning) {
        const cur = aiJobs.find(j => j.id === aiRunning);
        if (!cur) aiRunning = null; // job list changed
        else if (!aiChilds[cur.id]) {
            // child never spawned (crash/restart orphan) — close it out
            aiRunning = null;
            finishAiJob(cur, 'interrupted', 'Job process lost — interrupted');
        } else return;
    }
    const next = aiJobs.find(j => j.status === 'queued' && !j.cancelRequested);
    if (!next) return;
    aiRunning = next.id;
    spawnAiJob(next);
}
setInterval(sweepAi, 4000);

function enqueueAiJob(body) {
    const types = new Set(Object.keys(AI_STEP_SETS));
    const type = String(body.type || '');
    if (!types.has(type)) return { error: `type must be one of: ${[...types].join(', ')}` };
    const code = String(body.code || '');
    if (!/^\d{5,8}$/.test(code)) return { error: 'code must be the numeric GTU subject code' };
    if (type === 'fullbook' && body.units) return { error: 'fullbook generates every unit — do not pass units' };
    const units = body.units && body.units.length ? body.units.map(Number).filter(Boolean) : null;
    if (type !== 'fullbook' && type !== 'syllabus' && (!units || !units.length)) return { error: `type ${type} needs --units (comma separated unit numbers)` };
    if (type === 'gu' && !body.gu) body.gu = true; // gu jobs imply gu

    const id = 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const job = {
        id,
        type,
        code,
        units,
        gu: !!body.gu,
        status: 'queued',
        progress: 0,
        stepIndex: 0,
        stepCount: (AI_STEP_SETS[type] || []).length,
        stepLabel: 'queued',
        logs: [],
        steps: AI_STEP_SETS[type],
        createdAt: new Date().toISOString(),
        cancelRequested: false
    };
    aiJobs.push(job);
    saveAiJobs();
    sweepAi();
    return { job };
}

function buildAiCatalog() {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // memoized dir scan of generated books
    let booksDir;
    try { booksDir = fs.readdirSync(AI_PUBLIC_BOOKS); } catch (_) { booksDir = []; }
    const aiState = {};
    for (const code of booksDir) {
        let files = [];
        try { files = fs.readdirSync(path.join(AI_PUBLIC_BOOKS, code)); } catch (_) { /* ignore */ }
        aiState[code] = {
            units: files.filter(f => /^unit-\d+\.html$/.test(f)).map(f => +f.match(/^unit-(\d+)\.html$/)[1]).sort((a, b) => a - b),
            gu: files.filter(f => /^unit-\d+-gu\.html$/.test(f)).map(f => +f.match(/^unit-(\d+)-gu\.html$/)[1]).sort((a, b) => a - b),
            full: files.includes('full-book.html'),
            fullGu: files.includes('full-book-gu.html')
        };
    }

    const out = [];
    // unitdef.json (parsed syllabus) is the source of truth for the unit list
    let aiDefs = {};
    try { for (const code of fs.readdirSync(AI_BOOK_DEFS)) {
        const p = path.join(AI_BOOK_DEFS, code, 'unitdef.json');
        if (!fs.existsSync(p)) continue;
        try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); if (d && Array.isArray(d.units) && d.units.length) aiDefs[code] = d; } catch (_) { /* ignore */ }
    } } catch (_) { /* ignore */ }
    for (const u of db.universities || []) for (const d of u.domains || []) for (const b of d.branches || []) for (const s of b.semesters || []) {
        for (const sub of s.subjects || []) {
            const code = String(sub.code || '');
            if (!code) continue;
            const mats = sub.materials || [];
            const ai = aiState[code] || { units: [], gu: [], full: false, fullGu: false };
            const realBook = mats.some(m => m.type === 'book' && !/syallbus/i.test(m.link || '') && !/syllabus/i.test(m.label || ''));
            const syllabus = mats.some(m => /syallbus|syllabus/i.test((m.link || '') + ' ' + (m.label || '')));
            const papers = mats.some(m => m.type === 'paper' || /paper/i.test(m.label || ''));
            out.push({
                code,
                name: sub.name || `Subject ${code}`,
                branch: `${u.name || ''} ${b.name || b.shortName || ''}`.trim(),
                sem: s.name || '',
                slug: sub.slug || code,
                page: `/${b.id || ''}/${s.id || ''}/${(sub.slug || code)}.html`,
                realBook: !!realBook,
                hasSyllabus: !!syllabus,
                hasPapers: !!papers,
                aiUnits: ai.units,
                aiGu: ai.gu,
                aiFull: ai.full,
                aiFullGu: ai.fullGu,
                unitsKnown: !!aiDefs[code],
                unitCount: aiDefs[code] ? aiDefs[code].units.length : (ai.units.length ? Math.max(...ai.units) : 0),
                unitTitles: aiDefs[code] ? aiDefs[code].units.map(x => ({ n: x.n, title: x.title, marks: x.marks || null })) : []
            });
        }
    }
    return out;
}

// ---- endpoints ----
app.get('/api/ai/catalog', (req, res) => {
    try {
        let cat = buildAiCatalog();
        const q = String(req.query.q || '').toLowerCase();
        if (q) cat = cat.filter(x => x.code.includes(q) || x.name.toLowerCase().includes(q) || x.branch.toLowerCase().includes(q));
        if (req.query.filter === 'missing') cat = cat.filter(x => !x.aiUnits.length);
        if (req.query.filter === 'core') cat = cat.filter(x => x.realBook || x.aiUnits.length || x.hasSyllabus);
        const want = req.query.badge ? String(req.query.badge) : null;
        if (want === 'papers') cat = cat.filter(x => x.hasPapers);
        if (want === 'ai') cat = cat.filter(x => x.aiUnits.length);
        cat.sort((a, b) => (b.realBook || 0) - (a.realBook || 0) || (b.aiUnits.length || 0) - (a.aiUnits.length || 0) || a.code.localeCompare(b.code));
        const limit = Math.max(1, Math.min(2000, parseInt(req.query.limit, 10) || 300));
        res.json({ status: 'success', total: cat.length, subjects: cat.slice(0, limit) });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/ai/jobs', (req, res) => res.json({ status: 'success', running: aiRunning, jobs: aiJobs }));

app.post('/api/ai/jobs', (req, res) => {
    const r = enqueueAiJob(req.body || {});
    if (r.error) return res.status(400).json({ status: 'error', message: r.error });
    console.log(`[AI] enqueued ${r.job.type} job ${r.job.id} for ${r.job.code}`);
    res.json({ status: 'success', job: r.job });
});

app.post('/api/ai/jobs/:id/cancel', (req, res) => {
    const job = aiJobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ status: 'error', message: 'job not found' });
    if (job.status === 'queued') return finishAiJob(job, 'cancelled', 'Cancelled by admin') || res.json({ status: 'success', job });
    if (job.status === 'running') {
        job.cancelRequested = true;
        saveAiJobs();
        const child = aiChilds[job.id];
        if (child) { try { child.kill('SIGTERM'); } catch (_) { /* ignore */ } }
        return res.json({ status: 'success', message: 'cancel requested' });
    }
    res.json({ status: 'success', message: 'job already finished' });
});

app.post('/api/ai/jobs/:id/retry', (req, res) => {
    const job = aiJobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ status: 'error', message: 'job not found' });
    job.status = 'queued';
    job.cancelRequested = false;
    job.error = undefined;
    job.finishedAt = null;
    job.logs = [];
    saveAiJobs();
    sweepAi();
    res.json({ status: 'success', job });
});

app.get('/api/ai/jobs/:id/events', (req, res) => {
    const job = aiJobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ status: 'error', message: 'job not found' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const detach = attachAi(job.id, (patch) => {
        try { res.write(`data: ${JSON.stringify(patch)}\n\n`); } catch (_) { detach(); }
    });
    emitAi(job.id, { snapshot: true, status: job.status, progress: job.progress, stepLabel: job.stepLabel, logs: job.logs, error: job.error, finishedAt: job.finishedAt });
    req.on('close', detach);
});

app.listen(PORT, () => {
    console.log(`
    =========================================
    KHUDKIBOOK PRIVATE ADMIN SYSTEM ACTIVE
    Access: http://localhost:${PORT}
    =========================================
    `);
});
