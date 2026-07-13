import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateInbound, useInbound, useUpdateInbound } from '../../api/inbounds';
import { Skeleton, Switch, useToast } from '../../components/common';
import { haptic, tgMainButton } from '../../sdk';

const PROTOCOLS = ['vless', 'vmess', 'trojan', 'shadowsocks', 'socks', 'http', 'dokodemo-door', 'wireguard'];

const DEFAULT_SETTINGS = JSON.stringify(
  { clients: [], decryption: 'none', fallbacks: [] },
  null,
  2,
);
const DEFAULT_STREAM = JSON.stringify(
  { network: 'tcp', security: 'none', tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } } },
  null,
  2,
);
const DEFAULT_SNIFFING = JSON.stringify(
  { enabled: true, destOverride: ['http', 'tls', 'quic', 'fastopen'], metadataOnly: false, routeOnly: false },
  null,
  2,
);

function jsonError(value: string): string | null {
  if (!value.trim()) return null;
  try {
    JSON.parse(value);
    return null;
  } catch {
    return 'Невалидный JSON';
  }
}

export function InboundForm() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const inboundId = isEdit ? Number(id) : undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const existing = useInbound(inboundId);
  const create = useCreateInbound();
  const update = useUpdateInbound(inboundId ?? 0);
  const pending = create.isPending || update.isPending;

  const [remark, setRemark] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState('vless');
  const [enable, setEnable] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(!isEdit ? false : false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [streamSettings, setStreamSettings] = useState(DEFAULT_STREAM);
  const [sniffing, setSniffing] = useState(DEFAULT_SNIFFING);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (existing.data && isEdit) {
      const i = existing.data;
      setRemark(i.remark);
      setPort(String(i.port));
      setProtocol(i.protocol);
      setEnable(i.enable);
      if (i.settings) setSettings(i.settings);
      if (i.streamSettings) setStreamSettings(i.streamSettings);
      if (i.sniffing) setSniffing(i.sniffing);
    }
  }, [existing.data, isEdit]);

  const portNum = Number(port);
  const errors = useMemo(
    () => ({
      remark: !remark.trim() ? 'Укажите название' : null,
      port: !port || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535 ? 'Порт 1–65535' : null,
      settings: jsonError(settings),
      streamSettings: jsonError(streamSettings),
      sniffing: jsonError(sniffing),
    }),
    [remark, port, portNum, settings, streamSettings, sniffing],
  );
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched(true);
    if (hasErrors || pending) {
      haptic('error');
      return;
    }
    const body = {
      ...(isEdit && existing.data ? existing.data : {}),
      remark: remark.trim(),
      port: portNum,
      protocol,
      enable,
      settings,
      streamSettings,
      sniffing,
    };
    const mutation = isEdit ? update : create;
    mutation.mutate(body as Record<string, unknown>, {
      onSuccess: () => {
        haptic('success');
        toast(isEdit ? 'Инбаунд обновлён' : 'Инбаунд создан');
        navigate('/inbounds');
      },
      onError: (e) => {
        haptic('error');
        toast(e.message);
      },
    });
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
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>
        {isEdit ? 'Изменить инбаунд' : 'Новый инбаунд'}
      </h2>

      <div className="section">
        <label className="field">
          <div className="field-label">Название (remark)</div>
          <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Например: main-vless" />
          {touched && errors.remark && <div className="error">{errors.remark}</div>}
        </label>
        <label className="field">
          <div className="field-label">Порт</div>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="443"
          />
          {touched && errors.port && <div className="error">{errors.port}</div>}
        </label>
        <label className="field">
          <div className="field-label">Протокол</div>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value)} disabled={isEdit}>
            {PROTOCOLS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <div className="cell">
          <div className="cell-body"><div className="cell-title">Включён</div></div>
          <Switch checked={enable} onChange={setEnable} />
        </div>
      </div>

      <div className="section">
        <button className="cell" onClick={() => setAdvancedOpen(!advancedOpen)}>
          <div className="cell-body"><div className="cell-title">Дополнительно (JSON)</div></div>
          <span style={{ color: 'var(--hint)' }}>{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && (
          <>
            <label className="field">
              <div className="field-label">settings</div>
              <textarea value={settings} onChange={(e) => setSettings(e.target.value)} />
              {errors.settings && <div className="error">{errors.settings}</div>}
            </label>
            <label className="field">
              <div className="field-label">streamSettings</div>
              <textarea value={streamSettings} onChange={(e) => setStreamSettings(e.target.value)} />
              {errors.streamSettings && <div className="error">{errors.streamSettings}</div>}
            </label>
            <label className="field">
              <div className="field-label">sniffing</div>
              <textarea value={sniffing} onChange={(e) => setSniffing(e.target.value)} />
              {errors.sniffing && <div className="error">{errors.sniffing}</div>}
            </label>
          </>
        )}
      </div>

      <button className="btn" disabled={pending} onClick={submit}>
        {pending ? <span className="spin" /> : isEdit ? 'Сохранить' : 'Создать'}
      </button>
    </div>
  );
}
