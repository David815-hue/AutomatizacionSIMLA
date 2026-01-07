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

    const getChatsForManager = (managerId) => {
        return chats.filter(chat =>
            chat.last_dialog?.responsible?.id?.toString() === managerId &&
            chat.last_dialog?.closed_at !== null // Solo diálogos finalizados
        );
    };

    const selectRandomChats = (managerChats, count) => {
        const shuffled = [...managerChats].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    const handleEvaluate = async () => {
        if (!selectedManager) {
            alert('Por favor selecciona un gestor');
            return;
        }

        const manager = managers.find(m => m.id.toString() === selectedManager);
        const managerChats = getChatsForManager(selectedManager);

        if (managerChats.length === 0) {
            alert('No hay chats para este gestor');
            return;
        }

        const selectedChats = selectRandomChats(managerChats, sampleCount);
        setIsEvaluating(true);
        setResults([]);
        setProgress({ current: 0, total: selectedChats.length });

        try {
            // Load messages for each chat
            const chatsWithMessages = [];
            for (const chat of selectedChats) {
                const messages = await client.getMessages(chat.id, 100);
                chatsWithMessages.push({ chat, messages: Array.isArray(messages) ? messages : [] });
            }

            // Evaluate with Groq
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

                <button
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !selectedManager}
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
