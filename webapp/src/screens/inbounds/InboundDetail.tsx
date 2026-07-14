import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useDeleteInbound,
  useInbound,
  useResetInboundTraffic,
  useSetInboundEnable,
} from '../../api/inbounds';
import { Dot, ErrorState, Skeleton, Switch, useToast } from '../../components/common';
import { formatBytes, formatExpiry } from '../../utils/format';
import { confirmDialog, haptic } from '../../sdk';

export function InboundDetail() {
  const { id } = useParams();
  const inboundId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: inbound, isLoading, isError, refetch } = useInbound(inboundId);
  const setEnable = useSetInboundEnable();
  const resetTraffic = useResetInboundTraffic();
  const del = useDeleteInbound();
  const [clientsOpen, setClientsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="page">
        <Skeleton height={120} count={3} />
      </div>
    );
  }
  if (isError || !inbound) {
    return (
      <div className="page">
        <ErrorState message="Инбаунд не найден" onRetry={() => refetch()} />
      </div>
    );
  }

  const onToggle = (enable: boolean) => {
    haptic();
    setEnable.mutate(
      { id: inboundId, enable },
      {
        onSuccess: () => toast(enable ? 'Инбаунд включён' : 'Инбаунд выключен'),
        onError: (e) => {
          haptic('error');
          toast(e.message);
        },
      },
    );
  };

  const onResetTraffic = async () => {
    if (!(await confirmDialog(`Сбросить трафик инбаунда «${inbound.remark}»?`))) return;
    resetTraffic.mutate(inboundId, {
      onSuccess: () => {
        haptic('success');
        toast('Трафик сброшен');
      },
      onError: (e) => toast(e.message),
    });
  };

  const onDelete = async () => {
    const ok = await confirmDialog(
      `Удалить инбаунд «${inbound.remark}» и всех его клиентов? Это действие нельзя отменить.`,
      'Удаление',
    );
    if (!ok) return;
    del.mutate(inboundId, {
      onSuccess: () => {
        haptic('success');
        toast('Инбаунд удалён');
        navigate('/inbounds');
      },
      onError: (e) => {
        haptic('error');
        toast(e.message);
      },
    });
  };

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>
        {inbound.remark || `Инбаунд #${inbound.id}`}
      </h2>

      <div className="section">
        <div className="cell">
          <div className="cell-body">
            <div className="cell-title">Включён</div>
          </div>
          <Switch checked={inbound.enable} onChange={onToggle} />
        </div>
        <div className="cell">
          <div className="cell-body">
            <div className="cell-title">{inbound.protocol}</div>
            <div className="cell-sub">
              порт {inbound.port}
              {inbound.listen ? ` · listen ${inbound.listen}` : ''} · {formatExpiry(inbound.expiryTime)}
            </div>
          </div>
        </div>
        <div className="cell">
          <div className="cell-body">
            <div className="cell-title">
              ↑ {formatBytes(inbound.up)} ↓ {formatBytes(inbound.down)}
            </div>
            <div className="cell-sub">
              лимит: {inbound.total === 0 ? '∞' : formatBytes(inbound.total)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
        <button className="btn" onClick={() => navigate(`/clients/new?inboundId=${inbound.id}`)}>
          ＋ Добавить клиента
        </button>
        <div className="row">
          <button className="btn secondary" onClick={() => navigate(`/inbounds/${inbound.id}/edit`)}>
            ✏️ Изменить
          </button>
          <button className="btn danger" disabled={del.isPending} onClick={onDelete}>
            {del.isPending ? <span className="spin" /> : '🗑 Удалить'}
          </button>
        </div>
        <button className="btn secondary" disabled={resetTraffic.isPending} onClick={onResetTraffic}>
          ♻️ Сбросить трафик
        </button>
      </div>

      <div className="section">
        <button className="cell" onClick={() => setClientsOpen(!clientsOpen)}>
          <div className="cell-body">
            <div className="cell-title">Клиенты ({inbound.clientStats?.length ?? 0})</div>
          </div>
          <span style={{ color: 'var(--hint)' }}>{clientsOpen ? '▾' : '▸'}</span>
        </button>
        {clientsOpen &&
          (inbound.clientStats ?? []).map((c) => (
            <button
              key={c.email}
              className="cell"
              onClick={() => navigate(`/clients/${encodeURIComponent(c.email)}`)}
            >
              <Dot color={c.enable ? 'var(--success)' : 'var(--hint)'} />
              <div className="cell-body">
                <div className="cell-title">{c.email}</div>
                <div className="cell-sub">↑ {formatBytes(c.up)} ↓ {formatBytes(c.down)}</div>
              </div>
              <span style={{ color: 'var(--hint)' }}>›</span>
            </button>
          ))}
        {clientsOpen && (inbound.clientStats ?? []).length === 0 && (
          <div className="cell"><div className="cell-sub">Клиентов нет</div></div>
        )}
      </div>
    </div>
  );
}
