import { getInitDataRaw } from '../sdk';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let initDataRaw: string | undefined;

export function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (initDataRaw === undefined) initDataRaw = getInitDataRaw() ?? '';
  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(initDataRaw ? { Authorization: `tma ${initDataRaw}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      let message = `Ошибка ${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) {
          message = Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
        }
      } catch {
        // тело не JSON — оставляем generic-сообщение
      }
      throw new ApiError(message, res.status);
    }
    // 3x-ui возвращает obj: null на ряде мутаций → Nest отдаёт пустое тело; res.json() на нём падает
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  });
}
