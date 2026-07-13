import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  pingSession,
  ServerAction,
  useServerAction,
  useServerHistory,
  useServerStatus,
  useServerUpdates,
} from '../../api/server';
import { ApiError } from '../../api/client';
import { ErrorState, Skeleton, useToast } from '../../components/common';
import { Sparkline } from '../../components/Sparkline';
import { formatBytes, formatUptime } from '../../utils/format';
import { confirmDialog, haptic } from '../../sdk';

/** Оверлей ожидания рестарта панели: поллинг /session до восстановления. */
function RestartOverlay(props: { onDone: () => void }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      // даём панели время упасть перед первым опросом
      await new Promise((r) => setTimeout(r, 4000));
      while (!stopped) {
        if (await pingSession()) {
          queryClient.invalidateQueries();
          props.onDone();
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sheet-backdrop" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div className="spin" style={{ width: 28, height: 28 }} />
        <div style={{ marginTop: 14 }}>Панель перезапускается…</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Ждём восстановления</div>
      </div>
    </div>
  );
}

export function ServerScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const status = useServerStatus();
  const cpuHistory = useServerHistory('cpu');
  const memHistory = useServerHistory('mem');
  const updates = useServerUpdates();
  const action = useServerAction();
  const [restarting, setRestarting] = useState(false);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);

  const run = async (a: ServerAction, confirmText: string, opts?: { panelRestart?: boolean }) => {
    if (!(await confirmDialog(confirmText))) return;
    haptic();
    action.mutate(a, {
      onSuccess: () => {
        haptic('success');
        if (opts?.panelRestart) setRestarting(true);
        else {
          toast('Готово');
          status.refetch();
          updates.refetch();
        }
      },
      onError: (e) => {
        // рестарт/обновление панели рвёт соединение — 504/сетевую ошибку трактуем как успех
        if (opts?.panelRestart && (!(e instanceof ApiError) || e.status === 504 || e.status === 502)) {
          setRestarting(true);
          return;
        }
        haptic('error');
        toast(e.message);
      },
    });
  };

  const s = status.data;
  const xrayRunning = s?.xray.state === 'running';
  const panelInfo = updates.data?.panelUpdateInfo;
  const versions = updates.data?.xrayVersions ?? [];

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>Сервер</h2>

      {status.isLoading && <Skeleton height={110} count={2} />}
      {status.isError && <ErrorState message="Статус недоступен" onRetry={() => status.refetch()} />}

      {s && (
        <>
          <div className="section" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="stat-label">Xray</div>
                <div className="stat-value">{xrayRunning ? '🟢 работает' : `🔴 ${s.xray.state}`}</div>
                <div className="stat-sub">v{s.xray.version} · аптайм {formatUptime(s.uptime)}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--hint)' }}>
                <div>↑ {formatBytes(s.netIO.up)}/с</div>
                <div>↓ {formatBytes(s.netIO.down)}/с</div>
              </div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">CPU · {Math.round(s.cpu)}%</div>
              <Sparkline points={cpuHistory.data ?? []} max={100} />
            </div>
            <div className="stat-card">
              <div className="stat-label">
                RAM · {Math.round((s.mem.current / s.mem.total) * 100)}%
              </div>
              <Sparkline points={memHistory.data ?? []} max={s.mem.total} />
            </div>
          </div>
        </>
      )}

      <div className="section-title">Управление</div>
      <div className="section" style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
        <button
          className="btn"
          disabled={action.isPending}
          onClick={() => run({ path: '/server/xray/restart', label: '' }, 'Перезапустить xray?')}
        >
          🔄 Перезапустить xray
        </button>
        <div className="row">
          <button
            className="btn danger"
            disabled={action.isPending}
            onClick={() => run({ path: '/server/xray/stop', label: '' }, 'Остановить xray? Все клиенты отключатся.')}
          >
            ⏹ Стоп xray
          </button>
          <button
            className="btn danger"
            disabled={action.isPending}
            onClick={() =>
              run({ path: '/server/panel/restart', label: '' }, 'Перезапустить панель 3x-ui?', { panelRestart: true })
            }
          >
            🔄 Рестарт панели
          </button>
        </div>
      </div>

      <div className="section-title">Обновления</div>
      <div className="section">
        <div className="cell">
          <div className="cell-body">
            <div className="cell-title">Панель 3x-ui</div>
            <div className="cell-sub">
              {updates.isLoading
                ? 'Проверка…'
                : panelInfo?.hasUpdate
                  ? `Доступно: ${panelInfo.latestVersion ?? 'новая версия'}`
                  : 'Актуальная версия'}
            </div>
          </div>
          {panelInfo?.hasUpdate && (
            <button
              className="chip active"
              onClick={() =>
                run({ path: '/server/panel/update', label: '' }, `Обновить панель до ${panelInfo.latestVersion ?? 'последней версии'}?`, { panelRestart: true })
              }
            >
              Обновить
            </button>
          )}
        </div>
        <button className="cell" onClick={() => setVersionPickerOpen(!versionPickerOpen)}>
          <div className="cell-body">
            <div className="cell-title">Версия xray</div>
            <div className="cell-sub">текущая: v{s?.xray.version ?? '—'}</div>
          </div>
          <span style={{ color: 'var(--hint)' }}>{versionPickerOpen ? '▾' : '▸'}</span>
        </button>
        {versionPickerOpen &&
          versions.slice(0, 8).map((v) => (
            <button
              key={v}
              className="cell"
              disabled={action.isPending}
              onClick={() => run({ path: `/server/xray/install/${v}`, label: '' }, `Установить xray ${v}? Xray будет перезапущен.`)}
            >
              <div className="cell-body">
                <div className="cell-title">{v}</div>
              </div>
              {`v${s?.xray.version}` === v && <span>✓</span>}
            </button>
          ))}
      </div>

      <div className="section">
        <button className="cell" onClick={() => navigate('/server/logs')}>
          <div className="cell-body"><div className="cell-title">📜 Логи</div></div>
          <span style={{ color: 'var(--hint)' }}>›</span>
        </button>
      </div>

      {restarting && <RestartOverlay onDone={() => setRestarting(false)} />}
    </div>
  );
}
