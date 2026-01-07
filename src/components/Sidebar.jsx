import React from 'react';
import { MessageSquare, RefreshCw, Loader } from 'lucide-react';

const Sidebar = ({ chats, loading, selectedChatId, onSelectChat, onRefresh, dateFrom, dateTo, onDateChange, managers, selectedManager, onManagerChange }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageSquare size={24} className="text-primary" />
                        <span>Chats</span>
                    </div>
                    <button
                        onClick={onRefresh}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                        title="Refresh Chats"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                    <input
                        type="date"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: 4 }}
                        value={dateFrom || ''}
                        onChange={(e) => onDateChange('from', e.target.value)}
                    />
                    <input
                        type="date"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: 4 }}
                        value={dateTo || ''}
                        onChange={(e) => onDateChange('to', e.target.value)}
                    />
                </div>
                <select
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: 4 }}
                    value={selectedManager}
                    onChange={(e) => onManagerChange(e.target.value)}
                >
                    <option value="">Todos los gestores</option>
                    {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                            {manager.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="chat-list">
                {loading && chats.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6 }}>
                        <Loader className="animate-spin" style={{ margin: '0 auto' }} />
                        <p>Loading chats...</p>
                    </div>
                ) : chats.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6 }}>
                        {(!dateFrom && !dateTo)
                            ? "Please select a date range to view chats."
                            : "No chats found."}
                    </div>
                ) : (
                    chats
                        .filter(chat => {
                            if (!selectedManager) return true; // Show all if no manager selected
                            return chat.last_dialog?.responsible?.id?.toString() === selectedManager;
                        })
                        .map((chat) => (
                            <div
                                key={chat.id}
                                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                                onClick={() => onSelectChat(chat)}
                            >
                                <div className="chat-name">{chat.name || `Chat #${chat.id}`}</div>
                                <div className="chat-preview">
                                    {chat.customer ? `${chat.customer.first_name || ''} ${chat.customer.last_name || ''}` : 'Unknown Customer'}
                                </div>
                                {chat.last_message && (
                                    <div className="chat-preview" style={{ marginTop: 4 }}>
                                        {chat.last_message.type === 'text'
                                            ? chat.last_message.content
                                            : `[${chat.last_message.type}]`}
                                    </div>
                                )}
                            </div>
                        ))
                )}
            </div>
        </div>
    );
};

export default Sidebar;
