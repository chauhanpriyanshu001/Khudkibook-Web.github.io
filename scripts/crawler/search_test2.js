const { fetchHTML } = require('./gtu_crawler');
const cheerio = require('cheerio');
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

async function post(url, $, fields) {
    const body = collectForm($);
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': new URL(url).origin, 'Referer': url },
        body: body.toString()
    });
    return await res.text();
}

async function main() {
    const res = await fetchHTML(SYLLABUS_PAGE);
    let $ = cheerio.load(res.body);

    // Step 1: select course BE
    let html = await post(SYLLABUS_PAGE, $, {
        '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddcourse',
        'ctl00$ContentPlaceHolder1$ddcourse': 'BE'
    });
    $ = cheerio.load(html);
    console.log('After course select, len', html.length);

    // Step 2: set branch + sem + search
    html = await post(SYLLABUS_PAGE, $, {
        'ctl00$ContentPlaceHolder1$ddcourse': 'BE',
        'ctl00$ContentPlaceHolder1$ddlbrcode': '01',
        'ctl00$ContentPlaceHolder1$ddsem': '1',
        'ctl00$ContentPlaceHolder1$ddl_effFrom': '2025-26',
        'ctl00$ContentPlaceHolder1$ddl_iselective': '',
        'ctl00$ContentPlaceHolder1$btn_search': 'Search'
    });
    $ = cheerio.load(html);
    console.log('After search, len', html.length);
    const txt = $('body').text().replace(/[\s\u00a0]+/g, ' ').trim();
    const msgIdx = txt.indexOf('Please select other criteria');
    console.log(msgIdx !== -1 ? 'NO_RESULTS' : 'HAS_RESULTS', '| tail:', txt.slice(-400));
    $('table').each((i, t) => {
        const ttxt = $(t).text().replace(/[\s\u00a0]+/g, ' ').trim();
        if (/subject\s*code/i.test(ttxt) && ttxt.length > 200) console.log('TABLE', i, 'rows', $(t).find('tr').length, '::', ttxt.slice(0, 500));
    });
}
main().catch(e => { console.error(e); process.exit(1); });