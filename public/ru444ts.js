// Firebase Configuration (Loaded On-Demand for Feedback)
const firebaseConfig = {
    apiKey: "AIzaSyBvc-vfv2EkbdFa-Wh6ieckvrLooMPYY3w",
    authDomain: "khudkibook.firebaseapp.com",
    databaseURL: "https://khudkibook-default-rtdb.firebaseio.com",
    projectId: "khudkibook",
    storageBucket: "khudkibook.appspot.com",
    messagingSenderId: "245535789373",
    appId: "1:245535789373:web:3977252363ca0bc10a3554",
    measurementId: "G-XRLK80TM3J"
};

function ensureFirebase(callback) {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        callback();
        return;
    }
    const s1 = document.createElement('script');
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/firebase/7.14.1-0/firebase-app.js";
    s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/firebase/7.14.1-0/firebase-firestore.js";
        s2.onload = () => {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            callback();
        };
        document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
}

// Master Navbar HTML Template
const modernNavbarHTML = `
<div class="navwrap">
    <!-- Brand Logo -->
    <a href="/" class="brand-link" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
        <img class="lohh" src="/assets/brand/khudkibook-logo.png" alt="Khudkibook Logo" width="36" height="36" />
        <span class="textl">Khudkibook</span>
    </a>

    <!-- Global Search -->
    <div class="site-search-wrap" id="kb-search-wrap">
        <div class="site-search">
            <i class="fas fa-search kb-search-icon-open"></i>
            <input type="text" id="kb-search-input" placeholder="Search books, subjects, code..." autocomplete="off" />
            <button type="button" aria-label="Search" id="kb-search-submit"><i class="fas fa-arrow-right"></i></button>
            <button type="button" aria-label="Close search" id="kb-search-close" class="kb-search-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="search-results" id="kb-search-results"></div>
    </div>

    <!-- Desktop Navigation Links -->
    <ul class="nav-links-desktop">
        <li><a href="/" class="nav-item-link"><i class="fas fa-home"></i> Home</a></li>
        
        <!-- Diploma Dropdown -->
        <li class="nav-dropdown-wrapper">
            <button class="nav-dropdown-btn" type="button">
                <i class="fas fa-graduation-cap"></i> Diploma <i class="fas fa-chevron-down nav-chevron"></i>
            </button>
            <div class="nav-dropdown-panel">
                <div class="dropdown-grid">
                    <div class="dropdown-branch-item">
                        <a href="/ithomepage.html" class="branch-title"><i class="fas fa-laptop-code"></i> Information Technology</a>
                        <div class="sem-quick-links">
                            <a href="/it/sem1/index.html">Sem 1</a>
                            <a href="/it/sem2/index.html">Sem 2</a>
                            <a href="/it/sem3/index.html">Sem 3</a>
                            <a href="/it/sem4/index.html">Sem 4</a>
                            <a href="/it/sem5/index.html">Sem 5</a>
                            <a href="/it/sem6/index.html">Sem 6</a>
                        </div>
                    </div>
                    <div class="dropdown-branch-item">
                        <a href="/computerhomepage.html" class="branch-title"><i class="fas fa-desktop"></i> Computer Engineering</a>
                        <div class="sem-quick-links">
                            <a href="/computer/sem1/index.html">Sem 1</a>
                            <a href="/computer/sem2/index.html">Sem 2</a>
                            <a href="/computer/sem3/index.html">Sem 3</a>
                            <a href="/computer/sem4/index.html">Sem 4</a>
                            <a href="/computer/sem5/index.html">Sem 5</a>
                            <a href="/computer/sem6/index.html">Sem 6</a>
                        </div>
                    </div>
                    <div class="dropdown-branch-item">
                        <a href="/civilhomepage.html" class="branch-title"><i class="fas fa-building"></i> Civil Engineering</a>
                        <div class="sem-quick-links">
                            <a href="/civil/sem1/index.html">Sem 1</a>
                            <a href="/civil/sem2/index.html">Sem 2</a>
                            <a href="/civil/sem3/index.html">Sem 3</a>
                            <a href="/civil/sem4/index.html">Sem 4</a>
                            <a href="/civil/sem5/index.html">Sem 5</a>
                            <a href="/civil/sem6/index.html">Sem 6</a>
                        </div>
                    </div>
                    <div class="dropdown-branch-item">
                        <a href="/electricalhomepage.html" class="branch-title"><i class="fas fa-bolt"></i> Electrical Engineering</a>
                        <div class="sem-quick-links">
                            <a href="/electrical/sem1/index.html">Sem 1</a>
                            <a href="/electrical/sem2/index.html">Sem 2</a>
                            <a href="/electrical/sem3/index.html">Sem 3</a>
                            <a href="/electrical/sem4/index.html">Sem 4</a>
                            <a href="/electrical/sem5/index.html">Sem 5</a>
                            <a href="/electrical/sem6/index.html">Sem 6</a>
                        </div>
                    </div>
                    <div class="dropdown-branch-item">
                        <a href="/mechanicalhomepage.html" class="branch-title"><i class="fas fa-cogs"></i> Mechanical Engineering</a>
                        <div class="sem-quick-links">
                            <a href="/mechanical/sem1/index.html">Sem 1</a>
                            <a href="/mechanical/sem2/index.html">Sem 2</a>
                            <a href="/mechanical/sem3/index.html">Sem 3</a>
                            <a href="/mechanical/sem4/index.html">Sem 4</a>
                            <a href="/mechanical/sem5/index.html">Sem 5</a>
                            <a href="/mechanical/sem6/index.html">Sem 6</a>
                        </div>
                    </div>
                    <div class="dropdown-branch-item">
                        <a href="/chemicalhomepage.html" class="branch-title"><i class="fas fa-flask"></i> Chemical Engineering</a>
                        <div class="sem-quick-links">
                            <a href="/chemical/sem1/index.html">Sem 1</a>
                            <a href="/chemical/sem2/index.html">Sem 2</a>
                            <a href="/chemical/sem3/index.html">Sem 3</a>
                            <a href="/chemical/sem4/index.html">Sem 4</a>
                        </div>
                    </div>
                </div>
            </div>
        </li>

        <li><a href="/BE/behomepage.html" class="nav-item-link"><i class="fas fa-university"></i> Degree (BE)</a></li>
        <li><a href="/ddcet.html" class="nav-item-link"><i class="fas fa-book-reader"></i> DDCET</a></li>
    </ul>

    <!-- Right Controls (Symmetrical alignment for Search & Hamburger) -->
    <div class="nav-right-actions">
        <button class="mobile-nav-btn" id="mobile-search-toggle" aria-label="Open Search" type="button">
            <i class="fas fa-search"></i>
        </button>
        <button class="mobile-nav-btn" id="mobile-menu-toggle" aria-label="Toggle Mobile Menu" type="button">
            <i class="fas fa-bars"></i>
        </button>
    </div>
</div>

<!-- Mobile Off-Canvas Drawer -->
<div class="mobile-drawer" id="mobile-drawer" style="display: none;">
    <div class="drawer-header">
        <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
            <img class="lohh" src="/assets/brand/khudkibook-logo.png" alt="Khudkibook" width="32" height="32" />
            <span class="textl" style="font-size: 1.2rem;">Khudkibook</span>
        </a>
        <button class="drawer-close-btn" id="drawer-close-btn">&times;</button>
    </div>
    <div class="drawer-content">
        <a href="/" class="drawer-link"><i class="fas fa-home"></i> Home</a>
        <a href="/BE/behomepage.html" class="drawer-link"><i class="fas fa-university"></i> Degree (BE)</a>
        <a href="/ddcet.html" class="drawer-link"><i class="fas fa-book-reader"></i> DDCET Preparation</a>
        
        <div class="drawer-section-title"><i class="fas fa-graduation-cap"></i> Diploma Branches</div>
        <div class="drawer-branch-list">
            <div class="drawer-accordion">
                <button class="accordion-header"><span>Information Technology</span> <i class="fas fa-chevron-down"></i></button>
                <div class="accordion-body">
                    <a href="/it/sem1/index.html">Semester 1</a>
                    <a href="/it/sem2/index.html">Semester 2</a>
                    <a href="/it/sem3/index.html">Semester 3</a>
                    <a href="/it/sem4/index.html">Semester 4</a>
                    <a href="/it/sem5/index.html">Semester 5</a>
                    <a href="/it/sem6/index.html">Semester 6</a>
                </div>
            </div>
            <div class="drawer-accordion">
                <button class="accordion-header"><span>Computer Engineering</span> <i class="fas fa-chevron-down"></i></button>
                <div class="accordion-body">
                    <a href="/computer/sem1/index.html">Semester 1</a>
                    <a href="/computer/sem2/index.html">Semester 2</a>
                    <a href="/computer/sem3/index.html">Semester 3</a>
                    <a href="/computer/sem4/index.html">Semester 4</a>
                    <a href="/computer/sem5/index.html">Semester 5</a>
                    <a href="/computer/sem6/index.html">Semester 6</a>
                </div>
            </div>
            <div class="drawer-accordion">
                <button class="accordion-header"><span>Civil Engineering</span> <i class="fas fa-chevron-down"></i></button>
                <div class="accordion-body">
                    <a href="/civil/sem1/index.html">Semester 1</a>
                    <a href="/civil/sem2/index.html">Semester 2</a>
                    <a href="/civil/sem3/index.html">Semester 3</a>
                    <a href="/civil/sem4/index.html">Semester 4</a>
                    <a href="/civil/sem5/index.html">Semester 5</a>
                    <a href="/civil/sem6/index.html">Semester 6</a>
                </div>
            </div>
            <div class="drawer-accordion">
                <button class="accordion-header"><span>Electrical Engineering</span> <i class="fas fa-chevron-down"></i></button>
                <div class="accordion-body">
                    <a href="/electrical/sem1/index.html">Semester 1</a>
                    <a href="/electrical/sem2/index.html">Semester 2</a>
                    <a href="/electrical/sem3/index.html">Semester 3</a>
                    <a href="/electrical/sem4/index.html">Semester 4</a>
                    <a href="/electrical/sem5/index.html">Semester 5</a>
                    <a href="/electrical/sem6/index.html">Semester 6</a>
                </div>
            </div>
            <div class="drawer-accordion">
                <button class="accordion-header"><span>Mechanical Engineering</span> <i class="fas fa-chevron-down"></i></button>
                <div class="accordion-body">
                    <a href="/mechanical/sem1/index.html">Semester 1</a>
                    <a href="/mechanical/sem2/index.html">Semester 2</a>
                    <a href="/mechanical/sem3/index.html">Semester 3</a>
                    <a href="/mechanical/sem4/index.html">Semester 4</a>
                    <a href="/mechanical/sem5/index.html">Semester 5</a>
                    <a href="/mechanical/sem6/index.html">Semester 6</a>
                </div>
            </div>
        </div>
    </div>
</div>
`;

