import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Play, Loader, ChevronDown, ChevronUp, Eye, X, RefreshCw } from 'lucide-react';
import { evaluateMultipleChats } from '../api/groq';
import ThemeToggle from './ThemeToggle';

// Lista de gestores conocidos con sus emails
const KNOWN_MANAGERS = [
    { name: 'Garcia Carlos', email: 'callcentersap3@puntofarma.hn' },
    { name: 'Salgado Alondra', email: 'marielllandino28@gmail.com' },
    { name: 'Martinez Daniela', email: 'josselyndanielamartinez@gmail.com' },
    { name: 'Maldonado Evelyn', email: 'callcentersap1@puntofarma.hn' },
    { name: 'Ochoa Gloria', email: 'callcenter3@puntofarma.hn' },
    { name: 'Cruz Jennifer', email: 'callcenter2@puntofarma.hn' },
    { name: 'Lino Karen', email: 'callcenter1@puntofarma.hn' },
    { name: 'Rivera Kesia', email: 'ccvnppf2@gmail.com' },
    { name: 'Corea Kimberly', email: 'coreakimberly848@gmail.com' },
    { name: 'Silva Larissa', email: 'callcenter5@puntofarma.hn' },
    { name: 'Amador Maria Fernanda', email: 'f4987740@gmail.com' },
    { name: 'Rivas Maria Jose', email: 'mariajoserivas50@gmail.com' },
    { name: 'Melendez Paola', email: 'callcentersap2@puntofarma.hn' },
    { name: 'Sanchez Yohana', email: 'callcenter6@puntofarma.hn' },
];

