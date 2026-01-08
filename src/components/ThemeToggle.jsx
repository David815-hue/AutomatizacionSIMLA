import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '', style = {} }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`theme-toggle ${className}`}
            style={style}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
        >
            {theme === 'light' ? (
                <Moon size={20} className="theme-icon" />
            ) : (
                <Sun size={20} className="theme-icon" />
            )}
        </button>
    );
};

export default ThemeToggle;
