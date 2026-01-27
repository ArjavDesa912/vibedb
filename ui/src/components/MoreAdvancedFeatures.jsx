import React, { useState } from 'react';
import {
    Terminal, FileJson, History, Bookmark, Play, FastForward, Rewind,
    Shield, Eye, EyeOff, BarChart2, Zap, Cloud, Trash, RotateCcw,
    Database, Server, Workflow, FileText, ArrowRight, Save, Copy,
    Sparkles, Loader2, Search, X, ChevronRight, Target, Megaphone, Truck, Users, Phone, Activity,
    DollarSign, Briefcase, ShoppingBag, CreditCard, PieChart, TrendingUp, Archive, Map as MapIcon, Globe,
    Calendar, Heart, ShoppingCart, BookOpen, Award, Filter as FilterIcon
} from 'lucide-react';

// --- SQL to NoSQL Transpiler ---
export function SqlToNosqlTranspiler({ sql }) {
    const [noSql, setNoSql] = useState('');

    // Naive mock transpilation
    const handleTranspile = () => {
        let result = "db.collection.find({})";
        if (sql.toLowerCase().includes('select * from')) {
            const table = sql.split('from')[1]?.split(' ')[1]?.trim();
            result = `db.${table || 'collection'}.find({})`;
        } else if (sql.toLowerCase().includes('where')) {
            result = `db.collection.find({ field: "value" }) // Mapped from WHERE`;
        }
        setNoSql(result);
    };

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] p-4 text-sm font-mono">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-green-400 flex items-center gap-2">
                    <Database className="w-4 h-4" /> SQL to NoSQL
                </h3>
                <button onClick={handleTranspile} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded">
                    Transpile
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4 h-full">
                <div className="flex flex-col">
                    <span className="text-gray-500 mb-2">Input SQL</span>
                    <textarea
                        value={sql}
                        readOnly
                        className="flex-1 bg-[#252526] p-3 text-gray-300 rounded border border-gray-700 resize-none outline-none"
                    />
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-500 mb-2">Output MQL (MongoDB)</span>
                    <textarea
                        value={noSql}
                        readOnly
                        className="flex-1 bg-[#252526] p-3 text-green-400 rounded border border-gray-700 resize-none outline-none"
                        placeholder="// Click Transpile..."
                    />
                </div>
            </div>
        </div>
    );
}

