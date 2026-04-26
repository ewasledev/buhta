export function formatDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function parseDate(str: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(str.trim());
  if (!match) return null;
  const d = new Date(+match[3], +match[2] - 1, +match[1]);
  return isNaN(d.getTime()) ? null : d;
}

export function isDateInFuture(date: Date): boolean {
  return date > new Date();
}

export function isActive(endDate: Date): boolean {
  return new Date(endDate) > new Date();
}

export function statusLabel(endDate: Date): string {
  return isActive(endDate) ? '✅ активна' : '❌ истекла';
}
