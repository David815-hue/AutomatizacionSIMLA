export const createClient = (baseUrl, token) => {
    // Detect environment
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Helper to build URL and fetch
    const proxyFetch = async (path, params = {}) => {
        if (isDev) {
            // Development: Use Vite proxy
            const queryString = new URLSearchParams(params).toString();
            const url = `/api/bot/v1${path}${queryString ? '?' + queryString : ''}`;

            return fetch(url, {
                method: 'GET',
                headers: {
                    'X-Bot-Token': token,
                    'Content-Type': 'application/json',
                },
            });
        } else {
            // Production: Use Vercel serverless proxy
            const proxyParams = {
                endpoint: baseUrl,
                token: token,
                path: path,
                ...params
            };
            const queryString = new URLSearchParams(proxyParams).toString();

            return fetch(`/api/simla-proxy?${queryString}`, {
                method: 'GET',
            });
        }
    };

    const getChats = async (limit = 50, offset = 0) => {
        try {
            const response = await proxyFetch('/chats', { limit, offset });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching chats:", error);
            throw error;
        }
    };

    const getMessages = async (chatId, limit = 100) => {
        try {
            const response = await proxyFetch('/messages', { chat_id: chatId, limit });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching messages:", error);
            throw error;
        }
    };

    // Get messages by dialog ID - more efficient for evaluation
    const getMessagesByDialog = async (dialogId, limit = 100) => {
        try {
            const response = await proxyFetch('/messages', { dialog_id: dialogId, limit });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching messages by dialog:", error);
            throw error;
        }
    };

    // Get all users (managers) - call once to get IDs
    const getUsers = async (limit = 100) => {
        try {
            const response = await proxyFetch('/users', { limit, active: 'true' });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
        }
    };

    // Get dialogs with filters - optimized for date range and user filtering
    const getDialogs = async ({ since, until, userId, active = false, limit = 100, sinceId, offset } = {}) => {
        try {
            const params = { limit };
            if (since) params.since = since;
            if (until) params.until = until;
            if (userId) params.user_id = userId;
            if (active !== undefined) params.active = active ? 'true' : 'false';
            if (sinceId) params.since_id = sinceId;
            if (offset !== undefined) params.offset = offset;

            const response = await proxyFetch('/dialogs', params);
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching dialogs:", error);
            throw error;
        }
    };

    // Get messages filtered by user_id and date range - to find dialogs where a manager participated
    const getMessagesByUser = async ({ userId, since, until, limit = 100, sinceId, offset } = {}) => {
        try {
            const params = { limit };
            if (userId) params.user_id = userId;
            if (since) params.since = since;
            if (until) params.until = until;
            if (sinceId) params.since_id = sinceId;
            if (offset !== undefined) params.offset = offset;

            const response = await proxyFetch('/messages', params);
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching messages by user:", error);
            throw error;
        }
    };

    return { getChats, getMessages, getMessagesByDialog, getUsers, getDialogs, getMessagesByUser };
};
