import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/common';
import { tgBackButton } from './sdk';
import { Dashboard } from './screens/Dashboard';
import { InboundsList } from './screens/inbounds/InboundsList';
import { InboundDetail } from './screens/inbounds/InboundDetail';
import { InboundForm } from './screens/inbounds/InboundForm';
import { ClientsList } from './screens/clients/ClientsList';
import { ClientDetail } from './screens/clients/ClientDetail';
import { ClientForm } from './screens/clients/ClientForm';
import { LinkScreen } from './screens/Link';
import { ServerScreen } from './screens/server/Server';
import { LogsScreen } from './screens/server/Logs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

const TABS = [
  { path: '/', icon: '📊', label: 'Обзор' },
  { path: '/inbounds', icon: '🔀', label: 'Инбаунды' },
  { path: '/clients', icon: '👥', label: 'Клиенты' },
  { path: '/server', icon: '🖥', label: 'Сервер' },
];

const TAB_ROOTS = new Set(TABS.map((t) => t.path));

function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.path}
          className={`tab ${activeTab(tab.path) ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function BackButtonBinding() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (TAB_ROOTS.has(location.pathname)) {
      tgBackButton.hide();
      return;
    }
    return tgBackButton.show(() => navigate(-1));
  }, [location.pathname, navigate]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <HashRouter>
          <BackButtonBinding />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbounds" element={<InboundsList />} />
            <Route path="/inbounds/new" element={<InboundForm />} />
            <Route path="/inbounds/:id" element={<InboundDetail />} />
            <Route path="/inbounds/:id/edit" element={<InboundForm />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:email" element={<ClientDetail />} />
            <Route path="/clients/:email/edit" element={<ClientForm />} />
            <Route path="/link" element={<LinkScreen />} />
            <Route path="/server" element={<ServerScreen />} />
            <Route path="/server/logs" element={<LogsScreen />} />
            {/* Telegram Desktop/Web открывает Mini App с #tgWebAppData=... — HashRouter видит несуществующий путь */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <TabBar />
        </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
