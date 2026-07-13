export interface XuiEnvelope<T = unknown> {
  success: boolean;
  msg: string;
  obj: T;
}

export interface HistoryPoint {
  t: number;
  v: number;
}

export interface ServerStatus {
  cpu: number;
  cpuCores?: number;
  mem: { current: number; total: number };
  disk: { current: number; total: number };
  netIO: { up: number; down: number };
  netTraffic?: { sent: number; recv: number };
  uptime: number;
  xray: { state: string; errorMsg?: string; version: string };
  loads?: number[];
  tcpCount?: number;
  udpCount?: number;
  appStats?: { threads: number; mem: number; uptime: number };
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

export interface ClientTraffic {
  email: string;
  up: number;
  down: number;
  total: number;
  enable: boolean;
  expiryTime: number;
}

export interface PanelClient {
  email: string;
  subId?: string;
  enable: boolean;
  totalGB: number; // байты, несмотря на имя
  expiryTime: number; // ms-epoch; 0 = безлимит
  limitIp: number;
  comment?: string;
  tgId?: number | string;
  flow?: string;
  inboundIds?: number[];
  traffic?: { up: number; down: number; enable: boolean };
  createdAt?: number;
  updatedAt?: number;
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

export interface PagedClientsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: string;
  inboundId?: number;
  sort?: string;
}

export interface PanelUpdateInfo {
  hasUpdate?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  releaseNotes?: string;
}
