/* ═══════════════════════════════════════════════════════════
   Primenest Reality — i18n Module
   Lightweight internationalization for vanilla HTML/JS
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGUAGES = {
    en: { label: 'English', icon: '🌐', dir: 'ltr', font: 'Inter' },
    fa: { label: '\u0641\u0627\u0631\u0633\u06CC', icon: '\uD83C\uDDEE\uD83C\uDDF7', dir: 'rtl', font: 'Vazirmatn' },
    ps: { label: '\u067E\u0634\u062A\u0648', icon: '\uD83C\uDDE6\uD83C\uDDEB', dir: 'rtl', font: 'Vazirmatn' }
  };
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'primenest_lang';
  var COOKIE_NAME = 'primenest_lang';
  var cache = {};
  var currentLang = null;
  var listeners = [];

  function setCookie(name, value, days) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + (days || 365) * 86400000);
      document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) { return null; }
  }

  function detectLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES[saved]) return saved;
    } catch (e) {}
    var cookie = getCookie(COOKIE_NAME);
    if (cookie && LANGUAGES[cookie]) return cookie;
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
    if (lang !== 'en') {
      loadFont(lang);
      document.documentElement.setAttribute('translate', 'no');
    } else {
      document.documentElement.removeAttribute('translate');
    }
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
      container.innerHTML = '';
      var currentInfo = LANGUAGES[currentLang] || LANGUAGES[DEFAULT_LANG];

      var btn = document.createElement('button');
      btn.className = 'lang-btn';
      btn.innerHTML = '<span class="lang-icon">' + currentInfo.icon + '</span> ' + currentInfo.label;
      btn.setAttribute('aria-label', 'Change language');
      btn.setAttribute('aria-expanded', 'false');

      var dropdown = document.createElement('div');
      dropdown.className = 'lang-dropdown';

      Object.keys(LANGUAGES).forEach(function (code) {
        var info = LANGUAGES[code];
        var option = document.createElement('button');
        option.className = 'lang-option' + (code === currentLang ? ' active' : '');
        option.innerHTML = '<span>' + info.label + '</span><span class="lang-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
        option.setAttribute('aria-label', 'Switch to ' + info.label);
        option.addEventListener('click', function (e) {
          e.stopPropagation();
          setLanguage(code);
          container.classList.remove('open');
        });
        dropdown.appendChild(option);
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        container.classList.toggle('open');
        btn.setAttribute('aria-expanded', container.classList.contains('open'));
      });

      container.appendChild(btn);
      container.appendChild(dropdown);
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.lang-switcher.open').forEach(function (el) {
        el.classList.remove('open');
      });
    });
  }

  function setLanguage(lang) {
    if (!LANGUAGES[lang]) lang = DEFAULT_LANG;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    setCookie(COOKIE_NAME, lang);
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
