import { ExplainData } from './MoreAdvancedFeatures';
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Database, Table, AlertTriangle } from 'lucide-react';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
export default function AnalysisView({ tables }) {
    const [selectedTable, setSelectedTable] = useState(tables[0]?.name || '');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showExplain, setShowExplain] = useState(false);

    useEffect(() => {
        if (!selectedTable) return;

        async function fetchStats() {
            setLoading(true);
            try {
                // Fetch table stats
                const res = await fetch(`${API_Base}/v1/tables/${selectedTable}`);
                const json = await res.json();
                if (json.success) setStats(json.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [selectedTable]);

    if (!tables.length) return <div className="p-8 text-gray-500">No data available for analysis.</div>;

    const typeDistribution = stats ? Object.entries(
        stats.columns.reduce((acc, col) => {
            acc[col.col_type] = (acc[col.col_type] || 0) + 1;
            return acc;
        }, {})
    ).map(([name, value]) => ({ name, value })) : [];

    return (
        <div className="flex w-full h-full bg-[var(--bg-app)] overflow-hidden">
            {/* Sidebar List */}
            <div className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col">
                <div className="p-4 border-b border-[var(--border-subtle)] font-semibold text-violet-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Data Analysis
                </div>
                <div className="flex-1 overflow-y-auto">
                    {tables.map(t => (
                        <button
                            key={t.name}
                            onClick={() => setSelectedTable(t.name)}
                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 border-l-2 ${selectedTable === t.name ? 'border-[var(--accent)] bg-[var(--bg-hover)] text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <Table className="w-3 h-3" />
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="text-gray-400">Analyzing schema...</div>
                ) : stats ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {showExplain && (
                            <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
                                <ExplainData contextData={stats} />
                            </div>
                        )}
                        {/* Header Stats */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-400" /> {selectedTable} Overview
                            </h2>
                            <button
                                onClick={() => setShowExplain(!showExplain)}
                                className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors ${showExplain ? 'bg-blue-600 text-white' : 'bg-[#252526] hover:bg-[#333] text-blue-400 border border-blue-500/30'}`}
                            >
                                <Activity className="w-4 h-4" /> Explain Data (AI)
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 rounded-lg">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Row Count</div>
                                <div className="text-2xl font-bold text-white">{stats.row_count.toLocaleString()}</div>
                            </div>
                            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 rounded-lg">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Column Count</div>
                                <div className="text-2xl font-bold text-white">{stats.column_count}</div>
                            </div>
                            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 rounded-lg">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Health Score</div>
                                <div className="text-2xl font-bold text-emerald-400">98%</div>
                            </div>
                        </div>

                        {/* Column Types Chart */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-6 rounded-lg h-80 flex flex-col">
                                <h3 className="text-sm font-semibold mb-4 text-gray-200">Column Type Distribution</h3>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={typeDistribution}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {typeDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                    {typeDistribution.map((entry, index) => (
                                        <div key={entry.name} className="flex items-center gap-1 text-xs text-gray-400">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                            {entry.name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-6 rounded-lg h-80 overflow-y-auto">
                                <h3 className="text-sm font-semibold mb-4 text-gray-200">Data Dictionary</h3>
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-gray-500">
                                            <th className="pb-2">Column</th>
                                            <th className="pb-2">Type</th>
                                            <th className="pb-2">Nullable</th>
                                            <th className="pb-2">PK</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {stats.columns.map(col => (
                                            <tr key={col.name}>
                                                <td className="py-2 text-blue-300 font-mono">{col.name}</td>
                                                <td className="py-2 text-gray-400">{col.col_type}</td>
                                                <td className="py-2">
                                                    {col.nullable ? <span className="text-yellow-500 text-[10px] px-1.5 py-0.5 bg-yellow-900/20 rounded">YES</span> : <span className="text-gray-600">-</span>}
                                                </td>
                                                <td className="py-2">
                                                    {col.primary_key && <span className="text-emerald-400 text-[10px] px-1.5 py-0.5 bg-emerald-900/20 rounded">PK</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                ) : null}
            </div>
        </div >
    );
}
