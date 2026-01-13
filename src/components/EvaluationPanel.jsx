import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, Play, Loader, ChevronDown, ChevronUp, Eye, X, RefreshCw, Download, Calendar, ArrowRight, Check, AlertCircle, FileText, AlertTriangle } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DateRange } from 'react-date-range';
import { motion, AnimatePresence } from 'framer-motion';
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

/* --- ANIMATION VARIANTS --- */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
};

/* --- SUB-COMPONENTS --- */

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
    <motion.div
        variants={itemVariants}
        className="glass-card stat-card"
        style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            borderLeft: `4px solid ${color}`
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>{title}</span>
            {Icon && <Icon size={18} style={{ opacity: 0.7 }} />}
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {value}
        </div>
    </motion.div>
);

const ScoreBadge = ({ score, max = 100 }) => {
    let color = 'var(--danger)';
    if (score >= max * 0.9) color = 'var(--success)';
    else if (score >= max * 0.7) color = 'var(--warning)';

    return (
        <div style={{
            background: color,
            color: '#fff',
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            boxShadow: `0 2px 10px ${color}66`
        }}>
            {typeof score === 'number' ? score.toFixed(1) : score}/{max}
        </div>
    );
};

const MiniRadarChart = ({ data }) => {
    const chartData = [
        { category: 'Scripts', A: data.scripts.total, fullMark: 20 },
        { category: 'Protocolo', A: (data.protocolo.total / 60) * 20, fullMark: 20 },
        { category: 'Calidad', A: (data.calidad.total / 10) * 20, fullMark: 20 },
        { category: 'Registro', A: (data.registro.total / 10) * 20, fullMark: 20 }
    ];

    return (
        <div style={{ width: '100%', height: '180px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="var(--border-color)" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                    <Radar dataKey="A" stroke="var(--coral)" fill="var(--coral)" fillOpacity={0.4} />
                    <Tooltip
                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        formatter={(value, name, props) => {
                            // Scale back to original for tooltip
                            const originalMax = props.payload.fullMark === 20 ? (name === 'Scripts' ? 20 : name === 'Protocolo' ? 60 : 10) : 100;
                            const originalValue = (value / 20) * originalMax;
                            // Handle edge case for Scripts which is exactly 20
                            const displayValue = name === 'Scripts' ? value : originalValue;
                            return [displayValue.toFixed(1), name];
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

// Schema reference for detailed editing
const EVALUATION_SCHEMA = {
    scripts: {
        label: 'Scripts',
        max: 20,
        fields: [
            { key: 'saludo', label: 'Saludo', max: 10 },
            { key: 'despedida', label: 'Despedida', max: 10 }
        ]
    },
    protocolo: {
        label: 'Protocolo',
        max: 60,
        fields: [
            { key: 'personaliza', label: 'Personaliza', max: 5 },
            { key: 'tiempos_respuesta', label: 'Tiempos R.', max: 5 },
            { key: 'tiempo_espera', label: 'Espera', max: 7 },
            { key: 'valida_datos', label: 'Valida Datos', max: 5 },
            { key: 'toma_pedido', label: 'Toma Pedido', max: 9 },
            { key: 'ofrece_adicionales', label: 'Adicionales', max: 8 },
            { key: 'confirma_orden', label: 'Confirma', max: 7 },
            { key: 'link_pago', label: 'Link Pago', max: 7 },
            { key: 'ayuda_adicional', label: 'Ayuda', max: 4 },
            { key: 'sin_silencios', label: 'Sin Silencios', max: 3 }
        ]
    },
    calidad: {
        label: 'Calidad',
        max: 10,
        fields: [
            { key: 'dominio_seguridad', label: 'Dominio', max: 3 },
            { key: 'redaccion_clara', label: 'Redacción', max: 3 },
            { key: 'empatia_cortesia', label: 'Empatía', max: 4 }
        ]
    },
    registro: {
        label: 'Registro',
        max: 10,
        fields: [
            { key: 'confirma_datos', label: 'Confirma Datos', max: 5 },
            { key: 'etiquetas', label: 'Etiquetas', max: 5 }
        ]
    }
};

const ResultsTable = ({ results, onEdit, onView, onReload, expandedRow, setExpandedRow }) => (
    <div style={{ overflowX: 'auto', background: 'transparent' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem', width: '50px' }}></th>
                    <th style={{ padding: '1rem' }}>Muestra</th>
                    <th style={{ padding: '1rem' }}>Dialog ID</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Scripts (20pts)</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Protocolo (60pts)</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Calidad (10pts)</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Registro (10pts)</th>
                    <th style={{ padding: '1rem' }}>Total</th>
                    <th style={{ padding: '1rem' }}>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {results.map((res, idx) => (
                    <React.Fragment key={idx}>
                        <tr style={{ borderBottom: expandedRow === idx ? 'none' : '1px solid var(--border-color)', transition: 'background 0.2s', background: expandedRow === idx ? 'var(--bg-secondary)' : 'transparent' }} className="hover:bg-white/5">
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <button
                                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                    {expandedRow === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                            </td>
                            <td style={{ padding: '1rem' }}>#{idx + 1}</td>
                            <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{res.dialogId}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold' }}>{res.evaluation?.scripts?.total || 0}</div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold' }}>{res.evaluation?.protocolo?.total || 0}</div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold' }}>{res.evaluation?.calidad?.total || 0}</div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold' }}>{res.evaluation?.registro?.total || 0}</div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 'bold', color: res.evaluation?.promedio_final >= 90 ? 'var(--success)' : res.evaluation?.promedio_final >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                                {res.evaluation?.promedio_final || 0}
                            </td>
                            <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button className="btn-icon" onClick={() => onView(res)} title="Ver Chat"><Eye size={16} /></button>
                                <button className="btn-icon" onClick={() => onReload(idx)} title="Re-evaluar"><RefreshCw size={16} className={res.isReloading ? 'animate-spin' : ''} /></button>
                            </td>
                        </tr>
                        {/* DETAILED EDITING ROW */}
                        <AnimatePresence>
                            {expandedRow === idx && (
                                <motion.tr
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <td colSpan="9" style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                            {Object.entries(EVALUATION_SCHEMA).map(([key, schema]) => (
                                                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <h4 style={{ fontSize: '0.8rem', color: 'var(--coral)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                                        {schema.label} (editable)
                                                    </h4>
                                                    {schema.fields.map(field => (
                                                        <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <span style={{ color: 'var(--text-secondary)' }}>{field.label}:</span>
                                                                {key === 'registro' && (
                                                                    <div title="Verificar manualmente">
                                                                        <AlertTriangle size={12} color="var(--warning)" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={field.max}
                                                                    value={res.evaluation?.[key]?.[field.key] || 0}
                                                                    onChange={(e) => onEdit(idx, key, field.key, e.target.value, field.max)}
                                                                    className="form-input"
                                                                    style={{
                                                                        width: '45px',
                                                                        padding: '0.2rem',
                                                                        textAlign: 'center',
                                                                        fontSize: '0.8rem',
                                                                        borderColor: key === 'registro' ? 'var(--warning)' : 'var(--border-color)',
                                                                        background: key === 'registro' ? 'rgba(255, 193, 7, 0.1)' : 'var(--bg-primary)'
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>/{field.max}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                        <span>Total {schema.label}:</span>
                                                        <span>{res.evaluation?.[key]?.total || 0}/{schema.max}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* OBSERVATIONS */}
                                            <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Observaciones</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                                                    {res.evaluation?.observaciones || 'Sin observaciones.'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </motion.tr>
                            )}
                        </AnimatePresence>
                    </React.Fragment>
                ))}
            </tbody>
        </table>
    </div>
);


const EvaluationPanel = ({ client }) => {
    const [selectedManager, setSelectedManager] = useState('');
    const [sampleCount, setSampleCount] = useState(5);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState([]);
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'radar'
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
        if (client && dateFrom && dateTo && !useMultipleIds) {
            loadDialogsForDateRange();
        }
    }, [client, dateFrom, dateTo, loadDialogsForDateRange, useMultipleIds]);

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
        <motion.div
            className="evaluation-dashboard app-container"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
        >
            {/* Header */}
            <header className="glass-effect" style={{
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="icon-box" style={{
                        background: 'linear-gradient(135deg, var(--coral) 0%, var(--violet) 100%)',
                        width: '40px', height: '40px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                    }}>
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>Evaluación AI</h1>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Performance & Quality Control</span>
                    </div>
                </div>
                <ThemeToggle />
            </header>

            <div className="dashboard-layout" style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: '1.5rem',
                padding: '1.5rem',
                height: 'calc(100vh - 80px)',
                overflow: 'hidden'
            }}>
                {/* SIDEBAR CONTROLS */}
                <motion.aside
                    className="glass-card sidebar-controls"
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        overflowY: 'auto'
                    }}
                >
                    <div className="control-section">
                        <label className="section-label">Modo de Evaluación</label>
                        <div className="toggle-group glass-effect" style={{ padding: '0.5rem', borderRadius: '12px', display: 'flex' }}>
                            <button
                                className={`btn-toggle ${!useMultipleIds ? 'active' : ''}`}
                                onClick={() => setUseMultipleIds(false)}
                                style={{
                                    flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none',
                                    background: !useMultipleIds ? 'var(--glass-bg-hover)' : 'transparent',
                                    color: !useMultipleIds ? 'var(--coral)' : 'var(--text-secondary)',
                                    fontWeight: !useMultipleIds ? 'bold' : 'normal',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                Random
                            </button>
                            <button
                                className={`btn-toggle ${useMultipleIds ? 'active' : ''}`}
                                onClick={() => setUseMultipleIds(true)}
                                style={{
                                    flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none',
                                    background: useMultipleIds ? 'var(--glass-bg-hover)' : 'transparent',
                                    color: useMultipleIds ? 'var(--coral)' : 'var(--text-secondary)',
                                    fontWeight: useMultipleIds ? 'bold' : 'normal',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                Manual IDs
                            </button>
                        </div>
                    </div>

                    {!useMultipleIds ? (
                        <>
                            <div className="control-section">
                                <label className="section-label">Gestor</label>
                                <select
                                    value={selectedManager}
                                    onChange={(e) => setSelectedManager(e.target.value)}
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.75rem' }}
                                >
                                    <option value="">Seleccionar...</option>
                                    {KNOWN_MANAGERS.map(m => (
                                        <option key={m.email} value={m.email}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="control-section" style={{ position: 'relative' }}>
                                <label className="section-label">Rango de Fechas</label>
                                <button
                                    type="button"
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="form-input"
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        width: '100%', cursor: 'pointer', textAlign: 'left'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Calendar size={16} className="text-accent" />
                                        <span style={{ fontSize: '0.9rem' }}>
                                            {dateFrom === dateTo ? dateFrom : `${dateFrom} -> ${dateTo}`}
                                        </span>
                                    </div>
                                    <ChevronDown size={14} />
                                </button>

                                <AnimatePresence>
                                    {showCalendar && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            style={{
                                                position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 100,
                                                marginTop: '0.5rem', padding: '0.5rem',
                                                background: 'var(--bg-secondary)', border: '1px solid var(--coral)',
                                                borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                                            }}
                                        >
                                            <DateRange
                                                ranges={[dateRange]}
                                                onChange={handleDateRangeChange}
                                                maxDate={new Date()}
                                                moveRangeOnFirstSelection={false}
                                                months={1}
                                                direction="horizontal"
                                                rangeColors={['#3B82F6']}
                                            />
                                            <div style={{ textAlign: 'center', fontSize: '0.75rem', padding: '0.5rem', color: 'var(--text-muted)' }}>
                                                Máximo 3 días permitidos
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="control-section">
                                <label className="section-label">Muestras</label>
                                <input
                                    type="number" min="1" max="50"
                                    value={sampleCount}
                                    onChange={(e) => setSampleCount(parseInt(e.target.value) || 5)}
                                    className="form-input"
                                />
                            </div>

                            <div className="control-section">
                                <label className="section-label">ID Específico (Opcional)</label>
                                <input
                                    type="text" placeholder="Ej: 92458"
                                    value={specificDialogId}
                                    onChange={(e) => setSpecificDialogId(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="control-section">
                            <label className="section-label">IDs (Uno por línea)</label>



                            <textarea
                                value={multipleDialogIds}
                                onChange={(e) => setMultipleDialogIds(e.target.value)}
                                placeholder={'12345\n67890'}
                                className="form-input"
                                style={{ minHeight: '200px', fontFamily: 'monospace', resize: 'none' }}
                            />
                            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                {multipleDialogIds.split('\n').filter(id => id.trim() && !isNaN(id.trim())).length} IDs detectados
                            </div>
                        </div>
                    )}

                    <div className="control-section" style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.85rem' }}>Solo Cerrados</span>
                            <label className="switch">
                                <input type="checkbox" checked={onlyClosedDialogs} onChange={(e) => setOnlyClosedDialogs(e.target.checked)} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <button
                            onClick={handleEvaluate}
                            disabled={isEvaluating || (!useMultipleIds && isLoadingChats)}
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}
                        >
                            {isEvaluating ? <Loader className="animate-spin" /> : <Play fill="currentColor" />}
                            {isEvaluating ? 'Evaluando...' : 'Iniciar Evaluación'}
                        </button>
                    </div>
                </motion.aside>

                {/* MAIN CONTENT AREA */}
                <div className="main-scroll-area" style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>

                    {/* STATUS BAR */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card status-bar"
                        style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {isLoadingChats && !useMultipleIds ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)' }}>
                                    <Loader size={16} className="animate-spin" />
                                    <span>Sincronizando chats...</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: localChats.length > 0 ? 'var(--success)' : 'var(--danger)',
                                        boxShadow: `0 0 10px ${localChats.length > 0 ? 'var(--success)' : 'var(--danger)'}`
                                    }} />
                                    <span>{localChats.length} Chats disponibles</span>
                                    {selectedManager && managerDialogCount !== null && (
                                        <span className="badge" style={{ background: 'var(--glass-bg-hover)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                                            {managerDialogCount} de {KNOWN_MANAGERS.find(m => m.email === selectedManager)?.name.split(' ')[0]}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={loadDialogsForDateRange} className="btn-icon" title="Refrescar">
                            <RefreshCw size={18} className={isLoadingChats ? 'animate-spin' : ''} />
                        </button>
                    </motion.div>

                    {/* RESULTS AREA */}
                    <AnimatePresence mode="wait">
                        {results.length > 0 ? (
                            <motion.div
                                key="results"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
                            >
                                {/* STATS ROW */}
                                {averages && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <StatCard title="Promedio Total" value={averages.total} color="var(--violet)" delay={0.1} />
                                        <StatCard title="Protocolo" value={averages.protocolo} color="var(--coral)" delay={0.2} />
                                        <StatCard title="Scripts" value={averages.scripts} color="var(--success)" delay={0.3} />
                                        <StatCard title="Calidad" value={averages.calidad} color="var(--warning)" delay={0.4} />
                                    </div>
                                )}

                                {/* VIEW TOGGLE TOOLBAR */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>

                                    {/* Manager Name Input for Manual IDs - Placed here for visibility */}
                                    {useMultipleIds && (
                                        <div style={{ marginRight: 'auto' }}>
                                            <input
                                                type="text"
                                                value={managerNameForList}
                                                onChange={(e) => setManagerNameForList(e.target.value)}
                                                placeholder="Nombre del Gestor..."
                                                className="form-input"
                                                style={{
                                                    padding: '0.6rem',
                                                    width: '250px',
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: 'var(--text-primary)'
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div className="toggle-group glass-effect" style={{ padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setViewMode('radar')}
                                            style={{
                                                padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none',
                                                background: viewMode === 'radar' ? 'var(--coral)' : 'transparent',
                                                color: viewMode === 'radar' ? '#fff' : 'var(--text-secondary)',
                                                fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                                            }}
                                        >
                                            <BarChart3 size={16} /> Radar View
                                        </button>
                                        <button
                                            onClick={() => setViewMode('table')}
                                            style={{
                                                padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none',
                                                background: viewMode === 'table' ? 'var(--violet)' : 'transparent',
                                                color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                                                fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s ease',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                                            }}
                                        >
                                            <FileText size={16} /> Table Editor
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => exportEvaluationsToExcel(results, selectedManager && !useMultipleIds ? selectedManager : managerNameForList)}
                                        className="btn btn-secondary"
                                        title="Exportar a Excel"
                                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                                    >
                                        <Download size={16} /> Excel
                                    </button>
                                </div>

                                {/* DYNAMIC CONTENT AREA */}
                                <AnimatePresence mode="wait">
                                    {viewMode === 'radar' ? (
                                        <motion.div
                                            key="radar-view"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.3 }}
                                            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                                        >
                                            {/* MAIN RADAR */}
                                            <div className="glass-card" style={{ padding: '2rem', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <h3 style={{ marginBottom: '1rem' }}>Promedio General de Competencias</h3>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadarChart data={[
                                                        { category: 'Scripts', A: parseFloat(averages?.scripts || 0), fullMark: 100 },
                                                        { category: 'Protocolo', A: (parseFloat(averages?.protocolo || 0) / 60) * 100, fullMark: 100 },
                                                        { category: 'Calidad', A: (parseFloat(averages?.calidad || 0) / 10) * 100, fullMark: 100 },
                                                        { category: 'Registro', A: (parseFloat(averages?.registro || 0) / 10) * 100, fullMark: 100 }
                                                    ]}>
                                                        <PolarGrid stroke="var(--border-color)" />
                                                        <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-secondary)', fontSize: 14, fontWeight: 'bold' }} />
                                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                        <Radar name="Promedio" dataKey="A" stroke="var(--coral)" fill="var(--coral)" fillOpacity={0.5} />
                                                        <Tooltip
                                                            contentStyle={{ background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                            itemStyle={{ color: '#fff' }}
                                                        />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* MINI RADARS GRID */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                                {results.map((res, idx) => !res.error && (
                                                    <motion.div
                                                        key={`mini-radar-${idx}`}
                                                        className="glass-card"
                                                        whileHover={{ y: -5, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}
                                                        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                                    >
                                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>#{idx + 1}</span>
                                                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Chat {res.dialogId}</span>
                                                            </div>
                                                            <ScoreBadge score={res.evaluation.promedio_final} max={100} />
                                                        </div>
                                                        <div style={{ width: '100%', marginBottom: '1rem' }}>
                                                            <MiniRadarChart data={res.evaluation} />
                                                        </div>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'center' }}
                                                            onClick={() => setModalChat(res)}
                                                        >
                                                            <Eye size={14} /> Ver Conversación
                                                        </button>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="table-view"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.3 }}
                                            className="glass-card"
                                            style={{ padding: '1.5rem' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                                <h3>Edición Detallada</h3>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Edita los valores directamente para recalcular el promedio.</span>
                                            </div>
                                            <ResultsTable
                                                results={results}
                                                onEdit={handleEditField}
                                                onView={setModalChat}
                                                onReload={handleReEvaluate}
                                                expandedRow={expandedChat}
                                                setExpandedRow={setExpandedChat}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            <motion.div
                                variants={itemVariants}
                                initial="hidden" animate="visible"
                                className="empty-state"
                                style={{
                                    height: '100%', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', opacity: 0.5,
                                    gap: '1rem'
                                }}
                            >
                                <BarChart3 size={64} strokeWidth={1} style={{ opacity: 0.2 }} />
                                <p>Configura los parámetros y presiona "Iniciar Evaluación"</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* FULL SCREEN MODAL FOR CHAT */}
            <AnimatePresence>
                {modalChat && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setModalChat(null)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                        }}
                    >
                        <motion.div
                            className="glass-card"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}
                        >
                            <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Chat #{modalChat.dialogId}</h3>
                                <button className="btn-icon" onClick={() => setModalChat(null)}><X size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                {modalChat.messages && [...modalChat.messages]
                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                                    .map((msg, idx) => {
                                        const isFromCustomer = msg.from?.type === 'customer';
                                        return (
                                            <div key={idx} className={`message ${isFromCustomer ? 'received' : 'sent'}`} style={{ marginBottom: '1rem', maxWidth: '80%', marginLeft: isFromCustomer ? 0 : 'auto', marginRight: isFromCustomer ? 'auto' : 0 }}>
                                                <div className="message-text">{msg.content || '[Media]'}</div>
                                                <div className="message-meta" style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.2rem' }}>{new Date(msg.created_at).toLocaleString()}</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default EvaluationPanel;
