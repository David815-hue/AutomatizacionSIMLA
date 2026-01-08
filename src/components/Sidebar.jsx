import React from 'react';
import { MessageSquare, RefreshCw, Loader, ChevronLeft, Calendar, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Sidebar = ({ chats, loading, selectedChatId, onSelectChat, onRefresh, dateFrom, dateTo, onDateChange, managers, selectedManager, onManagerChange, onBack }) => {
    const filteredChats = chats.filter(chat => {
        if (!selectedManager) return true;
        return chat.last_dialog?.responsible?.id?.toString() === selectedManager;
    });

    return (
        <div className="sidebar">
            <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Back button */}
                <button
                    onClick={onBack}
                    className="back-btn"
                    style={{
                        alignSelf: 'flex-start',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}
                >
                    <ChevronLeft size={16} />
                    Menú Principal
                </button>

                {/* Title Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.05))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageSquare size={20} style={{ color: '#4ECDC4' }} />
                        </div>
                        <div>
                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Chats</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {filteredChats.length} conversaciones
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            onClick={onRefresh}
                            className="btn-icon"
                            title="Actualizar chats"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <ThemeToggle style={{ width: 36, height: 36 }} />
                    </div>
                </div>

                {/* Date Filters */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                }}>
                    <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        type="date"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                        value={dateFrom || ''}
                        onChange={(e) => onDateChange('from', e.target.value)}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>–</span>
                    <input
                        type="date"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                        value={dateTo || ''}
                        onChange={(e) => onDateChange('to', e.target.value)}
                    />
                </div>

                {/* Manager Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Users size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <select
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
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
            </div>

            <div className="chat-list">
                {loading && chats.length === 0 ? (
                    <div style={{
                        padding: '3rem 1rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        <div style={{
                            width: 50,
                            height: 50,
                            borderRadius: 'var(--radius-full)',
                            background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(168, 85, 247, 0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Loader className="animate-spin" size={24} style={{ color: '#FF6B6B' }} />
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Cargando chats...
                        </p>
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div style={{
                        padding: '3rem 1rem',
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>
                            {(!dateFrom && !dateTo)
                                ? "Selecciona un rango de fechas"
                                : "No hay chats en este rango"}
                        </p>
                    </div>
                ) : (
                    filteredChats.map((chat, index) => (
                        <div
                            key={chat.id}
                            className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                            onClick={() => onSelectChat(chat)}
                            style={{
                                animation: `slideIn 0.3s ease-out ${index * 0.03}s both`
                            }}
                        >
                            <div className="chat-name">{chat.name || `Chat #${chat.id}`}</div>
                            <div className="chat-preview">
                                {chat.customer ? `${chat.customer.first_name || ''} ${chat.customer.last_name || ''}`.trim() || 'Cliente' : 'Cliente desconocido'}
                            </div>
                            {chat.last_message && (
                                <div className="chat-preview" style={{
                                    marginTop: '0.25rem',
                                    opacity: 0.7
                                }}>
                                    {chat.last_message.type === 'text'
                                        ? chat.last_message.content?.substring(0, 50) + (chat.last_message.content?.length > 50 ? '...' : '')
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
