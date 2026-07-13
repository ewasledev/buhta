import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { BotClient } from './types';

export function useBotClients() {
  return useQuery({
    queryKey: ['bot-clients'],
    queryFn: () => api<BotClient[]>('/bot-clients'),
  });
}

function useInvalidateLinks() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['bot-clients'] });
    queryClient.invalidateQueries({ queryKey: ['panel-clients'] });
  };
}

export function useLinkBotClient() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (vars: { id: number; xuiEmail: string }) =>
      api(`/bot-clients/${vars.id}/link`, { method: 'POST', body: { xuiEmail: vars.xuiEmail } }),
    onSuccess: invalidate,
  });
}

export function useUnlinkBotClient() {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (id: number) => api(`/bot-clients/${id}/link`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
