import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { XuiService } from './xui.service';
import { XuiApiError, XuiAuthError, XuiConnectionError } from './xui.errors';

const BASE = 'https://panel.example:2053/RaNdOmPaTh';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(
  body: unknown,
  { status = 200, contentType = 'application/json', setCookie = [] as string[] } = {},
) {
  return {
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
      getSetCookie: () => setCookie,
    },
    json: async () => body,
  };
}

const csrfOk = (token = 'CSRF-PRE') =>
  jsonResponse({ success: true, msg: '', obj: token }, { setCookie: ['3x-ui=PRE; Path=/'] });

const loginOk = () =>
  jsonResponse({ success: true, msg: 'ok' }, { setCookie: ['3x-ui=SESSION1; Path=/; HttpOnly'] });

/**
 * Полная успешная последовательность логина: csrf → login → csrf сессии.
 * Второй /csrf-token, как и реальная панель, cookie НЕ выставляет.
 */
function mockLogin(fetchMock: FetchMock) {
  fetchMock
    .mockResolvedValueOnce(csrfOk('CSRF-PRE'))
    .mockResolvedValueOnce(loginOk())
    .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 'CSRF-SESSION' }));
}

const LOGIN_URLS = [`${BASE}/csrf-token`, `${BASE}/login`, `${BASE}/csrf-token`];

describe('XuiService', () => {
  let service: XuiService;
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'XUI_BASE_URL') return BASE;
        if (key === 'XUI_USERNAME') return 'admin';
        if (key === 'XUI_PASSWORD') return 'secret';
        return undefined;
      }),
    };
    service = new XuiService(config as unknown as ConfigService);
  });

  it('логин: csrf → login с X-CSRF-Token → csrf сессии; envelope разворачивается', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: { cpu: 5 } }));

    const status = await service.serverStatus();

    expect(status).toEqual({ cpu: 5 });
    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls).toEqual([...LOGIN_URLS, `${BASE}/panel/api/server/status`]);

    const [, loginInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(loginInit.body)).toEqual({
      username: 'admin',
      password: 'secret',
      twoFactorCode: '',
    });
    // login идёт с pre-session cookie и pre-session csrf-токеном
    expect(loginInit.headers.Cookie).toBe('3x-ui=PRE');
    expect(loginInit.headers['X-CSRF-Token']).toBe('CSRF-PRE');
    // API-запрос — уже с cookie сессии
    const [, apiInit] = fetchMock.mock.calls[3];
    expect(apiInit.headers.Cookie).toBe('3x-ui=SESSION1');
    expect(apiInit.redirect).toBe('manual');
  });

  it('POST-запросы несут X-CSRF-Token сессии', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: [] }));

    await service.onlines();

    const [url, init] = fetchMock.mock.calls[3];
    expect(url).toBe(`${BASE}/panel/api/clients/onlines`);
    expect(init.method).toBe('POST');
    expect(init.headers['X-CSRF-Token']).toBe('CSRF-SESSION');
  });

  it('success:false → XuiApiError с msg панели', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, msg: 'Duplicate email' }));
    await expect(service.serverStatus()).rejects.toThrow(XuiApiError);

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, msg: 'Duplicate email' }));
    await expect(service.serverStatus()).rejects.toThrow('Duplicate email');
  });

  it.each([[401], [403], [302]])('%s на запросе → ровно один релогин и retry', async (code) => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: code }));
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 'data' }));

    await expect(service.serverStatus()).resolves.toBe('data');
    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls).toEqual([
      ...LOGIN_URLS,
      `${BASE}/panel/api/server/status`,
      ...LOGIN_URLS,
      `${BASE}/panel/api/server/status`,
    ]);
  });

  it('HTML-ответ со статусом 200 → релогин и retry', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse('<html>login</html>', { contentType: 'text/html; charset=utf-8' }),
    );
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 1 }));

    await expect(service.serverStatus()).resolves.toBe(1);
  });

  it('повторный 401 после релогина → XuiAuthError', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 401 }));
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 401 }));

    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('сетевая ошибка → XuiConnectionError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(service.serverStatus()).rejects.toThrow(XuiConnectionError);
  });

  it('403 на самом /login (без csrf-флоу панель бы отдала 403) → XuiAuthError', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfOk())
      .mockResolvedValueOnce(jsonResponse(null, { status: 403, contentType: 'text/plain' }));
    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);
  });

  it('csrf-token не вернул токен → XuiAuthError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, msg: 'nope' }));
    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);
  });

  it('параллельные запросы без сессии → один логин-флоу', async () => {
    let resolveLogin: (v: unknown) => void;
    let csrfCalls = 0;
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (url.endsWith('/csrf-token')) {
        csrfCalls += 1;
        return Promise.resolve(csrfOk(`CSRF-${csrfCalls}`));
      }
      if (url.endsWith('/login')) {
        return new Promise((resolve) => {
          resolveLogin = resolve;
        });
      }
      void init;
      return Promise.resolve(jsonResponse({ success: true, msg: '', obj: 'ok' }));
    });

    const p1 = service.serverStatus();
    const p2 = service.onlines();
    await new Promise((r) => setTimeout(r, 0));
    resolveLogin!(loginOk());

    await expect(Promise.all([p1, p2])).resolves.toEqual(['ok', 'ok']);
    const loginCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('/login'));
    expect(loginCalls).toHaveLength(1);
  });

  it('неудачный логин не блокирует последующие попытки', async () => {
    fetchMock
      .mockResolvedValueOnce(csrfOk())
      .mockResolvedValueOnce(jsonResponse({ success: false, msg: 'bad creds' }));
    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);

    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 42 }));
    await expect(service.serverStatus()).resolves.toBe(42);
  });

  it('кодирует email в пути', async () => {
    mockLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: null }));

    await service.getPanelClient('user+1@mail.ru');

    const [url] = fetchMock.mock.calls[3];
    expect(url).toBe(`${BASE}/panel/api/clients/get/user%2B1%40mail.ru`);
  });
});
