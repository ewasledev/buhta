import { describe, it, expect } from 'vitest';
import { formatBytes } from './bytes.utils';

describe('formatBytes', () => {
  it('форматирует байты по основанию 1024', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(1024)).toBe('1 КБ');
    expect(formatBytes(1536)).toBe('1,5 КБ');
    expect(formatBytes(1342177280)).toBe('1,25 ГБ');
  });
});
