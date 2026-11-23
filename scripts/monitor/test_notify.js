const assert = require('assert');
const { audienceFor } = require('./gtu_watch');
const { buildEvents } = require('./notify');

let passed = 0;

function ok(name, check) {
  assert.ok(check(), name);
  passed++;
}

const notices = [{
  id: 1,
  rawTitle: 'Notification for Result Declaration of Diploma in Engineering Sem 4 (Information Technology) of Summer - 2026 Examination',
  title: 'Notification for Result Declaration of Diploma in Engineering Sem 4 (Information Technology) of Summer - 2026 Examination',
  facts: {
    programShort: 'DE',
    semester: 4,
    session: 'Summer 2026',
    resultKind: 'main'
  }
}];

ok('audience carries program, semester, branch and domain', () => {
  const audience = audienceFor(notices);
  assert.deepStrictEqual(audience.programs, ['de']);
  assert.deepStrictEqual(audience.semesters, [4]);
  assert.deepStrictEqual(audience.branches, ['it']);
  assert.deepStrictEqual(audience.domains, ['diploma']);
  assert.strictEqual(audience.session, 'Summer 2026');
  assert.strictEqual(audience.resultKind, 'main');
  return true;
});

ok('audience expands semester ranges', () => {
  const audience = audienceFor([{
    rawTitle: 'BE Sem 1 to 3 result',
    facts: { programShort: 'BE', semesterFrom: 1, semesterTo: 3 }
  }]);
  assert.deepStrictEqual(audience.semesters, [1, 2, 3]);
  assert.deepStrictEqual(audience.domains, ['be']);
  return true;
});

const report = {
  postsPublished: [{
    slug: 'gtu-result-declaration-summer-2026',
    type: 'result',
    notices: 2,
    title: 'GTU result declaration Summer 2026',
    url: '/blog/gtu-result-declaration-summer-2026.html',
    publishedAt: '2026-09-27T12:00:00.000Z',
    topicKey: 'result:summer-2026:main',
    audience: {
      programs: ['de'],
      domains: ['diploma'],
      branches: ['it'],
      semesters: [4],
      session: 'Summer 2026',
      resultKind: 'main'
    },
    noticeIds: [1, 2]
  }]
};

ok('notification event is concise and targeted', () => {
  const events = buildEvents(report);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].id, 'gtu_gtu-result-declaration-summer-2026');
  assert.strictEqual(events[0].doc.title, 'GTU Diploma Sem 4 result declared');
  assert.ok(events[0].doc.body.includes('Summer 2026'));
  assert.ok(events[0].doc.body.includes('2 official circulars'));
  assert.strictEqual(events[0].doc.url, 'https://khudkibook.in/blog/gtu-result-declaration-summer-2026.html');
  assert.strictEqual(events[0].doc.status, 'pending');
  assert.deepStrictEqual(events[0].doc.audience.programs, ['de']);
  assert.deepStrictEqual(events[0].doc.audience.semesters, [4]);
  assert.deepStrictEqual(events[0].doc.noticeIds, [1, 2]);
  return true;
});

ok('refreshed posts do not create events', () => {
  const events = buildEvents({ postsPublished: [], postsRefreshed: report.postsPublished });
  assert.strictEqual(events.length, 0);
  return true;
});

console.log(`notify: ${passed} checks passed`);
