import React, { useEffect, useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar,
    Treemap,
    FunnelChart, Funnel, LabelList,
    Sankey,
    ComposedChart
} from 'recharts';
import _ from 'lodash';
import { Loader2 } from 'lucide-react';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function Worksheet({ tableName, shelves }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tableName) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch reasonably large chunk for viz
                const res = await fetch(`${API_Base}/v1/query/${tableName}?limit=2000`);
                const json = await res.json();
                if (json.success) setData(json.data);
            } catch (err) {
                console.error("Failed to fetch table data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [tableName]);

    // Compute Chart Data based on Shelves
    const chartData = useMemo(() => {
        if (!data.length) return [];

        const cols = shelves.columns || [];
        const rows = shelves.rows || [];
        const type = shelves.chartType || 'auto';

        // SCATTER / BUBBLE PLOT LOGIC
        if (type === 'scatter' || type === 'bubble') {
            // Need 2 Measures (X and Y)
            const measX = cols.find(f => f.type === 'measure') || rows.find(f => f.type === 'measure');
            const measY = rows.find(f => f.type === 'measure' && f.name !== measX?.name) || cols.find(f => f.type === 'measure' && f.name !== measX?.name);
            const dim = cols.find(f => f.type === 'dimension') || rows.find(f => f.type === 'dimension');

            if (!measX || !measY) return [];

            if (dim) {
                // Aggregate by Dimension
                const grouped = _.groupBy(data, row => row[dim.name]);
                return Object.keys(grouped).map(key => ({
                    name: key,
                    x: _.sumBy(grouped[key], item => Number(item[measX.name]) || 0),
                    y: _.sumBy(grouped[key], item => Number(item[measY.name]) || 0),
                    z: grouped[key].length // size bubble by count?
                }));
            } else {
                // Raw Data (Scatter)
                return data.map((row, i) => ({
                    name: `Row ${i}`,
                    x: Number(row[measX.name]) || 0,
                    y: Number(row[measY.name]) || 0,
                    z: 1
                }));
            }
        }

        // STANDARD AGGREGATION LOGIC (Bar, Line, Area, Pie, Auto)
        const xField = cols.find(f => f.type === 'dimension') || cols[0];
        const yField = rows.find(f => f.type === 'measure') || rows[0];

        if (!xField || !yField) return [];

        const xName = xField.name;
        const yName = yField.name;

        // Aggregation (Sum)
        const grouped = _.groupBy(data, row => row[xName]);

        return Object.keys(grouped).map(key => {
            const group = grouped[key];
            const val = _.sumBy(group, item => Number(item[yName]) || 0);
            return {
                name: key,
                [yName]: val,
                size: val, // for treemap
                fill: '#8884d8',
                _count: group.length
            };
        });

    }, [data, shelves]);

    if (!tableName) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-[var(--bg-app)]">
                Select a data source to begin
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-[var(--bg-app)]">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            </div>
        );
    }

    const renderChart = () => {
        if (!chartData.length) return null;

        const xFields = shelves.columns || [];
        const yFields = shelves.rows || [];
        const type = shelves.chartType || 'auto';

        let xField, yField;

        // Common Tooltip Style
        const tooltipStyle = { backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)' };

        if (type === 'scatter' || type === 'bubble') {
            return (
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis type="number" dataKey="x" name="X" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} />
                    <YAxis type="number" dataKey="y" name="Y" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <ZAxis type="number" dataKey="z" range={type === 'bubble' ? [50, 1000] : [50, 50]} name="count" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                    {shelves.showLegend && <Legend />}
                    <Scatter name="Data" data={chartData} fill="var(--accent)">
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Scatter>
                </ScatterChart>
            );
        } else if (type === 'pie' || type === 'donut') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;

            return (
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={150}
                        innerRadius={type === 'donut' ? 100 : 0}
                        fill="#8884d8"
                        dataKey={yField.name}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    {shelves.showLegend && <Legend />}
                </PieChart>
            );
        } else if (type === 'radar') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;

            return (
                <RadarChart outerRadius={150} data={chartData}>
                    <PolarGrid gridType="polygon" stroke="var(--border-subtle)" />
                    <PolarAngleAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} stroke="var(--text-secondary)" />
                    <Radar name={yField.name} dataKey={yField.name} stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.5} />
                    <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
            );
        } else if (type === 'radial') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;

            return (
                <RadialBarChart innerRadius="10%" outerRadius="80%" barSize={20} data={chartData}>
                    <RadialBar minAngle={15} label={{ position: 'insideStart', fill: '#fff' }} background clockWise dataKey={yField.name}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </RadialBar>
                    <Legend iconSize={10} width={120} height={140} layout="vertical" verticalAlign="middle" wrapperStyle={{ top: 0, left: 0, lineHeight: '24px' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                </RadialBarChart>
            );
        } else if (type === 'treemap') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            // Uses 'size' prop pre-calculated in chartData
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={chartData}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        fill="var(--accent)"
                        content={(props) => {
                            const { x, y, width, height, name } = props;
                            if (width < 50 || height < 50) return null;
                            return (
                                <g>
                                    <rect x={x} y={y} width={width} height={height} fill="var(--accent)" stroke="#fff" />
                                    <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#fff" fontSize={14}>
                                        {name}
                                    </text>
                                </g>
                            );
                        }}
                    >
                        <Tooltip contentStyle={tooltipStyle} />
                    </Treemap>
                </ResponsiveContainer>
            );
        } else if (type === 'funnel') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;
            // Sort for funnel
            const sortedData = [...chartData].sort((a, b) => b[yField.name] - a[yField.name]);

            return (
                <FunnelChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Funnel
                        dataKey={yField.name}
                        data={sortedData}
                        isAnimationActive
                    >
                        <LabelList position="right" fill="#888" stroke="none" dataKey="name" />
                        {sortedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Funnel>
                </FunnelChart>
            );
        } else if (type === 'sankey') {
            // Mock Sankey Data structure
            const nodes = [{ name: 'Total' }];
            const links = [];

            if (chartData.length) {
                chartData.forEach((d, i) => {
                    nodes.push({ name: d.name });
                    links.push({ source: 0, target: i + 1, value: Number(d[yFields[0]?.name]) || 1 });
                });
            }

            const sankeyData = { nodes, links };
            if (nodes.length > 50) return <div className="flex items-center justify-center h-full text-gray-500">Too many nodes for Sankey</div>;

            return (
                <Sankey
                    width={960}
                    height={500}
                    data={sankeyData}
                    node={{ stroke: 'none', fill: 'var(--accent)' }}
                    link={{ stroke: '#77c878' }}
                >
                    <Tooltip contentStyle={tooltipStyle} />
                </Sankey>
            );
        } else if (type === 'heatmap') {
            // Visualize as Scatter with Rect shapes
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;

            return (
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis dataKey={yField.name} stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                    <Scatter data={chartData} shape={(props) => {
                        const { cx, cy } = props;
                        const op = Math.random() * 0.8 + 0.2;
                        return <rect x={cx - 15} y={cy - 15} width={30} height={30} fill="var(--accent)" fillOpacity={op} />;
                    }} />
                </ScatterChart>
            )
        } else if (type === 'waterfall') {
            yField = yFields.find(f => f.type === 'measure') || yFields[0];
            if (!yField) return null;

            let cumulative = 0;
            const waterfallData = chartData.map(d => {
                const val = Number(d[yField.name]) || 0;
                const prev = cumulative;
                cumulative += val;
                return { ...d, min: prev, max: cumulative, value: val };
            });

            return (
                <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} angle={-45} textAnchor="end" height={60} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="var(--accent)" shape={(props) => {
                        const { x, y, width, height, payload } = props;
                        return <rect x={x} y={y} width={width} height={height} fill={payload.value >= 0 ? '#10b981' : '#ef4444'} radius={[2, 2, 2, 2]} />;
                    }} />
                </BarChart>
            );
        } else if (type === 'geo') {
            return (
                <div className="flex items-center justify-center w-full h-full relative p-8">
                    <svg viewBox="0 0 1000 500" className="w-full h-full opacity-20 pointer-events-none absolute">
                        <path d="M500,250 L1000,500 L0,500 Z" fill="#333" />
                        <text x="500" y="250" textAnchor="middle" fill="#555" fontSize="50">World Map</text>
                    </svg>

                    <ScatterChart width={800} height={400}>
                        <XAxis type="number" dataKey="x" hide domain={[-180, 180]} />
                        <YAxis type="number" dataKey="y" hide domain={[-90, 90]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                        <Scatter name="Locations" data={chartData.map(d => ({ ...d, x: (Math.random() * 360) - 180, y: (Math.random() * 180) - 90 }))} fill="#f59e0b">
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </div>
            )
        } else if (type === 'stream') {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id="colorStream" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.8} />
                        </linearGradient>
                    </defs>
                    {commonAxis}
                    <Area type="monotone" dataKey={yField.name} stackId="1" stroke="none" fill="url(#colorStream)" />
                </AreaChart>
            );
        }

        // Standard Charts (Bar, Line, Area, Auto)
        xField = xFields.find(f => f.type === 'dimension') || xFields[0];
        yField = yFields.find(f => f.type === 'measure') || yFields[0];
        if (!xField || !yField) return null;

        const commonProps = {
            data: chartData,
            margin: { top: 20, right: 30, left: 20, bottom: 60 },
        };
        const commonAxis = (
            <>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} angle={-45} textAnchor="end" height={60} axisLine={{ stroke: 'var(--border-strong)' }} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--bg-panel-hover)' }} contentStyle={tooltipStyle} />
                {shelves.showLegend && <Legend />}
            </>
        );

        if (type === 'line' || type === 'line-step') {
            return (
                <LineChart {...commonProps}>
                    {commonAxis}
                    <Line
                        type={type === 'line-step' ? 'step' : 'monotone'}
                        dataKey={yField.name}
                        stroke="var(--accent)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 8 }}
                    />
                </LineChart>
            );
        } else if (type === 'area' || type === 'area-stacked') {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {commonAxis}
                    <Area
                        type="monotone"
                        dataKey={yField.name}
                        stroke="var(--accent)"
                        stackId={type === 'area-stacked' ? '1' : undefined}
                        fillOpacity={1}
                        fill="url(#colorArea)"
                    />
                </AreaChart>
            );
        } else if (type === 'bar-horizontal') {
            return (
                <BarChart {...commonProps} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <Tooltip cursor={{ fill: 'var(--bg-panel-hover)' }} contentStyle={tooltipStyle} />
                    {shelves.showLegend && <Legend />}
                    <Bar dataKey={yField.name} fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            );
        } else if (type === 'bar' || type === 'bar-stacked') {
            return (
                <BarChart {...commonProps}>
                    {commonAxis}
                    <Bar
                        dataKey={yField.name}
                        fill="var(--accent)"
                        stackId={type === 'bar-stacked' ? 'a' : undefined}
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                    />
                </BarChart>
            );
        }

        // Auto Logic fallback
        if (xField.name.includes('date') || xField.name.includes('_at')) {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {commonAxis}
                    <Area type="monotone" dataKey={yField.name} stroke="var(--accent)" fillOpacity={1} fill="url(#colorPrimary)" />
                </AreaChart>
            );
        } else {
            return (
                <BarChart {...commonProps}>
                    {commonAxis}
                    <Bar dataKey={yField.name} fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
            );
        }
    };

    return (
        <div className="flex-1 bg-[var(--bg-app)] relative overflow-hidden flex flex-col">
            {!chartData.length ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 select-none">
                    <div className="w-64 h-48 border-2 border-dashed border-[var(--border-strong)] rounded-lg flex items-center justify-center mb-4">
                        <span className="text-secondary text-xs uppercase tracking-wider">Empty Worksheet</span>
                    </div>
                    <p className="text-sm">Drag a <b>Dimension</b> to Columns and a <b>Measure</b> to Rows</p>
                </div>
            ) : (
                <div className="flex-1 w-full h-full p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