// Footer HTML Template
const modernFooterHTML = `
<div class="ftrreviwwrap">
    <div class="about">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <img src="/assets/brand/khudkibook-logo.png" alt="Khudkibook Logo" width="38" height="38" style="border-radius:10px;background:#4338ca;padding:2px;" />
            <span class="textl" style="font-size:1.3rem;">Khudkibook</span>
        </div>
        <h3 class="fotthead"><i class="fas fa-graduation-cap" style="color:#a5b4fc; margin-right:8px;"></i> ABOUT KHUDKIBOOK</h3>
        <p class="aboutdesc">
            At Khudkibook, we believe high-quality engineering education should be free and accessible to every GTU student.
            Access official syllabus curriculums, English & Gujarati medium textbooks, and previous year solved question papers anytime, anywhere.
        </p>
    </div>
    <div class="feedback">
        <h3 class="fotthead"><i class="fas fa-comment-dots" style="color:#a5b4fc; margin-right:8px;"></i> LEAVE YOUR FEEDBACK</h3>
        <div class="form">
            <input type="email" required placeholder="Your Student Email *" id="fedbackemail" />
            <textarea required placeholder="How can we make Khudkibook better for you? *" id="fedback" rows="3"></textarea>
            <button id="postfeed" type="button"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
        </div>
    </div>
    <div class="social">
        <h3 class="fotthead"><i class="fas fa-shield-alt" style="color:#a5b4fc; margin-right:8px;"></i> LEGAL & SOCIAL</h3>
        <div class="col">
            <a href="/privacypolicy.html"><i class="fas fa-user-shield"></i> Privacy Policy</a>
            <a href="/termsofservice.html"><i class="fas fa-file-contract"></i> Terms of Service</a>
            <a href="https://www.instagram.com/khudkibook/" target="_blank" rel="noopener noreferrer"><i class="fab fa-instagram"></i> Follow on Instagram</a>
            <a href="https://play.google.com/store/apps/details?id=web.app.khudkibook" target="_blank" rel="noopener noreferrer"><i class="fab fa-google-play"></i> Rate on Play Store</a>
        </div>
    </div>
</div>
<div style="text-align: center; color:#a5b4fc; font-size: 0.85rem; padding-bottom: 20px;">
    &copy; 2026 Khudkibook. Crafted with &#10084; for GTU Engineering Students.
</div>
`;

