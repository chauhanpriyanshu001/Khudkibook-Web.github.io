/**
 * GTU branch mapping helpers.
 *
 * A crawl branch is keyed by a GTU branch code ("16"); a DB branch is keyed by a
 * slug ("it"). Attaching one to the other is the single decision the whole sync
 * rests on, so it lives here on its own and both the sync and the effective-from
 * backfill use it rather than each keeping a copy that can drift.
 *
 * Matching is by NAME against GTU's own branch list (data/gtu_programs_branches.json).
 * It is deliberately not a subject-code overlap score: overlap rewards whichever
 * DB branch happens to hold the most subjects, so a branch that was once given the
 * wrong subjects keeps winning and the mistake can never correct itself. That is
 * exactly how Diploma Information Technology's 142 subjects ended up published
 * under Biomedical.
 *
 * A DB branch with no GTU counterpart -- or one of two branches claiming the same
 * GTU code -- resolves to null, which callers read as "leave this branch alone".
 */

// Words that carry no identity in a branch name, so "Diploma in Marine Engineering"
// and "Marine Engineering" normalise alike. Removed via split/filter rather than a
// regex with the \b flag, whose lastIndex state leaks between calls.
const BRANCH_NAME_STOPWORDS = new Set(['and', 'of', 'in', 'the', 'diploma', 'programme', 'program']);

// Reduce a branch name to its identity: lowercased, alphanumerics only, filler
// words dropped. "ELECTRONICS & COMMUNICATION ENGINEERING" and
// "Electronics and Communication Engineering" both become
// "electronics communication engineering".
function normalizeBranchName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => w && !BRANCH_NAME_STOPWORDS.has(w))
        .join(' ');
}

// course -> normalized GTU branch name -> GTU branch code.
// A name is only ambiguous when two DIFFERENT codes normalise to it.
// gtu_programs_branches.json lists some branches twice under the same code
// (01 as both "DIPLOMA IN AERONAUTICAL ENGINEERING" and "AERONAUTICAL
// ENGINEERING"), which is one branch, not a conflict.
function buildGtuBranchNameLookup(programs) {
    const lookup = {};
    for (const [course, program] of Object.entries(programs.programs || {})) {
        const byName = new Map();
        const contested = new Set();
        for (const br of program.branches || []) {
            // gtu_programs_branches.json prefixes names with the branch code
            const name = normalizeBranchName(String(br.name || '').replace(/^\d+\s*-\s*/, ''));
            if (!name) continue;
            const prior = byName.get(name);
            if (prior !== undefined && prior !== br.code) contested.add(name);
            else byName.set(name, br.code);
        }
        for (const name of contested) byName.delete(name);
        lookup[course] = byName;
    }
    return lookup;
}

// domain -> Map(DB branch id -> GTU branch code | null).
// null means "no GTU counterpart": the branch is left untouched by every pass.
function resolveDbBranchCodes(domain, course, gtuNameLookup) {
    const byName = gtuNameLookup[course] || new Map();
    const resolved = new Map();
    const claimedCodes = new Set();

    // First pass: exact name match, no GTU code claimed twice.
    for (const br of domain.branches) {
        let code = null;
        for (const candidate of [br.name, br.shortName]) {
            const n = normalizeBranchName(candidate);
            if (!n) continue;
            const hit = byName.get(n);
            if (hit && !claimedCodes.has(hit)) { code = hit; break; }
        }
        resolved.set(br.id, code);
        if (code !== null) claimedCodes.add(code);
    }

    // Second pass: a branch that missed on `name` may still match on `shortName`
    // once the branches ahead of it in array order have taken their own codes.
    for (const br of domain.branches) {
        if (resolved.get(br.id) !== null) continue;
        const n = normalizeBranchName(br.shortName);
        const hit = n ? byName.get(n) : null;
        if (hit && !claimedCodes.has(hit)) {
            resolved.set(br.id, hit);
            claimedCodes.add(hit);
        }
    }
    return resolved;
}

module.exports = {
    BRANCH_NAME_STOPWORDS,
    normalizeBranchName,
    buildGtuBranchNameLookup,
    resolveDbBranchCodes
};