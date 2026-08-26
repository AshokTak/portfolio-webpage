import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'whats-your-dream/journey.html';
const VISION_KEY = 'vision-board-v1';

function load(seed) {
  return loadPage(PAGE, { seed });
}

describe('dream statement', () => {
  it('prompts for a dream when none is stored', () => {
    const el = load().document.getElementById('dream-statement-text');
    expect(el.classList.contains('empty')).toBe(true);
    expect(el.textContent).toContain("haven't written your dream");
  });

  it('quotes the stored dream', () => {
    const window = load({ 'dream-declaration': 'Build a school in Nepal' });
    const el = window.document.getElementById('dream-statement-text');
    expect(el.textContent).toBe('"Build a school in Nepal"');
    expect(el.classList.contains('empty')).toBe(false);
  });
});

describe('stats', () => {
  it('shows zeroes with no history', () => {
    const window = load();
    expect(window.document.getElementById('stat-streak').textContent).toBe('0🔥');
    expect(window.document.getElementById('stat-days').textContent).toBe('0');
    expect(window.document.getElementById('stat-wb').textContent).toBe('0/7');
    expect(window.document.getElementById('stat-dreams').textContent).toBe('0');
  });

  it('reads streak, days, workbook days and wall count from storage', () => {
    const window = load({
      'checkin-dates': JSON.stringify({ streak: 4, days: 12, history: { '2025-01-01': 1 } }),
      'wb-done-0': '1',
      'wb-done-1': '1',
      'dream-wall-v2': JSON.stringify({ s1: { hearts: 1 }, u1: { text: 'mine' }, u2: { text: 'also mine' } })
    });
    expect(window.document.getElementById('stat-streak').textContent).toBe('4🔥');
    expect(window.document.getElementById('stat-days').textContent).toBe('12');
    expect(window.document.getElementById('stat-wb').textContent).toBe('2/7');
    // Seeded dreams (ids starting with "s") are not counted as the user's own.
    expect(window.document.getElementById('stat-dreams').textContent).toBe('2');
  });

  it('survives corrupt check-in and wall payloads', () => {
    const window = load({ 'checkin-dates': 'nope', 'dream-wall-v2': '{{' });
    expect(window.document.getElementById('stat-streak').textContent).toBe('0🔥');
    expect(window.document.getElementById('stat-dreams').textContent).toBe('0');
  });
});

describe('heatmap', () => {
  it('renders 26 weeks of cells and highlights check-in days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const window = load({
      'checkin-dates': JSON.stringify({ streak: 1, days: 1, history: { [today]: 3 } })
    });
    const cells = window.document.querySelectorAll('#heatmap-grid .heatmap-cell');
    expect(cells.length).toBeGreaterThan(26 * 7 - 14);
    expect(window.document.querySelectorAll('#heatmap-grid .heatmap-cell.l3').length).toBe(1);
    expect([...cells].at(-1).title).toContain(today);
  });

  it('caps the intensity level at 4', () => {
    const today = new Date().toISOString().slice(0, 10);
    const window = load({
      'checkin-dates': JSON.stringify({ history: { [today]: 99 } })
    });
    expect(window.document.querySelectorAll('#heatmap-grid .heatmap-cell.l4').length).toBe(1);
  });
});

describe('milestones', () => {
  it('locks every milestone for a new visitor', () => {
    const window = load();
    expect(window.document.querySelectorAll('.milestone-card').length).toBe(9);
    expect(window.document.querySelectorAll('.milestone-card.unlocked').length).toBe(0);
  });

  it('unlocks the milestones the stored progress earns', () => {
    const window = load({
      'checkin-dates': JSON.stringify({ streak: 7, days: 30, history: {} }),
      'wb-done-0': '1',
      'wb-done-1': '1',
      'wb-done-2': '1',
      'wb-done-3': '1',
      'dream-wall-v2': JSON.stringify({ u1: { text: 'mine' } })
    });
    const unlocked = [...window.document.querySelectorAll('.milestone-card.unlocked')]
      .map(el => el.querySelector('.milestone-name').textContent);
    expect(unlocked).toEqual(['First Step', 'On Fire', 'Day One', 'Momentum', 'Half-Way', 'Wall Dreamer']);
  });
});

describe('workbook rings', () => {
  it('renders one ring per day, marking answered and completed days', () => {
    const window = load({
      'wb-done-0': '1',
      'wb-d1-q0': 'a longer answer',
      'wb-d1-q1': 'no',
      'wb-d1-q2': 'another longer answer'
    });
    const rings = window.document.querySelectorAll('#wb-days .wb-day-ring');
    expect(rings.length).toBe(7);
    expect(rings[0].classList.contains('complete')).toBe(true);
    // Answers of three characters or fewer do not count as answered.
    expect(rings[1].classList.contains('in-progress')).toBe(true);
    expect(rings[2].className.trim()).toBe('wb-day-ring');
  });
});

describe('vision board', () => {
  it('renders nine empty tiles by default', () => {
    const window = load();
    const tiles = window.document.querySelectorAll('#vision-grid .vision-tile');
    expect(tiles.length).toBe(9);
    expect(window.document.querySelectorAll('#vision-grid .vision-tile.filled').length).toBe(0);
  });

  it('renders stored tiles and escapes their text', () => {
    const window = load({
      [VISION_KEY]: JSON.stringify({ 0: { emoji: '🏝️', text: '<b>Beach house</b>' } })
    });
    const tile = window.document.querySelector('#vision-grid .vision-tile');
    expect(tile.classList.contains('filled')).toBe(true);
    expect(tile.querySelector('.tile-emoji').textContent).toBe('🏝️');
    expect(tile.querySelector('b')).toBeNull();
    expect(tile.querySelector('.tile-text').textContent).toBe('<b>Beach house</b>');
  });

  it('opens the modal for the clicked tile and saves a new vision', () => {
    const window = load();
    const document = window.document;
    document.querySelectorAll('#vision-grid .vision-tile')[2].click();

    expect(document.getElementById('modal').classList.contains('open')).toBe(true);
    expect(document.getElementById('modal-title').textContent).toBe('Add a vision');

    document.getElementById('modal-text').value = 'Run a marathon';
    window.saveTile();

    expect(JSON.parse(window.localStorage.getItem(VISION_KEY))).toEqual({
      2: { emoji: '✨', text: 'Run a marathon' }
    });
    expect(document.getElementById('modal').classList.contains('open')).toBe(false);
    expect(document.querySelectorAll('#vision-grid .vision-tile.filled').length).toBe(1);
  });

  it('clears a tile when its text is emptied', () => {
    const window = load({ [VISION_KEY]: JSON.stringify({ 0: { emoji: '🏝️', text: 'Beach house' } }) });
    const document = window.document;
    document.querySelector('#vision-grid .vision-tile').click();
    expect(document.getElementById('modal-title').textContent).toBe('Edit vision');

    document.getElementById('modal-text').value = '   ';
    window.saveTile();

    expect(JSON.parse(window.localStorage.getItem(VISION_KEY))).toEqual({});
    expect(document.querySelectorAll('#vision-grid .vision-tile.filled').length).toBe(0);
  });

  it('ignores a save when no tile is being edited', () => {
    const window = load();
    window.saveTile();
    expect(window.localStorage.getItem(VISION_KEY)).toBeNull();
  });

  it('closes the modal on Escape', () => {
    const window = load();
    window.document.querySelector('#vision-grid .vision-tile').click();
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(window.document.getElementById('modal').classList.contains('open')).toBe(false);
  });
});
