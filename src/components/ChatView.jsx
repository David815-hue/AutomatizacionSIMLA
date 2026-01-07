import React, { useEffect, useRef } from 'react';
import { Loader, User, FileText, ShoppingBag, Truck, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const ChatView = ({ chat, messages, loading }) => {
    const bottomRef = useRef(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Sort messages by ID ascending (Chronological: Oldest -> Newest)
    const sortedMessages = [...messages].sort((a, b) => {
        const idA = parseInt(a.id || 0);
        const idB = parseInt(b.id || 0);
        return idA - idB;
    });

    const renderContent = (msg) => {
        switch (msg.type) {
            case 'text':
                return <div className="msg-text">{msg.content}</div>;
            case 'file':
                return (
                    <div className="msg-file">
                        {msg.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4 }}>
                                <FileText size={16} />
                                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    {item.caption || item.filename || 'Attachment'}
                                </a>
                            </div>
                        ))}
                    </div>
                );
            case 'product':
                return (
                    <div className="msg-product" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShoppingBag size={16} />
                        <span>Product: {msg.product?.name || 'N/A'}</span>
                    </div>
                );
            case 'order':
                return (
                    <div className="msg-order" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={16} />
                        <span>Order #{msg.order?.number || 'N/A'}</span>
                    </div>
                );
            default:
                return <div className="msg-unknown">[{msg.type}] {msg.content}</div>;
        }
    };

    if (!chat) {
        return (
            <div className="main-content empty-state">
                <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /> // Wait, MessageSquare is not imported.
                // Fixed below
                <p>Select a chat to start viewing messages</p>
            </div>
        );
    }

    return (
        <div className="main-content">
            <div className="chat-header">
                {chat.name || `Chat #${chat.id}`}
                <div style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.7 }}>
                    ID: {chat.id} | Platform: {chat.transport}
                </div>
            </div>

            <div className="messages-area">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader className="animate-spin" />
                    </div>
                ) : sortedMessages.length === 0 ? (
                    <div className="empty-state">No messages found in this chat.</div>
                ) : (
                    sortedMessages.map((msg) => {
                        const isMe = msg.scope === 'public' && msg.from?.type === 'user'; // Rough heuristic, might need adjustment based on real data
                        // Better heuristic: if 'from' is user/manager it's SENT, if 'customer' it's RECEIVED.
                        // But Simla API 'from' object structure varies.
                        // Usually scope='private' is system/internal. public is visible to customer.
                        // Let's assume right alignment for 'user' (agent) and left for 'customer'.

                        // Checking msg.from.type
                        // types: user, customer, bot, system
                        const isSent = msg.from?.type === 'user' || msg.from?.type === 'bot';

                        const senderName = msg.from?.first_name
                            ? `${msg.from.first_name} ${msg.from.last_name || ''}`
                            : msg.from?.username || msg.from?.type || 'Unknown';

                        let dateStr = '';
                        try {
                            dateStr = format(new Date(msg.created_at), 'MMM d, h:mm a');
                        } catch (e) {
                            dateStr = msg.created_at;
                        }

                        return (
                            <div key={msg.id} className={`message ${isSent ? 'sent' : 'received'}`}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.8em', marginBottom: 2 }}>{senderName}</div>
                                {renderContent(msg)}
                                <div className="message-meta">
                                    {dateStr}
                                    {/* {msg.is_read ? ' • Read' : ''} */}
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

// I forgot to import MessageSquare for the empty state inside the component if I use it.
// I'll replace it with a simple text or import it.
// I'll re-do the import.

export default ChatView;
