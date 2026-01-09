const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const EVALUATION_PROMPT = `Eres un evaluador de calidad de atención al cliente para Punto Farma. Analiza el siguiente chat entre un agente y un cliente.

RÚBRICA DE EVALUACIÓN:

1. CUMPLIMIENTO DE SCRIPTS (Máximo 20 puntos)
   - 1.1 Saludo adecuado, menciona nombre del agente y solicita nombre del cliente (10 pts)
   - 1.2 Despedida completa con nombre, agradecimiento y tiempo de entrega (10 pts)

2. CUMPLIMIENTO DE PROTOCOLO (Máximo 60 puntos)
   - 2.1 Personaliza llamando al cliente por su nombre (5 pts)
   - 2.2 Tiempos de respuesta adecuados, máximo 1 minuto entre mensajes (5 pts)
   - 2.3 No excede tiempo de espera sin avisar (7 pts)
   - 2.4 Valida y confirma datos: teléfono, dirección, referencias (5 pts)
   - 2.5 Toma de pedido clara y correcta (9 pts)
   - 2.6 Ofrece productos adicionales y promociones vigentes (8 pts)
   - 2.7 Confirma orden con precios, totales y costos de envío (7 pts)
   - 2.8 Ofrece link de pago como primera opción (7 pts)
   - 2.9 Pregunta si necesita ayuda adicional antes de cerrar (4 pts)
   - 2.10 Evita silencios prolongados, más de 3 minutos sin respuesta (3 pts)

3. CALIDAD DE LA ATENCIÓN (Máximo 10 puntos)
   - 3.1 Demuestra dominio y seguridad en el producto/servicio (3 pts)
   - 3.2 Redacción clara, sin faltas de ortografía (3 pts)
   - 3.3 Empatía, cortesía y orientación a soluciones (4 pts)

4. CUMPLIMIENTO DE REGISTRO (Máximo 10 puntos)
   - 4.1 Confirmó datos del cliente en el chat (nombre, teléfono, dirección) (5 pts)
   - 4.2 Colocó etiquetas al diálogo (5 pts) - SIEMPRE PONER 0, el supervisor verificará manualmente

INSTRUCCIONES:
- Evalúa SOLO lo que puedes observar en el chat
- Si un criterio no aplica o no hay evidencia, asigna el puntaje completo
- Para "etiquetas", SIEMPRE asigna 0 puntos (se verifica manualmente después)
- Sé objetivo y consistente

RESPONDE EN FORMATO JSON EXACTO:
{
  "scripts": {
    "saludo": <0-10>,
    "despedida": <0-10>,
    "total": <0-20>
  },
  "protocolo": {
    "personaliza": <0-5>,
    "tiempos_respuesta": <0-5>,
    "tiempo_espera": <0-7>,
    "valida_datos": <0-5>,
    "toma_pedido": <0-9>,
    "ofrece_adicionales": <0-8>,
    "confirma_orden": <0-7>,
    "link_pago": <0-7>,
    "ayuda_adicional": <0-4>,
    "sin_silencios": <0-3>,
    "total": <0-60>
  },
  "calidad": {
    "dominio_seguridad": <0-3>,
    "redaccion_clara": <0-3>,
    "empatia_cortesia": <0-4>,
    "total": <0-10>
  },
  "registro": {
    "confirma_datos": <0-5>,
    "etiquetas": <0-5>,
    "total": <0-10>
  },
  "promedio_final": <suma de totales>,
  "observaciones": "<máximo 2 sugerencias de mejora importantes>"
}

CHAT A EVALUAR:
`;

const TAGS_SECTION = (tags) => {
    if (!tags || tags.length === 0) {
        return '\nETIQUETAS DEL DIÁLOGO: Ninguna etiqueta asignada\n';
    }
    const tagNames = tags.map(t => t.name).join(', ');
    return `\nETIQUETAS DEL DIÁLOGO: ${tagNames}\n`;
};

export const evaluateChat = async (chatMessages, agentName, dialogTags = []) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
        throw new Error('Groq API key not configured');
    }

    // Format chat transcript
    const transcript = chatMessages.map(msg => {
        const sender = msg.from?.type === 'user' ? agentName : 'Cliente';
        const time = new Date(msg.created_at).toLocaleTimeString();
        return `[${time}] ${sender}: ${msg.content || '[media]'}`;
    }).join('\n');

    // Build full prompt with tags info
    const fullPrompt = EVALUATION_PROMPT + TAGS_SECTION(dialogTags) + transcript;

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            temperature: 0.1,
            max_tokens: 1000,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse evaluation response');
    }

    return JSON.parse(jsonMatch[0]);
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
                messages: messages,
                evaluation
            });
        } catch (error) {
            console.error(`Error evaluating chat ${chat.id}:`, error);
            results.push({
                chatId: chat.id,
                dialogId: chat.last_dialog?.id,
                customerName: chat.customer?.name || 'Desconocido',
                messages: messages,
                error: error.message
            });
        }

        // Small delay to avoid rate limiting
        if (i < chatsWithMessages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
};
