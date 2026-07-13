const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const exp = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 2 ** (exp * 10);
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${UNITS[exp]}`;
}
