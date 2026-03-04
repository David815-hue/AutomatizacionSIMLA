import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Exporta evaluaciones en formato boleta de calidad.
 * @param {Array} results
 * @param {string} managerName
 */
export async function exportEvaluationsToExcel(results, managerName = 'Gestor') {
    if (!results || results.length === 0) {
        alert('No hay evaluaciones para exportar');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Evaluacion');

    const borderStyle = { style: 'thin', color: { argb: 'FFCCCCCC' } };
    const borders = {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle
    };

    const fontWhiteBold = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const fontBlueTitle = { name: 'Calibri', color: { argb: 'FF003366' }, bold: true, size: 14 };

    const fillDarkBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    const fillBlack = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    const fillLightBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9BC2E6' } };

    try {
        const response = await fetch('/logo.png');
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            const logoId = workbook.addImage({ buffer, extension: 'png' });

            worksheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                ext: { width: 120, height: 40 }
            });

            const lastColIndex = 2 + results.length;
            worksheet.addImage(logoId, {
                tl: { col: lastColIndex - 1, row: 0 },
                ext: { width: 120, height: 40 }
            });
        }
    } catch (error) {
        console.error('Error cargando logo:', error);
    }

    const totalCols = 2 + results.length;

    worksheet.mergeCells(1, 1, 1, totalCols);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'Boleta de Calidad - Evaluacion de Operadores';
    titleCell.font = fontBlueTitle;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 50;

    worksheet.mergeCells(2, 1, 2, 2);
    const opLabelCell = worksheet.getCell(2, 1);
    opLabelCell.value = 'Operador Evaluado:';
    opLabelCell.fill = fillDarkBlue;
    opLabelCell.font = fontWhiteBold;
    opLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    opLabelCell.border = borders;

    if (totalCols > 2) {
        worksheet.mergeCells(2, 3, 2, totalCols);
    }

    const opNameCell = worksheet.getCell(2, 3);
    opNameCell.value = managerName;
    opNameCell.fill = fillDarkBlue;
    opNameCell.font = fontWhiteBold;
    opNameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    opNameCell.border = borders;

    worksheet.mergeCells(3, 1, 3, 2);
    const linkLabelCell = worksheet.getCell(3, 1);
    linkLabelCell.value = 'LINK DE MUESTRA / NUMERO';
    linkLabelCell.fill = fillBlack;
    linkLabelCell.font = fontWhiteBold;
    linkLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    linkLabelCell.border = borders;

    results.forEach((result, idx) => {
        const cell = worksheet.getCell(3, 3 + idx);
        cell.value = result.dialogId || result.chatId || 'N/A';
        cell.fill = fillBlack;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;
        worksheet.getColumn(3 + idx).width = 15;
    });

    const ptsLabel = worksheet.getCell(4, 1);
    ptsLabel.value = 'Puntos a calificar';
    ptsLabel.fill = fillDarkBlue;
    ptsLabel.font = fontWhiteBold;
    ptsLabel.alignment = { vertical: 'middle', horizontal: 'center' };
    ptsLabel.border = borders;

    const kpiLabel = worksheet.getCell(4, 2);
    kpiLabel.value = 'KPI Cump.';
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

    let currentRow = 5;

    // Sin "sin_silencios" y protocolo maximo 60
    const criteriaStructure = [
        {
            section: 'Cumplimiento de scripts', max: 20, criteria: [
                { name: 'Salida de forma adecuada, menciona nombre y solicita nombre del cliente.', max: 10 },
                { name: 'Utiliza script de despedida completo (nombre, agradecimiento, tiempo de entrega/gestion).', max: 10 }
            ]
        },
        {
            section: 'Cumplimiento de protocolo', max: 60, criteria: [
                { name: 'Personaliza la interaccion llamando al cliente por su nombre.', max: 6 },
                { name: 'Maneja tiempos de respuesta de forma correcta.', max: 5 },
                { name: 'No excede tiempo de espera sin avisar.', max: 7 },
                { name: 'Valida y registra datos completos en el sistema.', max: 5 },
                { name: 'Toma de pedido / gestion de solicitud de forma clara.', max: 9 },
                { name: 'Realiza ofrecimientos adicionales y promocion vigente.', max: 8 },
                { name: 'Confirma la orden/gestion y detalla precios, direccion y forma de pago.', max: 7 },
                { name: 'Ofrece link de pago como primera opcion.', max: 8 },
                { name: 'Pregunta si necesita ayuda adicional antes de cerrar.', max: 5 }
            ]
        },
        {
            section: 'Calidad', max: 10, criteria: [
                { name: 'Demuestra dominio y seguridad en el producto/servicio.', max: 3 },
                { name: 'Redaccion clara, sin faltas de ortografia.', max: 3 },
                { name: 'Empatia, cortesia y orientacion a soluciones.', max: 4 }
            ]
        },
        {
            section: 'Registro', max: 10, criteria: [
                { name: 'Confirmo datos del cliente en el chat.', max: 5 },
                { name: 'Coloco etiquetas al dialogo.', max: 5 }
            ]
        }
    ];

    criteriaStructure.forEach((section) => {
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

        results.forEach((result, idx) => {
            let sectionTotal = 0;
            section.criteria.forEach((crit) => {
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

        section.criteria.forEach((crit) => {
            const nameCell = worksheet.getCell(currentRow, 1);
            nameCell.value = crit.name;
            nameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            nameCell.border = borders;

            const maxCell = worksheet.getCell(currentRow, 2);
            maxCell.value = crit.max;
            maxCell.alignment = { vertical: 'middle', horizontal: 'center' };
            maxCell.border = borders;

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

    const totalLabelCell = worksheet.getCell(currentRow, 1);
    totalLabelCell.value = 'TOTAL FINAL';
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
        const total = Number(result.evaluation?.promedio_final || 0);
        const cell = worksheet.getCell(currentRow, 3 + idx);
        cell.value = total.toFixed(2);
        cell.fill = fillDarkBlue;
        cell.font = fontWhiteBold;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = borders;
    });

    worksheet.getColumn(1).width = 60;
    worksheet.getColumn(2).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Boleta_${managerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

function getScoreForCriterion(result, criterionName) {
    if (!result || !result.evaluation) return 0;
    const eval_ = result.evaluation;

    if (criterionName.includes('Salida de forma adecuada')) return eval_.scripts?.saludo || 0;
    if (criterionName.includes('script de despedida')) return eval_.scripts?.despedida || 0;

    if (criterionName.includes('Personaliza')) return eval_.protocolo?.personaliza || 0;
    if (criterionName.includes('Maneja tiempos de respuesta')) return eval_.protocolo?.tiempos_respuesta || 0;
    if (criterionName.includes('No excede tiempo de espera')) return eval_.protocolo?.tiempo_espera || 0;
    if (criterionName.includes('Valida y registra')) return eval_.protocolo?.valida_datos || 0;
    if (criterionName.includes('Toma de pedido')) return eval_.protocolo?.toma_pedido || 0;
    if (criterionName.includes('ofrecimientos adicionales')) return eval_.protocolo?.ofrece_adicionales || 0;
    if (criterionName.includes('Confirma la orden')) return eval_.protocolo?.confirma_orden || 0;
    if (criterionName.includes('link de pago')) return eval_.protocolo?.link_pago || 0;
    if (criterionName.includes('ayuda adicional')) return eval_.protocolo?.ayuda_adicional || 0;

    if (criterionName.includes('dominio y seguridad')) return eval_.calidad?.dominio_seguridad || 0;
    if (criterionName.includes('Redaccion clara')) return eval_.calidad?.redaccion_clara || 0;
    if (criterionName.includes('Empatia')) return eval_.calidad?.empatia_cortesia || 0;

    if (criterionName.includes('Confirmo datos')) return eval_.registro?.confirma_datos || 0;
    if (criterionName.includes('etiquetas')) return eval_.registro?.etiquetas || 0;

    return 0;
}
