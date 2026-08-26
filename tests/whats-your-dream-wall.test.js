import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'whats-your-dream/wall.html';
const KEY = 'dream-wall-v2';

function load(seed) {
  return loadPage(PAGE, { seed });
}

function stored(window) {
  return JSON.parse(window.localStorage.getItem(KEY) || '{}');
}

describe('loadDreams', () => {
  it('returns the seeded dreams when nothing is stored', () => {
    const window = load();
    const dreams = window.loadDreams();
    expect(dreams.length).toBe(10);
    expect(dreams.every(d => d.id.startsWith('s'))).toBe(true);
  });

  it('applies stored overrides onto the matching seed', () => {
    const window = load({ [KEY]: JSON.stringify({ s1: { liked: true, hearts: 99 } }) });
    const seed = window.loadDreams().find(d => d.id === 's1');
    expect(seed.hearts).toBe(99);
    expect(seed.liked).toBe(true);
    expect(seed.author).toBeTruthy();
  });

  it('lists user dreams newest first, ahead of the seeds', () => {
    const window = load({
      [KEY]: JSON.stringify({
        u1: { id: 'u1', text: 'older', cat: 'Creative', hearts: 0, liked: false },
        u2: { id: 'u2', text: 'newer', cat: 'Creative', hearts: 0, liked: false }
      })
    });
    const dreams = window.loadDreams();
    expect(dreams.slice(0, 2).map(d => d.text)).toEqual(['newer', 'older']);
    expect(dreams.length).toBe(12);
  });

  it('falls back to the seeds when storage is corrupt', () => {
    const window = load({ [KEY]: '{broken' });
    expect(window.loadDreams().length).toBe(10);
  });
});

describe('escHtml', () => {
  it('escapes markup-sensitive characters', () => {
    const { escHtml } = load();
    expect(escHtml('<img src=x onerror="a&b">')).toBe(
      '&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;'
    );
  });

  it('treats missing text as empty', () => {
    const { escHtml } = load();
    expect(escHtml(undefined)).toBe('');
    expect(escHtml('')).toBe('');
  });
});

describe('rendering', () => {
  it('renders one card per dream with a category class and heart count', () => {
    const window = load();
    const cards = window.document.querySelectorAll('#dream-grid .dream-card');
    expect(cards.length).toBe(10);
    expect(window.document.getElementById('count-num').textContent).toBe('10');
    expect(cards[0].className).toContain('cat-');
    expect(cards[0].querySelector('.heart-count').textContent).toMatch(/^\d+$/);
  });

  it('escapes user supplied text instead of injecting it', () => {
    const window = load({
      [KEY]: JSON.stringify({
        u1: { id: 'u1', text: '<script>alert(1)</script>', author: '<b>me</b>', cat: 'Creative', hearts: 0, liked: false }
      })
    });
    const card = window.document.querySelector('#dream-grid .dream-card');
    expect(card.querySelector('script')).toBeNull();
    expect(card.querySelector('.dream-card-quote').textContent).toContain('<script>alert(1)</script>');
    expect(card.querySelector('.dream-card-author').textContent).toBe('— <b>me</b>');
  });

  it('labels dreams posted without a name as anonymous', () => {
    const window = load({
      [KEY]: JSON.stringify({
        u1: { id: 'u1', text: 'a dream', author: '', cat: 'Creative', hearts: 0, liked: false }
      })
    });
    const card = window.document.querySelector('#dream-grid .dream-card');
    expect(card.querySelector('.dream-card-author').textContent).toBe('— Anonymous');
  });
});

describe('filtering', () => {
  it('shows only the selected category and keeps the total count', () => {
    const window = load();
    const button = window.document.querySelector('.filter-btn[data-filter="Creative"]');
    window.setFilter(button);

    const cards = [...window.document.querySelectorAll('#dream-grid .dream-card')];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(c => c.dataset.cat === 'Creative')).toBe(true);
    expect(button.classList.contains('active')).toBe(true);
    expect(window.document.getElementById('count-num').textContent).toBe('10');
  });

  it('shows the empty state when a category has no dreams', () => {
    const window = load();
    const button = window.document.querySelector('.filter-btn');
    button.dataset.filter = 'Nonexistent';
    window.setFilter(button);

    expect(window.document.querySelectorAll('#dream-grid .dream-card').length).toBe(0);
    expect(window.document.getElementById('empty-state').style.display).toBe('block');
  });

  it('restores every dream when returning to All', () => {
    const window = load();
    window.setFilter(window.document.querySelector('.filter-btn[data-filter="Creative"]'));
    window.setFilter(window.document.querySelector('.filter-btn[data-filter="All"]'));
    expect(window.document.querySelectorAll('#dream-grid .dream-card').length).toBe(10);
  });
});

