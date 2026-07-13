import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok', () => {
    expect(new HealthController().check()).toEqual({ ok: true });
  });
});
