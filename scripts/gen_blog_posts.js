/**
 * Generates the hand-written (original) Khudkibook blog posts.
 *
 * The `/blog` index and the homepage "Latest From The Blog" strip both read
 * `public/blog/posts.json`, and the GTU monitor prepends its own notice-derived
 * posts to that same file. This script owns the *evergreen* guides only: it
 * writes their HTML and merges their metadata into `posts.json` newest-first,
 * leaving monitor-generated entries untouched (matched by slug).
 *
 * Why a generator rather than hand-written files: every post needs the identical
 * SEO shell (robots, canonical, Open Graph, Twitter card, BlogPosting JSON-LD,
 * breadcrumbs). Hand-copying that is how one post ends up with a stale canonical
 * or a missing twitter:url. Here the shell lives once.
 *
 * Idempotent: re-running rewrites the same bytes and does not duplicate the
 * posts.json entries. Existing posts.json is backed up first.
 *
 * Usage: node scripts/gen_blog_posts.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');
const POSTS_JSON = path.join(BLOG_DIR, 'posts.json');

const SITE = 'https://khudkibook.in';
const OG_IMAGE = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';

/** Shared article shell. `body` is injected verbatim between the article card. */
function render(post) {
    const url = `${SITE}/blog/${post.slug}`;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const tags = (post.tags || []).join(', ');

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(post.title)}</title>

    <!-- SEO Meta Tags -->
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="keywords" content="${esc(post.keywords)}" />
    <meta name="description" content="${esc(post.excerpt)}" />
    <meta name="author" content="Chauhan Priyanshu" />
    <meta name="generator" content="Khudkibook" />
    <meta name="theme-color" content="#CD5D33" />
    <meta name="application-name" content="Khudkibook" />
    <meta name="geo.region" content="IN-GJ" />
    <meta name="geo.placename" content="Gujarat, India" />
    <meta name="referrer" content="origin-when-cross-origin" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="canonical" href="${url}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Khudkibook" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:title" content="${esc(post.title)}" />
    <meta property="og:description" content="${esc(post.excerpt)}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${url}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@khudkibook" />
    <meta name="twitter:creator" content="@khudkibook" />
    <meta name="twitter:title" content="${esc(post.title)}" />
    <meta name="twitter:description" content="${esc(post.excerpt)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:url" content="${url}" />

    <!-- Article Schema.org JSON-LD -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": ${JSON.stringify(post.title)},
        "description": ${JSON.stringify(post.excerpt)},
        "datePublished": "${post.date}",
        "dateModified": "${post.date}",
        "author": { "@type": "Person", "name": "Chauhan Priyanshu", "url": "${SITE}/about" },
        "publisher": { "@type": "Organization", "name": "Khudkibook", "url": "${SITE}" },
        "mainEntityOfPage": "${url}",
        "keywords": ${JSON.stringify(tags)},
        "image": "${OG_IMAGE}"
      }
    </script>

    <!-- Fonts & Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link rel="stylesheet" href="/be619.css?v=2.1" />
    <link rel="stylesheet" href="/cd651.css?v=2.1" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png?v=2" />

    <style>
      .kb-article { max-width: 820px; margin: 0 auto; padding: 24px 16px 48px; }
      .kb-article-head { background: linear-gradient(135deg, #CD5D33 0%, #F0A66E 55%, #4A3A2C 140%); border-radius: 18px; padding: 28px; color: #fff; box-shadow: 0 10px 30px rgba(205,93,51,0.25); }
      .kb-article-head h1 { font-family: 'Outfit', sans-serif; font-size: clamp(1.4rem, 3.8vw, 2rem); margin: 0 0 12px; line-height: 1.3; }
      .kb-article-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.78rem; opacity: 0.9; font-weight: 600; }
      .kb-article-meta span { display: inline-flex; align-items: center; gap: 5px; }
      .kb-article-body { background: #fff; border: 1px solid var(--border, #e5e7eb); border-radius: 16px; padding: 28px 30px; margin-top: 20px; box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06)); }
      .kb-article-body h2 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; color: var(--text-primary, #111827); margin: 28px 0 10px; padding-bottom: 8px; border-bottom: 2px solid var(--bg-soft, #f3f4f6); }
      .kb-article-body h2:first-child { margin-top: 0; }
      .kb-article-body h3 { font-size: 1.05rem; color: var(--text-primary, #111827); margin: 18px 0 6px; }
      .kb-article-body p, .kb-article-body li { font-size: 0.95rem; color: var(--text-secondary, #374151); line-height: 1.75; }
      .kb-article-body p { margin: 0 0 14px; }
      .kb-article-body ul, .kb-article-body ol { padding-left: 22px; margin: 0 0 14px; }
      .kb-article-body li { margin-bottom: 8px; }
      .kb-article-body a { color: var(--accent, #CD5D33); }
      .kb-article-body table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.9rem; }
      .kb-article-body th, .kb-article-body td { border: 1px solid var(--border, #e5e7eb); padding: 9px 11px; text-align: left; color: var(--text-secondary, #374151); }
      .kb-article-body th { background: #f8fafc; font-weight: 700; color: var(--text-primary, #111827); }
      .kb-tip { background: #f9ece2; border: 1px solid #eccfb8; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 0.92rem; color: #4A3A2C; line-height: 1.65; display: flex; gap: 10px; }
      .kb-tip i { color: #CD5D33; margin-top: 3px; }
      .kb-cta-link { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #CD5D33, #F0A66E); color: #fff !important; padding: 11px 20px; border-radius: 999px; font-size: 0.9rem; font-weight: 700; text-decoration: none; }
      .kb-author-box { display: flex; gap: 14px; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 14px; padding: 16px; margin-top: 22px; align-items: center; }
      .kb-author-box img { width: 48px; height: 48px; border-radius: 12px; }
      .kb-author-box p { font-size: 0.85rem; color: var(--text-muted, #6b7280); margin: 0; line-height: 1.55; }
      @media (max-width: 560px) { .kb-article-body { padding: 20px 18px; } }
    </style>
  </head>

  <body>
    <nav id="nav" class="navbar-root"></nav>

    <header class="homehead">
      <h1 class="ph748">${esc(post.shortTitle || post.title)}</h1>
      <p>${esc(post.subtitle || '')}</p>
    </header>

    <nav class="nv759" aria-label="Breadcrumb">
      <div class="nvl153">
        <a class="nvi751" href="/"><i class="fas fa-home"></i> Home</a>
        <span class="nvsep729"> / </span>
        <a class="nvi751" href="/blog/">Blog</a>
        <span class="nvsep729"> / </span>
        <span>${esc(post.shortTitle || post.title)}</span>
      </div>
    </nav>

    <main id="main-content">
      <article class="kb-article">
        <div class="kb-article-head">
          <h1>${esc(post.title)}</h1>
          <div class="kb-article-meta">
            <span><i class="far fa-calendar-alt"></i> ${esc(post.dateLabel)}</span>
            <span><i class="far fa-clock"></i> ${esc(post.readTime)} read</span>
            <span><i class="fas fa-tag"></i> ${esc(tags)}</span>
          </div>
        </div>

        <div class="kb-article-body">
          ${post.body}

          <div class="kb-author-box">
            <img src="/assets/brand/khudkibook-logo.png" alt="Khudkibook" />
            <div>
              <p style="font-size:0.9rem; font-weight:700; color:#111827; margin-bottom:2px;">Chauhan Priyanshu</p>
              <p>GTU engineering graduate. I build free study resources to help Diploma and BE students find syllabus, past papers and textbook links in one place. Follow on <a href="https://github.com/chauhanpriyanshu001" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
            </div>
          </div>
        </div>
      </article>
    </main>

    <footer id="footer"></footer>

    <script type="text/javascript" src="/ru444ts.js?v=2.1"></script>
    <script type="text/javascript" src="/ad-injector.js?v=2.1" defer></script>
  </body>
</html>
`;
}

const posts = [];
module.exports = { render, posts };

if (require.main === module) {
    const { POSTS } = require('./gen_blog_posts_content');
    for (const p of POSTS) {
        fs.writeFileSync(path.join(BLOG_DIR, `${p.slug}.html`), render(p));
        posts.push({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            date: p.date,
            category: p.category,
            readTime: p.readTime,
            tags: p.tags || []
        });
        console.log(`wrote /blog/${p.slug}`);
    }

    // Merge metadata into posts.json, newest first, without disturbing posts the
    // GTU monitor added (any slug we don't own is preserved as-is).
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8')); } catch (e) { existing = []; }
    if (!Array.isArray(existing)) existing = [];

    const ours = new Set(posts.map((p) => p.slug));
    const fresh = posts.map((p) => existing.find((e) => e.slug === p.slug) || p);
    const kept = existing.filter((e) => !ours.has(e.slug));
    const merged = [...fresh, ...kept].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    fs.writeFileSync(POSTS_JSON, JSON.stringify(merged, null, 2) + '\n');
    console.log(`posts.json updated (${merged.length} entries, ${fresh.length} from this script)`);
}