// Build dynamic navbar dropdown grid from branches data
function buildDropdownItems(branches) {
    const icons = ["fa-laptop-code", "fa-desktop", "fa-building", "fa-bolt", "fa-cogs", "fa-flask", "fa-microchip", "fa-dna", "fa-satellite", "fa-industry", "fa-robot", "fa-book-open", "fa-calculator", "fa-project-diagram", "fa-shield-alt", "fa-fire", "fa-water", "fa-leaf", "fa-truck", "fa-ship", "fa-plug", "fa-recycle", "fa-graduation-cap"];
    return branches.map((b, i) => `
        <div class="dropdown-branch-item">
            <a href="${b.homepage}" class="branch-title"><i class="fas ${icons[i % icons.length]}"></i> ${b.name}</a>
            <div class="sem-quick-links">
                ${b.semesters.map(s => `<a href="${b.urlPrefix ? '/' + b.urlPrefix : ''}/${b.id}/${s.id}/index.html">${s.name.replace('sem', 'Sem ')}</a>`).join('')}
            </div>
        </div>
    `).join('');
}

// Build dynamic mobile drawer branch accordions
function buildDrawerBranches(branches) {
    return branches.map(b => `
        <div class="drawer-accordion">
            <button class="accordion-header"><span>${b.name}</span> <i class="fas fa-chevron-down"></i></button>
            <div class="accordion-body">
                ${b.semesters.map(s => `<a href="${b.urlPrefix ? '/' + b.urlPrefix : ''}/${b.id}/${s.id}/index.html">${s.name.replace('sem', 'Semester ')}</a>`).join('')}
            </div>
        </div>
    `).join('');
}

