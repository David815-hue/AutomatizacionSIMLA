import React, { Suspense, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import MainSelection from './components/MainSelection';
import { createClient } from './api/simla';
import { useChats, useMessages, useManagers } from './hooks/useSimlaData';

const EvaluationPanel = React.lazy(() => import('./components/EvaluationPanel'));

const resolveInitialCredentials = () => {
  const envEndpoint = import.meta.env.VITE_ENDPOINT_URL;
  const envToken = import.meta.env.VITE_TOKEN;

  if (envEndpoint && envToken) {
    return { baseUrl: envEndpoint.replace(/\/$/, ''), token: envToken };
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const savedEndpoint = localStorage.getItem('simla_endpoint');
  const savedToken = localStorage.getItem('simla_token');

  if (savedEndpoint && savedToken) {
    return { baseUrl: savedEndpoint.replace(/\/$/, ''), token: savedToken };
  }

  return null;
};

function App() {
  const [credentials, setCredentials] = useState(resolveInitialCredentials);
  const [client, setClient] = useState(() =>
    credentials ? createClient(credentials.baseUrl, credentials.token) : null
  );

  const [selectedChat, setSelectedChat] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  // 'selection' | 'chats' | 'evaluation'
  const [currentView, setCurrentView] = useState('selection');

  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useChats(client, dateFrom, dateTo);
  const { data: messages = [], isLoading: loadingMessages } = useMessages(client, selectedChat?.id);
  const { data: managers = [] } = useManagers(client, chats);

  const handleLogin = (endpoint, token) => {
    const baseUrl = endpoint.replace(/\/$/, '');
    const nextCredentials = { baseUrl, token };

    setCredentials(nextCredentials);
    setClient(createClient(baseUrl, token));

    localStorage.setItem('simla_endpoint', baseUrl);
    localStorage.setItem('simla_token', token);
  };

  const handleDateChange = (type, value) => {
    if (type === 'from') setDateFrom(value);
    if (type === 'to') setDateTo(value);
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  const handleBackToMenu = () => {
    setCurrentView('selection');
    setSelectedChat(null);
  };

  if (!credentials) {
    return (
      <ThemeProvider>
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  if (currentView === 'selection') {
    return (
      <ThemeProvider>
        <div className="app-container">
          <MainSelection onSelect={setCurrentView} />
        </div>
      </ThemeProvider>
    );
  }

  if (currentView === 'chats') {
    return (
      <ThemeProvider>
        <div className="app-container">
          <Sidebar
            chats={chats}
            loading={loadingChats}
            selectedChatId={selectedChat?.id}
            onSelectChat={handleSelectChat}
            onRefresh={refetchChats}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
            managers={managers}
            selectedManager={selectedManager}
            onManagerChange={setSelectedManager}
            onBack={handleBackToMenu}
          />
          <ChatView
            chat={selectedChat}
            messages={messages}
            loading={loadingMessages}
          />
        </div>
      </ThemeProvider>
    );
  }

  if (currentView === 'evaluation') {
    return (
      <ThemeProvider>
        <div className="app-container">
          <div className="evaluation-layout" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="evaluation-nav-header glass-effect" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <button className="back-btn" onClick={handleBackToMenu}>
                ? Volver al Menú
              </button>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Evaluación de Gestores</h3>
            </div>
            <Suspense
              fallback={
                <div style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
                  Cargando módulo de evaluación...
                </div>
              }
            >
              <EvaluationPanel client={client} />
            </Suspense>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return null;
}

export default App;
