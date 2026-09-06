const cheerio = require('cheerio');
const { fetchHTML } = require('./gtu_crawler');

const SYLLABUS_PAGE = 'https://gtu.ac.in/Syllabus/Syllabus.aspx';

async function loadWithCourse(course) {
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
        if (name.endsWith('ddcourse')) body.set(name, course);
        else {
            const firstVal = $(el).find('option').first().attr('value');
            body.set(name, firstVal === undefined ? '' : firstVal);
        }
    });
    body.set('__EVENTTARGET', 'ctl00$ContentPlaceHolder1$ddcourse');
    body.set('__EVENTARGUMENT', '');
    const postRes = await fetch(SYLLABUS_PAGE, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://gtu.ac.in',
            'Referer': SYLLABUS_PAGE,
        },
        body: body.toString()
    });
    return await postRes.text();
}

const COURSES = ['BE','DI','ME','EP','BI','BL','BS','BA','BB','BC','BN','BH','BP','BV','DA','DP','DV','MB','MC','IC','MP','FD','PB','MR','MH','MN','MA','MV','PH'];

async function main() {
    const courseArg = process.argv[2];
    const courses = courseArg ? courseArg.split(',') : COURSES;
    const out = { programs: {} };
    for (const course of courses) {
        try {
            const html = await loadWithCourse(course);
            const $ = cheerio.load(html);
            const branches = [];
            $('select[name="ctl00$ContentPlaceHolder1$ddlbrcode"] option').each((i, el) => {
                const v = $(el).attr('value');
                const t = $(el).text().trim();
                if (v && v !== 'Select Branch') branches.push({ code: v, name: t });
            });
            const sems = $('select[name="ctl00$ContentPlaceHolder1$ddsem"] option').map((i, el) => $(el).attr('value')).get();
            out.programs[course] = { branches, sems };
            console.log(`### COURSE ${course}: ${branches.length} branches, ${sems.length} semesters`);
        } catch (e) {
            console.log(`### COURSE ${course}: ERROR ${e.message}`);
            out.programs[course] = { error: e.message };
        }
        await new Promise(r => setTimeout(r, 500));
    }
    require('fs').writeFileSync('/Users/prafulbhai/Khudkibook-Web.github.io/public/data/gtu_programs_branches.json', JSON.stringify(out, null, 2));
    console.log('Saved to public/data/gtu_programs_branches.json');
    for (const [c, p] of Object.entries(out.programs)) {
        if (!p.branches) continue;
        console.log(`\n### ${c} branches:`);
        for (const b of p.branches) console.log(`  ${b.code} : ${b.name}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });