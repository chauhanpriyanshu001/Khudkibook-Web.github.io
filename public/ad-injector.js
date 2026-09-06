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
    enabled: true,
    client: 'ca-pub-4211827566541334', // Your AdSense Publisher ID
    debug: false, // Set to true to log injection events in browser console
    lazyLoad: true, // Use IntersectionObserver to lazy load ads on scroll
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
   * Initialize and place ad units across existing DOM anchors
   */
  function injectAds() {
    if (!AD_CONFIG.enabled) return;

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
