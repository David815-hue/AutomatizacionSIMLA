import React from 'react';

const MainSelection = ({ onSelect }) => {
    return (
        <div className="selection-container">
            <div className="selection-header">
                <h1>Bienvenido a Simla Automa</h1>
                <p>Selecciona tu espacio de trabajo</p>
            </div>

            <div className="cards-grid">
                <div
                    className="glass-card selection-card"
                    onClick={() => onSelect('chats')}
                >
                    <div className="card-icon">💬</div>
                    <h3>Ver Chats</h3>
                    <p>Supervisa, gestiona y analiza las conversaciones en tiempo real.</p>
                    <div className="card-arrow">➝</div>
                </div>

                <div
                    className="glass-card selection-card"
                    onClick={() => onSelect('evaluation')}
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
