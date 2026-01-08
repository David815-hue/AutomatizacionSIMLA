export const createClient = (baseUrl, token) => {
    // Use relative URL in development to leverage Vite's proxy
    // This avoids CORS issues when connecting to mg-o1.retailcrm.pro
    const isDev = window.location.hostname === 'localhost';
    const API_URL = isDev ? '/api/bot/v1' : `${baseUrl}/api/bot/v1`;

    const headers = {
        "X-Bot-Token": token,
        "Content-Type": "application/json",
    };

    const getChats = async (limit = 50, offset = 0) => {
        try {
            const params = new URLSearchParams();
            params.append('limit', limit);
            params.append('offset', offset);

            const response = await fetch(`${API_URL}/chats?${params.toString()}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching chats:", error);
            throw error;
        }
    };

    const getMessages = async (chatId, limit = 100) => {
        try {
            const response = await fetch(`${API_URL}/messages?chat_id=${chatId}&limit=${limit}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching messages:", error);
            throw error;
        }
    };

    // Get messages by dialog ID - more efficient for evaluation
    const getMessagesByDialog = async (dialogId, limit = 100) => {
        try {
            const response = await fetch(`${API_URL}/messages?dialog_id=${dialogId}&limit=${limit}`, {
                method: "GET",
                headers,
            });
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
            const params = new URLSearchParams();
            params.append('limit', limit);
            params.append('active', 'true');

            const response = await fetch(`${API_URL}/users?${params.toString()}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
        }
    };

    // Get dialogs with filters - optimized for date range and user filtering
    const getDialogs = async ({ since, until, userId, active = false, limit = 100, sinceId } = {}) => {
        try {
            const params = new URLSearchParams();
            params.append('limit', limit);

            if (since) params.append('since', since);
            if (until) params.append('until', until);
            if (userId) params.append('user_id', userId);
            if (active !== undefined) params.append('active', active ? 'true' : 'false');
            if (sinceId) params.append('since_id', sinceId);

            const response = await fetch(`${API_URL}/dialogs?${params.toString()}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching dialogs:", error);
            throw error;
        }
    };

    // Get messages filtered by user_id and date range - to find dialogs where a manager participated
    const getMessagesByUser = async ({ userId, since, until, limit = 100, sinceId } = {}) => {
        try {
            const params = new URLSearchParams();
            params.append('limit', limit);

            if (userId) params.append('user_id', userId);
            if (since) params.append('since', since);
            if (until) params.append('until', until);
            if (sinceId) params.append('since_id', sinceId);

            const response = await fetch(`${API_URL}/messages?${params.toString()}`, {
                method: "GET",
                headers,
            });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching messages by user:", error);
            throw error;
        }
    };

    return { getChats, getMessages, getMessagesByDialog, getUsers, getDialogs, getMessagesByUser };
};
