import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XuiApiError, XuiAuthError, XuiConnectionError } from './xui.errors';
import {
  ClientTraffic,
  HistoryPoint,
  Inbound,
  PagedClients,
  PagedClientsQuery,
  PanelClient,
  PanelUpdateInfo,
  ServerStatus,
  XuiEnvelope,
} from './xui.types';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeout?: number;
  retried?: boolean;
}

const DEFAULT_TIMEOUT = 15_000;
const LONG_TIMEOUT = 120_000;

@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);
  private cookie: string | null = null;
  private loginInFlight: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('XUI_BASE_URL') ?? '').replace(/\/+$/, '');
  }

  private async rawFetch(path: string, opts: RequestOptions): Promise<Response> {
    try {
      return await fetch(this.baseUrl + path, {
        method: opts.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        redirect: 'manual',
        signal: AbortSignal.timeout(opts.timeout ?? DEFAULT_TIMEOUT),
      });
    } catch {
      throw new XuiConnectionError();
    }
  }

  private async doLogin(): Promise<void> {
    const res = await this.rawFetch('/login', {
      method: 'POST',
      body: {
        username: this.config.get<string>('XUI_USERNAME'),
        password: this.config.get<string>('XUI_PASSWORD'),
        twoFactorCode: '',
      },
    });
    const setCookies =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    const cookie = setCookies.find((c) => c.startsWith('3x-ui='));
    const body = (await res.json().catch(() => null)) as XuiEnvelope | null;
    if (!cookie || !body?.success) {
      this.logger.warn('Логин в панель 3x-ui не удался');
      throw new XuiAuthError();
    }
    this.cookie = cookie.split(';')[0];
  }

  private ensureLogin(force = false): Promise<void> {
    if (this.cookie && !force) return Promise.resolve();
    if (!this.loginInFlight) {
      this.loginInFlight = this.doLogin().finally(() => {
        this.loginInFlight = null;
      });
    }
    return this.loginInFlight;
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    await this.ensureLogin();
    const res = await this.rawFetch(path, opts);

    const contentType = res.headers.get('content-type') ?? '';
    const sessionStale =
      res.status === 401 ||
      (res.status >= 300 && res.status < 400) ||
      contentType.includes('text/html');
    if (sessionStale) {
      if (opts.retried) throw new XuiAuthError();
      await this.ensureLogin(true);
      return this.request<T>(path, { ...opts, retried: true });
    }

    const body = (await res.json().catch(() => {
      throw new XuiConnectionError();
    })) as XuiEnvelope<T>;
    if (!body.success) throw new XuiApiError(body.msg || 'Ошибка панели');
    return body.obj;
  }

  // --- Сервер ---
  serverStatus() {
    return this.request<ServerStatus>('/panel/api/server/status');
  }
  serverHistory(metric: string, bucket: number) {
    return this.request<HistoryPoint[]>(`/panel/api/server/history/${metric}/${bucket}`);
  }
  getXrayVersions() {
    return this.request<string[]>('/panel/api/server/getXrayVersion');
  }
  getPanelUpdateInfo() {
    return this.request<PanelUpdateInfo>('/panel/api/server/getPanelUpdateInfo');
  }
  restartXray() {
    return this.request<null>('/panel/api/server/restartXrayService', { method: 'POST' });
  }
  stopXray() {
    return this.request<null>('/panel/api/server/stopXrayService', { method: 'POST' });
  }
  installXray(version: string) {
    return this.request<null>(`/panel/api/server/installXray/${encodeURIComponent(version)}`, {
      method: 'POST',
      timeout: LONG_TIMEOUT,
    });
  }
  updatePanel() {
    return this.request<null>('/panel/api/server/updatePanel', {
      method: 'POST',
      timeout: LONG_TIMEOUT,
    });
  }
  getLogs(count: number) {
    return this.request<string>(`/panel/api/server/logs/${count}`, {
      method: 'POST',
      body: { level: 'info', syslog: false },
    });
  }
  getXrayLogs(count: number) {
    return this.request<string>(`/panel/api/server/xraylogs/${count}`, {
      method: 'POST',
      body: {},
    });
  }

  // --- Инбаунды ---
  listInbounds() {
    return this.request<Inbound[]>('/panel/api/inbounds/list');
  }
  listInboundsSlim() {
    return this.request<Inbound[]>('/panel/api/inbounds/list/slim');
  }
  inboundOptions() {
    return this.request<unknown>('/panel/api/inbounds/options');
  }
  getInbound(id: number) {
    return this.request<Inbound>(`/panel/api/inbounds/get/${id}`);
  }
  addInbound(body: unknown) {
    return this.request<Inbound>('/panel/api/inbounds/add', { method: 'POST', body });
  }
  updateInbound(id: number, body: unknown) {
    return this.request<Inbound>(`/panel/api/inbounds/update/${id}`, { method: 'POST', body });
  }
  deleteInbound(id: number) {
    return this.request<null>(`/panel/api/inbounds/del/${id}`, { method: 'POST' });
  }
  setInboundEnable(id: number, enable: boolean) {
    return this.request<null>(`/panel/api/inbounds/setEnable/${id}`, {
      method: 'POST',
      body: { enable },
    });
  }
  resetInboundTraffic(id: number) {
    return this.request<null>(`/panel/api/inbounds/${id}/resetTraffic`, { method: 'POST' });
  }
  delAllInboundClients(id: number) {
    return this.request<null>(`/panel/api/inbounds/${id}/delAllClients`, { method: 'POST' });
  }

  // --- Клиенты панели ---
  listClientsPaged(query: PagedClientsQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return this.request<PagedClients>(`/panel/api/clients/list/paged?${params.toString()}`);
  }
  getPanelClient(email: string) {
    return this.request<PanelClient>(`/panel/api/clients/get/${encodeURIComponent(email)}`);
  }
  addPanelClient(body: unknown) {
    return this.request<unknown>('/panel/api/clients/add', { method: 'POST', body });
  }
  updatePanelClient(email: string, body: unknown) {
    return this.request<unknown>(`/panel/api/clients/update/${encodeURIComponent(email)}`, {
      method: 'POST',
      body,
    });
  }
  deletePanelClient(email: string) {
    return this.request<null>(`/panel/api/clients/del/${encodeURIComponent(email)}`, {
      method: 'POST',
    });
  }
  attachClient(email: string, inboundIds: number[]) {
    return this.request<null>(`/panel/api/clients/${encodeURIComponent(email)}/attach`, {
      method: 'POST',
      body: { inboundIds },
    });
  }
  detachClient(email: string, inboundIds: number[]) {
    return this.request<null>(`/panel/api/clients/${encodeURIComponent(email)}/detach`, {
      method: 'POST',
      body: { inboundIds },
    });
  }
  resetClientTraffic(email: string) {
    return this.request<null>(`/panel/api/clients/resetTraffic/${encodeURIComponent(email)}`, {
      method: 'POST',
    });
  }
  clientTraffic(email: string) {
    return this.request<ClientTraffic | ClientTraffic[]>(
      `/panel/api/clients/traffic/${encodeURIComponent(email)}`,
    );
  }
  clientLinks(email: string) {
    return this.request<string[]>(`/panel/api/clients/links/${encodeURIComponent(email)}`);
  }
  clientIps(email: string) {
    return this.request<string[] | string>(`/panel/api/clients/ips/${encodeURIComponent(email)}`, {
      method: 'POST',
    });
  }
  clearClientIps(email: string) {
    return this.request<null>(`/panel/api/clients/clearIps/${encodeURIComponent(email)}`, {
      method: 'POST',
    });
  }
  onlines() {
    return this.request<string[]>('/panel/api/clients/onlines', { method: 'POST' });
  }
  lastOnline() {
    return this.request<Record<string, number>>('/panel/api/clients/lastOnline', {
      method: 'POST',
    });
  }
  bulkAdjust(body: { emails: string[]; addDays?: number; addBytes?: number }) {
    return this.request<unknown>('/panel/api/clients/bulkAdjust', { method: 'POST', body });
  }
  delDepleted() {
    return this.request<unknown>('/panel/api/clients/delDepleted', { method: 'POST' });
  }
  delOrphans() {
    return this.request<unknown>('/panel/api/clients/delOrphans', { method: 'POST' });
  }
}
