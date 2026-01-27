import React, { useState, useEffect, useRef } from 'react';
import { AggregationBuilder, PerformanceMonitor, GitControl } from './AdvancedFeatures';
import { DataPrepFlow, SchemaAnalysis, RecycleBin, CloudAuth, SemanticLayer, VizQLServicePanel } from './MoreAdvancedFeatures';
import { Database, Plus, Trash2, Edit2, Save, X, Table, Key, Type, AlertCircle, Upload, FileSpreadsheet, FileText, CheckCircle, Loader2, RefreshCw, Layout, GitBranch, Share2, Layers, Activity, Workflow, BarChart2, Cloud, History } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

const COLUMN_TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC'];

export default function SchemaManager({ tables, onRefresh }) {
    // View State
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'diagram' | 'sync' | 'import' | 'create' | 'details' | 'data' | 'nosql' | 'monitor' | 'git' | 'prep' | 'profile' | 'recycle' | 'auth' | 'semantic' | 'vizql'
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableDetails, setTableDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Create Table State
    const [newTableName, setNewTableName] = useState('');
    const [newColumns, setNewColumns] = useState([{ name: 'id', type: 'INTEGER', pk: true, notNull: true }]);

    // Add Column State
    const [addColumnName, setAddColumnName] = useState('');
    const [addColumnType, setAddColumnType] = useState('TEXT');

    // Import State
    const [importFile, setImportFile] = useState(null);
    const [importTableName, setImportTableName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Diagram State
    const [nodePositions, setNodePositions] = useState({});
    const dragItem = useRef(null);
    const svgRef = useRef(null);

    // Data View State
    const [tableData, setTableData] = useState([]);
    const [editingCell, setEditingCell] = useState(null); // { rowId, colName, value }

    // --- Effects ---
    useEffect(() => {
        if (selectedTable && viewMode === 'details') {
            fetchTableDetails(selectedTable);
        }
        if (selectedTable && viewMode === 'data') {
            fetchTableData(selectedTable);
        }
    }, [selectedTable, viewMode]);

    // Diagram Layout Init
    useEffect(() => {
        if (viewMode === 'diagram' && tables.length) {
            const newPos = {};
            const centerX = 400;
            const centerY = 300;
            const radius = 250;

            tables.forEach((t, i) => {
                if (nodePositions[t.name]) {
                    newPos[t.name] = nodePositions[t.name];
                    return;
                }
                const angle = (i / tables.length) * 2 * Math.PI;
                newPos[t.name] = {
                    x: centerX + radius * Math.cos(angle) - 100,
                    y: centerY + radius * Math.sin(angle) - 75
                };
            });
            setNodePositions(prev => ({ ...prev, ...newPos }));
        }
    }, [viewMode, tables]);

    // --- API Interactions ---

    const fetchTableDetails = async (tableName) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_Base}/v1/tables/${tableName}`);
            const json = await res.json();
            if (json.success) setTableDetails(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTableData = async (tableName) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_Base}/v1/query/${tableName}?limit=100`);
            const json = await res.json();
            if (json.success) setTableData(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTable = async () => {
        if (!newTableName) return setError("Table name is required");
        if (newColumns.length === 0) return setError("At least one column is required");
        setLoading(true);
        setError(null);
        try {
            const colDefs = newColumns.map(c =>
                `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${!c.pk && c.notNull ? ' NOT NULL' : ''}`
            ).join(', ');
            const sql = `CREATE TABLE ${newTableName} (${colDefs})`;
            const res = await fetch(`${API_Base}/v1/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql })
            });
            const json = await res.json();
            if (json.success) {
                onRefresh();
                setViewMode('list');
                setNewTableName('');
                setNewColumns([{ name: 'id', type: 'INTEGER', pk: true, notNull: true }]);
            } else {
                setError(json.message || "Failed to create table");
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDropTable = async (tableName) => {
        if (!confirm(`Are you sure you want to DROP table '${tableName}'? This cannot be undone.`)) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_Base}/v1/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `DROP TABLE ${tableName}` })
            });
            if (res.ok) {
                onRefresh();
                if (selectedTable === tableName) {
                    setSelectedTable(null);
                    setTableDetails(null);
                    setViewMode('list');
                }
            }
        } catch (e) {
            alert("Failed to drop table");
        } finally {
            setLoading(false);
        }
    };

    const handleAddColumn = async () => {
        if (!addColumnName) return;
        setLoading(true);
        try {
            const sql = `ALTER TABLE ${selectedTable} ADD COLUMN ${addColumnName} ${addColumnType}`;
            const res = await fetch(`${API_Base}/v1/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql })
            });
            if (res.ok) {
                fetchTableDetails(selectedTable);
                setAddColumnName('');
                onRefresh();
            } else {
                alert("Failed to add column");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCell = async (id, col, val) => {
        const oldData = [...tableData];
        setTableData(prev => prev.map(r => r.id === id ? { ...r, [col]: val } : r));
        setEditingCell(null);
        try {
            const isNum = !isNaN(parseFloat(val)) && isFinite(val);
            const sqlValue = isNum ? val : `'${val.replace(/'/g, "''")}'`;
            const sql = `UPDATE ${selectedTable} SET ${col} = ${sqlValue} WHERE id = ${id}`;
            const res = await fetch(`${API_Base}/v1/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql })
            });
            if (!res.ok) throw new Error("Update failed");
        } catch (e) {
            console.error(e);
            setError("Failed to update cell. Ensure table has 'id' column.");
            setTableData(oldData);
        }
    };

    const handleImport = async () => {
        if (!importFile || !importTableName) return;
        setUploading(true);
        setUploadProgress(10);
        setError(null);
        try {
            const fileExt = importFile.name.split('.').pop().toLowerCase();
            let data = [];
            if (fileExt === 'csv') {
                await new Promise((resolve, reject) => {
                    Papa.parse(importFile, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: (results) => { data = results.data; resolve(); },
                        error: (err) => reject(err)
                    });
                });
            } else if (['xlsx', 'xls'].includes(fileExt)) {
                const buffer = await importFile.arrayBuffer();
                const workbook = XLSX.read(buffer);
                const sheetName = workbook.SheetNames[0];
                data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            } else {
                throw new Error("Unsupported format");
            }
            setUploadProgress(40);
            const cleanData = data.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                    if (cleanKey) newRow[cleanKey] = row[key];
                });
                return newRow;
            });
            if (cleanData.length === 0) throw new Error("No data");
            const BATCH_SIZE = 500;
            const totalBatches = Math.ceil(cleanData.length / BATCH_SIZE);
            for (let i = 0; i < totalBatches; i++) {
                const batch = cleanData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                const res = await fetch(`${API_Base}/v1/push/${importTableName}/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: batch })
                });
                if (!res.ok) throw new Error("Batch upload failed");
                setUploadProgress(40 + Math.floor(((i + 1) / totalBatches) * 60));
            }
            setUploadProgress(100);
            setTimeout(() => {
                setImportFile(null);
                setImportTableName("");
                setUploading(false);
                setUploadProgress(0);
                onRefresh();
                setViewMode('list');
            }, 1000);
        } catch (err) {
            setError(err.message);
            setUploading(false);
        }
    };

    // --- Helper Functions ---
    const addColumnRow = () => setNewColumns([...newColumns, { name: '', type: 'TEXT', pk: false, notNull: false }]);
    const updateColumnRow = (idx, field, value) => {
        const updated = [...newColumns];
        updated[idx][field] = value;
        setNewColumns(updated);
    };
    const removeColumnRow = (idx) => setNewColumns(newColumns.filter((_, i) => i !== idx));

    const handleMouseDown = (e, tableName) => {
        dragItem.current = { name: tableName, startX: e.clientX, startY: e.clientY, startPos: { ...nodePositions[tableName] } };
    };
    const handleMouseMove = (e) => {
        if (dragItem.current) {
            const dx = e.clientX - dragItem.current.startX;
            const dy = e.clientY - dragItem.current.startY;
            setNodePositions(prev => ({
                ...prev,
                [dragItem.current.name]: {
                    x: dragItem.current.startPos.x + dx,
                    y: dragItem.current.startPos.y + dy
                }
            }));
        }
    };
    const handleMouseUp = () => { dragItem.current = null; };

    const renderConnections = () => {
        const connections = [];
        tables.forEach(t1 => {
            t1.columns?.forEach(c1 => {
                if (c1.name.endsWith('_id')) {
                    const targetName = c1.name.replace('_id', 's');
                    const t2 = tables.find(t => t.name === targetName || t.name === c1.name.replace('_id', ''));
                    if (t2 && nodePositions[t1.name] && nodePositions[t2.name]) {
                        const start = nodePositions[t1.name];
                        const end = nodePositions[t2.name];
                        connections.push(
                            <line
                                key={`${t1.name}-${t2.name}`}
                                x1={start.x + 100} y1={start.y + 75}
                                x2={end.x + 100} y2={end.y + 75}
                                stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="5,5"
                            />
                        );
                    }
                }
            });
        });
        return connections;
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-[#252526]">
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <span className="font-bold text-white flex items-center gap-2 whitespace-nowrap">
                        <Database className="w-4 h-4 text-orange-400" /> Schema Manager
                    </span>
                    <div className="flex bg-[#1e1e1e] rounded p-0.5 border border-gray-700 whitespace-nowrap">
                        {['list', 'diagram', 'data', 'sync', 'import', 'create'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                disabled={mode === 'data' && !selectedTable}
                                className={`px-3 py-1 text-xs font-medium rounded capitalize flex items-center gap-1.5 transition-colors ${viewMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                            >
                                {mode === 'list' && <Table className="w-3 h-3" />}
                                {mode === 'diagram' && <Layout className="w-3 h-3" />}
                                {mode === 'data' && <FileText className="w-3 h-3" />}
                                {mode === 'sync' && <Share2 className="w-3 h-3" />}
                                {mode === 'import' && <Upload className="w-3 h-3" />}
                                {mode === 'create' && <Plus className="w-3 h-3" />}
                                {mode}
                            </button>
                        ))}
                        <div className="w-px h-4 bg-gray-700 mx-1 self-center"></div>
                        {['nosql', 'monitor', 'git', 'prep', 'semantic', 'vizql'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1 text-xs font-medium rounded capitalize flex items-center gap-1.5 transition-colors ${viewMode === mode ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {mode === 'nosql' && <Layers className="w-3 h-3" />}
                                {mode === 'monitor' && <Activity className="w-3 h-3" />}
                                {mode === 'git' && <GitBranch className="w-3 h-3" />}
                                {mode === 'prep' && <Workflow className="w-3 h-3" />}
                                {mode === 'semantic' && <Database className="w-3 h-3" />}
                                {mode === 'vizql' && <Cloud className="w-3 h-3" />}
                                {mode === 'semantic' ? 'Semantic' : mode === 'vizql' ? 'VizQL' : mode}
                            </button>
                        ))}
                        <div className="w-px h-4 bg-gray-700 mx-1 self-center"></div>
                        <button onClick={() => setViewMode('profile')} className={`p-1.5 rounded ${viewMode === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Schema Profile">
                            <BarChart2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('recycle')} className={`p-1.5 rounded ${viewMode === 'recycle' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Recycle Bin">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('auth')} className={`p-1.5 rounded ${viewMode === 'auth' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Cloud Auth">
                            <Cloud className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedTable && <span className="text-xs text-gray-500 bg-black/20 px-2 py-1 rounded hidden md:inline">Active: <span className="text-blue-400 font-bold">{selectedTable}</span></span>}
                    <button onClick={onRefresh} className="p-1.5 hover:bg-white/10 rounded text-gray-400">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

                {viewMode === 'nosql' && <AggregationBuilder />}
                {viewMode === 'monitor' && <PerformanceMonitor />}
                {viewMode === 'git' && <GitControl />}
                {viewMode === 'prep' && <DataPrepFlow />}
                {viewMode === 'semantic' && <SemanticLayer />}
                {viewMode === 'vizql' && <VizQLServicePanel />}
                {viewMode === 'profile' && <SchemaAnalysis items={tables.length > 0 ? tables[0].columns : []} />}
                {viewMode === 'recycle' && <RecycleBin />}
                {viewMode === 'auth' && <CloudAuth />}

                {/* List View */}
                {viewMode === 'list' && (
                    <div className="h-full overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tables.map(table => (
                            <div key={table.name} className="bg-[#2d2d2d] border border-gray-700 rounded-lg overflow-hidden group hover:border-gray-500 transition-colors shadow-lg">
                                <div className="px-4 py-3 bg-[#333] border-b border-gray-700 flex justify-between items-center cursor-pointer" onClick={() => { setSelectedTable(table.name); setViewMode('details'); }}>
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <Table className="w-4 h-4 text-blue-400" /> {table.name}
                                    </h3>
                                    <span className="text-xs bg-black/30 px-2 py-0.5 rounded text-gray-400">{table.columns?.length || 0} cols</span>
                                </div>
                                <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar">
                                    {table.columns?.slice(0, 6).map(col => (
                                        <div key={col.name} className="flex justify-between text-xs py-1 border-b border-gray-800 last:border-0">
                                            <span className="text-gray-300 font-mono">{col.name}</span>
                                            <span className="text-gray-500 uppercase text-[10px]">{col.col_type}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-2 bg-[#252526] border-t border-gray-800 flex justify-end">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedTable(table.name); setViewMode('data'); }}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                        <FileText className="w-3 h-3" /> View Data
                                    </button>
                                </div>
                            </div>
                        ))}
                        {tables.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-500">
                                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                                <p>No tables found in database</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Diagram View */}
                {viewMode === 'diagram' && (
                    <div className="w-full h-full relative bg-[#1a1a1a] overflow-hidden cursor-move">
                        <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            {renderConnections()}
                        </svg>
                        {tables.map(table => {
                            const pos = nodePositions[table.name] || { x: 50, y: 50 };
                            return (
                                <div
                                    key={table.name}
                                    style={{ left: pos.x, top: pos.y }}
                                    onMouseDown={(e) => handleMouseDown(e, table.name)}
                                    className="absolute w-48 bg-[#252526] border border-gray-600 rounded shadow-2xl z-10 select-none cursor-pointer hover:border-blue-500"
                                >
                                    <div className="bg-[#333] px-3 py-2 border-b border-gray-600 font-bold text-xs text-white flex items-center gap-2">
                                        <Database className="w-3 h-3 text-purple-400" /> {table.name}
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {table.columns?.slice(0, 5).map(c => (
                                            <div key={c.name} className="flex justify-between text-[10px]">
                                                <span className={`${c.name === 'id' ? 'font-bold text-yellow-500' : 'text-gray-300'}`}>{c.name}</span>
                                                <span className="text-gray-600">{c.col_type}</span>
                                            </div>
                                        ))}
                                        {(table.columns?.length || 0) > 5 && (
                                            <div className="text-[10px] text-gray-500 italic text-center pt-1">
                                                + {(table.columns?.length || 0) - 5} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Sync View */}
                {viewMode === 'sync' && (
                    <div className="h-full p-8 flex flex-col items-center justify-center text-center">
                        <div className="max-w-2xl w-full bg-[#252526] border border-gray-700 rounded-lg p-8">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <GitBranch className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Schema Diff & Sync</h2>
                            <p className="text-gray-400 mb-8">Compare your local database schema with production or staging environments.</p>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div className="p-4 border border-dashed border-gray-700 rounded bg-[#1e1e1e]">
                                    <h4 className="font-semibold text-green-400 mb-2">Local (Current)</h4>
                                    <p className="text-2xl font-mono">{tables.length} Tables</p>
                                    <p className="text-xs text-gray-500 mt-1">Updated Just Now</p>
                                </div>
                                <div className="p-4 border border-dashed border-gray-700 rounded bg-[#1e1e1e] relative overflow-hidden">
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <span className="text-xs uppercase font-bold tracking-widest text-gray-500 rotate-12 border border-gray-500 px-2 py-1 rounded">Not Connected</span>
                                    </div>
                                    <h4 className="font-semibold text-blue-400 mb-2">Remote (Production)</h4>
                                    <p className="text-2xl font-mono">-- Tables</p>
                                    <p className="text-xs text-gray-500">Last Sync: Never</p>
                                </div>
                            </div>

                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium flex items-center gap-2 mx-auto transition-colors">
                                <Share2 className="w-4 h-4" /> Connect Remote DB
                            </button>
                        </div>
                    </div>
                )}

                {/* Import View */}
                {viewMode === 'import' && (
                    <div className="h-full flex flex-col items-center justify-center p-8">
                        <div className="bg-[#252526] border border-gray-700 rounded-lg p-8 max-w-md w-full shadow-2xl">
                            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-green-500" /> Import Data
                            </h2>
                            <p className="text-sm text-gray-400 mb-6">Upload CSV or Excel files to create new tables.</p>

                            {error && (
                                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}

                            <label className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${importFile ? 'border-green-500/50 bg-green-500/5' : 'border-gray-600 hover:border-gray-500 hover:bg-white/5'}`}>
                                <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setImportFile(file);
                                        setImportTableName(file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
                                        setError(null);
                                    }
                                }} className="hidden" />
                                {importFile ? (
                                    <div className="flex flex-col items-center text-green-400">
                                        <CheckCircle className="w-8 h-8 mb-2" />
                                        <span className="font-medium truncate max-w-xs">{importFile.name}</span>
                                        <span className="text-xs opacity-70">{(importFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Upload className="w-8 h-8 mb-2" />
                                        <span className="font-medium">Click to upload</span>
                                        <span className="text-xs mt-1">CSV or Excel</span>
                                    </div>
                                )}
                            </label>

                            {importFile && (
                                <div className="mt-6 space-y-4 animate-slide-in">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Target Table Name</label>
                                        <input
                                            type="text"
                                            value={importTableName}
                                            onChange={e => setImportTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase())}
                                            className="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                            placeholder="e.g., my_new_table"
                                        />
                                    </div>
                                    {uploading ? (
                                        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
                                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleImport}
                                            disabled={!importFile || !importTableName || uploading}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Start Import
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Create View */}
                {viewMode === 'create' && (
                    <div className="max-w-2xl mx-auto m-8 bg-[#252526] border border-gray-700 rounded-lg p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-400" /> Create New Table
                        </h2>
                        {error && (
                            <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded mb-4 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Table Name</label>
                            <input
                                type="text"
                                value={newTableName}
                                onChange={e => setNewTableName(e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                placeholder="e.g., users"
                            />
                        </div>

                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Columns</label>
                            {newColumns.map((col, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        value={col.name}
                                        onChange={e => updateColumnRow(idx, 'name', e.target.value)}
                                        className="flex-1 bg-[#1e1e1e] border border-gray-600 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500"
                                        placeholder="Column Name"
                                    />
                                    <select
                                        value={col.type}
                                        onChange={e => updateColumnRow(idx, 'type', e.target.value)}
                                        className="bg-[#1e1e1e] border border-gray-600 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500"
                                    >
                                        {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <label className="flex items-center gap-1 text-gray-300 text-sm">
                                        <input type="checkbox" checked={col.pk} onChange={e => updateColumnRow(idx, 'pk', e.target.checked)} className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" /> PK
                                    </label>
                                    <label className="flex items-center gap-1 text-gray-300 text-sm">
                                        <input type="checkbox" checked={col.notNull} onChange={e => updateColumnRow(idx, 'notNull', e.target.checked)} className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" /> Not Null
                                    </label>
                                    {newColumns.length > 1 && (
                                        <button onClick={() => removeColumnRow(idx)} className="text-red-400 hover:text-red-300 p-1 rounded">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={addColumnRow} className="text-blue-400 text-sm hover:underline flex items-center gap-1 mb-6">
                            <Plus className="w-3 h-3" /> Add Column
                        </button>
                        <div className="flex justify-end">
                            <button
                                onClick={handleCreateTable}
                                disabled={loading || !newTableName || newColumns.some(c => !c.name)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Table'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Details View */}
                {viewMode === 'details' && selectedTable && tableDetails && (
                    <div className="h-full overflow-auto p-4">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Table className="w-6 h-6 text-orange-400" /> {selectedTable}
                                </h2>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                    <span>{tableDetails.row_count} rows</span>
                                    <span>{tableDetails.column_count} columns</span>
                                    <button
                                        onClick={() => handleDropTable(selectedTable)}
                                        className="px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-400 rounded hover:bg-red-900/30 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Drop Table
                                    </button>
                                </div>
                            </div>
                            <div className="bg-[#252526] border border-gray-700 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-[#1e1e1e] border-b border-gray-700 uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-3">Column Name</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Attributes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableDetails.columns.map(col => (
                                            <tr key={col.name} className="border-b border-gray-800 last:border-0 hover:bg-[#2d2d2d]">
                                                <td className="px-6 py-3 font-medium">{col.name}</td>
                                                <td className="px-6 py-3 text-blue-400">{col.col_type}</td>
                                                <td className="px-6 py-3 flex gap-2">
                                                    {col.primary_key && <span className="text-[10px] px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-900/50">PK</span>}
                                                    {!col.nullable && <span className="text-[10px] px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded border border-yellow-900/50">NOT NULL</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-[#1e1e1e] border-t border-gray-700">
                                        <tr>
                                            <td colSpan="3" className="px-6 py-3">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-gray-500 text-xs uppercase font-bold">Add Column:</span>
                                                    <input
                                                        className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded px-2 py-1 text-sm text-white w-40"
                                                        placeholder="Name"
                                                        value={addColumnName}
                                                        onChange={e => setAddColumnName(e.target.value)}
                                                    />
                                                    <select
                                                        className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded px-2 py-1 text-sm text-white"
                                                        value={addColumnType}
                                                        onChange={e => setAddColumnType(e.target.value)}
                                                    >
                                                        {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={handleAddColumn}
                                                        disabled={!addColumnName || loading}
                                                        className="px-3 py-1 bg-[var(--accent)] text-white text-xs rounded font-bold hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data View */}
                {viewMode === 'data' && selectedTable && (
                    <div className="h-full overflow-hidden flex flex-col">
                        <div className="p-2 bg-[#252526] border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-orange-400" /> Data: {selectedTable}
                            </h3>
                            <span className="text-xs text-gray-500">Double-click cells to edit (requires 'id' column)</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {tableData.length === 0 ? (
                                <div className="text-gray-500 italic text-center mt-10">No data found in table.</div>
                            ) : (
                                <div className="border border-gray-700 rounded-lg overflow-hidden inline-block min-w-full">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-[#1e1e1e] border-b border-gray-700 font-mono text-xs text-gray-400">
                                            <tr>
                                                {Object.keys(tableData[0]).map(k => (
                                                    <th key={k} className="px-4 py-2 bg-[#252526] sticky top-0 z-10 border-r border-gray-800 last:border-0">{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 bg-[#1e1e1e]">
                                            {tableData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 group">
                                                    {Object.keys(row).map(k => {
                                                        const isEditing = editingCell?.rowId === row.id && editingCell?.colName === k;
                                                        return (
                                                            <td
                                                                key={k}
                                                                className="px-4 py-2 border-r border-gray-800 last:border-0 cursor-text relative min-w-[100px]"
                                                                onDoubleClick={() => row.id && setEditingCell({ rowId: row.id, colName: k, value: row[k] })}
                                                            >
                                                                {isEditing ? (
                                                                    <input
                                                                        autoFocus
                                                                        className="absolute inset-0 w-full h-full bg-[#333] px-4 text-white outline-none border border-blue-500"
                                                                        value={editingCell.value}
                                                                        onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                                                                        onBlur={() => handleUpdateCell(row.id, k, editingCell.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleUpdateCell(row.id, k, editingCell.value);
                                                                            if (e.key === 'Escape') setEditingCell(null);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className={`${row[k] === null ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                                                                        {row[k] === null ? 'NULL' : String(row[k])}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
