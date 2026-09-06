let db = null;
let currentPath = []; // ['unv_id', 'domain_id', 'branch_id', 'sem_id']

const API = {
    async loadDb() {
        try {
            let response = await fetch('/api/db');
            if (!response.ok) {
                response = await fetch('/data/site_db.json');
            }
            if (!response.ok) throw new Error('Database file not found at data/site_db.json.');
            db = await response.json();
            renderDashboard();
        } catch (err) {
            document.getElementById('main-content').innerHTML = `
                <div style="text-align: center; color: var(--danger); padding: 50px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem;"></i>
                    <h2 style="margin-top: 20px;">Database Connection Failed</h2>
                    <p style="margin-top: 10px;">${err.message}</p>
                    <button style="margin-top: 20px; display: inline-block;" onclick="location.reload()">Retry Connection</button>
                </div>
            `;
        }
    },
    async saveDb() {
        const btn = document.getElementById('save-btn');
        const status = document.getElementById('build-status');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db)
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server returned status ${response.status}: ${errText}`);
            }
            const result = await response.json();
            if (status) {
                status.innerHTML = `✓ ${result.message || 'Saved successfully!'} <span id="last-save">${new Date().toLocaleTimeString()}</span>`;
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("Error saving: " + err.message);
        } finally {
            btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            btn.disabled = false;
        }
    },
    async buildSite() {
        const btn = document.getElementById('build-btn');
        const status = document.getElementById('build-status');
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building...';
        btn.disabled = true;
        try {
            const response = await fetch('/api/build', { method: 'POST' });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server returned status ${response.status}: ${errText}`);
            }
            const result = await response.json();
            
            if (status) {
                status.innerHTML = result.status === 'success' ? 
                    `✓ ${result.message} <span id="last-save">${new Date().toLocaleTimeString()}</span>` : 
                    `✗ Error: ${result.message} `;
            }
        } catch (err) {
            console.error("Build error:", err);
            alert("Build failed: " + err.message);
        } finally {
            btn.innerHTML = '<i class="fas fa-rocket"></i> Build Site';
            btn.disabled = false;
        }
    }
};

function getDomainList(unv) {
    return unv.domains || [];
}

function getBranchList(domainOrUnv) {
    return domainOrUnv.branches || [];
}

function renderDashboard() {
    if (!db || !db.universities) return;
    const trail = document.getElementById('nav-trail');

    // Update Stats
    const unvEl = document.getElementById('unv-count');
    const domEl = document.getElementById('domain-count');
    const branchEl = document.getElementById('branch-count');
    const semEl = document.getElementById('sem-count');
    const bookEl = document.getElementById('book-count');

    let dCount = 0, bCount = 0, sCount = 0, bkCount = 0;
    db.universities.forEach(unv => {
        const domains = getDomainList(unv);
        dCount += domains.length;
        domains.forEach(d => {
            const branches = getBranchList(d);
            bCount += branches.length;
            branches.forEach(b => {
                const sems = b.semesters || [];
                sCount += sems.length;
                sems.forEach(s => {
                    bkCount += (s.subjects || []).length;
                });
            });
        });
        // Fallback for flat unv.branches if any
        if (unv.branches) {
            bCount += unv.branches.length;
            unv.branches.forEach(b => {
                const sems = b.semesters || [];
                sCount += sems.length;
                sems.forEach(s => {
                    bkCount += (s.subjects || []).length;
                });
            });
        }
    });

    if (unvEl) unvEl.innerText = db.universities.length;
    if (domEl) domEl.innerText = dCount;
    if (branchEl) branchEl.innerText = bCount;
    if (semEl) semEl.innerText = sCount;
    if (bookEl) bookEl.innerText = bkCount;

    // Breadcrumb
    let trailHTML = "";
    let tempPath = [];
    currentPath.forEach((id) => {
        tempPath.push(id);
        const pathStr = tempPath.map(p => `'${p}'`).join(', ');
        trailHTML += ` / <a href="#" onclick="navigate(${pathStr}); return false;">${id}</a>`;
    });
    if (trail) trail.innerHTML = trailHTML || " / Home";

    // Logic for Hierarchy
    if (currentPath.length === 0) renderUniversities();
    else if (currentPath.length === 1) renderDomains(currentPath[0]);
    else if (currentPath.length === 2) renderBranches(currentPath[0], currentPath[1]);
    else if (currentPath.length === 3) renderSemesters(currentPath[0], currentPath[1], currentPath[2]);
    else if (currentPath.length === 4) renderSubjects(currentPath[0], currentPath[1], currentPath[2], currentPath[3]);
}

