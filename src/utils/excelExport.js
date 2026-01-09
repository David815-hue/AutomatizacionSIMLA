import XLSX from 'xlsx-js-style';

/**
 * Exporta las evaluaciones a un archivo Excel con formato idéntico a la boleta de Punto Farma
 * @param {Array} results - Array de resultados de evaluación
 * @param {string} managerName - Nombre del gestor evaluado
 */
export function exportEvaluationsToExcel(results, managerName = 'Gestor') {
    if (!results || results.length === 0) {
        alert('No hay evaluaciones para exportar');
        return;
    }

    // Estilos Base
    const borderStyle = { style: 'thin', color: { rgb: "CCCCCC" } };
    const borders = {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle
    };

    const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
    const boldStyle = { font: { bold: true } };

    // 1. Header Azul (Operator Name)
    const headerBlueStyle = {
        fill: { fgColor: { rgb: "003366" } }, // Azul oscuro
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12 },
        alignment: { horizontal: 'left', vertical: 'center' }
    };

    // 2. Black Header (Link de Muestra)
    const blackHeaderStyle = {
        fill: { fgColor: { rgb: "000000" } }, // Negro
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borders
    };

    // 3. Blue Subheader (Puntos a calificar)
    const blueSubHeaderStyle = {
        fill: { fgColor: { rgb: "003366" } }, // Azul oscuro
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borders
    };

    // 4. Section Header (Cumplimiento...)
    const sectionHeaderStyle = {
        fill: { fgColor: { rgb: "9BC2E6" } }, // Azul claro
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borders
    };

    // 5. Data Cell
    const dataCellStyle = {
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borders
    };

    // 6. Label Cell (Preguntas)
    const labelCellStyle = {
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: borders
    };

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Preparar filas de datos
    const wsData = [];

    // --- FILA 1: Título Principal ---
    // (Podemos omitirlo o poner un placeholder, la imagen empieza con operador)
    // Vamos a poner el título para que se vea bien
    wsData.push([
        { v: "Boleta de Calidad – Evaluación de Operadores", s: { font: { bold: true, sz: 14, color: { rgb: "003366" } }, alignment: { horizontal: "center" } } },
        { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} }, { v: "", s: {} }
    ]);

    // --- FILA 2: Operador Evaluado ---
    const operatorRow = [
        { v: "Operador Evaluado:", s: { ...headerBlueStyle, alignment: { horizontal: "right" } } },
        { v: "", s: headerBlueStyle }, // Merge placeholder
        { v: managerName, s: headerBlueStyle },
        { v: "", s: headerBlueStyle }, // Fill rest
        { v: "", s: headerBlueStyle }
    ];
    // Rellenar columnas extra para cada chat
    for (let i = 0; i < Math.max(0, results.length - 2); i++) {
        operatorRow.push({ v: "", s: headerBlueStyle });
    }
    wsData.push(operatorRow);

    // --- FILA 3: Link de Muestra / IDs ---
    const linkRow = [
        { v: "LINK DE MUESTRA /NUMERO", s: { ...blackHeaderStyle, alignment: { horizontal: "left" } } },
        { v: "", s: blackHeaderStyle }, // Columna KPI placeholder
    ];
    // Agregar IDs de chats (39479, 206106...)
    results.forEach(result => {
        const id = result.dialogId || result.chatId || "N/A";
        linkRow.push({ v: id, s: blackHeaderStyle });
    });
    wsData.push(linkRow);

    // --- FILA 4: Puntos a calificar / M1 M2 M3 ---
    const pointsHeaderRow = [
        { v: "Puntos a calificar", s: blueSubHeaderStyle },
        { v: "KPI Cump.", s: blueSubHeaderStyle },
    ];
    results.forEach((_, idx) => {
        pointsHeaderRow.push({ v: `M${idx + 1}`, s: blueSubHeaderStyle });
    });
    wsData.push(pointsHeaderRow);

    // Estructura de Criterios (Igual que antes)
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
                // Nota: En la imagen hay más items pero adaptamos los que tenemos en el evaluador
                // Si el evaluador tiene "Empatía" y "Registro", los agregamos como secciones extra
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

    // --- FILAS DE DATOS ---
    criteriaStructure.forEach(section => {
        // Sección Header Row (e.g. Cumplimiento de scripts | 10 | 10 | 10)
        const sectionRow = [
            { v: section.section, s: sectionHeaderStyle },
            { v: section.max, s: sectionHeaderStyle }
        ];

        // Calcular puntaje total de la sección para cada chat (M1, M2...)
        // Esto es un estimado, ya que "M1" en la imagen header de sección tiene el puntaje total de esa sección obtenido
        // Vamos a calcularlo sumando los items individuales
        results.forEach(result => {
            let sectionTotal = 0;
            // Calcular suma
            section.criteria.forEach(crit => {
                sectionTotal += getScoreForCriterion(result, crit.name);
            });
            sectionRow.push({ v: sectionTotal, s: sectionHeaderStyle });
        });
        wsData.push(sectionRow);

        // Criterios individuales
        section.criteria.forEach(criterion => {
            const row = [
                { v: criterion.name, s: labelCellStyle },
                { v: criterion.max, s: dataCellStyle } // Max score column (KPI Cump)
            ];

            results.forEach(result => {
                const score = getScoreForCriterion(result, criterion.name);
                row.push({ v: score.toFixed(2), s: dataCellStyle });
            });
            wsData.push(row);
        });
    });

    // --- FILA TOTALES (Opcional, no está en la imagen recortada pero es útil) ---
    wsData.push([]);
    const totalRow = [
        { v: "TOTAL FINAL", s: { ...headerBlueStyle, alignment: { horizontal: "right" } } },
        { v: 100, s: { ...headerBlueStyle, alignment: { horizontal: "center" } } } // Max Total
    ];
    results.forEach(result => {
        const total = result.evaluation?.total || 0;
        totalRow.push({ v: total.toFixed(2), s: { ...headerBlueStyle, alignment: { horizontal: "center" } } });
    });
    wsData.push(totalRow);


    // Crear hoja
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Definir Anchos de columna
    const cols = [{ wch: 60 }, { wch: 10 }]; // A, B
    results.forEach(() => cols.push({ wch: 12 })); // M1, M2...
    ws['!cols'] = cols;

    // Defines Merges
    // Título fila 1
    const totalCols = 2 + results.length; // A, B + Chats
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Título principal
        // Operador Evaluado fila 2: Merge "Operador Evaluado" (A2:B2) y Nombre (C2:End)
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 1, c: 2 }, e: { r: 1, c: totalCols - 1 } },
        // Link de Muestra fila 3: Merge A3:B3
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
        // Puntos a calificar fila 4: Cell A4 solo
    ];

    // Merge para los headers de sección (A:B merged? No, B tiene el Max score)
    // En la imagen "Cumplimiento de scripts" parece ocupar A y B? No, tiene un 10 al lado.
    // "Cumplimiento de scripts" columna A, "10" columna B.
    // Parece que está bien.

    ws['!merges'] = merges;

    // Agregar y guardar
    XLSX.utils.book_append_sheet(wb, ws, "Evaluación");
    const fileName = `Boleta_${managerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Helper para obtener puntaje
function getScoreForCriterion(result, criterionName) {
    if (!result || !result.evaluation) return 0;
    const eval_ = result.evaluation;

    // Mapeo basado en nombres
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
