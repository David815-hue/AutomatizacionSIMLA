import Tesseract from 'tesseract.js';

/**
 * Extrae texto de una imagen usando OCR (Tesseract.js)
 * @param {string} imageUrl - URL de la imagen a analizar
 * @param {boolean} showProgress - Si mostrar progreso en consola (default: true)
 * @returns {Promise<string>} - Texto extraído de la imagen
 */
export async function extractTextFromImage(imageUrl, showProgress = true) {
    try {
        if (showProgress) {
            console.log('🔍 [OCR] Analizando imagen:', imageUrl);
        }

        const { data: { text } } = await Tesseract.recognize(
            imageUrl,
            'spa', // Idioma español
            {
                logger: showProgress ? (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`🔍 [OCR] Progreso: ${Math.round(m.progress * 100)}%`);
                    }
                } : undefined
            }
        );

        // Limpiar texto extraído (eliminar espacios extras, líneas vacías)
        const cleanedText = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join(' ');

        if (showProgress) {
            console.log('✅ [OCR] Texto extraído:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''));
        }

        return cleanedText;
    } catch (error) {
        console.error('❌ [OCR] Error al extraer texto de imagen:', error);
        return ''; // Retornar string vacío en caso de error
    }
}

/**
 * Detecta si un mensaje tiene imágenes
 * @param {Object} message - Objeto mensaje de la API de Simla
 * @returns {string|null} - URL de la imagen si existe, null si no
 */
export function getImageUrlFromMessage(message) {
    // Intentar múltiples campos donde podría estar la imagen

    // 0. Campo 'items' (Simla CRM — el más común para imágenes)
    if (message.items && message.items.length > 0) {
        const imgItem = message.items.find(it =>
            it.preview_url || it.url || it.type === 'image'
        );
        if (imgItem?.preview_url) return imgItem.preview_url;
        if (imgItem?.url) return imgItem.url;
    }

    // 1. Campo 'media' (más probable según el usuario)
    if (message.media?.url) {
        return message.media.url;
    }

    // 2. Campo 'file' o 'file_url'
    if (message.file_url) {
        return message.file_url;
    }

    if (message.file?.url) {
        return message.file.url;
    }

    // 3. Campo 'attachments' (array)
    if (message.attachments && message.attachments.length > 0) {
        const imageAttachment = message.attachments.find(att =>
            att.type === 'image' || att.mime_type?.startsWith('image/')
        );
        if (imageAttachment?.url) {
            return imageAttachment.url;
        }
    }

    // 4. Fallback: si tiene tipo 'image'
    if (message.type === 'image' && message.url) {
        return message.url;
    }

    return null;
}
