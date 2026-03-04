import {
    extractTextFromImage,
    getImageUrlsFromMessage
} from './imageAnalysis';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const EVALUATION_PROMPT = `Eres un evaluador de calidad de atencion al cliente para Punto Farma. Analiza el siguiente chat entre un agente y un cliente.

RUBRICA DE EVALUACION:

1. CUMPLIMIENTO DE SCRIPTS (Maximo 20 puntos)
   - 1.1 Saludo adecuado, menciona nombre del agente y solicita nombre del cliente (10 pts)
   - 1.2 Despedida completa con nombre, agradecimiento y tiempo de entrega (10 pts)

2. CUMPLIMIENTO DE PROTOCOLO (Maximo 60 puntos)
   - 2.1 Personaliza llamando al cliente por su nombre (6 pts)
   - 2.2 Tiempos de respuesta adecuados, maximo 1 minuto entre mensajes (5 pts)
   - 2.3 No excede tiempo de espera sin avisar (7 pts)
   - 2.4 Valida y confirma datos: telefono, direccion, referencias (5 pts)
   - 2.5 Toma de pedido clara y correcta (9 pts)
   - 2.6 Ofrece productos adicionales y promociones vigentes (8 pts)
   - 2.7 Confirma orden con precios, totales y costos de envio (7 pts)
   - 2.8 Ofrece link de pago como primera opcion (8 pts)
   - 2.9 Pregunta si necesita ayuda adicional antes de cerrar (5 pts)

3. CALIDAD DE LA ATENCION (Maximo 10 puntos)
   - 3.1 Demuestra dominio y seguridad en el producto/servicio (3 pts)
   - 3.2 Redaccion clara, sin faltas de ortografia (3 pts)
   - 3.3 Empatia, cortesia y orientacion a soluciones (4 pts)

4. CUMPLIMIENTO DE REGISTRO (Maximo 10 puntos)
   - 4.1 Confirmo datos del cliente en el chat (nombre, telefono, direccion) (5 pts)
   - 4.2 Coloco etiquetas al dialogo (5 pts) - SIEMPRE PONER 0, el supervisor verificara manualmente

INSTRUCCIONES:
- Evalua SOLO lo que puedes observar en el chat
- Si un criterio no aplica o no hay evidencia, asigna null para permitir revision manual
- Para "etiquetas", SIEMPRE asigna 0 puntos (se verifica manualmente despues)
- Se objetivo y consistente
- Los valores null indican que el criterio requiere validacion manual del supervisor
- Cuando el transcript incluya "ANALISIS OCR IMPULSO", usalo como evidencia para 2.6

RESPONDE EN FORMATO JSON EXACTO (usa null cuando no hay evidencia):
{
  "scripts": {
    "saludo": <0-10 o null>,
    "despedida": <0-10 o null>,
    "total": <0-20 o null>
  },
  "protocolo": {
    "personaliza": <0-6 o null>,
    "tiempos_respuesta": <0-5 o null>,
    "tiempo_espera": <0-7 o null>,
    "valida_datos": <0-5 o null>,
    "toma_pedido": <0-9 o null>,
    "ofrece_adicionales": <0-8 o null>,
    "confirma_orden": <0-7 o null>,
    "link_pago": <0-8 o null>,
    "ayuda_adicional": <0-5 o null>,
    "total": <0-60 o null>
  },
  "calidad": {
    "dominio_seguridad": <0-3 o null>,
    "redaccion_clara": <0-3 o null>,
    "empatia_cortesia": <0-4 o null>,
    "total": <0-10 o null>
  },
  "registro": {
    "confirma_datos": <0-5 o null>,
    "etiquetas": <0-5>,
    "total": <0-10 o null>
  },
  "promedio_final": <suma de totales, excluyendo valores null>,
  "observaciones": "<maximo 2 sugerencias de mejora importantes>"
}

CHAT A EVALUAR:
`;

const IMPULSE_OFFER_CLASSIFIER_PROMPT = `Analiza texto OCR de una conversacion de ventas y detecta si el agente OFRECIO un producto de impulso.

Reglas:
- "si": hay evidencia explicita de ofrecimiento (ej: "te ofrezco", "tambien tenemos", "agregamos", "aprovecha promo").
- "no": no hay ofrecimiento, solo toma de pedido o informacion neutra.
- "dudoso": OCR incompleto o ambiguo.

Devuelve SOLO JSON valido con este formato exacto:
{
  "ofrecio_impulso": "si|no|dudoso",
  "confianza": <0 a 1>,
  "evidencia": ["frase corta 1", "frase corta 2"],
  "razon": "explicacion breve"
}
`;

const TAGS_SECTION = (tags) => {
    if (!tags || tags.length === 0) {
        return '\nETIQUETAS DEL DIALOGO: Ninguna etiqueta asignada\n';
    }

    const tagNames = tags.map((t) => t.name).join(', ');
    return `\nETIQUETAS DEL DIALOGO: ${tagNames}\n`;
};

const isAgentMessage = (msg) => msg.from?.type === 'user' || msg.from?.type === 'bot';

const callGroq = async ({ apiKey, content, model = 'llama-3.3-70b-versatile', maxTokens = 1000 }) => {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            temperature: 0.1,
            max_tokens: maxTokens
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
};

const parseFirstJsonObject = (content) => {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse JSON response');
    }
    return JSON.parse(jsonMatch[0]);
};

