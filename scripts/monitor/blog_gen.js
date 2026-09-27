/**
 * Turns a group of related GTU circulars into a single canonical blog post.
 *
 * Why grouping: GTU publishes one circular per programme x semester for the same
 * real-world event (e.g. 26 separate "Result Declaration ... Summer-2026" PDFs in
 * a single day). Emitting a post per circular would be dozens of near-duplicate
 * thin pages, which is exactly the pattern search engines penalise. So each
 * *topic* owns exactly one post, and later circulars for the same topic merge
 * into that post instead of creating a new one.
 *
 * Editorial rule: every factual claim in the generated body is derived from the
 * circular titles themselves. Dates, fees and deadlines that are not present in
 * the source data are never invented — the post points at the official PDF and
 * tells the reader to confirm there.
 */

const fs = require('fs');
const path = require('path');
const { esc } = require('./gtu_source');

const SITE_URL = 'https://khudkibook.in';
const BLOG_DIR = path.join(__dirname, '../../public/blog');
const OG_IMAGE = 'https://khudkibook.in/assets/brand/og-gtu-notices.png';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function today() {
    return new Date().toISOString().slice(0, 10);
}

function prettyDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return String(iso || '');
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1] || ''} ${y}`;
}

/**
 * The date GTU itself announced the circulars behind a post, which is NOT the
 * date this post went live. A single date reads plainly; several collapse to a
 * range so the reader can see the window the circulars actually cover.
 */
function announcedLabel(group) {
    const dates = (group.members || [])
        .map(m => m.date)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')))
        .sort();
    if (!dates.length) return 'date not stated by GTU';
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (first === last) return prettyDate(first);
    return `${prettyDate(first)} to ${prettyDate(last)}`;
}

/** "Sem 1, 2, 3" from [1,2,3]; collapses ranges like 1-6. */
function formatSemesters(list) {
    const nums = Array.from(new Set(list.filter(n => Number.isFinite(n)))).sort((a, b) => a - b);
    if (!nums.length) return '';
    const parts = [];
    let i = 0;
    while (i < nums.length) {
        let j = i;
        while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
        if (j - i >= 2) parts.push(`${nums[i]}-${nums[j]}`);
        else for (let k = i; k <= j; k++) parts.push(String(nums[k]));
        i = j + 1;
    }
    return parts.join(', ');
}

/** Collapse the group's circulars into one row per programme. */
function summariseCoverage(members) {
    const byProgram = new Map();
    for (const m of members) {
        const f = m.facts || {};
        const name = f.program || (m.category || 'General');
        if (!byProgram.has(name)) byProgram.set(name, { name, short: f.programShort || '', sems: new Set(), kinds: new Set(), count: 0, sample: m });
        const row = byProgram.get(name);
        if (Number.isFinite(f.semester)) row.sems.add(f.semester);
        if (f.semesterFrom && f.semesterTo && !f.semester) {
            for (let s = f.semesterFrom; s <= f.semesterTo; s++) row.sems.add(s);
        }
        if (f.isRemedial) row.kinds.add('Remedial');
        if (f.isRegular) row.kinds.add('Regular');
        if (f.isTermExtension) row.kinds.add('Term Extension');
        if (f.isMinor) row.kinds.add('Minor');
        if (f.isBiAnnual) row.kinds.add('Bi-annual');
        row.count++;
    }
    return Array.from(byProgram.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map(r => ({
            name: r.name,
            sems: formatSemesters(Array.from(r.sems)),
            kinds: Array.from(r.kinds),
            count: r.count
        }));
}

function coverageTable(coverage) {
    if (!coverage.length) return '';
    const rows = coverage.map(c => {
        const kind = c.kinds.length ? c.kinds.join(' / ') : '—';
        return `            <tr>
              <td><strong>${esc(c.name)}</strong></td>
              <td>${c.sems ? esc(c.sems) : 'All'}</td>
              <td>${esc(kind)}</td>
              <td>${c.count}</td>
            </tr>`;
    }).join('\n');
    return `<table class="kb-table">
            <thead><tr><th>Programme</th><th>Semester(s)</th><th>Type</th><th>Circulars</th></tr></thead>
            <tbody>
${rows}
            </tbody>
          </table>`;
}

/** Every official PDF in the group, so readers can always reach the source. */
function documentList(members) {
    const seen = new Set();
    const items = [];
    for (const m of members) {
        const docs = (m.documents && m.documents.length) ? m.documents : (m.link ? [{ url: m.link, name: '' }] : []);
        for (const d of docs) {
            if (!d.url || seen.has(d.url)) continue;
            seen.add(d.url);
            items.push({ url: d.url, title: m.title, name: d.name || '', date: m.date, id: m.id });
        }
    }
    if (!items.length) return '';
    const rows = items.map(it => `            <li>
              <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>
              ${it.date ? `<br /><span style="font-size:0.82rem; color:var(--text-muted,#6b7280);">Announced by GTU on ${esc(prettyDate(it.date))}</span>` : ''}
            </li>`).join('\n');
    return `<h2>Official Circulars (PDF)</h2>
          <p>These are the exact circulars published by GTU, in the order they were released. Download and read the one that matches your programme.</p>
          <ul>
