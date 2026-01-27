import React, { useState, useEffect } from 'react';
import { Layout, Plus, FileText, Trash2 } from 'lucide-react';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

export default function DashboardView({ onLoadConfig }) {
    const [dashboards, setDashboards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDashboards();
    }, []);

    const loadDashboards = async () => {
        setLoading(true);
        try {
            // Check if table exists first via metadata list
            const metaRes = await fetch(`${API_Base}/v1/tables`);
            const metaJson = await metaRes.json();

            if (metaJson.success && metaJson.tables.includes('vibedb_dashboards')) {
                const res = await fetch(`${API_Base}/v1/query/vibedb_dashboards?order_by=created_at&order_dir=DESC`);
                const json = await res.json();
                if (json.success) {
                    setDashboards(json.data);
                }
            } else {
                setDashboards([]); // No dashboards yet
            }
        } catch (e) {
            console.error(e);
            setError("Failed to load dashboards");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this dashboard?")) return;

        try {
            await fetch(`${API_Base}/v1/delete/vibedb_dashboards/${id}`, { method: 'POST' });
            loadDashboards();
        } catch (e) {
            alert("Failed to delete");
        }
    };

    return (
        <div className="flex-1 bg-[var(--bg-app)] p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Layout className="w-8 h-8 text-[var(--accent)]" />
                            Dashboards
                        </h1>
                        <p className="text-gray-400 mt-1">Manage your saved visualizations and reports.</p>
                    </div>
                    <button
                        onClick={() => onLoadConfig(null)} // Reset/New
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20"
                    >
                        <Plus className="w-4 h-4" /> New Dashboard
                    </button>
                </div>

                {loading ? (
                    <div className="text-gray-500 flex items-center gap-2 animate-pulse">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* New Card */}
                        <button
                            onClick={() => onLoadConfig(null)}
                            className="h-48 rounded-xl border-2 border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all group"
                        >
                            <div className="p-4 rounded-full bg-[var(--bg-panel)] mb-3 group-hover:scale-110 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-medium text-sm">Create New</span>
                        </button>

                        {/* Saved Dashboards */}
                        {dashboards.map(d => (
                            <div
                                key={d.id}
                                onClick={() => {
                                    try {
                                        const config = typeof d.config === 'string' ? JSON.parse(d.config) : d.config;
                                        onLoadConfig(config);
                                    } catch (e) {
                                        alert("Error loading dashboard configuration");
                                    }
                                }}
                                className="h-48 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col hover:border-[var(--accent)] transition-all cursor-pointer relative group overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, d.id)}
                                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-200 mb-1 line-clamp-1">{d.name}</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Last edited {new Date(d.created_at).toLocaleDateString()}
                                </p>

                                <div className="mt-auto flex items-center gap-2 text-xs text-gray-500">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Ready to view
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
