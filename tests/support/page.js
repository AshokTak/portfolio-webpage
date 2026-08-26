import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { instrument, collectFrom } from './instrument.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function repoPath(relative) {
  return path.join(ROOT, relative);
}

export function readRepoFile(relative) {
  return readFileSync(repoPath(relative), 'utf8');
}

const SCRIPT_TAG = /<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;

/**
 * Prepares a page for jsdom: `type="module"` scripts become classic scripts
 * (jsdom has no ES module loader) and every inline script is instrumented so
 * executing the page reports coverage. Data blocks (JSON-LD) and external
 * scripts are left alone.
 */
function preparePage(html, pageName) {
  let index = 0;
  return html.replace(SCRIPT_TAG, (match, attrs, body) => {
    if (/\ssrc=/.test(attrs)) return match;
    if (/data-instrumented/.test(attrs)) return `<script>${body}</script>`;
    if (/data-fixture/.test(attrs)) return match;
    if (/type="(?!module|text\/javascript)/.test(attrs)) return match;
    index += 1;
    return `<script>${instrument(body, `${pageName}#script${index}`)}</script>`;
  });
}

/**
 * Replaces the window timers with a virtual clock driven by `window.__advance(ms)`.
 * jsdom timers are not affected by vitest's fake timers, so pages that schedule
 * work with setTimeout need this to be tested deterministically.
 */
function stubTimers(window) {
  let now = 0;
  let nextId = 1;
  let pending = [];

  window.setTimeout = (fn, delay = 0) => {
    const id = nextId++;
    pending.push({ id, fn, at: now + delay });
    return id;
  };
  window.setInterval = window.setTimeout;
  window.clearTimeout = id => { pending = pending.filter(t => t.id !== id); };
  window.clearInterval = window.clearTimeout;

  window.__advance = ms => {
    const until = now + ms;
    let due = pending.filter(t => t.at <= until).sort((a, b) => a.at - b.at);
    while (due.length) {
      const timer = due[0];
      pending = pending.filter(t => t !== timer);
      now = timer.at;
      timer.fn();
      due = pending.filter(t => t.at <= until).sort((a, b) => a.at - b.at);
    }
    now = until;
  };
}

function stubBrowserApis(window) {
  class ObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      window.__observers.push(this);
    }
    observe(el) { this.observed.push(el); }
    unobserve(el) { this.observed = this.observed.filter(o => o !== el); }
    disconnect() { this.observed = []; }
    /** Test helper: fire the observer callback for the given elements. */
    trigger(elements, isIntersecting = true) {
      this.callback(
        (elements ?? this.observed).map(target => ({ target, isIntersecting })),
        this
      );
    }
  }

  window.__observers = [];
  window.IntersectionObserver = ObserverStub;
  window.ResizeObserver = ObserverStub;

  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};

  // Share/clipboard actions are recorded instead of performed.
  window.__opened = [];
  window.open = (url, target) => { window.__opened.push({ url, target }); return null; };
  window.__clipboard = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText(text) {
        window.__clipboard.push(text);
        // Errors thrown by the page's own continuation are swallowed rather
        // than surfacing as unhandled rejections in the test runner.
        return { then: cb => Promise.resolve().then(cb).catch(() => {}) };
      }
    }
  });

  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.speechSynthesis = { speak() {}, cancel() {} };
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() {
      const node = { frequency: {}, type: '', connect: () => node, start() {}, stop() {} };
      return node;
    }
    createGain() {
      const node = { gain: { value: 0, exponentialRampToValueAtTime() {} }, connect: () => node };
      return node;
    }
  };

  // jsdom has no canvas implementation: hand out a context whose drawing calls
  // are no-ops so animation code can run unmodified.
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    const gradient = { addColorStop() {} };
    const noop = () => undefined;
    const overrides = {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      createPattern: () => null,
      measureText: () => ({ width: 0 }),
      getImageData: () => ({ data: [] })
    };
    return new Proxy(overrides, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      },
      set() { return true; }
    });
  };
}

/**
 * Loads a page from the repository into jsdom and runs its inline scripts.
 * Returns the jsdom window, which exposes any globals the page declares.
 */
export function loadPage(relative, { url = 'https://ashoktak.com/', html, seed, virtualTimers = true } = {}) {
  let markup = html ?? readRepoFile(relative);
  if (seed) {
    const fixture = seedStorageScript(seed);
    markup = markup.includes('<head>')
      ? markup.replace('<head>', `<head>${fixture}`)
      : fixture + markup;
  }
  const source = preparePage(markup, relative);
  const dom = new JSDOM(source, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: false,
    beforeParse: window => {
      stubBrowserApis(window);
      if (virtualTimers) stubTimers(window);
    }
  });
  collectFrom(dom.window);
  return dom.window;
}

/**
 * Runs a standalone script file (e.g. app.js) against the given markup.
 */
export function loadScriptWithMarkup(scriptRelative, bodyHtml, options = {}) {
  const script = instrument(readRepoFile(scriptRelative), scriptRelative);
  const html = `<!doctype html><html><head></head><body>${bodyHtml}`
    + `<script data-instrumented>${script}<\/script></body></html>`;
  return loadPage(scriptRelative, { ...options, html });
}

/**
 * Seeds localStorage before the page scripts run, so pages that read stored
 * state on load can be tested.
 */
export function seedStorageScript(entries) {
  const literal = value => JSON.stringify(value).replace(/<\//g, '<\\/');
  const pairs = Object.entries(entries)
    .map(([k, v]) => `localStorage.setItem(${literal(k)}, ${literal(v)});`)
    .join('');
  return `<script data-fixture>${pairs}<\/script>`;
}

export function observerFor(window, index = 0) {
  return window.__observers[index];
}
