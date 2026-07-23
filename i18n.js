/* ═══════════════════════════════════════════════════════════
   Primenest Reality — i18n Module
   Lightweight internationalization for vanilla HTML/JS
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGUAGES = {
    en: { label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8', dir: 'ltr', font: 'Inter' },
    fa: { label: '\u0641\u0627\u0631\u0633\u06CC', flag: '\uD83C\uDDEE\uD83C\uDDF7', dir: 'rtl', font: 'Vazirmatn' },
    ps: { label: '\u067E\u0634\u062A\u0648', flag: '\uD83C\uDDE6\uD83C\uDDEB', dir: 'rtl', font: 'Vazirmatn' }
  };
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'primenest_lang';
  var cache = {};
  var currentLang = null;
  var listeners = [];

  function detectLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES[saved]) return saved;
    } catch (e) {}
    var browser = (navigator.language || '').slice(0, 2).toLowerCase();
    if (browser === 'fa') return 'fa';
    if (browser === 'ps') return 'ps';
    return DEFAULT_LANG;
  }

  function getNestedValue(obj, path) {
    var keys = path.split('.');
    var val = obj;
    for (var i = 0; i < keys.length; i++) {
      if (val == null || typeof val !== 'object') return null;
      val = val[keys[i]];
    }
    return val != null ? val : null;
  }

  function t(key, params) {
    if (!cache[currentLang]) return key;
    var val = getNestedValue(cache[currentLang], key);
    if (val == null) {
      var enVal = getNestedValue(cache[DEFAULT_LANG], key);
      if (enVal != null) val = enVal;
      else return key;
    }
    if (params && typeof val === 'string') {
      Object.keys(params).forEach(function (k) {
        val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return val;
  }

  function setDir(dir) {
    document.documentElement.setAttribute('dir', dir);
  }

  function setLangAttribute(lang) {
    document.documentElement.setAttribute('lang', lang);
  }

  function loadFont(lang) {
    if (lang === 'en') return;
    if (document.querySelector('link[data-i18n-font="' + lang + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.i18nFont = lang;
    link.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function applyTranslations() {
    var lang = currentLang;
    var info = LANGUAGES[lang] || LANGUAGES[DEFAULT_LANG];
    setDir(info.dir);
    setLangAttribute(lang);
    if (lang !== 'en') loadFont(lang);
    document.body.style.fontFamily = "'" + info.font + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== key) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val !== key) el.placeholder = val;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var val = t(key);
      if (val !== key) el.setAttribute('aria-label', val);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var val = t(key);
      if (val !== key) el.title = val;
    });

    var titleVal = t('seo.title');
    if (titleVal !== 'seo.title') document.title = titleVal;

    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      var descVal = t('seo.description');
      if (descVal !== 'seo.description') metaDesc.setAttribute('content', descVal);
    }
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      var ogDescVal = t('seo.ogDescription');
      if (ogDescVal !== 'seo.ogDescription') ogDesc.setAttribute('content', ogDescVal);
    }
  }

  function updateLanguageSwitcher() {
    document.querySelectorAll('.lang-switcher').forEach(function (container) {
      var currentActive = container.querySelector('.lang-btn.active');
      var currentCode = currentActive ? currentActive.dataset.lang : null;
      container.innerHTML = '';
      Object.keys(LANGUAGES).forEach(function (code) {
        var info = LANGUAGES[code];
        var btn = document.createElement('button');
        btn.className = 'lang-btn' + (code === currentLang ? ' active' : '');
        btn.dataset.lang = code;
        btn.innerHTML = '<span class="lang-flag">' + info.flag + '</span> <span class="lang-label">' + info.label + '</span>';
        btn.setAttribute('aria-label', 'Switch to ' + info.label);
        btn.addEventListener('click', function () { setLanguage(code); });
        container.appendChild(btn);
      });
    });
  }

  function setLanguage(lang) {
    if (!LANGUAGES[lang]) lang = DEFAULT_LANG;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyTranslations();
    updateLanguageSwitcher();
    listeners.forEach(function (fn) {
      try { fn(lang); } catch (e) { console.error('i18n listener error:', e); }
    });
  }

  function onLanguageChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function getLanguage() {
    return currentLang || DEFAULT_LANG;
  }

  function isRTL() {
    return LANGUAGES[currentLang] && LANGUAGES[currentLang].dir === 'rtl';
  }

  async function loadTranslations(lang) {
    if (cache[lang]) return cache[lang];
    try {
      var base = document.querySelector('base');
      var prefix = (base && base.getAttribute('href')) || '';
      var res = await fetch(prefix + '/locales/' + lang + '.json');
      if (!res.ok) throw new Error('Failed to load ' + lang);
      cache[lang] = await res.json();
      return cache[lang];
    } catch (e) {
      console.error('i18n: Failed to load', lang, e);
      if (lang !== DEFAULT_LANG) return loadTranslations(DEFAULT_LANG);
      return {};
    }
  }

  async function init() {
    currentLang = detectLanguage();
    await loadTranslations(DEFAULT_LANG);
    if (currentLang !== DEFAULT_LANG) await loadTranslations(currentLang);
    applyTranslations();
    updateLanguageSwitcher();
    document.body.classList.add('i18n-ready');
  }

  window.i18n = {
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    isRTL: isRTL,
    onLanguageChange: onLanguageChange,
    init: init,
    LANGUAGES: LANGUAGES,
    loadTranslations: loadTranslations
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