${rows}
          </ul>`;
}

const DISCLAIMER = (asOf) => `          <p style="font-size:0.82rem; color:var(--text-muted,#6b7280);">
            This article was generated automatically from official GTU circulars, newest of which GTU announced on ${esc(prettyDate(asOf))}.
            GTU changes dates, fees and deadlines from time to time &mdash; always confirm the current position in the
            official PDF or on your student portal before you act.
          </p>`;

const AUTHOR_BOX = `          <div class="kb-author-box">
            <img src="/assets/brand/khudkibook-logo.png" alt="Khudkibook" />
            <div>
              <p style="font-size:0.9rem; font-weight:700; color:#111827; margin-bottom:2px;">Khudkibook Team</p>
              <p>We build free study tools for GTU engineering students. Have a topic you want us to cover? <a href="/contact.html">Tell us</a>.</p>
            </div>
          </div>`;

const CTA = `          <p style="text-align:center; margin-top: 22px;">
            <a class="kb-cta-link" href="/"><i class="fas fa-book-open"></i> Get Free GTU Study Material</a>
          </p>`;

const OFFICIAL_LINKS = `          <h2>Where To Find Official Updates</h2>
          <ul>
            <li>GTU circulars page: <a href="https://gtu.ac.in/academics/circulars" target="_blank" rel="noopener noreferrer">gtu.ac.in/academics/circulars</a></li>
            <li>GTU student portal: <a href="https://student.gtu.ac.in" target="_blank" rel="noopener noreferrer">student.gtu.ac.in</a></li>
            <li>GTU exam section: <a href="https://gtu.ac.in/student-corner/examination" target="_blank" rel="noopener noreferrer">Examination &mdash; circulars, schedules, results</a></li>
            <li>All GTU notices, monitored live: <a href="/gtu-notices.html">Khudkibook GTU Notices</a></li>
          </ul>`;

// ========================================================
// Per-topic-type body copy
// ========================================================

const BUILDERS = {
    result(group) {
        const sess = group.sessionLabel || 'the current session';
        const recheckCount = group.members.filter(m => m.facts && (m.facts.isRecheck || m.facts.isReassessment)).length;
        const recheck = recheckCount > 0;
        const allRecheck = recheck && recheckCount === group.members.length;
        const body = [];
        body.push(`          <p>
            Gujarat Technological University (GTU) has published the <strong>${esc(sess)} examination result
            notifications</strong> on its official circulars page. GTU declares results in batches &mdash; one
            notification per programme and semester &mdash; so the list below is the complete set released so far,
            grouped so you can find your own programme quickly.
          </p>
          ${allRecheck
                ? `<p>Every notification in this batch carries the standard <strong>Re-check / Re-assessment</strong> clause, which is your window to request a re-evaluation of any subject if you believe the marks are wrong.</p>`
                : recheck
                    ? `<p>Notifications in this batch carry the standard <strong>Re-check / Re-assessment</strong> clause &mdash; that is your window to request a re-evaluation of any subject if you believe the marks are wrong. Read the PDF for your programme to confirm, because the clause is printed per notification.</p>`
                    : ''}`);

        body.push(`          <h2>Which Results Are In This Batch?</h2>
          <p>These are the programmes and semesters covered by the ${esc(sess)} result notifications published by GTU.</p>
${coverageTable(group.coverage)}`);

        body.push(`          <h2>How To Check Your GTU ${esc(sess)} Result</h2>
          <p>Your scorecard is available from the official GTU portals. No third-party app is needed.</p>
          <ol>
            <li><strong>GTU result portal</strong> &mdash; open <code>gturesults.in</code>, choose your examination and session, then enter your enrolment or seat number with the captcha.</li>
            <li><strong>GTU student portal</strong> &mdash; log in at <code>student.gtu.ac.in</code>, open the <em>Examination</em> section and download your provisional marksheet.</li>
            <li><strong>GTU website</strong> &mdash; go to <code>gtu.ac.in</code> &rarr; <em>Student Corner</em> &rarr; <em>Examination</em> &rarr; <em>Result List</em> and pick the link for your course.</li>
          </ol>
          <div class="kb-tip"><i class="fas fa-lightbulb"></i><span>Save a PDF of your marksheet as soon as it appears. College processes, re-check applications and scholarship forms all ask for a copy of the result document.</span></div>`);

        if (recheck) {
            body.push(`          <h2>Re-Check &amp; Re-Assessment: How It Works</h2>
          <p>
            If a subject's marks look wrong, GTU lets you apply for a <strong>re-check</strong> (the answer sheet is
            totalled and verified again for any missed correction) or a <strong>re-assessment</strong> (a fresh
            examiner re-evaluates the paper).
          </p>
          <table class="kb-table">
            <thead><tr><th>Service</th><th>Standard fee per subject</th></tr></thead>
            <tbody>
              <tr><td>Re-checking</td><td>&#8377;100</td></tr>
              <tr><td>Re-assessment</td><td>&#8377;250</td></tr>
            </tbody>
          </table>
          <h3>Steps To Apply</h3>
          <ol>
            <li>Log in to the GTU Student Portal with your enrolment number and password.</li>
            <li>Open the <em>Examination</em> section and choose <em>Re-check / Re-assessment Application</em>.</li>
            <li>Select the subjects, submit, and note the application number generated.</li>
            <li>Pay the fee through <strong>SBI Collect</strong> using that application number, and keep the receipt.</li>
          </ol>
          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>The re-check window is short and it is set by the Controller of Examination for each result batch &mdash; it is printed in the official notification PDF linked below. Missing it means waiting for the next cycle, so check the date immediately.</span></div>`);
        }

        body.push(`          <h2>Understanding Your Marks: GTU Grade Points</h2>
          <p>GTU follows a 10-point grading system. <strong>SPI</strong> is your performance in one semester; <strong>CPI</strong> is the cumulative average across every semester you have completed.</p>
          <table class="kb-table">
            <thead><tr><th>Grade</th><th>AA</th><th>AB</th><th>BB</th><th>BC</th><th>CC</th><th>CD</th><th>DD</th><th>FF</th></tr></thead>
            <tbody><tr><td>Grade points</td><td>10</td><td>9</td><td>8</td><td>7</td><td>6</td><td>5</td><td>4</td><td>0</td></tr></tbody>
          </table>`);

        body.push(`          <h2>Next Semester: Study Smarter</h2>
          <p>
            Once the result is out, the fastest way to improve is to target what actually appears in the paper. Use
            <a href="/blog/how-to-use-gtu-previous-year-question-papers.html" target="_blank" rel="noopener noreferrer">previous year question papers</a>
            to find the repeated units, and work through the
            <a href="/blog/gtu-exam-preparation-tips.html" target="_blank" rel="noopener noreferrer">practical exam preparation tips</a>
            for theory and viva. Free syllabus, textbooks and papers for every GTU branch and semester are already on
            <a href="/">Khudkibook</a>.
          </p>`);
        return body.join('\n\n');
    },

    'exam-form': (group) => {
        const sess = group.sessionLabel || 'the current session';
        const remedial = group.members.some(m => m.facts && m.facts.isRemedial);
        const biAnnual = group.members.some(m => m.facts && m.facts.isBiAnnual);
        const body = [];
        body.push(`          <p>
            GTU has released the <strong>exam form filling instructions for the ${esc(sess)} examination</strong>.
            Students in the programmes and semesters listed below can now register for the exam &mdash; but only
            programmes and semesters named in a GTU circular can apply, and the last date differs for each of them.
          </p>`);
        body.push(`          <h2>Which Programmes Can Apply?</h2>
          <p>These are the programmes and semesters covered by the ${esc(sess)} exam form circulars published by GTU.</p>
