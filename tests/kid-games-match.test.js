import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'kid-games/match/index.html';
const ROUND_INTRO_MS = 1800;

function start(seed) {
  const window = loadPage(PAGE, { seed });
  window.document.getElementById('startBtn').click();
  window.__advance(ROUND_INTRO_MS);
  return window;
}

function tiles(window) {
  return [...window.document.querySelectorAll('#grid .tile')];
}

function completeRound(window) {
  const byName = new Map();
  tiles(window).forEach(tile => {
    const group = byName.get(tile.dataset.name) ?? [];
    group.push(tile);
    byName.set(tile.dataset.name, group);
  });
  for (const [, pair] of byName) {
    pair[0].click();
    pair[1].click();
  }
}

describe('starting a game', () => {
  it('shows the round intro then lays out four pairs of tiles', () => {
    const window = loadPage(PAGE);
    window.document.getElementById('startBtn').click();

    expect(window.document.getElementById('roundOverlay').classList.contains('hidden')).toBe(false);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 1 of 5');

    window.__advance(ROUND_INTRO_MS);

    const laid = tiles(window);
    expect(laid).toHaveLength(8);
    expect(new Set(laid.map(t => t.dataset.name)).size).toBe(4);
    expect(window.document.getElementById('stars').textContent).toBe('Round 1 / 5');
  });
});

describe('selecting tiles', () => {
  it('marks a matching pair as matched', () => {
    const window = start();
    const [a] = tiles(window);
    const b = tiles(window).find(t => t !== a && t.dataset.name === a.dataset.name);

    a.click();
    expect(a.classList.contains('selected')).toBe(true);

    b.click();
    expect([a, b].every(t => t.classList.contains('matched'))).toBe(true);
    expect([a, b].some(t => t.classList.contains('selected'))).toBe(false);
  });

  it('locks the board while a mismatch is shown, then clears it', () => {
    const window = start();
    const [a] = tiles(window);
    const b = tiles(window).find(t => t.dataset.name !== a.dataset.name);

    a.click();
    b.click();
    expect([a, b].every(t => t.classList.contains('shake'))).toBe(true);

    const other = tiles(window).find(t => t !== a && t !== b);
    other.click();
    expect(other.classList.contains('selected')).toBe(false);

    window.__advance(700);
    expect([a, b].some(t => t.classList.contains('selected') || t.classList.contains('shake'))).toBe(false);

    other.click();
    expect(other.classList.contains('selected')).toBe(true);
  });

  it('ignores clicks on an already matched tile', () => {
    const window = start();
    const [a] = tiles(window);
    const b = tiles(window).find(t => t !== a && t.dataset.name === a.dataset.name);
    a.click();
    b.click();

    a.click();
    expect(a.classList.contains('selected')).toBe(false);
    expect(a.classList.contains('matched')).toBe(true);
  });
});

describe('completing rounds', () => {
  it('advances through rounds without recording a play', () => {
    const window = start();
    completeRound(window);
    expect(window.document.getElementById('stars').textContent).toBe('⭐⭐⭐');

    window.__advance(1500);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 2 of 5');
    expect(window.localStorage.getItem('kidgames:match:total')).toBeNull();
  });

  it('records the play once the last round is finished', () => {
    const window = start({ 'kidgames:match:total': '3' });
    for (let round = 0; round < 5; round++) {
      completeRound(window);
      window.__advance(1500 + ROUND_INTRO_MS);
    }

    const today = new Date().toISOString().slice(0, 10);
    expect(window.localStorage.getItem('kidgames:match:total')).toBe('4');
    expect(JSON.parse(window.localStorage.getItem('kidgames:match:days'))).toEqual({ [today]: 1 });
    expect(window.document.getElementById('finishOverlay').classList.contains('hidden')).toBe(false);
  });
});
