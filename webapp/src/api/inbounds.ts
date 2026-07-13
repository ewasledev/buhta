import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { Inbound } from './types';

export function useInbounds() {
  return useQuery({
    queryKey: ['inbounds'],
    queryFn: () => api<Inbound[]>('/inbounds'),
    refetchInterval: 30_000,
  });
}

export function useInbound(id: number | undefined) {
  return useQuery({
    queryKey: ['inbounds', id],
    queryFn: () => api<Inbound>(`/inbounds/${id}`),
    enabled: id !== undefined,
  });
}

export function useInboundOptions() {
  return useQuery({
    queryKey: ['inbound-options'],
    queryFn: () => api<unknown>('/inbounds/options'),
    staleTime: Infinity,
    retry: 0,
  });
}

function useInvalidateInbounds() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['inbounds'] });
}

export function useCreateInbound() {
  const invalidate = useInvalidateInbounds();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Inbound>('/inbounds', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateInbound(id: number) {
  const invalidate = useInvalidateInbounds();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Inbound>(`/inbounds/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteInbound() {
  const invalidate = useInvalidateInbounds();
  return useMutation({
    mutationFn: (id: number) => api<null>(`/inbounds/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSetInboundEnable() {
  const invalidate = useInvalidateInbounds();
  return useMutation({
    mutationFn: (vars: { id: number; enable: boolean }) =>
      api<null>(`/inbounds/${vars.id}/enable`, { method: 'POST', body: { enable: vars.enable } }),
    onSuccess: invalidate,
  });
}

export function useResetInboundTraffic() {
  const invalidate = useInvalidateInbounds();
  return useMutation({
    mutationFn: (id: number) => api<null>(`/inbounds/${id}/reset-traffic`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
