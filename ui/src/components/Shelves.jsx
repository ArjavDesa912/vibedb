import React from 'react';
import { X } from 'lucide-react';

const ShelfRow = ({ label, items, onDrop, onRemove }) => {
    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    return (
        <div className="flex items-center h-10 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
            <div className="w-24 px-3 flex items-center text-xs font-semibold text-gray-500 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] h-full select-none">
                {label}
            </div>
            <div
                className="flex-1 flex items-center px-2 gap-2 h-full overflow-x-auto custom-scrollbar shelf-area"
                onDrop={onDrop}
                onDragOver={handleDragOver}
            >
                {items.length === 0 && (
                    <span className="text-[10px] text-gray-700 italic pointer-events-none select-none">Drop here</span>
                )}

                {items.map(field => (
                    <div
                        key={field.name}
                        className={`pill ${field.type === 'dimension' ? 'pill-dimension' : 'pill-measure'}`}
                    >
                        <span>{field.name}</span>
                        <button
                            onClick={() => onRemove(field.name)}
                            className="hover:bg-black/20 rounded-full p-0.5"
                        >
                            <X className="w-2 h-2" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function Shelves({ config, onUpdateConfig }) {

    const handleDrop = (e, shelfName) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('field');
        if (!data) return;

        const field = JSON.parse(data);
        const currentShelf = config[shelfName] || [];

        if (currentShelf.find(f => f.name === field.name)) return;

        onUpdateConfig(shelfName, [...currentShelf, field]);
    };

    const removeField = (shelfName, fieldName) => {
        const currentShelf = config[shelfName] || [];
        onUpdateConfig(shelfName, currentShelf.filter(f => f.name !== fieldName));
    };

    return (
        <div className="flex flex-col border-b border-[var(--border-strong)] z-10">
            <ShelfRow
                label="Columns"
                items={config.columns || []}
                onDrop={(e) => handleDrop(e, 'columns')}
                onRemove={(name) => removeField('columns', name)}
            />
            <ShelfRow
                label="Rows"
                items={config.rows || []}
                onDrop={(e) => handleDrop(e, 'rows')}
                onRemove={(name) => removeField('rows', name)}
            />
        </div>
    );
}
