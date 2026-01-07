const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const EVALUATION_PROMPT = `Eres un evaluador de calidad de atención al cliente para Punto Farma. Analiza el siguiente chat entre un agente y un cliente.

RÚBRICA DE EVALUACIÓN:

1. CUMPLIMIENTO DE SCRIPTS (Máximo 10 puntos)
   - 1.1 Saludo adecuado, menciona nombre del agente y solicita nombre del cliente (5 pts)
   - 1.2 Despedida completa con nombre, agradecimiento y tiempo de entrega (5 pts)

2. CUMPLIMIENTO DE PROTOCOLO (Máximo 50 puntos)
   - 2.1 Personaliza llamando al cliente por su nombre (4 pts)
   - 2.2 Tiempos de respuesta adecuados, máximo 1 minuto entre mensajes (4 pts)
   - 2.3 No excede tiempo de espera sin avisar (6 pts)
   - 2.4 Valida y confirma datos: teléfono, dirección, referencias (4 pts)
   - 2.5 Toma de pedido clara y correcta (8 pts)
   - 2.6 Ofrece productos adicionales y promociones vigentes (7 pts)
   - 2.7 Confirma orden con precios, totales y costos de envío (6 pts)
   - 2.8 Ofrece link de pago como primera opción (6 pts)
   - 2.9 Pregunta si necesita ayuda adicional antes de cerrar (3 pts)
   - 2.10 Evita silencios prolongados, más de 3 minutos sin respuesta (2 pts)

3. CALIDAD DE LA ATENCIÓN (Máximo 30 puntos)
   - 3.1 Demuestra dominio y seguridad, sin dudas (6 pts)
   - 3.2 Escucha activa, no interrumpe (solo aplica si hay indicios) (4 pts)
   - 3.3 Evita muletillas: mjm, ajá, ok, este, fíjese (4 pts)
   - 3.4 Empatía, cortesía y orientación a soluciones (6 pts)
   - 3.5 Comunicación fluida, sin repeticiones innecesarias (5 pts)
   - 3.6 Redacción clara, sin faltas de ortografía (5 pts)

4. CUMPLIMIENTO DE REGISTRO (Máximo 10 puntos)
   - 4.1 Captura información completa (nombre, teléfono, dirección, productos) (10 pts)

INSTRUCCIONES:
- Evalúa SOLO lo que puedes observar en el chat
- Si un criterio no aplica o no hay evidencia, asigna el puntaje completo
- Sé objetivo y consistente

RESPONDE EN FORMATO JSON EXACTO:
{
  "scripts": {
    "saludo": <0-5>,
    "despedida": <0-5>,
    "total": <0-10>
  },
  "protocolo": {
    "personaliza": <0-4>,
    "tiempos_respuesta": <0-4>,
    "tiempo_espera": <0-6>,
    "valida_datos": <0-4>,
    "toma_pedido": <0-8>,
    "ofrece_adicionales": <0-7>,
    "confirma_orden": <0-6>,
    "link_pago": <0-6>,
    "ayuda_adicional": <0-3>,
    "sin_silencios": <0-2>,
    "total": <0-50>
  },
  "calidad": {
    "dominio": <0-6>,
    "escucha": <0-4>,
    "sin_muletillas": <0-4>,
    "empatia": <0-6>,
    "fluidez": <0-5>,
    "redaccion": <0-5>,
    "total": <0-30>
  },
  "registro": {
    "datos_completos": <0-10>,
    "total": <0-10>
  },
  "promedio_final": <suma de totales>,
  "observaciones": "<máximo 2 sugerencias de mejora importantes>"
}

CHAT A EVALUAR:
`;

export const evaluateChat = async (chatMessages, agentName) => {
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
                    content: EVALUATION_PROMPT + transcript
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
            const evaluation = await evaluateChat(messages, agentName);
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
