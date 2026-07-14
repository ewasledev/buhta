// Сборка и парсинг settings/streamSettings инбаунда 3x-ui.
// Чистые функции без React — форма остаётся тонкой, логика тестируется отдельно.

export type FormProtocol = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'wireguard';
export type Network = 'tcp' | 'ws' | 'grpc' | 'xhttp';
export type Security = 'none' | 'tls' | 'reality';

export const FORM_PROTOCOLS: FormProtocol[] = ['vless', 'vmess', 'trojan', 'shadowsocks', 'wireguard'];
// экзотика настраивается только через JSON
export const JSON_ONLY_PROTOCOLS = ['dokodemo-door', 'socks', 'http'];
export const NETWORKS: Network[] = ['tcp', 'ws', 'grpc', 'xhttp'];
export const SECURITIES: Security[] = ['none', 'tls', 'reality'];
export const SS_METHODS = [
  'chacha20-ietf-poly1305',
  'xchacha20-ietf-poly1305',
  'aes-256-gcm',
  'aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-aes-128-gcm',
  'none',
];

export interface WgPeerForm {
  publicKey: string;
  allowedIPs: string; // через запятую
}

export interface InboundFormState {
  protocol: FormProtocol;
  network: Network;
  security: Security;
  path: string; // ws / xhttp
  host: string; // ws / xhttp
  serviceName: string; // grpc
  realityDest: string;
  realityServerNames: string; // через запятую
  realityPrivateKey: string;
  realityPublicKey: string;
  realityShortId: string;
  realityFingerprint: string;
  tlsCertFile: string;
  tlsKeyFile: string;
  ssMethod: string;
  ssPassword: string;
  wgSecretKey: string;
  wgMtu: string;
  wgPeers: WgPeerForm[];
}

export function defaultFormState(): InboundFormState {
  return {
    protocol: 'vless',
    network: 'tcp',
    security: 'none',
    path: '/',
    host: '',
    serviceName: '',
    realityDest: 'yahoo.com:443',
    realityServerNames: 'yahoo.com, www.yahoo.com',
    realityPrivateKey: '',
    realityPublicKey: '',
    realityShortId: '',
    realityFingerprint: 'chrome',
    tlsCertFile: '',
    tlsKeyFile: '',
    ssMethod: SS_METHODS[0],
    ssPassword: '',
    wgSecretKey: '',
    wgMtu: '1420',
    wgPeers: [],
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

type Obj = Record<string, unknown>;

export function buildSettings(s: InboundFormState, existing: Obj = {}): Obj {
  switch (s.protocol) {
    case 'vless':
      return { clients: [], decryption: 'none', fallbacks: [], ...existing };
    case 'vmess':
      return { clients: [], ...existing };
    case 'trojan':
      return { clients: [], fallbacks: [], ...existing };
    case 'shadowsocks':
      return {
        clients: [],
        network: 'tcp,udp',
        ...existing,
        method: s.ssMethod,
        password: s.ssPassword,
      };
    case 'wireguard':
      return {
        noKernelTun: false,
        ...existing,
        secretKey: s.wgSecretKey,
        mtu: Number(s.wgMtu) || 1420,
        peers: s.wgPeers.map((p) => ({
          publicKey: p.publicKey.trim(),
          allowedIPs: splitCsv(p.allowedIPs),
        })),
      };
  }
}

function networkSettings(s: InboundFormState): Obj {
  switch (s.network) {
    case 'tcp':
      return { tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } } };
    case 'ws':
      return { wsSettings: { acceptProxyProtocol: false, path: s.path || '/', host: s.host, headers: {} } };
    case 'grpc':
      return { grpcSettings: { serviceName: s.serviceName, authority: '', multiMode: false } };
    case 'xhttp':
      return {
        xhttpSettings: {
          path: s.path || '/',
          host: s.host,
          headers: {},
          scMaxBufferedPosts: 30,
          scMaxEachPostBytes: '1000000',
          noSSEHeader: false,
          xPaddingBytes: '100-1000',
          mode: 'auto',
        },
      };
  }
}

