const { fetchHTML } = require('./gtu_crawler');
const cheerio = require('cheerio');
const SYLLABUS_PAGE = 'https://gtu.ac.in/Syllabus/Syllabus.aspx';

async function search(course, branch, sem, eff, elective) {
    const res = await fetchHTML(SYLLABUS_PAGE);
    const $ = cheerio.load(res.body);
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
    body.set('ctl00$ContentPlaceHolder1$ddcourse', course);
    body.set('ctl00$ContentPlaceHolder1$ddlbrcode', branch);
    body.set('ctl00$ContentPlaceHolder1$ddsem', String(sem));
    body.set('ctl00$ContentPlaceHolder1$ddl_effFrom', String(eff));
    body.set('ctl00$ContentPlaceHolder1$ddl_iselective', String(elective || ''));
    body.set('ctl00$ContentPlaceHolder1$btn_search', 'Search');
    const res2 = await fetch(SYLLABUS_PAGE, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://gtu.ac.in',
            'Referer': SYLLABUS_PAGE,
        },
        body: body.toString()
    });
    const html = await res2.text();
    const $2 = cheerio.load(html);
    // try to find result rows
    const tables = [];
    $2('table').each((i, t) => {
        const txt = $(t).text().replace(/[\s\u00a0]+/g, ' ').trim();
        if (/subject\s*code|subject\s*name|teaching/i.test(txt) && txt.length > 200) tables.push(txt.slice(0, 400));
    });
    const msg = html.includes('Please select other criteria') ? 'NO_RESULTS' : 'HAS_TABLE';
    return { msg, tables };
}

async function main() {
    const combos = [
        ['BE', '01', 1, '2025-26'],
        ['BE', '06', 3, '2022-23'],
        ['BE', '07', 3, '2022-23'],
        ['BE', '07', 3, ''],
        ['BE', '07', 3, '2025-26'],
        ['BE', '16', 3, '2025-26'],
        ['BE', '19', 3, '2022-23'],
        ['DI', '06', 3, '2022-23'],
        ['ME', '06', 1, '2025-26'],
        ['ME', '06', 1, '2022-23'],
    ];
    for (const [c, b, s, e] of combos) {
        try {
            const r = await search(c, b, s, e);
            console.log(`${c} ${b} sem${s} eff(${e}) => ${r.msg}`, r.tables.length ? '| ' + r.tables[0].slice(0, 120) : '');
        } catch (err) {
            console.log(`${c} ${b} sem${s} eff(${e}) => ERROR ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
}
main().catch(e => { console.error(e); process.exit(1); });