/**
 * KhudKibook Missing-Book Filler
 *
 * Many subjects have a verified GTU syllabus PDF but no "book" material.
 * Since the site sources "books" from GTU's official syllabus PDFs, this
 * script backfills a "book" material for every subject that:
 *   - currently has NO book material, and
 *   - has a syllabus material with a valid https link.
 *
 * The added book points to the subject's official GTU syllabus PDF.
 *
 * Run: node scripts/fill_books.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data/site_db.json');
const BACKUP_PATH = path.join(ROOT_DIR, 'data/site_db_backup.json');

const DRY_RUN = process.argv.includes('--dry-run');

function loadDatabase() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDatabase(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db));
}

function isUsableLink(link) {
    return typeof link === 'string' && /^https?:\/\//i.test(link);
}

function main() {
    if (!DRY_RUN) {
        // Backup before mutating
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
        console.log(`Backup written to ${BACKUP_PATH}`);
    }

    const db = loadDatabase();
    let added = 0;
    let alreadyHasBook = 0;
    let noLink = 0;

    for (const unv of db.universities || []) {
        for (const domain of unv.domains || []) {
            for (const branch of domain.branches || []) {
                for (const sem of branch.semesters || []) {
                    for (const sub of sem.subjects || []) {
                        if (!sub.materials) sub.materials = [];
                        const hasBook = sub.materials.some(m => String(m.type) === 'book');
                        if (hasBook) { alreadyHasBook++; continue; }
                        const syl = sub.materials.find(m => String(m.type) === 'syllabus');
                        if (!syl || !isUsableLink(syl.link)) { noLink++; continue; }
                        sub.materials.push({
                            type: 'book',
                            label: 'GTU Book (Syllabus PDF)',
                            link: syl.link,
                            year: 'all'
                        });
                        added++;
                    }
                }
            }
        }
    }

    console.log(`Subjects already with book: ${alreadyHasBook}`);
    console.log(`Subjects without valid syllabus link (skipped): ${noLink}`);
    console.log(`Book materials added: ${added}`);

    if (!DRY_RUN) {
        saveDatabase(db);
        console.log('DB saved.');
    } else {
        console.log('DRY RUN - no changes written.');
    }
    return { added, alreadyHasBook, noLink };
}

if (require.main === module) {
    main();
}

module.exports = { main };
