import React, { useState } from 'react';
import { BarChart3, Play, Loader, ChevronDown, ChevronUp, Eye, X } from 'lucide-react';
import { evaluateMultipleChats } from '../api/groq';

const EvaluationPanel = ({ chats, managers, client }) => {
    const [selectedManager, setSelectedManager] = useState('');
    const [sampleCount, setSampleCount] = useState(5);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const [expandedChat, setExpandedChat] = useState(null);
    const [modalChat, setModalChat] = useState(null);

    // Date filters - default to today
    const getTodayDate = () => new Date().toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(getTodayDate);
    const [dateTo, setDateTo] = useState(getTodayDate);

    // Specific dialog ID for direct evaluation
    const [specificDialogId, setSpecificDialogId] = useState('');

    const getChatsForManager = (managerId) => {
        return chats.filter(chat => {
            // Filter by manager
            const isManager = chat.last_dialog?.responsible?.id?.toString() === managerId;
            const isClosed = chat.last_dialog?.closed_at !== null;

            if (!isManager || !isClosed) return false;

            // Filter by date if specified (using dialog close date)
            if (dateFrom || dateTo) {
                const closedAtStr = chat.last_dialog?.closed_at;
                if (!closedAtStr) return false;

                // Convert UTC date to local date for comparison
                const chatDate = new Date(closedAtStr);
                // Get local date string (YYYY-MM-DD) for comparison
                const chatLocalDate = chatDate.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format

                if (dateFrom && chatLocalDate < dateFrom) return false;
                if (dateTo && chatLocalDate > dateTo) return false;
            }

            return true;
        });
    };

    const selectRandomChats = (managerChats, count) => {
        const shuffled = [...managerChats].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    const handleEvaluate = async () => {
        // If specific dialog ID is provided, evaluate that directly
        if (specificDialogId.trim()) {
            await handleEvaluateSpecificDialog();
            return;
        }

        if (!selectedManager) {
            alert('Por favor selecciona un gestor o ingresa un ID de diálogo específico');
            return;
        }

        const manager = managers.find(m => m.id.toString() === selectedManager);

        const managerChats = getChatsForManager(selectedManager);
        console.log('[DEBUG] Chats after date filter:', managerChats.length);

        if (managerChats.length === 0) {
            alert('No hay chats para este gestor en el rango de fechas seleccionado.');
            return;
        }

        const selectedChats = selectRandomChats(managerChats, sampleCount);
        setIsEvaluating(true);
        setResults([]);
        setProgress({ current: 0, total: selectedChats.length });

        try {
            const chatsWithMessages = [];
            for (const chat of selectedChats) {
                const messages = await client.getMessages(chat.id, 100);
                chatsWithMessages.push({ chat, messages: Array.isArray(messages) ? messages : [] });
            }

            const evaluationResults = await evaluateMultipleChats(
                chatsWithMessages,
                manager.name,
                (current, total) => setProgress({ current, total })
            );

            setResults(evaluationResults);
        } catch (error) {
            console.error('Evaluation error:', error);
            alert('Error al evaluar: ' + error.message);
        } finally {
            setIsEvaluating(false);
        }
    };

    // Evaluate a specific dialog by ID
    const handleEvaluateSpecificDialog = async () => {
        const dialogId = specificDialogId.trim();

        // Find the chat in loaded chats first
        let chat = chats.find(c =>
            c.id.toString() === dialogId ||
            c.last_dialog?.id?.toString() === dialogId
        );

        if (!chat) {
            // Try to fetch messages directly with the ID as chat_id
            try {
                setIsEvaluating(true);
                setResults([]);
                setProgress({ current: 0, total: 1 });

                const messages = await client.getMessages(parseInt(dialogId), 100);

                if (!messages || messages.length === 0) {
                    alert('No se encontraron mensajes para el diálogo ID: ' + dialogId);
                    setIsEvaluating(false);
                    return;
                }

                // Create a minimal chat object
                chat = {
                    id: parseInt(dialogId),
                    last_dialog: { id: parseInt(dialogId) }
                };

                const evaluationResults = await evaluateMultipleChats(
                    [{ chat, messages: Array.isArray(messages) ? messages : [] }],
                    'Gestor (ID Específico)',
                    (current, total) => setProgress({ current, total })
                );

                setResults(evaluationResults);
            } catch (error) {
                console.error('Error evaluating specific dialog:', error);
                alert('Error al evaluar diálogo específico: ' + error.message);
            } finally {
                setIsEvaluating(false);
            }
            return;
        }

        // Chat found in loaded chats
        setIsEvaluating(true);
        setResults([]);
        setProgress({ current: 0, total: 1 });

        try {
            const messages = await client.getMessages(chat.id, 100);
            const managerName = chat.last_dialog?.responsible?.name ||
                chat.last_dialog?.responsible?.first_name ||
                'Gestor';

            const evaluationResults = await evaluateMultipleChats(
                [{ chat, messages: Array.isArray(messages) ? messages : [] }],
                managerName,
                (current, total) => setProgress({ current, total })
            );

            setResults(evaluationResults);
        } catch (error) {
            console.error('Error evaluating specific dialog:', error);
            alert('Error al evaluar diálogo específico: ' + error.message);
        } finally {
            setIsEvaluating(false);
        }
    };

    const calculateAverages = () => {
        const validResults = results.filter(r => r.evaluation && !r.error);
        if (validResults.length === 0) return null;

        const sum = {
            scripts: 0,
            protocolo: 0,
            calidad: 0,
            registro: 0,
            total: 0
        };

        validResults.forEach(r => {
            sum.scripts += r.evaluation.scripts.total;
            sum.protocolo += r.evaluation.protocolo.total;
            sum.calidad += r.evaluation.calidad.total;
            sum.registro += r.evaluation.registro.total;
            sum.total += r.evaluation.promedio_final;
        });

        const count = validResults.length;
        return {
            scripts: (sum.scripts / count).toFixed(1),
            protocolo: (sum.protocolo / count).toFixed(1),
            calidad: (sum.calidad / count).toFixed(1),
            registro: (sum.registro / count).toFixed(1),
            total: (sum.total / count).toFixed(1)
        };
    };

    const manager = managers.find(m => m.id.toString() === selectedManager);
    const averages = calculateAverages();

    return (
        <div className="evaluation-panel">
            <div className="evaluation-header">
                <BarChart3 size={24} />
                <h2>Evaluación de Gestores</h2>
            </div>

            <div className="evaluation-controls">
                <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="form-input"
                >
                    <option value="">Seleccionar Gestor</option>
                    {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>

                <div className="sample-control">
                    <label>Desde:</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="form-input"
                        style={{ width: '140px' }}
                    />
                </div>

                <div className="sample-control">
                    <label>Hasta:</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="form-input"
                        style={{ width: '140px' }}
                    />
                </div>

                <div className="sample-control">
                    <label>Muestras:</label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={sampleCount}
                        onChange={(e) => setSampleCount(parseInt(e.target.value) || 5)}
                        className="form-input"
                        style={{ width: '60px' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--glass-border)', paddingLeft: '1rem', marginLeft: '0.5rem' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>O ID específico:</label>
                    <input
                        type="text"
                        value={specificDialogId}
                        onChange={(e) => setSpecificDialogId(e.target.value)}
                        placeholder="92458"
                        className="form-input"
                        style={{ width: '100px' }}
                    />
                </div>

                <button
                    onClick={handleEvaluate}
                    disabled={isEvaluating || (!selectedManager && !specificDialogId.trim())}
                    className="btn btn-primary"
                >
                    {isEvaluating ? (
                        <>
                            <Loader className="animate-spin" size={16} />
                            Evaluando {progress.current}/{progress.total}...
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            Evaluar
                        </>
                    )}
                </button>
            </div>

            {results.length > 0 && (
                <div className="evaluation-results">
                    <h3>Reporte de Coaching - {manager?.name}</h3>

                    <table className="evaluation-table">
                        <thead>
                            <tr>
                                <th>Muestra</th>
                                <th>Dialog ID</th>
                                <th>Scripts (10%)</th>
                                <th>Protocolo (40%)</th>
                                <th>Calidad (30%)</th>
                                <th>Registro (20%)</th>
                                <th>Total</th>
                                <th>Observaciones</th>
                                <th>Ver</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, idx) => (
                                <React.Fragment key={result.chatId}>
                                    <tr
                                        className="result-row"
                                        onClick={() => setExpandedChat(expandedChat === idx ? null : idx)}
                                    >
                                        <td>
                                            {expandedChat === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {idx + 1}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{result.dialogId}</td>
                                        {result.error ? (
                                            <td colSpan="7" className="error-cell">Error: {result.error}</td>
                                        ) : (
                                            <>
                                                <td>{result.evaluation.scripts.total}</td>
                                                <td>{result.evaluation.protocolo.total}</td>
                                                <td>{result.evaluation.calidad.total}</td>
                                                <td>{result.evaluation.registro.total}</td>
                                                <td className="total-cell">{result.evaluation.promedio_final}</td>
                                                <td className="obs-cell">{result.evaluation.observaciones}</td>
                                                <td>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={(e) => { e.stopPropagation(); setModalChat(result); }}
                                                        title="Ver chat"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                    {expandedChat === idx && result.evaluation && (
                                        <tr className="detail-row">
                                            <td colSpan="7">
                                                <div className="detail-grid">
                                                    <div className="detail-section">
                                                        <h5>Scripts</h5>
                                                        <p>Saludo: {result.evaluation.scripts.saludo}/5</p>
                                                        <p>Despedida: {result.evaluation.scripts.despedida}/5</p>
                                                    </div>
                                                    <div className="detail-section">
                                                        <h5>Protocolo</h5>
                                                        <p>Personaliza: {result.evaluation.protocolo.personaliza}/4</p>
                                                        <p>Tiempos: {result.evaluation.protocolo.tiempos_respuesta}/4</p>
                                                        <p>Espera: {result.evaluation.protocolo.tiempo_espera}/6</p>
                                                        <p>Datos: {result.evaluation.protocolo.valida_datos}/4</p>
                                                        <p>Pedido: {result.evaluation.protocolo.toma_pedido}/8</p>
                                                        <p>Adicionales: {result.evaluation.protocolo.ofrece_adicionales}/7</p>
                                                        <p>Confirma: {result.evaluation.protocolo.confirma_orden}/6</p>
                                                        <p>Link pago: {result.evaluation.protocolo.link_pago}/6</p>
                                                        <p>Ayuda: {result.evaluation.protocolo.ayuda_adicional}/3</p>
                                                        <p>Silencios: {result.evaluation.protocolo.sin_silencios}/2</p>
                                                    </div>
                                                    <div className="detail-section">
                                                        <h5>Calidad</h5>
                                                        <p>Dominio: {result.evaluation.calidad.dominio}/6</p>
                                                        <p>Escucha: {result.evaluation.calidad.escucha}/4</p>
                                                        <p>Muletillas: {result.evaluation.calidad.sin_muletillas}/4</p>
                                                        <p>Empatía: {result.evaluation.calidad.empatia}/6</p>
                                                        <p>Fluidez: {result.evaluation.calidad.fluidez}/5</p>
                                                        <p>Redacción: {result.evaluation.calidad.redaccion}/5</p>
                                                    </div>
                                                    <div className="detail-section">
                                                        <h5>Registro</h5>
                                                        <p>Datos: {result.evaluation.registro.datos_completos}/10</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {averages && (
                                <tr className="average-row">
                                    <td><strong>Promedio</strong></td>
                                    <td></td>
                                    <td><strong>{averages.scripts}</strong></td>
                                    <td><strong>{averages.protocolo}</strong></td>
                                    <td><strong>{averages.calidad}</strong></td>
                                    <td><strong>{averages.registro}</strong></td>
                                    <td className="total-cell"><strong>{averages.total}</strong></td>
                                    <td></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Chat Modal */}
            {modalChat && (
                <div className="modal-overlay" onClick={() => setModalChat(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Chat - Diálogo #{modalChat.dialogId}</h3>
                            <button className="btn-icon" onClick={() => setModalChat(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {modalChat.messages && [...modalChat.messages]
                                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                                .map((msg, idx) => {
                                    const isFromCustomer = msg.from?.type === 'customer';
                                    const senderLabel = isFromCustomer ? 'Cliente' : (msg.from?.type === 'bot' ? 'Bot' : 'Agente');
                                    return (
                                        <div
                                            key={idx}
                                            className={`modal-message ${isFromCustomer ? 'received' : 'sent'}`}
                                        >
                                            <div className="message-sender">
                                                {senderLabel}
                                            </div>
                                            <div className="message-text">{msg.content || '[media]'}</div>
                                            <div className="message-time">
                                                {new Date(msg.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvaluationPanel;
