let tesseractModulePromise = null;

const getTesseract = async () => {
    if (!tesseractModulePromise) {
        tesseractModulePromise = import('tesseract.js');
    }

    const module = await tesseractModulePromise;
    return module.default || module;
};

/**
 * Extrae texto de una imagen usando OCR (Tesseract.js)
 * @param {string} imageUrl - URL de la imagen a analizar
 * @param {boolean} showProgress - Si mostrar progreso en consola (default: true)
 * @returns {Promise<string>} - Texto extraido de la imagen
 */
export async function extractTextFromImage(imageUrl, showProgress = true) {
    try {
        if (showProgress) {
            console.log('[OCR] Analizando imagen:', imageUrl);
        }

        const Tesseract = await getTesseract();
        const { data: { text } } = await Tesseract.recognize(
            imageUrl,
            'spa',
            {
                // tesseract.js espera una funcion; undefined puede romper en algunos entornos
                logger: showProgress
                    ? (m) => {
                        if (m.status === 'recognizing text') {
                            console.log(`[OCR] Progreso: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                    : () => { }
            }
        );

        const cleanedText = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join(' ');

        if (showProgress) {
            console.log('[OCR] Texto extraido:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''));
        }

        return cleanedText;
    } catch (error) {
        console.error('[OCR] Error al extraer texto de imagen:', error);
        return '';
    }
}

/**
 * Obtiene todas las URLs de imagen detectables en un mensaje.
 * @param {Object} message - Objeto mensaje de la API de Simla
 * @returns {string[]} - Lista de URLs encontradas
 */
export function getImageUrlsFromMessage(message = {}) {
    const urls = [];
    const pushUrl = (value) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            urls.push(value);
        }
    };

    if (message.media?.url) {
        pushUrl(message.media.url);
    }

    if (Array.isArray(message.media)) {
        message.media.forEach((item) => {
            pushUrl(item?.url);
            pushUrl(item?.preview_url);
        });
    }

    if (message.file_url) {
        pushUrl(message.file_url);
    }

    if (message.file?.url) {
        pushUrl(message.file.url);
    }

    // Importante: en la UI de chats se renderizan imagenes desde msg.items
    if (Array.isArray(message.items)) {
        message.items.forEach((item) => {
            pushUrl(item?.preview_url);
            pushUrl(item?.url);
        });
    }

    if (Array.isArray(message.attachments)) {
        message.attachments.forEach((att) => {
            if (att?.type === 'image' || att?.mime_type?.startsWith('image/')) {
                pushUrl(att?.url);
                pushUrl(att?.preview_url);
            }
        });
    }

    if (message.type === 'image' && message.url) {
        pushUrl(message.url);
    }

    return [...new Set(urls)];
}

/**
 * Detecta si un mensaje tiene imagen y devuelve la primera URL.
 * @param {Object} message - Objeto mensaje de la API de Simla
 * @returns {string|null} - URL de imagen o null
 */
export function getImageUrlFromMessage(message) {
    const urls = getImageUrlsFromMessage(message);
    return urls[0] || null;
}
