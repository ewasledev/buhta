export interface ServerStatus {
  cpu: number;
  cpuCores?: number;
  mem: { current: number; total: number };
  disk: { current: number; total: number };
  netIO: { up: number; down: number };
  uptime: number;
  xray: { state: string; errorMsg?: string; version: string };
}

export interface Inbound {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  enable: boolean;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  listen?: string;
  settings?: string;
  streamSettings?: string;
  sniffing?: string;
  clientStats?: { email: string; up: number; down: number; enable: boolean }[];
}

export interface PanelUpdateInfo {
  hasUpdate?: boolean;
  currentVersion?: string;
  latestVersion?: string;
}

export interface Dashboard {
  status: ServerStatus | null;
  onlines: string[] | null;
  inbounds: Inbound[] | null;
  updateInfo: PanelUpdateInfo | null;
}

export interface Session {
  user: { id: number; first_name?: string; username?: string };
  panel: { available: boolean; xrayState?: string; xrayVersion?: string };
}

export interface PanelClient {
  email: string;
  subId?: string;
  enable: boolean;
  totalGB: number;
  expiryTime: number;
  limitIp: number;
  comment?: string;
  flow?: string;
  inboundIds?: number[];
  traffic?: { up: number; down: number; enable: boolean };
}

export interface PagedClients {
  items: PanelClient[];
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
  summary?: {
    total: number;
    active: number;
    online: string[];
    depleted: string[];
    expiring: string[];
    deactive: string[];
  };
}

export interface ClientTraffic {
  email: string;
  up: number;
  down: number;
  total: number;
  enable: boolean;
  expiryTime: number;
}

export interface PanelClientDetail {
  client: PanelClient | null;
  traffic: ClientTraffic | ClientTraffic[] | null;
  lastOnline: number | null;
  links: string[] | null;
  linkedBotClient: BotClient | null;
}

export interface BotClient {
  id: number;
  name: string;
  isVip: boolean;
  price: number;
  xuiEmail: string | null;
  subscriptionEnd: string | null;
}

export interface HistoryPoint {
  t: number;
  v: number;
}

export interface ServerUpdates {
  xrayVersions: string[] | null;
  panelUpdateInfo: PanelUpdateInfo | null;
}
