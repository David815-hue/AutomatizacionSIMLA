import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import EvaluationPanel from './components/EvaluationPanel';
import MainSelection from './components/MainSelection';
import { createClient } from './api/simla';

function App() {
  const [credentials, setCredentials] = useState(null);
  const [client, setClient] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);

  // Navigation State
  // 'selection' | 'chats' | 'evaluation'
  const [currentView, setCurrentView] = useState('selection');

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
    const savedEndpoint = localStorage.getItem('simla_endpoint');
    const savedToken = localStorage.getItem('simla_token');
    if (savedEndpoint && savedToken) {
      // Directly set state to avoid stale reference issues
      const baseUrl = savedEndpoint.replace(/\/$/, '');
      setCredentials({ baseUrl, token: savedToken });
      setClient(createClient(baseUrl, savedToken));
    }
  }, []);

  useEffect(() => {
    if (client) {
      loadChats();
    }
  }, [client, dateFrom, dateTo]);

  // Helper to parse dates simply
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    if (end) end.setHours(23, 59, 59, 999);
    if (start) start.setHours(0, 0, 0, 0);

    if (start && date < start) return -1;
    if (end && date > end) return 1;
    return 0;
  };

  const loadChats = async () => {
    if (loadingChats) return;
    setLoadingChats(true);
    setChats([]);
    try {
      const chatMap = new Map();
      const hasDateFilter = dateFrom && dateTo;

      if (!hasDateFilter) {
        const data = await client.getChats(300, 0);
        if (Array.isArray(data)) {
          data.forEach(chat => chatMap.set(chat.id, chat));
        }
      } else {
        let offset = 0;
        let limit = 100;
        let stop = false;
        const MAX_PAGES = 50;
        let pages = 0;

        while (!stop && pages < MAX_PAGES) {
          console.log(`[loadChats] Fetching page ${pages + 1}, offset: ${offset}`);
          const data = await client.getChats(limit, offset);

          if (!Array.isArray(data) || data.length === 0) {
            stop = true;
            break;
          }

          let olderFound = false;
          for (const chat of data) {
            const dateStr = chat.last_message?.created_at || chat.created_at;
            const comparison = isDateInRange(dateStr);

            if (comparison === 0) {
              if (!chatMap.has(chat.id)) {
                chatMap.set(chat.id, chat);
              }
            } else if (comparison === -1) {
              olderFound = true;
            }
          }

          if (olderFound) {
            stop = true;
          }
          offset += limit;
          pages++;
        }
      }

      const allChats = Array.from(chatMap.values());

      const managerMap = new Map();
      allChats.forEach(chat => {
        const responsible = chat.last_dialog?.responsible;
        if (responsible && responsible.id) {
          managerMap.set(responsible.id, {
            id: responsible.id,
            name: responsible.name || responsible.first_name || `Manager ${responsible.id}`
          });
        }
      });
      const uniqueManagers = Array.from(managerMap.values())
        .filter(m => !m.name.toLowerCase().includes('bot'));

      setManagers(uniqueManagers);
      setChats(allChats);
    } catch (error) {
      console.error(error);
      alert("Failed to load chats. Check console.");
    } finally {
      setLoadingChats(false);
    }
  };

  const handleDateChange = (type, value) => {
    if (type === 'from') setDateFrom(value);
    if (type === 'to') setDateTo(value);
  };

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const msgs = await client.getMessages(chat.id, 100);
      if (Array.isArray(msgs)) {
        setMessages(msgs);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMessages(false);
    }
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
            onRefresh={loadChats}
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