// Core Branch Sorting Priority: IT, Computer, Civil, Electrical, Mechanical, Chemical
function sortCoreBranches(list) {
    const priority = ['it', 'computer', 'civil', 'electrical', 'mechanical', 'chemical'];
    return [...list].sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aId = (a.id || '').toLowerCase();
        const bId = (b.id || '').toLowerCase();
        
        const aIdx = priority.findIndex(p => aId === p || aName.startsWith(p) || (p === 'it' && (aName.includes('information tech') || aName === 'it')));
        const bIdx = priority.findIndex(p => bId === p || bName.startsWith(p) || (p === 'it' && (bName.includes('information tech') || bName === 'it')));
        
        const aScore = aIdx >= 0 ? aIdx : 999;
        const bScore = bIdx >= 0 ? bIdx : 999;
        if (aScore !== bScore) return aScore - bScore;
        return aName.localeCompare(bName);
    });
}

// Renders dynamic branch grids into any container marked data-branch-grid
function renderBranchGrids(data) {
    if (!data || !data.domains) return;
    document.querySelectorAll("[data-branch-grid]").forEach(container => {
        const domainId = container.getAttribute("data-branch-grid");
        const domain = (data.domains || []).find(d => d.id === domainId);
        if (!domain) return;
        const sortedBranches = sortCoreBranches(domain.branches || []);
        
        container.innerHTML = "";
        container.className = "branch-grid-container";
        
        const grid = document.createElement("div");
        grid.className = "maniwrraper";
        
        const DEFAULT_VISIBLE_MOBILE = 5; // Show IT, Computer, Civil, Electrical, Mechanical by default

        sortedBranches.forEach((b, index) => {
            const a = document.createElement("a");
            a.className = "navlink" + (index >= DEFAULT_VISIBLE_MOBILE ? " kb-branch-extra" : "");
            a.href = b.homepage;
            a.style.backgroundImage = "url('https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp')";
            a.innerHTML = `<span>${b.name}</span>`;
            grid.appendChild(a);
        });

        container.appendChild(grid);

        if (sortedBranches.length > DEFAULT_VISIBLE_MOBILE) {
            const extraCount = sortedBranches.length - DEFAULT_VISIBLE_MOBILE;
            const toggleWrap = document.createElement("div");
            toggleWrap.className = "kb-branch-toggle-wrap";
            toggleWrap.innerHTML = `
                <button class="kb-branch-toggle-btn" type="button" aria-expanded="false">
                    <i class="fas fa-layer-group"></i> <span>Show All ${domain.name || 'Engineering'} Branches (${extraCount}+ More)</span> <i class="fas fa-chevron-down toggle-icon"></i>
                </button>
            `;
            const toggleBtn = toggleWrap.querySelector(".kb-branch-toggle-btn");
            toggleBtn.addEventListener("click", () => {
                const isExpanded = grid.classList.toggle("is-expanded");
                container.classList.toggle("is-expanded", isExpanded);
                toggleBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
                if (isExpanded) {
                    toggleBtn.classList.add("expanded");
                    toggleBtn.innerHTML = `<i class="fas fa-chevron-up"></i> <span>Show Less Branches</span>`;
                } else {
                    toggleBtn.classList.remove("expanded");
                    toggleBtn.innerHTML = `<i class="fas fa-layer-group"></i> <span>Show All ${domain.name || 'Engineering'} Branches (${extraCount}+ More)</span> <i class="fas fa-chevron-down toggle-icon"></i>`;
                }
            });
            container.appendChild(toggleWrap);
        }
    });
}