function renderUniversities() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-section">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Manage Universities</h2>
                <div class="search-box">
                    <input type="text" placeholder="Search universities..." oninput="filterList(this.value, '.item-card')">
                </div>
            </div>
            <div class="item-list">
                ${db.universities.map(unv => {
                    const domainCount = (unv.domains || []).length;
                    return `
                    <div class="item-card" onclick="navigate('${unv.id}')">
                        <div class="item-info">
                            <h4>${unv.name} ${unv.shortName ? `(${unv.shortName})` : ''}</h4>
                            <p>${domainCount} Domains</p>
                        </div>
                        <div class="actions">
                            <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('unv', '${unv.id}')"><i class="fas fa-edit"></i></button>
                            <button class="icon-btn danger-btn" onclick="event.stopPropagation(); deleteItem('unv', '${unv.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `}).join('')}
            </div>
            <button class="primary-btn" style="margin-top: 20px;" onclick="openAddModal('unv')"><i class="fas fa-plus"></i> Add University</button>
        </div>
    `;
}

function renderDomains(unvId) {
    const unv = db.universities.find(u => u.id === unvId);
    if (!unv) return navigate('root');
    const domains = unv.domains || [];
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-section">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Domains in ${unv.name}</h2>
                <div class="search-box">
                    <input type="text" placeholder="Search domains..." oninput="filterList(this.value, '.item-card')">
                </div>
            </div>
            <div class="item-list">
                ${domains.map(d => `
                    <div class="item-card" onclick="navigate('${unvId}', '${d.id}')">
                        <div class="item-info">
                            <h4>${d.name}</h4>
                            <p>${(d.branches || []).length} Branches &bull; URL prefix: <code>/${d.urlPrefix || ''}</code></p>
                        </div>
                        <div class="actions">
                            <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('domain', '${d.id}')"><i class="fas fa-edit"></i></button>
                            <button class="icon-btn danger-btn" onclick="event.stopPropagation(); deleteItem('domain', '${d.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" style="margin-top: 20px;" onclick="openAddModal('domain', '${unvId}')"><i class="fas fa-plus"></i> Add Domain</button>
        </div>
    `;
}

function renderBranches(unvId, domainId) {
    const unv = db.universities.find(u => u.id === unvId);
    if (!unv) return navigate('root');
    const domain = (unv.domains || []).find(d => d.id === domainId);
    if (!domain) return navigate(unvId);
    const branches = domain.branches || [];

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-section">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Branches in ${domain.name} (${unv.shortName || unv.name})</h2>
                <div class="search-box">
                    <input type="text" placeholder="Search branches..." oninput="filterList(this.value, '.item-card')">
                </div>
            </div>
            <div class="item-list">
                ${branches.map(b => `
                    <div class="item-card" onclick="navigate('${unvId}', '${domainId}', '${b.id}')">
                        <div class="item-info">
                            <h4>${b.name} ${b.shortName ? `(${b.shortName})` : ''}</h4>
                            <p>${(b.semesters || []).length} Semesters</p>
                        </div>
                        <div class="actions">
                            <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('branch', '${b.id}')"><i class="fas fa-edit"></i></button>
                            <button class="icon-btn danger-btn" onclick="event.stopPropagation(); deleteItem('branch', '${b.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" style="margin-top: 20px;" onclick="openAddModal('branch', '${unvId}', '${domainId}')"><i class="fas fa-plus"></i> Add Branch</button>
        </div>
    `;
}

function renderSemesters(unvId, domainId, branchId) {
    const unv = db.universities.find(u => u.id === unvId);
    if (!unv) return navigate('root');
    const domain = (unv.domains || []).find(d => d.id === domainId);
    if (!domain) return navigate(unvId);
    const branch = (domain.branches || []).find(b => b.id === branchId);
    if (!branch) return navigate(unvId, domainId);
    const semesters = branch.semesters || [];

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-section">
            <h2 style="margin-bottom: 20px;">Semesters for ${branch.name}</h2>
            <div class="item-list">
                ${semesters.map(s => `
                    <div class="item-card" onclick="navigate('${unvId}', '${domainId}', '${branchId}', '${s.id}')">
                        <div class="item-info">
                            <h4>${s.name}</h4>
                            <p>${(s.subjects || []).length} Subjects</p>
                        </div>
                        <div class="actions">
                             <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('sem', '${s.id}')"><i class="fas fa-edit"></i></button>
                            <button class="icon-btn danger-btn" onclick="event.stopPropagation(); deleteItem('sem', '${s.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" style="margin-top: 20px;" onclick="openAddModal('sem', '${unvId}', '${domainId}', '${branchId}')"><i class="fas fa-plus"></i> Add Semester</button>
        </div>
    `;
}

function renderSubjects(unvId, domainId, branchId, semId) {
    const unv = db.universities.find(u => u.id === unvId);
    if (!unv) return navigate('root');
    const domain = (unv.domains || []).find(d => d.id === domainId);
    if (!domain) return navigate(unvId);
    const branch = (domain.branches || []).find(b => b.id === branchId);
    if (!branch) return navigate(unvId, domainId);
    const sem = (branch.semesters || []).find(s => s.id === semId);
    if (!sem) return navigate(unvId, domainId, branchId);
    if (!sem.seo) sem.seo = { title: "", keywords: "", description: "" };
    if (!sem.subjects) sem.subjects = [];

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-section">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Subjects in ${sem.name} (${branch.name})</h2>
                <div class="search-box">
                    <input type="text" placeholder="Search subjects..." oninput="filterList(this.value, '.subject-card')">
                </div>
            </div>
            
            <div class="grid-form" style="margin-bottom: 30px; border-bottom: 1px solid var(--border); padding-bottom: 30px;">
                <div class="input-group full-width">
                    <label>Semester SEO Title</label>
                    <input type="text" id="sem-title" value="${sem.seo.title || ''}" onchange="updateSEO('${unvId}','${domainId}','${branchId}','${semId}', 'title', this.value)">
                </div>
                <div class="input-group">
                    <label>Keywords</label>
                    <textarea id="sem-keywords" rows="3" onchange="updateSEO('${unvId}','${domainId}','${branchId}','${semId}', 'keywords', this.value)">${sem.seo.keywords || ''}</textarea>
                </div>
                <div class="input-group">
                    <label>Description</label>
                    <textarea id="sem-description" rows="3" onchange="updateSEO('${unvId}','${domainId}','${branchId}','${semId}', 'description', this.value)">${sem.seo.description || ''}</textarea>
                </div>
            </div>

            <div class="item-list">
                ${sem.subjects.map((sub, idx) => `
                    <div class="item-card subject-card" style="flex-direction: column; align-items: flex-start; background: rgba(0,0,0,0.2);">
                        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                            <div class="item-info">
                                <h4>${sub.name} (${sub.code})</h4>
                                <p>${(sub.materials || []).length} Materials Attached &bull; Credits: ${sub.credit || 0} &bull; Marks: ${sub.marks || 0}</p>
                            </div>
                            <div class="actions">
                                <button class="icon-btn" onclick="toggleSubjectMeta(${idx})"><i class="fas fa-edit"></i> Edit Book</button>
                                <button class="icon-btn danger-btn" onclick="deleteItem('subject', ${idx})"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                         <!-- Subject SEO & Image Section (Initially Hidden) -->
                         <div id="subject-meta-${idx}" class="grid-form" style="display: none; margin-top: 15px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px; border: 1px dashed var(--border); width: 100%;">
                             <div class="input-group full-width">
                                 <label>Book Cover Image URL</label>
                                 <input type="text" placeholder="e.g. https://.../thumb.webp" value="${sub.image || ''}" onchange="updateSubjectField(${idx}, 'image', this.value)">
                             </div>
                             <div class="input-group">
                                 <label>Subject Code & Slug</label>
                                 <div style="display:flex; gap: 10px;">
                                     <input type="text" placeholder="Code" value="${sub.code || ''}" onchange="updateSubjectField(${idx}, 'code', this.value)">
                                     <input type="text" placeholder="Slug" value="${sub.slug || ''}" onchange="updateSubjectField(${idx}, 'slug', this.value)">
                                 </div>
                             </div>
                             <div class="input-group">
                                 <label>Credits & Marks</label>
                                 <div style="display:flex; gap: 10px;">
                                     <input type="number" placeholder="Credits" value="${sub.credit || 0}" onchange="updateSubjectField(${idx}, 'credit', parseInt(this.value))">
                                     <input type="number" placeholder="Marks" value="${sub.marks || 0}" onchange="updateSubjectField(${idx}, 'marks', parseInt(this.value))">
                                 </div>
                             </div>
                             <div class="input-group full-width">
                                 <label>Subject SEO Title</label>
                                 <input type="text" value="${sub.seo?.title || ''}" onchange="updateSubjectField(${idx}, 'seo.title', this.value)">
                             </div>
                             <div class="input-group">
                                 <label>Keywords</label>
                                 <textarea rows="2" onchange="updateSubjectField(${idx}, 'seo.keywords', this.value)">${sub.seo?.keywords || ''}</textarea>
                             </div>
                             <div class="input-group">
                                 <label>Description</label>
                                 <textarea rows="2" onchange="updateSubjectField(${idx}, 'seo.description', this.value)">${sub.seo?.description || ''}</textarea>
                             </div>
                         </div>

                        <div class="materials-list" style="margin-top: 10px; width: 100%; border-top: 1px solid var(--border); padding-top: 10px;">
                            ${(sub.materials || []).map((mat, mIdx) => `
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px;">
                                    <span><strong>${mat.label}</strong> (${mat.type}) ${mat.language ? `[${mat.language}]` : ''}</span>
                                    <div style="display:flex; gap: 10px; align-items:center;">
                                        <a href="${mat.link}" target="_blank" style="color: var(--accent);"><i class="fas fa-external-link-alt"></i></a>
                                        <button class="icon-btn danger-btn" style="padding: 2px 5px;" onclick="deleteItem('material', ${idx}, ${mIdx})"><i class="fas fa-times"></i></button>
                                    </div>
                                </div>
                            `).join('')}
                            <button class="secondary-btn" style="padding: 10px; font-size: 0.8rem; width: 100%; margin-top: 10px;" onclick="openAddModal('material', '${unvId}', '${domainId}', '${branchId}', '${semId}', ${idx})"><i class="fas fa-file-plus"></i> + Add New Study Material (Book/Paper)</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" style="margin-top: 20px; width: 100%;" onclick="openAddModal('subject', '${unvId}', '${domainId}', '${branchId}', '${semId}')"><i class="fas fa-plus"></i> Add New Subject</button>
        </div>
    `;
}

function filterList(query, selector) {
    const q = query.toLowerCase();
    document.querySelectorAll(selector).forEach(el => {
        const text = el.innerText.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
        if (selector === '.subject-card' && text.includes(q)) el.style.display = 'flex';
    });
}

function toggleSubjectMeta(idx) {
    const section = document.getElementById(`subject-meta-${idx}`);
    if (section) section.style.display = section.style.display === 'none' ? 'grid' : 'none';
}

function updateSubjectField(subIdx, field, value) {
    const unv = db.universities.find(u => u.id === currentPath[0]);
    const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
    const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
    const sem = (branch?.semesters || []).find(s => s.id === currentPath[3]);
    const sub = sem?.subjects?.[subIdx];
    if (!sub) return;
    
    if (field.startsWith('seo.')) {
        if (!sub.seo) sub.seo = { title: "", keywords: "", description: "" };
        const key = field.split('.')[1];
        sub.seo[key] = value;
    } else {
        sub[field] = value;
    }
}

function openAddModal(type, ...params) {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('form-content');
    modal.style.display = 'flex';
    
    let html = `<h3>Add New ${type.toUpperCase()}</h3><div class="grid-form" style="margin-top:20px;">`;
    
    if (type === 'material') {
        html += `
            <div class="input-group full-width"><label>Material Label</label><input id="modal-label" placeholder="e.g. Full Textbook"></div>
            <div class="input-group full-width"><label>PDF Link (URL)</label><input id="modal-link" placeholder="e.g. https://drive.google.com/..."></div>
            <div class="input-group full-width"><label>Type</label><select id="modal-type">
                <option value="book">Book</option>
                <option value="paper">Paper</option>
                <option value="practical">Practical</option>
                <option value="syllabus">Syllabus</option>
                <option value="notes">Notes</option>
            </select></div>
        `;
    } else if (type === 'subject') {
        html += `
            <div class="input-group full-width"><label>Subject Name</label><input id="modal-name" placeholder="e.g. Mathematics"></div>
            <div class="input-group full-width"><label>Subject Code</label><input id="modal-code" placeholder="e.g. 4300001"></div>
            <div class="input-group full-width"><label>Subject Slug (URL name)</label><input id="modal-slug" placeholder="e.g. mathematics"></div>
        `;
    } else if (type === 'domain') {
        html += `
            <div class="input-group full-width"><label>Domain Name</label><input id="modal-name" placeholder="e.g. Degree Engineering"></div>
            <div class="input-group full-width"><label>Domain ID</label><input id="modal-id" placeholder="e.g. be"></div>
            <div class="input-group full-width"><label>URL Prefix</label><input id="modal-prefix" placeholder="e.g. BE or leave blank"></div>
        `;
    } else {
        html += `
            <div class="input-group full-width"><label>Name</label><input id="modal-name" placeholder="e.g. Computer Engineering"></div>
            <div class="input-group full-width"><label>ID</label><input id="modal-id" placeholder="e.g. computer"></div>
        `;
    }
    
    html += `</div><div class="actions" style="margin-top:30px; justify-content: flex-end;">
        <button class="secondary-btn" onclick="closeModal()">Cancel</button>
        <button onclick="commitAdd('${type}', '${params.join("','")}')">Create</button>
    </div>`;
    
    content.innerHTML = html;
}

function openEditModal(type, id) {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('form-content');
    modal.style.display = 'flex';
    
    let item;
    if (type === 'unv') item = db.universities.find(u => u.id === id);
    else if (type === 'domain') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        item = (unv?.domains || []).find(d => d.id === id);
    } else if (type === 'branch') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        item = (domain?.branches || []).find(b => b.id === id);
    } else if (type === 'sem') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
        item = (branch?.semesters || []).find(s => s.id === id);
    }

    if (!item) return closeModal();

    let html = `<h3>Edit ${type.toUpperCase()}</h3><div class="grid-form" style="margin-top:20px;">
        <div class="input-group full-width"><label>Name</label><input id="modal-edit-name" value="${item.name || ''}"></div>
        <div class="input-group full-width"><label>ID</label><input id="modal-edit-id" value="${item.id || ''}" readonly></div>
    </div><div class="actions" style="margin-top:30px; justify-content: flex-end;">
        <button class="secondary-btn" onclick="closeModal()">Cancel</button>
        <button onclick="commitEdit('${type}', '${id}')">Save Changes</button>
    </div>`;
    
    content.innerHTML = html;
}

function closeModal() {
    document.getElementById('modal-container').style.display = 'none';
}

function commitAdd(type, ...params) {
    if (type === 'unv') {
        const name = document.getElementById('modal-name').value;
        const idInput = document.getElementById('modal-id');
        const id = (idInput && idInput.value) ? idInput.value.toLowerCase() : name.toLowerCase().replace(/\s+/g, '-');
        db.universities.push({ id, name, domains: [] });
    } else if (type === 'domain') {
        const unv = db.universities.find(u => u.id === params[0]);
        const name = document.getElementById('modal-name').value;
        const id = document.getElementById('modal-id').value || name.toLowerCase().replace(/\s+/g, '-');
        const urlPrefix = document.getElementById('modal-prefix')?.value || '';
        if (!unv.domains) unv.domains = [];
        unv.domains.push({ id, name, urlPrefix, branches: [] });
    } else if (type === 'branch') {
        const unv = db.universities.find(u => u.id === params[0]);
        const domain = (unv.domains || []).find(d => d.id === params[1]);
        const name = document.getElementById('modal-name').value;
        const id = document.getElementById('modal-id').value || name.toLowerCase().replace(/\s+/g, '-');
        if (!domain.branches) domain.branches = [];
        domain.branches.push({ id, name, semesters: [] });
    } else if (type === 'sem') {
        const unv = db.universities.find(u => u.id === params[0]);
        const domain = (unv.domains || []).find(d => d.id === params[1]);
        const branch = (domain.branches || []).find(b => b.id === params[2]);
        const name = document.getElementById('modal-name').value;
        const id = document.getElementById('modal-id').value || name.toLowerCase().replace(/\s+/g, '-');
        if (!branch.semesters) branch.semesters = [];
        branch.semesters.push({ id, name, seo: { title: "", keywords: "", description: "" }, subjects: [] });
    } else if (type === 'subject') {
        const unv = db.universities.find(u => u.id === params[0]);
        const domain = (unv.domains || []).find(d => d.id === params[1]);
        const branch = (domain.branches || []).find(b => b.id === params[2]);
        const sem = (branch.semesters || []).find(s => s.id === params[3]);
        const name = document.getElementById('modal-name').value;
        const code = document.getElementById('modal-code').value;
        const slug = document.getElementById('modal-slug')?.value || name.toLowerCase().replace(/\s+/g, '-');
        if (!sem.subjects) sem.subjects = [];
        sem.subjects.push({ 
            code, 
            name, 
            slug,
            credit: 4, 
            marks: 70, 
            image: "",
            seo: { title: `${name} - KhudKibook`, keywords: "", description: "" },
            materials: [] 
        });
    } else if (type === 'material') {
        const unv = db.universities.find(u => u.id === params[0]);
        const domain = (unv.domains || []).find(d => d.id === params[1]);
        const branch = (domain.branches || []).find(b => b.id === params[2]);
        const sem = (branch.semesters || []).find(s => s.id === params[3]);
        const sub = sem.subjects[params[4]];
        const label = document.getElementById('modal-label').value;
        const link = document.getElementById('modal-link').value;
        const typeMat = document.getElementById('modal-type').value;
        if (!sub.materials) sub.materials = [];
        sub.materials.push({ label, link, type: typeMat, year: "all", language: "english" });
    }
    
    closeModal();
    renderDashboard();
}

function commitEdit(type, id) {
    const newName = document.getElementById('modal-edit-name').value;
    if (type === 'unv') {
        const item = db.universities.find(u => u.id === id);
        if (item) item.name = newName;
    } else if (type === 'domain') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const item = (unv?.domains || []).find(d => d.id === id);
        if (item) item.name = newName;
    } else if (type === 'branch') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const item = (domain?.branches || []).find(b => b.id === id);
        if (item) item.name = newName;
    } else if (type === 'sem') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
        const item = (branch?.semesters || []).find(s => s.id === id);
        if (item) item.name = newName;
    }
    closeModal();
    renderDashboard();
}

function updateSEO(unvId, domainId, branchId, semId, key, value) {
    const unv = db.universities.find(u => u.id === unvId);
    const domain = (unv?.domains || []).find(d => d.id === domainId);
    const branch = (domain?.branches || []).find(b => b.id === branchId);
    const sem = (branch?.semesters || []).find(s => s.id === semId);
    if (sem && sem.seo) sem.seo[key] = value;
}

function deleteItem(type, idOrIdx, matIdx) {
    if (!confirm("Are you sure?")) return;
    
    if (type === 'unv') {
        db.universities = db.universities.filter(u => u.id !== idOrIdx);
    } else if (type === 'domain') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        if (unv && unv.domains) unv.domains = unv.domains.filter(d => d.id !== idOrIdx);
    } else if (type === 'branch') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        if (domain && domain.branches) domain.branches = domain.branches.filter(b => b.id !== idOrIdx);
    } else if (type === 'sem') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
        if (branch && branch.semesters) branch.semesters = branch.semesters.filter(s => s.id !== idOrIdx);
    } else if (type === 'subject') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
        const sem = (branch?.semesters || []).find(s => s.id === currentPath[3]);
        if (sem && sem.subjects) sem.subjects.splice(idOrIdx, 1);
    } else if (type === 'material') {
        const unv = db.universities.find(u => u.id === currentPath[0]);
        const domain = (unv?.domains || []).find(d => d.id === currentPath[1]);
        const branch = (domain?.branches || []).find(b => b.id === currentPath[2]);
        const sem = (branch?.semesters || []).find(s => s.id === currentPath[3]);
        const sub = sem?.subjects?.[idOrIdx];
        if (sub && sub.materials) sub.materials.splice(matIdx, 1);
    }
    renderDashboard();
}

function navigate(...path) {
    if (path[0] === 'root') currentPath = [];
    else currentPath = path;
    renderDashboard();
}

// ---------------- GTU Crawler ----------------
let crawlController = null;
let crawlMode = 'sync';

function openCrawlerModal() {
    document.getElementById('crawler-modal').style.display = 'flex';
    document.getElementById('crawler-log').textContent = '';
    document.getElementById('crawler-log-wrap').style.display = 'none';
    document.getElementById('crawler-result').style.display = 'none';
    document.getElementById('crawler-status').textContent = 'waiting...';
    document.getElementById('crawler-cancel-btn').style.display = 'none';
    document.getElementById('crawler-run-btn').disabled = false;
    document.getElementById('crawler-run-btn').innerHTML = '<i class="fas fa-play"></i> Run Crawler';
}

function closeCrawlerModal() {
    cancelCrawl();
    document.getElementById('crawler-modal').style.display = 'none';
}

function selectCrawlMode(mode) {
    crawlMode = mode;
    document.querySelectorAll('.crawl-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

function appendCrawlerLog(line, isResult) {
    const logEl = document.getElementById('crawler-log');
    const el = document.createElement('div');
    el.textContent = line;
    el.style.color = isResult ? 'var(--accent)' : '#9fe8a0';
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
}

async function runCrawl() {
    const runBtn = document.getElementById('crawler-run-btn');
    const cancelBtn = document.getElementById('crawler-cancel-btn');
    const logWrap = document.getElementById('crawler-log-wrap');
    const resultEl = document.getElementById('crawler-result');
    const statusEl = document.getElementById('crawler-status');

    if (crawlController) cancelCrawl();
    crawlController = new AbortController();
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Crawling...';
    cancelBtn.style.display = 'inline-flex';
    logWrap.style.display = 'block';
    resultEl.style.display = 'none';
    document.getElementById('crawler-log').textContent = '';
    statusEl.textContent = 'running...';

    const limit = parseInt(document.getElementById('crawl-limit').value, 10) || undefined;
    const years = document.getElementById('crawl-years').value
        .split(',').map(s => s.trim()).filter(Boolean)
        .map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    const subjectCodes = document.getElementById('crawl-codes').value
        .split(',').map(s => s.trim()).filter(Boolean);

    const payload = {};
    if (limit !== undefined) payload.limit = limit;
    if (years.length) payload.years = years;
    if (subjectCodes.length) payload.subjectCodes = subjectCodes;
    if (document.getElementById('crawl-skip-notices').checked) payload.skipNotices = true;
    if (document.getElementById('crawl-skip-syllabus').checked) payload.skipSyllabus = true;
    if (document.getElementById('crawl-skip-papers').checked) payload.skipPapers = true;

    try {
        const response = await fetch(`/api/crawl/${crawlMode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(payload),
            signal: crawlController.signal
        });
        if (!response.ok || !response.body) {
            const text = await response.text();
            throw new Error(`Server responded ${response.status}: ${text.slice(0, 300)}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop();
            for (const evt of events) {
                const data = evt.replace(/^data:\s*/, '').trim();
                if (!data) continue;
                try {
                    const msg = JSON.parse(data);
                    if (msg.log) appendCrawlerLog(msg.log);
                    if (msg.status === 'error') {
                        appendCrawlerLog('ERROR: ' + msg.message);
                        statusEl.textContent = 'failed';
                        showCrawlResult('error', msg.message);
                        return;
                    }
                    if (msg.status === 'done') {
                        statusEl.textContent = 'done';
                        showCrawlResult('success', msg.logs || []);
                    }
                } catch (e) {
                    appendCrawlerLog(data);
                }
            }
        }
        if (buffer.trim()) {
            try {
                const msg = JSON.parse(buffer.replace(/^data:\s*/, '').trim());
                if (msg.status === 'done') { statusEl.textContent = 'done'; showCrawlResult('success', msg.logs || []); }
            } catch (e) { /* ignore trailing */ }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            statusEl.textContent = 'stopped';
            appendCrawlerLog('Crawl stopped by user.');
        } else {
            statusEl.textContent = 'failed';
            appendCrawlerLog('ERROR: ' + err.message);
            showCrawlResult('error', err.message);
        }
    } finally {
        crawlController = null;
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> Run Crawler';
        cancelBtn.style.display = 'none';
    }
}

function showCrawlResult(kind, logs) {
    const resultEl = document.getElementById('crawler-result');
    resultEl.style.display = 'block';
    if (kind === 'error') {
        resultEl.style.color = 'var(--danger)';
        resultEl.style.background = 'rgba(239,68,68,0.1)';
        resultEl.style.borderColor = 'rgba(239,68,68,0.35)';
        resultEl.innerHTML = `<i class="fas fa-times-circle"></i> Crawl failed: ${logs}</i>`;
        return;
    }
    const last = logs.filter(l => l.includes('[Merge]')).pop() || '';
    const lastSync = logs.filter(l => l.includes('SYNC COMPLETE')).pop() || '';
    resultEl.style.color = 'var(--accent)';
    resultEl.style.background = 'rgba(63,185,119,0.1)';
    resultEl.style.borderColor = 'rgba(63,185,119,0.35)';
    resultEl.innerHTML = `<i class="fas fa-check-circle"></i> Crawl complete. ${last ? ' ' + last.replace('[Merge] ', '') : ''} ${lastSync ? lastSync.replace('[Sync] ', '') : ''}`;
}

function cancelCrawl() {
    if (crawlController) {
        crawlController.abort();
        crawlController = null;
    }
}

// Initialization
document.getElementById('save-btn').onclick = () => API.saveDb();
document.getElementById('build-btn').onclick = () => API.buildSite();
document.getElementById('crawler-btn').onclick = () => openCrawlerModal();
document.getElementById('ai-btn').onclick = () => window.location.href = '/admin/ai.html';

API.loadDb();