function securitySettings(s: InboundFormState): Obj {
  switch (s.security) {
    case 'none':
      return {};
    case 'reality':
      return {
        realitySettings: {
          show: false,
          xver: 0,
          dest: s.realityDest,
          serverNames: splitCsv(s.realityServerNames),
          privateKey: s.realityPrivateKey,
          minClient: '',
          maxClient: '',
          maxTimediff: 0,
          shortIds: [s.realityShortId],
          settings: {
            publicKey: s.realityPublicKey,
            fingerprint: s.realityFingerprint,
            serverName: '',
            spiderX: '/',
          },
        },
      };
    case 'tls':
      return {
        tlsSettings: {
          serverName: '',
          minVersion: '1.2',
          maxVersion: '1.3',
          cipherSuites: '',
          rejectUnknownSni: false,
          certificates: [
            { certificateFile: s.tlsCertFile, keyFile: s.tlsKeyFile, ocspStapling: 3600 },
          ],
          alpn: ['h2', 'http/1.1'],
          settings: { allowInsecure: false, fingerprint: '' },
        },
      };
  }
}

const NETWORK_KEYS = ['tcpSettings', 'wsSettings', 'grpcSettings', 'xhttpSettings'];
const SECURITY_KEYS = ['tlsSettings', 'realitySettings'];

export function buildStreamSettings(s: InboundFormState, existing: Obj = {}): Obj {
  // существующие незнакомые ключи (externalProxy и т.п.) сохраняем,
  // но настройки неактивных сетей/безопасностей вычищаем
  const base: Obj = { ...existing };
  for (const key of [...NETWORK_KEYS, ...SECURITY_KEYS]) delete base[key];
  return {
    ...base,
    network: s.network,
    security: s.security,
    ...networkSettings(s),
    ...securitySettings(s),
  };
}

function parseJson(value: string | undefined): Obj | null {
  if (!value || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Obj) : null;
  } catch {
    return null;
  }
}

