/**
 * KhudKibook Migration Script
 * 
 * Reads existing site_db.json + scans old HTML files to produce a new
 * 5-level hierarchy: University > Domain > Branch > Semester > Subject
 * 
 * Run: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OLD_DB_PATH = path.join(ROOT_DIR, 'data/site_db.json');
const BE_JSON_PATH = path.join(PUBLIC_DIR, 'be.json');
const NEW_DB_PATH = path.join(ROOT_DIR, 'data/site_db.json');
const BACKUP_PATH = path.join(ROOT_DIR, 'data/site_db_backup.json');

// ============================================================
// 1. Scan old HTML files to build slug → code mapping + extract SEO
// ============================================================

function scanOldHtmlFiles() {
    const slugMap = {}; // { "computer/sem3/DSA": { code, name, seo, materials } }
    const diplomaBranches = ['it', 'computer', 'civil', 'electrical', 'mechanical'];
    
    // Scan diploma branches (root-level dirs)
    diplomaBranches.forEach(branch => {
        const branchDir = path.join(PUBLIC_DIR, branch);
        if (!fs.existsSync(branchDir)) return;
        
        fs.readdirSync(branchDir).forEach(semDir => {
            const semPath = path.join(branchDir, semDir);
            if (!fs.statSync(semPath).isDirectory()) return;
            if (!semDir.startsWith('sem')) return;
            
            fs.readdirSync(semPath).forEach(file => {
                if (!file.endsWith('.html') || file === 'homepage.html' || file === 'index.html') return;
                const slug = file.replace('.html', '');
                const filePath = path.join(semPath, file);
                const data = extractFromHtml(filePath);
                const key = `${branch}/${semDir}/${slug}`;
                slugMap[key] = { ...data, slug, branch, sem: semDir, domain: 'diploma' };
            });
        });
    });
    
    // Scan BE directory
    const beDir = path.join(PUBLIC_DIR, 'BE');
    if (fs.existsSync(beDir)) {
        scanBeDirectory(beDir, slugMap);
    }
    
    return slugMap;
}

function scanBeDirectory(beDir, slugMap) {
    fs.readdirSync(beDir).forEach(branchDir => {
        const branchPath = path.join(beDir, branchDir);
        if (!fs.statSync(branchPath).isDirectory()) return;
        
        fs.readdirSync(branchPath).forEach(semDir => {
            const semPath = path.join(branchPath, semDir);
            if (!fs.statSync(semPath).isDirectory()) return;
            if (!semDir.startsWith('sem')) return;
            
            fs.readdirSync(semPath).forEach(file => {
                if (!file.endsWith('.html') || file === 'homepage.html' || file === 'index.html') return;
                const slug = file.replace('.html', '');
                const filePath = path.join(semPath, file);
                const data = extractFromHtml(filePath);
                const key = `BE/${branchDir}/${semDir}/${slug}`;
                slugMap[key] = { ...data, slug, branch: branchDir, sem: semDir, domain: 'be' };
            });
        });
    });
}

function extractFromHtml(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract subject code
    let codeMatch = content.match(/class="(?:d111|md111)"[^>]*>([^<]+)</);
    if (!codeMatch) codeMatch = content.match(/(?:Subcode|Code)[:\s]*([C0-9]{5,8})/i);
    const code = codeMatch ? codeMatch[1].trim() : '';
    
    // Extract subject name
    let nameMatch = content.match(/class="(?:bn159|bn1599)"[^>]*>([^<]+)</);
    if (!nameMatch) nameMatch = content.match(/<h1[^>]*class="[^"]*ph748[^"]*"[^>]*>([^<]+)<\/h1>/);
    if (!nameMatch) {
        const titleMatch = content.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
            const rawTitle = titleMatch[1].split('-')[0].split('|')[0].trim();
            nameMatch = [null, rawTitle.replace(/GTU|Diploma|Study Material|Free Download|Books?/gi, '').trim()];
        }
    }
    const name = nameMatch ? nameMatch[1].trim() : '';
    
    // Extract SEO
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    const descMatch = content.match(/name="description"\s+content="([^"]+)"/i);
    const kwMatch = content.match(/name="keywords"\s+content="([^"]+)"/i);
    
    const seo = {
        title: titleMatch ? titleMatch[1].trim() : '',
        description: descMatch ? descMatch[1].trim() : '',
        keywords: kwMatch ? kwMatch[1].trim() : ''
    };
    
    // Extract credit
    const creditMatch = content.match(/Credit-(\d+)/i);
    const credit = creditMatch ? parseInt(creditMatch[1]) : 4;
    
    // Extract image
    const imgMatch = content.match(/class="(?:mc7593512345|i12345)"[^>]*src="([^"]+)"/);
    const image = imgMatch ? imgMatch[1] : 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';
    
    // Extract Drive links from modals and buttons
    const driveLinks = [];
    const driveRegex = /href="(https:\/\/drive\.google\.com\/[^"]+)"\s*>([^<]*)</g;
    let match;
    while ((match = driveRegex.exec(content)) !== null) {
        if (match[1] && match[1] !== 'https://drive.google.com/file/d/') {
            driveLinks.push({ link: match[1], label: match[2].trim() || 'Book PDF' });
        }
    }
    
    // Extract syllabus links
    const syllabusLinks = [];
    const syllRegex = /href="(https:\/\/(?:drive\.google\.com|s3-ap)[^"]+)"[^>]*>\s*(?:<button[^>]*>)?Syllabus/gi;
    let syllMatch;
    while ((syllMatch = syllRegex.exec(content)) !== null) {
        syllabusLinks.push({ link: syllMatch[1], label: 'Syllabus' });
    }
    
    return { code, name, seo, credit, image, driveLinks, syllabusLinks };
}


// ============================================================
// 2. Read existing site_db.json and restructure
// ============================================================

function readExistingDb() {
    if (!fs.existsSync(OLD_DB_PATH)) {
        console.log('No existing site_db.json found, creating from scratch');
        return null;
    }
    return JSON.parse(fs.readFileSync(OLD_DB_PATH, 'utf-8'));
}


// ============================================================
// 3. Build new 5-level hierarchy
// ============================================================

function buildNewDb(existingDb, slugMap) {
    const newDb = {
        config: {
            currentYear: "2025-2026",
            adPubId: "ca-pub-4211827566541334",
            siteUrl: "https://khudkibook.web.app",
            appUrl: "https://play.google.com/store/apps/details?id=web.app.khudkibook",
            academicYears: ["2025-2026", "2024-2025", "2023-2024"]
        },
        universities: []
    };
    
    // ---- GTU ----
    const gtu = {
        id: "gtu",
        name: "Gujarat Technological University",
        shortName: "GTU",
        domains: []
    };
    
    // ---- Diploma domain ----
    const diplomaDomain = {
        id: "diploma",
        name: "Diploma Engineering",
        urlPrefix: "",  // No prefix for backward compat
        branches: []
    };
    
    // Process existing DB (which has diploma data)
    if (existingDb && existingDb.universities) {
        const diplomaUnv = existingDb.universities.find(u => u.id === 'diploma');
        if (diplomaUnv && diplomaUnv.branches) {
            diplomaUnv.branches.forEach(branch => {
                // Skip DDCET for now (separate handling)
                if (branch.id === 'DDCET') return;
                
                const newBranch = {
                    id: branch.id,
                    name: getBranchFullName(branch.id),
                    shortName: branch.name || branch.id,
                    image: getBranchImage(branch.id),
                    semesters: []
                };
                
                (branch.semesters || []).forEach(sem => {
                    const newSem = {
                        id: sem.id,
                        name: sem.name || formatSemName(sem.id),
                        seo: sem.seo || { title: "", keywords: "", description: "" },
                        subjects: []
                    };
                    
                    (sem.subjects || []).forEach(sub => {
                        // Find slug from the HTML scan
                        const slug = findSlugForSubject(slugMap, branch.id, sem.id, sub.code, sub.name);
                        
                        // Find SEO from HTML scan
                        const htmlData = findHtmlData(slugMap, branch.id, sem.id, sub.code);
                        
                        const newSub = {
                            code: sub.code,
                            name: sub.name,
                            slug: slug,
                            image: sub.image || htmlData?.image || "",
                            credit: sub.credit || htmlData?.credit || 0,
                            marks: sub.marks || 0,
                            isElective: false,
                            categories: "Core",
                            seo: sub.seo || htmlData?.seo || { title: "", keywords: "", description: "" },
                            materials: convertMaterials(sub.materials || [], htmlData)
                        };
                        
                        // Auto-generate SEO if empty
                        if (!newSub.seo.title) {
                            newSub.seo.title = `${newSub.name} - GTU Diploma ${newBranch.shortName} ${newSem.name} Free Download | KhudKibook`;
                        }
                        if (!newSub.seo.description) {
                            newSub.seo.description = `Download free ${newSub.name} study material for GTU Diploma ${newBranch.shortName} ${newSem.name}. Books, Notes, Papers, Solutions & More at KhudKibook.`;
                        }
                        if (!newSub.seo.keywords) {
                            newSub.seo.keywords = `gtu ${newSub.name.toLowerCase()}, ${newSub.code}, ${newBranch.shortName.toLowerCase()} ${newSem.id}, diploma books free download, khudkibook`;
                        }
                        
                        newSem.subjects.push(newSub);
                    });
                    
                    // Auto-generate semester SEO if empty
                    if (!newSem.seo.title) {
                        newSem.seo.title = `GTU Diploma ${newBranch.shortName} ${newSem.name} - All Books Free Download | KhudKibook`;
                    }
                    if (!newSem.seo.description) {
                        newSem.seo.description = `Download free study material for GTU Diploma ${newBranch.shortName} ${newSem.name}. Books, Notes, Papers, Solutions & More.`;
                    }
                    
                    newBranch.semesters.push(newSem);
                });
                
                // Add subjects from HTML scan that aren't in existing DB
                addMissingSubjectsFromHtml(newBranch, slugMap, 'diploma');
                
                diplomaDomain.branches.push(newBranch);
            });
        }
    }
    
    // Add branches from HTML scan that aren't in existing DB
    addMissingBranchesFromHtml(diplomaDomain, slugMap, 'diploma');
    
    gtu.domains.push(diplomaDomain);
    
    // ---- BE domain ----
    const beDomain = buildBeDomain(slugMap);
    if (beDomain.branches.length > 0) {
        gtu.domains.push(beDomain);
    }
    
    newDb.universities.push(gtu);
    
    return newDb;
}

function buildBeDomain(slugMap) {
    const beDomain = {
        id: "be",
        name: "Bachelor of Engineering",
        urlPrefix: "BE",
        branches: []
    };
    
    // Collect all BE entries from slugMap
    const beBranches = {};
    Object.entries(slugMap).forEach(([key, data]) => {
        if (data.domain !== 'be') return;
        
        const branchId = data.branch;
        if (!beBranches[branchId]) {
            beBranches[branchId] = {
                id: branchId,
                name: getBranchFullName(branchId),
                shortName: branchId === 'common' ? 'Common' : getBranchFullName(branchId),
                image: getBranchImage(branchId),
                semesters: {}
            };
        }
        
        if (!beBranches[branchId].semesters[data.sem]) {
            beBranches[branchId].semesters[data.sem] = {
                id: data.sem,
                name: formatSemName(data.sem),
                seo: { title: "", keywords: "", description: "" },
                subjects: []
            };
        }
        
        const sub = {
            code: data.code,
            name: data.name,
            slug: data.slug,
            image: data.image || "",
            credit: data.credit || 0,
            marks: 0,
            isElective: false,
            categories: "Core",
            seo: data.seo || { title: "", keywords: "", description: "" },
            materials: buildMaterialsFromHtml(data)
        };
        
        beBranches[branchId].semesters[data.sem].subjects.push(sub);
    });
    
    // Also try to merge data from be.json
    const beJsonPath = path.join(PUBLIC_DIR, 'be.json');
    if (fs.existsSync(beJsonPath)) {
        try {
            const beJson = JSON.parse(fs.readFileSync(beJsonPath, 'utf-8'));
            mergeBeJson(beBranches, beJson, slugMap);
        } catch (e) {
            console.log('Warning: Could not parse be.json:', e.message);
        }
    }
    
    // Convert semesters obj to array and push to domain
    Object.values(beBranches).forEach(branch => {
        const finalBranch = {
            id: branch.id,
            name: branch.name,
            shortName: branch.shortName,
            image: branch.image,
            semesters: Object.values(branch.semesters).sort((a, b) => {
                const aNum = parseInt(a.id.replace('sem', ''));
                const bNum = parseInt(b.id.replace('sem', ''));
                return aNum - bNum;
            })
        };
        beDomain.branches.push(finalBranch);
    });
    
    return beDomain;
}

function mergeBeJson(beBranches, beJson, slugMap) {
    // be.json structure: { "2018": { "sem1": { "common": [...], "it": [...] } } }
    Object.entries(beJson).forEach(([year, semesters]) => {
        Object.entries(semesters).forEach(([semId, branches]) => {
            if (typeof branches !== 'object') return;
            Object.entries(branches).forEach(([branchId, subjects]) => {
                if (!Array.isArray(subjects)) return;
                
                if (!beBranches[branchId]) {
                    beBranches[branchId] = {
                        id: branchId,
                        name: getBranchFullName(branchId),
                        shortName: branchId === 'common' ? 'Common' : getBranchFullName(branchId),
                        image: getBranchImage(branchId),
                        semesters: {}
                    };
                }
                
                if (!beBranches[branchId].semesters[semId]) {
                    beBranches[branchId].semesters[semId] = {
                        id: semId,
                        name: formatSemName(semId),
                        seo: { title: "", keywords: "", description: "" },
                        subjects: []
                    };
                }
                
                const existingSem = beBranches[branchId].semesters[semId];
                
                subjects.forEach(sub => {
                    const code = String(sub.bookCode || '');
                    // Check if already added from HTML scan
                    if (existingSem.subjects.find(s => s.code === code)) return;
                    
                    // Try to find slug from HTML scan
                    const htmlKey = Object.keys(slugMap).find(k => {
                        const d = slugMap[k];
                        return d.domain === 'be' && d.code === code;
                    });
                    const slug = htmlKey ? slugMap[htmlKey].slug : code;
                    
                    const materials = [];
                    
                    // Books
                    (sub.booksLink || []).forEach((link, i) => {
                        if (link) materials.push({ type: "book", label: `Book PDF ${i + 1}`, link, year: "all", language: "english" });
                    });
                    
                    // Gujarati books
                    (sub.GujbooksLink || []).forEach((link, i) => {
                        if (link) materials.push({ type: "book", label: `Gujarati Book ${i + 1}`, link, year: "all", language: "gujarati" });
                    });
                    
                    // Syllabus
                    if (sub.syllabus) {
                        materials.push({ type: "syllabus", label: "Official Syllabus", link: sub.syllabus, year: "all" });
                    }
                    
                    // Papers
                    const papers = sub.bookPapers || [];
                    for (let i = 0; i < papers.length - 1; i += 2) {
                        if (papers[i] && papers[i + 1]) {
                            materials.push({ type: "paper", label: papers[i + 1].trim(), link: papers[i], year: "all" });
                        }
                    }
                    
                    existingSem.subjects.push({
                        code: code,
                        name: sub.bookName || '',
                        slug: slug,
                        image: sub.bookImage || '',
                        credit: sub.bookCredit || 0,
                        marks: sub.totalMarks || 0,
                        isElective: sub.isElective === "Yes",
                        categories: sub.categories || "Core",
                        seo: {
                            title: `${sub.bookName || ''} - GTU B.E. Free Download | KhudKibook`,
                            description: `Download free ${sub.bookName || ''} study material for GTU B.E. ${formatSemName(semId)}.`,
                            keywords: `gtu be ${(sub.bookName || '').toLowerCase()}, ${code}, free download`
                        },
                        materials: materials
                    });
                });
            });
        });
    });
}


// ============================================================
// Helper functions
// ============================================================

function findSlugForSubject(slugMap, branchId, semId, code, name) {
    // Try to find by branch/sem/code match
    for (const [key, data] of Object.entries(slugMap)) {
        if (data.domain === 'diploma' && data.branch === branchId && data.sem === semId && data.code === code) {
            return data.slug;
        }
    }
    // Try code match without C prefix
    const cleanCode = code.replace(/^C/, '');
    for (const [key, data] of Object.entries(slugMap)) {
        if (data.domain === 'diploma' && data.branch === branchId && data.sem === semId) {
            const dataCleanCode = data.code.replace(/^C/, '');
            if (dataCleanCode === cleanCode) return data.slug;
        }
    }
    // Fallback: generate slug from name
    return generateSlugFromName(name);
}

function findHtmlData(slugMap, branchId, semId, code) {
    for (const [key, data] of Object.entries(slugMap)) {
        if (data.domain === 'diploma' && data.branch === branchId && data.sem === semId && data.code === code) {
            return data;
        }
    }
    const cleanCode = code.replace(/^C/, '');
    for (const [key, data] of Object.entries(slugMap)) {
        if (data.domain === 'diploma' && data.branch === branchId && data.sem === semId) {
            if (data.code.replace(/^C/, '') === cleanCode) return data;
        }
    }
    return null;
}

function generateSlugFromName(name) {
    if (!name) return 'unknown';
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 40);
}

function convertMaterials(existingMaterials, htmlData) {
    const materials = [];
    
    // Create link -> label lookup from htmlData
    const htmlLabelMap = {};
    if (htmlData && htmlData.driveLinks) {
        htmlData.driveLinks.forEach(dl => {
            if (dl.link && dl.label && dl.label !== 'Book PDF' && dl.label !== 'Gujarati Book') {
                htmlLabelMap[dl.link] = dl.label;
            }
        });
    }
    
    existingMaterials.forEach(mat => {
        const type = mat.type || 'Book';
        let label = mat.label || '';
        const link = mat.link || '';
        
        if (!link || link === '#') return;
        
        // Prefer descriptive label from HTML scan if available
        if (htmlLabelMap[link]) {
            label = htmlLabelMap[link];
        }
        
        let materialType = 'book';
        let language = 'english';
        
        if (type === 'Paper' || label.match(/SU\s+\d{4}|WE\s+\d{4}|Summer|Winter|\b\d{4}\b/i)) {
            materialType = 'paper';
        } else if (type === 'Syllabus' || label.toLowerCase().includes('syllabus')) {
            materialType = 'syllabus';
        } else if (type === 'Practical' || label.toLowerCase().includes('practical')) {
            materialType = 'notes';
        } else if (label.toLowerCase().includes('gujarati') || label === 'Gujarati Book') {
            language = 'gujarati';
        }
        
        const matObj = {
            type: materialType,
            label: label,
            link: link,
            year: "all"
        };
        if (materialType === 'book') matObj.language = language;
        materials.push(matObj);
    });
    
    // Auto-fix sequential unit labels for books if labels are generic
    const engBooks = materials.filter(m => m.type === 'book' && m.language !== 'gujarati');
    if (engBooks.length > 1 && engBooks.every(m => !m.label || m.label === 'Book PDF' || m.label === 'Full Textbook')) {
        engBooks.forEach((m, idx) => {
            m.label = idx === engBooks.length - 1 ? 'Full-Book (Complete Textbook)' : `Unit-${idx + 1}`;
        });
    } else if (engBooks.length === 1 && (!engBooks[0].label || engBooks[0].label === 'Book PDF')) {
        engBooks[0].label = 'Full-Book (Complete Textbook)';
    }
    
    const gujBooks = materials.filter(m => m.type === 'book' && m.language === 'gujarati');
    if (gujBooks.length > 1 && gujBooks.every(m => !m.label || m.label === 'Gujarati Book')) {
        gujBooks.forEach((m, idx) => {
            m.label = idx === gujBooks.length - 1 ? 'Full-Book (Gujarati Medium)' : `Unit-${idx + 1} (Gujarati Medium)`;
        });
    } else if (gujBooks.length === 1 && (!gujBooks[0].label || gujBooks[0].label === 'Gujarati Book')) {
        gujBooks[0].label = 'Full-Book (Gujarati Medium)';
    }
    
    // Add any syllabus links from HTML scan
    if (htmlData && htmlData.syllabusLinks) {
        htmlData.syllabusLinks.forEach(syl => {
            if (syl.link && !materials.find(m => m.link === syl.link)) {
                materials.push({
                    type: "syllabus",
                    label: "Official Syllabus PDF",
                    link: syl.link,
                    year: "all"
                });
            }
        });
    }
    
    return materials;
}

function buildMaterialsFromHtml(htmlData) {
    const materials = [];
    
    if (htmlData.driveLinks) {
        const engBooks = [];
        const gujBooks = [];
        const papers = [];
        
        htmlData.driveLinks.forEach(dl => {
            const rawLabel = dl.label || '';
            let type = 'book';
            let language = 'english';
            
            if (rawLabel.match(/^\d{4}$/) || rawLabel.match(/SU|WE|Summer|Winter/i)) {
                type = 'paper';
            } else if (rawLabel.toLowerCase().includes('gujarati')) {
                language = 'gujarati';
            }
            
            if (!dl.link || dl.link === 'https://drive.google.com/file/d/') return;
            
            const mat = {
                type: type,
                label: rawLabel,
                link: dl.link,
                year: "all"
            };
            if (type === 'book') mat.language = language;
            
            if (type === 'book' && language === 'english') engBooks.push(mat);
            else if (type === 'book' && language === 'gujarati') gujBooks.push(mat);
            else if (type === 'paper') papers.push(mat);
            else materials.push(mat);
        });
        
        // Auto-fix sequential unit labels for books if generic
        if (engBooks.length > 1 && engBooks.every(m => !m.label || m.label === 'Book PDF')) {
            engBooks.forEach((m, idx) => {
                m.label = idx === engBooks.length - 1 ? 'Full-Book (Complete Textbook)' : `Unit-${idx + 1}`;
            });
        } else if (engBooks.length === 1 && (!engBooks[0].label || engBooks[0].label === 'Book PDF')) {
            engBooks[0].label = 'Full-Book (Complete Textbook)';
        }
        
        if (gujBooks.length > 1 && gujBooks.every(m => !m.label || m.label === 'Gujarati Book')) {
            gujBooks.forEach((m, idx) => {
                m.label = idx === gujBooks.length - 1 ? 'Full-Book (Gujarati Medium)' : `Unit-${idx + 1} (Gujarati Medium)`;
            });
        } else if (gujBooks.length === 1 && (!gujBooks[0].label || gujBooks[0].label === 'Gujarati Book')) {
            gujBooks[0].label = 'Full-Book (Gujarati Medium)';
        }
        
        materials.push(...engBooks, ...gujBooks, ...papers);
    }
    
    if (htmlData.syllabusLinks) {
        htmlData.syllabusLinks.forEach(syl => {
            if (syl.link && !materials.find(m => m.link === syl.link)) {
                materials.push({
                    type: "syllabus",
                    label: "Official Syllabus PDF",
                    link: syl.link,
                    year: "all"
                });
            }
        });
    }
    
    return materials;
}

function addMissingSubjectsFromHtml(branch, slugMap, domain) {
    Object.entries(slugMap).forEach(([key, data]) => {
        if (data.domain !== domain || data.branch !== branch.id) return;
        
        let sem = branch.semesters.find(s => s.id === data.sem);
        if (!sem) {
            sem = {
                id: data.sem,
                name: formatSemName(data.sem),
                seo: { title: "", keywords: "", description: "" },
                subjects: []
            };
            branch.semesters.push(sem);
        }
        
        // Check if subject already exists
        const exists = sem.subjects.find(s => s.code === data.code || s.slug === data.slug);
        if (exists) {
            // Update slug if missing
            if (!exists.slug || exists.slug === exists.code) {
                exists.slug = data.slug;
            }
            // Update SEO if empty
            if (!exists.seo?.title && data.seo?.title) {
                exists.seo = data.seo;
            }
            return;
        }
        
        // Add new subject
        sem.subjects.push({
            code: data.code,
            name: data.name,
            slug: data.slug,
            image: data.image || "",
            credit: data.credit || 0,
            marks: 0,
            isElective: false,
            categories: "Core",
            seo: data.seo || { title: "", keywords: "", description: "" },
            materials: buildMaterialsFromHtml(data)
        });
    });
    
    // Sort semesters
    branch.semesters.sort((a, b) => {
        const aNum = parseInt(a.id.replace('sem', ''));
        const bNum = parseInt(b.id.replace('sem', ''));
        return aNum - bNum;
    });
}

function addMissingBranchesFromHtml(domain, slugMap, domainId) {
    const existingBranchIds = domain.branches.map(b => b.id);
    const missingBranches = {};
    
    Object.entries(slugMap).forEach(([key, data]) => {
        if (data.domain !== domainId) return;
        if (existingBranchIds.includes(data.branch)) return;
        
        if (!missingBranches[data.branch]) {
            missingBranches[data.branch] = {
                id: data.branch,
                name: getBranchFullName(data.branch),
                shortName: data.branch,
                image: getBranchImage(data.branch),
                semesters: []
            };
        }
    });
    
    Object.values(missingBranches).forEach(branch => {
        addMissingSubjectsFromHtml(branch, slugMap, domainId);
        domain.branches.push(branch);
    });
}

function getBranchFullName(id) {
    const map = {
        'it': 'Information Technology',
        'computer': 'Computer Engineering',
        'civil': 'Civil Engineering',
        'electrical': 'Electrical Engineering',
        'mechanical': 'Mechanical Engineering',
        'common': 'Common (All Branches)'
    };
    return map[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

function getBranchImage(id) {
    const map = {
        'it': 'https://chauhanpriyanshu001.github.io/pic.github.io/itthumb.webp',
        'computer': 'https://chauhanpriyanshu001.github.io/pic.github.io/computerthumb.webp',
        'civil': 'https://chauhanpriyanshu001.github.io/pic.github.io/civilthumb.webp',
        'electrical': 'https://chauhanpriyanshu001.github.io/pic.github.io/electricalthumb.webp',
        'mechanical': 'https://chauhanpriyanshu001.github.io/pic.github.io/mechanicalthumb.webp'
    };
    return map[id] || '';
}

function formatSemName(id) {
    const num = id.replace('sem', '');
    return `Semester ${num}`;
}


// ============================================================
// 4. Run Migration
// ============================================================

function run() {
    console.log('==========================================');
    console.log('  KHUDKIBOOK MIGRATION SCRIPT');
    console.log('==========================================\n');
    
    // Step 1: Scan old HTML files
    console.log('[1/4] Scanning old HTML files for slug mappings...');
    const slugMap = scanOldHtmlFiles();
    console.log(`     Found ${Object.keys(slugMap).length} subject pages\n`);
    
    // Step 2: Read existing DB
    console.log('[2/4] Reading existing site_db.json...');
    const existingDb = readExistingDb();
    if (existingDb) {
        let subCount = 0;
        existingDb.universities?.forEach(u => u.branches?.forEach(b => b.semesters?.forEach(s => subCount += (s.subjects?.length || 0))));
        console.log(`     Existing DB has ${subCount} subjects\n`);
    }
    
    // Step 3: Build new DB
    console.log('[3/4] Building new 5-level hierarchy...');
    const newDb = buildNewDb(existingDb, slugMap);
    
    // Stats
    let stats = { universities: 0, domains: 0, branches: 0, semesters: 0, subjects: 0, materials: 0 };
    newDb.universities.forEach(u => {
        stats.universities++;
        u.domains.forEach(d => {
            stats.domains++;
            d.branches.forEach(b => {
                stats.branches++;
                b.semesters.forEach(s => {
                    stats.semesters++;
                    s.subjects.forEach(sub => {
                        stats.subjects++;
                        stats.materials += sub.materials.length;
                    });
                });
            });
        });
    });
    
    console.log(`     Universities: ${stats.universities}`);
    console.log(`     Domains: ${stats.domains}`);
    console.log(`     Branches: ${stats.branches}`);
    console.log(`     Semesters: ${stats.semesters}`);
    console.log(`     Subjects: ${stats.subjects}`);
    console.log(`     Materials: ${stats.materials}\n`);
    
    // Print hierarchy
    newDb.universities.forEach(u => {
        console.log(`  📚 ${u.name} (${u.shortName})`);
        u.domains.forEach(d => {
            console.log(`    📂 ${d.name} [url: /${d.urlPrefix || '(root)'}]`);
            d.branches.forEach(b => {
                const totalSubs = b.semesters.reduce((sum, s) => sum + s.subjects.length, 0);
                console.log(`      🔹 ${b.name} — ${b.semesters.length} sems, ${totalSubs} subjects`);
                b.semesters.forEach(s => {
                    const slugs = s.subjects.map(sub => sub.slug).join(', ');
                    console.log(`        ${s.name}: ${s.subjects.length} subjects [${slugs}]`);
                });
            });
        });
    });
    
    // Step 4: Save
    console.log('\n[4/4] Saving...');
    
    // Backup old file
    if (fs.existsSync(OLD_DB_PATH)) {
        fs.copyFileSync(OLD_DB_PATH, BACKUP_PATH);
        console.log(`     Backed up old DB to ${BACKUP_PATH}`);
    }
    
    fs.writeFileSync(NEW_DB_PATH, JSON.stringify(newDb, null, 2));
    console.log(`     New DB saved to ${NEW_DB_PATH}`);
    
    console.log('\n==========================================');
    console.log('  MIGRATION COMPLETE');
    console.log('==========================================');
    console.log(`\nTotal: ${stats.subjects} subjects with ${stats.materials} materials across ${stats.branches} branches.`);
    console.log('Next step: node scripts/generate.js');
}

run();
