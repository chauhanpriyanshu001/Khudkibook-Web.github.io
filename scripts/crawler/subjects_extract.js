const { fetchHTML } = require('./gtu_crawler');
const cheerio = require('cheerio');
const fs = require('fs');
const SYLLABUS_PAGE = 'https://gtu.ac.in/Syllabus/Syllabus.aspx';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';

function collectForm($) {
    const body = new URLSearchParams();
    $('input[type="hidden"]').each((i, el) => {
        const name = $(el).attr('name');
        const value = $(el).attr('value') || '';
        if (name && !body.has(name)) body.set(name, value);
    });
    $('select').each((i, el) => {
        const name = $(el).attr('name');
        if (!name || body.has(name)) return;
        body.set(name, '');
    });
    return body;
}

async function post($, fields) {
    const body = collectForm($);
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const res = await fetch(SYLLABUS_PAGE, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://gtu.ac.in', 'Referer': SYLLABUS_PAGE },
        body: body.toString()
    });
    return await res.text();
}

const CODE_RE = /^([A-Z]{0,4})(\d{7,8})$/;
const IGNORE = new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '89']);

function parseGrid(html) {
    const $ = cheerio.load(html);
    const tbl = $('table').filter((i, t) => /subject\s*code/i.test($(t).text())).first();
    if (!tbl.length) return [];
    const subs = [];
    tbl.find('tr').each((i, tr) => {
        const cells = $(tr).find('td').map((j, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
        if (cells.length < 13) return;
        // find code cell: a 7-digit (optional 2-letter prefix) value
        let codeIdx = -1;
        for (let j = 0; j < cells.length; j++) {
            const m = CODE_RE.exec(cells[j]);
            if (m) { codeIdx = j; break; }
        }
        if (codeIdx === -1) return;
        const code = cells[codeIdx];
        const prefix = /^[A-Z]{0,4}/.exec(code)[0];
        if (!prefix && IGNORE.has(code.slice(0, 2))) return; // skip branch codes like 06, 07
        if (codeIdx + 1 >= cells.length) return;
        const branchRaw = cells[codeIdx + 1];
        const effFrom = cells[codeIdx + 2] || '';
        const name = cells[codeIdx + 3] || '';
        const category = cells[codeIdx + 4] || '';
        const sem = cells[codeIdx + 5] || '';
        const l = cells[codeIdx + 6] || '';
        const t = cells[codeIdx + 7] || '';
        const p = cells[codeIdx + 8] || '';
        const pbl = cells[codeIdx + 9] || '';
        const credit = parseFloat((cells[codeIdx + 10] || '').replace(/,/g, '')) || 0;
        const em = cells[codeIdx + 11] || '';
        const iv = cells[codeIdx + 13] || '';
        const total = cells[codeIdx + 15] || '';
        subs.push({
            code, name, category, sem, effFrom,
            ltpPBL: `${l} / ${t} / ${p} / ${pbl}`,
            credit, em, iv, total,
            branchCode: branchRaw
        });
    });
    // dedupe by code
    const seen = new Set();
    return subs.filter(s => {
        if (!s.code || !s.name) return false;
        const k = s.code + '|' + s.sem;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

async function fetchSubjects(course, branch, sem) {
    const res = await fetchHTML(SYLLABUS_PAGE);
    let $ = cheerio.load(res.body);
    let html = await post($, { '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddcourse', 'ctl00$ContentPlaceHolder1$ddcourse': course });
    $ = cheerio.load(html);
    html = await post($, {
        'ctl00$ContentPlaceHolder1$ddcourse': course,
        'ctl00$ContentPlaceHolder1$ddlbrcode': branch,
        'ctl00$ContentPlaceHolder1$ddsem': String(sem),
        'ctl00$ContentPlaceHolder1$ddl_effFrom': '',
        'ctl00$ContentPlaceHolder1$ddl_iselective': '',
        'ctl00$ContentPlaceHolder1$btn_search': 'Search'
    });
    return parseGrid(html);
}

async function main() {
    const args = process.argv.slice(2);
    const course = args[0] || 'BE';
    const branch = args[1] || '07';
    const sem = args[2] || '3';
    const subs = await fetchSubjects(course, branch, sem);
    console.log(`COURSE ${course} BRANCH ${branch} SEM ${sem}: ${subs.length} subjects`);
    for (const s of subs) console.log(`  ${s.code} | ${s.name} | ${s.category} | credit=${s.credit} | eff=${s.effFrom} | ltpPBL=${s.ltpPBL} | em=${s.em} iv=${s.iv} tot=${s.total} | br=${s.branchCode}`);
}
main().catch(e => { console.error(e); process.exit(1); });