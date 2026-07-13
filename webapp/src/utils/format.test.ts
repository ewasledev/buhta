import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatTrafficLimit,
  formatDate,
  formatExpiry,
  formatLastOnline,
  formatUptime,
} from './format';

describe('formatBytes', () => {
  it('база 1024, ru-RU', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(1024)).toBe('1 КБ');
    expect(formatBytes(1342177280)).toBe('1,25 ГБ');
  });
});

describe('formatTrafficLimit', () => {
  it('0 → ∞', () => {
    expect(formatTrafficLimit(0)).toBe('∞');
    expect(formatTrafficLimit(53687091200)).toBe('50 ГБ');
  });
});

describe('formatDate', () => {
  it('короткая русская дата', () => {
    expect(formatDate(new Date(2026, 6, 12).getTime())).toBe('12 июл 2026');
  });
});

describe('formatExpiry', () => {
  it('0 → Бессрочно, иначе дата', () => {
    expect(formatExpiry(0)).toBe('Бессрочно');
    expect(formatExpiry(new Date(2026, 6, 12).getTime())).toBe('до 12 июл 2026');
  });
});

describe('formatLastOnline', () => {
  const nowSec = Math.floor(Date.now() / 1000);
  it('сегодня / вчера / N дн назад', () => {
    expect(formatLastOnline(nowSec - 60)).toBe('сегодня');
    expect(formatLastOnline(nowSec - 26 * 3600)).toBe('вчера');
    expect(formatLastOnline(nowSec - 5 * 86400)).toBe('5 дн назад');
    expect(formatLastOnline(0)).toBe('никогда');
  });
});

describe('formatUptime', () => {
  it('дни и часы', () => {
    expect(formatUptime(5 * 86400 + 3 * 3600 + 100)).toBe('5 д 3 ч');
    expect(formatUptime(3 * 3600 + 30 * 60)).toBe('3 ч 30 мин');
    expect(formatUptime(150)).toBe('2 мин');
  });
});
