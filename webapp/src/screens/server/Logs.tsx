import { useEffect, useRef, useState } from 'react';
import { useLogs } from '../../api/server';
import { ErrorState, PageHeader, Skeleton } from '../../components/common';
import { Icon } from '../../components/Icon';

const COUNTS = [50, 100, 500];

export function LogsScreen() {
  const [kind, setKind] = useState<'panel' | 'xray'>('panel');
  const [count, setCount] = useState(100);
  const logs = useLogs(kind, count);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logs.data && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [logs.data]);

  const text = Array.isArray(logs.data) ? logs.data.join('\n') : (logs.data ?? '');

  return (
    <div className="page">
      <PageHeader title="Логи">
        <button className="icon-btn" aria-label="Обновить логи" onClick={() => logs.refetch()}>
          {logs.isFetching ? <span className="spin" /> : <Icon name="refresh" size={18} />}
        </button>
      </PageHeader>

      <div className="chips">
        <button className={`chip ${kind === 'panel' ? 'active' : ''}`} onClick={() => setKind('panel')}>
          Панель
        </button>
        <button className={`chip ${kind === 'xray' ? 'active' : ''}`} onClick={() => setKind('xray')}>
          Xray
        </button>
        <span style={{ flex: 1 }} />
        {COUNTS.map((c) => (
          <button key={c} className={`chip ${count === c ? 'active' : ''}`} onClick={() => setCount(c)}>
            {c}
          </button>
        ))}
      </div>

      {logs.isLoading && <Skeleton height={300} />}
      {logs.isError && <ErrorState message="Логи недоступны" onRetry={() => logs.refetch()} />}
      {logs.data !== undefined && (
        <div
          ref={boxRef}
          className="section mono"
          style={{ padding: 12, maxHeight: '65vh', overflowY: 'auto' }}
        >
          {text || 'Пусто'}
        </div>
      )}
    </div>
  );
}
