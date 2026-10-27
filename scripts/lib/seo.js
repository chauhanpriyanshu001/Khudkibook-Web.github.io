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

/**
 * True when a generated subject page is a thin, low-value stub.
 *
 * A stub offers neither a textbook nor question papers, so the only body on the
 * page is ~96 words of the same boilerplate wrapped around the scraped GTU
 * syllabus topics. That syllabus text is not ours and is near-identical on the
 * ~11,700 other subject pages, so the page adds no unique value to the index --
 * it is the "thin content" / "scaled content" shape an AdSense reviewer looks
 * for, no matter how many of them there are.
 *
 * The syllabus breakdown used to be treated as enough to index on. It is not:
 * the volume of duplicated, externally-sourced pages is itself the finding, and
 * keeping them indexed is what produced the recurring "low value content"
 * verdict. Pages that DO carry a textbook or past papers keep indexing and are
 * the ones the site should be judged on. See scripts/fix_indexing.js for the
 * pass that applies this across the committed tree.
 *
 * Indexing and monetizing ask the same question here, so they stay in step:
 * `pageHasPublishableContent()` in public/ad-injector.js suppresses ad units on
 * exactly these pages (and any other `noindex` page) too.
 */
function isThinPlaceholder(html) {
    if (!html) return false;
    // Only generated subject pages qualify. Blog posts, indexes and notices may
    // legitimately say "Coming Soon" or ship that string inside inline scripts.
    if (!SUBJECT_PAGE.test(html)) return false;
    if (!NO_BOOK.test(html)) return false;
    if (!NO_PAPERS.test(html)) return false;
    return true;
}

// A subject page that carries hand-written (or reviewed) editorial copy. The
// marker is emitted by scripts/lib/subject_editorial.js and generate.js, so the
// indexing pass, the sitemap and the ad guard all agree on what counts as
// "original value on this page".
const SUBJECT_EDITORIAL = /class="kb-subject-editorial"/;

/**
 * True when a subject page has a real textbook attached (not a "Book (Soon)"
 * empty state). Papers alone are not enough: almost every subject links a past
 * paper, so treating papers as value is what let thousands of syllabus-only
 * pages stay indexed.
 */
function hasRealBook(html) {
    if (!html || !SUBJECT_PAGE.test(html)) return false;
    return !NO_BOOK.test(html);
}

function hasRealPapers(html) {
    if (!html || !SUBJECT_PAGE.test(html)) return false;
    return !NO_PAPERS.test(html);
}

function hasOriginalEditorial(html) {
    return !!html && SUBJECT_EDITORIAL.test(html);
}

function isSubjectPage(html) {
    return !!html && SUBJECT_PAGE.test(html);
}

/**
 * The content-quality gate used for indexing, the sitemap and ads.
 *
 * A generated subject page is low value when its body is only the scraped GTU
 * syllabus plus download links. That is the "scaled content" shape AdSense
 * flags: thousands of near-identical pages, each adding nothing a reader could
 * not get from the PDF. A page clears the gate when it either carries a real
 * textbook or has reviewed editorial copy written for that subject.
 *
 * Deliberately stricter than `isThinPlaceholder()` (which only catches pages
 * with neither book nor papers). `isThinPlaceholder()` still drives the
 * stub-to-redirect pass because redirecting a page that has papers would break
 * a reader's download; this gate only decides indexing, sitemap and ads.
 */
function isLowValueSubjectPage(html) {
    if (!html || !SUBJECT_PAGE.test(html)) return false;
    return !hasOriginalEditorial(html) && !hasRealBook(html);
}

/**
 * Visible word count of the page body, ignoring scripts, styles and markup.
 * Used by the audit and quality gate. Not a ranking signal by itself -- a short
 * page can still be valuable -- but it catches empty generated shells.
 */
function visibleWordCount(html) {
    if (!html) return 0;
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    const text = (body ? body[1] : html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text ? text.split(' ').length : 0;
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

module.exports = {
    cleanUrl,
    cleanInternalLinks,
    isThinPlaceholder,
    isLowValueSubjectPage,
    isSubjectPage,
    hasRealBook,
    hasRealPapers,
    hasOriginalEditorial,
    visibleWordCount,
    DEFAULT_SITE_URL
};
