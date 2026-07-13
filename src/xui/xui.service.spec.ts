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

const loginOk = () =>
  jsonResponse({ success: true, msg: 'ok' }, { setCookie: ['3x-ui=SESSION1; Path=/; HttpOnly'] });

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

  it('логинится, сохраняет cookie и разворачивает envelope', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: { cpu: 5 } }));

    const status = await service.serverStatus();

    expect(status).toEqual({ cpu: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe(`${BASE}/login`);
    expect(JSON.parse(loginInit.body)).toEqual({
      username: 'admin',
      password: 'secret',
      twoFactorCode: '',
    });
    const [, apiInit] = fetchMock.mock.calls[1];
    expect(apiInit.headers.Cookie).toBe('3x-ui=SESSION1');
    expect(apiInit.redirect).toBe('manual');
  });

  it('success:false → XuiApiError с msg панели', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: false, msg: 'Duplicate email' }));

    await expect(service.serverStatus()).rejects.toThrow(XuiApiError);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, msg: 'Duplicate email' }));
    await expect(service.serverStatus()).rejects.toThrow('Duplicate email');
  });

  it('401 → ровно один релогин и retry', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk()) // первичный логин
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 })) // протухло
      .mockResolvedValueOnce(loginOk()) // релогин
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 'data' }));

    const result = await service.serverStatus();

    expect(result).toBe('data');
    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls).toEqual([
      `${BASE}/login`,
      `${BASE}/panel/api/server/status`,
      `${BASE}/login`,
      `${BASE}/panel/api/server/status`,
    ]);
  });

  it('HTML-ответ со статусом 200 → релогин и retry', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse('<html>login</html>', { contentType: 'text/html; charset=utf-8' }))
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 1 }));

    await expect(service.serverStatus()).resolves.toBe(1);
  });

  it('3xx → релогин и retry', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({}, { status: 302 }))
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 1 }));

    await expect(service.serverStatus()).resolves.toBe(1);
  });

  it('повторный 401 после релогина → XuiAuthError', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 }));

    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('сетевая ошибка → XuiConnectionError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(service.serverStatus()).rejects.toThrow(XuiConnectionError);
  });

  it('параллельные запросы без сессии → один /login', async () => {
    let resolveLogin: (v: unknown) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/login')) {
        return new Promise((resolve) => {
          resolveLogin = resolve;
        });
      }
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, msg: 'bad creds' }));
    await expect(service.serverStatus()).rejects.toThrow(XuiAuthError);

    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: 42 }));
    await expect(service.serverStatus()).resolves.toBe(42);
  });

  it('кодирует email в пути', async () => {
    fetchMock
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(jsonResponse({ success: true, msg: '', obj: null }));

    await service.getPanelClient('user+1@mail.ru');

    const [url] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/panel/api/clients/get/user%2B1%40mail.ru`);
  });
});
