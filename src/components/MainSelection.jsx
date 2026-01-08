import React from 'react';
import ThemeToggle from './ThemeToggle';
import { MessageCircle, BarChart3, ArrowRight, Sparkles } from 'lucide-react';

const MainSelection = ({ onSelect }) => {
    return (
        <div className="selection-container">
            {/* Decorative floating elements */}
            <div style={{
                position: 'absolute',
                top: '10%',
                right: '15%',
                opacity: 0.15,
                color: '#4ECDC4',
                animation: 'floatBlob 8s ease-in-out infinite'
            }}>
                <Sparkles size={80} />
            </div>

            <div className="selection-header">
                <h1 className="animate-scale" style={{ animationDelay: '0.1s' }}>
                    Bienvenido a<br />
                    <span style={{
                        background: 'linear-gradient(135deg, #4ECDC4 0%, #FFE66D 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Simla Automa
                    </span>
                </h1>
                <p className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    Selecciona tu espacio de trabajo
                </p>
                <div style={{ marginTop: '1.5rem' }} className="animate-slide-up" >
                    <ThemeToggle />
                </div>
            </div>

            <div className="cards-grid">
                <div
                    className="glass-card selection-card animate-slide-in"
                    onClick={() => onSelect('chats')}
                    style={{ animationDelay: '0.3s' }}
                >
                    <div className="card-icon" style={{
                        background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.3) 0%, rgba(78, 205, 196, 0.05) 100%)'
                    }}>
                        <MessageCircle size={32} style={{ color: '#4ECDC4' }} />
                    </div>
                    <h3>Ver Chats</h3>
                    <p>Supervisa, gestiona y analiza las conversaciones en tiempo real con tus clientes.</p>
                    <div className="card-arrow" style={{ color: '#4ECDC4' }}>
                        <ArrowRight size={24} />
                    </div>
                </div>

                <div
                    className="glass-card selection-card animate-slide-in"
                    onClick={() => onSelect('evaluation')}
                    style={{ animationDelay: '0.4s' }}
                >
                    <div className="card-icon" style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0.05) 100%)'
                    }}>
                        <BarChart3 size={32} style={{ color: '#A855F7' }} />
                    </div>
                    <h3>Evaluar Gestor IA</h3>
                    <p>Audita el desempeño y califica la calidad de las respuestas automáticas.</p>
                    <div className="card-arrow" style={{ color: '#A855F7' }}>
                        <ArrowRight size={24} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainSelection;
