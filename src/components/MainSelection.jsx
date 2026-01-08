import React from 'react';
import ThemeToggle from './ThemeToggle';

const MainSelection = ({ onSelect }) => {
    return (
        <div className="selection-container">
            <div className="selection-header">
                <h1 className="animate-scale">Bienvenido a Simla Automa</h1>
                <p className="animate-slide-up">Selecciona tu espacio de trabajo</p>
                <div style={{ marginTop: '1.5rem' }}>
                    <ThemeToggle />
                </div>
            </div>

            <div className="cards-grid">
                <div
                    className="glass-card selection-card animate-slide-in"
                    onClick={() => onSelect('chats')}
                    style={{ animationDelay: '0.1s' }}
                >
                    <div className="card-icon">💬</div>
                    <h3>Ver Chats</h3>
                    <p>Supervisa, gestiona y analiza las conversaciones en tiempo real.</p>
                    <div className="card-arrow">➝</div>
                </div>

                <div
                    className="glass-card selection-card animate-slide-in"
                    onClick={() => onSelect('evaluation')}
                    style={{ animationDelay: '0.2s' }}
                >
                    <div className="card-icon">📊</div>
                    <h3>Evaluar Gestor IA</h3>
                    <p>Audita el desempeño y califica la calidad de las respuestas.</p>
                    <div className="card-arrow">➝</div>
                </div>
            </div>
        </div>
    );
};

export default MainSelection;
