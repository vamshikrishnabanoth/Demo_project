import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Skeleton({ className = '' }) {
    return <div className={`ws-skeleton ${className}`} />;
}

export function CustomSelect({ value, onChange, options, placeholder = 'Select', ariaLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    const selectedOption = options.find((option) => option.value === value) || { value: '', label: placeholder };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const currentIndex = options.findIndex((option) => option.value === value);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (currentIndex + direction + options.length) % options.length;
            onChange(options[nextIndex].value);
            setIsOpen(true);
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((prev) => !prev);
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((prev) => !prev)}
                onKeyDown={handleKeyDown}
                className="ws-select-trigger"
            >
                <span className="truncate">{selectedOption.label}</span>
                <ChevronDown className={`h-4 w-4 text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="ws-select-menu">
                    <ul role="listbox" aria-label={ariaLabel} className="py-1.5">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <li key={option.value || 'empty'} className="px-1.5">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`ws-select-option ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && (
                                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                                <path d="M5 10.5L8.2 13.7L15 6.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

export function StatusBadge({ suspended, online }) {
    if (suspended) {
        return (
            <span className="ws-badge bg-rose-50 text-rose-800 border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                Suspended
            </span>
        );
    }
    if (online) {
        return (
            <span className="ws-badge bg-emerald-50 text-emerald-800 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Online
            </span>
        );
    }
    return (
        <span className="ws-badge">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Offline
        </span>
    );
}

export function RoleBadge({ role }) {
    const labels = {
        student: 'Student',
        teacher: 'Teacher',
        admin: 'Admin',
        none: 'None',
    };
    return <span className="ws-badge">{labels[role] || labels.none}</span>;
}

export function FilterSearch({ value, onChange, placeholder = 'Search...' }) {
    return (
        <div className="flex-1 min-w-56 relative">
            <input
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="ws-input pl-9 pr-4"
            />
        </div>
    );
}