/** Рекурсивный JSON.stringify с сортировкой ключей — для сравнения объектов независимо от порядка полей. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Obj)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Разбор инбаунда в состояние формы; null → конфиг нестандартный, редактируем в JSON-режиме. */
export function parseInbound(inbound: {
  protocol: string;
  settings?: string;
  streamSettings?: string;
}): InboundFormState | null {
  if (!(FORM_PROTOCOLS as string[]).includes(inbound.protocol)) return null;
  const protocol = inbound.protocol as FormProtocol;
  const settings = parseJson(inbound.settings);
  const stream = parseJson(inbound.streamSettings);
  if (settings === null || stream === null) return null;

  const state = { ...defaultFormState(), protocol };

  if (protocol === 'shadowsocks') {
    if (typeof settings.method === 'string') state.ssMethod = settings.method;
    if (typeof settings.password === 'string') state.ssPassword = settings.password;
  }
  if (protocol === 'wireguard') {
    if (typeof settings.secretKey === 'string') state.wgSecretKey = settings.secretKey;
    if (typeof settings.mtu === 'number') state.wgMtu = String(settings.mtu);
    if (Array.isArray(settings.peers)) {
      state.wgPeers = (settings.peers as Obj[]).map((p) => ({
        publicKey: typeof p.publicKey === 'string' ? p.publicKey : '',
        allowedIPs: Array.isArray(p.allowedIPs) ? (p.allowedIPs as string[]).join(', ') : '',
      }));
    }
    // транспорт/безопасность к wireguard не применимы — стрим панели форма не трогает
  } else {
    const network = typeof stream.network === 'string' ? stream.network : 'tcp';
    const security = typeof stream.security === 'string' ? stream.security : 'none';
    if (!(NETWORKS as string[]).includes(network)) return null;
    if (!(SECURITIES as string[]).includes(security)) return null;
    state.network = network as Network;
    state.security = security as Security;

    const ws = stream.wsSettings as Obj | undefined;
    const xhttp = stream.xhttpSettings as Obj | undefined;
    const grpc = stream.grpcSettings as Obj | undefined;
    if (state.network === 'ws' && ws) {
      if (typeof ws.path === 'string') state.path = ws.path;
      if (typeof ws.host === 'string') state.host = ws.host;
    }
    if (state.network === 'xhttp' && xhttp) {
      if (typeof xhttp.path === 'string') state.path = xhttp.path;
      if (typeof xhttp.host === 'string') state.host = xhttp.host;
    }
    if (state.network === 'grpc' && grpc && typeof grpc.serviceName === 'string') {
      state.serviceName = grpc.serviceName;
    }

    if (state.security === 'reality') {
      const reality = stream.realitySettings as Obj | undefined;
      if (!reality) return null;
      if (typeof reality.dest === 'string') state.realityDest = reality.dest;
      if (Array.isArray(reality.serverNames)) {
        state.realityServerNames = (reality.serverNames as string[]).join(', ');
      }
      if (typeof reality.privateKey === 'string') state.realityPrivateKey = reality.privateKey;
      if (Array.isArray(reality.shortIds) && typeof reality.shortIds[0] === 'string') {
        state.realityShortId = reality.shortIds[0];
      }
      const inner = reality.settings as Obj | undefined;
      if (inner) {
        if (typeof inner.publicKey === 'string') state.realityPublicKey = inner.publicKey;
        if (typeof inner.fingerprint === 'string') state.realityFingerprint = inner.fingerprint;
      }
    }
    if (state.security === 'tls') {
      const tls = stream.tlsSettings as Obj | undefined;
      const cert = tls && Array.isArray(tls.certificates) ? (tls.certificates[0] as Obj) : undefined;
      if (cert) {
        if (typeof cert.certificateFile === 'string') state.tlsCertFile = cert.certificateFile;
        if (typeof cert.keyFile === 'string') state.tlsKeyFile = cert.keyFile;
      }
    }
  }

  // круговой контроль: пересобираем settings/streamSettings из распознанного state теми же
  // функциями, что используются при сохранении, и сверяем с исходником. Несовпадение значит,
  // что форма не может представить этот конфиг без потери данных — уходим в JSON-режим.
  const rebuiltSettings = buildSettings(state, settings);
  if (stableStringify(rebuiltSettings) !== stableStringify(settings)) return null;
  if (protocol !== 'wireguard') {
    const rebuiltStream = buildStreamSettings(state, stream);
    if (stableStringify(rebuiltStream) !== stableStringify(stream)) return null;
  }

  return state;
}

/** Скелет settings для протоколов, которые форма не представляет — пользователь правит JSON. */
export function defaultJsonSettings(protocol: string): Obj {
  switch (protocol) {
    case 'dokodemo-door':
      return { address: '', port: 0, network: 'tcp,udp', followRedirect: false };
    case 'socks':
      return { auth: 'password', accounts: [], udp: false, ip: '127.0.0.1' };
    case 'http':
      return { accounts: [], allowTransparent: false };
    default:
      return { clients: [], decryption: 'none', fallbacks: [] };
  }
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function genShortId(): string {
  return Array.from(randomBytes(4), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SS2022 требует base64-ключ фиксированной длины; null — метод принимает любую строку. */
export function ssKeyLength(method: string): number | null {
  if (method === '2022-blake3-aes-128-gcm') return 16;
  if (method.startsWith('2022-')) return 32;
  return null;
}

export function ssPasswordValid(method: string, password: string): boolean {
  const len = ssKeyLength(method);
  if (len === null) return password.length > 0;
  try {
    return atob(password).length === len;
  } catch {
    return false;
  }
}

export function genPassword(method = ''): string {
  return btoa(String.fromCharCode(...randomBytes(ssKeyLength(method) ?? 32)));
}
