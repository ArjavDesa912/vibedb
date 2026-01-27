import React, { useState } from 'react';
import { Search, Database, Type, Hash, Calendar, MoreHorizontal, FunctionSquare, Plus, X } from 'lucide-react';

export default function DataSidebar({ tables, selectedTable, onSelectTable, onDragStart }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [customFields, setCustomFields] = useState([]);

    // Modal State
    const [showCalcModal, setShowCalcModal] = useState(false);
    const [calcName, setCalcName] = useState('');
    const [calcFormula, setCalcFormula] = useState('');

    const activeTable = tables.find(t => t.name === selectedTable);

    const dims = activeTable?.columns.filter(c => ['TEXT', 'VARCHAR', 'DATE', 'DATETIME'].some(t => c.col_type.includes(t))) || [];
    const measures = activeTable?.columns.filter(c => ['INTEGER', 'REAL', 'NUMERIC', 'DECIMAL'].some(t => c.col_type.includes(t))) || [];

    const filteredDims = dims.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredMeasures = [...measures, ...customFields].filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const openCalcModal = () => {
        setCalcName('');
        setCalcFormula('');
        setShowCalcModal(true);
    };

    const saveCalculation = () => {
        if (!calcName.trim() || !calcFormula.trim()) return;
        setCustomFields([...customFields, { name: calcName, col_type: 'REAL (Calc)', isCustom: true, formula: calcFormula }]);
        setShowCalcModal(false);
    };

    return (
        <div className="w-64 bg-[#1e1e1e] border-r border-gray-700 flex flex-col h-full relative">
            {/* Table Selector */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <Database className="w-3 h-3" /> Data Source
                </div>
                <select
                    value={selectedTable || ''}
                    onChange={(e) => onSelectTable(e.target.value)}
                    className="w-full bg-[#252526] border border-gray-600 text-gray-200 text-sm rounded px-2 py-1.5 outline-none focus:border-blue-500"
                >
                    <option value="" disabled>Select a table</option>
                    {tables.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-700 bg-[#252526]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
                    <input
                        className="w-full bg-[#1e1e1e] border border-gray-600 rounded pl-8 pr-2 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500 placeholder:text-gray-600"
                        placeholder="Search fields..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Fields List */}
            <div className="flex-1 overflow-auto p-2 space-y-4">
                {selectedTable && (
                    <>
                        <div>
                            <div className="px-2 mb-1 text-[10px] font-bold text-gray-500 uppercase flex justify-between items-center">
                                <span>Dimensions</span>
                                <span className="text-blue-500">{filteredDims.length}</span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredDims.map(col => (
                                    <div
                                        key={col.name}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, { ...col, type: 'dim' })}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2d2d2d] group cursor-grab active:cursor-grabbing text-sm text-gray-300"
                                    >
                                        {col.col_type.includes('DATE') ? <Calendar className="w-3.5 h-3.5 text-blue-400" /> : <Type className="w-3.5 h-3.5 text-blue-400" />}
                                        <span className="truncate">{col.name}</span>
                                        <button className="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-gray-500">
                                            <MoreHorizontal className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="px-2 mb-1 text-[10px] font-bold text-gray-500 uppercase flex justify-between items-center">
                                <span>Measures</span>
                                <span className="text-green-500">{filteredMeasures.length}</span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredMeasures.map(col => (
                                    <div
                                        key={col.name}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, { ...col, type: 'measure' })}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2d2d2d] group cursor-grab active:cursor-grabbing text-sm text-gray-300"
                                    >
                                        {col.isCustom ? <FunctionSquare className="w-3.5 h-3.5 text-purple-400" /> : <Hash className="w-3.5 h-3.5 text-green-400" />}
                                        <span className={`truncate ${col.isCustom ? 'italic text-purple-200' : ''}`}>{col.name}</span>
                                        <button className="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-gray-500">
                                            <MoreHorizontal className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={openCalcModal}
                            className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white py-2 border border-dashed border-gray-700 hover:border-gray-500 rounded transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Create Calculated Field
                        </button>
                    </>
                )}
            </div>

            {/* Calculation Dialog Modal */}
            {showCalcModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[#252526] border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center bg-[#1e1e1e]">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <FunctionSquare className="w-4 h-4 text-purple-400" /> Create Calculated Field
                            </h3>
                            <button onClick={() => setShowCalcModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Field Name</label>
                                <input
                                    value={calcName}
                                    onChange={e => setCalcName(e.target.value)}
                                    placeholder="e.g., Profit Ratio"
                                    className="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-purple-500 placeholder:text-gray-600 transition-colors"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Formula (LOD Expression)</label>
                                <textarea
                                    value={calcFormula}
                                    onChange={e => setCalcFormula(e.target.value)}
                                    placeholder="{FIXED [Region]: SUM([Sales])}"
                                    className="w-full h-32 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm outline-none focus:border-purple-500 placeholder:text-gray-600 resize-none transition-colors"
                                    spellCheck={false}
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Supported functions: FIXED, INCLUDE, EXCLUDE, SUM, AVG, COUNT, MIN, MAX...
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-[#1e1e1e] border-t border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => setShowCalcModal(false)}
                                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveCalculation}
                                disabled={!calcName.trim() || !calcFormula.trim()}
                                className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create Field
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
