import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateInbound, useInbound, useUpdateInbound } from '../../api/inbounds';
import { useNewX25519 } from '../../api/server';
import { Skeleton, Switch, useToast } from '../../components/common';
import { haptic, tgMainButton } from '../../sdk';
import {
  FORM_PROTOCOLS,
  FormProtocol,
  InboundFormState,
  Network,
  NETWORKS,
  SECURITIES,
  Security,
  SS_METHODS,
  buildSettings,
  buildStreamSettings,
  defaultFormState,
  genPassword,
  genShortId,
  parseInbound,
} from './inboundConfig';

// экзотика настраивается только через JSON
const JSON_ONLY_PROTOCOLS = ['dokodemo-door', 'socks', 'http'];
const ALL_PROTOCOLS = [...FORM_PROTOCOLS, ...JSON_ONLY_PROTOCOLS];

const DEFAULT_SETTINGS = JSON.stringify({ clients: [], decryption: 'none', fallbacks: [] }, null, 2);
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
  const newKeys = useNewX25519();
  const pending = create.isPending || update.isPending;

  const [remark, setRemark] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<string>('vless');
  const [enable, setEnable] = useState(true);
  const [form, setForm] = useState<InboundFormState>(defaultFormState());
  // jsonMode: экзотический протокол или нераспознанный конфиг при редактировании
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonNotice, setJsonNotice] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [streamSettings, setStreamSettings] = useState(DEFAULT_STREAM);
  const [sniffing, setSniffing] = useState(DEFAULT_SNIFFING);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof InboundFormState>(key: K, value: InboundFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!existing.data || !isEdit) return;
    const i = existing.data;
    setRemark(i.remark);
    setPort(String(i.port));
    setProtocol(i.protocol);
    setEnable(i.enable);
    if (i.settings) setSettings(i.settings);
    if (i.streamSettings) setStreamSettings(i.streamSettings);
    if (i.sniffing) setSniffing(i.sniffing);
    const parsed = parseInbound(i);
    if (parsed) {
      setForm(parsed);
    } else {
      setJsonMode(true);
      setJsonNotice(true);
    }
  }, [existing.data, isEdit]);

  const isJsonOnly = JSON_ONLY_PROTOCOLS.includes(protocol);
  const useJson = jsonMode || isJsonOnly;
  const formProtocol = protocol as FormProtocol;
  const isWireguard = formProtocol === 'wireguard';

  const onProtocolChange = (value: string) => {
    setProtocol(value);
    if (FORM_PROTOCOLS.includes(value as FormProtocol)) {
      set('protocol', value as FormProtocol);
      if (value === 'shadowsocks' && !form.ssPassword) set('ssPassword', genPassword());
    }
  };

  const onSecurityChange = (value: Security) => {
    set('security', value);
    if (value === 'reality' && !form.realityShortId) set('realityShortId', genShortId());
  };

  const generateKeys = async (target: 'reality' | 'wireguard') => {
    try {
      const keys = await newKeys.mutateAsync();
      if (target === 'reality') {
        setForm((f) => ({ ...f, realityPrivateKey: keys.privateKey, realityPublicKey: keys.publicKey }));
      } else {
        set('wgSecretKey', keys.privateKey);
      }
      haptic('success');
    } catch (e) {
      haptic('error');
      toast(e instanceof Error ? e.message : 'Не удалось сгенерировать ключи');
    }
  };

  const portNum = Number(port);
  // единый Record, а не union двух форм — иначе tsc не даст обращаться к errors.reality и т.п.
  const errors = useMemo(() => {
    const e: Record<string, string | null> = {
      remark: !remark.trim() ? 'Укажите название' : null,
      port: !port || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535 ? 'Порт 1–65535' : null,
    };
    if (useJson) {
      e.settings = jsonError(settings);
      e.streamSettings = jsonError(streamSettings);
      e.sniffing = jsonError(sniffing);
    } else {
      e.reality =
        form.security === 'reality' && !isWireguard && !form.realityPrivateKey
          ? 'Сгенерируйте ключи reality'
          : null;
      e.tls =
        form.security === 'tls' && !isWireguard && !form.tlsCertFile
          ? 'Укажите путь к сертификату'
          : null;
      e.ss = formProtocol === 'shadowsocks' && !form.ssPassword ? 'Укажите пароль' : null;
      e.wg = isWireguard && !form.wgSecretKey ? 'Сгенерируйте секретный ключ' : null;
    }
    return e;
  }, [remark, port, portNum, useJson, settings, streamSettings, sniffing, form, formProtocol, isWireguard]);
  const hasErrors = Object.values(errors).some(Boolean);

  const existingSettings = useMemo(() => {
    try {
      return existing.data?.settings ? (JSON.parse(existing.data.settings) as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }, [existing.data]);
  const existingStream = useMemo(() => {
    try {
      return existing.data?.streamSettings
        ? (JSON.parse(existing.data.streamSettings) as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }, [existing.data]);

  const builtSettings = useMemo(
    () => (useJson ? settings : JSON.stringify(buildSettings(form, isEdit ? existingSettings : undefined), null, 2)),
    [useJson, settings, form, isEdit, existingSettings],
  );
  const builtStream = useMemo(() => {
    if (useJson) return streamSettings;
    if (isWireguard) {
      // stream к wireguard не применим: при редактировании не трогаем то, что хранит панель
      return isEdit && existing.data?.streamSettings ? existing.data.streamSettings : DEFAULT_STREAM;
    }
    return JSON.stringify(buildStreamSettings(form, isEdit ? existingStream : undefined), null, 2);
  }, [useJson, streamSettings, form, isWireguard, isEdit, existing.data, existingStream]);

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
      settings: builtSettings,
      streamSettings: builtStream,
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

      {jsonNotice && (
        <div className="section" style={{ padding: '10px 12px' }}>
          <div className="cell-sub">Конфигурация нестандартная — редактирование в JSON-режиме</div>
        </div>
      )}

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
          <select value={protocol} onChange={(e) => onProtocolChange(e.target.value)} disabled={isEdit}>
            {ALL_PROTOCOLS.map((p) => (
              <option key={p} value={p}>
                {p}
                {JSON_ONLY_PROTOCOLS.includes(p) ? ' (JSON)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="cell">
          <div className="cell-body"><div className="cell-title">Включён</div></div>
          <Switch checked={enable} onChange={setEnable} />
        </div>
      </div>

      {!useJson && !isWireguard && (
        <>
          <div className="section-title">Транспорт</div>
          <div className="section">
            <label className="field">
              <div className="field-label">Сеть</div>
              <select value={form.network} onChange={(e) => set('network', e.target.value as Network)}>
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {(form.network === 'ws' || form.network === 'xhttp') && (
              <>
                <label className="field">
                  <div className="field-label">Путь (path)</div>
                  <input value={form.path} onChange={(e) => set('path', e.target.value)} placeholder="/" />
                </label>
                <label className="field">
                  <div className="field-label">Host (необязательно)</div>
                  <input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="example.com" />
                </label>
              </>
            )}
            {form.network === 'grpc' && (
              <label className="field">
                <div className="field-label">Имя сервиса (serviceName)</div>
                <input value={form.serviceName} onChange={(e) => set('serviceName', e.target.value)} />
              </label>
            )}
          </div>

          <div className="section-title">Безопасность</div>
          <div className="section">
            <label className="field">
              <div className="field-label">Тип</div>
              <select value={form.security} onChange={(e) => onSecurityChange(e.target.value as Security)}>
                {SECURITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            {form.security === 'reality' && (
              <>
                <label className="field">
                  <div className="field-label">Назначение (dest)</div>
                  <input value={form.realityDest} onChange={(e) => set('realityDest', e.target.value)} placeholder="yahoo.com:443" />
                </label>
                <label className="field">
                  <div className="field-label">Server names (через запятую)</div>
                  <input value={form.realityServerNames} onChange={(e) => set('realityServerNames', e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-label">Короткий ID (shortId)</div>
                  <input value={form.realityShortId} onChange={(e) => set('realityShortId', e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-label">Приватный ключ (privateKey)</div>
                  <input value={form.realityPrivateKey} onChange={(e) => set('realityPrivateKey', e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-label">Публичный ключ (publicKey)</div>
                  <input value={form.realityPublicKey} onChange={(e) => set('realityPublicKey', e.target.value)} />
                </label>
                <div style={{ padding: '4px 12px 10px' }}>
                  <button className="btn secondary" disabled={newKeys.isPending} onClick={() => generateKeys('reality')}>
                    {newKeys.isPending ? <span className="spin" /> : '🔑 Сгенерировать ключи'}
                  </button>
                </div>
                {touched && errors.reality && <div className="error" style={{ padding: '0 12px 10px' }}>{errors.reality}</div>}
              </>
            )}
            {form.security === 'tls' && (
              <>
                <label className="field">
                  <div className="field-label">Файл сертификата</div>
                  <input value={form.tlsCertFile} onChange={(e) => set('tlsCertFile', e.target.value)} placeholder="/root/cert.pem" />
                </label>
                <label className="field">
                  <div className="field-label">Файл ключа</div>
                  <input value={form.tlsKeyFile} onChange={(e) => set('tlsKeyFile', e.target.value)} placeholder="/root/key.pem" />
                </label>
                {touched && errors.tls && <div className="error" style={{ padding: '0 12px 10px' }}>{errors.tls}</div>}
              </>
            )}
          </div>
        </>
      )}

      {!useJson && formProtocol === 'shadowsocks' && (
        <>
          <div className="section-title">Shadowsocks</div>
          <div className="section">
            <label className="field">
              <div className="field-label">Метод шифрования</div>
              <select value={form.ssMethod} onChange={(e) => set('ssMethod', e.target.value)}>
                {SS_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <div className="field-label">Пароль</div>
              <input value={form.ssPassword} onChange={(e) => set('ssPassword', e.target.value)} />
              {touched && errors.ss && <div className="error">{errors.ss}</div>}
            </label>
            <div style={{ padding: '4px 12px 10px' }}>
              <button className="btn secondary" onClick={() => set('ssPassword', genPassword())}>
                🎲 Сгенерировать пароль
              </button>
            </div>
          </div>
        </>
      )}

      {!useJson && isWireguard && (
        <>
          <div className="section-title">WireGuard</div>
          <div className="section">
            <label className="field">
              <div className="field-label">Секретный ключ</div>
              <input value={form.wgSecretKey} onChange={(e) => set('wgSecretKey', e.target.value)} />
              {touched && errors.wg && <div className="error">{errors.wg}</div>}
            </label>
            <div style={{ padding: '4px 12px 10px' }}>
              <button className="btn secondary" disabled={newKeys.isPending} onClick={() => generateKeys('wireguard')}>
                {newKeys.isPending ? <span className="spin" /> : '🔑 Сгенерировать ключ'}
              </button>
            </div>
            <label className="field">
              <div className="field-label">MTU</div>
              <input value={form.wgMtu} onChange={(e) => set('wgMtu', e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </label>
          </div>
          <div className="section-title">Пиры ({form.wgPeers.length})</div>
          <div className="section">
            {form.wgPeers.map((peer, idx) => (
              <div key={idx} style={{ borderBottom: '1px solid var(--section-separator, rgba(255,255,255,0.06))' }}>
                <label className="field">
                  <div className="field-label">Публичный ключ пира #{idx + 1}</div>
                  <input
                    value={peer.publicKey}
                    onChange={(e) =>
                      set('wgPeers', form.wgPeers.map((p, i) => (i === idx ? { ...p, publicKey: e.target.value } : p)))
                    }
                  />
                </label>
                <label className="field">
                  <div className="field-label">Allowed IPs (через запятую)</div>
                  <input
                    value={peer.allowedIPs}
                    onChange={(e) =>
                      set('wgPeers', form.wgPeers.map((p, i) => (i === idx ? { ...p, allowedIPs: e.target.value } : p)))
                    }
                    placeholder="10.0.0.2/32"
                  />
                </label>
                <div style={{ padding: '0 12px 10px' }}>
                  <button className="btn danger" onClick={() => set('wgPeers', form.wgPeers.filter((_, i) => i !== idx))}>
                    Удалить пира
                  </button>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 12px' }}>
              <button
                className="btn secondary"
                onClick={() => set('wgPeers', [...form.wgPeers, { publicKey: '', allowedIPs: '' }])}
              >
                ＋ Добавить пира
              </button>
            </div>
          </div>
        </>
      )}

      <div className="section">
        <button className="cell" onClick={() => setPreviewOpen(!previewOpen)}>
          <div className="cell-body"><div className="cell-title">Дополнительно (JSON)</div></div>
          <span style={{ color: 'var(--hint)' }}>{previewOpen ? '▾' : '▸'}</span>
        </button>
        {previewOpen && useJson && (
          <>
            <label className="field">
              <div className="field-label">settings</div>
              <textarea value={settings} onChange={(e) => setSettings(e.target.value)} />
              {'settings' in errors && errors.settings && <div className="error">{errors.settings}</div>}
            </label>
            <label className="field">
              <div className="field-label">streamSettings</div>
              <textarea value={streamSettings} onChange={(e) => setStreamSettings(e.target.value)} />
              {'streamSettings' in errors && errors.streamSettings && <div className="error">{errors.streamSettings}</div>}
            </label>
            <label className="field">
              <div className="field-label">sniffing</div>
              <textarea value={sniffing} onChange={(e) => setSniffing(e.target.value)} />
              {'sniffing' in errors && errors.sniffing && <div className="error">{errors.sniffing}</div>}
            </label>
          </>
        )}
        {previewOpen && !useJson && (
          <div style={{ padding: '0 12px 12px' }}>
            <div className="field-label" style={{ padding: '8px 0 4px' }}>settings (собрано формой)</div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--hint)' }}>
              {builtSettings}
            </pre>
            <div className="field-label" style={{ padding: '8px 0 4px' }}>streamSettings</div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--hint)' }}>
              {builtStream}
            </pre>
            <div className="field-label" style={{ padding: '8px 0 4px' }}>sniffing</div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--hint)' }}>
              {sniffing}
            </pre>
            <div style={{ paddingTop: 10 }}>
              <button
                className="btn secondary"
                onClick={() => {
                  setSettings(builtSettings);
                  setStreamSettings(builtStream);
                  setJsonMode(true);
                }}
              >
                ✏️ Редактировать как JSON
              </button>
            </div>
          </div>
        )}
      </div>

      <button className="btn" disabled={pending} onClick={submit}>
        {pending ? <span className="spin" /> : isEdit ? 'Сохранить' : 'Создать'}
      </button>
    </div>
  );
}
