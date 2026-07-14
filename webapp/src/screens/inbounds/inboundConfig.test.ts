import { describe, expect, it } from 'vitest';
import {
  buildSettings,
  buildStreamSettings,
  defaultFormState,
  genPassword,
  genShortId,
  parseInbound,
} from './inboundConfig';

describe('buildSettings', () => {
  it('vless: clients/decryption/fallbacks по умолчанию', () => {
    const s = { ...defaultFormState(), protocol: 'vless' as const };
    expect(buildSettings(s)).toEqual({ clients: [], decryption: 'none', fallbacks: [] });
  });

  it('shadowsocks: метод и пароль из формы', () => {
    const s = {
      ...defaultFormState(),
      protocol: 'shadowsocks' as const,
      ssMethod: 'aes-256-gcm',
      ssPassword: 'secret',
    };
    expect(buildSettings(s)).toMatchObject({
      method: 'aes-256-gcm',
      password: 'secret',
      network: 'tcp,udp',
      clients: [],
    });
  });

  it('wireguard: secretKey, mtu, peers с allowedIPs-массивом', () => {
    const s = {
      ...defaultFormState(),
      protocol: 'wireguard' as const,
      wgSecretKey: 'sk',
      wgMtu: '1400',
      wgPeers: [{ publicKey: 'pk', allowedIPs: '10.0.0.2/32, 10.0.0.3/32' }],
    };
    expect(buildSettings(s)).toMatchObject({
      secretKey: 'sk',
      mtu: 1400,
      peers: [{ publicKey: 'pk', allowedIPs: ['10.0.0.2/32', '10.0.0.3/32'] }],
    });
  });

  it('edit: сохраняет существующих clients', () => {
    const s = { ...defaultFormState(), protocol: 'vless' as const };
    const existing = { clients: [{ email: 'a@b' }], decryption: 'none' };
    expect(buildSettings(s, existing)).toMatchObject({ clients: [{ email: 'a@b' }] });
  });
});

describe('buildStreamSettings', () => {
  it('ws + reality: путь, dest, serverNames, ключи', () => {
    const s = {
      ...defaultFormState(),
      network: 'ws' as const,
      security: 'reality' as const,
      path: '/ws',
      host: 'example.com',
      realityDest: 'yahoo.com:443',
      realityServerNames: 'yahoo.com, www.yahoo.com',
      realityPrivateKey: 'priv',
      realityPublicKey: 'pub',
      realityShortId: 'abcd1234',
    };
    const stream = buildStreamSettings(s);
    expect(stream).toMatchObject({
      network: 'ws',
      security: 'reality',
      wsSettings: { path: '/ws', host: 'example.com' },
      realitySettings: {
        dest: 'yahoo.com:443',
        serverNames: ['yahoo.com', 'www.yahoo.com'],
        privateKey: 'priv',
        shortIds: ['abcd1234'],
        settings: { publicKey: 'pub' },
      },
    });
    expect(stream).not.toHaveProperty('tlsSettings');
  });

  it('grpc + tls: serviceName и сертификат', () => {
    const s = {
      ...defaultFormState(),
      network: 'grpc' as const,
      security: 'tls' as const,
      serviceName: 'svc',
      tlsCertFile: '/cert.pem',
      tlsKeyFile: '/key.pem',
    };
    expect(buildStreamSettings(s)).toMatchObject({
      network: 'grpc',
      security: 'tls',
      grpcSettings: { serviceName: 'svc' },
      tlsSettings: { certificates: [{ certificateFile: '/cert.pem', keyFile: '/key.pem' }] },
    });
  });

  it('tcp + none: дефолтный header', () => {
    expect(buildStreamSettings(defaultFormState())).toMatchObject({
      network: 'tcp',
      security: 'none',
      tcpSettings: { header: { type: 'none' } },
    });
  });
});

