import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'kid-games/dots/index.html';
const ROUND_INTRO_MS = 1700;

function start(seed) {
  const window = loadPage(PAGE, { seed });
  window.document.getElementById('startBtn').click();
  window.__advance(ROUND_INTRO_MS);
  return window;
}

function dots(window) {
  return [...window.document.querySelectorAll('#board .dot')];
}

function connectAll(window) {
  const all = dots(window).sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx));
  all.forEach(dot => dot.dispatchEvent(new window.MouseEvent('click')));
  window.__advance(350);
}

describe('starting a round', () => {
  it('numbers every dot and highlights only the first one', () => {
    const window = loadPage(PAGE);
    window.document.getElementById('startBtn').click();

    expect(window.document.getElementById('startOverlay').classList.contains('hidden')).toBe(true);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 1 of 5');
    expect(dots(window)).toHaveLength(0);

    window.__advance(ROUND_INTRO_MS);

    const placed = dots(window);
    expect(placed.length).toBeGreaterThan(2);
    expect(placed.map(d => d.dataset.idx)).toEqual(placed.map((_, i) => String(i + 1)));
    expect(placed.filter(d => d.classList.contains('next'))).toHaveLength(1);
    expect(placed[0].classList.contains('next')).toBe(true);
    expect(window.document.getElementById('themeTitle').textContent).toMatch(/^Tap dots in order to draw a /);
  });
});

describe('tapping dots', () => {
  it('completes a dot and promotes the next one, drawing a segment', () => {
    const window = start();
    const [first, second] = dots(window);

    first.dispatchEvent(new window.MouseEvent('click'));
    expect(first.classList.contains('done')).toBe(true);
    expect(first.classList.contains('next')).toBe(false);
    expect(second.classList.contains('next')).toBe(true);
    expect(window.document.querySelectorAll('#board .seg')).toHaveLength(0);

    second.dispatchEvent(new window.MouseEvent('click'));
    expect(window.document.querySelectorAll('#board .seg')).toHaveLength(1);
    expect(window.document.querySelector('.num[data-idx="2"]').classList.contains('done')).toBe(true);
  });

  it('shakes an out-of-order dot without advancing', () => {
    const window = start();
    const third = dots(window)[2];

    third.dispatchEvent(new window.MouseEvent('click'));
    expect(third.classList.contains('shake')).toBe(true);
    expect(third.classList.contains('done')).toBe(false);

    window.__advance(380);
    expect(third.classList.contains('shake')).toBe(false);

    dots(window)[0].dispatchEvent(new window.MouseEvent('click'));
    expect(dots(window)[0].classList.contains('done')).toBe(true);
  });
});

describe('finishing the picture', () => {
  it('closes the shape, fills the picture and locks the board', () => {
    const window = start();
    const total = dots(window).length;
    connectAll(window);

    // One segment per edge plus the closing edge back to dot 1.
    expect(window.document.querySelectorAll('#board .seg')).toHaveLength(total);
    expect(window.document.querySelectorAll('#board path.pic')).toHaveLength(1);
    expect(window.document.getElementById('stars').textContent).toBe('⭐⭐⭐');
  });

  it('moves on to the next round without recording a play', () => {
    const window = start();
    connectAll(window);
    expect(window.localStorage.getItem('kidgames:dots:total')).toBeNull();

    window.__advance(2200);
    expect(window.document.getElementById('roundLabel').textContent).toBe('Round 2 of 5');
    window.__advance(ROUND_INTRO_MS);
    expect(window.document.querySelectorAll('#board .seg')).toHaveLength(0);
  });

  it('records the play after the final round', () => {
    const window = start({ 'kidgames:dots:days': JSON.stringify({ '2024-01-01': 2 }) });
    for (let round = 0; round < 5; round++) {
      connectAll(window);
      window.__advance(2200 + ROUND_INTRO_MS);
    }

    const today = new Date().toISOString().slice(0, 10);
    expect(window.localStorage.getItem('kidgames:dots:total')).toBe('1');
    expect(JSON.parse(window.localStorage.getItem('kidgames:dots:days'))).toEqual({
      '2024-01-01': 2,
      [today]: 1
    });
    expect(window.document.getElementById('finishOverlay').classList.contains('hidden')).toBe(false);
  });
});
