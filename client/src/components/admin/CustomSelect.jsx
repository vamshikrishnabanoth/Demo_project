import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = 'Select',
    ariaLabel,
    disabled = false,
    className = '',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    const selectedOption = options.find((opt) => String(opt.value) === String(value)) || {
        value: '',
        label: placeholder,
    };

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
            if (options.length === 0) return;
            const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (currentIndex + direction + options.length) % options.length;
            onChange(options[nextIndex].value);
            setIsOpen(true);
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled) setIsOpen((prev) => !prev);
        }
    };

    return (
        <div ref={ref} className={`relative ${className || 'w-full'}`}>
            <button
                type="button"
                disabled={disabled}
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                onKeyDown={handleKeyDown}
                className="flex w-full min-h-[42px] items-center justify-between gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-800 shadow-xs transition-all duration-200 hover:border-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:opacity-40 disabled:bg-slate-50 cursor-pointer"
            >
                <span className="truncate">{selectedOption.label}</span>
                <ChevronDown
                    className={`h-4 w-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">
                    <ul role="listbox" aria-label={ariaLabel} className="space-y-1">
                        {options.map((option) => {
                            const isSelected = String(option.value) === String(value);
                            return (
                                <li key={String(option.value)}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                                            isSelected
                                                ? 'bg-gradient-to-r from-[#ea580c] to-[#2e7d32] text-white shadow-xs'
                                                : 'text-slate-800 hover:bg-orange-50 hover:text-[#c2410c]'
                                        }`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {isSelected && (
                                            <svg
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                className="h-4 w-4 shrink-0 text-white"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M5 10.5L8.2 13.7L15 6.9"
                                                    stroke="currentColor"
                                                    strokeWidth="2.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
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