const EvaluationPanel = ({ client }) => {
    const [selectedManager, setSelectedManager] = useState('');
    const [sampleCount, setSampleCount] = useState(5);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const [expandedChat, setExpandedChat] = useState(null);
    const [modalChat, setModalChat] = useState(null);

    // Local chats state - loaded based on date filters
    const [localChats, setLocalChats] = useState([]);
    // Map de email -> ID descubierto de los chats
    const [managerIdMap, setManagerIdMap] = useState({});
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [chatsLoaded, setChatsLoaded] = useState(false);
    // Count of dialogs for selected manager
    const [managerDialogCount, setManagerDialogCount] = useState(null);
    const [isLoadingManagerCount, setIsLoadingManagerCount] = useState(false);

    // Date filters - default to today
    const getTodayDate = () => new Date().toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(getTodayDate);
    const [dateTo, setDateTo] = useState(getTodayDate);

    // Specific dialog ID for direct evaluation
    const [specificDialogId, setSpecificDialogId] = useState('');

    // Helper to check if date is in range
    const isDateInRange = useCallback((dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const start = dateFrom ? new Date(dateFrom) : null;
        const end = dateTo ? new Date(dateTo) : null;

        if (end) end.setHours(23, 59, 59, 999);
        if (start) start.setHours(0, 0, 0, 0);

        if (start && date < start) return -1;
        if (end && date > end) return 1;
        return 0;
    }, [dateFrom, dateTo]);

    // Load users once to build the email -> ID map
    const loadUsers = useCallback(async () => {
        if (!client) return;

        try {
            console.log('[EvaluationPanel] Loading users...');
            const users = await client.getUsers(100);

            if (!Array.isArray(users)) {
                console.warn('[EvaluationPanel] Users response is not an array');
                return;
            }

            const emailToIdMap = {};
            users.forEach(user => {
                // Build maps by various identifiers
                const firstName = user.first_name?.toLowerCase() || '';
                const lastName = user.last_name?.toLowerCase() || '';
                const fullName = `${firstName} ${lastName}`.trim();
                const username = user.username?.toLowerCase() || '';

                // Store by ID for reverse lookup
                emailToIdMap[`id:${user.id}`] = user;

                // Store by name variations
                if (fullName) {
                    emailToIdMap[`name:${fullName}`] = user.id;
                    emailToIdMap[`name:${lastName} ${firstName}`.trim()] = user.id;
                }
                if (username) {
                    emailToIdMap[`username:${username}`] = user.id;
                }

                // Try to match with known managers by name
                KNOWN_MANAGERS.forEach(km => {
                    const kmParts = km.name.toLowerCase().split(' ');
                    if (kmParts.some(part => fullName.includes(part) || (lastName && lastName.includes(part)))) {
                        emailToIdMap[km.email] = user.id;
                    }
                });
            });

            console.log('[EvaluationPanel] Users loaded:', users.length, 'Map:', emailToIdMap);
            setManagerIdMap(emailToIdMap);
        } catch (error) {
            console.error('[EvaluationPanel] Error loading users:', error);
        }
    }, [client]);

    // Load dialogs for date range - OPTIMIZED using API filters
    const loadDialogsForDateRange = useCallback(async () => {
        if (!client || !dateFrom || !dateTo) return;

        setIsLoadingChats(true);
        setLocalChats([]);

        try {
            // Parse dates correctly in local timezone
            // dateFrom and dateTo are in format "YYYY-MM-DD"
            const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
            const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);

            // Create dates in local timezone
            const sinceDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
            const untilDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

            console.log(`[EvaluationPanel] Loading dialogs from ${sinceDate.toISOString()} to ${untilDate.toISOString()}`);

            // Paginate through all dialogs using since_id
            const allDialogs = [];
            let lastId = null;
            let hasMore = true;
            const MAX_PAGES = 50;
            let page = 0;

            while (hasMore && page < MAX_PAGES) {
                console.log(`[EvaluationPanel] Fetching dialogs page ${page + 1}, sinceId: ${lastId || 'none'}`);

                const dialogs = await client.getDialogs({
                    since: sinceDate.toISOString(),
                    until: untilDate.toISOString(),
                    active: false, // Only closed dialogs
                    limit: 100,
                    sinceId: lastId
                });

                if (!Array.isArray(dialogs) || dialogs.length === 0) {
                    hasMore = false;
                    break;
                }

                allDialogs.push(...dialogs);

                // Get the last dialog ID for pagination
                const lastDialog = dialogs[dialogs.length - 1];
                lastId = lastDialog?.id;

                // If we got less than limit, there are no more pages
                if (dialogs.length < 100) {
                    hasMore = false;
                }

                page++;
            }

            console.log(`[EvaluationPanel] Loaded ${allDialogs.length} dialogs total (${page} pages)`);

            // Convert dialogs to the chat-like format we need
            const dialogsWithInfo = allDialogs.map(dialog => ({
                id: dialog.chat_id,
                dialogId: dialog.id,
                last_dialog: {
                    id: dialog.id,
                    closed_at: dialog.closed_at,
                    created_at: dialog.created_at,
                    responsible: dialog.responsible
                }
            }));

            setLocalChats(dialogsWithInfo);
            setChatsLoaded(true);
        } catch (error) {
            console.error('[EvaluationPanel] Error loading dialogs:', error);
            alert('Error cargando diálogos: ' + error.message);
        } finally {
            setIsLoadingChats(false);
        }
    }, [client, dateFrom, dateTo]);

    // Load users on mount
    useEffect(() => {
        if (client) {
            loadUsers();
        }
    }, [client, loadUsers]);

    // Auto-load dialogs when dates change
    useEffect(() => {
        if (client && dateFrom && dateTo) {
            loadDialogsForDateRange();
        }
    }, [client, dateFrom, dateTo, loadDialogsForDateRange]);

    // Load manager dialog count when manager or dates change
    useEffect(() => {
        const loadManagerCount = async () => {
            if (!selectedManager || !client || !dateFrom || !dateTo || !chatsLoaded) {
                setManagerDialogCount(null);
                return;
            }

            const knownManager = KNOWN_MANAGERS.find(m => m.email === selectedManager);
            if (!knownManager) return;

            const managerId = managerIdMap[selectedManager.toLowerCase()]
                || managerIdMap[`name:${knownManager.name.toLowerCase()}`];

            if (!managerId) {
                setManagerDialogCount(0);
                return;
            }

            setIsLoadingManagerCount(true);
            try {
                // Parse dates correctly in local timezone
                const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
                const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);
                const sinceDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
                const untilDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

                // Get messages from this manager
                const messages = await client.getMessagesByUser({
                    userId: managerId,
                    since: sinceDate.toISOString(),
                    until: untilDate.toISOString(),
                    limit: 100
                });

                if (Array.isArray(messages)) {
                    // Get dialog IDs from messages
                    const dialogIdsFromMessages = new Set(messages.filter(m => m.dialog?.id).map(m => m.dialog.id));

                    // Get dialog IDs from closed dialogs (localChats)
                    const closedDialogIds = new Set(localChats.map(c => c.dialogId));

                    // Only count dialogs that are BOTH from the manager AND closed
                    const closedManagerDialogs = [...dialogIdsFromMessages].filter(id => closedDialogIds.has(id));

                    setManagerDialogCount(closedManagerDialogs.length);
                } else {
                    setManagerDialogCount(0);
                }
            } catch (error) {
                console.error('Error loading manager count:', error);
                setManagerDialogCount(null);
            } finally {
                setIsLoadingManagerCount(false);
            }
        };

        loadManagerCount();
    }, [selectedManager, client, dateFrom, dateTo, managerIdMap, chatsLoaded, localChats]);

    // Get dialogs for a specific manager by fetching their messages
    const getDialogsForManager = async (managerEmail) => {
        // Find the known manager
        const knownManager = KNOWN_MANAGERS.find(m => m.email === managerEmail);
        if (!knownManager) return [];

        // Get the ID from our map
        const managerId = managerIdMap[managerEmail.toLowerCase()]
            || managerIdMap[`name:${knownManager.name.toLowerCase()}`];

        if (!managerId) {
            console.log(`[getDialogsForManager] No ID found for ${knownManager.name}`);
            return [];
        }

        console.log(`[getDialogsForManager] Looking for dialogs of ${knownManager.name} (ID: ${managerId})`);

        try {
            // Parse dates correctly in local timezone
            const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
            const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);
            const sinceDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
            const untilDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

            // Get messages from this user in the date range
            const allMessages = [];
            let lastId = null;
            let hasMore = true;
            const MAX_PAGES = 20;
            let page = 0;

            while (hasMore && page < MAX_PAGES) {
                const messages = await client.getMessagesByUser({
                    userId: managerId,
                    since: sinceDate.toISOString(),
                    until: untilDate.toISOString(),
                    limit: 100,
                    sinceId: lastId
                });

                if (!Array.isArray(messages) || messages.length === 0) {
                    hasMore = false;
                    break;
                }

                allMessages.push(...messages);
                lastId = messages[messages.length - 1]?.id;

                if (messages.length < 100) {
                    hasMore = false;
                }
                page++;
            }

            console.log(`[getDialogsForManager] Found ${allMessages.length} messages from this manager`);

            // Extract unique dialog IDs from manager's messages
            const dialogIdsFromMessages = new Set();
            allMessages.forEach(msg => {
                if (msg.dialog?.id) {
                    dialogIdsFromMessages.add(msg.dialog.id);
                }
            });

            console.log(`[getDialogsForManager] Found ${dialogIdsFromMessages.size} unique dialogs from messages`);

            // Get closed dialog IDs from localChats
            const closedDialogIds = new Set(localChats.map(c => c.dialogId));

            // Only include dialogs that are CLOSED
            const closedManagerDialogIds = [...dialogIdsFromMessages].filter(id => closedDialogIds.has(id));

            console.log(`[getDialogsForManager] ${closedManagerDialogIds.length} of those are closed`);

            // Convert to the format we need
            return closedManagerDialogIds.map(dialogId => {
                // Try to find the dialog in localChats to get its info
                const localChat = localChats.find(c => c.dialogId === dialogId);
                return {
                    id: localChat?.id || null,
                    dialogId: dialogId,
                    last_dialog: localChat?.last_dialog || {
                        id: dialogId,
                        closed_at: new Date().toISOString(),
                        responsible: { id: managerId }
                    }
                };
            });
        } catch (error) {
            console.error('[getDialogsForManager] Error:', error);
            return [];
        }
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

        // selectedManager is now the email
        const manager = KNOWN_MANAGERS.find(m => m.email === selectedManager);

        setIsEvaluating(true);
        setResults([]);
        setProgress({ current: 0, total: 0 });

        // Find dialogs for this manager (async)
        console.log('[handleEvaluate] Finding dialogs for manager...');
        const managerDialogs = await getDialogsForManager(selectedManager);
        console.log('[handleEvaluate] Found dialogs:', managerDialogs.length);

        if (managerDialogs.length === 0) {
            alert('No hay diálogos para este gestor en el rango de fechas seleccionado.');
            setIsEvaluating(false);
            return;
        }

        const selectedChats = selectRandomChats(managerDialogs, sampleCount);
        setProgress({ current: 0, total: selectedChats.length });

        try {
            const chatsWithMessages = [];
            for (const chat of selectedChats) {
                // Use getMessagesByDialog if we have dialogId (more efficient)
                let messages;
                if (chat.dialogId) {
                    messages = await client.getMessagesByDialog(chat.dialogId, 100);
                } else {
                    messages = await client.getMessages(chat.id, 100);
                }
                chatsWithMessages.push({ chat, messages: Array.isArray(messages) ? messages : [] });
            }

            const evaluationResults = await evaluateMultipleChats(
                chatsWithMessages,
                manager?.name || 'Gestor',
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
        let chat = localChats.find(c =>
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

    // Re-evaluate a specific row with a different dialog
    const handleReEvaluate = async (idx) => {
        if (!selectedManager) return;

        const manager = KNOWN_MANAGERS.find(m => m.email === selectedManager);
        const currentDialogIds = results.map(r => r.dialogId);

        // Get all available dialogs for this manager
        const allDialogs = await getDialogsForManager(selectedManager);

        // Filter out dialogs that are already in results
        const availableDialogs = allDialogs.filter(d => !currentDialogIds.includes(d.dialogId));

        if (availableDialogs.length === 0) {
            alert('No hay más diálogos disponibles para este gestor.');
            return;
        }

        // Pick a random one
        const newDialog = availableDialogs[Math.floor(Math.random() * availableDialogs.length)];

        // Update results to show loading state for this row
        const updatedResults = [...results];
        updatedResults[idx] = { ...updatedResults[idx], isReloading: true };
        setResults(updatedResults);

        try {
            // Get messages for the new dialog
            const messages = await client.getMessagesByDialog(newDialog.dialogId, 100);

            // Evaluate the new dialog
            const evaluationResults = await evaluateMultipleChats(
                [{ chat: newDialog, messages: Array.isArray(messages) ? messages : [] }],
                manager?.name || 'Gestor',
                () => { } // No need to update progress for single re-evaluation
            );

            if (evaluationResults && evaluationResults.length > 0) {
                const newResult = evaluationResults[0];
                const finalResults = [...results];
                finalResults[idx] = newResult;
                setResults(finalResults);
            }
        } catch (error) {
            console.error('Error re-evaluating:', error);
            alert('Error al re-evaluar: ' + error.message);
            // Revert loading state
            const revertedResults = [...results];
            revertedResults[idx] = { ...revertedResults[idx], isReloading: false };
            setResults(revertedResults);
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

    const manager = KNOWN_MANAGERS.find(m => m.email === selectedManager);
    const averages = calculateAverages();

    return (
        <div className="evaluation-panel">
            <div className="evaluation-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BarChart3 size={24} />
                    <h2>Evaluación de Gestores</h2>
                </div>
                <ThemeToggle />
            </div>

            <div className="evaluation-controls">
                <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="form-input"
                >
                    <option value="">Seleccionar Gestor</option>
                    {KNOWN_MANAGERS.map(m => (
                        <option key={m.email} value={m.email}>{m.name}</option>
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
                    disabled={isEvaluating || isLoadingChats || (!selectedManager && !specificDialogId.trim())}
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

            {/* Chat loading status */}
            <div className="chat-status" style={{
                padding: '0.75rem 1rem',
                background: 'var(--card-bg)',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--glass-border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isLoadingChats ? (
                        <>
                            <Loader className="animate-spin" size={16} style={{ color: 'var(--accent-primary)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>Cargando chats para el rango de fechas...</span>
                        </>
                    ) : chatsLoaded ? (
                        <>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: localChats.length > 0 ? 'var(--success-bg)' : 'var(--warning-bg)',
                                color: localChats.length > 0 ? 'var(--success-color)' : 'var(--warning-color)',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }}>
                                {localChats.length > 0 ? '✓' : '!'}
                            </span>
                            <span style={{ color: 'var(--text-primary)' }}>
                                <strong>{localChats.length}</strong> chats encontrados para el rango <strong>{dateFrom}</strong> al <strong>{dateTo}</strong>
                            </span>
                            {selectedManager && (
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                    ({isLoadingManagerCount ? (
                                        'Cargando...'
                                    ) : managerDialogCount !== null ? (
                                        <><strong>{managerDialogCount}</strong> diálogos de {KNOWN_MANAGERS.find(m => m.email === selectedManager)?.name}</>
                                    ) : (
                                        `Gestor: ${KNOWN_MANAGERS.find(m => m.email === selectedManager)?.name}`
                                    )})
                                </span>
                            )}
                        </>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>Selecciona un rango de fechas para cargar chats</span>
                    )}
                </div>
                <button
                    onClick={loadDialogsForDateRange}
                    disabled={isLoadingChats || !dateFrom || !dateTo}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    title="Recargar chats"
                >
                    <RefreshCw size={14} className={isLoadingChats ? 'animate-spin' : ''} />
                    Recargar
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
                                                <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={(e) => { e.stopPropagation(); setModalChat(result); }}
                                                        title="Ver chat"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={(e) => { e.stopPropagation(); handleReEvaluate(idx); }}
                                                        title="Reemplazar con otro diálogo"
                                                        disabled={result.isReloading}
                                                    >
                                                        <RefreshCw size={16} className={result.isReloading ? 'animate-spin' : ''} />
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
                                    const managerName = KNOWN_MANAGERS.find(m => m.email === selectedManager)?.name || 'Gestor';
                                    const senderLabel = isFromCustomer ? 'Cliente' : (msg.from?.type === 'bot' ? 'Bot' : managerName);
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