describe('parseInbound', () => {
  it('round-trip: build → parse восстанавливает поля', () => {
    const s = {
      ...defaultFormState(),
      protocol: 'vless' as const,
      network: 'xhttp' as const,
      security: 'reality' as const,
      path: '/xh',
      realityDest: 'dest:443',
      realityServerNames: 'a.com',
      realityPrivateKey: 'priv',
      realityPublicKey: 'pub',
      realityShortId: 'ff00ff00',
    };
    const parsed = parseInbound({
      protocol: 'vless',
      settings: JSON.stringify(buildSettings(s)),
      streamSettings: JSON.stringify(buildStreamSettings(s)),
    });
    expect(parsed).toMatchObject({
      protocol: 'vless',
      network: 'xhttp',
      security: 'reality',
      path: '/xh',
      realityDest: 'dest:443',
      realityServerNames: 'a.com',
      realityPrivateKey: 'priv',
      realityPublicKey: 'pub',
      realityShortId: 'ff00ff00',
    });
  });

  it('wireguard round-trip', () => {
    const s = {
      ...defaultFormState(),
      protocol: 'wireguard' as const,
      wgSecretKey: 'sk',
      wgMtu: '1420',
      wgPeers: [{ publicKey: 'pk', allowedIPs: '10.0.0.2/32' }],
    };
    const parsed = parseInbound({
      protocol: 'wireguard',
      settings: JSON.stringify(buildSettings(s)),
    });
    expect(parsed).toMatchObject({
      protocol: 'wireguard',
      wgSecretKey: 'sk',
      wgMtu: '1420',
      wgPeers: [{ publicKey: 'pk', allowedIPs: '10.0.0.2/32' }],
    });
  });

  it('null для неподдерживаемого протокола', () => {
    expect(parseInbound({ protocol: 'dokodemo-door', settings: '{}' })).toBeNull();
  });

  it('null для невалидного JSON', () => {
    expect(parseInbound({ protocol: 'vless', settings: '{oops' })).toBeNull();
  });

  it('null для неизвестного network', () => {
    expect(
      parseInbound({
        protocol: 'vless',
        settings: '{"clients":[]}',
        streamSettings: '{"network":"kcp","security":"none"}',
      }),
    ).toBeNull();
  });

  it('null для reality с несколькими shortIds (панельный конфиг)', () => {
    const s = {
      ...defaultFormState(),
      security: 'reality' as const,
      realityPrivateKey: 'p',
      realityPublicKey: 'P',
      realityShortId: 'aa11',
    };
    const stream = buildStreamSettings(s) as Record<string, any>;
    stream.realitySettings.shortIds = ['aa11', 'bb22', 'cc33'];
    expect(
      parseInbound({
        protocol: 'vless',
        settings: '{"clients":[],"decryption":"none","fallbacks":[]}',
        streamSettings: JSON.stringify(stream),
      }),
    ).toBeNull();
  });

  it('null для tcp с http-заголовком', () => {
    expect(
      parseInbound({
        protocol: 'vless',
        settings: '{"clients":[],"decryption":"none","fallbacks":[]}',
        streamSettings: JSON.stringify({
          network: 'tcp',
          security: 'none',
          tcpSettings: { acceptProxyProtocol: false, header: { type: 'http', request: {} } },
        }),
      }),
    ).toBeNull();
  });

  it('null для wireguard с полями пиров, которые форма не представляет', () => {
    expect(
      parseInbound({
        protocol: 'wireguard',
        settings: JSON.stringify({
          noKernelTun: false,
          secretKey: 'sk',
          mtu: 1420,
          peers: [{ publicKey: 'pk', allowedIPs: ['10.0.0.2/32'], keepAlive: 25 }],
        }),
      }),
    ).toBeNull();
  });
});

describe('генераторы', () => {
  it('genShortId — 8 hex-символов', () => {
    expect(genShortId()).toMatch(/^[0-9a-f]{8}$/);
  });
  it('genPassword — непустой base64', () => {
    expect(genPassword().length).toBeGreaterThanOrEqual(32);
  });
});
