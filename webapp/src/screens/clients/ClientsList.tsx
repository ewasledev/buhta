import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBulkAdjust, useCleanup, useOnlines, usePanelClients } from '../../api/panelClients';
import { Dot, EmptyState, ErrorState, Skeleton, useToast } from '../../components/common';
import { formatBytes, formatExpiry, formatTrafficLimit } from '../../utils/format';
import { confirmDialog, haptic } from '../../sdk';

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'online', label: 'Онлайн' },
  { key: 'active', label: 'Включённые' },
  { key: 'depleted', label: 'Истёкшие' },
];

export function ClientsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('filter') ?? '';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = usePanelClients({ q: debounced, status: status || undefined });
  const onlines = useOnlines();
  const onlineSet = useMemo(() => new Set(onlines.data ?? []), [onlines.data]);
  const bulkAdjust = useBulkAdjust();
  const cleanup = useCleanup();

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const totalFiltered = query.data?.pages[0]?.filtered;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [query]);

  const toggleSelect = (email: string) => {
    haptic();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const onExtend = async () => {
    if (selected.size === 0) return;
    if (!(await confirmDialog(`Продлить ${selected.size} клиент(ов) на 30 дней?`))) return;
    bulkAdjust.mutate(
      { emails: [...selected], addDays: 30 },
      {
        onSuccess: () => {
          haptic('success');
          toast('Продлено на 30 дней');
          setBulkMode(false);
          setSelected(new Set());
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  const onCleanup = async (mode: 'depleted' | 'orphans') => {
    const label = mode === 'depleted' ? 'исчерпанных/истёкших' : 'без инбаундов';
    if (!(await confirmDialog(`Удалить всех клиентов ${label}? Это действие нельзя отменить.`, 'Чистка'))) return;
    cleanup.mutate(mode, {
      onSuccess: () => {
        haptic('success');
        toast('Чистка выполнена');
      },
      onError: (e) => toast(e.message),
    });
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          Клиенты{totalFiltered !== undefined ? ` (${totalFiltered})` : ''}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`chip ${bulkMode ? 'active' : ''}`}
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelected(new Set());
            }}
          >
            ⋯
          </button>
          <button className="chip" onClick={() => navigate('/link')}>🔗</button>
          <button className="chip" onClick={() => navigate('/clients/new')}>＋</button>
        </div>
      </div>

      <input
        className="search"
        placeholder="Поиск по email / subId / комментарию"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${status === f.key ? 'active' : ''}`}
            onClick={() => setSearchParams(f.key ? { filter: f.key } : {})}
          >
            {f.label}
          </button>
        ))}
      </div>

      {bulkMode && (
        <div className="section" style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
          <button className="btn" disabled={selected.size === 0 || bulkAdjust.isPending} onClick={onExtend}>
            ＋30 дней выбранным ({selected.size})
          </button>
          <div className="row">
            <button className="btn danger" disabled={cleanup.isPending} onClick={() => onCleanup('depleted')}>
              Удалить истёкших
            </button>
            <button className="btn danger" disabled={cleanup.isPending} onClick={() => onCleanup('orphans')}>
              Удалить сирот
            </button>
          </div>
        </div>
      )}

      {query.isLoading && <Skeleton height={68} count={5} />}
      {query.isError && <ErrorState message="Не удалось загрузить клиентов" onRetry={() => query.refetch()} />}
      {!query.isLoading && items.length === 0 && !query.isError && (
        <EmptyState icon="👥" text="Клиентов не найдено" hint={debounced ? 'Измените поиск или фильтр' : 'Создайте первого кнопкой ＋'} />
      )}

      {items.length > 0 && (
        <div className="section">
          {items.map((c) => (
            <button
              key={c.email}
              className="cell"
              onClick={() =>
                bulkMode ? toggleSelect(c.email) : navigate(`/clients/${encodeURIComponent(c.email)}`)
              }
            >
              {bulkMode ? (
                <span style={{ fontSize: 18 }}>{selected.has(c.email) ? '☑️' : '⬜'}</span>
              ) : (
                <Dot
                  color={
                    onlineSet.has(c.email)
                      ? 'var(--success)'
                      : c.enable
                        ? 'var(--hint)'
                        : 'var(--danger)'
                  }
                />
              )}
              <div className="cell-body">
                <div className="cell-title">{c.email}</div>
                <div className="cell-sub">
                  {formatBytes((c.traffic?.up ?? 0) + (c.traffic?.down ?? 0))} из{' '}
                  {formatTrafficLimit(c.totalGB)} · {formatExpiry(c.expiryTime)}
                </div>
              </div>
              <span style={{ color: 'var(--hint)' }}>›</span>
            </button>
          ))}
          <div ref={sentinel} style={{ height: 4 }} />
          {query.isFetchingNextPage && <Skeleton height={48} />}
        </div>
      )}
    </div>
  );
}
