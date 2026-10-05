/**
 * Khudkibook Universal Ad Injector (ad-injector.js)
 * -------------------------------------------------------------
 * High-performing, AdSense Policy-Compliant, Zero CLS Ad Placements.
 * Easily customize, toggle, or update slot IDs from this single configuration.
 */

(function () {
  'use strict';

  // Global AdSense Placement Configuration
  var AD_CONFIG = {
    // Ads are back on now that placement is unified: every ad unit on the site
    // comes from injectAds() below, so pageHasPublishableContent() is the single
    // gate deciding where ads may appear. Before this, 110 pages carried
    // hardcoded <ins> slots that pushed at parse time and ignored that gate.
    enabled: true,
    client: 'ca-pub-4211827566541334', // Your AdSense Publisher ID
    debug: false, // Set to true to log injection events in browser console
    lazyLoad: true, // Use IntersectionObserver to lazy load ads on scroll
    // Serve ads only where the page actually has content to monetise. See
    // pageHasPublishableContent() for what counts.
    guardContent: true,
    // The self-study books are labelled "AI-generated study material" in their
    // own <title> and <h1>. Google's "automatically generated content" guidance
    // is that such pages need manual review before they carry ads, so they are
    // excluded too. Flip to false once each one has been read and signed off.
    guardAiGenerated: true,
    slots: {
      // 1. Top High-Viewability Leaderboard (Desktop / Tablet only)
      topLeaderboard: {
        enabled: true,
        disableOnMobile: true, // Turn OFF on mobile (< 768px) to preserve UX
        slotId: '4067607591',
        format: 'auto',
        minHeight: '90px',
        className: 'ad-leaderboard'
      },
      // 2. In-Content Slot (Between content sections / before recommendations)
      inContent: {
        enabled: true,
        slotId: '4067607591',
        format: 'auto',
        minHeight: '250px',
        className: 'ad-in-content'
      },
      // 3. Bottom Pre-Footer Slot (High viewability at bottom of page)
      bottomBanner: {
        enabled: true,
        slotId: '4067607591',
        format: 'auto',
        minHeight: '90px',
        className: 'ad-bottom-banner'
      }
    }
  };

  /**
   * Helper to create standard AdSense container elements
   */
  function createAdElement(slotKey, config) {
    var wrapper = document.createElement('div');
    wrapper.className = 'ad-slot-wrapper ' + (slotKey === 'topLeaderboard' ? 'ad-top-wrapper ' : '') + 'kb-ad-' + slotKey;
    wrapper.setAttribute('data-ad-slot-name', slotKey);

    var label = document.createElement('span');
    label.className = 'ad-label';
    label.textContent = 'Advertisement';

    var container = document.createElement('div');
    container.className = 'ad-container ' + (config.className || '');
    if (config.minHeight) {
      container.style.minHeight = config.minHeight;
    }

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.style.textAlign = 'center';
    ins.setAttribute('data-ad-client', AD_CONFIG.client);
    ins.setAttribute('data-ad-slot', config.slotId || 'auto');
    ins.setAttribute('data-ad-format', config.format || 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    container.appendChild(ins);
    wrapper.appendChild(label);
    wrapper.appendChild(container);

    return { wrapper: wrapper, ins: ins };
  }

  /**
   * Load the AdSense library, once, on demand.
   *
   * `public/templates/base.html` loads this file but deliberately does NOT load
   * pagead/js/adsbygoogle.js itself, and the hand-written pages (about, contact,
   * ddcet, papers, syllabus) used to carry their own <script> tag for it. Pushing
   * to a window.adsbygoogle queue with no library behind it renders nothing, so
   * ownership of the tag belongs here, next to the code that pushes.
   *
   * It is fetched on first push rather than at load, so a page that fails
   * pageHasPublishableContent() costs no AdSense request at all.
   */
  var libraryRequested = false;

  function ensureLibrary() {
    if (libraryRequested) return;
    if (document.querySelector('script[src*="pagead/js/adsbygoogle.js"]')) {
      libraryRequested = true;
      return;
    }
    libraryRequested = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + AD_CONFIG.client;
    document.head.appendChild(s);
  }

  /**
   * Safely trigger AdSense push
   */
  function pushAd(insElement) {
    if (!insElement) return;
    // Check if element is hidden or has 0 width (prevents AdSense TagError: No slot size for availableWidth=0)
    if (insElement.offsetParent === null || insElement.offsetWidth === 0) {
      if (AD_CONFIG.debug) console.log('[AdInjector] Skipping push on hidden element');
      return;
    }
    if (insElement.getAttribute('data-adsbygoogle-status')) {
      return; // Already pushed
    }
    ensureLibrary();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      if (AD_CONFIG.debug) {
        console.log('[AdInjector] Successfully pushed ad unit:', insElement);
      }
    } catch (err) {
      if (AD_CONFIG.debug) {
        console.warn('[AdInjector] AdSense push notice:', err);
      }
    }
  }

  /**
   * Lazy load ads with IntersectionObserver for optimal Core Web Vitals
   */
  function observeAndPush(insElement) {
    if (!insElement) return;
    if (insElement.offsetParent === null || insElement.offsetWidth === 0) {
      return; // Hidden element
    }
    if (!AD_CONFIG.lazyLoad || !('IntersectionObserver' in window)) {
      pushAd(insElement);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.target.offsetWidth > 0) {
          pushAd(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '300px 0px' });

    observer.observe(insElement);
  }

  /**
   * Is there anything on this page worth putting an ad next to?
   *
   * AdSense does not allow ads on "screens without publisher-content or with
   * low-value content", and a subject page for a subject we have not scanned
   * yet is exactly that: a title, a breadcrumb, a Syllabus button and two
   * "Coming Soon" empty states wrapped around ~96 words of boilerplate. Serving
   * a leaderboard and two more slots there is what drew the low value content
   * finding, so those pages get no ad units at all.
   *
   * The three rules, in order:
   *
   *  1. Never place ads on a page the build marked `noindex`. The build already
   *     decided the page has nothing worth showing a reader, so it has nothing
   *     worth showing an advertiser either. This also covers 404s and the stale
   *     artifacts swept by scripts/noindex_orphans.js, which no structural check
   *     here would otherwise recognise.
   *  2. A subject page offering neither a textbook nor question papers is an
   *     empty stub. Mirrors `isThinPlaceholder()` in scripts/lib/seo.js.
   *  3. Self-declared AI study material is held back until reviewed.
   *
   * Rules 1 and 2 answer the same question as each other, so they must be
   * changed together.
   */
  function pageHasPublishableContent() {
    var robotsMeta = document.querySelector('meta[name="robots"]');
    if (robotsMeta && /noindex/i.test(robotsMeta.getAttribute('content') || '')) return false;

    // `base.html` renders <main id="main-content">; some pages still on disk
    // predate that and carry a bare <main>, so fall back to the tag name.
    var main = document.getElementById('main-content') || document.querySelector('main');
    // Not a generated subject page (homepage, blog post, notices, search).
    // Those carry their own content; nothing here to judge.
    if (!main || !main.querySelector('.materials-section')) return true;

    var noBook = false;
    var noPapers = false;
    var buttons = main.querySelectorAll('.materials-section .mdbtn');
    for (var i = 0; i < buttons.length; i++) {
      var label = buttons[i].textContent || '';
      if (!/\(Soon\)/i.test(label)) continue;
      if (/book/i.test(label)) noBook = true;
      if (/paper/i.test(label)) noPapers = true;
    }

    // A subject with neither a textbook nor question papers is an empty stub.
    if (noBook && noPapers) return false;

    if (AD_CONFIG.guardAiGenerated && /AI-generated study material/i.test(document.title || '')) {
      return false;
    }
    return true;
  }

  /**
   * Initialize and place ad units across existing DOM anchors
   */
  function injectAds() {
    if (!AD_CONFIG.enabled) return;

    if (AD_CONFIG.guardContent && !pageHasPublishableContent()) {
      if (AD_CONFIG.debug) console.log('[AdInjector] Skipped: no publisher content on this page');
      return;
    }

    var isMobile = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) <= 768;

    // If on mobile and top ad is disabled, remove or hide any top ads from DOM immediately
    if (isMobile && AD_CONFIG.slots.topLeaderboard.disableOnMobile) {
      var staticTopWrappers = document.querySelectorAll('.ad-top-wrapper, .kb-ad-topLeaderboard, .ad-slot-wrapper:has(.ad-leaderboard)');
      staticTopWrappers.forEach(function (el) {
        el.style.display = 'none';
      });
    }

    // Check if existing static ads are already on page and hydrate them if needed (skip top on mobile)
    var existingIns = document.querySelectorAll('.ad-container > ins.adsbygoogle:not([data-adsbygoogle-status])');
    existingIns.forEach(function (ins) {
      var parentTop = ins.closest('.ad-top-wrapper, .kb-ad-topLeaderboard, .ad-leaderboard');
      if (isMobile && parentTop && AD_CONFIG.slots.topLeaderboard.disableOnMobile) {
        return; // Don't load on mobile
      }
      observeAndPush(ins);
    });

    // 1. Top Leaderboard Injection (Desktop / Tablet only)
    if (AD_CONFIG.slots.topLeaderboard.enabled && (!isMobile || !AD_CONFIG.slots.topLeaderboard.disableOnMobile)) {
      if (!document.querySelector('.kb-ad-topLeaderboard') && !document.querySelector('.ad-leaderboard')) {
        var topAnchor = document.querySelector('nav.nv759') || 
                         document.querySelector('.homehead') || 
                         document.querySelector('.hero-banner');
        if (topAnchor && topAnchor.parentNode) {
          var topAd = createAdElement('topLeaderboard', AD_CONFIG.slots.topLeaderboard);
          topAnchor.parentNode.insertBefore(topAd.wrapper, topAnchor.nextSibling);
          observeAndPush(topAd.ins);
        }
      }
    }

    // 2. In-Content Slot Injection
    if (AD_CONFIG.slots.inContent.enabled && !document.querySelector('.kb-ad-inContent') && !document.querySelector('.ad-in-content')) {
      var inContentAnchor = document.querySelector('.rec-module') || 
                            document.querySelector('#sem-cards') || 
                            document.querySelector('.feature-grid') || 
                            document.querySelector('#mainbooks') || 
                            document.querySelector('.sydrp');
      if (inContentAnchor && inContentAnchor.parentNode) {
        var midAd = createAdElement('inContent', AD_CONFIG.slots.inContent);
        inContentAnchor.parentNode.insertBefore(midAd.wrapper, inContentAnchor);
        observeAndPush(midAd.ins);
      }
    }

    // 3. Bottom Banner Injection (Above footer)
    if (AD_CONFIG.slots.bottomBanner.enabled && !document.querySelector('.kb-ad-bottomBanner') && !document.querySelector('.ad-bottom-banner')) {
      var footerAnchor = document.querySelector('#footer') || document.querySelector('footer');
      if (footerAnchor && footerAnchor.parentNode) {
        var bottomAd = createAdElement('bottomBanner', AD_CONFIG.slots.bottomBanner);
        footerAnchor.parentNode.insertBefore(bottomAd.wrapper, footerAnchor);
        observeAndPush(bottomAd.ins);
      }
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAds);
  } else {
    injectAds();
  }

  // Auto-sanitize third-party (e.g. AdSense) aria-hidden on <body> to resolve Chrome A11y warning
  if (typeof MutationObserver !== 'undefined') {
    var sanitizeBodyAria = function () {
      if (document.body && document.body.hasAttribute('aria-hidden')) {
        document.body.removeAttribute('aria-hidden');
      }
    };
    var bodyObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'attributes' && mutations[i].attributeName === 'aria-hidden') {
          sanitizeBodyAria();
          break;
        }
      }
    });
    if (document.body) {
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['aria-hidden'] });
      sanitizeBodyAria();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['aria-hidden'] });
        sanitizeBodyAria();
      });
    }
  }

  // Expose configuration for dynamic inspection / customization
  window.KB_AdInjector = {
    config: AD_CONFIG,
    createAd: createAdElement,
    pushAd: pushAd,
    reload: injectAds
  };
})();