// Global site search over lightweight search-index.json
let KB_SEARCH_DATA = [];
function initSiteSearch() {
    const input = document.getElementById("kb-search-input");
    const resultsBox = document.getElementById("kb-search-results");
    const wrap = document.getElementById("kb-search-wrap");
    const closeBtn = document.getElementById("kb-search-close");
    const submitBtn = document.getElementById("kb-search-submit");
    if (!input || !resultsBox || !wrap) return;

    let KB_SEARCH_OPEN = false;

    // Mobile: tapping the search icon expands the bar to full width;
    // tapping again (or Escape) collapses it back to an icon.
    function isMobileSearch() {
        return window.matchMedia("(max-width: 900px)").matches;
    }

    function expandSearch() {
        wrap.classList.add("expanded");
        KB_SEARCH_OPEN = true;
        input.focus();
    }

    function collapseSearch() {
        wrap.classList.remove("expanded");
        KB_SEARCH_OPEN = false;
        resultsBox.classList.remove("show");
    }

    // The mobile search toggle button in navbar actions
    const mobileSearchBtn = document.getElementById("mobile-search-toggle");
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener("click", () => {
            expandSearch();
            loadSearchIndex();
        });
    }

    // The search icon inside the bar doubles as expand trigger on desktop/tablet
    const icon = wrap.querySelector(".kb-search-icon-open");
    if (icon) {
        icon.addEventListener("click", () => {
            if (isMobileSearch() && !KB_SEARCH_OPEN) {
                expandSearch();
            }
        });
    }
    if (closeBtn) closeBtn.addEventListener("click", collapseSearch);

    let isSearchLoading = false;
    let searchLoaded = false;

    function loadSearchIndex(callback) {
        if (searchLoaded) {
            if (callback) callback();
            return;
        }
        if (isSearchLoading) {
            return;
        }
        isSearchLoading = true;
        fetch("/search-index.json")
            .then(r => r.json())
            .then(data => {
                KB_SEARCH_DATA = Array.isArray(data) ? data : [];
                searchLoaded = true;
                isSearchLoading = false;
                if (callback) callback();
                else if (input.value && input.value.trim()) search(input.value);
            })
            .catch(() => {
                KB_SEARCH_DATA = [];
                searchLoaded = true;
                isSearchLoading = false;
            });
    }

    // Pre-load search index eagerly on idle / startup
    if (typeof window !== "undefined") {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => loadSearchIndex(), { timeout: 1500 });
        } else {
            setTimeout(loadSearchIndex, 300);
        }
    }

    function render(list) {
        if (!list.length) {
            resultsBox.innerHTML = `<div class="no-result"><i class="fas fa-search" style="margin-right:6px;opacity:0.5;"></i> No subjects found. Try a subject name, code, or branch.</div>`;
            resultsBox.classList.add("show");
            return;
        }
        resultsBox.innerHTML = list.slice(0, 12).map(item => `
            <a href="${item.url}" class="kb-sr-item">
                <span class="sr-cover" style="background:${item.color || '#4f46e5'}"><i class="fas fa-book" style="color:#fff;font-size:0.8rem;line-height:44px;text-align:center;display:block;"></i></span>
                <span style="flex:1;min-width:0;">
                    <span class="sr-title" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</span>
                    <span class="sr-sub">${item.code ? `<strong>${item.code}</strong> &middot; ` : ''}${item.branch || ''} &middot; ${item.sem || ''}</span>
                </span>
            </a>`).join("");
        resultsBox.classList.add("show");
    }

    function search(q) {
        q = (q || '').trim().toLowerCase();
        if (!q) {
            resultsBox.classList.remove("show");
            return;
        }
        if (!searchLoaded) {
            resultsBox.innerHTML = `<div class="no-result"><i class="fas fa-spinner fa-spin" style="margin-right:6px;color:var(--accent);"></i> Loading subject catalog...</div>`;
            resultsBox.classList.add("show");
            loadSearchIndex(() => search(input.value));
            return;
        }

        const terms = q.split(/\s+/).filter(Boolean);
        const matches = (KB_SEARCH_DATA || []).filter(item => {
            const haystack = `${item.name || ''} ${item.code || ''} ${item.branch || ''} ${item.sem || ''}`.toLowerCase();
            return terms.every(t => haystack.includes(t));
        });

        // Sort exact code or prefix matches to top
        matches.sort((a, b) => {
            const aCode = (a.code || '').toLowerCase();
            const bCode = (b.code || '').toLowerCase();
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            
            if (aCode === q && bCode !== q) return -1;
            if (bCode === q && aCode !== q) return 1;
            if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
            if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
            return 0;
        });

        render(matches);
    }

    let debounce;
    input.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => search(input.value), 150);
    });

    input.addEventListener("focus", () => {
        loadSearchIndex();
        if (input.value && input.value.trim()) {
            search(input.value);
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            collapseSearch();
            e.stopPropagation();
        } else if (e.key === "Enter") {
            const firstResult = resultsBox.querySelector("a.kb-sr-item");
            if (firstResult) {
                firstResult.click();
            } else {
                search(input.value);
            }
        }
    });

    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
            if (input.value) search(input.value);
            else input.focus();
        });
    }

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".site-search-wrap")) {
            resultsBox.classList.remove("show");
        }
    });
}

