const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const exp = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = Math.round((bytes / 2 ** (exp * 10)) * 100) / 100;
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${UNITS[exp]}`;
}

/** Лимит трафика: 0 = безлимит. */
export function formatTrafficLimit(bytes: number): string {
  return bytes === 0 ? '∞' : formatBytes(bytes);
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatDate(msEpoch: number | Date): string {
  const d = msEpoch instanceof Date ? msEpoch : new Date(msEpoch);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Срок действия: 0 = бессрочно. */
export function formatExpiry(msEpoch: number): string {
  return msEpoch === 0 ? 'Бессрочно' : `до ${formatDate(msEpoch)}`;
}

/** Последний онлайн (unix-секунды): сегодня / вчера / N дн назад. */
export function formatLastOnline(unixSeconds: number): string {
  if (!unixSeconds) return 'никогда';
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн назад`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}
