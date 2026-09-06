/**
 * GTU Full Database Expansion Script
 * Reads crawled subject data and expands site_db.json with ALL GTU branches/semesters/subjects.
 *
 * Usage:
 *   node scripts/crawler/expand_gtu_db.js
 *   node scripts/crawler/expand_gtu_db.js --dry-run   # preview without writing
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP = path.join(DATA_DIR, 'site_db_backup.json');
const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
const PROGRAMS_FILE = path.join(DATA_DIR, 'gtu_programs_branches.json');
const SITE_URL = 'https://khudkibook.in';
const SYLLABUS_PREFIX = 'https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/';
const OG_IMAGE = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';

const DRY_RUN = process.argv.includes('--dry-run');

// ============================
// Branch Code → Slug + Name mapping
// ============================
const BE_BRANCH_MAP = {
    '01': { slug: 'aeronautical', name: 'Aeronautical Engineering', shortName: 'Aero' },
    '02': { slug: 'automobile', name: 'Automobile Engineering', shortName: 'Auto' },
    '03': { slug: 'biomedical', name: 'Biomedical Engineering', shortName: 'Biomed' },
    '04': { slug: 'biotechnology', name: 'Bio-Technology', shortName: 'Biotech' },
    '05': { slug: 'chemical', name: 'Chemical Engineering', shortName: 'Chemical' },
    '06': { slug: 'civil', name: 'Civil Engineering', shortName: 'Civil' },
    '07': { slug: 'computer', name: 'Computer Engineering', shortName: 'Computer' },
    '08': { slug: 'eee', name: 'Electrical & Electronics Engineering', shortName: 'EEE' },
    '09': { slug: 'electrical', name: 'Electrical Engineering', shortName: 'Electrical' },
    '10': { slug: 'electronics', name: 'Electronics Engineering', shortName: 'Electronics' },
    '11': { slug: 'ece', name: 'Electronics & Communication Engineering', shortName: 'ECE' },
    '12': { slug: 'etc', name: 'Electronics & Telecommunication Engineering', shortName: 'ETC' },
    '13': { slug: 'environmental', name: 'Environmental Engineering', shortName: 'Env. Engg' },
    '14': { slug: 'food-processing', name: 'Food Processing Technology', shortName: 'Food Proc.' },
    '15': { slug: 'industrial', name: 'Industrial Engineering', shortName: 'Industrial' },
    '16': { slug: 'it', name: 'Information Technology', shortName: 'IT' },
    '17': { slug: 'instrumentation', name: 'Instrumentation & Control Engineering', shortName: 'IC' },
    '18': { slug: 'marine', name: 'Marine Engineering', shortName: 'Marine' },
    '19': { slug: 'mechanical', name: 'Mechanical Engineering', shortName: 'Mechanical' },
    '20': { slug: 'mechatronics', name: 'Mechatronics Engineering', shortName: 'Mechatronics' },
    '21': { slug: 'metallurgy', name: 'Metallurgy Engineering', shortName: 'Metallurgy' },
    '22': { slug: 'mining', name: 'Mining Engineering', shortName: 'Mining' },
    '23': { slug: 'plastic', name: 'Plastic Technology', shortName: 'Plastic' },
    '24': { slug: 'power-electronics', name: 'Power Electronics', shortName: 'PE' },
    '25': { slug: 'production', name: 'Production Engineering', shortName: 'Production' },
    '26': { slug: 'rubber', name: 'Rubber Technology', shortName: 'Rubber' },
    '28': { slug: 'textile-processing', name: 'Textile Processing', shortName: 'Textile Proc.' },
    '29': { slug: 'textile', name: 'Textile Technology', shortName: 'Textile Tech.' },
    '31': { slug: 'cse', name: 'Computer Science & Engineering', shortName: 'CSE' },
    '32': { slug: 'ict', name: 'Information & Communication Technology', shortName: 'ICT' },
    '34': { slug: 'manufacturing', name: 'Manufacturing Engineering', shortName: 'Manufacturing' },
    '35': { slug: 'env-science-tech', name: 'Environmental Science & Technology', shortName: 'Env. Sci. Tech' },
    '36': { slug: 'chemical-technology', name: 'Chemical Technology', shortName: 'Chem. Tech.' },
    '37': { slug: 'env-science-eng', name: 'Environmental Science and Engineering', shortName: 'Env. Sci. Eng' },
    '39': { slug: 'nano', name: 'Nano Technology', shortName: 'Nano' },
    '40': { slug: 'civil-infra', name: 'Civil & Infrastructure Engineering', shortName: 'Civil Infra' },
    '41': { slug: 'robotics', name: 'Robotics and Automation', shortName: 'Robotics' },
    '42': { slug: 'cs-ai-ml', name: 'Computer Science & Engineering (AI & ML)', shortName: 'CS-AI/ML' },
    '43': { slug: 'ai-data-science', name: 'Artificial Intelligence and Data Science', shortName: 'AI & DS' },
    '44': { slug: 'chemical-green', name: 'Chemical Engineering (Green Tech & Sustainability)', shortName: 'Chem. Green' },
    '45': { slug: 'cs-iot-cyber', name: 'Computer Science & Engineering (IoT, Cyber Security & Blockchain)', shortName: 'CS-IoT' },
    '46': { slug: 'cs-data-science', name: 'Computer Science & Engineering (Data Science)', shortName: 'CS-DS' },
    '47': { slug: 'ei', name: 'Electronics & Instrumentation Engineering', shortName: 'EIE' },
    '48': { slug: 'cs-cyber', name: 'Computer Science & Engineering (Cyber Security)', shortName: 'CS-Cyber' },
    '49': { slug: 'cs-design', name: 'Computer Science & Design', shortName: 'CS-Design' },
    '50': { slug: 'smart-energy', name: 'Smart & Sustainable Energy', shortName: 'Smart Energy' },
    '51': { slug: 'food-eng', name: 'Food Engineering & Technology', shortName: 'Food Engg.' },
    '52': { slug: 'ai-ml', name: 'Artificial Intelligence and Machine Learning', shortName: 'AI & ML' },
    '53': { slug: 'plastics', name: 'Plastics Engineering', shortName: 'Plastics' },
    '54': { slug: 'ec-cs', name: 'Electronics & Communication (Communication System Engineering)', shortName: 'EC-CS' },
    '89': { slug: 'mechanical', name: 'Mechanical Engineering', shortName: 'Mechanical' },  // duplicate of 19
};

const DI_BRANCH_MAP = {
    '01': { slug: 'civil', name: 'Civil Engineering', shortName: 'Civil' },
    '02': { slug: 'computer', name: 'Computer Engineering', shortName: 'Computer' },
    '03': { slug: 'electrical', name: 'Electrical Engineering', shortName: 'Electrical' },
    '04': { slug: 'it', name: 'Information Technology', shortName: 'IT' },
    '05': { slug: 'mechanical', name: 'Mechanical Engineering', shortName: 'Mechanical' },
    '06': { slug: 'electronics', name: 'Electronics Engineering', shortName: 'Electronics' },
    '07': { slug: 'automobile', name: 'Automobile Engineering', shortName: 'Auto' },
    '08': { slug: 'chemical', name: 'Chemical Engineering', shortName: 'Chemical' },
    '09': { slug: 'ec', name: 'Electronics & Communication Engineering', shortName: 'EC' },
    '10': { slug: 'environmental', name: 'Environmental Engineering', shortName: 'Env.' },
    '11': { slug: 'instrumentation', name: 'Instrumentation & Control Engineering', shortName: 'IC' },
    '12': { slug: 'metallurgy', name: 'Metallurgy Engineering', shortName: 'Metallurgy' },
    '13': { slug: 'mining', name: 'Mining Engineering', shortName: 'Mining' },
    '14': { slug: 'plastic', name: 'Plastic Technology', shortName: 'Plastic' },
    '15': { slug: 'textile', name: 'Textile Technology', shortName: 'Textile' },
    '16': { slug: 'biomedical', name: 'Biomedical Engineering', shortName: 'Biomed' },
    '17': { slug: 'power-electronics', name: 'Power Electronics', shortName: 'PE' },
    '18': { slug: 'electronics-telecom', name: 'Electronics & Telecommunication Engineering', shortName: 'ETC' },
    '19': { slug: 'mechatronics', name: 'Mechatronics Engineering', shortName: 'Mechatronics' },
    '20': { slug: 'production', name: 'Production Engineering', shortName: 'Production' },
    '21': { slug: 'rubber', name: 'Rubber Technology', shortName: 'Rubber' },
    '22': { slug: 'cse', name: 'Computer Science & Engineering', shortName: 'CSE' },
    '23': { slug: 'ai-ml', name: 'Artificial Intelligence and Machine Learning', shortName: 'AI & ML' },
    '24': { slug: 'ai-data-science', name: 'Artificial Intelligence and Data Science', shortName: 'AI & DS' },
    '25': { slug: 'cs-cyber', name: 'Computer Science & Engineering (Cyber Security)', shortName: 'CS-Cyber' },
    '26': { slug: 'cs-data-science', name: 'Computer Science & Engineering (Data Science)', shortName: 'CS-DS' },
    '27': { slug: 'cs-iot', name: 'Computer Science & Engineering (IoT & Cyber Security)', shortName: 'CS-IoT' },
    '28': { slug: 'cs-ai', name: 'Computer Science & Engineering (Artificial Intelligence & ML)', shortName: 'CS-AI' },
    '29': { slug: 'ics', name: 'Information & Communication Technology', shortName: 'ICT' },
    '30': { slug: 'food', name: 'Food Processing Technology', shortName: 'Food Proc.' },
    '31': { slug: 'chemical-green', name: 'Chemical Engineering (Green Tech)', shortName: 'Chem. Green' },
    '32': { slug: 'marine', name: 'Marine Engineering', shortName: 'Marine' },
    '33': { slug: 'biotechnology', name: 'Bio-Technology', shortName: 'Biotech' },
    '34': { slug: 'smart-energy', name: 'Smart & Sustainable Energy', shortName: 'Smart Energy' },
    '35': { slug: 'robotics', name: 'Robotics and Automation', shortName: 'Robotics' },
    '36': { slug: 'cs-design', name: 'Computer Science & Design', shortName: 'CS-Design' },
    '37': { slug: 'electrical-eee', name: 'Electrical & Electronics Engineering', shortName: 'EEE' },
    '38': { slug: 'automobile-eng', name: 'Automobile Engineering', shortName: 'Auto Engg' },
    '39': { slug: 'food-eng', name: 'Food Engineering & Technology', shortName: 'Food Engg.' },
    '40': { slug: 'chemical-technology', name: 'Chemical Technology', shortName: 'Chem. Tech.' },
    '41': { slug: 'nano', name: 'Nano Technology', shortName: 'Nano' },
    '42': { slug: 'ei', name: 'Electronics & Instrumentation Engineering', shortName: 'EIE' },
    '43': { slug: 'plastics', name: 'Plastics Engineering', shortName: 'Plastics' },
    '44': { slug: 'env-science-tech', name: 'Environmental Science & Technology', shortName: 'Env. Sci. Tech' },
    '45': { slug: 'env-science-eng', name: 'Environmental Science and Engineering', shortName: 'Env. Sci. Eng' },
    '46': { slug: 'cs-iot-cyber-blockchain', name: 'CS (IoT, Cyber Security & Blockchain)', shortName: 'CS-IoT-CB' },
    '47': { slug: 'ec-cs', name: 'Electronics & Communication (Communication System)', shortName: 'EC-CS' },
    '48': { slug: 'civil-infra', name: 'Civil & Infrastructure Engineering', shortName: 'Civil Infra' },
    '49': { slug: 'daiml', name: 'Diploma in AI & ML', shortName: 'D-AI/ML' },
    '50': { slug: 'ds', name: 'Data Science', shortName: 'DS' },
    '51': { slug: 'ict-iot', name: 'Information & Communication Technology (IoT)', shortName: 'ICT-IoT' },
};

const ME_BRANCH_MAP = {};
// Auto-generate ME branch map from programs data

// ============================
// Domain configuration
// ============================
const DOMAIN_CONFIG = {
    'BE': { id: 'be', name: 'Bachelor of Engineering (Degree)', urlPrefix: 'BE', branchMap: BE_BRANCH_MAP },
    'DI': { id: 'diploma', name: 'Diploma Engineering', urlPrefix: '', branchMap: DI_BRANCH_MAP },
    'ME': { id: 'me', name: 'Master of Engineering / M.Tech', urlPrefix: 'ME', branchMap: ME_BRANCH_MAP },
};

// ============================
// Helpers
// ============================
function slugify(name) {
    return name.toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function generateSEO(branchName, semName, subjectName, subjectCode, courseType) {
    const courseLabel = courseType === 'DI' ? 'Diploma' : courseType === 'ME' ? 'M.Tech' : 'B.E.';
    return {
        title: `${subjectName} (${subjectCode}) - GTU ${branchName} ${semName} Free Books & Papers | Khudkibook`,
        description: `Download free ${subjectName} study material for GTU ${courseLabel} ${branchName} ${semName}. Get textbooks, question papers, syllabus PDF at Khudkibook.`,
        keywords: `gtu ${subjectName.toLowerCase()}, ${subjectCode}, gtu ${branchName.toLowerCase()} ${semName.toLowerCase()}, ${courseLabel.toLowerCase()} ${branchName.toLowerCase()} books, gtu papers`
    };
}

function generateSemSEO(branchName, semName, courseType) {
    const courseLabel = courseType === 'DI' ? 'Diploma' : courseType === 'ME' ? 'M.Tech' : 'B.E.';
    return {
        title: `GTU ${branchName} ${semName} - Books, Syllabus & Papers | Khudkibook`,
        description: `Download free study material for GTU ${courseLabel} ${branchName} ${semName}. Books, Notes, Question Papers & Syllabus at Khudkibook.`,
        keywords: `gtu ${branchName.toLowerCase()}, ${semName.toLowerCase()}, gtu ${courseLabel.toLowerCase()} books, gtu old papers ${branchName.toLowerCase()}`
    };
}

function isElective(sub) {
    const name = (sub.name || '').toLowerCase();
    const cat = (sub.category || '').toLowerCase();
    return name.includes('elective') || cat.includes('elective');
}

// ============================
// Main
// ============================
function main() {
    if (!fs.existsSync(DB_FILE)) { console.error('DB not found'); process.exit(1); }
    if (!fs.existsSync(CRAWLED_FILE)) { console.error('Crawled data not found. Run gtu_full_crawl.js first.'); process.exit(1); }
    if (!fs.existsSync(PROGRAMS_FILE)) { console.error('Programs data not found.'); process.exit(1); }

    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const crawled = JSON.parse(fs.readFileSync(CRAWLED_FILE, 'utf8'));
    const programs = JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8'));

    // Backup
    if (!DRY_RUN) {
        fs.writeFileSync(DB_BACKUP, fs.readFileSync(DB_FILE));
        console.log('Backup saved.');
    }

    let gtuUnv = db.universities.find(u => u.id === 'gtu');
    if (!gtuUnv) {
        gtuUnv = { id: 'gtu', name: 'Gujarat Technological University', shortName: 'GTU', domains: [] };
        db.universities.push(gtuUnv);
    }

    let totalBranches = 0, totalSemesters = 0, totalSubjects = 0, totalMaterials = 0;

    for (const [course, config] of Object.entries(DOMAIN_CONFIG)) {
        if (!crawled[course]) continue;

        let domain = gtuUnv.domains.find(d => d.id === config.id);
        if (!domain) {
            domain = { id: config.id, name: config.name, urlPrefix: config.urlPrefix, branches: [] };
            gtuUnv.domains.push(domain);
            console.log(`Created domain: ${config.id}`);
        }

        // Auto-populate ME branch map from programs data
        if (course === 'ME' && programs.programs[course]) {
            for (const br of programs.programs[course].branches || []) {
                if (!ME_BRANCH_MAP[br.code]) {
                    const cleanName = br.name.replace(/^\d+\s*-\s*/, '');
                    ME_BRANCH_MAP[br.code] = {
                        slug: slugify(cleanName),
                        name: cleanName,
                        shortName: cleanName.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase()
                    };
                }
            }
        }

        const branchMap = config.branchMap;
        const branchData = crawled[course];

        for (const [branchCode, semesters] of Object.entries(branchData)) {
            const branchInfo = branchMap[branchCode];
            if (!branchInfo) {
                // Auto-generate from name if available
                const rawName = (programs.programs[course]?.branches || []).find(b => b.code === branchCode)?.name || `Branch ${branchCode}`;
                const cleanName = rawName.replace(/^\d+\s*-\s*/, '');
                branchMap[branchCode] = { slug: slugify(cleanName), name: cleanName, shortName: cleanName.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase() };
            }
            const bi = branchMap[branchCode];

            // Check if branch already exists
            let branch = domain.branches.find(b => b.id === bi.slug);
            if (!branch) {
                branch = {
                    id: bi.slug,
                    name: bi.name,
                    shortName: bi.shortName,
                    image: OG_IMAGE,
                    semesters: []
                };
                domain.branches.push(branch);
                totalBranches++;
            }

            // Semesters
            for (const [semNum, subjects] of Object.entries(semesters)) {
                if (!subjects || subjects.length === 0) continue;
                const semId = `sem${semNum}`;
                const semName = `Semester ${semNum}`;

                let semester = branch.semesters.find(s => s.id === semId);
                if (!semester) {
                    semester = { id: semId, name: semName, seo: generateSemSEO(bi.name, semName, course), subjects: [] };
                    branch.semesters.push(semester);
                    totalSemesters++;
                }

                // Subjects
                for (const sub of subjects) {
                    const existing = semester.subjects.find(s => s.code === sub.code);
                    if (existing) {
                        // Merge materials if new syllabus link
                        if (!existing.materials) existing.materials = [];
                        const hasSyllabus = existing.materials.some(m => m.type === 'syllabus');
                        if (!hasSyllabus && sub.code) {
                            existing.materials.push({ type: 'syllabus', label: 'Syllabus', link: `${SYLLABUS_PREFIX}${sub.code}.pdf`, year: 'all' });
                            totalMaterials++;
                        }
                        continue;
                    }

                    const slug = slugify(sub.name);
                    const subject = {
                        code: sub.code,
                        name: sub.name,
                        slug: slug,
                        image: OG_IMAGE,
                        credit: sub.credit || 0,
                        marks: sub.total ? parseInt(sub.total) || 0 : 0,
                        isElective: isElective(sub),
                        categories: sub.category || 'General',
                        seo: generateSEO(bi.name, semName, sub.name, sub.code, course),
                        materials: [
                            { type: 'syllabus', label: 'Syllabus', link: `${SYLLABUS_PREFIX}${sub.code}.pdf`, year: 'all' }
                        ]
                    };
                    semester.subjects.push(subject);
                    totalSubjects++;
                    totalMaterials++;
                }
            }
        }

        console.log(`\n${course}: ${domain.branches.length} branches total`);
    }

    // Sort branches, semesters, subjects
    for (const unv of db.universities) {
        for (const domain of unv.domains || []) {
            domain.branches.sort((a, b) => a.name.localeCompare(b.name));
            for (const branch of domain.branches) {
                branch.semesters.sort((a, b) => {
                    const na = parseInt((a.id || '').replace(/\D/g, '')) || 0;
                    const nb = parseInt((b.id || '').replace(/\D/g, '')) || 0;
                    return na - nb;
                });
                for (const sem of branch.semesters) {
                    sem.subjects.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
                }
            }
        }
    }

    console.log(`\n=== EXPANSION SUMMARY ===`);
    console.log(`New branches: ${totalBranches}`);
    console.log(`New semesters: ${totalSemesters}`);
    console.log(`New subjects: ${totalSubjects}`);
    console.log(`New materials: ${totalMaterials}`);

    if (!DRY_RUN) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('Database saved!');
    } else {
        console.log('(DRY RUN - not saved)');
    }
}

main();