import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitDataGuard } from './init-data.guard';

const BOT_TOKEN = '12345:TEST_TOKEN';
const ADMIN_ID = 111222333;

/** Подписывает params тем же алгоритмом, что и Telegram Web Apps. */
function signInitData(params: Record<string, string>, botToken: string): string {
  const pairs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  const search = new URLSearchParams(params);
  search.append('hash', hash);
  return search.toString();
}

function validParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAF9tqUZAAAAAH22pRlbrentq',
    user: JSON.stringify({ id: ADMIN_ID, first_name: 'Admin', username: 'admin' }),
    ...overrides,
  };
}

function contextFor(header?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    __request: request,
  } as unknown as ExecutionContext;
}

describe('InitDataGuard', () => {
  let guard: InitDataGuard;

  beforeEach(() => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return BOT_TOKEN;
        if (key === 'ADMIN_TELEGRAM_ID') return String(ADMIN_ID);
        return undefined;
      }),
    };
    guard = new InitDataGuard(config as unknown as ConfigService);
  });

  it('пропускает валидные initData админа и кладёт user в request', () => {
    const initData = signInitData(validParams(), BOT_TOKEN);
    const ctx = contextFor(`tma ${initData}`);
    expect(guard.canActivate(ctx)).toBe(true);
    const req = (ctx as unknown as { __request: { tgUser?: { id: number } } }).__request;
    expect(req.tgUser?.id).toBe(ADMIN_ID);
  });

  it('401 при битом hash', () => {
    const initData = signInitData(validParams(), BOT_TOKEN).replace(
      /hash=\w{10}/,
      'hash=0000000000',
    );
    expect(() => guard.canActivate(contextFor(`tma ${initData}`))).toThrow(UnauthorizedException);
  });

  it('401 при подмене поля после подписи', () => {
    const initData = signInitData(validParams(), BOT_TOKEN);
    const tampered = initData.replace('Admin', 'Hacker');
    expect(() => guard.canActivate(contextFor(`tma ${tampered}`))).toThrow(UnauthorizedException);
  });

  it('401 при auth_date старше часа', () => {
    const stale = String(Math.floor(Date.now() / 1000) - 3700);
    const initData = signInitData(validParams({ auth_date: stale }), BOT_TOKEN);
    expect(() => guard.canActivate(contextFor(`tma ${initData}`))).toThrow(UnauthorizedException);
  });

  it('403 для чужого user.id', () => {
    const user = JSON.stringify({ id: 999, first_name: 'Stranger' });
    const initData = signInitData(validParams({ user }), BOT_TOKEN);
    expect(() => guard.canActivate(contextFor(`tma ${initData}`))).toThrow(ForbiddenException);
  });

  it('401 без заголовка Authorization', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(UnauthorizedException);
  });

  it('401 при не-tma схеме', () => {
    const initData = signInitData(validParams(), BOT_TOKEN);
    expect(() => guard.canActivate(contextFor(`Bearer ${initData}`))).toThrow(
      UnauthorizedException,
    );
  });
});
