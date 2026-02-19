import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Badge } from './Badge';
import { Avatar } from './Avatar';

export interface Option {
    value: string;
    label: string;
    avatar?: string;
    subtitle?: string;
}

interface MultiSelectProps {
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    options,
    selected,
    onChange,
    placeholder = "Select...",
    className = ""
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const removeOption = (value: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selected.filter(v => v !== value));
    };

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`min-h-[42px] w-full border rounded-xl bg-white/[0.03] px-3 py-2 text-sm ring-offset-background 
                focus-within:ring-2 focus-within:ring-accent-primary/50 cursor-pointer flex flex-wrap gap-2 items-center
                ${open ? 'border-accent-primary/50' : 'border-border-default'}`}
                onClick={() => setOpen(!open)}
            >
                {selected.length > 0 ? (
                    selected.map(val => {
                        const opt = options.find(o => o.value === val);
                        if (!opt) return null;
                        return (
                            <Badge
                                key={val}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1 pl-2 py-0.5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {opt.label}
                                <button
                                    onClick={(e) => removeOption(val, e)}
                                    className="ml-1 rounded-full p-0.5 hover:bg-white/20 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })
                ) : (
                    <span className="text-text-muted">{placeholder}</span>
                )}
                <div className="ml-auto flex shrink-0 opacity-50">
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </div>

            {open && (
                <div className="absolute z-50 mt-2 w-full rounded-xl border border-border-default bg-[#1a1a24] shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    <div className="p-2 border-b border-border-default/50">
                        <input
                            className="flex h-9 w-full rounded-lg bg-surface-hover px-3 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <p className="p-2 text-sm text-text-muted text-center">No results found.</p>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = selected.includes(opt.value);
                                return (
                                    <div
                                        key={opt.value}
                                        className={`relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm outline-none transition-colors
                                        ${isSelected ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-primary hover:bg-surface-hover'}`}
                                        onClick={() => toggleOption(opt.value)}
                                    >
                                        <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded border
                                            ${isSelected ? 'border-accent-primary bg-accent-primary text-white' : 'border-text-muted/50'}`}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        {opt.avatar && (
                                            <div className="mr-2">
                                                <Avatar name={opt.label} src={opt.avatar} size="sm" />
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span>{opt.label}</span>
                                            {opt.subtitle && (
                                                <span className="text-xs text-text-muted">{opt.subtitle}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
