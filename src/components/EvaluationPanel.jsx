import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, Play, Loader, ChevronDown, ChevronUp, Eye, X, RefreshCw, Download, Calendar } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { evaluateMultipleChats } from '../api/groq';
import { exportEvaluationsToExcel } from '../utils/excelExport';
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

    // Ref to track fetch requests and avoid race conditions
    const fetchIdRef = useRef(0);
    const managerFetchIdRef = useRef(0);

    // Local chats state - loaded based on date filters
    const [localChats, setLocalChats] = useState([]);
    // Map de email -> ID descubierto de los chats
    const [managerIdMap, setManagerIdMap] = useState({});
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [chatsLoaded, setChatsLoaded] = useState(false);
    // Count of dialogs for selected manager
    const [managerDialogCount, setManagerDialogCount] = useState(null);
    const [isLoadingManagerCount, setIsLoadingManagerCount] = useState(false);

    // Date range picker state
    const [showCalendar, setShowCalendar] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: 'selection'
    });

    // Handle date range changes with 3-day limit
    const handleDateRangeChange = (ranges) => {
        const { startDate, endDate } = ranges.selection;

        // Calculate difference in days
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If more than 2 days difference (3 days inclusive), adjust end date
        if (diffDays > 2) {
            const maxEndDate = new Date(startDate);
            maxEndDate.setDate(startDate.getDate() + 2);

            setDateRange({
                startDate,
                endDate: maxEndDate,
                key: 'selection'
            });
        } else {
            setDateRange(ranges.selection);
        }
    };

    // Format date to YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Derived values for backward compatibility
    const dateFrom = formatDate(dateRange.startDate);
    const dateTo = formatDate(dateRange.endDate);

    // Specific dialog ID for direct evaluation
    const [specificDialogId, setSpecificDialogId] = useState('');

    // Multiple dialog IDs mode
    const [multipleDialogIds, setMultipleDialogIds] = useState('');
    const [useMultipleIds, setUseMultipleIds] = useState(true);
    const [managerNameForList, setManagerNameForList] = useState('');
    const [onlyClosedDialogs, setOnlyClosedDialogs] = useState(false);

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

        setLocalChats([]);
        setChatsLoaded(false);
        setManagerDialogCount(null);

        try {
            // Parse dates correctly in local timezone
            // dateFrom and dateTo are in format "YYYY-MM-DD"
            const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
            const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);

            // Create dates in local timezone
            const sinceDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
            const untilDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

            console.log(`[EvaluationPanel] Loading dialogs from ${sinceDate.toISOString()} to ${untilDate.toISOString()}`);

            console.log(`[EvaluationPanel] Loading dialogs from ${sinceDate.toISOString()} to ${untilDate.toISOString()}`);

            // Increment fetch ID for this new request
            const currentFetchId = ++fetchIdRef.current;

            // Paginate through all dialogs using offset
            const allDialogs = [];
            let offset = 0;
            let hasMore = true;
            // INCREASED LIMIT: 50 -> 500 to handle high volume of bot chats (up to 50k dialogs)
            const MAX_PAGES = 500;
            let page = 0;

            while (hasMore && page < MAX_PAGES) {
                console.log(`[EvaluationPanel] Fetching dialogs page ${page + 1}, offset: ${offset}`);

                const dialogs = await client.getDialogs({
                    since: sinceDate.toISOString(),
                    until: untilDate.toISOString(),
                    active: false, // Only closed dialogs
                    limit: 100,
                    offset: offset
                });

                if (!Array.isArray(dialogs) || dialogs.length === 0) {
                    hasMore = false;
                    break;
                }

                allDialogs.push(...dialogs);

                // If we got less than limit, there are no more pages
                if (dialogs.length < 100) {
                    hasMore = false;
                }

                offset += 100;
                page++;
            }

            console.log(`[EvaluationPanel] Loaded ${allDialogs.length} dialogs total (${page} pages)`);

            // Analyze Responsible distribution
            const responsibleCounts = {};
            let unassignedCount = 0;
            allDialogs.forEach(d => {
                if (!d.responsible) {
                    unassignedCount++;
                } else {
                    let name = 'Unknown';

                    if (d.responsible.type === 'bot') {
                        name = 'Bot (' + d.responsible.id + ')';
                    } else if (managerIdMap[`id:${d.responsible.id}`]) {
                        const user = managerIdMap[`id:${d.responsible.id}`];
                        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';
                        name = `${userName} (ID: ${d.responsible.id})`;
                    } else {
                        name = `Unknown ID:${d.responsible.id} (${d.responsible.type})`;
                    }

                    responsibleCounts[name] = (responsibleCounts[name] || 0) + 1;
                }
            });

            // LOGGING DEBUG: Print the first 3 responsible objects to see structure
            if (allDialogs.length > 0) {
                console.log('[EvaluationPanel] Sample Responsible Objects:',
                    allDialogs.slice(0, 3).map(d => d.responsible)
                );
            }

            console.log('[EvaluationPanel] Distribution by Responsible:', responsibleCounts);
            console.log(`[EvaluationPanel] Unassigned chats: ${unassignedCount}`);

            // Convert dialogs to the chat-like format we need
            const dialogsWithInfo = allDialogs.map(dialog => ({
                id: dialog.chat_id,
                dialogId: dialog.id,
                tags: dialog.tags || [], // Include tags for evaluation
                last_dialog: {
                    id: dialog.id,
                    closed_at: dialog.closed_at,
                    created_at: dialog.created_at,
                    responsible: dialog.responsible
                }
            }));


            // Check for race condition
            if (currentFetchId !== fetchIdRef.current) {
                // Silently ignore outdated results to avoid user confusion
                return;
            }

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
            if (!managerId) {
                console.warn(`[EvaluationPanel] No ID found for manager: ${selectedManager}`);
                setManagerDialogCount(0);
                return;
            }

            // OPTIMIZATION: Filter from already loaded localChats instead of re-fetching
            // This ensures the count matches exactly what is shown in the global log
            if (localChats.length > 0) {
                const managerChats = localChats.filter(chat =>
                    chat.last_dialog?.responsible?.id === managerId
                );

                setManagerDialogCount(managerChats.length);
                console.log(`✓ ${managerChats.length} diálogos de ${knownManager.name} (ID: ${managerId}) encontrados en memoria`);

                // If count is 0 but we have local chats using a different ID for this user, try to find it
                // Logic: Look for name match in localChats if ID match fails
                if (managerChats.length === 0) {
                    const nameMatch = localChats.filter(chat => {
                        const resp = chat.last_dialog?.responsible;
                        if (!resp) return false;
                        // Check email or name match
                        if (resp.email === knownManager.email) return true;
                        // Check name
                        const respName = (resp.name || '').toLowerCase();
                        return respName.includes(knownManager.name.toLowerCase().split(' ')[0].toLowerCase());
                    });

                    if (nameMatch.length > 0) {
                        console.warn(`[EvaluationPanel] Found ${nameMatch.length} chats by name match, but ID mismatch. Using name match.`);
                        setManagerDialogCount(nameMatch.length);
                    }
                }
            } else {
                setManagerDialogCount(0);
            }
        };

        loadManagerCount();
    }, [selectedManager, client, dateFrom, dateTo, managerIdMap, chatsLoaded, localChats]);

    // Get dialogs for a specific manager from local memory (consistent with counts)
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

        console.log(`[getDialogsForManager] Getting dialogs for ${knownManager.name} (ID: ${managerId}) from localChats`);

        // Filter localChats to find those belonging to this manager
        // This avoids re-fetching and keeps consistency with the displayed count
        const managerChats = localChats.filter(chat =>
            chat.last_dialog?.responsible?.id === managerId
        );

        console.log(`[getDialogsForManager] Found ${managerChats.length} dialogs in memory`);
        return managerChats;
    };


    const selectRandomChats = (managerChats, count) => {
        const shuffled = [...managerChats].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    const handleEvaluate = async () => {
        // Check if using multiple IDs mode
        if (useMultipleIds) {
            await handleEvaluateMultipleIds();
            return;
        }

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

        // Apply closed-only filter if enabled
        const filteredDialogs = onlyClosedDialogs
            ? managerDialogs.filter(d => d.last_dialog?.closed_at)
            : managerDialogs;

        if (filteredDialogs.length === 0) {
            alert('No hay diálogos cerrados para este gestor en el rango de fechas seleccionado.');
            setIsEvaluating(false);
            return;
        }

        const selectedChats = selectRandomChats(filteredDialogs, sampleCount);
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

    // Evaluate multiple dialog IDs from textarea
    const handleEvaluateMultipleIds = async () => {
        // Parse IDs from textarea
        const ids = multipleDialogIds
            .split('\n')
            .map(id => id.trim())
            .filter(id => id && !isNaN(id))
            .map(id => parseInt(id));

        if (ids.length === 0) {
            alert('No se encontraron IDs válidos para evaluar');
            return;
        }

        setIsEvaluating(true);
        setResults([]);
        setProgress({ current: 0, total: ids.length });

        const evaluationResults = [];

        for (let i = 0; i < ids.length; i++) {
            const dialogId = ids[i];
            setProgress({ current: i + 1, total: ids.length });

            try {
                // Fetch dialog details first
                const dialogDetails = await client.getDialogs({ id: dialogId, limit: 1 });

                if (!dialogDetails || dialogDetails.length === 0) {
                    evaluationResults.push({
                        chatId: dialogId,
                        dialogId: dialogId,
                        error: 'Diálogo no encontrado',
                        evaluation: null
                    });
                    continue;
                }

                const dialog = dialogDetails[0];

                // Apply closed-only filter
                if (onlyClosedDialogs && !dialog.closed_at) {
                    evaluationResults.push({
                        chatId: dialogId,
                        dialogId: dialogId,
                        error: 'Diálogo aún abierto (usando filtro "Solo cerrados")',
                        evaluation: null
                    });
                    continue;
                }

                // Fetch messages for the dialog
                const messages = await client.getMessagesByDialog(dialogId, 100);

                if (!messages || messages.length === 0) {
                    evaluationResults.push({
                        chatId: dialogId,
                        dialogId: dialogId,
                        error: 'No se encontraron mensajes',
                        evaluation: null
                    });
                    continue;
                }

                // Create chat object
                const chat = {
                    id: dialog.chat_id || dialogId,
                    dialogId: dialogId,
                    tags: dialog.tags || [],
                    last_dialog: {
                        id: dialogId,
                        closed_at: dialog.closed_at,
                        responsible: dialog.responsible
                    }
                };

                // Evaluate
                const result = await evaluateMultipleChats(
                    [{ chat, messages: Array.isArray(messages) ? messages : [] }],
                    managerNameForList || 'Evaluación por ID',
                    () => { }  // No update progress for individual items
                );

                if (result && result.length > 0) {
                    evaluationResults.push(result[0]);
                }

            } catch (error) {
                console.error(`Error evaluating dialog ${dialogId}:`, error);
                evaluationResults.push({
                    chatId: dialogId,
                    dialogId: dialogId,
                    error: error.message || 'Error desconocido',
                    evaluation: null
                });
            }
        }

        setResults(evaluationResults);
        setIsEvaluating(false);
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
            // Try to fetch messages directly with dialog_id
            try {
                setIsEvaluating(true);
                setResults([]);
                setProgress({ current: 0, total: 1 });

                // Use getMessagesByDialog since user provides dialog_id, not chat_id
                const messages = await client.getMessagesByDialog(parseInt(dialogId), 100);

                if (!messages || messages.length === 0) {
                    alert('No se encontraron mensajes para el diálogo ID: ' + dialogId);
                    setIsEvaluating(false);
                    return;
                }

                // Fetch the specific dialog to get tags (API may not return them due to Simla limitation)
                const dialogDetails = await client.getDialogs({ id: parseInt(dialogId), limit: 1 });
                const dialogTags = (dialogDetails && dialogDetails[0]) ? dialogDetails[0].tags || [] : [];

                // Create a minimal chat object with tags from dialog
                chat = {
                    id: parseInt(dialogId),
                    tags: dialogTags,
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

    // Function to edit evaluation field values manually
    const handleEditField = (resultIndex, section, field, newValue, maxValue) => {
        const numValue = Math.min(Math.max(0, parseInt(newValue) || 0), maxValue);

        const updatedResults = [...results];
        const result = { ...updatedResults[resultIndex] };
        const evaluation = { ...result.evaluation };

        // Update the specific field
        evaluation[section] = { ...evaluation[section], [field]: numValue };

        // Recalculate section total
        let sectionTotal = 0;
        Object.keys(evaluation[section]).forEach(key => {
            if (key !== 'total') {
                sectionTotal += evaluation[section][key] || 0;
            }
        });
        evaluation[section].total = sectionTotal;

        // Recalculate overall total
        evaluation.promedio_final =
            (evaluation.scripts?.total || 0) +
            (evaluation.protocolo?.total || 0) +
            (evaluation.calidad?.total || 0) +
            (evaluation.registro?.total || 0);

        result.evaluation = evaluation;
        updatedResults[resultIndex] = result;
        setResults(updatedResults);
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
                {/* Mode Toggle */}
                {/* Mode Toggle */}
                <div className="mode-toggle-group">
                    <label className="mode-label">Modo:</label>
                    <div className="toggle-options">
                        <label className={`toggle-option ${!useMultipleIds ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="evalMode"
                                checked={!useMultipleIds}
                                onChange={() => setUseMultipleIds(false)}
                            />
                            <div className="radio-dot"></div>
                            <span>Aleatorio</span>
                        </label>
                        <label className={`toggle-option ${useMultipleIds ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="evalMode"
                                checked={useMultipleIds}
                                onChange={() => setUseMultipleIds(true)}
                            />
                            <div className="radio-dot"></div>
                            <span>Lista de IDs</span>
                        </label>
                    </div>
                </div>

                {/* Conditional Controls */}
                {!useMultipleIds ? (
                    // Random mode
                    <>
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

                        {/* Date Range Picker */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowCalendar(!showCalendar)}
                                className="btn btn-secondary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem'
                                }}
                            >
                                <Calendar size={16} />
                                <span>{dateFrom === dateTo ? dateFrom : `${dateFrom} - ${dateTo}`}</span>
                                {showCalendar ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {showCalendar && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    zIndex: 1000,
                                    marginTop: '0.5rem',
                                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--glass-border)',
                                    background: 'var(--card-bg)'
                                }}>
                                    <DateRange
                                        ranges={[dateRange]}
                                        onChange={handleDateRangeChange}
                                        maxDate={new Date()}
                                        moveRangeOnFirstSelection={false}
                                        months={1}
                                        direction="horizontal"
                                        rangeColors={['#4ECDC4']}
                                    />
                                    <div style={{
                                        padding: '0.75rem',
                                        background: 'var(--card-bg)',
                                        borderTop: '1px solid var(--glass-border)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        textAlign: 'center'
                                    }}>
                                        Máximo 3 días de rango
                                    </div>
                                </div>
                            )}
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
                    </>
                ) : (
                    // List mode
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>IDs de diálogos (uno por línea):</label>
                        <textarea
                            value={multipleDialogIds}
                            onChange={(e) => setMultipleDialogIds(e.target.value)}
                            placeholder={'12312\n12342\n4534'}
                            className="form-input"
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {multipleDialogIds.split('\n').filter(id => id.trim() && !isNaN(id.trim())).length} IDs válidos
                        </div>
                    </div>
                )}

                {/* Closed-only filter */}
                {/* Closed-only filter */}
                <div className="closed-filter-container">
                    <span className="filter-label">Solo diálogos cerrados</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={onlyClosedDialogs}
                            onChange={(e) => setOnlyClosedDialogs(e.target.checked)}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>

                <button
                    onClick={handleEvaluate}
                    disabled={isEvaluating || isLoadingChats || (!useMultipleIds && !selectedManager && !specificDialogId.trim()) || (useMultipleIds && !multipleDialogIds.trim())}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                        <h3>Reporte de Coaching - {managerNameForList || manager?.name || 'Evaluación'}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {useMultipleIds && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                        Nombre del gestor:
                                    </label>
                                    <input
                                        type="text"
                                        value={managerNameForList}
                                        onChange={(e) => setManagerNameForList(e.target.value)}
                                        placeholder="Ej: Corea Kimberly"
                                        className="form-input"
                                        style={{ width: '200px', padding: '0.5rem 0.75rem' }}
                                    />
                                </div>
                            )}
                            <button
                                onClick={() => exportEvaluationsToExcel(results, managerNameForList || manager?.name || selectedManager || 'Evaluación')}
                                className="btn"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'var(--success-bg)',
                                    color: 'var(--success-color)',
                                    border: '1px solid var(--success-color)'
                                }}
                            >
                                <Download size={16} />
                                Exportar a Excel
                            </button>
                        </div>
                    </div>

                    {/* VISUALIZACIÓN: Radar Charts */}
                    <div className="charts-section">
                        {/* Radar Promedio General */}
                        <div className="average-radar-container">
                            <h4>📊 Promedio General ({results.filter(r => !r.error).length} chats evaluados)</h4>
                            <ResponsiveContainer width="100%" height={400}>
                                <RadarChart data={[
                                    {
                                        category: 'Scripts',
                                        percentage: ((averages?.scripts || 0) / 20) * 100,
                                        actual: averages?.scripts || 0,
                                        fullMark: 100
                                    },
                                    {
                                        category: 'Protocolo',
                                        percentage: ((averages?.protocolo || 0) / 60) * 100,
                                        actual: averages?.protocolo || 0,
                                        fullMark: 100
                                    },
                                    {
                                        category: 'Calidad',
                                        percentage: ((averages?.calidad || 0) / 10) * 100,
                                        actual: averages?.calidad || 0,
                                        fullMark: 100
                                    },
                                    {
                                        category: 'Registro',
                                        percentage: ((averages?.registro || 0) / 10) * 100,
                                        actual: averages?.registro || 0,
                                        fullMark: 100
                                    }
                                ]}>
                                    <PolarGrid stroke="var(--border-color)" />
                                    <PolarAngleAxis
                                        dataKey="category"
                                        tick={{ fill: 'var(--text-primary)', fontSize: 14, fontWeight: 'bold' }}
                                    />
                                    <PolarRadiusAxis
                                        angle={90}
                                        domain={[0, 'dataMax']}
                                        tick={{ fill: 'var(--text-muted)' }}
                                    />
                                    <Radar
                                        name="Desempeño (%)"
                                        dataKey="percentage"
                                        stroke="#4F46E5"
                                        fill="#4F46E5"
                                        fillOpacity={0.6}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value, name, props) => {
                                            const percentage = parseFloat(value) || 0;
                                            const actual = parseFloat((props && props.payload && props.payload.actual) || 0);
                                            return [
                                                `${percentage.toFixed(1)}% (${actual.toFixed(1)} pts)`,
                                                name
                                            ];
                                        }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Grid de Mini-Radars Individuales */}
                        <div className="mini-radars-section">
                            <h4>📈 Detalle por Muestra</h4>
                            <div className="mini-radars-grid">
                                {results.filter(r => !r.error).map((result, idx) => {
                                    const radarData = [
                                        {
                                            category: 'Scripts',
                                            percentage: (result.evaluation.scripts.total / 20) * 100,
                                            fullMark: 100
                                        },
                                        {
                                            category: 'Proto',
                                            percentage: (result.evaluation.protocolo.total / 60) * 100,
                                            fullMark: 100
                                        },
                                        {
                                            category: 'Cal',
                                            percentage: (result.evaluation.calidad.total / 10) * 100,
                                            fullMark: 100
                                        },
                                        {
                                            category: 'Reg',
                                            percentage: (result.evaluation.registro.total / 10) * 100,
                                            fullMark: 100
                                        }
                                    ];

                                    return (
                                        <div key={`${result.dialogId}-${result.evaluation.promedio_final}`} className="mini-radar-card" title={`Diálogo ${result.dialogId}`}>
                                            <div className="mini-radar-header">
                                                <span className="mini-radar-label">M{idx + 1}</span>
                                                <span className="mini-radar-total">{result.evaluation.promedio_final}</span>
                                            </div>
                                            <ResponsiveContainer width="100%" height={150}>
                                                <RadarChart data={radarData}>
                                                    <PolarGrid stroke="var(--border-color)" strokeWidth={0.5} />
                                                    <PolarAngleAxis
                                                        dataKey="category"
                                                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                                    />
                                                    <Radar
                                                        dataKey="percentage"
                                                        stroke="#10B981"
                                                        fill="#10B981"
                                                        fillOpacity={0.5}
                                                        strokeWidth={2}
                                                    />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

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
                                            <td colSpan="9">
                                                <div className="detail-grid">
                                                    {/* SCRIPTS */}
                                                    <div className="detail-section">
                                                        <h5>Scripts <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(editable)</span></h5>
                                                        <div className="editable-field">
                                                            <label>Saludo:</label>
                                                            <input type="text" value={result.evaluation.scripts.saludo || 0}
                                                                onChange={(e) => handleEditField(idx, 'scripts', 'saludo', e.target.value, 10)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/10</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Despedida:</label>
                                                            <input type="text" value={result.evaluation.scripts.despedida || 0}
                                                                onChange={(e) => handleEditField(idx, 'scripts', 'despedida', e.target.value, 10)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/10</span>
                                                        </div>
                                                        <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Total: {result.evaluation.scripts.total}/20</p>
                                                    </div>

                                                    {/* PROTOCOLO */}
                                                    <div className="detail-section">
                                                        <h5>Protocolo <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(editable)</span></h5>
                                                        <div className="editable-field">
                                                            <label>Personaliza:</label>
                                                            <input type="text" value={result.evaluation.protocolo.personaliza || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'personaliza', e.target.value, 5)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/5</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Tiempos:</label>
                                                            <input type="text" value={result.evaluation.protocolo.tiempos_respuesta || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'tiempos_respuesta', e.target.value, 5)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/5</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Espera:</label>
                                                            <input type="text" value={result.evaluation.protocolo.tiempo_espera || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'tiempo_espera', e.target.value, 7)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/7</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Valida datos:</label>
                                                            <input type="text" value={result.evaluation.protocolo.valida_datos || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'valida_datos', e.target.value, 5)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/5</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Toma pedido:</label>
                                                            <input type="text" value={result.evaluation.protocolo.toma_pedido || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'toma_pedido', e.target.value, 9)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/9</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Adicionales:</label>
                                                            <input type="text" value={result.evaluation.protocolo.ofrece_adicionales || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'ofrece_adicionales', e.target.value, 8)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/8</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Confirma orden:</label>
                                                            <input type="text" value={result.evaluation.protocolo.confirma_orden || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'confirma_orden', e.target.value, 7)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/7</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Link pago:</label>
                                                            <input type="text" value={result.evaluation.protocolo.link_pago || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'link_pago', e.target.value, 7)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/7</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Ayuda adicional:</label>
                                                            <input type="text" value={result.evaluation.protocolo.ayuda_adicional || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'ayuda_adicional', e.target.value, 4)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/4</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Sin silencios:</label>
                                                            <input type="text" value={result.evaluation.protocolo.sin_silencios || 0}
                                                                onChange={(e) => handleEditField(idx, 'protocolo', 'sin_silencios', e.target.value, 3)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/3</span>
                                                        </div>
                                                        <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Total: {result.evaluation.protocolo.total}/60</p>
                                                    </div>

                                                    {/* CALIDAD */}
                                                    <div className="detail-section">
                                                        <h5>Calidad <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(editable)</span></h5>
                                                        <div className="editable-field">
                                                            <label>Dominio y seguridad:</label>
                                                            <input type="text" value={result.evaluation.calidad.dominio_seguridad || 0}
                                                                onChange={(e) => handleEditField(idx, 'calidad', 'dominio_seguridad', e.target.value, 3)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/3</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Redacción clara:</label>
                                                            <input type="text" value={result.evaluation.calidad.redaccion_clara || 0}
                                                                onChange={(e) => handleEditField(idx, 'calidad', 'redaccion_clara', e.target.value, 3)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/3</span>
                                                        </div>
                                                        <div className="editable-field">
                                                            <label>Empatía y cortesía:</label>
                                                            <input type="text" value={result.evaluation.calidad.empatia_cortesia || 0}
                                                                onChange={(e) => handleEditField(idx, 'calidad', 'empatia_cortesia', e.target.value, 4)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/4</span>
                                                        </div>
                                                        <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Total: {result.evaluation.calidad.total}/10</p>
                                                    </div>

                                                    {/* REGISTRO */}
                                                    <div className="detail-section">
                                                        <h5>Registro <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(editable)</span></h5>
                                                        <div className="editable-field">
                                                            <label>Confirmó datos:</label>
                                                            <input type="text" value={result.evaluation.registro.confirma_datos || 0}
                                                                onChange={(e) => handleEditField(idx, 'registro', 'confirma_datos', e.target.value, 5)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()} />
                                                            <span>/5</span>
                                                        </div>
                                                        <div className="editable-field" style={{ background: 'var(--warning-bg)', padding: '0.5rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                                                            <label style={{ color: 'var(--warning-color)' }}>⚠️ Etiquetas:</label>
                                                            <input type="text" value={result.evaluation.registro.etiquetas || 0}
                                                                onChange={(e) => handleEditField(idx, 'registro', 'etiquetas', e.target.value, 5)}
                                                                className="form-input score-input" onClick={(e) => e.stopPropagation()}
                                                                style={{ borderColor: 'var(--warning-color)' }} />
                                                            <span>/5</span>
                                                        </div>
                                                        <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Total: {result.evaluation.registro.total}/10</p>
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
                                            <div className="message-text">
                                                {msg.type === 'image' && msg.items ? (
                                                    msg.items.map((item, imgIdx) => (
                                                        <a
                                                            key={imgIdx}
                                                            href={item.preview_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ display: 'block', marginTop: imgIdx > 0 ? '0.5rem' : 0 }}
                                                        >
                                                            <img
                                                                src={item.preview_url}
                                                                alt="Imagen"
                                                                style={{
                                                                    maxWidth: '100%',
                                                                    maxHeight: '200px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.parentElement.innerHTML = '<span style="color: var(--text-muted)">[Imagen no disponible]</span>';
                                                                }}
                                                            />
                                                        </a>
                                                    ))
                                                ) : (
                                                    msg.content || '[media]'
                                                )}
                                            </div>
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
