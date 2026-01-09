import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import EvaluationPanel from './components/EvaluationPanel';
import MainSelection from './components/MainSelection';
import { createClient } from './api/simla';
import { useChats, useMessages, useManagers } from './hooks/useSimlaData';

function App() {
  const [credentials, setCredentials] = useState(null);
  const [client, setClient] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  // Navigation State
  // 'selection' | 'chats' | 'evaluation'
  const [currentView, setCurrentView] = useState('selection');

  // React Query hooks - replaces manual state management
  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useChats(client, dateFrom, dateTo);
  const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useMessages(client, selectedChat?.id);
  const { data: managers = [] } = useManagers(client, chats);

  const handleLogin = (endpoint, token) => {
    // Basic validation/cleaning
    const baseUrl = endpoint.replace(/\/$/, ''); // Remove trailing slash
    setCredentials({ baseUrl, token });
    setClient(createClient(baseUrl, token));

    // Save to localStorage
    localStorage.setItem('simla_endpoint', baseUrl);
    localStorage.setItem('simla_token', token);
  };

  /* Auto-login on mount */
  useEffect(() => {
    // Priority 1: Environment variables
    const envEndpoint = import.meta.env.VITE_ENDPOINT_URL;
    const envToken = import.meta.env.VITE_TOKEN;

    if (envEndpoint && envToken) {
      const baseUrl = envEndpoint.replace(/\/$/, '');
      setCredentials({ baseUrl, token: envToken });
      setClient(createClient(baseUrl, envToken));
      console.log('✅ Auto-login using environment variables');
      return;
    }

    // Priority 2: localStorage (fallback)
    const savedEndpoint = localStorage.getItem('simla_endpoint');
    const savedToken = localStorage.getItem('simla_token');
    if (savedEndpoint && savedToken) {
      const baseUrl = savedEndpoint.replace(/\/$/, '');
      setCredentials({ baseUrl, token: savedToken });
      setClient(createClient(baseUrl, savedToken));
      console.log('✅ Auto-login using localStorage');
    }
  }, []);

  // React Query handles data fetching automatically via hooks above

  const handleDateChange = (type, value) => {
    if (type === 'from') setDateFrom(value);
    if (type === 'to') setDateTo(value);
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    // useMessages hook will automatically fetch messages when selectedChat changes
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

  // Render Selection Screen
  if (currentView === 'selection') {
    return (
      <ThemeProvider>
        <div className="app-container">
          <MainSelection onSelect={setCurrentView} />
        </div>
      </ThemeProvider>
    );
  }

  // Render Chats View
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

  // Render Evaluation View
  if (currentView === 'evaluation') {
    return (
      <ThemeProvider>
        <div className="app-container">
          <div className="evaluation-layout" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="evaluation-nav-header glass-effect" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <button className="back-btn" onClick={handleBackToMenu}>
                ← Volver al Menú
              </button>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Evaluación de Gestores</h3>
            </div>
            <EvaluationPanel
              client={client}
            />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return null;
}

export default App;
