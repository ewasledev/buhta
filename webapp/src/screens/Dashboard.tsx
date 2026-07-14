import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Dashboard as DashboardData, Session } from '../api/types';
import { Dot, ErrorState, PageHeader, Sheet, Skeleton, StatCard, useToast } from '../components/common';
import { Icon } from '../components/Icon';
import { formatBytes, formatUptime } from '../utils/format';
import { haptic } from '../sdk';

function SettingsSheet(props: { onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<Session>('/session'),
  });

  const act = useMutation({
    mutationFn: (path: string) => api<{ ok: boolean }>(`/session/${path}`, { method: 'POST' }),
    onSuccess: (_, path) => {
      haptic('success');
      toast(path === 'login' ? 'Сессия панели обновлена' : 'Логаут выполнен');
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => {
      haptic('error');
      toast(e.message);
    },
  });

  const panel = session.data?.panel;
  return (
    <Sheet onClose={props.onClose}>
      <div className="section-title" style={{ marginTop: 4 }}>Сессия</div>
      <div className="cell">
        {!session.isLoading && (
          <Dot
            color={panel?.available ? 'var(--success)' : 'var(--danger)'}
            live={panel?.available}
          />
        )}
        <div className="cell-body">
          <div className="cell-title">
            {session.isLoading
              ? 'Проверка…'
              : panel?.available
                ? 'Панель доступна'
                : 'Панель недоступна'}
          </div>
          {panel?.available && (
            <div className="cell-sub">
              xray: {panel.xrayState} {panel.xrayVersion && `· v${panel.xrayVersion}`}
            </div>
          )}
          {session.data && (
            <div className="cell-sub">
              Пользователь: {session.data.user.first_name ?? session.data.user.id}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 16px', display: 'grid', gap: 8 }}>
        <button className="btn" disabled={act.isPending} onClick={() => act.mutate('login')}>
          {act.isPending ? <span className="spin" /> : 'Переподключиться к панели'}
        </button>
        <button className="btn danger" disabled={act.isPending} onClick={() => act.mutate('logout')}>
          Логаут из панели
        </button>
      </div>
    </Sheet>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="page">
        <Skeleton height={84} count={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page">
        <ErrorState message="Не удалось загрузить обзор" onRetry={() => refetch()} />
      </div>
    );
  }

  const { status, onlines, inbounds, updateInfo } = data;
  const memPct = status ? (status.mem.current / status.mem.total) * 100 : 0;
  const diskPct = status ? (status.disk.current / status.disk.total) * 100 : 0;
  const xrayRunning = status?.xray.state === 'running';

  return (
    <div className="page">
      <PageHeader title="Обзор">
        <button className="icon-btn" aria-label="Сессия панели" onClick={() => setSettingsOpen(true)}>
          <Icon name="sliders" size={19} />
        </button>
      </PageHeader>

      {updateInfo?.hasUpdate && (
        <button className="banner" onClick={() => navigate('/server')}>
          <Icon name="arrow-up" size={18} />
          <span>
            Доступно обновление панели {updateInfo.latestVersion && <b>{updateInfo.latestVersion}</b>}
          </span>
        </button>
      )}

      {status ? (
        <>
          <section className="hero">
            <Dot color={xrayRunning ? 'var(--success)' : 'var(--danger)'} live={xrayRunning} />
            <div className="hero-body">
              <div className="hero-title">
                {xrayRunning ? 'Xray работает' : `Xray: ${status.xray.state}`}
              </div>
              <div className="hero-sub">
                {status.xray.version && `v${status.xray.version} · `}
                аптайм {formatUptime(status.uptime)}
                {inbounds ? ` · инбаундов: ${inbounds.length}` : ''}
              </div>
            </div>
            <button className="hero-online" onClick={() => navigate('/clients?filter=online')}>
              <span className="num">{onlines ? onlines.length : '—'}</span>
              <span className="lbl">онлайн</span>
            </button>
          </section>

          <div className="stat-grid">
            <StatCard
              label="CPU"
              value={`${Math.round(status.cpu)}%`}
              sub={status.cpuCores ? `${status.cpuCores} ядер` : undefined}
              progress={status.cpu}
            />
            <StatCard
              label="Память"
              value={`${Math.round(memPct)}%`}
              sub={`${formatBytes(status.mem.current)} из ${formatBytes(status.mem.total)}`}
              progress={memPct}
            />
            <StatCard
              label="Диск"
              value={`${Math.round(diskPct)}%`}
              sub={`${formatBytes(status.disk.current)} из ${formatBytes(status.disk.total)}`}
              progress={diskPct}
            />
            <StatCard
              label="Сеть"
              value={`↑ ${formatBytes(status.netIO.up)}/с`}
              sub={`↓ ${formatBytes(status.netIO.down)}/с`}
            />
          </div>
        </>
      ) : (
        <ErrorState message="Статус сервера недоступен" onRetry={() => refetch()} />
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
