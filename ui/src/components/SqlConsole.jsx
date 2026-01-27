import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Database, History, Code, Terminal, ChevronDown, Table, FileText, Activity, EyeOff } from 'lucide-react';
import { SqlToNosqlTranspiler, QueryManager, EmbeddedShell, AskData } from './MoreAdvancedFeatures';
import { Sparkles } from 'lucide-react';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

export default function SqlConsole({ tables }) {
    const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [explainPlan, setExplainPlan] = useState(null);
    const [mode, setMode] = useState('results'); // 'results', 'explain'
    const [showAskData, setShowAskData] = useState(false);
    const [connection, setConnection] = useState('Local SQLite');
    const [masked, setMasked] = useState(false);

    // New Feature State
    const [rightPanel, setRightPanel] = useState('history'); // 'history' | 'transpile' | 'none'
    const [showShell, setShowShell] = useState(false);

    const handleEditorDidMount = (editor, monaco) => {
        monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const tableSuggestions = tables.map(t => ({
                    label: t.name,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: t.name,
                    range: range
                }));

                const columnSuggestions = tables.flatMap(t => t.columns.map(c => ({
                    label: c.name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: c.name,
                    detail: `${t.name} (${c.col_type})`,
                    range: range
                })));

                const keywords = ['SELECT', 'FROM', 'WHERE', 'limit', 'group by', 'order by', 'insert', 'update', 'delete', 'join', 'left join'];
                const keywordSuggestions = keywords.map(k => ({
                    label: k,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: k,
                    range: range
                }));

                return { suggestions: [...tableSuggestions, ...columnSuggestions, ...keywordSuggestions] };
            }
        });
    };

    const handleRun = async () => {
        setLoading(true);
        setError(null);
        setMode('results');
        try {
            const isSelect = query.trim().toLowerCase().startsWith('select');
            const endpoint = isSelect ? '/v1/sql/query' : '/v1/sql/execute';
            const res = await fetch(`${API_Base}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isSelect ? { sql: query } : { query })
            });
            const json = await res.json();
            if (json.success) {
                if (isSelect) {
                    const rows = json.data;
                    const columns = rows.length ? Object.keys(rows[0]) : [];
                    const rowData = rows.map(r => Object.values(r));
                    setResults({ columns, rows: rowData });
                } else {
                    setResults({ columns: ['Message'], rows: [[json.message || "Success"]] });
                }
            } else {
                setError(json.message);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExplain = async () => {
        setLoading(true);
        setMode('explain');
        try {
            const res = await fetch(`${API_Base}/v1/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `EXPLAIN QUERY PLAN ${query}` })
            });
            const json = await res.json();
            if (json.success) {
                setExplainPlan(json.data.map((row, i) => ({ id: row.id || i, detail: row.detail, parent: row.parent })));
            } else {
                setError(json.message);
            }
        } catch (e) {
            setError("Failed to fetch plan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full bg-[#1e1e1e] text-gray-300 overflow-hidden">
            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-none p-2 bg-[#252526] border-b border-gray-700 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={handleRun}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : <Play className="w-4 h-4" />}
                            Run Query
                        </button>
                        <button
                            onClick={handleExplain}
                            disabled={loading}
                            className="bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                        >
                            <Activity className="w-4 h-4" /> Explain
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAskData(!showAskData)} className={`p-2 rounded ${showAskData ? 'bg-purple-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`} title="Ask Data (AI)">
                            <Sparkles className="w-4 h-4" />
                        </button>
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>

                        {/* Connection Selector */}
                        <div className="relative group">
                            <button className="flex items-center gap-1 text-xs bg-[#333] px-2 py-1.5 rounded text-gray-300 hover:bg-[#444]">
                                <Database className="w-3 h-3" /> {connection} <ChevronDown className="w-3 h-3" />
                            </button>
                            <div className="absolute top-full right-0 mt-1 w-40 bg-[#252526] border border-gray-700 rounded shadow-xl hidden group-hover:block z-50">
                                {['Local SQLite', 'AWS RDS', 'MongoDB Atlas'].map(c => (
                                    <button key={c} onClick={() => setConnection(c)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-600 hover:text-white text-gray-300 block">
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setMasked(!masked)} className={`p-2 rounded ${masked ? 'bg-yellow-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`} title="Toggle Data Masking (PII)">
                            <EyeOff className="w-4 h-4" />
                        </button>

                        <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        <button onClick={() => setShowShell(!showShell)} className={`p-2 rounded ${showShell ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`} title="Toggle Database Shell">
                            <Terminal className="w-4 h-4" />
                        </button>
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        <button onClick={() => setRightPanel(rightPanel === 'transpile' ? 'none' : 'transpile')} className={`text-xs px-3 py-1.5 rounded border border-gray-600 ${rightPanel === 'transpile' ? 'bg-blue-900/50 border-blue-500 text-blue-400' : 'hover:bg-gray-700'}`}>
                            SQL → NoSQL
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'history' ? 'none' : 'history')} className={`p-2 rounded ${rightPanel === 'history' ? 'bg-[#333] text-white' : 'hover:bg-gray-700 text-gray-400'}`}>
                            <History className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* Monaco Editor */}
                    <div className="flex-1 min-h-[200px] border-b border-gray-700 relative flex flex-col">
                        {showAskData && (
                            <div className="border-b border-gray-700">
                                <AskData onQueryGenerated={sql => { setQuery(sql); setShowAskData(false); }} />
                            </div>
                        )}
                        <Editor
                            height="100%"
                            defaultLanguage="sql"
                            theme="vs-dark"
                            value={query}
                            onChange={val => setQuery(val)}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                padding: { top: 10 },
                                automaticLayout: true
                            }}
                            onMount={handleEditorDidMount}
                        />
                    </div>

                    {/* Results / Explain */}
                    <div className={`flex-1 bg-[#1e1e1e] overflow-auto flex flex-col ${showShell ? 'h-1/3' : 'h-1/2'}`}>
                        {mode === 'results' && (
                            results ? (
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[#252526] sticky top-0 font-mono text-xs text-gray-400">
                                            <tr>
                                                {results.columns.map((col, i) => <th key={i} className="p-2 border-b border-gray-700">{col}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono text-xs">
                                            {results.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 border-b border-gray-800 last:border-0">
                                                    {row.map((val, j) => (
                                                        <td key={j} className={`p-2 text-gray-300 ${masked && j > 0 ? 'blur-[4px] select-none' : ''}`}>
                                                            {masked && j > 0 ? '••••••' : val}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                                    {loading ? "Executing..." : error ? <span className="text-red-400 px-4">{error}</span> : "Ready to execute."}
                                </div>
                            )
                        )}

                        {mode === 'explain' && explainPlan && (
                            <div className="flex-1 p-8 overflow-auto flex items-center justify-center bg-[#1a1a1a]">
                                <div className="flex flex-col items-center gap-4">
                                    {explainPlan.map((step, i) => (
                                        <div key={i} className="flex flex-col items-center animate-in slide-in-from-bottom-5 fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                            <div className="bg-[#252526] border border-blue-500/30 rounded-lg p-4 w-64 shadow-lg text-center relative group hover:border-blue-500 transition-colors">
                                                <div className="text-xs font-bold text-blue-400 mb-1">Step {step.id}</div>
                                                <div className="text-sm text-gray-200 font-medium">{step.detail}</div>
                                                {i < explainPlan.length - 1 && <div className="absolute top-full left-1/2 w-0.5 h-4 bg-gray-600 -ml-[1px]"></div>}
                                            </div>
                                            {i < explainPlan.length - 1 && <div className="h-4"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Embedded Shell */}
                    {showShell && <EmbeddedShell />}
                </div>
            </div>

            {/* Right Panel (History/Transpiler) */}
            {rightPanel !== 'none' && (
                <div className="w-80 border-l border-gray-700 bg-[#252526] flex flex-col shadow-xl z-20 transition-all duration-300 ease-in-out">
                    {rightPanel === 'history' && <QueryManager />}
                    {rightPanel === 'transpile' && <SqlToNosqlTranspiler sql={query} />}
                </div>
            )}
        </div>
    );
}
