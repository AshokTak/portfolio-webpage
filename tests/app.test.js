import { describe, it, expect } from 'vitest';
import { loadScriptWithMarkup, observerFor, seedStorageScript } from './support/page.js';

const MARKUP = `
  <nav id="nav"></nav>
  <button id="theme-toggle">theme</button>
  <span id="typewriter"></span>
  <canvas id="particle-canvas"></canvas>
  <section id="about" class="reveal"></section>
  <section id="work" class="reveal"></section>
  <div class="nav-links"><a href="#about">About</a><a href="#work">Work</a></div>
`;

function load(options) {
  return loadScriptWithMarkup('app.js', MARKUP, options);
}

describe('theme toggle', () => {
  it('defaults to light teal and persists the choice', () => {
    const window = load();
    expect(window.document.documentElement.getAttribute('data-theme')).toBe('teal');
    expect(window.localStorage.getItem('portfolio-theme')).toBe('teal');
  });

  it('toggles between light and dark on click', () => {
    const window = load();
    const html = window.document.documentElement;
    const btn = window.document.getElementById('theme-toggle');

    btn.click();
    expect(html.getAttribute('data-theme')).toBe('dark-teal');
    expect(window.localStorage.getItem('portfolio-theme')).toBe('dark-teal');
    expect(window._particleThemeChanged).toBe(true);

    btn.click();
    expect(html.getAttribute('data-theme')).toBe('teal');
  });

  it('restores a saved preference', () => {
    const window = loadScriptWithMarkup(
      'app.js',
      seedStorageScript({ 'portfolio-theme': 'dark-teal' }) + MARKUP
    );
    expect(window.document.documentElement.getAttribute('data-theme')).toBe('dark-teal');
  });

  it('falls back to light when the stored preference is empty', () => {
    const window = loadScriptWithMarkup(
      'app.js',
      seedStorageScript({ 'portfolio-theme': '' }) + MARKUP
    );
    expect(window.document.documentElement.getAttribute('data-theme')).toBe('teal');
  });
});

describe('nav border on scroll', () => {
  it('adds the scrolled class past 20px and removes it back at the top', () => {
    const window = load();
    const nav = window.document.getElementById('nav');

    window.scrollY = 100;
    window.dispatchEvent(new window.Event('scroll'));
    expect(nav.classList.contains('scrolled')).toBe(true);

    window.scrollY = 0;
    window.dispatchEvent(new window.Event('scroll'));
    expect(nav.classList.contains('scrolled')).toBe(false);
  });
});

describe('scroll reveal and active nav link', () => {
  it('marks intersecting reveal sections visible', () => {
    const window = load();
    const reveal = observerFor(window, 0);
    const sections = [...window.document.querySelectorAll('.reveal')];

    reveal.trigger(sections, false);
    expect(sections.every(s => s.classList.contains('visible'))).toBe(false);

    reveal.trigger(sections, true);
    expect(sections.every(s => s.classList.contains('visible'))).toBe(true);
  });

  it('highlights the nav link matching the visible section', () => {
    const window = load();
    const navObserver = observerFor(window, 1);
    const [aboutLink, workLink] = window.document.querySelectorAll('.nav-links a');

    navObserver.trigger([window.document.getElementById('work')], true);
    expect(workLink.classList.contains('active')).toBe(true);
    expect(aboutLink.classList.contains('active')).toBe(false);

    navObserver.trigger([window.document.getElementById('about')], true);
    expect(aboutLink.classList.contains('active')).toBe(true);
    expect(workLink.classList.contains('active')).toBe(false);
  });
});

describe('typewriter', () => {
  it('types the tagline one character at a time after the hero delay', () => {
    const window = load();
    const el = window.document.getElementById('typewriter');
    expect(el.textContent).toBe('');

    window.__advance(600);
    expect(el.textContent).toBe('D');

    window.__advance(5000);
    expect(el.textContent).toBe('Data & AI Engineer · Toronto, Canada');
  });
});

describe('particle canvas', () => {
  it('repaints on resize and pauses while the tab is hidden', () => {
    const window = load();
    let frames = 0;
    window.requestAnimationFrame = () => ++frames;

    window.dispatchEvent(new window.Event('resize'));
    expect(frames).toBeGreaterThan(0);

    const before = frames;
    Object.defineProperty(window.document, 'hidden', { value: true, configurable: true });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    expect(frames).toBe(before);

    Object.defineProperty(window.document, 'hidden', { value: false, configurable: true });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    expect(frames).toBeGreaterThan(before);
  });
});
