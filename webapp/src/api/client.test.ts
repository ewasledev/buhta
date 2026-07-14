import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sdk', () => ({ getInitDataRaw: () => 'test-init-data' }));

import { api } from './client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('возвращает undefined при успешном ответе с пустым телом (201 без тела)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await expect(api('/panel-clients', { method: 'POST', body: {} })).resolves.toBeUndefined();
  });

  it('парсит JSON-тело успешного ответа', async () => {
    fetchMock.mockResolvedValue(new Response('{"a":1}', { status: 200 }));
    await expect(api('/x')).resolves.toEqual({ a: 1 });
  });

  it('бросает ApiError с message из JSON-тела ошибки', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Плохой запрос' }), { status: 400 }),
    );
    await expect(api('/x')).rejects.toMatchObject({ message: 'Плохой запрос', status: 400 });
  });

  it('бросает generic ApiError, если тело ошибки не JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 500 }));
    await expect(api('/x')).rejects.toMatchObject({ message: 'Ошибка 500', status: 500 });
  });

  it('бросает ApiError (не SyntaxError), если успешный ответ не JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>proxy</html>', { status: 200 }));
    await expect(api('/x')).rejects.toMatchObject({ name: 'ApiError', status: 200 });
  });

  it('шлёт Authorization с initData', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await api('/x');
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('tma test-init-data');
  });
});
