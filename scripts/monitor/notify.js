const fs = require('fs');

const SITE_URL = 'https://khudkibook.in';

const PROGRAM_LABELS = {
  de: 'Diploma',
  be: 'B.E.',
  me: 'M.E.',
  'b.arch': 'B.Arch',
  'd.arch': 'D.Arch',
  'm.arch': 'M.Arch'
};

const KIND_LABELS = {
  main: 'result declared',
  recheck: 'recheck result declared',
  supplementary: 'supplementary result declared',
  'term-extension': 'term extension result declared'
};

function semLabel(semesters) {
  const values = Array.from(new Set((semesters || []).map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
  if (!values.length) return '';
  if (values.length === 1) return `Sem ${values[0]}`;
  return `Sem ${values[0]}-${values[values.length - 1]}`;
}

function buildEvents(report) {
  const posts = (report && report.postsPublished) || [];
  return posts.filter(post => post && post.slug && post.url).map(post => {
    const audience = post.audience || {};
    const programs = Array.isArray(audience.programs) ? audience.programs : [];
    const program = programs[0] ? (PROGRAM_LABELS[programs[0]] || programs[0].toUpperCase()) : '';
    const semesters = Array.isArray(audience.semesters) ? audience.semesters : [];
    const semester = semLabel(semesters);
    const kind = audience.resultKind ? (KIND_LABELS[audience.resultKind] || audience.resultKind.replace(/-/g, ' ')) : '';
    const headline = [program, semester, kind].filter(Boolean).join(' ');
    const title = headline ? `GTU ${headline}` : String(post.title || 'GTU update');
    const details = [audience.session, headline].filter(Boolean).join(' · ');
    const url = post.url.startsWith('http') ? post.url : `${SITE_URL}${post.url}`;
    const body = [
      details || String(post.title || 'New GTU update'),
      `${post.notices || 1} official circular${post.notices === 1 ? '' : 's'}. Tap for the full guide.`
    ].join(' — ').slice(0, 200);

    return {
      id: `gtu_${post.slug}`,
      doc: {
        source: 'gtu_watch',
        status: 'pending',
        topicKey: post.topicKey || '',
        type: post.type || '',
        slug: post.slug,
        title,
        body,
        url,
        audience: {
          programs,
          domains: Array.isArray(audience.domains) ? audience.domains : [],
          branches: Array.isArray(audience.branches) ? audience.branches : [],
          semesters
        },
        session: audience.session || '',
        resultKind: audience.resultKind || '',
        noticeIds: Array.isArray(post.noticeIds) ? post.noticeIds : [],
        createdAt: post.publishedAt || new Date().toISOString()
      }
    };
  });
}

function firestore() {
  let app;
  let cert;
  let getFirestore;
  try {
    app = require('firebase-admin/app');
    cert = require('firebase-admin/app').cert;
    getFirestore = require('firebase-admin/firestore').getFirestore;
  } catch (error) {
    return { db: null, reason: 'firebase-admin is not installed' };
  }

  try {
    if (app.getApps().length) return { db: getFirestore(), reason: '' };
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      const trimmed = serviceAccount.trim();
      const credential = trimmed.startsWith('{')
        ? cert(JSON.parse(trimmed))
        : cert(trimmed);
      app.initializeApp({ credential });
    } else {
      app.initializeApp();
    }
    return { db: getFirestore(), reason: '' };
  } catch (error) {
    return { db: null, reason: error && error.message ? error.message : String(error) };
  }
}

async function enqueue(events) {
  const { db, reason } = firestore();
  if (!db) {
    console.warn(`[notify] skipped: ${reason}`);
    return { queued: 0, skipped: events.length, total: events.length };
  }

  let queued = 0;
  let skipped = 0;
  for (const event of events) {
    try {
      await db.collection('notification_events').doc(event.id).create(event.doc);
      queued++;
    } catch (error) {
      const code = error && error.code;
      if (code === 6 || code === 'ALREADY_EXISTS' || code === 'already-exists') {
        skipped++;
      } else {
        throw error;
      }
    }
  }
  return { queued, skipped, total: events.length };
}

async function main() {
  const file = process.argv[2] || process.env.GTU_WATCH_REPORT;
  if (!file) {
    console.error('[notify] usage: node scripts/monitor/notify.js <watch-report.json>');
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const events = buildEvents(report);
  if (!events.length) {
    console.log('[notify] no new posts to notify');
    return;
  }
  const result = await enqueue(events);
  console.log(`[notify] queued ${result.queued}/${result.total} notification(s), skipped ${result.skipped}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('[notify] FATAL', error && error.message ? error.message : error);
    process.exit(1);
  });
}

module.exports = { buildEvents, enqueue, firestore, main, SITE_URL };