${coverageTable(group.coverage)}`);
        if (biAnnual) {
            body.push(`          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>Some of these circulars are marked <strong>"for bi-annual students only"</strong>. If your degree is on the bi-annual pattern, read that circular carefully &mdash; the eligibility rules differ from the regular pattern.</span></div>`);
        }
        body.push(`          <h2>How To Fill The GTU Exam Form</h2>
          <ol>
            <li>Open the <strong>GTU Student Portal</strong> at <code>student.gtu.ac.in</code> and log in with your enrolment number and password.</li>
            <li>Go to the <em>Examination</em> section and select the <em>Exam Form</em> / <em>Exam Registration</em> option for your session.</li>
            <li>Choose your subjects, verify the number of credits and the paper codes shown, then submit.</li>
            <li>Pay the examination fee through the payment gateway (or SBI Collect, where GTU asks for it) and download the receipt.</li>
            <li>Save the acknowledgement. If the form needs correction, there is usually a short re-edit window &mdash; check the circular for it.</li>
          </ol>
          <div class="kb-tip"><i class="fas fa-lightbulb"></i><span>Pay the exam fee only through the GTU portal. Anyone asking you for money to "confirm" or "reserve" a form is running a scam.</span></div>`);
        if (remedial) {
            body.push(`          <h2>If You Are Appearing As A Remedial Candidate</h2>
          <p>
            Remedial candidates are normally allowed only in subjects they have failed, and usually need prior
            permission from the Controller of Examination. The circulars in this batch cover the form-filling
            instructions &mdash; they do not by themselves grant eligibility, so read the attached PDF and contact
            your college examination section before you pay any fee.
          </p>`);
        }
        body.push(`          <h2>After You Submit</h2>
          <ul>
            <li>Your <strong>hall ticket / admit card</strong> appears on the portal once the exam schedule is declared.</li>
            <li>Watch this page and the <a href="/gtu-notices.html">live GTU notices list</a> for the exam date circular and the admit-card link.</li>
            <li>Download your previous year papers in advance so you can target the right units while preparing.</li>
          </ul>`);
        return body.join('\n\n');
    },

    'term-extension': (group) => {
        const sess = group.sessionLabel || 'the current session';
        return `          <p>
            GTU has opened <strong>term extension exam forms for the ${esc(sess)} examination</strong>. Term
            extension lets a student who could not meet the normal academic deadline &mdash; or who failed a subject
            &mdash; sit the exam in a later window, subject to GTU granting the extension.
          </p>
          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>Term extension is not automatic. The circular for your programme states whether you need prior approval from the Controller of Examination, and the last date is usually earlier than the last date printed on the form itself.</span></div>
          <h2>Which Programmes Can Apply?</h2>
          <p>These are the programmes and semesters covered by the ${esc(sess)} term extension circulars published by GTU.</p>
${coverageTable(group.coverage)}
          <h2>How To Apply For Term Extension</h2>
          <ol>
            <li>Read the circular for your programme in the list below, and note its own last date.</li>
            <li>Collect the college-endorsed application your college requires (if the circular asks for one).</li>
            <li>Log in to <code>student.gtu.ac.in</code> and open the <em>Examination</em> &rarr; <em>Term Extension</em> section.</li>
            <li>Submit the form, pay the term extension fee, and download the acknowledgement.</li>
          </ol>
          <h2>What To Do While You Wait</h2>
          <p>
            The exam window is short once granted, so use it. Work through
            <a href="/blog/how-to-use-gtu-previous-year-question-papers.html" target="_blank" rel="noopener noreferrer">previous year question papers</a>
            for your subjects and revise with the official syllabus, both available free on
            <a href="/">Khudkibook</a>.
          </p>`;
    },

    'exam-schedule': (group) => {
        const sess = group.sessionLabel || 'the current session';
        return `          <p>
            GTU has published the <strong>examination schedule / dates for the ${esc(sess)} examination</strong>.
            This is the circular to bookmark &mdash; it fixes when each programme's papers begin, which matters more
            than anything else for how you plan your revision.
          </p>
          <h2>What This Circular Covers</h2>
          <p>These are the programmes and semesters named in the ${esc(sess)} schedule circulars published by GTU.</p>
