import { describe, it, expect } from 'vitest';
import { loadPage } from './support/page.js';

const PAGE = 'kid-games/index.html';

function isoDaysAgo(n) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n)
    .toISOString()
    .slice(0, 10);
}

function playStats(slug, { total, days }) {
  return {
    [`kidgames:${slug}:total`]: String(total),
    [`kidgames:${slug}:days`]: JSON.stringify(days)
  };
}

describe('with no play history', () => {
  it('invites the child to pick a game and shows no per-card stats', () => {
    const window = loadPage(PAGE);
    expect(window.document.getElementById('summary').textContent).toContain('Pick a game to start!');
    expect(window.document.querySelectorAll('.card .stats').length).toBe(0);
  });
});

describe('with play history', () => {
  it('adds a stats badge to each played game only', () => {
    const window = loadPage(PAGE, {
      seed: playStats('memory', { total: 4, days: { [isoDaysAgo(0)]: 2 } })
    });
    const badges = window.document.querySelectorAll('.card .stats');
    expect(badges.length).toBe(1);
    expect(badges[0].closest('.card').dataset.slug).toBe('memory');
    expect(badges[0].querySelector('.today').textContent).toContain('2');
    expect(badges[0].querySelector('.total').textContent).toContain('4');
  });

  it('sums totals across games in the summary', () => {
    const window = loadPage(PAGE, {
      seed: {
        ...playStats('memory', { total: 4, days: { [isoDaysAgo(0)]: 2 } }),
        ...playStats('match', { total: 6, days: { [isoDaysAgo(0)]: 1, [isoDaysAgo(3)]: 5 } })
      }
    });
    const numbers = [...window.document.querySelectorAll('#summary .stat .num')].map(n => n.textContent);
    expect(numbers).toEqual(['3', '10']);
  });

  it('draws a seven day sparkline scaled to the busiest day', () => {
    const window = loadPage(PAGE, {
      seed: playStats('memory', {
        total: 9,
        days: { [isoDaysAgo(0)]: 4, [isoDaysAgo(2)]: 2, [isoDaysAgo(30)]: 3 }
      })
    });
    const bars = [...window.document.querySelectorAll('#summary .sparkline span')];
    expect(bars.length).toBe(7);
    // Days outside the window are excluded, so only two bars are filled.
    expect(bars.filter(b => b.classList.contains('has')).length).toBe(2);
    expect(bars.at(-1).style.height).toBe('18px');
    expect(bars.at(-3).style.height).toBe('9px');
    expect(bars.at(-2).style.height).toBe('2px');
  });

  it('ignores a corrupt stats payload for a game', () => {
    const window = loadPage(PAGE, {
      seed: {
        'kidgames:memory:total': '7',
        'kidgames:memory:days': 'not-json',
        ...playStats('match', { total: 2, days: { [isoDaysAgo(0)]: 2 } })
      }
    });
    const slugs = [...window.document.querySelectorAll('.card .stats')]
      .map(s => s.closest('.card').dataset.slug);
    expect(slugs).toEqual(['match']);
    expect(window.document.querySelector('#summary .stat .num').textContent).toBe('2');
  });
});
