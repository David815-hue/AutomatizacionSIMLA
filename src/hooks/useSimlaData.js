import { useQuery } from '@tanstack/react-query';

// Custom hook for loading chats with date filtering
export const useChats = (client, dateFrom, dateTo) => {
    const hasDateFilter = dateFrom && dateTo;

    return useQuery({
        queryKey: ['chats', dateFrom, dateTo],
        queryFn: async () => {
            if (!client) return [];

            const chatMap = new Map();

            if (!hasDateFilter) {
                // No date filter: simple load
                const data = await client.getChats(300, 0);
                if (Array.isArray(data)) {
                    data.forEach(chat => chatMap.set(chat.id, chat));
                }
            } else {
                // With date filter: paginated load
                let offset = 0;
                const limit = 100;
                let stop = false;
                const MAX_PAGES = 50;
                let pages = 0;

                const isDateInRange = (dateStr) => {
                    if (!dateStr) return false;
                    const date = new Date(dateStr);
                    const start = new Date(dateFrom);
                    const end = new Date(dateTo);

                    end.setHours(23, 59, 59, 999);
                    start.setHours(0, 0, 0, 0);

                    if (date < start) return -1;
                    if (date > end) return 1;
                    return 0;
                };

                while (!stop && pages < MAX_PAGES) {
                    const data = await client.getChats(limit, offset);

                    if (!Array.isArray(data) || data.length === 0) {
                        stop = true;
                        break;
                    }

                    let chatsInRange = 0;
                    let chatsOlder = 0;

                    for (const chat of data) {
                        const dateStr = chat.last_message?.created_at || chat.created_at;
                        const comparison = isDateInRange(dateStr);

                        if (comparison === 0) {
                            // Chat is in range
                            if (!chatMap.has(chat.id)) {
                                chatMap.set(chat.id, chat);
                            }
                            chatsInRange++;
                        } else if (comparison === -1) {
                            // Chat is older than range
                            chatsOlder++;
                        }
                        // comparison === 1 (future) -> just skip
                    }

                    // Only stop if we got a page but NO chats are in our date range
                    // and ALL chats are older (meaning we've passed our date range completely)
                    if (chatsInRange === 0 && chatsOlder === data.length) {
                        stop = true;
                    }

                    // Also stop if we got less than a full page
                    if (data.length < limit) {
                        stop = true;
                    }

                    offset += limit;
                    pages++;
                }
            }

            return Array.from(chatMap.values());
        },
        enabled: !!client, // Only run when client exists
        staleTime: 30 * 1000, // 30 seconds for chats (they change frequently)
        refetchInterval: 60 * 1000, // Auto-refresh every minute in background
    });
};

// Custom hook for loading messages of a specific chat
export const useMessages = (client, chatId) => {
    return useQuery({
        queryKey: ['messages', chatId],
        queryFn: async () => {
            if (!client || !chatId) return [];
            const data = await client.getMessages(chatId, 100);
            return Array.isArray(data) ? data : [];
        },
        enabled: !!client && !!chatId,
        staleTime: 2 * 60 * 1000, // 2 minutes for messages
    });
};

// Custom hook for loading managers
export const useManagers = (client, chats) => {
    return useQuery({
        queryKey: ['managers'],
        queryFn: async () => {
            if (!chats || chats.length === 0) return [];

            const managersSet = new Set();
            chats.forEach((chat) => {
                const responsible = chat.last_dialog?.responsible;
                if (responsible?.id && responsible?.name) {
                    managersSet.add(JSON.stringify(responsible));
                }
            });

            return Array.from(managersSet).map((str) => JSON.parse(str));
        },
        enabled: !!client && !!chats && chats.length > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes - managers don't change often
    });
};
