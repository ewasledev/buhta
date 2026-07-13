import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useClearClientIps,
  useClientIps,
  useDeletePanelClient,
  usePanelClientAction,
  usePanelClientDetail,
  useUpdatePanelClient,
} from '../../api/panelClients';
import { useBotClients, useLinkBotClient, useUnlinkBotClient } from '../../api/botClients';
import { ErrorState, ProgressBar, Sheet, Skeleton, Switch, useToast } from '../../components/common';
import { QrCode } from '../../components/QrCode';
import { formatBytes, formatExpiry, formatLastOnline, formatTrafficLimit } from '../../utils/format';
import { confirmDialog, haptic } from '../../sdk';
import { ClientTraffic } from '../../api/types';

function linkLabel(link: string): string {
  const hash = link.indexOf('#');
  const name = hash >= 0 ? decodeURIComponent(link.slice(hash + 1)) : '';
  const proto = link.slice(0, link.indexOf(':'));
  return name ? `${proto} · ${name}` : proto;
}

function LinkSheet(props: { email: string; onClose: () => void }) {
  const toast = useToast();
  const botClients = useBotClients();
  const link = useLinkBotClient();
  return (
    <Sheet onClose={props.onClose}>
      <div className="section-title" style={{ marginTop: 4 }}>Привязать к клиенту бота</div>
      {botClients.isLoading && <Skeleton height={52} count={3} />}
      {(botClients.data ?? []).map((bc) => (
        <button
          key={bc.id}
          className="cell"
          disabled={link.isPending}
          onClick={() =>
            link.mutate(
              { id: bc.id, xuiEmail: props.email },
              {
                onSuccess: () => {
                  haptic('success');
                  toast(`Привязано к «${bc.name}»`);
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
            <div className="cell-title">
              {bc.isVip ? '⭐ ' : ''}{bc.name}
            </div>
            <div className="cell-sub">{bc.xuiEmail ? `привязан: ${bc.xuiEmail}` : 'не привязан'}</div>
          </div>
        </button>
      ))}
      {botClients.data?.length === 0 && (
        <div className="cell"><div className="cell-sub">В боте нет клиентов</div></div>
      )}
    </Sheet>
  );
}

export function ClientDetail() {
  const { email = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const detail = usePanelClientDetail(email);
  const update = useUpdatePanelClient(email);
  const action = usePanelClientAction();
  const del = useDeletePanelClient();
  const unlink = useUnlinkBotClient();
  const [ipsOpen, setIpsOpen] = useState(false);
  const [qrLink, setQrLink] = useState<string | null>(null);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const ips = useClientIps(email, ipsOpen);
  const clearIps = useClearClientIps(email);

  if (detail.isLoading) {
    return (
      <div className="page">
        <Skeleton height={140} count={3} />
      </div>
    );
  }
  const client = detail.data?.client;
  if (detail.isError || !client) {
    return (
      <div className="page">
        <ErrorState message="Клиент не найден" onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const trafficRaw = detail.data!.traffic;
  const traffic: ClientTraffic | null = Array.isArray(trafficRaw) ? (trafficRaw[0] ?? null) : trafficRaw;
  const used = (traffic?.up ?? 0) + (traffic?.down ?? 0);
  const pct = client.totalGB > 0 ? (used / client.totalGB) * 100 : 0;
  const links = detail.data!.links ?? [];
  const linked = detail.data!.linkedBotClient;

  const copyLink = async (link: string) => {
    haptic();
    try {
      await navigator.clipboard.writeText(link);
      toast('Ссылка скопирована');
    } catch {
      setQrLink(link);
    }
  };

  const onToggleEnable = (enable: boolean) => {
    haptic();
    update.mutate(
      { ...client, enable },
      {
        onSuccess: () => {
          toast(enable ? 'Клиент включён' : 'Клиент выключен');
          detail.refetch();
        },
        onError: (e) => {
          haptic('error');
          toast(e.message);
        },
      },
    );
  };

  const onResetTraffic = async () => {
    if (!(await confirmDialog(`Сбросить трафик «${email}»?`))) return;
    action.mutate(
      { email, action: 'reset-traffic' },
      {
        onSuccess: () => {
          haptic('success');
          toast('Трафик сброшен');
          detail.refetch();
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  const onDelete = async () => {
    if (!(await confirmDialog(`Удалить клиента «${email}»? Это действие нельзя отменить.`, 'Удаление'))) return;
    del.mutate(email, {
      onSuccess: () => {
        haptic('success');
        toast('Клиент удалён');
        navigate('/clients');
      },
      onError: (e) => {
        haptic('error');
        toast(e.message);
      },
    });
  };

  const onUnlink = async () => {
    if (!linked) return;
    if (!(await confirmDialog(`Отвязать от «${linked.name}»?`))) return;
    unlink.mutate(linked.id, {
      onSuccess: () => {
        haptic('success');
        toast('Отвязано');
        detail.refetch();
      },
      onError: (e) => toast(e.message),
    });
  };

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20, wordBreak: 'break-all' }}>{email}</h2>

      <div className="section" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Трафик</span>
          <span>
            {formatBytes(used)} из {formatTrafficLimit(client.totalGB)}
          </span>
        </div>
        {client.totalGB > 0 && <ProgressBar percent={pct} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--hint)', marginTop: 8 }}>
          <span>↑ {formatBytes(traffic?.up ?? 0)} ↓ {formatBytes(traffic?.down ?? 0)}</span>
          <span>{formatExpiry(client.expiryTime)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--hint)', marginTop: 4 }}>
          <span>Онлайн: {formatLastOnline(detail.data!.lastOnline ?? 0)}</span>
          <span>Лимит устройств: {client.limitIp === 0 ? '∞' : client.limitIp}</span>
        </div>
      </div>

      <div className="section">
        <div className="cell">
          <div className="cell-body"><div className="cell-title">Включён</div></div>
          <Switch checked={client.enable} onChange={onToggleEnable} />
        </div>
        <div className="cell">
          <div className="cell-body">
            <div className="cell-title">Клиент бота</div>
            <div className="cell-sub">{linked ? `${linked.isVip ? '⭐ ' : ''}${linked.name}` : 'не привязан'}</div>
          </div>
          {linked ? (
            <button className="chip" onClick={onUnlink}>Отвязать</button>
          ) : (
            <button className="chip active" onClick={() => setLinkSheetOpen(true)}>Привязать</button>
          )}
        </div>
      </div>

      <div className="section-title">Ссылки подключения ({links.length})</div>
      <div className="section">
        {links.map((link) => (
          <div key={link} className="cell">
            <div className="cell-body" onClick={() => copyLink(link)}>
              <div className="cell-title">{linkLabel(link)}</div>
              <div className="cell-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {link.slice(0, 48)}…
              </div>
            </div>
            <button className="chip" onClick={() => copyLink(link)}>📋</button>
            <button className="chip" onClick={() => setQrLink(link)}>QR</button>
          </div>
        ))}
        {links.length === 0 && (
          <div className="cell"><div className="cell-sub">Ссылок нет (клиент без инбаундов?)</div></div>
        )}
      </div>

      <div className="section">
        <button className="cell" onClick={() => setIpsOpen(!ipsOpen)}>
          <div className="cell-body"><div className="cell-title">IP-адреса</div></div>
          <span style={{ color: 'var(--hint)' }}>{ipsOpen ? '▾' : '▸'}</span>
        </button>
        {ipsOpen && (
          <div style={{ padding: '4px 16px 12px' }}>
            <div className="mono">
              {ips.isLoading
                ? 'Загрузка…'
                : Array.isArray(ips.data)
                  ? ips.data.join('\n') || 'Записей нет'
                  : ips.data || 'Записей нет'}
            </div>
            <button
              className="btn secondary"
              style={{ marginTop: 10 }}
              disabled={clearIps.isPending}
              onClick={() => clearIps.mutate(undefined, { onSuccess: () => toast('IP-лог очищен') })}
            >
              Очистить IP-лог
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button className="btn secondary" onClick={() => navigate(`/clients/${encodeURIComponent(email)}/edit`)}>
          ✏️ Изменить
        </button>
        <button className="btn secondary" disabled={action.isPending} onClick={onResetTraffic}>
          Сбросить трафик
        </button>
        <button className="btn danger" disabled={del.isPending} onClick={onDelete}>
          {del.isPending ? <span className="spin" /> : '🗑 Удалить клиента'}
        </button>
      </div>

      {qrLink && (
        <Sheet onClose={() => setQrLink(null)}>
          <div style={{ display: 'grid', placeItems: 'center', padding: '10px 16px 6px', gap: 12 }}>
            <QrCode value={qrLink} />
            <div className="cell-sub" style={{ textAlign: 'center' }}>{linkLabel(qrLink)}</div>
            <button className="btn" style={{ width: '100%' }} onClick={() => copyLink(qrLink)}>
              Скопировать ссылку
            </button>
          </div>
        </Sheet>
      )}
      {linkSheetOpen && <LinkSheet email={email} onClose={() => setLinkSheetOpen(false)} />}
    </div>
  );
}