${coverageTable(group.coverage)}
          <h2>How To Read The Schedule</h2>
          <ul>
            <li>Find your programme in the attached PDF, then note the <strong>theory paper dates</strong> and the <strong>date of the viva-voce / practical</strong>.</li>
            <li>Check whether the schedule is <em>tentative</em> &mdash; GTU often revises dates when colleges cannot provide halls or faculty, and a revised circular supersedes the original.</li>
            <li>Note the last date for downloading the <strong>hall ticket</strong>, which comes separately.</li>
          </ul>
          <div class="kb-tip"><i class="fas fa-lightbulb"></i><span>Work backwards from the first paper date, not from today. If you have four subjects and three weeks, plan two subjects a week and leave the last week for revision only.</span></div>
          <h2>Prepare With The Right Material</h2>
          <p>
            Use <a href="/blog/gtu-exam-preparation-tips.html" target="_blank" rel="noopener noreferrer">the exam preparation guide</a>
            and target high-yield units from
            <a href="/blog/how-to-use-gtu-previous-year-question-papers.html" target="_blank" rel="noopener noreferrer">previous year question papers</a>.
            Syllabus, textbooks and papers for every GTU branch and semester are free on <a href="/">Khudkibook</a>.
          </p>`;
    },

    'academic-calendar': (group) => {
        const ay = group.academicYearLabel || 'the current academic year';
        return `          <p>
            GTU has released the <strong>Academic Calendar with tentative examination dates for A.Y. ${esc(ay)}</strong>.
            The academic calendar is the single most useful document for planning: it fixes the commencement and end
            dates of each term, the tentative theory and practical exam windows, and the vacation periods.
          </p>
          <h2>Why The Tentative Dates Matter</h2>
          <p>
            The exam windows in the academic calendar are marked <em>tentative</em> because GTU publishes them well in
            advance and then revises them. Students who plan their whole revision around the first version of the
            calendar and never recheck end up preparing on the wrong dates, so treat these as a framework and always
            confirm against the final circular.
          </p>
          <h2>How To Use The GTU Academic Calendar</h2>
          <ol>
            <li>Note the <strong>term start and end dates</strong> for your programme &mdash; they decide how many study weeks you really have.</li>
            <li>Note the <strong>tentative theory exam window</strong> and work backwards to build a weekly plan.</li>
            <li>Note the <strong>vacation dates</strong> before your college fixes its own internal schedule.</li>
            <li>Add the academic calendar to your phone and recheck once per month &mdash; GTU issues corrigenda.</li>
          </ol>
          <div class="kb-tip"><i class="fas fa-lightbulb"></i><span>Diwali and the surrounding holidays sit inside the odd-semester exam build-up every year. Build that cluster into your plan instead of discovering it halfway through.</span></div>
          <h2>Related Circulars In This Update</h2>
          <p>These are the other GTU circulars published alongside this calendar update.</p>
${coverageTable(group.coverage)}`;
    },

    syllabus: (group) => {
        const lead = group.members[0];
        const f = (lead && lead.facts) || {};
        const who = f.program || 'GTU programmes';
        const sem = f.semester ? ` Semester ${f.semester}` : '';
        return `          <p>
            GTU has issued a <strong>syllabus / curriculum update</strong> that affects ${esc(who)}${esc(sem)}.
            Syllabus changes matter more than they look: they decide which units are examinable, which textbooks to
            buy, and which questions a previous-year paper is actually worth preparing for.
          </p>
          <h2>What Changed</h2>
          <p>
            The circular${group.members.length > 1 ? 's' : ''} below cover${group.members.length > 1 ? '' : 's'} the
            following academic change${group.members.length > 1 ? 's' : ''}. Read the attached PDF for the exact
            effective semester, credit distribution and assessment split &mdash; GTU states those per subject, and
            they are what your grade is calculated from.
          </p>
${coverageTable(group.coverage)}
          <h2>What To Do Now</h2>
          <ol>
            <li>Download the circular and note the <strong>effective from</strong> semester &mdash; it decides whether the change applies to you now or only to the next batch.</li>
            <li>Compare the revised subject list with the syllabus already published on Khudkibook for your branch and semester.</li>
            <li>Re-download the revised subject PDF, and check whether the credits or the theory/practical split changed &mdash; a changed split means a different internal assessment weight.</li>
            <li>Tell your classmates. A syllabus change published on a Friday evening is the single most common reason students prepare the wrong units.</li>
          </ol>
          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>Do not assume the change applies retroactively to an exam you have already sat. "Effective from" in the circular is the deciding line.</span></div>
          <h2>Study The Revised Syllabus</h2>
          <p>
            Every revised subject, its units and its free textbook PDF are on <a href="/">Khudkibook</a> under your
            branch and semester. Once you know which units are live, use
            <a href="/blog/how-to-use-gtu-previous-year-question-papers.html" target="_blank" rel="noopener noreferrer">previous year papers</a>
            to check which of those units repeat most often.
          </p>`;
    },

    admission: (group) => {
        const ay = group.academicYearLabel || 'the current admission year';
        return `          <p>
            GTU has published an <strong>admission update for A.Y. ${esc(ay)}</strong>. Admission is the phase where
            missing a notification costs you a full seat, so this page is worth reading line by line even if you think
            your admission is already confirmed.
          </p>
          <h2>What This Update Covers</h2>
${coverageTable(group.coverage)}
          <h2>How GTU Admissions Work</h2>
          <ol>
            <li>Admissions run through the <strong>ACAC</strong> portal (formerly GCAS). Registration, choice listing and acceptance all happen there.</li>
            <li>Merit lists are published in rounds. Each round shortlists candidates from the choices already listed, and you accept the allotment within a short window.</li>
            <li>After allotment comes <strong>document verification</strong> at the allotted college, then fee payment &mdash; failing to pay within the window sends the seat back to the pool.</li>
          </ol>
          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>Once ACAS is live, GTU conducts the entire process online. GTU does not ask for money by hand, by UPI to a personal ID, or through a "agent". Every fee is paid on the portal.</span></div>
          <h2>Keep These Dates Somewhere You Will See Them</h2>
          <ul>
            <li>Round start and last date to register / list choices.</li>
            <li>Merit list publication date.</li>
            <li>Accept-allotment last date (usually only a few days).</li>
            <li>Document verification and fee payment window at the college.</li>
          </ul>
          <p>All of these are printed in the official circular linked below. The <a href="/gtu-notices.html">live GTU notices page</a> on Khudkibook is updated from the GTU feed, so you can also check it instead of hunting through the university site.</p>`;
    },

    fee: (group) => `          <p>
            GTU has issued a <strong>fee-related update</strong>. Fee circulars are easy to miss and expensive to miss,
            because the revised amount usually applies to a document you need within weeks.
          </p>
          <h2>What This Circular Changes</h2>
          <p>The circular${group.members.length > 1 ? 's' : ''} in this update cover${group.members.length > 1 ? '' : 's'} the following:</p>
