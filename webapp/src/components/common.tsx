import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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

export function Dot(props: { color: string }) {
  return <span className="badge-dot" style={{ background: props.color }} />;
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
      <div className="big">⚠️</div>
      <div>{props.message ?? 'Что-то пошло не так'}</div>
      {props.onRetry && (
        <button className="btn secondary" style={{ marginTop: 16 }} onClick={props.onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState(props: { icon?: string; text: string; hint?: string }) {
  return (
    <div className="center-state">
      <div className="big">{props.icon ?? '📭'}</div>
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
