/**
 * Shared URL and thin-content rules for indexing.
 *
 * Firebase serves this project with `cleanUrls: true`, so every on-disk
 * `foo.html` is ALSO reachable at `/foo` -- and the `.html` form 301s to it.
 * A canonical or a <loc> ending in `.html` therefore points at a redirect,
 * which Search Console reports as "Page with redirect" and costs a crawl hop
 * on every URL on the site. Every declared URL must go through cleanUrl() so
 * it is the one form that actually answers 200.
 *
 * The rules live here rather than in each caller so the sitemap, the canonical
 * tags and the noindex pass can never disagree about what counts as thin.
 */

const DEFAULT_SITE_URL = 'https://khudkibook.in';

// Hosts this project has ever been served from. A canonical left pointing at an
// old host (or the firebase .web.app alias) is rewritten onto the canonical host.
const KNOWN_HOSTS = /^(?:https?:)?\/\/(?:www\.)?(?:khudkibook\.in|khudkibook\.web\.app|khudkibook\.com)(?=\/|$)/i;

/**
 * Rewrite a site path or absolute URL to the form that returns 200.
 *
 *   /index.html                 -> /
 *   /about.html                 -> /about
 *   /BE/civil/sem1/index.html   -> /BE/civil/sem1
 *   /BE/civil/sem1/notes.html   -> /BE/civil/sem1/notes
 *   /blog/                      -> /blog
 *
 * `trailingSlash: false` means the slashless form is the canonical one, so a
 * trailing slash is dropped everywhere except the site root. Any query string
 * or fragment is preserved. Absolute URLs on a foreign host are returned
 * untouched -- they are not ours to rewrite.
 */
function cleanUrl(input, siteUrl = DEFAULT_SITE_URL) {
    if (input == null) return input;
    let rest = String(input).trim();
    if (!rest) return rest;

    const host = KNOWN_HOSTS.exec(rest);
    if (host) {
        rest = rest.slice(host[0].length);
    } else if (/^(?:https?:)?\/\//i.test(rest)) {
        return rest;
    }

    // Peel off query/fragment before touching the path.
    let suffix = '';
    const qi = rest.search(/[?#]/);
    if (qi !== -1) {
        suffix = rest.slice(qi);
        rest = rest.slice(0, qi);
    }

    if (/\/index\.html?$/i.test(rest)) {
        rest = rest.slice(0, -'index.html'.length);
    } else if (/\.html?$/i.test(rest)) {
        rest = rest.slice(0, -'.html'.length);
    }

    rest = rest.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    if (!rest) rest = '/';

    const base = String(siteUrl).replace(/\/+$/, '');
    return base + rest + suffix;
}

/**
 * Structural markers the generator emits for a subject page.
 *
 * A subject page is built from three independent pieces of content: the
 * textbook, the previous-year question papers, and the unit-wise syllabus
 * breakdown. When a subject has none of them, `generate.js` still emits the
 * page so the semester index and the ~15k internal links pointing at it stay
 * valid, but the body collapses to a title, a breadcrumb, a Syllabus button
 * and two "Coming Soon" empty states.
 *
 * These markers are read off that structure rather than off whether the page
 * merely *links* a PDF. Two earlier attempts used link matching and both were
 * wrong in opposite directions:
 *
 *  - A bare-host Drive check matched the `//drive.google.com` dns-prefetch hint
 *    that every page carries, so it exempted the entire site and filtered
 *    nothing.
 *  - A stricter material-host list (the syllabus PDF on the S3 bucket counted)
 *    flagged 20,266 pages, 20,264 of which did link a working syllabus. All
 *    20,266 were then noindexed and dropped from the sitemap, which left the
 *    site looking near-empty to AdSense and is what produced the "low value
 *    content" verdict.
 *
 * Asking "does this subject actually have a book / papers / syllabus prose"
 * answers the question that matters and does not move when a new PDF host is
 * added.
 */
const SUBJECT_PAGE = /class="materials-section"/;
const NO_BOOK = />\s*(?:ENG-)?Book\s*\(Soon\)\s*</i;
const NO_PAPERS = />\s*Papers?\s*\(Soon\)\s*</i;
const SYLLABUS_PROSE = /unit-wise content|official GTU curriculum for|syllabus-section/i;

/**
 * True when a generated subject page has no study material worth indexing.
 *
 * A stub offers neither a textbook nor question papers and has no syllabus
 * breakdown to fall back on, so its body is ~96 words of the same boilerplate.
 * It renders a title and a breadcrumb around an empty body, so indexing it
 * dilutes the site rather than adding a result.
 *
 * Indexing and monetizing are deliberately graded, not identical. A page with
 * no book and no papers but a full unit-wise syllabus breakdown is still worth
 * indexing -- it answers "what does this subject cover", which is the question
 * most of these are searched for -- so it is kept here. It is not, however,
 * allowed to carry ad units; `pageHasPublishableContent()` in public/ad-injector.js
 * asks the stricter question and suppresses ads on those pages. Narrowing this
 * function any further re-noindexes working pages, which is what left the site
 * looking empty to AdSense the first time round.
 */
function isThinPlaceholder(html) {
    if (!html) return false;
    // Only generated subject pages qualify. Blog posts, indexes and notices may
    // legitimately say "Coming Soon" or ship that string inside inline scripts.
    if (!SUBJECT_PAGE.test(html)) return false;
    if (!NO_BOOK.test(html)) return false;
    if (!NO_PAPERS.test(html)) return false;
    if (SYLLABUS_PROSE.test(html)) return false;
    return true;
}

/**
 * Rewrite every same-site link in a page to the form that answers 200.
 *
 * With cleanUrls on, an `<a href="/x/y.html">` costs the crawler a 301 before it
 * can follow the link, and the site carries well over a million internal links.
 * Only root-relative hrefs are touched: assets, `?v=` cache-busters, external
 * hosts, `mailto:` and in-page anchors are all left exactly as they are.
 */
function cleanInternalLinks(html, siteUrl = DEFAULT_SITE_URL) {
    if (!html) return html;
    const base = String(siteUrl).replace(/\/+$/, '');
    return html.replace(/href="(\/[^"#?]*\.html)(#[^"]*)?"/gi, (match, path, hash) => {
        const clean = cleanUrl(path, base);
        if (!clean.startsWith(base)) return match;
        return `href="${clean.slice(base.length)}${hash || ''}"`;
    });
}

module.exports = { cleanUrl, cleanInternalLinks, isThinPlaceholder, DEFAULT_SITE_URL };
