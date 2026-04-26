import { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nestjs-telegraf', () => ({
  TelegrafExecutionContext: { create: vi.fn() },
}));

import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { AdminGuard } from './admin.guard';

const ADMIN_ID = 123456789;

const mockCtx = (fromId: number | undefined) => {
  (TelegrafExecutionContext.create as ReturnType<typeof vi.fn>).mockReturnValue({
    getContext: () => ({ from: fromId !== undefined ? { id: fromId } : undefined }),
  });
};

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new AdminGuard({ getOrThrow: vi.fn().mockReturnValue(String(ADMIN_ID)) } as any);
  });

  it('returns true when from.id matches ADMIN_TELEGRAM_ID', () => {
    mockCtx(ADMIN_ID);
    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });

  it('returns false when from.id does not match', () => {
    mockCtx(999999);
    expect(guard.canActivate({} as ExecutionContext)).toBe(false);
  });

  it('returns false when from is undefined', () => {
    mockCtx(undefined);
    expect(guard.canActivate({} as ExecutionContext)).toBe(false);
  });

  it('correctly parses ADMIN_TELEGRAM_ID string to number', () => {
    mockCtx(ADMIN_ID);
    // If parseInt broke, NaN !== ADMIN_ID would return false even for correct ID
    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });
});
