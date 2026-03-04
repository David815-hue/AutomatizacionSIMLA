import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Exporta las evaluaciones a un archivo Excel con formato profesional e imágenes
 * Replicando diseño de boleta Punto Farma
 * @param {Array} results - Array de resultados de evaluación
 * @param {string} managerName - Nombre del gestor evaluado
 */
export async function exportEvaluationsToExcel(results, managerName = 'Gestor') {
    if (!results || results.length === 0) {
        alert('No hay evaluaciones para exportar');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Evaluación');

    // --- ESTILOS ---
    const borderStyle = { style: 'thin', color: { argb: 'FFCCCCCC' } };
    const borders = {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle
    };

    const fontWhiteBold = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const fontBlackBold = { name: 'Calibri', color: { argb: 'FF000000' }, bold: true, size: 11 };
    const fontBlueTitle = { name: 'Calibri', color: { argb: 'FF003366' }, bold: true, size: 14 };

    const fillDarkBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    const fillBlack = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    const fillLightBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9BC2E6' } }; // Azul claro secciones

    // --- CARGAR IMAGEN (Logo) ---
    // Intentamos cargar 'logo.png' de la carpeta public
    try {
        const response = await fetch('/logo.png');
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            const logoId = workbook.addImage({
                buffer: buffer,
                extension: 'png',
            });

            // Logo Izquierdo (A1)
            worksheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                ext: { width: 120, height: 40 }
            });

            // Logo Derecho (Última columna)
            const lastColIndex = 2 + results.length; // A, B, M1...
            worksheet.addImage(logoId, {
                tl: { col: lastColIndex - 1, row: 0 },
                ext: { width: 120, height: 40 }
            });
        } else {
            console.warn('No se encontró el archivo /logo.png en public');
        }
    } catch (error) {
        console.error('Error cargando logo:', error);
    }

    // --- ESTRUCTURA ---
    const totalCols = 2 + results.length;

    // Fila 1: Título
    // Merge de TODA la fila 1 para centrar título
    worksheet.mergeCells(1, 1, 1, totalCols);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = "Boleta de Calidad – Evaluación de Operadores";
    titleCell.font = fontBlueTitle;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Altura de fila 1 para el logo
    worksheet.getRow(1).height = 50;

    // Fila 2: Operador Evaluado
    // A2: "Operador Evaluado:" (Azul, Derecha)
    // C2: Nombre (Azul, Izquierda)
    worksheet.mergeCells(2, 1, 2, 2); // A2:B2 - Label
    const opLabelCell = worksheet.getCell(2, 1);
    opLabelCell.value = "Operador Evaluado:";
    opLabelCell.fill = fillDarkBlue;
    opLabelCell.font = fontWhiteBold;
    opLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    opLabelCell.border = borders;

    // Merge para el nombre
    if (totalCols > 2) {
        worksheet.mergeCells(2, 3, 2, totalCols);
    }
    const opNameCell = worksheet.getCell(2, 3);
    opNameCell.value = managerName;
    opNameCell.fill = fillDarkBlue;
    opNameCell.font = fontWhiteBold;
    opNameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    opNameCell.border = borders;

    // Fila 3: Link de Muestra
    // A3: Label "LINK DE MUESTRA /NUMERO" (Negro)
    // C3... : IDs (Negro)
    worksheet.mergeCells(3, 1, 3, 2); // A3:B3
    const linkLabelCell = worksheet.getCell(3, 1);
    linkLabelCell.value = "LINK DE MUESTRA /NUMERO";
    linkLabelCell.fill = fillBlack;
    linkLabelCell.font = fontWhiteBold;
    linkLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    linkLabelCell.border = borders;

    // IDs de chats
    results.forEach((result, idx) => {
        const cell = worksheet.getCell(3, 3 + idx);
        cell.value = result.dialogId || result.chatId || "N/A";
        cell.fill = fillBlack;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;

        // Ajustar ancho
        worksheet.getColumn(3 + idx).width = 15;
    });

    // Fila 4: Puntos a calificar
    // A4: "Puntos a calificar" (Azul)
    const ptsLabel = worksheet.getCell(4, 1);
    ptsLabel.value = "Puntos a calificar";
    ptsLabel.fill = fillDarkBlue;
    ptsLabel.font = fontWhiteBold;
    ptsLabel.alignment = { vertical: 'middle', horizontal: 'center' };
    ptsLabel.border = borders;

    const kpiLabel = worksheet.getCell(4, 2);
    kpiLabel.value = "KPI Cump.";
    kpiLabel.fill = fillDarkBlue;
    kpiLabel.font = fontWhiteBold;
    kpiLabel.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    kpiLabel.border = borders;

    results.forEach((_, idx) => {
        const cell = worksheet.getCell(4, 3 + idx);
        cell.value = `M${idx + 1}`;
        cell.fill = fillDarkBlue;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;
    });

    // --- DATOS ---
    let currentRow = 5;

    // ── Estructura sincronizada con el prompt de Groq y EvaluationPanel.jsx ──
    const criteriaStructure = [
        {
            section: 'Cumplimiento de Scripts', max: 20,
            criteria: [
                { name: 'Saludo adecuado — menciona nombre del agente y solicita nombre del cliente', keys: ['scripts', 'saludo'], max: 10 },
                { name: 'Despedida completa — nombre, agradecimiento y tiempo de entrega/gestión', keys: ['scripts', 'despedida'], max: 10 },
            ]
        },
        {
            section: 'Cumplimiento de Protocolo', max: 60,
            criteria: [
                { name: 'Personaliza llamando al cliente por su nombre', keys: ['protocolo', 'personaliza'], max: 5 },
                { name: 'Tiempos de respuesta adecuados (máx. 1 min entre mensajes)', keys: ['protocolo', 'tiempos_respuesta'], max: 5 },
                { name: 'No excede tiempo de espera sin avisar al cliente', keys: ['protocolo', 'tiempo_espera'], max: 7 },
                { name: 'Valida y confirma datos: teléfono, dirección, referencias', keys: ['protocolo', 'valida_datos'], max: 5 },
                { name: 'Toma de pedido / gestión de solicitud de forma clara y correcta', keys: ['protocolo', 'toma_pedido'], max: 9 },
                { name: 'Ofrece productos adicionales y promociones vigentes', keys: ['protocolo', 'ofrece_adicionales'], max: 8 },
                { name: 'Confirma orden con precios, totales y costos de envío', keys: ['protocolo', 'confirma_orden'], max: 7 },
                { name: 'Ofrece link de pago como primera opción', keys: ['protocolo', 'link_pago'], max: 7 },
                { name: 'Pregunta si necesita ayuda adicional antes de cerrar', keys: ['protocolo', 'ayuda_adicional'], max: 4 },
                { name: 'Evita silencios prolongados (más de 3 min sin respuesta)', keys: ['protocolo', 'sin_silencios'], max: 3 },
            ]
        },
        {
            section: 'Calidad de la Atención', max: 10,
            criteria: [
                { name: 'Demuestra dominio y seguridad en el producto/servicio', keys: ['calidad', 'dominio_seguridad'], max: 3 },
                { name: 'Redacción clara, sin faltas de ortografía', keys: ['calidad', 'redaccion_clara'], max: 3 },
                { name: 'Empatía, cortesía y orientación a soluciones', keys: ['calidad', 'empatia_cortesia'], max: 4 },
            ]
        },
        {
            section: 'Cumplimiento de Registro', max: 10,
            criteria: [
                { name: 'Confirmó datos del cliente en el chat (nombre, teléfono, dirección)', keys: ['registro', 'confirma_datos'], max: 5 },
                { name: 'Colocó etiquetas al diálogo (verificación manual del supervisor)', keys: ['registro', 'etiquetas'], max: 5 },
            ]
        }
    ];

    // Iterar secciones
    criteriaStructure.forEach(section => {
        // --- Header Sección ---
        const sectionNameCell = worksheet.getCell(currentRow, 1);
        sectionNameCell.value = section.section;
        sectionNameCell.fill = fillLightBlue;
        sectionNameCell.font = fontWhiteBold;
        sectionNameCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sectionNameCell.border = borders;

        const sectionMaxCell = worksheet.getCell(currentRow, 2);
        sectionMaxCell.value = section.max;
        sectionMaxCell.fill = fillLightBlue;
        sectionMaxCell.font = fontWhiteBold;
        sectionMaxCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sectionMaxCell.border = borders;

        // Totales de sección por muestra
        results.forEach((result, idx) => {
            let sectionTotal = 0;
            section.criteria.forEach(crit => {
                sectionTotal += getScoreForCriterion(result, crit.keys);
            });

            const cell = worksheet.getCell(currentRow, 3 + idx);
            cell.value = sectionTotal;
            cell.fill = fillLightBlue;
            cell.font = fontWhiteBold;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borders;
        });

        currentRow++;

        // --- Criterios Individuales ---
        section.criteria.forEach(crit => {
            // Nombre Criterio
            const nameCell = worksheet.getCell(currentRow, 1);
            nameCell.value = crit.name;
            nameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            nameCell.border = borders;

            // Max puntaje
            const maxCell = worksheet.getCell(currentRow, 2);
            maxCell.value = crit.max;
            maxCell.alignment = { vertical: 'middle', horizontal: 'center' };
            maxCell.border = borders;

            // Puntajes por muestra
            results.forEach((result, idx) => {
                const score = getScoreForCriterion(result, crit.keys);
                const cell = worksheet.getCell(currentRow, 3 + idx);
                cell.value = score !== null ? Number(score.toFixed(2)) : 'N/E';
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = borders;

                // Color según rendimiento
                const pct = score !== null ? (score / crit.max) * 100 : null;
                if (pct !== null) {
                    cell.fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: pct >= 90 ? 'FF22c55e' : pct >= 70 ? 'FFf59e0b' : 'FFef4444' }
                    };
                    cell.font = { ...fontWhiteBold, size: 10 };
                }
            });
            currentRow++;
        });
    });

    // --- TOTAL FINAL ---
    const totalLabelCell = worksheet.getCell(currentRow, 1);
    totalLabelCell.value = "TOTAL FINAL";
    totalLabelCell.fill = fillDarkBlue;
    totalLabelCell.font = fontWhiteBold;
    totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totalLabelCell.border = borders;

    const totalMaxCell = worksheet.getCell(currentRow, 2);
    totalMaxCell.value = 100;
    totalMaxCell.fill = fillDarkBlue;
    totalMaxCell.font = fontWhiteBold;
    totalMaxCell.alignment = { vertical: 'middle', horizontal: 'center' };
    totalMaxCell.border = borders;

    results.forEach((result, idx) => {
        const total = result.evaluation?.promedio_final ?? result.evaluation?.total ?? 0;
        const cell = worksheet.getCell(currentRow, 3 + idx);
        cell.value = Number(total.toFixed(2));
        cell.fill = fillDarkBlue;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;
    });

    // Ajustes finales
    worksheet.getColumn(1).width = 65;
    worksheet.getColumn(2).width = 10;

    // Guardar
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Boleta_${managerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

/**
 * Extrae el score de un criterio soportando formato viejo (número) y nuevo ({score, msg_indices})
 * @param {Object} result - Resultado de evaluación
 * @param {string[]} keys - [sección, campo] ej: ['scripts', 'saludo']
 */
function getScoreForCriterion(result, keys) {
    if (!result?.evaluation) return 0;
    const section = result.evaluation[keys[0]];
    if (!section) return 0;
    const field = section[keys[1]];
    if (field === null || field === undefined) return 0;
    // Nuevo formato: { score, msg_indices }
    if (typeof field === 'object' && 'score' in field) {
        return field.score ?? 0;
    }
    // Formato antiguo: número directo
    return typeof field === 'number' ? field : 0;
}


