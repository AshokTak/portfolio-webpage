// Shared browser helpers for the hand-written pages of the site.
// Exposed as a `Site` global so both classic and module scripts can use it.
(function (global) {
  'use strict';

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const Site = {
    // Escapes text before it is dropped into an innerHTML template.
    escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
    },

    // Reads JSON from localStorage, falling back when absent or corrupt.
    readJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    },

    writeJSON(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage full or blocked — nothing to do */
      }
    },

    // YYYY-MM-DD in local time.
    dayKey(date) {
      const d = date || new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    // Adds `scrolled` to the nav once the page has moved past `offset`.
    initNavScroll(options) {
      const opts = options || {};
      const nav = document.querySelector(opts.selector || '#nav');
      if (!nav) return;
      const offset = opts.offset == null ? 20 : opts.offset;
      const update = () => nav.classList.toggle('scrolled', window.scrollY > offset);
      window.addEventListener('scroll', update, { passive: true });
      update();
    },

    // Adds a class to elements as they scroll into view.
    revealOnScroll(options) {
      const opts = options || {};
      const className = opts.className || 'visible';
      const once = opts.once !== false;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add(className);
          if (once) observer.unobserve(entry.target);
        });
      }, { threshold: opts.threshold == null ? 0.12 : opts.threshold, rootMargin: opts.rootMargin || '0px' });
      document.querySelectorAll(opts.selector || '.reveal').forEach((el) => observer.observe(el));
      return observer;
    },
  };

  global.Site = Site;
})(window);
