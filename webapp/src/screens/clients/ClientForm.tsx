import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreatePanelClient, usePanelClientDetail, useUpdatePanelClient } from '../../api/panelClients';
import { useInbounds } from '../../api/inbounds';
import { Skeleton, Switch, useToast } from '../../components/common';
import { formatDate } from '../../utils/format';
import { haptic, tgMainButton } from '../../sdk';

const GB = 1024 ** 3;
const DAY = 86_400_000;
const TRAFFIC_PRESETS = [
  { label: '10 ГБ', value: 10 * GB },
  { label: '50 ГБ', value: 50 * GB },
  { label: '100 ГБ', value: 100 * GB },
  { label: '∞', value: 0 },
];
const EXPIRY_PRESETS = [
  { label: '30 дн', days: 30 },
  { label: '90 дн', days: 90 },
  { label: '365 дн', days: 365 },
  { label: '∞', days: 0 },
];

export function ClientForm() {
  const { email: editEmail } = useParams();
  const isEdit = editEmail !== undefined;
  const [searchParams] = useSearchParams();
  const prefillInbound = searchParams.get('inboundId');
  const navigate = useNavigate();
  const toast = useToast();

  const inbounds = useInbounds();
  const existing = usePanelClientDetail(isEdit ? editEmail : undefined);
  const create = useCreatePanelClient();
  const update = useUpdatePanelClient(editEmail ?? '');
  const pending = create.isPending || update.isPending;

  const [email, setEmail] = useState('');
  const [totalGB, setTotalGB] = useState(0);
  const [expiryTime, setExpiryTime] = useState(0);
  const [limitIp, setLimitIp] = useState('0');
  const [enable, setEnable] = useState(true);
  const [comment, setComment] = useState('');
  const [inboundIds, setInboundIds] = useState<Set<number>>(
    () => new Set(prefillInbound ? [Number(prefillInbound)] : []),
  );
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const c = existing.data?.client;
    if (c && isEdit) {
      setEmail(c.email);
      setTotalGB(c.totalGB);
      setExpiryTime(c.expiryTime);
      setLimitIp(String(c.limitIp ?? 0));
      setEnable(c.enable);
      setComment(c.comment ?? '');
      if (c.inboundIds) setInboundIds(new Set(c.inboundIds));
    }
  }, [existing.data, isEdit]);

  const errors = useMemo(
    () => ({
      email: !email.trim() ? 'Укажите email (идентификатор клиента)' : null,
      inbounds: !isEdit && inboundIds.size === 0 ? 'Выберите хотя бы один инбаунд' : null,
    }),
    [email, inboundIds, isEdit],
  );
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched(true);
    setServerError(null);
    if (hasErrors || pending) {
      haptic('error');
      return;
    }
    const clientBody = {
      email: email.trim(),
      totalGB,
      expiryTime,
      limitIp: Number(limitIp) || 0,
      enable,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    const onSuccess = () => {
      haptic('success');
      toast(isEdit ? 'Клиент обновлён' : 'Клиент создан');
      navigate(isEdit ? `/clients/${encodeURIComponent(email.trim())}` : '/clients');
    };
    const onError = (e: Error) => {
      haptic('error');
      setServerError(e.message);
    };
    if (isEdit) {
      update.mutate({ ...existing.data?.client, ...clientBody }, { onSuccess, onError });
    } else {
      create.mutate({ client: clientBody, inboundIds: [...inboundIds] }, { onSuccess, onError });
    }
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const off = tgMainButton.show(isEdit ? 'Сохранить' : 'Создать', () => submitRef.current(), pending);
    return () => {
      off();
      tgMainButton.hide();
    };
  }, [isEdit, pending]);

  if (isEdit && existing.isLoading) {
    return (
      <div className="page">
        <Skeleton height={220} />
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>
        {isEdit ? 'Изменить клиента' : 'Новый клиент'}
      </h2>

      <div className="section">
        <label className="field">
          <div className="field-label">Email / идентификатор</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEdit}
            placeholder="ivan-phone"
            autoCapitalize="none"
          />
          {touched && errors.email && <div className="error">{errors.email}</div>}
        </label>

        <div className="field">
          <div className="field-label">Лимит трафика</div>
          <div className="presets">
            {TRAFFIC_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`preset ${totalGB === p.value ? 'active' : ''}`}
                onClick={() => setTotalGB(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-label">
            Срок {expiryTime > 0 ? `(${formatDate(expiryTime)})` : '(бессрочно)'}
          </div>
          <div className="presets">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`preset ${
                  p.days === 0
                    ? expiryTime === 0
                      ? 'active'
                      : ''
                    : Math.abs(expiryTime - (Date.now() + p.days * DAY)) < DAY
                      ? 'active'
                      : ''
                }`}
                onClick={() => setExpiryTime(p.days === 0 ? 0 : Date.now() + p.days * DAY)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <div className="field-label">Лимит устройств (0 = без лимита)</div>
          <input
            value={limitIp}
            onChange={(e) => setLimitIp(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
          />
        </label>

        <label className="field">
          <div className="field-label">Комментарий</div>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="необязательно" />
        </label>

        <div className="cell">
          <div className="cell-body"><div className="cell-title">Включён</div></div>
          <Switch checked={enable} onChange={setEnable} />
        </div>
      </div>

      {!isEdit && (
        <>
          <div className="section-title">Инбаунды</div>
          <div className="section">
            {inbounds.isLoading && <Skeleton height={48} count={2} />}
            {(inbounds.data ?? []).map((i) => (
              <button
                key={i.id}
                className="cell"
                onClick={() => {
                  haptic();
                  setInboundIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(i.id)) next.delete(i.id);
                    else next.add(i.id);
                    return next;
                  });
                }}
              >
                <span style={{ fontSize: 18 }}>{inboundIds.has(i.id) ? '☑️' : '⬜'}</span>
                <div className="cell-body">
                  <div className="cell-title">{i.remark || `#${i.id}`}</div>
                  <div className="cell-sub">{i.protocol} · порт {i.port}</div>
                </div>
              </button>
            ))}
          </div>
          {touched && errors.inbounds && (
            <div className="field"><div className="error">{errors.inbounds}</div></div>
          )}
        </>
      )}

      {serverError && (
        <div className="field" style={{ padding: '0 4px 10px' }}>
          <div className="error">{serverError}</div>
        </div>
      )}

      <button className="btn" disabled={pending} onClick={submit}>
        {pending ? <span className="spin" /> : isEdit ? 'Сохранить' : 'Создать'}
      </button>
    </div>
  );
}
