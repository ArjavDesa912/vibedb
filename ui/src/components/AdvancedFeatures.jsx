import React, { useState, useEffect } from 'react';
import {
    Layers, Plus, Trash2, ArrowRight, Play, Server, Activity,
    Cpu, HardDrive, GitBranch, GitCommit, UploadCloud, DownloadCloud,
    CheckCircle, AlertCircle, Clock
} from 'lucide-react';

// --- Visual Aggregation Builder (NoSQL) ---
export function AggregationBuilder() {
    const [stages, setStages] = useState([
        { type: '$match', query: '{ status: "active" }' },
        { type: '$group', query: '{ _id: "$category", total: { $sum: "$amount" } }' }
    ]);

    const addStage = () => setStages([...stages, { type: '$project', query: '{}' }]);
    const removeStage = (index) => setStages(stages.filter((_, i) => i !== index));
    const updateStage = (index, field, value) => {
        const newStages = [...stages];
        newStages[index][field] = value;
        setStages(newStages);
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[#1e1e1e]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-orange-400" /> Aggregation Pipeline Builder
                </h2>
                <div className="flex gap-2">
                    <button onClick={addStage} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center gap-1">
                        <Plus className="w-4 h-4" /> Add Stage
                    </button>
                    <button className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white flex items-center gap-1">
                        <Play className="w-4 h-4" /> Run Pipeline
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {stages.map((stage, i) => (
                    <div key={i} className="flex gap-4 group">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center text-xs font-mono text-gray-400 z-10  shadow-lg">
                                {i + 1}
                            </div>
                            {i < stages.length - 1 && <div className="w-0.5 flex-1 bg-gray-700 my-1"></div>}
                        </div>

                        <div className="flex-1 bg-[#252526] border border-gray-700 rounded-lg p-4 shadow-sm relative hover:border-blue-500/50 transition-colors">
                            <div className="flex justify-between mb-3">
                                <select
                                    value={stage.type}
                                    onChange={(e) => updateStage(i, 'type', e.target.value)}
                                    className="bg-[#1e1e1e] border border-gray-600 rounded px-2 py-1 text-blue-400 font-mono text-sm outline-none cursor-pointer"
                                >
                                    {['$match', '$group', '$project', '$sort', '$limit', '$unwind', '$lookup'].map(op => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                                <button onClick={() => removeStage(i)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <textarea
                                value={stage.query}
                                onChange={(e) => updateStage(i, 'query', e.target.value)}
                                className="w-full bg-[#1e1e1e] rounded p-3 font-mono text-xs text-gray-300 border border-gray-700 outline-none focus:border-blue-500 h-24 resize-none"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 border-t border-gray-800 pt-4">
                <div className="text-xs text-gray-500 font-mono mb-2 uppercase">Generated Pipeline JSON</div>
                <div className="bg-[#111] p-3 rounded font-mono text-xs text-green-400 overflow-x-auto whitespace-pre">
                    {JSON.stringify(stages, null, 2)}
                </div>
            </div>
        </div>
    );
}

// --- Real-Time Performance Monitor ---
export function PerformanceMonitor() {
    const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, queries: 0, latency: 0 });
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const next = {
                cpu: 20 + Math.random() * 30,
                memory: 40 + Math.random() * 10,
                queries: Math.floor(Math.random() * 500),
                latency: 5 + Math.random() * 40,
                time: new Date().toLocaleTimeString()
            };
            setMetrics(next);
            setHistory(prev => [...prev.slice(-20), next]);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full p-6 bg-[#1e1e1e] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-red-500" /> Real-Time Database Monitor
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard icon={Cpu} label="CPU Usage" value={`${metrics.cpu.toFixed(1)}%`} color="text-blue-400" />
                <MetricCard icon={HardDrive} label="Memory" value={`${metrics.memory.toFixed(1)} GB`} color="text-purple-400" />
                <MetricCard icon={Server} label="QPS" value={metrics.queries} color="text-green-400" />
                <MetricCard icon={Clock} label="Avg Latency" value={`${metrics.latency.toFixed(0)} ms`} color="text-orange-400" />
            </div>

            <div className="bg-[#252526] border border-gray-700 rounded-lg p-4 h-64 flex items-end justify-between gap-1 overflow-hidden relative">
                <div className="absolute top-2 right-2 text-xs text-gray-500">Live Transaction Volume (1min)</div>
                {history.map((pt, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-blue-900/50 to-blue-500/50 rounded-t hover:bg-blue-400 transition-colors relative group" style={{ height: `${(pt.queries / 600) * 100}%` }}>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[10px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10">
                            {pt.queries} QPS @ {pt.time}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#252526] border border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-gray-300 mb-3">Slow Query Log</h3>
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center justify-between text-xs p-2 bg-[#1e1e1e] rounded border border-gray-800">
                                <span className="font-mono text-gray-400">SELECT * FROM heavy_table...</span>
                                <span className="text-red-400">{300 + i * 50}ms</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#252526] border border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-gray-300 mb-3">Active Connections</h3>
                    <div className="flex items-center justify-center h-24 text-4xl font-mono text-white">
                        42
                    </div>
                    <div className="text-center text-xs text-gray-500">Max connections: 100</div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-[#252526] border border-gray-700 rounded-lg p-4 flex items-center gap-4">
            <div className={`p-3 bg-[#1e1e1e] rounded-full ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase">{label}</div>
                <div className="text-xl font-bold text-gray-200">{value}</div>
            </div>
        </div>
    );
}

// --- Git/VCS Integration ---
export function GitControl() {
    const [status, setStatus] = useState('clean'); // 'clean', 'changed', 'syncing'

    const handlePush = () => {
        setStatus('syncing');
        setTimeout(() => setStatus('clean'), 2000);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-[#1e1e1e]">
            <div className="max-w-md w-full bg-[#252526] border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                <div className="bg-[#1a1a1a] p-6 border-b border-gray-700 flex flex-col items-center">
                    <div className="w-16 h-16 bg-orange-900/20 rounded-full flex items-center justify-center mb-4 text-orange-500">
                        <GitBranch className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Version Control</h2>
                    <p className="text-sm text-gray-500">Manage your database schema versions</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded border border-gray-700">
                        <div className="flex items-center gap-3">
                            <GitBranch className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-gray-300 font-mono">main</span>
                        </div>
                        <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50">Protected</span>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">Uncommitted Changes</h4>
                        <div className="text-sm text-gray-400 italic pl-2 border-l-2 border-gray-700 py-1">
                            {status === 'clean' ? 'No pending changes.' : 'schema.sql (modified)'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] text-white py-2 rounded text-sm font-medium transition-colors"
                            onClick={() => setStatus(status === 'clean' ? 'changed' : 'clean')}
                        >
                            <GitCommit className="w-4 h-4" /> Commit
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] text-white py-2 rounded text-sm font-medium transition-colors">
                            <DownloadCloud className="w-4 h-4" /> Pull
                        </button>
                    </div>
                    <button
                        onClick={handlePush}
                        disabled={status === 'clean' || status === 'syncing'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {status === 'syncing' ? <Activity className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {status === 'syncing' ? 'Pushing...' : 'Push to Remote'}
                    </button>
                </div>
            </div>
        </div>
    );
}
