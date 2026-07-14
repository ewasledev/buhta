import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from './client';
import { HistoryPoint, ServerStatus, ServerUpdates } from './types';

export function useServerStatus() {
  return useQuery({
    queryKey: ['server-status'],
    queryFn: () => api<ServerStatus>('/server/status'),
    refetchInterval: 5_000,
  });
}

export function useServerHistory(metric: 'cpu' | 'mem', bucket = 60) {
  return useQuery({
    queryKey: ['server-history', metric, bucket],
    queryFn: () => api<HistoryPoint[]>(`/server/history/${metric}/${bucket}`),
    refetchInterval: 60_000,
    retry: 0,
  });
}

export function useServerUpdates() {
  return useQuery({
    queryKey: ['server-updates'],
    queryFn: () => api<ServerUpdates>('/server/updates'),
    staleTime: 60_000,
  });
}

export type ServerAction =
  | { path: '/server/xray/restart'; label: string }
  | { path: '/server/xray/stop'; label: string }
  | { path: '/server/panel/restart'; label: string }
  | { path: '/server/panel/update'; label: string }
  | { path: `/server/xray/install/${string}`; label: string };

export function useServerAction() {
  return useMutation({
    mutationFn: (action: ServerAction) => api(action.path, { method: 'POST' }),
  });
}

export function useLogs(kind: 'panel' | 'xray', count: number) {
  return useQuery({
    queryKey: ['logs', kind, count],
    queryFn: () =>
      api<string>(kind === 'panel' ? `/server/logs?count=${count}` : `/server/xray-logs?count=${count}`),
    refetchOnMount: 'always',
  });
}

export function useNewX25519() {
  return useMutation({
    mutationFn: () => api<{ privateKey: string; publicKey: string }>('/server/new-x25519'),
  });
}

export function pingSession(): Promise<boolean> {
  return api<{ panel: { available: boolean } }>('/session')
    .then((s) => s.panel.available)
    .catch(() => false);
}