// Initialize UI
function initKhudkibookUI() {
    const navbar = document.getElementById("nav");
    const footer = document.getElementById("footer");

    if (navbar) {
        navbar.innerHTML = modernNavbarHTML;

        // Load all branches and make navigation data-driven
        try {
            fetch("/data/branches.json", { cache: "no-store" })
                .then(r => r.json())
                .then(data => {
                    window.KB_DATA = data;
                    const diplomaDomain = (data.domains || []).find(d => d.id === "diploma");
                    if (diplomaDomain) {
                        const diplomas = diplomaDomain.branches;
                        const grid = navbar.querySelector(".dropdown-grid");
                        if (grid) grid.innerHTML = buildDropdownItems(diplomas);
                        const drawerList = document.getElementById("drawer-branch-list");
                        if (drawerList) drawerList.innerHTML = buildDrawerBranches(diplomas);
                    }
                    renderBranchGrids(data);
                })
                .catch(() => {});
        } catch (e) {}

        // Setup Mobile Menu Toggle
        const mobileToggle = document.getElementById("mobile-menu-toggle");
        const drawer = document.getElementById("mobile-drawer");
        const drawerClose = document.getElementById("drawer-close-btn");

        if (mobileToggle && drawer) {
            mobileToggle.addEventListener("click", () => {
                drawer.style.display = drawer.style.display === "none" ? "block" : "none";
            });
        }
        if (drawerClose && drawer) {
            drawerClose.addEventListener("click", () => {
                drawer.style.display = "none";
            });
        }

        // Setup Drawer Accordions
        document.querySelectorAll(".drawer-accordion .accordion-header").forEach(btn => {
            btn.addEventListener("click", () => {
                const body = btn.nextElementSibling;
                const icon = btn.querySelector(".fa-chevron-down, .fa-chevron-up");
                if (body) {
                    const isOpen = body.style.display === "flex";
                    body.style.display = isOpen ? "none" : "flex";
                    if (icon) {
                        icon.className = isOpen ? "fas fa-chevron-down" : "fas fa-chevron-up";
                    }
                }
            });
        });
    }

    if (footer) {
        footer.innerHTML = modernFooterHTML;

        // Feedback Handler with On-Demand Firebase Loading
        const submitBtn = document.getElementById("postfeed");
        if (submitBtn) {
            submitBtn.addEventListener("click", () => {
                const emailInput = document.getElementById("fedbackemail");
                const msgInput = document.getElementById("fedback");
                if (emailInput && msgInput && emailInput.value && msgInput.value) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Submitting...";
                    ensureFirebase(() => {
                        try {
                            const db = firebase.firestore();
                            db.collection("feedbacks").add({
                                email: emailInput.value,
                                feedback: msgInput.value,
                                timestamp: new Date()
                            }).then(() => {
                                alert("Thank you! Your feedback has been received.");
                                emailInput.value = "";
                                msgInput.value = "";
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
                            }).catch(() => {
                                alert("Thank you for your feedback!");
                                emailInput.value = "";
                                msgInput.value = "";
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
                            });
                        } catch (e) {
                            alert("Thank you for your feedback!");
                            emailInput.value = "";
                            msgInput.value = "";
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
                        }
                    });
                } else {
                    alert("Please fill in both your email and feedback message.");
                }
            });
        }
    }

    initSiteSearch();
    }

// Run when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKhudkibookUI);
} else {
    initKhudkibookUI();
}
