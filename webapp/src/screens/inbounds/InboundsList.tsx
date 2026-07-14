import { useNavigate } from 'react-router-dom';
import { useInbounds } from '../../api/inbounds';
import { Chevron, Dot, EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/common';
import { Icon } from '../../components/Icon';
import { formatBytes } from '../../utils/format';

export function InboundsList() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInbounds();

  return (
    <div className="page">
      <PageHeader title="Инбаунды">
        <button className="chip" onClick={() => navigate('/inbounds/new')}>
          <Icon name="plus" size={16} /> Инбаунд
        </button>
      </PageHeader>

      {isLoading && <Skeleton height={68} count={4} />}
      {isError && <ErrorState message="Не удалось загрузить инбаунды" onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon="split" text="Инбаундов пока нет" hint="Нажмите «Инбаунд» вверху" />
      )}

      {data && data.length > 0 && (
        <div className="section">
          {data.map((inbound) => (
            <button
              key={inbound.id}
              className="cell"
              onClick={() => navigate(`/inbounds/${inbound.id}`)}
            >
              <Dot color={inbound.enable ? 'var(--success)' : 'var(--hint)'} />
              <div className="cell-body">
                <div className="cell-title">{inbound.remark || `#${inbound.id}`}</div>
                <div className="cell-sub">
                  {inbound.protocol} · порт {inbound.port} · ↑ {formatBytes(inbound.up)} ↓{' '}
                  {formatBytes(inbound.down)}
                  {inbound.clientStats ? ` · клиентов: ${inbound.clientStats.length}` : ''}
                </div>
              </div>
              <Chevron />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
