import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'whats-your-dream/index.html';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function load(seed) {
  return loadPage(PAGE, { seed });
}

describe('date helpers', () => {
  it('formats today as a zero-padded ISO date', () => {
    const { todayKey } = load();
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
    expect(todayKey()).toBe(expected);
  });

  it('steps back one day across month and year boundaries', () => {
    const { prevDay } = load();
    expect(prevDay('2025-03-15')).toBe('2025-03-14');
    expect(prevDay('2025-03-01')).toBe('2025-02-28');
    expect(prevDay('2025-01-01')).toBe('2024-12-31');
    expect(prevDay('2024-03-01')).toBe('2024-02-29');
  });
});

describe('calcStreak', () => {
  it('is zero with no check-ins', () => {
    const { calcStreak } = load();
    expect(calcStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const { calcStreak } = load();
    expect(calcStreak([daysAgo(0)])).toBe(1);
    expect(calcStreak([daysAgo(2), daysAgo(1), daysAgo(0)])).toBe(3);
  });

  // The guard clause allows a history ending yesterday to keep its streak, but
  // the counting loop starts from today and breaks immediately, so it returns 0.
  // Documented here as current behaviour rather than the apparent intent.
  it('drops a streak that ends yesterday', () => {
    const { calcStreak } = load();
    expect(calcStreak([daysAgo(2), daysAgo(1)])).toBe(0);
  });

  it('breaks on a gap', () => {
    const { calcStreak } = load();
    expect(calcStreak([daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(4)])).toBe(2);
  });

  it('resets to zero once two or more days are missed', () => {
    const { calcStreak } = load();
    expect(calcStreak([daysAgo(2), daysAgo(3)])).toBe(0);
  });

  it('ignores duplicate check-ins for the same day', () => {
    const { calcStreak } = load();
    expect(calcStreak([daysAgo(0), daysAgo(0), daysAgo(1)])).toBe(2);
  });
});

describe('stored check-ins', () => {
  it('renders the stored count and streak on load', () => {
    const window = load({ wyd_done_dates: JSON.stringify([daysAgo(1), daysAgo(0)]) });
    expect(window.document.getElementById('done-count').textContent).toBe('2');
    expect(window.document.getElementById('streak-tile').textContent).toBe('2');
    expect(window.document.getElementById('header-streak').textContent).toBe('2');
    expect(window.document.getElementById('done-btn').classList.contains('completed')).toBe(true);
  });

  it('falls back to an empty history when storage is corrupt', () => {
    const window = load({ wyd_done_dates: 'not-json' });
    expect(window.getDates()).toEqual([]);
    expect(window.document.getElementById('done-count').textContent).toBe('0');
  });
});

describe('markDone', () => {
  it('records today once and is idempotent', () => {
    const window = load();
    expect(window.document.getElementById('done-btn').classList.contains('completed')).toBe(false);

    window.markDone();
    expect(JSON.parse(window.localStorage.getItem('wyd_done_dates'))).toEqual([window.todayKey()]);
    expect(window.document.getElementById('done-count').textContent).toBe('1');
    expect(window.document.getElementById('done-btn').classList.contains('completed')).toBe(true);

    window.markDone();
    expect(JSON.parse(window.localStorage.getItem('wyd_done_dates'))).toEqual([window.todayKey()]);
    expect(window.document.getElementById('done-count').textContent).toBe('1');
  });

  it('extends an existing streak', () => {
    const window = load({ wyd_done_dates: JSON.stringify([daysAgo(2), daysAgo(1)]) });
    window.markDone();
    expect(window.document.getElementById('streak-tile').textContent).toBe('3');
  });

  it('launches confetti only for a new check-in', () => {
    const window = load();
    const confettiCount = () => window.document.querySelectorAll('.cp').length;

    window.markDone();
    expect(confettiCount()).toBeGreaterThan(0);

    const after = confettiCount();
    window.markDone();
    expect(confettiCount()).toBe(after);
  });
});

describe('dream pills', () => {
  it('shows seeded dreams', () => {
    const window = load();
    expect(window.document.querySelectorAll('#dream-pills .dream-pill').length).toBe(7);
  });

  it('prepends dreams saved on the wall', () => {
    const window = load({
      wyd_wall_dreams: JSON.stringify([{ dream: 'Open a bakery in Lisbon' }])
    });
    const first = window.document.querySelector('#dream-pills .dream-pill');
    expect(first.textContent).toContain('Open a bakery in Lisbon');
  });

  it('ignores a corrupt wall payload', () => {
    const window = load({ wyd_wall_dreams: '{oops' });
    expect(window.document.querySelectorAll('#dream-pills .dream-pill').length).toBe(7);
  });
});

describe('slideshow', () => {
  const activeIndex = window_ => [...window_.document.querySelectorAll('#ss-track .slide')]
    .findIndex(s => s.classList.contains('active'));

  it('renders a slide and a dot per quote with the first one active', () => {
    const window = load();
    const slides = window.document.querySelectorAll('#ss-track .slide');
    const dots = window.document.querySelectorAll('#ss-dots .ss-dot');
    expect(slides.length).toBeGreaterThan(1);
    expect(dots.length).toBe(slides.length);
    expect(activeIndex(window)).toBe(0);
    expect(dots[0].classList.contains('active')).toBe(true);
  });

  it('moves forward and wraps around at the ends', () => {
    const window = load();
    const total = window.document.querySelectorAll('#ss-track .slide').length;

    window.document.getElementById('ss-next').click();
    expect(activeIndex(window)).toBe(1);

    window.document.getElementById('ss-prev').click();
    window.document.getElementById('ss-prev').click();
    expect(activeIndex(window)).toBe(total - 1);
  });

  it('jumps to a slide when its dot is clicked', () => {
    const window = load();
    const dots = [...window.document.querySelectorAll('#ss-dots .ss-dot')];
    dots[2].click();

    expect(activeIndex(window)).toBe(2);
    expect(dots[2].classList.contains('active')).toBe(true);
    expect(dots[0].classList.contains('active')).toBe(false);
  });

  // The cleanup timeout reads `cur` after it has been reassigned, so the
  // outgoing slide keeps its exit class. Current behaviour, not the intent.
  it('leaves the exit class on the outgoing slide', () => {
    const window = load();
    const slides = [...window.document.querySelectorAll('#ss-track .slide')];

    window.document.getElementById('ss-next').click();
    expect(slides[0].classList.contains('exit')).toBe(true);

    window.__advance(550);
    expect(slides[0].classList.contains('exit')).toBe(true);
  });

  it('advances on its own every 5.5 seconds', () => {
    const window = load();
    window.__advance(5500);
    expect(activeIndex(window)).toBe(1);
    window.__advance(5500);
    expect(activeIndex(window)).toBe(2);
  });
});

describe('sharing', () => {
  it('opens a prefilled tweet', () => {
    const window = load();
    window.document.querySelector('button[onclick="shareTwitter()"]').click();

    expect(window.__opened).toHaveLength(1);
    const { url, target } = window.__opened[0];
    expect(target).toBe('_blank');
    expect(url).toContain('https://twitter.com/intent/tweet?text=');
    expect(decodeURIComponent(url)).toContain('Simon Squibb');
  });

  // The 'Copied!' confirmation reads the implicit global `event`, which is no
  // longer set once the clipboard promise resolves, so the label never changes.
  it('copies the link to the clipboard', async () => {
    const window = load();
    const btn = window.document.querySelector('button[onclick="copyLink()"]');
    const original = btn.innerHTML;
    btn.click();

    expect(window.__clipboard).toEqual(['https://ashoktak.com/whats-your-dream']);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(btn.innerHTML).toBe(original);
  });

  it('uses the native share sheet when available', () => {
    const window = load();
    const shared = [];
    window.navigator.share = payload => { shared.push(payload); return Promise.resolve(); };

    window.shareNative();
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toBe('https://ashoktak.com/whats-your-dream');
    expect(window.__clipboard).toEqual([]);
  });

  it('falls back to copying the link without a share sheet', () => {
    const window = load();
    window.document.querySelector('button[onclick="shareNative()"]').click();
    expect(window.__clipboard).toEqual(['https://ashoktak.com/whats-your-dream']);
  });
});

describe('staircase decoration', () => {
  it('renders eight steps of increasing height', () => {
    const window = load();
    const steps = [...window.document.querySelectorAll('#stair-deco .stair-step')];
    expect(steps).toHaveLength(8);
    const heights = steps.map(s => parseInt(s.style.height, 10));
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
  });
});

describe('daily entry', () => {
  it('shows a quote, action and day number for today', () => {
    const window = load();
    const doy = window.getDOY(new Date());
    expect(window.document.getElementById('day-number').textContent).toBe(String(doy));
    expect(window.document.getElementById('quote-text').textContent.length).toBeGreaterThan(0);
    expect(window.document.getElementById('action-text').textContent.length).toBeGreaterThan(0);
    expect(window.document.getElementById('quote-author').textContent).toContain('Simon Squibb');
  });
});
