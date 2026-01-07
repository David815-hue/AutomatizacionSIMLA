import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import EvaluationPanel from './components/EvaluationPanel';
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
  const [appMode, setAppMode] = useState('chats'); // 'chats' or 'evaluation'

  const handleLogin = (endpoint, token) => {
    // Basic validation/cleaning
    const baseUrl = endpoint.replace(/\/$/, ''); // Remove trailing slash
    setCredentials({ baseUrl, token });
    setClient(createClient(baseUrl, token));
  };

  useEffect(() => {
    if (client) {
      loadChats();
    }
  }, [client, dateFrom, dateTo]);

  // Helper to parse dates simply (YYYY-MM-DD input, API usually ISO or similar)
  // We assume API returns `created_at` or `last_message.created_at`. Let's assume `created_at` on chat object or last message.
  // Actually, chat usually has `created_at`.
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    // Set end date to end of day
    if (end) end.setHours(23, 59, 59, 999);
    // Set start date to start of day
    if (start) start.setHours(0, 0, 0, 0);

    if (start && date < start) return -1; // Older than range
    if (end && date > end) return 1; // Newer than range
    return 0; // In range
  };

  const loadChats = async () => {
    if (loadingChats) return; // Prevent concurrent calls
    setLoadingChats(true);
    setChats([]); // Clear current list
    try {
      const chatMap = new Map(); // Use Map to prevent duplicates
      const hasDateFilter = dateFrom && dateTo;

      // If no date filter, just load 150 chats quickly
      if (!hasDateFilter) {
        const data = await client.getChats(300, 0);
        if (Array.isArray(data)) {
          data.forEach(chat => chatMap.set(chat.id, chat));
        }
      } else {
        // With date filter, do deep fetch
        let offset = 0;
        let limit = 100;
        let stop = false;
        const MAX_PAGES = 50;
        let pages = 0;

        while (!stop && pages < MAX_PAGES) {
          console.log(`[loadChats] Fetching page ${pages + 1}, offset: ${offset}`);
          const data = await client.getChats(limit, offset);
          console.log(`[loadChats] Received ${data?.length || 0} chats`);

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
            console.log(`[loadChats] Found older chats, stopping.`);
            stop = true;
          }

          offset += limit;
          pages++;
        }
      }

      const allChats = Array.from(chatMap.values());
      console.log(`[loadChats] Total unique chats: ${allChats.length}`);

      // Extract unique managers from chats
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
        .filter(m => !m.name.toLowerCase().includes('bot')); // Exclude bots
      console.log(`[loadChats] Found ${uniqueManagers.length} unique managers`);
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

  if (!credentials) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <div className="mode-tabs">
        <button
          className={`mode-tab ${appMode === 'chats' ? 'active' : ''}`}
          onClick={() => setAppMode('chats')}
        >
          Ver Chats
        </button>
        <button
          className={`mode-tab ${appMode === 'evaluation' ? 'active' : ''}`}
          onClick={() => setAppMode('evaluation')}
        >
          Evaluar Gestores
        </button>
      </div>

      {appMode === 'chats' ? (
        <>
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
          />
          <ChatView
            chat={selectedChat}
            messages={messages}
            loading={loadingMessages}
          />
        </>
      ) : (
        <EvaluationPanel
          chats={chats}
          managers={managers}
          client={client}
        />
      )}
    </div>
  );
}

export default App;
