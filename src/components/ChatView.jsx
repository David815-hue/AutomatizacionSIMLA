import React, { useEffect, useRef } from 'react';
import { Loader, User, FileText, ShoppingBag, Truck, MessageCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const ChatView = ({ chat, messages, loading }) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const sortedMessages = [...messages].sort((a, b) => {
        const idA = parseInt(a.id || 0);
        const idB = parseInt(b.id || 0);
        return idA - idB;
    });

    const renderContent = (msg) => {
        switch (msg.type) {
            case 'text':
                return <div className="msg-text">{msg.content}</div>;
            case 'image':
                return (
                    <div className="msg-image">
                        {msg.items?.map((item, idx) => (
                            <a
                                key={idx}
                                href={item.preview_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'block', marginTop: idx > 0 ? '0.5rem' : 0 }}
                            >
                                <img
                                    src={item.preview_url}
                                    alt="Imagen"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '300px',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                    onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = '<span style="color: var(--text-muted)">[Imagen no disponible]</span>';
                                    }}
                                />
                            </a>
                        ))}
                    </div>
                );
            case 'file':
                return (
                    <div className="msg-file">
                        {msg.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4 }}>
                                <FileText size={16} />
                                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    {item.caption || item.filename || 'Archivo adjunto'}
                                </a>
                            </div>
                        ))}
                    </div>
                );
            case 'product':
                return (
                    <div className="msg-product" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShoppingBag size={16} />
                        <span>Producto: {msg.product?.name || 'N/A'}</span>
                    </div>
                );
            case 'order':
                return (
                    <div className="msg-order" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={16} />
                        <span>Pedido #{msg.order?.number || 'N/A'}</span>
                    </div>
                );
            default:
                return <div className="msg-unknown">[{msg.type}] {msg.content}</div>;
        }
    };

    if (!chat) {
        return (
            <div className="main-content empty-state">
                <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(168, 85, 247, 0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <MessageCircle size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                    Sin chat seleccionado
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Selecciona una conversación para ver los mensajes
                </p>
            </div>
        );
    }

    return (
        <div className="main-content">
            <div className="chat-header">
                <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                        {chat.name || `Chat #${chat.id}`}
                    </div>
                    <div style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.25rem'
                    }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.5rem',
                            background: 'rgba(78, 205, 196, 0.15)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            color: '#4ECDC4'
                        }}>
                            {chat.transport}
                        </span>
                        <span>ID: {chat.id}</span>
                    </div>
                </div>
            </div>

            <div className="messages-area">
                {loading ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '3rem',
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
                        <p style={{ color: 'var(--text-secondary)' }}>Cargando mensajes...</p>
                    </div>
                ) : sortedMessages.length === 0 ? (
                    <div className="empty-state">
                        <MessageCircle size={36} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No hay mensajes en este chat</p>
                    </div>
                ) : (
                    sortedMessages.map((msg, index) => {
                        const isSent = msg.from?.type === 'user' || msg.from?.type === 'bot';

                        const senderName = msg.from?.first_name
                            ? `${msg.from.first_name} ${msg.from.last_name || ''}`
                            : msg.from?.username || msg.from?.type || 'Desconocido';

                        let dateStr = '';
                        try {
                            dateStr = format(new Date(msg.created_at), 'MMM d, h:mm a');
                        } catch (e) {
                            dateStr = msg.created_at;
                        }

                        return (
                            <div
                                key={msg.id}
                                className={`message ${isSent ? 'sent' : 'received'}`}
                                style={{
                                    animationDelay: `${index * 0.02}s`
                                }}
                            >
                                <div style={{
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    marginBottom: '0.25rem',
                                    opacity: 0.8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}>
                                    <User size={12} />
                                    {senderName}
                                </div>
                                {renderContent(msg)}
                                <div className="message-meta" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '0.25rem'
                                }}>
                                    <Clock size={10} />
                                    {dateStr}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default ChatView;
