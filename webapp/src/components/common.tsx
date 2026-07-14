import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon, IconName } from './Icon';

export function PageHeader(props: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1 className="page-title">{props.title}</h1>
      {props.children && <div className="page-actions">{props.children}</div>}
    </header>
  );
}

export function Chevron(props: { open?: boolean }) {
  return (
    <span className="cell-chevron">
      <Icon name={props.open === undefined ? 'chevron-right' : props.open ? 'chevron-down' : 'chevron-right'} size={18} />
    </span>
  );
}

export function Checkbox(props: { checked: boolean }) {
  return (
    <span className={`checkbox ${props.checked ? 'checked' : ''}`}>
      <Icon name="check" size={14} strokeWidth={2.6} />
    </span>
  );
}

export function StatCard(props: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  progress?: number; // 0..100
}) {
  const level = props.progress === undefined ? '' : props.progress > 90 ? 'danger' : props.progress > 70 ? 'warn' : '';
  return (
    <div className="stat-card">
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}</div>
      {props.sub !== undefined && <div className="stat-sub">{props.sub}</div>}
      {props.progress !== undefined && (
        <div className={`progress ${level}`}>
          <div style={{ width: `${Math.min(100, Math.max(0, props.progress))}%` }} />
        </div>
      )}
    </div>
  );
}

export function ProgressBar(props: { percent: number }) {
  const level = props.percent > 90 ? 'danger' : props.percent > 70 ? 'warn' : '';
  return (
    <div className={`progress ${level}`}>
      <div style={{ width: `${Math.min(100, Math.max(0, props.percent))}%` }} />
    </div>
  );
}

export function Dot(props: { color: string; live?: boolean }) {
  return <span className={`badge-dot ${props.live ? 'live' : ''}`} style={{ background: props.color }} />;
}

export function Skeleton(props: { height?: number; count?: number }) {
  const items = Array.from({ length: props.count ?? 1 });
  return (
    <>
      {items.map((_, i) => (
        <div key={i} className="skeleton" style={{ height: props.height ?? 64, marginBottom: 10 }} />
      ))}
    </>
  );
}

export function ErrorState(props: { message?: string; onRetry?: () => void }) {
  return (
    <div className="center-state">
      <div className="state-icon warn">
        <Icon name="warning" size={26} />
      </div>
      <div>{props.message ?? 'Что-то пошло не так'}</div>
      {props.onRetry && (
        <button className="btn secondary" onClick={props.onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState(props: { icon?: IconName; text: string; hint?: string }) {
  return (
    <div className="center-state">
      <div className="state-icon">
        <Icon name={props.icon ?? 'inbox'} size={26} />
      </div>
      <div>{props.text}</div>
      {props.hint && <div style={{ fontSize: 13, marginTop: 6 }}>{props.hint}</div>}
    </div>
  );
}

export function Sheet(props: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        {props.children}
      </div>
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span />
    </label>
  );
}

// --- Тосты ---

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider(props: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 2200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {props.children}
      {text && <div className="toast">{text}</div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
