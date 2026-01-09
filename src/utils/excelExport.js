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

    // Estructura de criterios
    const criteriaStructure = [
        {
            section: 'Cumplimiento de scripts', max: 10, criteria: [
                { name: 'Salida de forma adecuada, menciona nombre y solicita nombre del cliente.', max: 5 },
                { name: 'Utiliza script de despedida completo (nombre, agradecimiento, tiempo de entrega/gestión).', max: 5 }
            ]
        },
        {
            section: 'Cumplimiento de protocolo', max: 50, criteria: [
                { name: 'Personaliza la interacción llamando al cliente por su nombre.', max: 4 },
                { name: 'Maneja tiempos de espera de forma correcta (llamada/Chat).', max: 4 },
                { name: 'Excederse del tiempo de espera', max: 6 },
                { name: 'Valida y registra datos completos en el sistema.', max: 4 },
                { name: 'Toma de pedido / gestión de solicitud de forma clara.', max: 8 },
                { name: 'Realiza ofrecimientos adicionales y promoción vigente.', max: 7 },
                { name: 'Confirma la orden/gestión y detalla precios, dirección y forma de pago.', max: 6 },
            ]
        },
        {
            section: 'Calidad', max: 10, criteria: [
                { name: 'Empatía, cortesía y orientación a soluciones', max: 10 }
            ]
        },
        {
            section: 'Registro', max: 10, criteria: [
                { name: 'Confirmó datos del cliente en el chat', max: 5 },
                { name: 'Colocó etiquetas al diálogo', max: 5 }
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
                sectionTotal += getScoreForCriterion(result, crit.name);
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

            // Puntajes
            results.forEach((result, idx) => {
                const score = getScoreForCriterion(result, crit.name);
                const cell = worksheet.getCell(currentRow, 3 + idx);
                cell.value = score.toFixed(2);
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = borders;
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
        const total = result.evaluation?.total || 0;
        const cell = worksheet.getCell(currentRow, 3 + idx);
        cell.value = total.toFixed(2);
        cell.fill = fillDarkBlue;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;
    });

    // Ajustes finales
    worksheet.getColumn(1).width = 60; // Columna A ancha
    worksheet.getColumn(2).width = 12; // KPI

    // Guardar
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Boleta_${managerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

// Helper
function getScoreForCriterion(result, criterionName) {
    if (!result || !result.evaluation) return 0;
    const eval_ = result.evaluation;

    // Mapeo
    if (criterionName.includes('Salida de forma adecuada')) return eval_.scripts?.saludo || 0;
    if (criterionName.includes('script de despedida')) return eval_.scripts?.despedida || 0;
    if (criterionName.includes('Personaliza')) return eval_.protocolo?.personalizacion || 0;
    if (criterionName.includes('tiempos de espera')) return eval_.protocolo?.tiempos_espera || 0;
    if (criterionName.includes('Excederse del tiempo')) return eval_.protocolo?.excede_tiempo || 0;
    if (criterionName.includes('Valida y registra')) return eval_.protocolo?.validacion_datos || 0;
    if (criterionName.includes('Toma de pedido')) return eval_.protocolo?.toma_pedido || 0;
    if (criterionName.includes('ofrecimientos adicionales')) return eval_.protocolo?.ofrecimientos || 0;
    if (criterionName.includes('Confirma la orden')) return eval_.protocolo?.confirmacion || 0;
    if (criterionName.includes('Empatía')) return eval_.calidad?.empatia || 0;
    if (criterionName.includes('Confirmó datos')) return eval_.registro?.confirmacion_datos || 0;
    if (criterionName.includes('etiquetas')) return eval_.registro?.etiquetas || 0;

    return 0;
}