const classifyImpulseOfferFromOcr = async (ocrTexts, apiKey) => {
    if (!Array.isArray(ocrTexts) || ocrTexts.length === 0) {
        return {
            ofrecio_impulso: 'dudoso',
            confianza: 0,
            evidencia: [],
            razon: 'No hay texto OCR util para clasificar.'
        };
    }

    const content = `${IMPULSE_OFFER_CLASSIFIER_PROMPT}\n\nTEXTO OCR:\n${ocrTexts.join('\n')}`;

    try {
        const raw = await callGroq({
            apiKey,
            content,
            model: 'llama-3.1-8b-instant',
            maxTokens: 300
        });
        const parsed = parseFirstJsonObject(raw);

        return {
            ofrecio_impulso: parsed.ofrecio_impulso || 'dudoso',
            confianza: Number(parsed.confianza) || 0,
            evidencia: Array.isArray(parsed.evidencia) ? parsed.evidencia.slice(0, 2) : [],
            razon: parsed.razon || 'Sin razon'
        };
    } catch (error) {
        console.warn('[OCR] No se pudo clasificar oferta de impulso con Groq:', error.message);
        return {
            ofrecio_impulso: 'dudoso',
            confianza: 0,
            evidencia: [],
            razon: 'No se pudo clasificar la oferta de impulso.'
        };
    }
};

export const evaluateChat = async (chatMessages, agentName, dialogTags = []) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
        throw new Error('Groq API key not configured');
    }

    console.log('[OCR] Procesando', chatMessages.length, 'mensajes para evaluacion...');
    console.log('[Tags Debug] Tags recibidos en evaluateChat:', dialogTags);
    console.log('[Tags Debug] Cantidad de tags recibidos:', Array.isArray(dialogTags) ? dialogTags.length : 0);

    const ocrCache = new Map();
    const getOcrText = async (imageUrl) => {
        if (!ocrCache.has(imageUrl)) {
            ocrCache.set(imageUrl, extractTextFromImage(imageUrl, true));
        }
        return ocrCache.get(imageUrl);
    };

    const ocrTexts = [];
    const transcriptPromises = chatMessages.map(async (msg, index) => {
        const fromAgent = isAgentMessage(msg);
        const sender = fromAgent ? agentName : 'Cliente';
        const time = new Date(msg.created_at).toLocaleTimeString();

        const imageUrls = getImageUrlsFromMessage(msg);
        if (imageUrls.length === 0) {
            return `[${time}] ${sender}: ${msg.content || '[media]'}`;
        }

        // Solo aplicar OCR a mensajes del gestor/agente.
        if (!fromAgent) {
            if (msg.content) {
                return `[${time}] ${sender}: ${msg.content} [Adjunto imagen]`;
            }
            return `[${time}] ${sender}: [Imagen adjunta por cliente]`;
        }

        console.log(`[OCR] Mensaje #${index + 1}: ${imageUrls.length} imagen(es) detectadas`);

        const ocrResults = await Promise.all(
            imageUrls.map(async (url) => {
                const extractedText = await getOcrText(url);
                if (!extractedText || extractedText.trim().length === 0) {
                    return null;
                }

                return extractedText;
            })
        );

        const validOcrResults = ocrResults.filter(Boolean);
        if (validOcrResults.length === 0) {
            return `[${time}] ${sender}: ${msg.content || '[Imagen sin texto legible]'}`;
        }

        const ocrText = validOcrResults.join(' | ');
        ocrTexts.push(...validOcrResults);

        if (msg.content) {
            return `[${time}] ${sender}: ${msg.content} [Adjunto imagen OCR: "${ocrText}"]`;
        }

        return `[${time}] ${sender}: [Imagen con texto: "${ocrText}"]`;
    });

    const transcript = (await Promise.all(transcriptPromises)).join('\n');
    const impulsoOcr = await classifyImpulseOfferFromOcr(ocrTexts, apiKey);
    const impulseSection = `\nANALISIS OCR IMPULSO:\n- ofrecio_impulso: ${impulsoOcr.ofrecio_impulso}\n- confianza: ${impulsoOcr.confianza}\n- evidencia: ${impulsoOcr.evidencia.length > 0 ? impulsoOcr.evidencia.join(' | ') : 'sin evidencia textual'}\n- razon: ${impulsoOcr.razon}\n`;

    const fullPrompt = EVALUATION_PROMPT + impulseSection + TAGS_SECTION(dialogTags) + transcript;

    const content = await callGroq({ apiKey, content: fullPrompt, model: 'llama-3.3-70b-versatile', maxTokens: 1000 });
    const evaluation = parseFirstJsonObject(content);
    evaluation.impulso_ocr = impulsoOcr;
    return evaluation;
};

export const evaluateMultipleChats = async (chatsWithMessages, agentName, onProgress) => {
    const results = [];

    for (let i = 0; i < chatsWithMessages.length; i++) {
        const { chat, messages } = chatsWithMessages[i];

        if (onProgress) {
            onProgress(i + 1, chatsWithMessages.length);
        }

        try {
            const dialogTags = chat.tags || [];
            const evaluation = await evaluateChat(messages, agentName, dialogTags);
            results.push({
                chatId: chat.id,
                dialogId: chat.last_dialog?.id,
                customerName: chat.customer?.name || 'Desconocido',
                messages,
                evaluation
            });
        } catch (error) {
            console.error(`Error evaluating chat ${chat.id}:`, error);
            results.push({
                chatId: chat.id,
                dialogId: chat.last_dialog?.id,
                customerName: chat.customer?.name || 'Desconocido',
                messages,
                error: error.message
            });
        }

        if (i < chatsWithMessages.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    return results;
};
