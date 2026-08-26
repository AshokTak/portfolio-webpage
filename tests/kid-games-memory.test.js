import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'kid-games/memory/index.html';
const ROUND_INTRO_MS = 1800;

function start(seed) {
  const window = loadPage(PAGE, { seed });
  window.document.getElementById('startBtn').click();
  window.__advance(ROUND_INTRO_MS);
  return window;
}

function cards(window) {
  return [...window.document.querySelectorAll('#grid .card')];
}

/** Clicks both cards of every pair, resolving each match. */
function completeRound(window) {
  const byName = new Map();
  cards(window).forEach(card => {
    const group = byName.get(card.dataset.name) ?? [];
    group.push(card);
    byName.set(card.dataset.name, group);
  });
  for (const [, pair] of byName) {
    pair[0].click();
    pair[1].click();
    window.__advance(400);
  }
}

describe('starting a game', () => {
  it('announces the round then deals four pairs', () => {
    const window = loadPage(PAGE);
    window.document.getElementById('startBtn').click();

    expect(window.document.getElementById('startOverlay').classList.contains('hidden')).toBe(true);
    expect(window.document.getElementById('roundOverlay').classList.contains('hidden')).toBe(false);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 1 of 5');
    expect(cards(window)).toHaveLength(0);

    window.__advance(ROUND_INTRO_MS);
    expect(window.document.getElementById('roundOverlay').classList.contains('hidden')).toBe(true);

    const dealt = cards(window);
    expect(dealt).toHaveLength(8);
    expect(new Set(dealt.map(c => c.dataset.name)).size).toBe(4);
    expect(window.document.getElementById('stars').textContent).toBe('Round 1 / 5');
    expect(window.document.getElementById('themeTitle').textContent).toBeTruthy();
  });

  it('reshuffles the board when reset is pressed', () => {
    const window = start();
    const before = cards(window).map(c => c.dataset.name);

    window.document.getElementById('reset').click();
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 1 of 5');
    window.__advance(ROUND_INTRO_MS);

    expect(cards(window)).toHaveLength(before.length);
  });
});

describe('flipping cards', () => {
  it('keeps a matching pair face up and marks it matched', () => {
    const window = start();
    const [a] = cards(window);
    const b = cards(window).find(c => c !== a && c.dataset.name === a.dataset.name);

    a.click();
    expect(a.classList.contains('flipped')).toBe(true);

    b.click();
    window.__advance(400);

    expect([a, b].every(c => c.classList.contains('matched'))).toBe(true);
    expect([a, b].some(c => c.classList.contains('flipped'))).toBe(false);
  });

  it('shakes a mismatched pair and flips it back', () => {
    const window = start();
    const [a] = cards(window);
    const b = cards(window).find(c => c.dataset.name !== a.dataset.name);

    a.click();
    b.click();
    expect([a, b].every(c => c.classList.contains('shake'))).toBe(true);

    // The board is locked while the mismatch is on show.
    const c = cards(window).find(card => card !== a && card !== b);
    c.click();
    expect(c.classList.contains('flipped')).toBe(false);

    window.__advance(1100);
    expect([a, b].some(card => card.classList.contains('flipped') || card.classList.contains('shake'))).toBe(false);

    c.click();
    expect(c.classList.contains('flipped')).toBe(true);
  });

  it('ignores repeat clicks on the same or an already matched card', () => {
    const window = start();
    const [a] = cards(window);

    a.click();
    a.click();
    const b = cards(window).find(c => c !== a && c.dataset.name === a.dataset.name);
    b.click();
    window.__advance(400);

    a.click();
    expect(a.classList.contains('flipped')).toBe(false);
    expect(a.classList.contains('matched')).toBe(true);
  });
});

describe('finishing rounds', () => {
  it('moves on to the next round once every pair is found', () => {
    const window = start();
    completeRound(window);

    expect(window.document.getElementById('stars').textContent).toBe('⭐⭐⭐');
    expect(window.localStorage.getItem('kidgames:memory:total')).toBeNull();

    window.__advance(1500);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 2 of 5');
    window.__advance(ROUND_INTRO_MS);
    expect(cards(window)).toHaveLength(8);
  });

  it('records the play and celebrates after the final round', () => {
    const window = start();
    for (let round = 0; round < 5; round++) {
      completeRound(window);
      window.__advance(1500 + ROUND_INTRO_MS);
    }

    const today = new Date().toISOString().slice(0, 10);
    expect(window.localStorage.getItem('kidgames:memory:total')).toBe('1');
    expect(JSON.parse(window.localStorage.getItem('kidgames:memory:days'))).toEqual({ [today]: 1 });
    expect(window.document.getElementById('finishOverlay').classList.contains('hidden')).toBe(false);
  });

  it('adds to an existing history and keeps only the last 30 days', () => {
    const days = {};
    for (let i = 0; i < 40; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i - 1);
      days[d.toISOString().slice(0, 10)] = 1;
    }
    const window = start({
      'kidgames:memory:total': '12',
      'kidgames:memory:days': JSON.stringify(days)
    });

    for (let round = 0; round < 5; round++) {
      completeRound(window);
      window.__advance(1500 + ROUND_INTRO_MS);
    }

    const stored = JSON.parse(window.localStorage.getItem('kidgames:memory:days'));
    const today = new Date().toISOString().slice(0, 10);
    expect(window.localStorage.getItem('kidgames:memory:total')).toBe('13');
    expect(Object.keys(stored)).toHaveLength(30);
    expect(stored[today]).toBe(1);
  });
});
