import React, { useEffect, useState } from 'react';
import {
    Sparkles, TrendingUp, TrendingDown, AlertCircle,
    ArrowUpRight, ArrowDownRight, Activity, Calendar, Key, Loader2, Lightbulb
} from 'lucide-react';
import _ from 'lodash';
import { generateInsights } from '../services/aiService';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

export default function PulsePanel({ tableName }) {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('vibedb_ai_key') || '');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        if (!tableName) return;

        const analyzeData = async () => {
            setLoading(true);
            try {
                // Fetch a sample for analysis
                const res = await fetch(`${API_Base}/v1/query/${tableName}?limit=1000`);
                const json = await res.json();

                if (json.success && json.data.length > 0) {
                    const data = json.data;
                    const headers = Object.keys(data[0]);
                    const measures = headers.filter(h => typeof data[0][h] === 'number');
                    const dimensions = headers.filter(h => typeof data[0][h] === 'string');

                    const newInsights = [];

                    // 1. Basic Heuristics (Instant)
                    measures.forEach(m => {
                        const total = _.sumBy(data, m);
                        newInsights.push({
                            type: 'summary',
                            title: `Total ${_.startCase(m)}`,
                            value: total.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            metric: m,
                            icon: Activity
                        });
                    });

                    // 2. High Extremes / Outliers
                    measures.forEach(m => {
                        const maxItem = _.maxBy(data, m);
                        if (maxItem) {
                            const dim = dimensions[0] ? maxItem[dimensions[0]] : 'Record';
                            newInsights.push({
                                type: 'outlier',
                                icon: AlertCircle,
                                title: `Peak ${_.startCase(m)}`,
                                description: `${dim}: ${maxItem[m].toLocaleString()}`
                            });
                        }
                    });

                    setInsights(newInsights);

                    // 3. AI Deep Analysis (if key exists)
                    if (apiKey) {
                        setAiLoading(true);
                        // Summary context for AI
                        const summaryContext = {
                            tableName,
                            rowCount: data.length,
                            columns: headers,
                            sample: data.slice(0, 5),
                            stats: measures.map(m => ({
                                column: m,
                                total: _.sumBy(data, m),
                                avg: _.meanBy(data, m)
                            }))
                        };

                        try {
                            const aiResults = await generateInsights(summaryContext, apiKey);
                            const formattedAi = aiResults.map(r => ({
                                type: 'ai_insight',
                                title: r.title,
                                description: r.description,
                                icon: Lightbulb,
                                trend: r.type === 'positive' ? 'up' : r.type === 'negative' ? 'down' : null
                            }));
                            setInsights(prev => [...formattedAi, ...prev]);
                        } catch (e) {
                            console.error("AI Insight failed", e);
                        } finally {
                            setAiLoading(false);
                        }
                    }
                }
            } catch (err) {
                console.error("Pulse error", err);
            } finally {
                setLoading(false);
            }
        };

        analyzeData();
    }, [tableName, apiKey]); // Re-run if key changes

    if (!tableName) return <div className="p-4 text-gray-500 text-sm">Select a table to see Pulse insights.</div>;

    return (
        <div className="w-80 bg-[var(--bg-panel)] border-l border-[var(--border-subtle)] flex flex-col h-full animate-slide-in-right z-10 shadow-xl">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="font-bold text-gray-200">Vibe Pulse AI</h3>
                </div>
                {aiLoading && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
            </div>

            <div className="p-3 bg-[#1e1e1e] border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <Key className="w-3 h-3 text-gray-500" />
                    <input
                        type="password"
                        value={apiKey}
                        onChange={e => {
                            setApiKey(e.target.value);
                            localStorage.setItem('vibedb_ai_key', e.target.value);
                        }}
                        placeholder="Gemini API Key for AI Insights"
                        className="w-full bg-transparent text-xs text-gray-300 outline-none placeholder:text-gray-600"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {loading ? (
                    <div className="text-center text-gray-500 text-sm py-8">Analyzing data patterns...</div>
                ) : (
                    insights.map((insight, i) => (
                        <InsightCard key={i} data={insight} />
                    ))
                )}
                {insights.length === 0 && !loading && (
                    <div className="text-gray-500 text-sm text-center">No insights available. add an API key for deep analysis.</div>
                )}
            </div>
        </div>
    );
}

function InsightCard({ data }) {
    const isAi = data.type === 'ai_insight';
    return (
        <div className={`p-4 rounded border transition-colors group ${isAi ? 'bg-purple-900/10 border-purple-500/30' : 'bg-[var(--bg-app)] border-[var(--border-subtle)]'}`}>
            <div className="flex items-start justify-between mb-1">
                <span className={`text-xs font-medium uppercase tracking-wide ${isAi ? 'text-purple-400' : 'text-gray-400'}`}>
                    {data.type === 'ai_insight' ? 'AI Insight' : data.type}
                </span>
                {data.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-400" />}
                {data.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-400" />}
                {data.icon && <data.icon className={`w-4 h-4 ${isAi ? 'text-purple-400' : 'text-blue-400'}`} />}
            </div>

            <div className="mb-1">
                <h4 className="text-sm font-semibold text-gray-200 leading-tight">{data.title}</h4>
            </div>

            {data.value && (
                <div className="text-2xl font-bold text-white my-2">{data.value}</div>
            )}

            {data.description && (
                <p className="text-xs text-gray-400 leading-relaxed">
                    {data.description}
                </p>
            )}
        </div>
    );
}