${coverageTable(group.coverage)}
          <h2>How GTU Fees Work</h2>
          <ul>
            <li>University, tuition and student-society components are <strong>separate line items</strong> on the portal, and a college may add its own on top.</li>
            <li>Payment is online, through the GTU/college payment gateway or SBI Collect. A working receipt is generated immediately &mdash; save it.</li>
            <li>Re-check, re-assessment and term extension fees are charged per subject, separately from the exam fee.</li>
          </ul>
          <div class="kb-warn"><i class="fas fa-exclamation-triangle"></i><span>Never pay a GTU fee to a personal UPI ID, a bank account, or a "consultant". GTU never collects fees that way, and colleges cannot either.</span></div>
          <h2>What To Do</h2>
          <ol>
            <li>Download the circular and note both the revised amount and the date it takes effect.</li>
            <li>Check whether it applies to you only, or to all students of a programme.</li>
            <li>Pay through the official gateway and download the receipt before the deadline.</li>
          </ol>`,

    'calendar-holiday': (group) => `          <p>
            GTU has published a <strong>holiday / academic vacation notice</strong>. These lists decide when your
            college will actually be open, and they routinely differ from the government holiday calendar.
          </p>
          <h2>What This Notice Covers</h2>
${coverageTable(group.coverage)}
          <h2>How To Use It</h2>
          <ul>
            <li>Note the holidays that fall <strong>inside your exam window</strong> &mdash; those are the days that quietly eat into your revision time.</li>
            <li>Add them to your phone calendar straight away, with a reminder the evening before.</li>
            <li>Check whether the college publishes its own separate list. GTU's list is the upper bound; your college may close for more.</li>
          </ul>
          <div class="kb-tip"><i class="fas fa-lightbulb"></i><span>The <a href="/gtu-notices.html">live GTU notices page</a> on Khudkibook is updated straight from the GTU feed, so bookmark it rather than checking the university site every evening.</span></div>`
};

const CATEGORY_BY_TYPE = {
    result: 'GTU News',
    'exam-form': 'GTU News',
    'term-extension': 'GTU News',
    'exam-schedule': 'GTU News',
    'academic-calendar': 'GTU News',
    syllabus: 'GTU News',
    admission: 'Admission',
    fee: 'GTU News',
    'calendar-holiday': 'GTU News'
};

const TAGS_BY_TYPE = {
    result: ['GTU News', 'GTU Result', 'Recheck', 'Scorecard'],
    'exam-form': ['GTU News', 'Exam Form', 'Exam Registration'],
    'term-extension': ['GTU News', 'Term Extension', 'Exam Form'],
    'exam-schedule': ['GTU News', 'Exam Dates', 'Timetable'],
    'academic-calendar': ['GTU News', 'Academic Calendar', 'Exam Dates'],
    syllabus: ['GTU News', 'Syllabus', 'Curriculum'],
    admission: ['Admission', 'ACAC', 'Merit List'],
    fee: ['GTU News', 'GTU Fees'],
    'calendar-holiday': ['GTU News', 'Holidays']
};

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

/** Deterministic slug per topic key, so re-runs update the same canonical page. */
function slugFor(group) {
    const t = group.type;
    const sess = group.sessionSlug;
    if (t === 'result') {
        // The result kind is part of the slug, not just the topic key: a new kind
        // of result event is a new article, and two posts must never contend for
        // the same filename (or the same URL, which would 404 one of them).
        const kind = group.resultKind || 'main';
        return kind === 'main'
            ? `gtu-result-declaration-${sess || 'latest'}`
            : `gtu-${kind}-result-${sess || 'latest'}`;
    }
    if (t === 'exam-form') return `gtu-${sess || 'current'}-exam-form-instructions`;
    if (t === 'term-extension') return `gtu-${sess || 'current'}-term-extension-form`;
    if (t === 'exam-schedule') return `gtu-${sess || 'current'}-exam-dates-schedule`;
    if (t === 'academic-calendar') return `gtu-academic-calendar-${group.academicYearSlug || 'current'}`;
    if (t === 'syllabus') {
        const lead = group.members[0] || {};
        const f = lead.facts || {};
        const bits = ['gtu', 'syllabus', 'update'];
        if (f.programShort) bits.push(slugify(f.programShort));
        if (f.semester) bits.push(`sem${f.semester}`);
        bits.push((lead.date || today()).slice(0, 7));
        return bits.join('-');
    }
    if (t === 'admission') return `gtu-admission-update-${group.academicYearSlug || today().slice(0, 7)}`;
    if (t === 'fee') return `gtu-fee-update-${today().slice(0, 7)}`;
    if (t === 'calendar-holiday') return `gtu-holidays-${today().slice(0, 7)}`;
    return `gtu-${slugify(group.key)}`;
}

function titleFor(group) {
    const sess = group.sessionLabel;
    switch (group.type) {
        case 'result': {
            const kind = group.resultKind || 'main';
            const sess = group.sessionLabel;
            if (kind === 'main') return `GTU ${sess || 'Current'} Result Declared: How To Check Scorecard & Re-Check`;
            const word = kind === 'recheck' ? 'Recheck' : kind === 'remedial' ? 'Remedial' : kind === 'supplementary' ? 'Supplementary' : 'Term Extension';
            return `GTU ${sess || 'Current'} ${word} Result: How To Check Scorecard & Re-Check`;
        }
        case 'exam-form':
            return `GTU ${sess || 'Current'} Exam Form Instructions: Dates, Fees & How To Apply`;
        case 'term-extension':
            return `GTU ${sess || 'Current'} Term Extension Form: Who Can Apply & How`;
        case 'exam-schedule':
            return `GTU ${sess || 'Current'} Exam Dates & Schedule: Complete Programme-wise List`;
        case 'academic-calendar':
            return `GTU Academic Calendar A.Y. ${group.academicYearLabel || ''}: Tentative Exam Dates & Key Deadlines`.replace(/\s+/g, ' ');
        case 'syllabus': {
            const lead = group.members[0] || {};
            const f = lead.facts || {};
            const who = f.program || 'GTU Programmes';
            const sem = f.semester ? ` Sem ${f.semester}` : '';
            return `GTU Syllabus Update ${sem}: What Changed For ${who} & What You Should Do`.replace(/\s+/g, ' ');
        }
        case 'admission':
            return `GTU Admission Update A.Y. ${group.academicYearLabel || ''}: Complete Guide For Students`.replace(/\s+/g, ' ');
        case 'fee':
            return `GTU Fee Update: Revised Fees, Payment Method & Deadlines`;
        case 'calendar-holiday':
            return `GTU Holidays & Academic Vacation Notice: Complete List & What It Means`;
        default:
            return group.members[0] ? group.members[0].title : 'GTU Update';
    }
}

function excerptFor(group, title) {
    const n = group.members.length;
    const progs = group.coverage.slice(0, 3).map(c => c.name.replace(/^(Bachelor|Master|Doctor) of /i, '')).filter(Boolean);
    const sess = group.sessionLabel;
    switch (group.type) {
        case 'result':
            return `GTU published ${n} result notification${n === 1 ? '' : 's'} for the ${sess} examination, covering ${progs.join(', ')}${group.coverage.length > 3 ? ' and more' : ''}. Check your scorecard, the re-check window and what it costs.`;
        case 'exam-form':
            return `Exam forms for the GTU ${sess} examination are open for ${progs.join(', ')}${group.coverage.length > 3 ? ' and more' : ''}. Last dates, fees, and the exact steps to fill the form online.`;
        case 'term-extension':
            return `GTU has opened term extension forms for the ${sess} examination for ${progs.join(', ')}${group.coverage.length > 3 ? ' and more' : ''}. Who is eligible, what it costs, and how to apply before the deadline.`;
        case 'exam-schedule':
            return `The GTU ${sess} exam schedule is out. Find the paper dates for ${progs.join(', ')}${group.coverage.length > 3 ? ' and more' : ''}, plus how to plan your revision around them.`;
        case 'academic-calendar':
            return `The GTU academic calendar for A.Y. ${group.academicYearLabel || 'the current year'} is published with tentative exam dates. Here is how to read it and plan your term.`;
        case 'syllabus':
            return `GTU has revised the syllabus for ${progs[0] || 'a GTU programme'}. What changed, when it applies, and how to update your preparation before the next exam.`;
        case 'admission':
            return `GTU admission update for A.Y. ${group.academicYearLabel || 'the current year'}: the process, key dates, and the mistakes that cost students a seat.`;
        case 'fee':
            return `GTU has revised fees. Here is what changed, how to pay through the official gateway, and the deadlines to watch.`;
        case 'calendar-holiday':
            return `GTU has published its holiday and academic vacation list. Here is what it means for your exam preparation and which dates to block off.`;
        default:
            return title;
    }
}

function keywordsFor(group) {
    const t = group.sessionLabel ? `gtu ${group.sessionLabel}` : 'gtu';
    const map = {
        result: `${t} result, gtu result ${group.sessionYear || ''}, gtu recheck, gtu scorecard, gturesults.in, gtu result kaise check kare`,
        'exam-form': `${t} exam form, gtu exam form filling, gtu exam form last date, gtu exam form fees`,
        'term-extension': `${t} term extension, gtu term extension form, gtu exam form last date`,
        'exam-schedule': `${t} exam date, gtu exam timetable, gtu exam schedule, gtu exam date pdf`,
        'academic-calendar': `gtu academic calendar, gtu academic calendar ${group.academicYearLabel || ''}, gtu exam dates`,
        syllabus: `gtu syllabus, gtu syllabus update, gtu new syllabus, ${group.members[0] && group.members[0].facts && group.members[0].facts.program ? group.members[0].facts.program.toLowerCase() : 'engineering'} syllabus`,
        admission: `gtu admission, gtu admission ${group.academicYearLabel || ''}, acac admission, gtu merit list`,
        fee: `gtu fees, gtu fee structure, gtu recheck fees, gtu online fee payment`,
        'calendar-holiday': `gtu holidays, gtu academic vacation, gtu holiday list`
    };
    return map[group.type] || 'gtu update, gtu circulars, gtu news';
}

const ARTICLE_CSS = `      .kb-article { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }
      .kb-article-head { background: linear-gradient(135deg, #CD5D33 0%, #F0A66E 55%, #4A3A2C 140%); border-radius: 18px; padding: 28px; color: #fff; box-shadow: 0 10px 30px rgba(205,93,51,0.25); }
      .kb-article-head h1 { font-family: 'Outfit', sans-serif; font-size: clamp(1.4rem, 3.8vw, 2rem); margin: 0 0 12px; line-height: 1.3; }
      .kb-article-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.78rem; opacity: 0.9; font-weight: 600; }
      .kb-article-meta span { display: inline-flex; align-items: center; gap: 5px; }
      .kb-article-body { background: #fff; border: 1px solid var(--border, #e5e7eb); border-radius: 16px; padding: 28px 30px; margin-top: 20px; box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06)); }
      .kb-article-body h2 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; color: var(--text-primary, #111827); margin: 28px 0 10px; padding-bottom: 8px; border-bottom: 2px solid var(--bg-soft, #f3f4f6); }
      .kb-article-body h2:first-child { margin-top: 0; }
      .kb-article-body h3 { font-size: 1.05rem; color: var(--text-primary, #111827); margin: 20px 0 8px; }
      .kb-article-body p { font-size: 0.95rem; color: var(--text-secondary, #374151); line-height: 1.75; margin: 0 0 14px; }
      .kb-article-body ul, .kb-article-body ol { padding-left: 22px; margin: 0 0 14px; }
      .kb-article-body li { font-size: 0.95rem; color: var(--text-secondary, #374151); line-height: 1.7; margin-bottom: 8px; }
      .kb-article-body code { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 5px; padding: 1px 6px; font-size: 0.88em; }
      .kb-article-body strong { color: var(--text-primary, #111827); }
      .kb-tip { background: #f9ece2; border: 1px solid #eccfb8; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 0.92rem; color: #3730a3; line-height: 1.6; display: flex; gap: 10px; }
      .kb-tip i { color: #CD5D33; margin-top: 3px; }
      .kb-warn { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 0.92rem; color: #9a3412; line-height: 1.6; display: flex; gap: 10px; }
      .kb-warn i { color: #ea580c; margin-top: 3px; }
      .kb-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.9rem; }
      .kb-table th, .kb-table td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
      .kb-table th { background: #f9ece2; color: #3730a3; font-weight: 700; }
      .kb-cta-link { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #CD5D33, #F0A66E); color: #fff !important; padding: 11px 20px; border-radius: 999px; font-size: 0.9rem; font-weight: 700; text-decoration: none; }
      .kb-author-box { display: flex; gap: 14px; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 14px; padding: 16px; margin-top: 22px; align-items: center; }
      .kb-author-box img { width: 48px; height: 48px; border-radius: 12px; }
      .kb-author-box p { font-size: 0.85rem; color: var(--text-muted, #6b7280); margin: 0; line-height: 1.55; }
      @media (max-width: 560px) { .kb-article-body { padding: 20px 18px; } }`;

/** Rough reading time, so the meta tag is not a lie. */
function readTimeFor(bodyHtml) {
    const words = String(bodyHtml).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return `${Math.max(3, Math.min(12, Math.round(words / 190)))} min`;
}

function renderArticle(group) {
    const title = titleFor(group);
    const excerpt = excerptFor(group, title);
    const description = excerpt.replace(/\s+/g, ' ').trim();
    const keywords = keywordsFor(group);
    const date = group.publishDate || today();
    // Google reads dateModified as freshness. The publish date understates it:
    // the post is rewritten each time a new circular joins its topic.
    const modified = (group.latestDate && group.latestDate > date) ? group.latestDate : date;
    const category = CATEGORY_BY_TYPE[group.type] || 'GTU News';
    const tags = TAGS_BY_TYPE[group.type] || ['GTU News'];
    const canonical = `${SITE_URL}/blog/${group.slug}.html`;

    const bodyBuilder = BUILDERS[group.type];
    let body = bodyBuilder ? bodyBuilder(group) : '';
    const docs = documentList(group.members);
    if (docs) body += '\n\n' + docs;
    body += '\n\n' + OFFICIAL_LINKS + '\n\n' + DISCLAIMER(group.latestDate) + '\n\n' + CTA + '\n\n' + AUTHOR_BOX;

    const readTime = readTimeFor(body);
    const tagList = tags.join(', ');

    return {
        slug: group.slug,
        title,
        excerpt,
        category,
        tags,
        readTime,
        date,
        noticeIds: group.members.map(m => m.id),
        noticeCount: group.members.length,
        html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>

    <!-- SEO Meta Tags -->
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="keywords" content="${esc(keywords)}" />
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="Khudkibook" />
    <meta name="generator" content="Khudkibook" />
    <meta name="theme-color" content="#CD5D33" />
    <meta name="application-name" content="Khudkibook" />
    <meta name="geo.region" content="IN-GJ" />
    <meta name="geo.placement" content="Gujarat, India" />
    <meta name="referrer" content="origin-when-cross-origin" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="canonical" href="${esc(canonical)}" />

    <!-- Icons: the browser falls back to /favicon.ico, which is also provided. -->
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png?v=2" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/brand/favicon-16x16.png?v=2" />
    <link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg?v=2" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/khudkibook-logo.png?v=2" />
    <link rel="manifest" href="/assets/brand/site.webmanifest?v=2" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Khudkibook" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:alt" content="${esc(title)} — Khudkibook" />
    <meta property="og:image:type" content="image/webp" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="article:published_time" content="${date}" />
    <meta property="article:modified_time" content="${modified}" />
    <meta property="article:section" content="${esc(category)}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@khudkibook" />
    <meta name="twitter:creator" content="@khudkibook" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:image:alt" content="${esc(title)} — Khudkibook" />
    <meta name="twitter:url" content="${esc(canonical)}" />

    <!-- Article Schema.org JSON-LD -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": ${JSON.stringify(title)},
        "description": ${JSON.stringify(description)},
        "datePublished": "${date}",
        "dateModified": "${modified}",
        "author": { "@type": "Organization", "name": "Khudkibook", "url": "${SITE_URL}" },
        "publisher": { "@type": "Organization", "name": "Khudkibook", "url": "${SITE_URL}" },
        "mainEntityOfPage": ${JSON.stringify(canonical)},
        "image": "${OG_IMAGE}",
        "inLanguage": "en-IN",
        "articleSection": ${JSON.stringify(category)},
        "keywords": ${JSON.stringify(keywords)},
        "about": ${JSON.stringify(tags)}
      }
    </script>

    <!-- Fonts & Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

    <!-- Core Stylesheets -->
    <link rel="stylesheet" href="/be619.css?v=2.1" />
    <link rel="stylesheet" href="/cd651.css?v=2.1" />

    <style>
${ARTICLE_CSS}
    </style>
  </head>

  <body>
    <!-- Navigation Bar -->
    <nav id="nav" class="navbar-root"></nav>

    <!-- Header Section -->
    <header class="homehead">
      <h1 class="ph748">${esc(title)}</h1>
      <p>Live update compiled from official GTU circulars.</p>
    </header>

    <!-- Breadcrumbs -->
    <nav class="nv759" aria-label="Breadcrumb">
      <div class="nvl153">
        <a class="nvi751" href="/index.html"><i class="fas fa-home"></i> Home</a>
        <span class="nvsep729"> / </span>
        <a class="nvi751" href="/blog/">Blog</a>
        <span class="nvsep729"> / </span>
        <a class="nvi751" href="/gtu-notices.html">GTU Notices</a>
        <span class="nvsep729"> / </span>
        <span id="atnvli953">${esc(category)}</span>
      </div>
    </nav>

    <!-- Main Content -->
    <main id="main-content">
      <article class="kb-article">
        <div class="kb-article-head">
          <h1>${esc(title)}</h1>
          <div class="kb-article-meta">
            <span><i class="far fa-calendar-alt"></i> Announced by GTU: ${esc(announcedLabel(group))}</span>
            <span><i class="fas fa-pen-nib"></i> Published here: ${esc(prettyDate(date))}</span>
            <span><i class="far fa-clock"></i> ${esc(readTime)} read</span>
            <span><i class="fas fa-tag"></i> ${esc(tagList)}</span>
            <span><i class="fas fa-file-pdf"></i> ${group.members.length} official circular${group.members.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div class="kb-article-body">
${body}
        </div>
      </article>
    </main>

    <!-- Footer -->
    <footer id="footer"></footer>

    <!-- Scripts -->
    <script type="text/javascript" src="/ru444ts.js?v=2.1"></script>
  </body>
</html>
`
    };
}

/**
 * Group enriched notices into publishable topics.
 * @returns {Array} one group per topic, newest first
 */
function buildGroups(notices) {
    const map = new Map();
    for (const n of notices) {
        const t = n.topic || {};
        if (!t.key) continue;
        if (!map.has(t.key)) {
            map.set(t.key, {
                key: t.key,
                type: t.type,
                label: t.label,
                newsworthy: !!t.newsworthy,
                priority: t.priority || 0,
                members: []
            });
        }
        map.get(t.key).members.push(n);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
        g.members.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || '') || b.id - a.id);
        g.latestDate = g.members.reduce((acc, m) => (m.date > acc ? m.date : acc), '');
        g.oldestDate = g.members.reduce((acc, m) => (m.date && m.date < acc ? m.date : acc), g.latestDate);

        // Topic-level descriptors pulled from the members.
        const withSession = g.members.find(m => m.facts && m.facts.session);
        g.sessionSlug = withSession ? withSession.facts.sessionSlug : null;
        g.sessionLabel = withSession ? withSession.facts.session : null;
        g.sessionYear = withSession ? withSession.facts.sessionYear : null;
        const withAy = g.members.find(m => m.facts && m.facts.academicYear);
        g.academicYearSlug = withAy ? withAy.facts.academicYearSlug : null;
        g.academicYearLabel = withAy ? withAy.facts.academicYear : null;
        // Result events additionally carry their kind, which the slug and title
        // both depend on.
        const withKind = g.members.find(m => m.facts && m.facts.resultKind);
        g.resultKind = withKind ? withKind.facts.resultKind : null;
        g.coverage = summariseCoverage(g.members);
        g.slug = slugFor(g);
    }

    groups.sort((a, b) => (b.priority - a.priority) || (b.latestDate || '').localeCompare(a.latestDate || ''));
    return groups;
}

/**
 * Re-attach previously-seen circulars to a topic.
 *
 * A single poll only sees the newest N notices, but a topic (say "Summer 2026
 * results") accumulates circulars over days. Without this, refreshing a post
 * would silently drop the circulars listed by the previous run.
 */
function expandGroups(groups, archive) {
    const index = new Map();
    for (const n of archive) {
        const key = n.topic && n.topic.key;
        if (!key) continue;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(n);
    }
    for (const g of groups) {
        const extra = index.get(g.key) || [];
        if (!extra.length) continue;
        const have = new Set(g.members.map(m => m.id));
        for (const n of extra) {
            if (have.has(n.id)) continue;
            g.members.push(n);
            have.add(n.id);
        }
        g.members.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || '') || b.id - a.id);
        g.latestDate = g.members.reduce((acc, m) => (m.date > acc ? m.date : acc), '');
        g.oldestDate = g.members.reduce((acc, m) => (m.date && m.date < acc ? m.date : acc), g.latestDate);
        g.coverage = summariseCoverage(g.members);
    }
    return groups;
}

/** Build the post for a group, or null when the topic is not newsworthy. */
function buildPost(group) {
    if (!group.newsworthy) return null;
    if (!BUILDERS[group.type]) return null;
    return renderArticle(group);
}

/** Merge a freshly built post into public/blog/posts.json, newest first. */
function upsertPostMeta(post, postsFile) {
    let posts = [];
    if (fs.existsSync(postsFile)) {
        try { posts = JSON.parse(fs.readFileSync(postsFile, 'utf8')); } catch (e) { posts = []; }
    }
    if (!Array.isArray(posts)) posts = [];

    const meta = {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        date: post.date,
        category: post.category,
        readTime: post.readTime,
        tags: post.tags
    };

    const i = posts.findIndex(p => p.slug === post.slug);
    if (i === -1) {
        // Keep the original publish date when a post is refreshed.
        posts.unshift(meta);
    } else {
        meta.date = posts[i].date || post.date;
        posts[i] = meta;
        // Re-sort so refreshed posts keep their original position by date.
        posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }

    fs.mkdirSync(path.dirname(postsFile), { recursive: true });
    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
    return { total: posts.length, isNew: i === -1 };
}

module.exports = {
    BLOG_DIR,
    SITE_URL,
    buildGroups,
    expandGroups,
    buildPost,
    upsertPostMeta,
    summariseCoverage,
    formatSemesters,
    prettyDate,
    announcedLabel,
    slugFor,
    titleFor,
    excerptFor,
    readTimeFor,
    today
};
