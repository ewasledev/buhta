import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBulkAdjust, useCleanup, useOnlines, usePanelClients } from '../../api/panelClients';
import { Checkbox, Chevron, Dot, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '../../components/common';
import { Icon } from '../../components/Icon';
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
      <PageHeader
        title={
          <>
            Клиенты
            {totalFiltered !== undefined && <span className="count">{totalFiltered}</span>}
          </>
        }
      >
        <button
          className={`icon-btn ${bulkMode ? 'active' : ''}`}
          aria-label="Выбрать несколько"
          style={bulkMode ? { background: 'var(--button)', color: 'var(--button-text)' } : undefined}
          onClick={() => {
            setBulkMode(!bulkMode);
            setSelected(new Set());
          }}
        >
          <Icon name="check" size={18} />
        </button>
        <button className="icon-btn" aria-label="Привязка клиентов" onClick={() => navigate('/link')}>
          <Icon name="link" size={18} />
        </button>
        <button className="chip active" onClick={() => navigate('/clients/new')}>
          <Icon name="plus" size={16} /> Клиент
        </button>
      </PageHeader>

      <div className="search-wrap">
        <span className="search-icon">
          <Icon name="search" size={17} />
        </span>
        <input
          className="search"
          placeholder="Email, subId или комментарий"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
            <Icon name="plus" size={16} /> 30 дней выбранным ({selected.size})
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
        <EmptyState icon="users" text="Клиентов не найдено" hint={debounced ? 'Измените поиск или фильтр' : 'Создайте первого кнопкой «Клиент»'} />
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
                <Checkbox checked={selected.has(c.email)} />
              ) : (
                <Dot
                  live={onlineSet.has(c.email)}
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
              {!bulkMode && <Chevron />}
            </button>
          ))}
          <div ref={sentinel} style={{ height: 4 }} />
          {query.isFetchingNextPage && <Skeleton height={48} />}
        </div>
      )}
    </div>
  );
}
