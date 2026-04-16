// ── Theme toggle (light / dark) ────────────────────────────────────────────
(function initTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('theme-toggle');

  // Light = 'teal', Dark = 'dark-teal'
  const LIGHT = 'teal';
  const DARK  = 'dark-teal';

  function isDark() {
    const t = html.getAttribute('data-theme');
    return t === 'dark' || t === 'dark-teal';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('portfolio-theme', theme);
    window._particleThemeChanged = true;
  }

  // Restore saved preference, default to light teal
  const saved = localStorage.getItem('portfolio-theme');
  applyTheme(saved && saved !== '' ? saved : LIGHT);

  btn && btn.addEventListener('click', () => {
    applyTheme(isDark() ? LIGHT : DARK);
  });
})();

// ── Nav border on scroll ────────────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Reveal sections on scroll ──────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Active nav link highlight ──────────────────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });

sections.forEach(s => navObserver.observe(s));

// ── Typewriter effect ──────────────────────────────────────────────────────
(function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const text = 'Data & AI Engineer · Toronto, Canada';
  let i = 0;

  function tick() {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, i < 6 ? 80 : 38);
  }

  // Start after hero fade-in delay
  setTimeout(tick, 600);
})();

// ── Particle canvas ────────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;
  let rgb = { r: 13, g: 148, b: 136 };

  function hexToRgb(hex) {
    hex = hex.trim();
    if (hex.length === 4) {
      // shorthand #abc
      hex = '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    }
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    return {
      r: parseInt(m[1].slice(0,2), 16),
      g: parseInt(m[1].slice(2,4), 16),
      b: parseInt(m[1].slice(4,6), 16)
    };
  }

  function readAccentColor() {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue('--ha').trim();
    const parsed = hexToRgb(val);
    if (parsed) rgb = parsed;
  }

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  class Particle {
    constructor() { this.reset(true); }

    reset(initial) {
      this.x = Math.random() * canvas.width;
      this.y = initial ? Math.random() * canvas.height : (Math.random() > 0.5 ? -10 : canvas.height + 10);
      this.vx = (Math.random() - 0.5) * 0.38;
      this.vy = (Math.random() - 0.5) * 0.38;
      this.r = Math.random() * 1.6 + 0.7;
      this.opacity = Math.random() * 0.4 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < -20 || this.x > canvas.width + 20) this.vx *= -1;
      if (this.y < -20 || this.y > canvas.height + 20) this.vy *= -1;
    }
  }

  function init() {
    resize();
    const count = Math.max(30, Math.min(60, Math.floor(canvas.width * canvas.height / 14000)));
    particles = Array.from({ length: count }, () => new Particle());
    readAccentColor();
  }

  const LINK_DIST = 130;

  function draw() {
    // Refresh color if theme changed
    if (window._particleThemeChanged) {
      readAccentColor();
      window._particleThemeChanged = false;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { r, g, b } = rgb;

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.13;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    particles.forEach(p => {
      p.update();
      ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    animId = requestAnimationFrame(draw);
  }

  // Pause when tab is hidden to save resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      draw();
    }
  });

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    init();
    draw();
  }, { passive: true });

  init();
  draw();
})();
