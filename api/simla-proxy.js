// Vercel Serverless Function - Proxy for Simla API to avoid CORS
export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Bot-Token'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { endpoint, token } = req.query;

        if (!endpoint || !token) {
            return res.status(400).json({ error: 'Missing endpoint or token' });
        }

        // Get the path from query (e.g., /chats, /messages)
        const { path, ...otherParams } = req.query;
        delete otherParams.endpoint;
        delete otherParams.token;

        // Build URL with remaining query params
        const queryString = new URLSearchParams(otherParams).toString();
        const url = `${endpoint}/api/bot/v1${path || ''}${queryString ? '?' + queryString : ''}`;

        // Forward the request
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'X-Bot-Token': token,
                'Content-Type': 'application/json',
            },
            body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
}
