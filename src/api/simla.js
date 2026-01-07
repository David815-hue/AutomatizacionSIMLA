export const createClient = (baseUrl, token) => {
    const API_URL = `${baseUrl}/api/bot/v1`;
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

    return { getChats, getMessages };
};