describe('postDream', () => {
  function fill(window, text, name = '') {
    window.document.getElementById('dream-input').value = text;
    window.document.getElementById('name-input').value = name;
  }

  it('rejects an empty dream', () => {
    const window = load();
    fill(window, '   ');
    window.postDream();
    expect(window.document.getElementById('toast').textContent).toContain('write your dream');
    expect(stored(window)).toEqual({});
  });

  it('rejects a dream that is too short', () => {
    const window = load();
    fill(window, 'too short');
    window.postDream();
    expect(window.document.getElementById('toast').textContent).toContain('vivid');
    expect(stored(window)).toEqual({});
  });

  it('stores a valid dream, renders it first and clears the form', () => {
    const window = load();
    fill(window, 'I want to sail around the world', 'Ashok');
    window.postDream();

    const saved = Object.values(stored(window)).filter(d => d.id.startsWith('u'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      text: 'I want to sail around the world',
      author: 'Ashok',
      cat: 'Creative',
      hearts: 0,
      liked: false
    });

    const firstCard = window.document.querySelector('#dream-grid .dream-card');
    expect(firstCard.querySelector('.dream-card-quote').textContent).toContain('sail around the world');
    expect(window.document.getElementById('dream-input').value).toBe('');
    expect(window.document.getElementById('name-input').value).toBe('');
    expect(window.document.getElementById('toast').classList.contains('show')).toBe(true);
  });

  it('uses the selected category', () => {
    const window = load();
    window.document.querySelector('#cat-select .cat-btn[data-cat="Fitness"]').click();
    fill(window, 'I will run an ultra marathon next year');
    window.postDream();

    const saved = Object.values(stored(window)).find(d => d.id.startsWith('u'));
    expect(saved.cat).toBe('Fitness');
  });

  it('posts on Enter but not on Shift+Enter', () => {
    const window = load();
    const input = window.document.getElementById('dream-input');
    input.value = 'I want to learn to fly a glider';

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(Object.keys(stored(window))).toHaveLength(0);

    input.value = 'I want to learn to fly a glider';
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(Object.values(stored(window)).filter(d => d.id.startsWith('u'))).toHaveLength(1);
  });
});

describe('toggleHeart', () => {
  function heartButton(window, id) {
    return window.document.querySelector(`.dream-card[data-id="${id}"] .heart-btn`);
  }

  it('likes a dream, persists it and updates the button', () => {
    const window = load();
    const button = heartButton(window, 's1');
    const before = Number(button.querySelector('.heart-count').textContent);

    button.click();

    expect(button.classList.contains('liked')).toBe(true);
    expect(button.querySelector('.heart-icon').textContent).toBe('❤️');
    expect(Number(button.querySelector('.heart-count').textContent)).toBe(before + 1);
    expect(stored(window).s1).toMatchObject({ liked: true, hearts: before + 1 });
  });

  it('unlikes a previously liked dream', () => {
    const window = load({ [KEY]: JSON.stringify({ s1: { liked: true, hearts: 10 } }) });
    const button = heartButton(window, 's1');

    button.click();

    expect(button.classList.contains('liked')).toBe(false);
    expect(button.querySelector('.heart-icon').textContent).toBe('🤍');
    expect(stored(window).s1).toMatchObject({ liked: false, hearts: 9 });
  });

  it('ignores an unknown dream id', () => {
    const window = load();
    const event = { stopPropagation() {}, currentTarget: heartButton(window, 's1') };
    expect(() => window.toggleHeart(event, 'missing')).not.toThrow();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe('scroll reveal', () => {
  it('marks revealed elements visible once and stops observing them', () => {
    const window = load();
    const observer = window.__observers.at(-1);
    const target = window.document.querySelector('.reveal');

    observer.trigger([target], true);
    expect(target.classList.contains('visible')).toBe(true);
    expect(observer.observed).not.toContain(target);
  });
});
