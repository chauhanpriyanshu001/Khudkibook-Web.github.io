// kb-library.js — the personal library behind the logged-in experience.
// Keeps the things a student actually comes back for:
//   - saved subjects (bookmarks)
//   - recently viewed subjects ("continue where you left off")
//   - download history
//   - feed preferences (interests, branch/semester scope)
// Storage: localStorage first (instant, works before Firebase resolves) with a
// best-effort mirror to Firestore `users/{uid}/bookmarks` so the list can
// follow the student to another device.
//
// Loaded on every page through ru444ts.js. Self-injecting styles keep it
// independent from the page templates (same pattern as contribs.js).
(function () {
  'use strict';

  if (window.KBLib) return;

  var SAVED_KEY = 'kb_saved_v1';
  var RECENT_KEY = 'kb_recent_v1';
  var DL_KEY = 'kb_dl_v1';
  var PREFS_KEY = 'kb_prefs_v1';
  var MAX_RECENT = 40;
  var MAX_DOWNLOADS = 60;

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function asArray(v) { return Array.isArray(v) ? v : []; }
  function now() { return Date.now(); }

  var KBLib = {};

  // ---------------------------------------------------------------- saved ---
  KBLib.getSaved = function () { return asArray(read(SAVED_KEY, [])); };

  KBLib.setSaved = function (list) {
    write(SAVED_KEY, asArray(list));
    KBLib.syncSaved();
    KBLib.emit();
  };

  KBLib.isSaved = function (code) {
    if (!code) return false;
    var c = String(code).toUpperCase();
    return KBLib.getSaved().some(function (i) { return String(i.code || '').toUpperCase() === c; });
  };

  // Returns true when the subject ended up saved, false when it was removed.
  KBLib.toggleSave = function (item) {
    if (!item || !item.code) return false;
    var code = String(item.code).toUpperCase();
    var list = KBLib.getSaved();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].code || '').toUpperCase() === code) { idx = i; break; }
    }
    if (idx >= 0) {
      list.splice(idx, 1);
      KBLib.setSaved(list);
      return false;
    }
    list.unshift({
      code: item.code,
      name: item.name || '',
      url: item.url || '',
      branch: item.branch || '',
      sem: item.sem || '',
      savedAt: now()
    });
    KBLib.setSaved(list);
    return true;
  };

  KBLib.removeSaved = function (code) {
    var c = String(code || '').toUpperCase();
    var list = KBLib.getSaved().filter(function (i) { return String(i.code || '').toUpperCase() !== c; });
    KBLib.setSaved(list);
  };

  // ---------------------------------------------------------- recent views ---
  KBLib.getRecent = function () { return asArray(read(RECENT_KEY, [])); };

  KBLib.pushRecent = function (item) {
    if (!item || !item.code) return;
    var code = String(item.code).toUpperCase();
    var list = KBLib.getRecent().filter(function (i) { return String(i.code || '').toUpperCase() !== code; });
    list.unshift({
      code: item.code,
      name: item.name || '',
      url: item.url || '',
      branch: item.branch || '',
      sem: item.sem || '',
      at: now()
    });
    write(RECENT_KEY, list.slice(0, MAX_RECENT));
    KBLib.emit();
  };

  KBLib.clearRecent = function () { write(RECENT_KEY, []); KBLib.emit(); };

  // ------------------------------------------------------------ downloads ---
  KBLib.getDownloads = function () { return asArray(read(DL_KEY, [])); };

  KBLib.pushDownload = function (item) {
    if (!item) return;
    var list = KBLib.getDownloads();
    list.unshift({
      code: item.code || '',
      name: item.name || '',
      url: item.url || '',
      kind: item.kind || 'pdf',
      at: now()
    });
    write(DL_KEY, list.slice(0, MAX_DOWNLOADS));
    KBLib.emit();
  };

  // ---------------------------------------------------------------- prefs ---
  KBLib.getPrefs = function () {
    var p = read(PREFS_KEY, {});
    if (!p || typeof p !== 'object') p = {};
    if (!Array.isArray(p.interests)) p.interests = [];
    return p;
  };

  KBLib.setPrefs = function (patch) {
    var p = KBLib.getPrefs();
    Object.keys(patch || {}).forEach(function (k) { p[k] = patch[k]; });
    write(PREFS_KEY, p);
    KBLib.emit();
    return p;
  };

  KBLib.toggleInterest = function (id) {
    var p = KBLib.getPrefs();
    var list = p.interests.slice();
    var idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else list.push(id);
    return KBLib.setPrefs({ interests: list });
  };

  // ---------------------------------------------------------------- events ---
  var listeners = [];
  KBLib.onChange = function (fn) {
    if (typeof fn === 'function') listeners.push(fn);
  };
  KBLib.emit = function () {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* never break the page */ }
    });
  };
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('kb_') === 0) KBLib.emit();
  });

  // ------------------------------------------------------- firestore mirror ---
  function currentUser() {
    try {
      if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return null;
      return firebase.auth().currentUser || null;
    } catch (e) { return null; }
  }

  // Mirror the saved list into `users/{uid}/bookmarks`. Silently gives up when
  // the account is anonymous or the rules do not allow it — localStorage stays
  // the source of truth either way.
  KBLib.syncSaved = function () {
    var user = currentUser();
    if (!user) return;
    try {
      var col = firebase.firestore().collection('users').doc(user.uid).collection('bookmarks');
      var list = KBLib.getSaved();
      var codes = list.map(function (i) { return String(i.code); });
      col.get().then(function (snap) {
        snap.forEach(function (d) {
          if (codes.indexOf(d.id) === -1) d.ref.delete().catch(function () { });
        });
      }).catch(function () { });
      list.forEach(function (item) {
        col.doc(String(item.code)).set({
          code: item.code,
          name: item.name || '',
          url: item.url || '',
          branch: item.branch || '',
          sem: item.sem || '',
          savedAt: item.savedAt || now()
        }).catch(function () { });
      });
    } catch (e) { /* ignore */ }
  };

  // Pull bookmarks saved on another device (never removes local entries).
  KBLib.pullSaved = function () {
    var user = currentUser();
    if (!user) return;
    try {
      var col = firebase.firestore().collection('users').doc(user.uid).collection('bookmarks');
      col.get().then(function (snap) {
        if (snap.empty) return;
        var local = KBLib.getSaved();
        var seen = {};
        local.forEach(function (i) { seen[String(i.code).toUpperCase()] = true; });
        var added = 0;
        snap.forEach(function (d) {
          var data = d.data() || {};
          var code = data.code || d.id;
          if (!code || seen[String(code).toUpperCase()]) return;
          seen[String(code).toUpperCase()] = true;
          local.push({
            code: code,
            name: data.name || '',
            url: data.url || '',
            branch: data.branch || '',
            sem: data.sem || '',
            savedAt: data.savedAt || now()
          });
          added++;
        });
        if (added) {
          local.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
          write(SAVED_KEY, local);
          KBLib.emit();
        }
      }).catch(function () { });
    } catch (e) { /* ignore */ }
  };

  // --------------------------------------------------- subject page helper ---
  function subjectInfoFromPage() {
    var mount = document.querySelector('[data-subject-contribs]');
    if (!mount) return null;
    var code = (mount.getAttribute('data-subject-contribs') || '').trim();
    if (!code) return null;
    var nameEl = document.querySelector('main h1') || document.querySelector('h1');
    var name = nameEl ? (nameEl.textContent || '').trim() : '';
    if (!name) name = (document.title || '').split(' - ')[0].trim();
    var branch = '', sem = '';
    var badges = document.querySelectorAll('.badge-group .badge');
    for (var i = 0; i < badges.length; i++) {
      var t = (badges[i].textContent || '').trim();
      if (/^Semester\s*\d+/i.test(t)) sem = t;
      else if (!/^Code:/i.test(t) && !/^Credits:/i.test(t) && !/^Semester/i.test(t)) branch = t;
    }
    return { code: code, name: name, url: location.pathname, branch: branch, sem: sem };
  }

  function injectSaveButton(info) {
    if (document.getElementById('kb-save-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'kb-save-btn';
    btn.type = 'button';
    btn.className = 'kb-save-fab';
    btn.setAttribute('title', 'Save this subject to your dashboard');
    btn.innerHTML = '<i class="fas fa-bookmark"></i><span class="kb-save-fab-txt">Save</span>';
    btn.addEventListener('click', function () {
      var added = KBLib.toggleSave(info);
      paint();
      toast(added ? 'Saved to your dashboard' : 'Removed from saved');
    });
    document.body.appendChild(btn);
    paint();

    function paint() {
      var on = KBLib.isSaved(info.code);
      btn.classList.toggle('is-saved', on);
      btn.innerHTML = '<i class="fas fa-bookmark' + (on ? '' : '-regular') + '"></i>' +
        '<span class="kb-save-fab-txt">' + (on ? 'Saved' : 'Save') + '</span>';
    }
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'kb-lib-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      t.classList.add('kb-lib-toast-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 1600);
  }

  function initSubjectPage() {
    var info = subjectInfoFromPage();
    if (!info) return;
    injectStyles();
    injectSaveButton(info);
    KBLib.pushRecent(info);
  }

  function injectStyles() {
    if (document.getElementById('kb-lib-style')) return;
    var css =
      '.kb-save-fab{position:fixed;right:18px;bottom:18px;z-index:9990;display:inline-flex;align-items:center;gap:8px;' +
      'padding:11px 16px;border:none;border-radius:999px;cursor:pointer;font-family:Inter,sans-serif;font-size:.84rem;font-weight:700;' +
      'background:#fff;color:#CD5D33;border:1.5px solid #CD5D33;box-shadow:0 8px 24px rgba(74,60,50,.18);transition:transform .15s,background .15s,color .15s}' +
      '.kb-save-fab:hover{transform:translateY(-2px)}' +
      '.kb-save-fab.is-saved{background:linear-gradient(135deg,#CD5D33,#F0A66E);color:#fff;border-color:transparent}' +
      '.kb-lib-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9995;background:#0f172a;color:#fff;' +
      'font-family:Inter,sans-serif;font-size:.84rem;font-weight:600;padding:10px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(15,23,42,.3);' +
      'opacity:0;transition:opacity .2s,transform .2s}' +
      '.kb-lib-toast-out{opacity:0;transform:translateX(-50%) translateY(8px)}' +
      '@media(max-width:600px){.kb-save-fab{padding:10px 13px}.kb-save-fab-txt{display:none}}';
    var st = document.createElement('style');
    st.id = 'kb-lib-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- boot ---
  KBLib.version = '1.0';
  window.KBLib = KBLib;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubjectPage);
  } else {
    initSubjectPage();
  }
})();
