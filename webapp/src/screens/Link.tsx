import { useEffect, useState } from 'react';
import { useBotClients, useLinkBotClient, useUnlinkBotClient } from '../api/botClients';
import { usePanelClients } from '../api/panelClients';
import { EmptyState, ErrorState, PageHeader, Sheet, Skeleton, useToast } from '../components/common';
import { Icon } from '../components/Icon';
import { BotClient } from '../api/types';
import { formatDate } from '../utils/format';
import { confirmDialog, haptic } from '../sdk';

function EmailPickerSheet(props: { botClient: BotClient; onClose: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const clients = usePanelClients({ q: debounced });
  const link = useLinkBotClient();
  const items = clients.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Sheet onClose={props.onClose}>
      <div className="section-title" style={{ marginTop: 4 }}>
        Email панели для «{props.botClient.name}»
      </div>
      <div style={{ padding: '0 16px' }}>
        <input
          className="search"
          placeholder="Поиск email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {clients.isLoading && <Skeleton height={48} count={3} />}
      {items.map((c) => (
        <button
          key={c.email}
          className="cell"
          disabled={link.isPending}
          onClick={() =>
            link.mutate(
              { id: props.botClient.id, xuiEmail: c.email },
              {
                onSuccess: () => {
                  haptic('success');
                  toast('Привязано');
                  props.onClose();
                },
                onError: (e) => {
                  haptic('error');
                  toast(e.message);
                },
              },
            )
          }
        >
          <div className="cell-body">
            <div className="cell-title">{c.email}</div>
          </div>
        </button>
      ))}
      {!clients.isLoading && items.length === 0 && (
        <div className="cell"><div className="cell-sub">Ничего не найдено</div></div>
      )}
      {clients.hasNextPage && (
        <div style={{ padding: '4px 16px' }}>
          <button className="btn secondary" onClick={() => clients.fetchNextPage()}>
            Показать ещё
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function LinkScreen() {
  const toast = useToast();
  const botClients = useBotClients();
  const unlink = useUnlinkBotClient();
  const [picker, setPicker] = useState<BotClient | null>(null);

  const onUnlink = async (bc: BotClient) => {
    if (!(await confirmDialog(`Отвязать «${bc.name}» от ${bc.xuiEmail}?`))) return;
    unlink.mutate(bc.id, {
      onSuccess: () => {
        haptic('success');
        toast('Отвязано');
      },
      onError: (e) => toast(e.message),
    });
  };

  return (
    <div className="page">
      <PageHeader title="Привязка клиентов" />
      <div className="cell-sub" style={{ margin: '-6px 0 12px' }}>
        Клиент бота ↔ клиент панели 3x-ui
      </div>

      {botClients.isLoading && <Skeleton height={64} count={4} />}
      {botClients.isError && (
        <ErrorState message="Не удалось загрузить клиентов бота" onRetry={() => botClients.refetch()} />
      )}
      {botClients.data?.length === 0 && (
        <EmptyState icon="users" text="В боте пока нет клиентов" />
      )}

      {(botClients.data ?? []).length > 0 && (
        <div className="section">
          {(botClients.data ?? []).map((bc) => (
            <div key={bc.id} className="cell">
              <div className="cell-body">
                <div className="cell-title">
                  {bc.isVip && <Icon name="star" size={14} filled style={{ color: 'var(--warn)', verticalAlign: -1, marginRight: 4 }} />}
                  {bc.name}
                </div>
                <div className="cell-sub">
                  {bc.subscriptionEnd ? `подписка до ${formatDate(new Date(bc.subscriptionEnd))}` : 'нет подписки'}
                  {' · '}
                  {bc.xuiEmail || 'не привязан'}
                </div>
              </div>
              {bc.xuiEmail ? (
                <button className="chip" disabled={unlink.isPending} onClick={() => onUnlink(bc)}>
                  Отвязать
                </button>
              ) : (
                <button className="chip active" onClick={() => setPicker(bc)}>
                  Привязать
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {picker && <EmailPickerSheet botClient={picker} onClose={() => setPicker(null)} />}
    </div>
  );
}
