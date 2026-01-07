import React, { useState } from 'react';
import { Key, Globe } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [endpoint, setEndpoint] = useState(import.meta.env.VITE_ENDPOINT_URL || '');
    const [token, setToken] = useState(import.meta.env.VITE_TOKEN || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (endpoint && token) {
            onLogin(endpoint, token);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>Simla Chat Reader</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>API Endpoint</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="https://your-instance.simla.com"
                                value={endpoint}
                                onChange={(e) => setEndpoint(e.target.value)}
                                required
                            />
                            <Globe size={18} style={{ position: 'absolute', right: 10, top: 12, opacity: 0.5 }} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Bot Token</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password" /* Or text if they prefer visibility */
                                placeholder="Enter your bot token"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                required
                            />
                            <Key size={18} style={{ position: 'absolute', right: 10, top: 12, opacity: 0.5 }} />
                        </div>
                    </div>
                    <button type="submit" className="btn">Connect</button>
                </form>
            </div>
        </div>
    );
};

export default Login;
