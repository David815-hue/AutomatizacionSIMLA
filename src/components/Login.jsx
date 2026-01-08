import React, { useState } from 'react';
import ThemeToggle from './ThemeToggle';

const Login = ({ onLogin }) => {
    const [endpoint, setEndpoint] = useState('');
    const [token, setToken] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (endpoint && token) {
            onLogin(endpoint, token);
        }
    };

    return (
        <div className="login-container">
            <div style={{ position: 'absolute', top: '2rem', right: '2rem' }}>
                <ThemeToggle />
            </div>
            <div className="glass-card login-card animate-scale">
                <h2 style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
                    Simla Automa
                </h2>
                <p className="login-subtitle">Accede a tu panel de control</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="endpoint">Endpoint URL</label>
                        <input
                            id="endpoint"
                            type="text"
                            className="form-input"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://api.simla.com..."
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="token">API Token</label>
                        <input
                            id="token"
                            type="password"
                            className="form-input"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Ingresa tu token de acceso"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary">
                        Iniciar Sesión
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
