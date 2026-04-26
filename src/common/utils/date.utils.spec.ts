import { describe, expect, it } from 'vitest';
import { formatDate, isActive, isDateInFuture, parseDate, statusLabel } from './date.utils';

const DAY = 86_400_000;

describe('formatDate', () => {
  it('formats date as DD.MM.YYYY', () => {
    expect(formatDate(new Date(2026, 3, 25))).toBe('25.04.2026');
  });

  it('pads single-digit day and month with zero', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05.01.2026');
  });
});

describe('parseDate', () => {
  it('parses a valid DD.MM.YYYY string', () => {
    const d = parseDate('25.04.2026');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(25);
  });

  it('returns null for wrong separator format', () => {
    expect(parseDate('25-04-2026')).toBeNull();
  });

  it('returns null for non-date string', () => {
    expect(parseDate('abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });
});

describe('isDateInFuture', () => {
  it('returns true for a future date', () => {
    expect(isDateInFuture(new Date(Date.now() + DAY))).toBe(true);
  });

  it('returns false for a past date', () => {
    expect(isDateInFuture(new Date(Date.now() - DAY))).toBe(false);
  });
});

describe('isActive', () => {
  it('returns true when endDate is in the future', () => {
    expect(isActive(new Date(Date.now() + DAY))).toBe(true);
  });

  it('returns false when endDate is in the past', () => {
    expect(isActive(new Date(Date.now() - DAY))).toBe(false);
  });
});

describe('statusLabel', () => {
  it('returns active label for future date', () => {
    expect(statusLabel(new Date(Date.now() + DAY))).toBe('✅ активна');
  });

  it('returns expired label for past date', () => {
    expect(statusLabel(new Date(Date.now() - DAY))).toBe('❌ истекла');
  });
});
