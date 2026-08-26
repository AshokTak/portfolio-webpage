import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'whats-your-dream/workbook.html';
const KEY = 'wyd_workbook_v2';

function load(state) {
  return loadPage(PAGE, state ? { seed: { [KEY]: JSON.stringify(state) } } : undefined);
}

function stored(window) {
  return JSON.parse(window.localStorage.getItem(KEY) || '{}');
}

describe('workbook layout', () => {
  it('builds a tab and panel per day plus the summary tab', () => {
    const window = load();
    const tabs = window.document.querySelectorAll('.day-tab');
    expect(window.document.querySelectorAll('.day-panel').length).toBe(7);
    expect(tabs.length).toBe(8);
    expect(tabs[7].id).toBe('tab-summary');
    expect(tabs[0].classList.contains('active')).toBe(true);
  });

  it('renders a rating row for rating questions and a textarea for the rest', () => {
    const window = load();
    const panel = window.document.getElementById('panel-day-1');
    expect(panel.querySelectorAll('.rating-row .rating-btn').length).toBe(10);
    expect(panel.querySelectorAll('textarea.answer-area').length).toBe(4);
  });

  it('starts at 0% progress with an empty dream declaration', () => {
    const window = load();
    expect(window.document.getElementById('progress-pct').textContent).toBe('0%');
    expect(window.document.getElementById('dream-declaration').value).toBe('');
  });
});

describe('restoring saved state', () => {
  it('prefills answers, ratings, the dream and the done markers', () => {
    const window = load({
      dream: 'Build a school',
      d0_q0: 'My dream is to teach',
      d1_q0_rating: 7,
      day0_done: true
    });

    expect(window.document.getElementById('dream-declaration').value).toBe('Build a school');
    expect(window.document.getElementById('inp-0-0').value).toBe('My dream is to teach');
    expect(window.document.querySelector('#panel-day-1 .rating-btn.selected').dataset.val).toBe('7');
    expect(window.document.querySelectorAll('.day-tab')[0].classList.contains('done')).toBe(true);
    expect(window.document.getElementById('done-btn-0').classList.contains('done')).toBe(true);
  });

  it('starts fresh when storage is corrupt', () => {
    const window = loadPage(PAGE, { seed: { [KEY]: 'nope' } });
    expect(window.document.getElementById('progress-pct').textContent).toBe('0%');
    expect(window.document.getElementById('inp-0-0').value).toBe('');
  });
});

describe('saving answers', () => {
  it('persists a typed answer and shows the save indicator', () => {
    const window = load();
    const input = window.document.getElementById('inp-0-1');
    input.value = 'Because it matters';
    input.dispatchEvent(new window.Event('input'));

    expect(stored(window).d0_q1).toBe('Because it matters');
    expect(window.document.getElementById('save-indicator').classList.contains('visible')).toBe(true);
  });

  it('hides the save indicator again after a pause', () => {
    const window = load();
    window.saveAnswer(0, 0);
    const indicator = window.document.getElementById('save-indicator');
    window.__advance(1800);
    expect(indicator.classList.contains('visible')).toBe(false);
  });

  it('persists the dream declaration as it is typed', () => {
    const window = load();
    const dream = window.document.getElementById('dream-declaration');
    dream.value = 'Open a library';
    dream.dispatchEvent(new window.Event('input'));
    expect(stored(window).dream).toBe('Open a library');
  });

  it('stores a rating and moves the selection', () => {
    const window = load();
    window.setRating(1, 0, 4);
    expect(stored(window).d1_q0_rating).toBe(4);
    const selected = window.document.querySelectorAll('#panel-day-1 .rating-btn.selected');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset.val).toBe('4');

    window.setRating(1, 0, 9);
    expect(window.document.querySelector('#panel-day-1 .rating-btn.selected').dataset.val).toBe('9');
  });

  it('ignores a save for a question that is not on the page', () => {
    const window = load();
    expect(() => window.saveAnswer(99, 99)).not.toThrow();
    expect(stored(window).d99_q99).toBeUndefined();
  });
});

describe('progress', () => {
  it('counts each answered question, whether text or rating', () => {
    const window = load();
    // 7 days x 4 questions = 28 questions total.
    window.document.getElementById('inp-0-0').value = 'answer';
    window.saveAnswer(0, 0);
    expect(window.document.getElementById('progress-pct').textContent).toBe('4%');

    // setRating stores the value but leaves the bar until progress is recomputed.
    window.setRating(1, 0, 5);
    expect(window.document.getElementById('progress-pct').textContent).toBe('4%');
    window.updateProgress();
    expect(window.document.getElementById('progress-pct').textContent).toBe('7%');
    expect(window.document.getElementById('progress-fill').style.width).toBe('7%');
  });

  it('reports 100% when every question is answered', () => {
    const state = {};
    for (let day = 0; day < 7; day++) {
      for (let q = 0; q < 4; q++) state[`d${day}_q${q}`] = 'answered';
    }
    const window = load(state);
    expect(window.document.getElementById('progress-pct').textContent).toBe('100%');
  });
});

describe('marking a day complete', () => {
  it('flags the day in storage, the button and the tab', () => {
    const window = load();
    window.markDayDone(2);

    expect(stored(window).day2_done).toBe(true);
    expect(window.document.getElementById('done-btn-2').classList.contains('done')).toBe(true);
    expect(window.document.getElementById('done-btn-2').textContent).toContain('Day complete');
    expect(window.document.querySelectorAll('.day-tab')[2].classList.contains('done')).toBe(true);
  });
});

describe('tabs and summary', () => {
  it('switches the active day panel', () => {
    const window = load();
    window.switchTab('day', 3);
    expect(window.document.getElementById('panel-day-3').classList.contains('active')).toBe(true);
    expect(window.document.getElementById('panel-day-0').classList.contains('active')).toBe(false);
    expect(window.document.querySelectorAll('.day-tab')[3].classList.contains('active')).toBe(true);
  });

  it('summarises the dream and answered questions only', () => {
    const window = load({
      dream: 'Teach a million kids',
      d0_q0: 'My dream is to teach',
      d1_q0_rating: 6
    });
    window.switchTab('summary');

    const summary = window.document.getElementById('summary-grid');
    expect(window.document.getElementById('summary-panel').classList.contains('active')).toBe(true);
    expect(summary.textContent).toContain('Teach a million kids');
    expect(summary.textContent).toContain('My dream is to teach');
    expect(summary.textContent).toContain('Rating: 6/10');
    // Only the two days with answers get a card.
    expect(summary.querySelectorAll('.summary-day-card').length).toBe(3);
  });

  it('notes a missing dream statement', () => {
    const window = load();
    window.switchTab('summary');
    expect(window.document.getElementById('summary-grid').textContent).toContain('not written yet');
  });
});
