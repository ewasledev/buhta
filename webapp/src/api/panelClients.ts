import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { PagedClients, PanelClientDetail } from './types';

const PAGE_SIZE = 25;

export function usePanelClients(params: { q?: string; status?: string; inboundId?: number }) {
  return useInfiniteQuery({
    queryKey: ['panel-clients', params],
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (params.q) search.set('q', params.q);
      if (params.status) search.set('status', params.status);
      if (params.inboundId) search.set('inboundId', String(params.inboundId));
      return api<PagedClients>(`/panel-clients?${search.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.filtered ? last.page + 1 : undefined,
  });
}

export function useOnlines() {
  return useQuery({
    queryKey: ['onlines'],
    queryFn: () => api<string[]>('/panel-clients/onlines'),
    refetchInterval: 15_000,
    retry: 0,
  });
}

export function usePanelClientDetail(email: string | undefined) {
  return useQuery({
    queryKey: ['panel-clients', 'detail', email],
    queryFn: () => api<PanelClientDetail>(`/panel-clients/${encodeURIComponent(email!)}`),
    enabled: !!email,
  });
}

export function useInvalidatePanelClients() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['panel-clients'] });
    queryClient.invalidateQueries({ queryKey: ['bot-clients'] });
  };
}

export function useCreatePanelClient() {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (body: { client: Record<string, unknown>; inboundIds: number[] }) =>
      api('/panel-clients', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdatePanelClient(email: string) {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/panel-clients/${encodeURIComponent(email)}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeletePanelClient() {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (email: string) =>
      api(`/panel-clients/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function usePanelClientAction() {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (vars: { email: string; action: 'reset-traffic' }) =>
      api(`/panel-clients/${encodeURIComponent(vars.email)}/${vars.action}`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useClientIps(email: string, enabled: boolean) {
  return useQuery({
    queryKey: ['panel-clients', 'ips', email],
    queryFn: () => api<string[] | string>(`/panel-clients/${encodeURIComponent(email)}/ips`),
    enabled,
    retry: 0,
  });
}

export function useClearClientIps(email: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/panel-clients/${encodeURIComponent(email)}/ips`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['panel-clients', 'ips', email] }),
  });
}

export function useBulkAdjust() {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (body: { emails: string[]; addDays?: number; addBytes?: number }) =>
      api('/panel-clients/bulk-adjust', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useCleanup() {
  const invalidate = useInvalidatePanelClients();
  return useMutation({
    mutationFn: (mode: 'depleted' | 'orphans') =>
      api('/panel-clients/cleanup', { method: 'POST', body: { mode } }),
    onSuccess: invalidate,
  });
}
