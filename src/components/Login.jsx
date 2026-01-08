import React, { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { KeyRound, Globe, ArrowRight, Sparkles } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [endpoint, setEndpoint] = useState('');
    const [token, setToken] = useState('');
    const [isHovered, setIsHovered] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (endpoint && token) {
            onLogin(endpoint, token);
        }
    };

    return (
        <div className="login-container">
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 100 }}>
                <ThemeToggle />
            </div>

            {/* Decorative Elements */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                fontSize: '8rem',
                opacity: 0.03,
                transform: 'rotate(-15deg)',
                pointerEvents: 'none'
            }}>
                <Sparkles />
            </div>

            <div className="glass-card login-card animate-scale">
                {/* Glow effect on hover */}
                <div style={{
                    position: 'absolute',
                    inset: '-2px',
                    borderRadius: 'inherit',
                    background: 'linear-gradient(135deg, #FF6B6B, #A855F7)',
                    opacity: isHovered ? 0.3 : 0,
                    filter: 'blur(20px)',
                    transition: 'opacity 0.5s ease',
                    zIndex: -1
                }} />

                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{
                        background: 'linear-gradient(135deg, #FF6B6B 0%, #A855F7 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        marginBottom: '0.5rem'
                    }}>
                        Simla Automa
                    </h2>
                    <p className="login-subtitle" style={{ opacity: 0.7 }}>
                        Accede a tu panel de control
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="endpoint" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                        }}>
                            <Globe size={14} style={{ color: '#4ECDC4' }} />
                            Endpoint URL
                        </label>
                        <input
                            id="endpoint"
                            type="text"
                            className="form-input"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://api.simla.com..."
                            required
                            style={{
                                paddingLeft: '1rem'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="token" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                        }}>
                            <KeyRound size={14} style={{ color: '#A855F7' }} />
                            API Token
                        </label>
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

                    <button
                        type="submit"
                        className="btn btn-primary"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        style={{
                            marginTop: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem'
                        }}
                    >
                        Iniciar Sesión
                        <ArrowRight size={18} style={{
                            transition: 'transform 0.3s ease',
                            transform: isHovered ? 'translateX(4px)' : 'translateX(0)'
                        }} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
