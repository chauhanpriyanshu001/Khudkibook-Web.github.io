const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_FILE = path.join(ROOT_DIR, 'data/site_db.json');
const TEMPLATE_FILE = path.join(PUBLIC_DIR, 'templates/base.html');
const DEFAULT_SITE_URL = 'https://khudkibook.web.app';
const DEFAULT_AD_PUB_ID = 'ca-pub-4211827566541334';

/**
 * Main function to generate the site.
 */
function generateSite() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error("No database found at " + DATA_FILE);
        return;
    }

    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const SITE_URL = (db.config && db.config.siteUrl) || DEFAULT_SITE_URL;
    const AD_PUB_ID = (db.config && db.config.adPubId) || DEFAULT_AD_PUB_ID;
    const template = fs.readFileSync(TEMPLATE_FILE, 'utf-8').replace(/ca-pub-\d{16}/g, AD_PUB_ID);

    console.log("Starting site generation with 100% design consistency, SEO & AdSense...");

    // Convert an ALL-CAPS data name into a clean Title Case display name
    function titleCase(str) {
        const stop = new Set(['a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'the', 'vs']);
        return String(str || '')
            .toLowerCase()
            .split(/\s+/)
            .map(w => {
                if (!w) return w;
                if (stop.has(w)) return w;
                if ((w.match(/[a-z]/g) || []).length <= 3) return w.toUpperCase();
                return w.charAt(0).toUpperCase() + w.slice(1);
            })
            .join(' ');
    }

    // Helper to get branches from domain or unv
    function getBranchList(unv) {
        if (unv.domains && unv.domains.length > 0) {
            const list = [];
            unv.domains.forEach(d => {
                (d.branches || []).forEach(b => {
                    list.push({ ...b, domainId: d.id, domainName: d.name, urlPrefix: d.urlPrefix || '' });
                });
            });
            return list;
        }
        return unv.branches || [];
    }

    // Default generic placeholder used when no real image exists
    const DEFAULT_COVER = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';

    // Deterministic cover gradient palette derived from a string seed
    function coverGradient(seed) {
        const palettes = [
            ['linear-gradient(160deg,#4f46e5 0%,#7c3aed 55%,#1e1b4b 140%)', '#4f46e5'],
            ['linear-gradient(160deg,#0ea5e9 0%,#6366f1 55%,#1e1b4b 140%)', '#0ea5e9'],
            ['linear-gradient(160deg,#059669 0%,#0ea5e9 55%,#0f172a 140%)', '#059669'],
            ['linear-gradient(160deg,#d97706 0%,#dc2626 55%,#1e1b4b 140%)', '#d97706'],
            ['linear-gradient(160deg,#7c3aed 0%,#db2777 55%,#1e1b4b 140%)', '#7c3aed'],
            ['linear-gradient(160deg,#0d9488 0%,#2563eb 55%,#0f172a 140%)', '#0d9488'],
            ['linear-gradient(160deg,#db2777 0%,#7c3aed 55%,#1e1b4b 140%)', '#db2777'],
            ['linear-gradient(160deg,#2563eb 0%,#14b8a6 55%,#0f172a 140%)', '#2563eb']
        ];
        let h = 0;
        for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + (seed.charCodeAt(i) || 0)) >>> 0;
        return palettes[h % palettes.length];
    }

    // Decide whether to use a real <img> or the CSS-generated cover
    function hasRealImage(src) {
        if (!src) return false;
        if (src === DEFAULT_COVER || src === 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp') return false;
        return true;
    }

    // Build CSS-generated book cover markup (realistic book)
    function coverHTML(book) {
        const [grad, color] = coverGradient(book.name || book.code);
        const title = (book.name || 'GTU Book').toUpperCase();
        const code = book.code || '';
        const short = (book.name || '').split(' ').slice(0, 3).join(' ').toUpperCase();
        return `
            <div class="bookcover" style="background:${grad};">
                <div class="bookcover-ribbon">GTU Study</div>
                <div class="bookcover-top"><span class="bookcover-brand">KHUDKIBOOK</span></div>
                <div class="bookcover-middle">
                    <span class="bookcover-title">${short || title}</span>
                    <span class="bookcover-meta">${code}</span>
                </div>
                <div class="bookcover-bottom">
                    <span>FREE PDF</span>
                    <span class="bc-rule"></span>
                    <span>${code || 'GTU'}</span>
                </div>
            </div>`;
    }

    // Renders the cover area: real image if available, else CSS book cover
    function coverArea(book, imgClass, alt) {
        if (hasRealImage(book.image)) {
            return `<img class="${imgClass}" src="${book.image}" alt="${alt}" loading="lazy" />`;
        }
        return coverHTML(book);
    }

    // Helper to render book card thumbnail
    function renderBookCard(book, href) {
        return `
            <a href="${href}" class="rec-book-card" style="text-decoration: none;">
                <div class="rec-card-cover">
                    ${coverArea(book, 'rec-cover-img', `${book.name} - GTU Book Cover`)}
                </div>
                <div class="rec-card-info">
                    <h4 class="rec-card-title">${book.name}</h4>
                    <div class="rec-card-meta">
                        <span class="rec-meta-badge">Code: ${book.code || 'N/A'}</span>
                        <span class="rec-meta-credit">Credit: ${book.credit || 4}</span>
                    </div>
                    <span class="rec-card-btn">Open &rarr;</span>
                </div>
            </a>
        `;
    }

    // In-content Ad Slot HTML
    const inContentAdHTML = `
        <div class="ad-slot-wrapper" style="margin: 35px auto;">
            <span class="ad-label">Advertisement</span>
            <div class="ad-container ad-in-content">
                <ins class="adsbygoogle"
                     style="display:block; width:100%; text-align:center;"
                     data-ad-client="${AD_PUB_ID}"
                     data-ad-slot="4067607591"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
                <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
            </div>
        </div>
    `;

    // Iterate through Universities
    db.universities.forEach(unv => {
        const branches = getBranchList(unv);
        branches.forEach(branch => {
            const branchHomeRel = branch.urlPrefix ? `/${branch.urlPrefix}/${branch.id}homepage.html` : `/${branch.id}homepage.html`;
            const branchHomeFilePath = branch.urlPrefix ? 
                path.join(PUBLIC_DIR, branch.urlPrefix, `${branch.id}homepage.html`) : 
                path.join(PUBLIC_DIR, `${branch.id}homepage.html`);
            
            // Ensure parent dir exists
            fs.mkdirSync(path.dirname(branchHomeFilePath), { recursive: true });

            const branchName = titleCase(branch.name);
            const branchDisplay = branch.shortName || branchName;

            // --- 0. Generate Branch Homepage (e.g. ithomepage.html) ---
            const allBranchSubjects = [];
            (branch.semesters || []).forEach(s => {
                (s.subjects || []).forEach(sub => allBranchSubjects.push({ ...sub, semId: s.id, semName: s.name }));
            });

            let branchContent = `
                <div style="width: 100%; max-width: 1100px; margin-bottom: 40px;">
                    <h2 class="kl789123"><i class="fas fa-graduation-cap" style="color: var(--accent); margin-right: 8px;"></i> Select Your Semester</h2>
                    <div class="maniwrraper">
                        ${(branch.semesters || []).map(s => {
                            const semLink = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${s.id}/index.html`;
                            return `
                                <a href="${semLink}" class="navlink sem-card-link" style="text-decoration: none;">
                                    <div>
                                        <div class="sem-card-title"><i class="fas fa-book-open"></i> ${s.name}</div>
                                        <div class="sem-card-sub">${(s.subjects || []).length} Subjects Included &rarr;</div>
                                    </div>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>

                ${inContentAdHTML}

                <div style="width: 100%; max-width: 1100px; margin-top: 20px;">
                    <h2 class="kl789123"><i class="fas fa-star" style="color: var(--accent); margin-right: 8px;"></i> Popular ${branchDisplay} Subjects</h2>
                    <div class="rec-grid">
                        ${allBranchSubjects.slice(0, 8).map(sub => {
                            const subHref = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sub.semId}/${sub.slug || sub.code}.html`;
                            return renderBookCard(sub, subHref);
                        }).join('')}
                    </div>
                </div>
            `;

            let branchBreadcrumbs = `
                <a class="nvi751" href="/index.html"><i class="fas fa-home"></i> Home</a>
                <span class="nvsep729"> / </span>
                <span id="atnvli953">${branchDisplay}</span>
            `;

            const branchBreadcrumbJson = {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/index.html` },
                    { "@type": "ListItem", "position": 2, "name": branchDisplay, "item": `${SITE_URL}${branchHomeRel}` }
                ]
            };

            const branchSchema = {
                "@context": "https://schema.org",
                "@type": "EducationalOccupationalProgram",
                "name": `GTU ${branchName} Engineering Study Material`,
                "description": `Free GTU textbooks, syllabus, and solved papers for ${branchName} all semesters at Khudkibook.`,
                "provider": {
                    "@type": "EducationalOrganization",
                    "name": "Khudkibook",
                    "url": SITE_URL
                }
            };

            let branchRendered = template
                .replace(/{{TITLE}}/g, `GTU ${branchName} - Free Books, Syllabus & Solved Papers | Khudkibook`)
                .replace(/{{KEYWORDS}}/g, `gtu ${branchName.toLowerCase()}, gtu ${branchDisplay.toLowerCase()}, diploma engineering books, syllabus, papers`)
                .replace(/{{DESCRIPTION}}/g, `Download free GTU study material for ${branchName}. Textbooks, notes, previous year question papers, and official syllabus.`)
                .replace(/{{CANONICAL_URL}}/g, `${SITE_URL}${branchHomeRel}`)
                .replace(/{{OG_IMAGE}}/g, branch.image || DEFAULT_COVER)
                .replace(/{{SCHEMA_JSON}}/g, `<script type="application/ld+json">${JSON.stringify(branchSchema)}</script><script type="application/ld+json">${JSON.stringify(branchBreadcrumbJson)}</script>`)
                .replace(/{{PAGE_HEADER}}/g, `GTU ${branchName}`)
                .replace(/{{BREADCRUMBS}}/g, branchBreadcrumbs)
                .replace(/{{CONTENT}}/g, branchContent)
                .replace(/{{SCRIPTS}}/g, "");

            fs.writeFileSync(branchHomeFilePath, branchRendered);
            console.log(`Generated Branch Homepage: ${branchHomeRel}`);

            // Iterate through Semesters
            (branch.semesters || []).forEach(sem => {
                const semDirPath = branch.urlPrefix ? 
                    path.join(PUBLIC_DIR, branch.urlPrefix, branch.id, sem.id) : 
                    path.join(PUBLIC_DIR, branch.id, sem.id);
                fs.mkdirSync(semDirPath, { recursive: true });

                const branchHome = branch.urlPrefix ? `/${branch.urlPrefix}/${branch.id}homepage.html` : `/${branch.id}homepage.html`;
                const semUrl = `${SITE_URL}/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/index.html`;

                // --- 1. Generate Semester Index Page ---
                const semSubjects = (sem.subjects || []);

                let semesterContent = `
                    <div class="sydrp">
                        <div class="syhdd">
                            <span><i class="fas fa-book-open" style="color: var(--accent); margin-right: 8px;"></i> Official Syllabus & Subjects</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">${semSubjects.length} Subjects Included</span>
                        </div>
                        <table id="table">
                            <thead>
                                <tr>
                                    <th>Subject Code</th>
                                    <th>Subject Name</th>
                                    <th>Credits</th>
                                    <th>Total Marks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${semSubjects.map(sub => {
                                    const subHref = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/${sub.slug || sub.code}.html`;
                                    return `
                                    <tr data-subject>
                                        <td><strong>${sub.code || 'N/A'}</strong></td>
                                        <td><a class="ssn" href="${subHref}">${sub.name}</a></td>
                                        <td>${sub.credit || 4}</td>
                                        <td>${sub.marks || 100}</td>
                                    </tr>
                                `;}).join('')}
                            </tbody>
                        </table>
                    </div>

                    ${inContentAdHTML}

                    <div style="width: 100%; max-width: 1100px; margin-top: 30px;">
                        <h2 class="kl789123" style="margin-bottom: 25px;"><i class="fas fa-layer-group" style="color: var(--accent); margin-right: 8px;"></i> Available Books & Materials</h2>
                        <div id="sem-cards" class="rec-grid">
                            ${semSubjects.map(sub => {
                                const subHref = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/${sub.slug || sub.code}.html`;
                                return `
                                <div class="sem-card">${renderBookCard(sub, subHref)}</div>
                            `;}).join('')}
                        </div>
                    </div>
                `;

                let semBreadcrumbs = `
                    <a class="nvi751" href="/index.html"><i class="fas fa-home"></i> Home</a>
                    <span class="nvsep729"> / </span>
                    <a class="nvi751" href="${branchHome}">${branchDisplay}</a>
                    <span class="nvsep729"> / </span>
                    <span id="atnvli953">${sem.name}</span>
                `;

                const semBreadcrumbJson = {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/index.html` },
                        { "@type": "ListItem", "position": 2, "name": branchDisplay, "item": `${SITE_URL}${branchHome}` },
                        { "@type": "ListItem", "position": 3, "name": sem.name, "item": semUrl }
                    ]
                };

                const semSchema = {
                    "@context": "https://schema.org",
                    "@type": "EducationalOccupationalProgram",
                    "name": `GTU ${branchName} ${sem.name} Study Material`,
                    "description": sem.seo.description || `Free study materials, textbooks, question papers, and syllabus for GTU ${branchName} ${sem.name}.`,
                    "provider": {
                        "@type": "EducationalOrganization",
                        "name": "Khudkibook",
                        "url": SITE_URL
                    }
                };

                let semRendered = template
                    .replace(/{{TITLE}}/g, sem.seo.title || `GTU ${branchName} ${sem.name} - Books, Syllabus & Papers | Khudkibook`)
                    .replace(/{{KEYWORDS}}/g, sem.seo.keywords || `gtu ${branchName.toLowerCase()}, ${sem.name.toLowerCase()}, gtu diploma books, gtu old papers`)
                    .replace(/{{DESCRIPTION}}/g, sem.seo.description || `Download free study material for GTU ${branchName} ${sem.name}. Books, Notes, Papers, Solutions & More.`)
                    .replace(/{{CANONICAL_URL}}/g, semUrl)
                    .replace(/{{OG_IMAGE}}/g, branch.image || DEFAULT_COVER)
                    .replace(/{{SCHEMA_JSON}}/g, `<script type="application/ld+json">${JSON.stringify(semSchema)}</script><script type="application/ld+json">${JSON.stringify(semBreadcrumbJson)}</script>`)
                    .replace(/{{PAGE_HEADER}}/g, `GTU ${branchDisplay} - ${sem.name}`)
                    .replace(/{{BREADCRUMBS}}/g, semBreadcrumbs)
                    .replace(/{{CONTENT}}/g, semesterContent)
                    .replace(/{{SCRIPTS}}/g, "");

                fs.writeFileSync(path.join(semDirPath, 'index.html'), semRendered);
                // Also write homepage.html for complete backward compatibility
                fs.writeFileSync(path.join(semDirPath, 'homepage.html'), semRendered);
                console.log(`Generated Semester: /${unv.id}/${branch.id}/${sem.id}/index.html`);

                // --- 2. Generate Individual Subject (Book) Pages ---
                (sem.subjects || []).forEach(sub => {
                    if (!sub.code && !sub.name && !sub.slug) return;
                    const subFile = sub.slug || sub.code || 'subject';
                    const subUrl = `${SITE_URL}/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/${subFile}.html`;

                    // Recommendations
                    const sameSemSubjects = (sem.subjects || []).filter(s => (s.code || s.slug) !== (sub.code || sub.slug));
                    
                    // Build clean semester switcher pills
                    const semSwitcherHTML = (branch.semesters || []).map(s => {
                        const isCurrent = s.id === sem.id;
                        const sUrl = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${s.id}/index.html`;
                        return `<a href="${sUrl}" class="sem-switcher-pill ${isCurrent ? 'active' : ''}"><i class="fas fa-layer-group"></i> ${s.name}</a>`;
                    }).join('');

                    let recommendedHTML = `
                        <section class="rec-module">
                            ${sameSemSubjects.length > 0 ? `
                                <h2 class="kl789123"><i class="fas fa-book-reader" style="color: var(--accent); margin-right: 8px;"></i> More Subjects in ${sem.name}</h2>
                                <div class="rec-grid">
                                    ${sameSemSubjects.map(s => {
                                        const sHref = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/${s.slug || s.code}.html`;
                                        return renderBookCard(s, sHref);
                                    }).join('')}
                                </div>
                            ` : ''}
                            
                            <div class="sem-switcher-section">
                                <h3 class="sem-switcher-title"><i class="fas fa-compass" style="color: var(--accent); margin-right: 8px;"></i> Explore Other Semesters (${branchDisplay})</h3>
                                <div class="sem-switcher-pills">
                                    ${semSwitcherHTML}
                                </div>
                            </div>
                        </section>
                    `;

// Group materials
                const allMaterials = sub.materials || [];
                const isGujMat = (m) => ((m.label || '').toLowerCase().includes('gujarati') || m.language === 'gujarati');
                const isSyllabusRef = (m) => {
                    const lbl = (m.label || '').toLowerCase();
                    const link = (m.link || '').toLowerCase();
                    return /syllabus/.test(lbl) || /syallbus/.test(link) || link.includes('/syllabus/');
                };
                const engBooks = allMaterials.filter(m => (m.type || '').toLowerCase() === 'book' && !isGujMat(m) && !isSyllabusRef(m));
                const gujBooks = allMaterials.filter(m => (m.type || '').toLowerCase() === 'book' && isGujMat(m));
                const papers = allMaterials.filter(m => (m.type || '').toLowerCase() === 'paper' || (m.label || '').match(/^(?:SU|WE|\d{4}|Summer|Winter)/i));
                const syllabusList = allMaterials.filter(m => (m.type || '').toLowerCase() === 'syllabus' || isSyllabusRef(m));
                const syllabusMat = syllabusList.find(m => (m.type || '').toLowerCase() === 'syllabus') || syllabusList[0] || null;
                const otherMats = allMaterials.filter(m => !engBooks.includes(m) && !gujBooks.includes(m) && !papers.includes(m) && !syllabusList.includes(m));

                    // Reusable empty-state HTML shown inside modals with no material
                    const modalEmptyState = (label) => `
                        <div style="text-align:center; padding:30px 15px;">
                            <i class="fas fa-clock" style="font-size:2.5rem; color:var(--accent); opacity:0.7; margin-bottom:12px; display:block;"></i>
                            <h4 style="margin:0 0 8px; color:var(--text); font-size:1.1rem;">${label} Coming Soon</h4>
                            <p style="color:var(--text-muted); font-size:0.9rem; margin:0 0 18px;">We are working hard to add this material. Stay tuned for updates!</p>
                            <a href="https://www.instagram.com/khudkibook/" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:8px; padding:10px 22px; border-radius:10px; background:linear-gradient(135deg,#f43f5e,#ec4899); color:#fff; font-weight:700; font-size:0.95rem; text-decoration:none; transition:transform 0.2s,box-shadow 0.2s;">
                                <i class="fab fa-instagram" style="font-size:1.15rem;"></i> Follow on Instagram for Updates
                            </a>
                        </div>`;

                    function modalRow(m) {
                        return `
                                    <a href="${m.link}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-pdf" style="margin-right: 8px;"></i> ${m.label || 'Material'}</a>
                                `;
                    }
                    // Deduplicate materials by link while preserving order.
                    function dedupeByLink(list) {
                        return [...new Map(list.map(m => [m.link, m])).values()];
                    }
                    function modalLinks(list) {
                        return dedupeByLink(list).map(modalRow).join('');
                    }
                    // Put the complete textbook first, then chapters in order.
                    function orderBooks(list) {
                        return [...list].sort((a, b) => {
                            const al = (a.label || '').toLowerCase();
                            const bl = (b.label || '').toLowerCase();
                            const aFull = al.includes('full-book') ? 0 : 1;
                            const bFull = bl.includes('full-book') ? 0 : 1;
                            if (aFull !== bFull) return aFull - bFull;
                            return al.localeCompare(bl);
                        });
                    }

                    // Modal 1: English Book
                    const engModalHTML = engBooks.length > 0 ? `
                        <div class="m741852" id="modal-book">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-book" style="margin-right: 8px;"></i> English Book & Chapters</h3>
                                <div class="yr-body">
                                    ${modalLinks(orderBooks(engBooks))}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="m741852" id="modal-book">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-book" style="margin-right: 8px;"></i> English Book & Chapters</h3>
                                ${modalEmptyState('English Book')}
                            </div>
                        </div>
                    `;

                    const gujModalHTML = gujBooks.length > 0 ? `
                        <div class="m741852" id="modal-gujbook">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-language" style="margin-right: 8px;"></i> Gujarati Book & Chapters</h3>
                                <div class="yr-body">
                                    ${modalLinks(orderBooks(gujBooks))}
                                </div>
                            </div>
                        </div>
                    ` : '';

                    // Modal 3: Papers (all papers shown, no year filter)
                    const papersModalHTML = papers.length > 0 ? `
                        <div class="m741852" id="modal-papers">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-scroll" style="margin-right: 8px;"></i> GTU Previous Year Papers</h3>
                                <div class="yr-body">
                                    ${modalLinks(papers)}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="m741852" id="modal-papers">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-scroll" style="margin-right: 8px;"></i> GTU Previous Year Papers</h3>
                                ${modalEmptyState('Papers')}
                            </div>
                        </div>
                    `;

                    // More study material modal (all materials shown, no year filter)
                    const otherModalHTML = otherMats.length > 0 ? `
                        <div class="m741852" id="modal-other">
                            <div class="mc7913">
                                <span class="mc718293">&times;</span>
                                <h3><i class="fas fa-folder-open" style="margin-right: 8px;"></i> More Study Material</h3>
                                <div class="yr-body">
                                    ${modalLinks(otherMats)}
                                </div>
                            </div>
                        </div>
                    ` : '';

                    // Action buttons: SvgDefs
                    let buttonsHTML = '';
                    if (engBooks.length > 0) {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-book"><i class="fas fa-book"></i> ENG-Book</button>`;
                    } else {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-book"><i class="fas fa-book"></i> Book (Soon)</button>`;
                    }

                    if (gujBooks.length > 0) {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-gujbook"><i class="fas fa-language"></i> GUJ-Book</button>`;
                    }

                    if (syllabusMat && syllabusMat.link) {
                        buttonsHTML += `<a href="${syllabusMat.link}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><button class="mdbtn"><i class="fas fa-graduation-cap"></i> Syllabus</button></a>`;
                    }

                    if (papers.length > 0) {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-papers"><i class="fas fa-file-alt"></i> Paper</button>`;
                    } else {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-papers"><i class="fas fa-file-alt"></i> Paper (Soon)</button>`;
                    }

                    if (otherMats.length > 0) {
                        buttonsHTML += `<button class="mdbtn" data-modal-id="modal-other"><i class="fas fa-folder-open"></i> Materials</button>`;
                    }

                    buttonsHTML += `<button class="shrbtn" onclick="shareBook()"><i class="fas fa-share-alt"></i> Share</button>`;

                    let subjectContent = `
                        <article class="mc759351">
                            <div class="mc759351body">
                            <div class="mc7593512">
                                ${hasRealImage(sub.image)
                                    ? `<img class="mc7593512345" src="${sub.image}" alt="${sub.name} - GTU Book Free Download" />`
                                    : `<div class="kb-showcase-cover" id="kb-showcase-cover">${coverHTML(sub)}</div>`}
                            </div>
                            <div class="mac75935">
                                <div class="badge-group">
                                    <span class="badge badge-accent">Code: ${sub.code || 'N/A'}</span>
                                    <span class="badge">Credits: ${sub.credit || 4}</span>
                                    <span class="badge">${sem.name}</span>
                                    <span class="badge">${branchDisplay}</span>
                                </div>
                                <h1>${sub.name}</h1>
                                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;">
                                    Get the full GTU study material, English & Gujarati textbook PDFs, syllabus curriculum, and solved previous year question papers.
                                </p>
                                
                                <div class="materials-section">
                                    ${buttonsHTML}
                                </div>
                                ${engModalHTML}
                                ${gujModalHTML}
                                ${papersModalHTML}
                                ${otherModalHTML}

                                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border);">
                                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Study on Android App:</p>
                                    <a href="https://play.google.com/store/apps/details?id=web.app.khudkibook" target="_blank" rel="noopener noreferrer">
                                        <img src="https://chauhanpriyanshu001.github.io/pic.github.io/downloadplaystore.png" style="width: 200px; border-radius: 8px;" alt="Download Khudkibook on Google Play Store" />
                                    </a>
                                </div>
                            </div>
                            </div>
                        </article>

                        ${inContentAdHTML}

                        ${recommendedHTML}
                    `;

                    const semIndexUrl = `/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/index.html`;
                    let subBreadcrumbs = `
                        <a class="nvi751" href="/index.html"><i class="fas fa-home"></i> Home</a>
                        <span class="nvsep729"> / </span>
                        <a class="nvi751" href="${branchHome}">${branchDisplay}</a>
                        <span class="nvsep729"> / </span>
                        <a class="nvi751" href="${semIndexUrl}">${sem.name}</a>
                        <span class="nvsep729"> / </span>
                        <span id="atnvli953">${sub.name}</span>
                    `;

                    const subBreadcrumbJson = {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/index.html` },
                            { "@type": "ListItem", "position": 2, "name": branchDisplay, "item": `${SITE_URL}${branchHome}` },
                            { "@type": "ListItem", "position": 3, "name": sem.name, "item": `${SITE_URL}/${branch.urlPrefix ? branch.urlPrefix + '/' : ''}${branch.id}/${sem.id}/index.html` },
                            { "@type": "ListItem", "position": 4, "name": sub.name, "item": subUrl }
                        ]
                    };

                    // Schema.org Course & Book Schema
                    const subjectSchema = {
                        "@context": "https://schema.org",
                        "@type": "Course",
                        "name": sub.name,
                        "description": sub.seo?.description || `Download ${sub.name} GTU Diploma and Degree engineering study material, textbooks, and past papers.`,
                        "courseCode": sub.code || "",
                        "provider": {
                            "@type": "EducationalOrganization",
                            "name": "Khudkibook",
                            "url": SITE_URL
                        },
                        "educationalCredentialAwarded": "GTU Engineering Credit",
                        "hasCourseInstance": {
                            "@type": "CourseInstance",
                            "courseMode": "Online",
                            "instructor": {
                                "@type": "Organization",
                                "name": unv.name
                            }
                        }
                    };

                    let subRendered = template
                        .replace(/{{TITLE}}/g, sub.seo?.title || `${sub.name} (${sub.code}) - GTU ${branchDisplay} Free Books | Khudkibook`)
                        .replace(/{{KEYWORDS}}/g, sub.seo?.keywords || `gtu ${sub.name.toLowerCase()}, ${sub.code}, ${branchDisplay.toLowerCase()}, diploma engineering books`)
                        .replace(/{{DESCRIPTION}}/g, sub.seo?.description || `Download free ${sub.name} study material for GTU ${branchDisplay} ${sem.name}. Books, Notes, Papers, Solutions & More at Khudkibook.`)
                        .replace(/{{CANONICAL_URL}}/g, subUrl)
                        .replace(/{{OG_IMAGE}}/g, sub.image || DEFAULT_COVER)
                        .replace(/{{SCHEMA_JSON}}/g, `<script type="application/ld+json">${JSON.stringify(subjectSchema)}</script><script type="application/ld+json">${JSON.stringify(subBreadcrumbJson)}</script>`)
                        .replace(/{{PAGE_HEADER}}/g, `${sub.name}`)
                        .replace(/{{BREADCRUMBS}}/g, subBreadcrumbs)
                        .replace(/{{CONTENT}}/g, subjectContent)
                        .replace(/{{SCRIPTS}}/g, `
                            <script>
                                function shareBook() {
                                    var data = {
                                        title: document.title,
                                        text: "{$} - Download FREE GTU study material (Book, Syllabus, Papers) on Khudkibook.",
                                        url: window.location.href
                                    };
                                    if (navigator.share) {
                                        navigator.share(data).catch(function() {});
                                    } else if (navigator.clipboard && navigator.clipboard.writeText) {
                                        navigator.clipboard.writeText(data.url).then(function() {
                                            alert("Link copied! Share it with your friends.");
                                        }).catch(function() {
                                            window.open("https://wa.me/?text=" + encodeURIComponent(data.text + " " + data.url), "_blank", "noopener,noreferrer");
                                        });
                                    } else {
                                        window.open("https://wa.me/?text=" + encodeURIComponent(data.text + " " + data.url), "_blank", "noopener,noreferrer");
                                    }
                                }
                            </script>
                        `);

                    fs.writeFileSync(path.join(semDirPath, `${subFile}.html`), subRendered);
                    // Also write code.html if slug is different from code
                    if (sub.code && sub.code !== subFile) {
                        fs.writeFileSync(path.join(semDirPath, `${sub.code}.html`), subRendered);
                    }
                    console.log(`Generated Subject: /${unv.id}/${branch.id}/${sem.id}/${subFile}.html`);
                });
            });
        });
    });

    // --- 3. Generate main.json for App Compatibility ---
    const mainJsonData = {};
    db.universities.forEach(unv => {
        const branches = getBranchList(unv);
        branches.forEach(branch => {
            if (!mainJsonData[branch.id]) {
                mainJsonData[branch.id] = [];
            }
            (branch.semesters || []).forEach(sem => {
                (sem.subjects || []).forEach(sub => {
                    const materials = sub.materials || [];
                    const booksLink = materials
                        .filter(m => {
                            if ((m.type || '').toLowerCase() !== 'book') return false;
                            if ((m.label || '').toLowerCase().includes('gujarati') || m.language === 'gujarati') return false;
                            const lbl = (m.label || '').toLowerCase();
                            const link = (m.link || '').toLowerCase();
                            return !(/syllabus/.test(lbl) || /syallbus/.test(link) || link.includes('/syllabus/'));
                        })
                        .map(m => m.link);
                    const gujBooksLink = materials
                        .filter(m => (m.type || '').toLowerCase() === 'book' && ((m.label || '').toLowerCase().includes('gujarati') || m.language === 'gujarati'))
                        .map(m => m.link);
                    const bookPapers = [];
                    materials
                        .filter(m => (m.type || '').toLowerCase() === 'paper')
                        .forEach(m => {
                            bookPapers.push(m.link, m.label || 'Paper');
                        });
                    const syllabusMat = materials.find(m => (m.type || '').toLowerCase() === 'syllabus');
                    const syllabusLink = syllabusMat ? syllabusMat.link : '#';

                    const prefix = branch.urlPrefix ? `/${branch.urlPrefix}` : '';
                    const bookUrl = sub.slug ? 
                        `${prefix}/${branch.id}/${sem.id}/${sub.slug}.html` : 
                        `${prefix}/${branch.id}/${sem.id}/${sub.code}.html`;

                    mainJsonData[branch.id].push({
                        bookName: sub.name,
                        bookCode: sub.code,
                        bookImage: sub.image || 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp',
                        bookCredit: (sub.credit || 0).toString(),
                        sem: sem.id,
                        bookLink: bookUrl,
                        booksLink: booksLink,
                        GujbooksLink: gujBooksLink,
                        bookPapers: bookPapers,
                        syllabus: syllabusLink
                    });
                });
            });
        });
    });
    
    // Add a 'home' section for top featured books
    mainJsonData['home'] = mainJsonData['it'] ? mainJsonData['it'].slice(0, 8) : [];

    fs.writeFileSync(path.join(PUBLIC_DIR, 'main.json'), JSON.stringify(mainJsonData, null, 2));
    console.log("Generated main.json successfully with valid links!");

    // Generate ultra-lightweight home_books.json (1.5KB vs 302KB main.json)
    fs.mkdirSync(path.join(PUBLIC_DIR, 'data'), { recursive: true });
    fs.writeFileSync(path.join(PUBLIC_DIR, 'data/home_books.json'), JSON.stringify(mainJsonData['home'], null, 2));
    console.log("Generated data/home_books.json for fast homepage LCP!");

    // --- 4. Generate data/branches.json for dynamic navbar, homepage & filters ---
    const fsDir = path.join(PUBLIC_DIR, 'data');
    fs.mkdirSync(fsDir, { recursive: true });

    const priorityNames = ['civil', 'computer', 'mechanical', 'electrical', 'it'];
    function sortBranchesPriority(list) {
        return [...list].sort((a, b) => {
            const aLower = (a.name || '').toLowerCase();
            const bLower = (b.name || '').toLowerCase();
            const aPri = priorityNames.findIndex(p => p === 'it' ? /(^|\s)it($|\s)|information technology/.test(aLower) : aLower.includes(p));
            const bPri = priorityNames.findIndex(p => p === 'it' ? /(^|\s)it($|\s)|information technology/.test(bLower) : bLower.includes(p));
            const aScore = aPri >= 0 ? aPri : priorityNames.length;
            const bScore = bPri >= 0 ? bPri : priorityNames.length;
            if (aScore !== bScore) return aScore - bScore;
            return aLower.localeCompare(bLower);
        });
    }

    const branchesData = {
        config: db.config || {},
        domains: db.universities.flatMap(unv => (unv.domains || []).map(dom => {
            const domUrlPrefix = dom.urlPrefix || '';
            const domPrefix = domUrlPrefix ? `/${domUrlPrefix}` : '';
            const branches = sortBranchesPriority((dom.branches || []).map(branch => {
                const semesters = (branch.semesters || []).map(sem => ({
                    id: sem.id,
                    name: sem.name,
                    subjectCount: (sem.subjects || []).length
                }));
                return {
                    id: branch.id,
                    name: titleCase(branch.name),
                    shortName: branch.shortName || titleCase(branch.name),
                    urlPrefix: domUrlPrefix,
                    homepage: `${domPrefix}/${branch.id}homepage.html`,
                    semesters: semesters
                };
            }).filter(b => b.semesters.length > 0));
            return {
                id: dom.id,
                name: dom.name,
                urlPrefix: domUrlPrefix,
                branches: branches
            };
        })).filter(d => d.branches.length > 0)
    };

    // Generate domain landing pages (Diploma/BE/ME homepage links)
    branchesData.domains.forEach(dom => {
        const prefix = dom.urlPrefix ? `/${dom.urlPrefix}` : '';
        const landingPath = dom.urlPrefix ? path.join(PUBLIC_DIR, dom.urlPrefix, `${dom.id}homepage.html`) : path.join(PUBLIC_DIR, `${dom.id}homepage.html`);
        const landingRel = landingPath.replace(PUBLIC_DIR, '');
        const landingUrl = `${SITE_URL}${landingRel}`;
        const title = `GTU ${dom.name} - All Branches, Semesters & Study Material | Khudkibook`;
        const headPrefix = dom.urlPrefix === 'BE' ? 'Bachelor of Engineering (BE)' : dom.urlPrefix === 'ME' ? 'Master of Engineering (ME)' : 'GTU Diploma';

        const branchCards = dom.branches.map(b => `
            <div class="dropdown-branch-item" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; margin-bottom: 14px;">
                <a href="${b.homepage}" class="branch-title" style="font-size: 1.05rem; font-weight: 800; color: var(--accent); text-decoration: none; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-graduation-cap"></i> ${b.name}
                </a>
                <div class="sem-quick-links" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                    ${b.semesters.map(s => `<a href="${prefix}/${b.id}/${s.id}/index.html" style="font-size: 0.83rem; padding: 5px 12px; border-radius: 8px; background: rgba(59,130,246,0.08); color: var(--text); text-decoration: none;">${s.name.replace('sem','Sem ')}</a>`).join('')}
                </div>
            </div>
        `).join('');

        const content = `
            <div style="width: 100%; max-width: 1100px; margin-bottom: 40px;">
                <h2 class="kl789123" style="margin-bottom: 20px;"><i class="fas fa-university" style="color: var(--accent); margin-right: 8px;"></i> ${headPrefix} - All Branches</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                    ${branchCards}
                </div>
            </div>
        `;

        const landingBreadcrumbJson = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/index.html` },
                { "@type": "ListItem", "position": 2, "name": headPrefix, "item": landingUrl }
            ]
        };

        const page = template
            .replace(/{{TITLE}}/g, title)
            .replace(/{{KEYWORDS}}/g, `gtu ${dom.name.toLowerCase()}, gtu ${dom.urlPrefix.toLowerCase()} branches, gtu engineering books, gtu syllabus, gtu papers`)
            .replace(/{{DESCRIPTION}}/g, `Browse all ${dom.name} branches at Khudkibook. Free GTU textbooks, syllabus curricula, and previous year solved question papers for every branch & semester.`)
            .replace(/{{CANONICAL_URL}}/g, landingUrl)
            .replace(/{{OG_IMAGE}}/g, DEFAULT_COVER)
            .replace(/{{SCHEMA_JSON}}/g, `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", "name": "Khudkibook", "description": `GTU ${dom.name} study material`, "url": SITE_URL })}</script><script type="application/ld+json">${JSON.stringify(landingBreadcrumbJson)}</script>`)
            .replace(/{{PAGE_HEADER}}/g, headPrefix)
            .replace(/{{BREADCRUMBS}}/g, `<a class="nvi751" href="/index.html"><i class="fas fa-home"></i> Home</a><span class="nvsep729"> / </span><span id="atnvli953">${headPrefix}</span>`)
            .replace(/{{CONTENT}}/g, content)
            .replace(/{{SCRIPTS}}/g, "");

        fs.mkdirSync(path.dirname(landingPath), { recursive: true });
        fs.writeFileSync(landingPath, page);
        console.log(`Generated Domain Landing: ${landingPath.replace(PUBLIC_DIR, '')}`);
    });

    fs.writeFileSync(path.join(fsDir, 'branches.json'), JSON.stringify(branchesData, null, 2));
    console.log("Generated data/branches.json with all branches for dynamic navigation!");

    // --- 5. Generate lightweight search-index.json for global site search ---
    const searchIndex = [];
    db.universities.forEach(unv => {
        const branches = getBranchList(unv);
        branches.forEach(branch => {
            const prefix = branch.urlPrefix ? `/${branch.urlPrefix}` : '';
            (branch.semesters || []).forEach(sem => {
                (sem.subjects || []).forEach(sub => {
                    if (!sub.name) return;
                    const subFile = sub.slug || sub.code || 'subject';
                    const [, color] = coverGradient(sub.name);
                    searchIndex.push({
                        name: sub.name,
                        code: sub.code || '',
                        branch: branch.shortName || branch.name,
                        sem: sem.name,
                        url: `${prefix}/${branch.id}/${sem.id}/${subFile}.html`,
                        color
                    });
                });
            });
        });
    });
    fs.writeFileSync(path.join(PUBLIC_DIR, 'search-index.json'), JSON.stringify(searchIndex));
    console.log(`Generated search-index.json with ${searchIndex.length} entries for site search!`);

    console.log("Site generation complete!");
}

generateSite();