// --- Query History & Snippets ---
export function QueryManager() {
    const [tab, setTab] = useState('history'); // history | snippets
    const history = [
        { id: 1, query: "SELECT * FROM users WHERE active = 1", time: "10:42 AM" },
        { id: 2, query: "UPDATE orders SET status = 'shipped'", time: "10:30 AM" },
        { id: 3, query: "DELETE FROM logs WHERE date < '2023-01-01'", time: "Yesterday" },
    ];
    const snippets = [
        { id: 1, name: "Get Active Users", query: "SELECT * FROM users WHERE status = 'active'" },
        { id: 2, name: "Monthly Revenue", query: "SELECT SUM(amount) FROM sales GROUP BY month" },
    ];

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-gray-700 w-64">
            <div className="flex border-b border-gray-700">
                <button
                    onClick={() => setTab('history')}
                    className={`flex-1 py-3 text-xs font-bold uppercase ${tab === 'history' ? 'bg-[#252526] text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <History className="w-4 h-4 mx-auto mb-1" /> History
                </button>
                <button
                    onClick={() => setTab('snippets')}
                    className={`flex-1 py-3 text-xs font-bold uppercase ${tab === 'snippets' ? 'bg-[#252526] text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Bookmark className="w-4 h-4 mx-auto mb-1" /> Snippets
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tab === 'history' ? (
                    history.map(h => (
                        <div key={h.id} className="p-3 bg-[#252526] rounded border border-gray-700 hover:border-blue-500 cursor-pointer group">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                <span>{h.time}</span>
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-white" />
                            </div>
                            <div className="font-mono text-xs text-gray-300 truncate">{h.query}</div>
                        </div>
                    ))
                ) : (
                    snippets.map(s => (
                        <div key={s.id} className="p-3 bg-[#252526] rounded border border-gray-700 hover:border-purple-500 cursor-pointer group">
                            <div className="font-bold text-xs text-white mb-1 group-hover:text-purple-400">{s.name}</div>
                            <div className="font-mono text-[10px] text-gray-400 truncate">{s.query}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// --- Tableau Prep (Data Flow) ---
export function DataPrepFlow() {
    const [nodes, setNodes] = useState([
        { id: 1, type: 'Input', label: 'Orders.csv', x: 50, y: 100 },
        { id: 2, type: 'Clean', label: 'Clean Nulls', x: 250, y: 100 },
        { id: 3, type: 'Output', label: 'Sales_Mart', x: 450, y: 100 },
    ]);

    return (
        <div className="h-full bg-[#1a1a1a] relative overflow-hidden flex flex-col">
            <div className="p-4 bg-[#252526] border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Workflow className="w-5 h-5 text-orange-500" /> Data Prep Flow
                </h2>
                <div className="flex gap-2">
                    <button className="px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600">Add Step</button>
                    <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1">
                        <Play className="w-3 h-3" /> Run Flow
                    </button>
                    <button className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Publish API
                    </button>
                </div>
            </div>

            <div className="flex-1 relative">
                {/* SVG Connections Line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <line x1="150" y1="130" x2="250" y2="130" stroke="gray" strokeWidth="2" />
                    <line x1="350" y1="130" x2="450" y2="130" stroke="gray" strokeWidth="2" />
                </svg>

                {nodes.map(node => (
                    <div
                        key={node.id}
                        className="absolute w-32 h-24 bg-[#252526] border-2 border-gray-600 rounded-lg flex flex-col items-center justify-center shadow-lg hover:border-blue-400 cursor-pointer z-10"
                        style={{ left: node.x, top: node.y }}
                    >
                        <div className={`p-2 rounded-full mb-2 ${node.type === 'Input' ? 'bg-blue-900/50 text-blue-400' :
                            node.type === 'Clean' ? 'bg-orange-900/50 text-orange-400' : 'bg-green-900/50 text-green-400'
                            }`}>
                            {node.type === 'Input' && <Database className="w-4 h-4" />}
                            {node.type === 'Clean' && <Zap className="w-4 h-4" />}
                            {node.type === 'Output' && <Server className="w-4 h-4" />}
                        </div>
                        <span className="text-xs font-bold text-gray-300">{node.label}</span>
                        <span className="text-[10px] text-gray-500 uppercase">{node.type}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Schema Analysis (Profiler) ---
export function SchemaAnalysis({ items }) {
    // items could be columns
    return (
        <div className="p-4 bg-[#1e1e1e] h-full overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-pink-400" /> Schema Profile
            </h3>

            <div className="space-y-6">
                {['id', 'status', 'amount', 'created_at'].map(col => (
                    <div key={col} className="bg-[#252526] p-4 rounded border border-gray-700">
                        <div className="flex justify-between mb-2">
                            <span className="font-mono text-blue-400 font-bold">{col}</span>
                            <span className="text-xs text-gray-500">INTEGER</span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-center mb-4">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase">Unique</div>
                                <div className="text-lg font-bold text-white">1,240</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase">Nulls</div>
                                <div className="text-lg font-bold text-red-400">0%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase">Min</div>
                                <div className="text-lg font-bold text-gray-300">1</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase">Max</div>
                                <div className="text-lg font-bold text-gray-300">9999</div>
                            </div>
                        </div>
                        {/* Fake Histogram */}
                        <div className="h-12 flex items-end gap-1">
                            {[20, 45, 30, 80, 50, 60, 20, 40, 90, 35].map((h, i) => (
                                <div key={i} className="flex-1 bg-blue-600/50 hover:bg-blue-500 rounded-t" style={{ height: `${h}%` }}></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Embedded Shell ---
export function EmbeddedShell() {
    return (
        <div className="bg-black font-mono text-xs text-green-500 p-2 h-48 overflow-y-auto border-t border-gray-700">
            <div className="mb-1">Connected to local instance: MongoDB 6.0.4</div>
            <div className="mb-1">vibedb&gt; use users</div>
            <div className="mb-1">switched to db users</div>
            <div className="mb-1">vibedb&gt; db.users.find({"{ status: 'active' }"})</div>
            <div className="mb-1 text-gray-400">{`{ "_id": ObjectId("..."), "name": "Alice", "status": "active" }`}</div>
            <div className="mb-1 text-gray-400">{`{ "_id": ObjectId("..."), "name": "Bob", "status": "active" }`}</div>
            <div className="flex items-center gap-1 mt-2">
                <span>vibedb&gt;</span>
                <span className="animate-pulse bg-green-500 w-2 h-4 block"></span>
            </div>
        </div>
    );
}

// --- Accelerators (Templates) ---
export function AcceleratorGallery({ onClose, onApply }) {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [applying, setApplying] = useState(null); // ID of template being applied

    const categories = ['All', 'Executive', 'Sales', 'Marketing', 'Operations', 'HR', 'IT', 'Finance', 'Retail', 'Education'];

    const templates = [
        // Executive
        { id: 1, title: "Executive Overview", category: "Executive", color: "from-blue-600 to-indigo-600", icon: BarChart2, description: "High-level KPI tracking for C-Suite executives. Includes revenue, margin, and growth trends.", kpis: ["Revenue", "Margin", "YoY Growth"], config: { chartType: 'bar', showLegend: true, colorScheme: 'cool' } },
        { id: 6, title: "SaaS Metrics Pack", category: "Executive", color: "from-indigo-500 to-violet-600", icon: Activity, description: "Standard SaaS metrics including ARR, MRR, Churn, and Net Dollar Retention.", kpis: ["ARR", "MRR", "Churn", "LTV:CAC"], config: { chartType: 'area', showLegend: true } },
        { id: 11, title: "Board Meeting Deck", category: "Executive", color: "from-slate-700 to-gray-900", icon: FileText, description: "Ready-to-export slides for quarterly board review.", kpis: ["EBITDA", "Runway", "Bookings"], config: { chartType: 'bar-stacked', showLegend: true } },

        // Sales
        { id: 2, title: "Sales Pipeline", category: "Sales", color: "from-emerald-500 to-teal-600", icon: Target, description: "Track opportunities from lead to close. Visualize funnel conversion rates.", kpis: ["Pipeline Value", "Win Rate", "Avg Deal Size"], config: { chartType: 'funnel', showLegend: true } },
        { id: 9, title: "Regional Sales Perf", category: "Sales", color: "from-green-500 to-emerald-700", icon: Globe, description: "Geographic breakdown of sales performance by territory.", kpis: ["Region Sales", "% to Quota"], config: { chartType: 'bar', showLegend: true } },
        { id: 12, title: "Sales Rep Leaderboard", category: "Sales", color: "from-lime-500 to-green-600", icon: Users, description: "Individual performance tracking for sales representatives.", kpis: ["Quoto Attainment", "Calls Made"], config: { chartType: 'bar-horizontal', showLegend: false } },
        { id: 21, title: "Deal Velocity", category: "Sales", color: "from-teal-400 to-teal-600", icon: FastForward, description: "Analyze how fast deals move through stages.", kpis: ["Days to Close", "Stalled Deals"], config: { chartType: 'scatter', showLegend: true } },

        // Marketing
        { id: 3, title: "Marketing Campaign Perf", category: "Marketing", color: "from-purple-500 to-pink-600", icon: Megaphone, description: "Analyze campaign ROI across multiple channels.", kpis: ["ROI", "CAC", "CTR"], config: { chartType: 'bar-stacked', showLegend: true } },
        { id: 10, title: "Social Media Sentiment", category: "Marketing", color: "from-pink-400 to-rose-500", icon: Target, description: "Track brand sentiment and engagement across platforms.", kpis: ["Mentions", "Sentiment Score"], config: { chartType: 'pie', showLegend: true } },
        { id: 13, title: "Website Traffic Analysis", category: "Marketing", color: "from-fuchsia-500 to-purple-600", icon: Globe, description: "Visitor trends, bounce rates, and conversion paths.", kpis: ["Visits", "Bounce Rate"], config: { chartType: 'area', showLegend: false } },
        { id: 22, title: "Event ROI Tracker", category: "Marketing", color: "from-violet-400 to-purple-800", icon: Calendar, description: "Measure impact of offline and online events.", kpis: ["Leads Generated", "Cost per Lead"], config: { chartType: 'bar', showLegend: true } },

        // Operations
        { id: 4, title: "Supply Chain Tower", category: "Operations", color: "from-orange-500 to-red-600", icon: Truck, description: "End-to-end visibility of inventory and logistics.", kpis: ["On-Time Delivery", "Inventory Turnover"], config: { chartType: 'line', showLegend: true } },
        { id: 8, title: "Call Center Volume", category: "Operations", color: "from-cyan-500 to-blue-600", icon: Phone, description: "Track call volume and handle time in real-time.", kpis: ["Call Vol", "AHT", "CSAT"], config: { chartType: 'area-stacked', showLegend: true } },
        { id: 14, title: "Manufacturing Yield", category: "Operations", color: "from-amber-500 to-orange-700", icon: Zap, description: "Production efficiency and defect rate tracking.", kpis: ["Yield %", "Defects"], config: { chartType: 'line-step', showLegend: true } },
        { id: 15, title: "Inventory Health", category: "Operations", color: "from-orange-400 to-red-500", icon: Archive, description: "Stock levels, aging inventory, and stockout alerts.", kpis: ["Stock Value", "Days On Hand"], config: { chartType: 'treemap', showLegend: true } },

        // HR
        { id: 5, title: "Workforce Demographics", category: "HR", color: "from-pink-500 to-rose-600", icon: Users, description: "Analyze headcount, diversity, and attrition trends.", kpis: ["Headcount", "Attrition Rate"], config: { chartType: 'pie', showLegend: true } },
        { id: 16, title: "Recruitment Funnel", category: "HR", color: "from-rose-400 to-pink-700", icon: FilterIcon, description: "Track candidates from application to hire.", kpis: ["Time to Hire", "Offer Accept Rate"], config: { chartType: 'funnel', showLegend: true } },
        { id: 23, title: "Employee Satisfaction", category: "HR", color: "from-pink-300 to-rose-500", icon: Heart, description: "eNPS and pulse survey analysis.", kpis: ["eNPS", "Participation"], config: { chartType: 'radial', showLegend: true } },

        // IT
        { id: 7, title: "IT Infrastructure", category: "IT", color: "from-slate-600 to-gray-700", icon: Server, description: "Monitor server uptime, response times, and error rates.", kpis: ["Uptime", "Latency"], config: { chartType: 'area', colorScheme: 'cool' } },
        { id: 17, title: "Security Incident Log", category: "IT", color: "from-red-600 to-red-900", icon: Shield, description: "Track and triage securities vulnerabilities.", kpis: ["Open Incidents", "MTTR"], config: { chartType: 'bar', showLegend: false, colorScheme: 'warm' } },
        { id: 24, title: "Cloud Cost Optimizer", category: "IT", color: "from-blue-400 to-cyan-600", icon: Cloud, description: "Analyze AWS/Azure spend by service.", kpis: ["Mth Spend", "Forecast"], config: { chartType: 'treemap', showLegend: true } },

        // Finance
        { id: 18, title: "P&L Statement", category: "Finance", color: "from-green-600 to-emerald-800", icon: DollarSign, description: "Visual profit and loss statement.", kpis: ["Net Profit", "OpEx"], config: { chartType: 'bar-stacked', showLegend: true } },
        { id: 19, title: "Cash Flow Forecast", category: "Finance", color: "from-emerald-400 to-green-600", icon: TrendingUp, description: "Projected cash inflows and outflows.", kpis: ["Cash Balance", "Burn Rate"], config: { chartType: 'line', showLegend: true } },
        { id: 25, title: "Expense Analysis", category: "Finance", color: "from-green-500 to-teal-500", icon: CreditCard, description: "Breakdown of expenses by department.", kpis: ["Total Exp", "Vs Budget"], config: { chartType: 'pie', showLegend: true } },

        // Retail
        { id: 20, title: "Store Performance", category: "Retail", color: "from-yellow-500 to-orange-600", icon: ShoppingBag, description: "Compare sales across physical retail locations.", kpis: ["Same Store Sales", "Foot traffic"], config: { chartType: 'bar', showLegend: false } },
        { id: 26, title: "Basket Analysis", category: "Retail", color: "from-orange-300 to-yellow-500", icon: ShoppingCart, description: "Market basket analysis and product affinity.", kpis: ["Basket Size", "Attach Rate"], config: { chartType: 'scatter', showLegend: true } },

        // Education
        { id: 27, title: "Student Enrollment", category: "Education", color: "from-blue-400 to-indigo-500", icon: BookOpen, description: "Enrollment trends by department and year.", kpis: ["Total Students", "Growth"], config: { chartType: 'line', showLegend: true } },
        { id: 28, title: "Course Completion", category: "Education", color: "from-indigo-400 to-violet-500", icon: Award, description: "Completion rates and grade distributions.", kpis: ["Pass Rate", "Avg Grade"], config: { chartType: 'bar', showLegend: true } },
    ];

    const filteredTemplates = templates.filter(t =>
        (selectedCategory === 'All' || t.category === selectedCategory) &&
        (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleApply = (template) => {
        setApplying(template.id);
        setTimeout(() => {
            if (onApply) onApply(template.config);
            setApplying(null);
            onClose();
        }, 1500);
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-8">
            <div className="bg-[#1e1e1e] w-full max-w-6xl h-[85vh] rounded-2xl border border-gray-700 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#252526]">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-yellow-400" />
                            Tableau Accelerators
                            <span className="text-xs font-normal text-white/50 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">BETA</span>
                        </h2>
                        <p className="text-gray-400 mt-1">Jumpstart your analysis with purpose-built, expert-designed dashboard templates.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Filters */}
                    <div className="w-64 bg-[#252526] border-r border-gray-700 p-4 flex flex-col gap-1 overflow-y-auto hidden md:flex">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2 px-3 tracking-wider">Categories</div>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span>{cat}</span>
                                {selectedCategory === cat && <ChevronRight className="w-4 h-4" />}
                            </button>
                        ))}

                        <div className="mt-8 p-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl border border-white/10">
                            <h4 className="font-bold text-white mb-1">Suggest a Template</h4>
                            <p className="text-xs text-gray-400 mb-3">Don't see what you need? Let our team know.</p>
                            <button className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded border border-white/10 transition-colors w-full">Request</button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                        {/* Search Bar */}
                        <div className="p-4 border-b border-gray-700 bg-[#1e1e1e] flex items-center gap-4">
                            <div className="relative flex-1 max-w-xl">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search templates (e.g. Sales, KPI, Executive)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600"
                                />
                            </div>
                            <div className="text-xs text-gray-500">
                                Showing <strong className="text-white">{filteredTemplates.length}</strong> templates
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 align-content-start">
                            {filteredTemplates.map(t => (
                                <div key={t.id} className="group bg-[#252526] border border-gray-700 hover:border-blue-500/50 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 flex flex-col">
                                    {/* Thumbnail Header */}
                                    <div className={`h-32 bg-gradient-to-br ${t.color} p-6 flex flex-col justify-between relative overflow-hidden`}>
                                        <div className="absolute top-0 right-0 p-3 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                                            <t.icon className="w-32 h-32 text-white" />
                                        </div>
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                                                <t.icon className="w-6 h-6 text-white" />
                                            </div>
                                            {applying === t.id && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold bg-black/40 backdrop-blur text-white px-2 py-1 rounded-full animate-in slide-in-from-right-4">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> INSTALLING
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative z-10">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{t.category}</span>
                                            <h3 className="text-lg font-bold text-white leading-tight">{t.title}</h3>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-5 flex-1 flex flex-col">
                                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{t.description}</p>

                                        <div className="mb-4">
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-2">Key Metrics</label>
                                            <div className="flex flex-wrap gap-2">
                                                {t.kpis.map(k => (
                                                    <span key={k} className="text-[11px] bg-[#333] border border-gray-600 text-gray-300 px-2 py-1 rounded-md">
                                                        {k}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-auto">
                                            <button
                                                onClick={() => handleApply(t)}
                                                disabled={applying !== null}
                                                className="w-full py-2.5 bg-[#333] hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors border border-gray-600 hover:border-blue-500 flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:border-blue-500"
                                            >
                                                {applying === t.id ? 'Setting up Dashboard...' : 'Use Template'}
                                                {applying !== t.id && <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Recycle Bin ---
export function RecycleBin() {
    return (
        <div className="p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                <Trash className="w-4 h-4 text-red-400" /> Recycle Bin (30 Days)
            </h3>
            <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-[#252526] rounded border border-gray-700 opacity-75 hover:opacity-100">
                    <span className="text-gray-400 text-sm">old_users_backup</span>
                    <button className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Cloud Auth ---
export function CloudAuth() {
    return (
        <div className="p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400" /> Cloud Authentication
            </h3>
            <div className="space-y-4">
                {['AWS IAM', 'Azure AD', 'Google Cloud'].map(p => (
                    <div key={p} className="flex items-center justify-between p-3 bg-[#252526] rounded border border-gray-700">
                        <span className="font-bold text-gray-300">{p}</span>
                        <button className="px-3 py-1 bg-[#1e1e1e] border border-gray-600 hover:bg-gray-700 rounded text-xs text-white">Connect</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Semantic Learning Layer ---
export function SemanticLayer() {
    // ... logic for synonyms
    return (
        <div className="h-full bg-[#1e1e1e] p-6 text-gray-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-purple-400" /> Semantic Layer & Business Logic
                    </h2>
                    <p className="text-gray-400 text-sm">Define synonyms and business rules for AI context.</p>
                </div>
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Rule
                </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#252526] border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Type className="w-4 h-4 text-blue-400" /> Synonyms</h3>
                    <div className="space-y-2">
                        {[
                            { term: "Revenue", synonyms: ["Sales", "Income", "Gross Sales"] },
                            { term: "Customer", synonyms: ["Client", "Buyer", "Account"] },
                            { term: "Profit", synonyms: ["Margin", "Net Income"] }
                        ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-[#1e1e1e] p-2 rounded border border-gray-800">
                                <span className="font-mono text-blue-300">{item.term}</span>
                                <div className="flex gap-1">
                                    {item.synonyms.map(s => <span key={s} className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{s}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#252526] border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Workflow className="w-4 h-4 text-green-400" /> Business Logic</h3>
                    <div className="space-y-2">
                        {[
                            { rule: "High Value Customer", logic: "Lifetime Sales > $10,000" },
                            { rule: "Churned", logic: "Last Order Date > 90 days ago" }
                        ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-[#1e1e1e] p-2 rounded border border-gray-800">
                                <span className="text-green-300">{item.rule}</span>
                                <span className="font-mono text-xs text-gray-500">{item.logic}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Explain Data ---
export function ExplainData({ contextData }) {
    return (
        <div className="bg-[#252526] border border-blue-500/30 rounded-lg p-4 shadow-xl">
            <h3 className="font-bold text-white flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                Explain Data: Why did this change?
            </h3>
            <div className="space-y-3">
                <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">Sales in <strong>North Region</strong></span>
                        <span className="text-red-400 font-bold">-15%</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Primarily driven by a decrease in <strong className="text-gray-200">Furniture</strong> category (-40%).
                    </p>
                </div>
                <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">Outlier: <strong>Order #9482</strong></span>
                        <span className="text-green-400 font-bold">+$12k</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Unusually high quantity of <strong className="text-gray-200">Office Supplies</strong>.
                    </p>
                </div>
            </div>
            <button className="w-full mt-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                Run Deep Analysis
            </button>
        </div>
    );
}

// --- VizQL Data Service (Headless) ---
export function VizQLServicePanel() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);

    return (
        <div className="h-full bg-[#1e1e1e] p-6 text-gray-300">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <Server className="w-5 h-5 text-orange-400" /> VizQL Data Service (Headless)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <label className="block text-xs font-semibold uppercase mb-2">VizQL Request (JSON)</label>
                    <textarea
                        className="w-full h-64 bg-[#252526] border border-gray-700 rounded p-4 font-mono text-sm text-green-300"
                        value={JSON.stringify({
                            "workbook": "Superstore",
                            "view": "Sales_Overview",
                            "filters": { "Region": "West" },
                            "aggregations": ["SUM(Sales)"]
                        }, null, 2)}
                        readOnly
                    ></textarea>
                    <button className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded font-medium">
                        Execute Query
                    </button>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase mb-2">Response Data</label>
                    <div className="w-full h-64 bg-[#252526] border border-gray-700 rounded p-4 font-mono text-sm text-blue-300 overflow-auto">
                        {`{
  "data": [
    { "Region": "West", "SUM(Sales)": 725457.90 }
  ],
  "performance": "12ms",
  "cached": true
}`}
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Ask Data (Natural Language to SQL) ---
export function AskData({ onQueryGenerated }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAsk = async () => {
        if (!prompt) return;
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            const mockSql = `SELECT * FROM sales WHERE region = 'West' AND amount > 5000 ORDER BY date DESC`;
            if (onQueryGenerated) onQueryGenerated(mockSql);
            setLoading(false);
            setPrompt('');
        }, 1500);
    };

    return (
        <div className="bg-[#252526] border border-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" /> Ask Data (Natural Language)
            </h3>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAsk()}
                    placeholder="e.g. show me high value sales in the west region"
                    className="flex-1 bg-[#1e1e1e] border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    disabled={loading}
                />
                <button
                    onClick={handleAsk}
                    disabled={loading || !prompt}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
