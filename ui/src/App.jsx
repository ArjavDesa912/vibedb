import { useState, useEffect, useRef } from 'react';
import DataSidebar from './components/DataSidebar';
import Shelves from './components/Shelves';
import Worksheet from './components/Worksheet';
import SqlConsole from './components/SqlConsole';
import SchemaManager from './components/SchemaManager';
import DashboardView from './components/DashboardView';
import AnalysisView from './components/AnalysisView';
import PulsePanel from './components/PulsePanel';
import FileMenu from './components/FileMenu';
import { AcceleratorGallery } from './components/MoreAdvancedFeatures';
import {
  LayoutGrid, Save, Undo, Redo, Share2, HelpCircle, Database, Terminal, Table as TableIcon,
  Plus, X, Monitor, Palette, Info, Zap,
  Sparkles, BarChart2, AlignLeft, Layers, TrendingUp, Activity, Mountain,
  PieChart, Circle, CircleDot, Disc, Hexagon, Target, Box, Filter as FilterIcon,
  Waves, Thermometer, GitCommit, GitMerge, Map as MapIcon
} from 'lucide-react';

const API_Base = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

const DEFAULT_CONFIG = {
  columns: [],
  rows: [],
  marks: [],
  filters: [],
  showLegend: true,
  showGrid: true,
  colorScheme: 'default', // default, warm, cool
  chartType: 'auto'
};

function App() {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState('');
  const [loading, setLoading] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState('worksheet'); // 'worksheet' | 'dashboard' | 'analysis' | 'database'
  const [dbMode, setDbMode] = useState('console'); // 'console' | 'schema'

  // Multi-Sheet State
  const [sheets, setSheets] = useState([
    { id: 'sheet_1', name: 'Sheet 1', config: { ...DEFAULT_CONFIG } }
  ]);
  const [activeSheetId, setActiveSheetId] = useState('sheet_1');

  // UI States
  const [presentationMode, setPresentationMode] = useState(false);
  const [showFormatPanel, setShowFormatPanel] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAccelerators, setShowAccelerators] = useState(false);

  // Computed Active Config
  const activeSheet = sheets.find(s => s.id === activeSheetId) || sheets[0];
  const vizConfig = activeSheet.config;

  // History for Undo/Redo (Scoped to Global State for simplicity, theoretically should be per-sheet)
  // To keep it simple and "real", we will push the ENTIRE sheets array to history.
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  const pushHistory = (newSheetsState) => {
    const current = historyIndexRef.current;
    const history = historyRef.current;

    // Truncate future if we pushed after undoing
    if (current < history.length - 1) {
      historyRef.current = history.slice(0, current + 1);
    }

    historyRef.current.push(JSON.stringify({ sheets: newSheetsState, activeSheetId }));
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const updateActiveConfig = (key, value) => {
    const newSheets = sheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        return { ...sheet, config: { ...sheet.config, [key]: value } };
      }
      return sheet;
    });
    setSheets(newSheets);
    pushHistory(newSheets);
  };

  const handleAddSheet = () => {
    const nextNum = sheets.length + 1;
    const newId = `sheet_${Date.now()}`;
    const newSheet = { id: newId, name: `Sheet ${nextNum}`, config: { ...DEFAULT_CONFIG } };
    const newSheets = [...sheets, newSheet];
    setSheets(newSheets);
    setActiveSheetId(newId);
    pushHistory(newSheets);
  };

  const handleDeleteSheet = (e, id) => {
    e.stopPropagation();
    if (sheets.length === 1) return; // Cannot delete last sheet
    const newSheets = sheets.filter(s => s.id !== id);
    setSheets(newSheets);
    if (activeSheetId === id) {
      setActiveSheetId(newSheets[0].id);
    }
    pushHistory(newSheets);
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
      setSheets(snapshot.sheets);
      setActiveSheetId(snapshot.activeSheetId);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
      setSheets(snapshot.sheets);
      setActiveSheetId(snapshot.activeSheetId);
    }
  };

  const handleSave = async () => {
    const name = prompt("Enter a name for this worksheet:", activeSheet.name);
    if (!name) return;

    try {
      // Push to backend 'dashboards' table
      const res = await fetch(`${API_Base}/v1/push/vibedb_dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          config: JSON.stringify(vizConfig), // Saving ACTIVE sheet only for now as 'Dashboard' unit
          created_at: new Date().toISOString()
        })
      });

      if (res.ok) alert("Saved active sheet successfully!");
      else alert("Failed to save.");
    } catch (e) {
      console.error(e);
      alert("Error saving dashboard");
    }
  };

  const handleLoadDashboard = (config) => {
    if (config) {
      // Flatten standard config if it comes from saved file
      const safeConfig = { ...DEFAULT_CONFIG, ...config };
      // Load into active sheet
      // (simplified for bulk update) -> actually let's just replace the active sheet config
      const newSheets = sheets.map(s => s.id === activeSheetId ? { ...s, config: safeConfig } : s);
      setSheets(newSheets);
      pushHistory(newSheets);
    } else {
      // Reset
      const newSheets = sheets.map(s => s.id === activeSheetId ? { ...s, config: { ...DEFAULT_CONFIG } } : s);
      setSheets(newSheets);
      pushHistory(newSheets);
    }
    setActiveTab('worksheet');
  };

  const handleApplyTemplate = (config) => {
    if (config) {
      // Apply template config to active sheet
      const newSheets = sheets.map(s => s.id === activeSheetId ? { ...s, config: { ...DEFAULT_CONFIG, ...config } } : s);
      setSheets(newSheets);
      pushHistory(newSheets);

      // Switch to worksheet view to see the result
      setActiveTab('worksheet');

      // If template has specific table requirement, we might try to set it, 
      // but for now we assume user has selected a table or the template is generic enough.
      // In a real app, we'd check if the required table exists in `tables` state.
    }
  };

  // Fetch Tables
  const fetchMetadata = async () => {
    try {
      const res = await fetch(`${API_Base}/v1/tables`);
      const json = await res.json();

      if (json.success) {
        // Fetch stats for all tables in parallel to get columns
        const statsPromises = json.tables.map(name =>
          fetch(`${API_Base}/v1/tables/${name}`).then(r => r.json())
        );

        const statsResults = await Promise.all(statsPromises);
        const detailedTables = statsResults
          .filter(r => r.success)
          .map(r => r.data);

        setTables(detailedTables);
        // Default to first table if valid
        if (detailedTables.length > 0 && !activeTable) {
          setActiveTable(detailedTables[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load metadata", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial history push
    pushHistory(sheets);
    fetchMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once

  // Render logic helper
  const renderContent = () => {
    switch (activeTab) {
      case 'database':
        return (
          <div className="flex flex-col h-full">
            {/* Database Sub-nav */}
            <div className="flex items-center gap-1 bg-[#252526] border-b border-[var(--border-subtle)] px-2">
              <button
                onClick={() => setDbMode('console')}
                className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${dbMode === 'console' ? 'border-[var(--accent)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <Terminal className="w-3 h-3" /> SQL Console
              </button>
              <button
                onClick={() => setDbMode('schema')}
                className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${dbMode === 'schema' ? 'border-[var(--accent)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <TableIcon className="w-3 h-3" /> Schema Manager
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {dbMode === 'console' ? (
                <SqlConsole tables={tables} />
              ) : (
                <SchemaManager tables={tables} onRefresh={fetchMetadata} />
              )}
            </div>
          </div>
        );
      case 'dashboard':
        return <DashboardView onLoadConfig={handleLoadDashboard} />;
      case 'analysis':
        return <AnalysisView tables={tables} />;
      case 'worksheet':
      default:
        return (
          <>
            {/* Left Sidebar (Data Pane) - Hide in Preso Mode */}
            {!presentationMode && (
              <DataSidebar
                tables={tables}
                selectedTable={activeTable}
                onSelectTable={setActiveTable}
                onDragStart={handleDragStart}
              />
            )}

            {/* Center Canvas Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)]">
              {/* Shelves (Pill Drop Zones) - Hide in Preso Mode */}
              {!presentationMode && (
                <Shelves config={vizConfig} onUpdateConfig={updateActiveConfig} />
              )}

              {/* Viz Canvas */}
              <div className="flex-1 relative overflow-hidden flex flex-col">
                <Worksheet tableName={activeTable} shelves={vizConfig} />

                {/* Floating Presentation Mode Warning */}
                {presentationMode && (
                  <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm pointer-events-none">
                    Presentation Mode (Press ESC to exit)
                  </div>
                )}
              </div>

              {/* Bottom Tabs (Sheets) - Hide in Preso Mode */}
              {!presentationMode && (
                <div className="h-8 bg-[var(--bg-header)] border-t border-[var(--border-subtle)] flex items-center px-1 overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => setActiveTab('database')}
                    className="flex items-center px-3 h-full border-r border-[var(--border-subtle)] text-xs font-medium bg-[var(--bg-header)] text-gray-500 hover:text-white flex-shrink-0"
                  >
                    <Database className="w-3 h-3 mr-1" /> SQL
                  </button>

                  {sheets.map(sheet => (
                    <div
                      key={sheet.id}
                      onClick={() => setActiveSheetId(sheet.id)}
                      className={`group flex items-center px-3 h-full border-r border-[var(--border-subtle)] text-xs font-medium border-t-2 cursor-pointer transition-colors flex-shrink-0
                                        ${activeSheetId === sheet.id
                          ? 'bg-[var(--bg-app)] border-t-[var(--accent)] text-gray-200'
                          : 'bg-[var(--bg-header)] border-t-transparent text-gray-500 hover:bg-[var(--bg-hover)]'
                        }`}
                    >
                      <span className="mr-2">{sheet.name}</span>
                      {sheets.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteSheet(e, sheet.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={handleAddSheet}
                    className="flex items-center px-2 h-full hover:bg-[var(--bg-hover)] text-gray-500 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Sidebar (Attributes/Format) */}
            {!presentationMode && (
              <div className="w-12 flex flex-col items-center py-4 border-l border-[var(--border-subtle)] bg-[var(--bg-panel)] relative z-20">
                <button
                  onClick={() => { setShowFormatPanel(!showFormatPanel); setShowPulse(false); }}
                  className={`p-2 mb-2 rounded transition-colors ${showFormatPanel ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-hover)] text-gray-400'}`}
                  title="Format"
                >
                  <Palette className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowPulse(!showPulse); setShowFormatPanel(false); }}
                  className={`p-2 mb-2 rounded transition-colors ${showPulse ? 'bg-purple-600 text-white' : 'hover:bg-[var(--bg-hover)] text-gray-400'}`}
                  title="Vibe Pulse"
                >
                  <Zap className="w-4 h-4" />
                </button>
                <div className="w-6 h-[1px] bg-[var(--border-subtle)] my-2" />
                <button
                  onClick={() => setPresentationMode(true)}
                  className="p-2 mb-2 hover:bg-[var(--bg-hover)] rounded text-gray-400"
                  title="Presentation Mode"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowHelp(true)}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded text-gray-400"
                  title="Help"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pulse Panel Popout */}
            {showPulse && !presentationMode && (
              <PulsePanel tableName={activeTable} />
            )}

            {/* Format Panel Popout */}
            {showFormatPanel && !presentationMode && (
              <div className="w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col p-4 z-10 animate-slide-in-right overflow-y-auto">
                <h3 className="font-bold text-gray-200 mb-6 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Formatting
                </h3>

                {/* Chart Type Selector */}
                <div className="mb-6">
                  <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Chart Type</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'auto', icon: Sparkles, label: 'Auto' },
                      { id: 'bar', icon: BarChart2, label: 'Column' },
                      { id: 'bar-horizontal', icon: AlignLeft, label: 'Bar' },
                      { id: 'bar-stacked', icon: Layers, label: 'Stacked' },
                      { id: 'line', icon: TrendingUp, label: 'Line' },
                      { id: 'line-step', icon: Activity, label: 'Step' },
                      { id: 'area', icon: Mountain, label: 'Area' },
                      { id: 'area-stacked', icon: Layers, label: 'St. Area' },
                      { id: 'pie', icon: PieChart, label: 'Pie' },
                      { id: 'donut', icon: Circle, label: 'Donut' },
                      { id: 'scatter', icon: CircleDot, label: 'Scatter' },
                      { id: 'bubble', icon: Disc, label: 'Bubble' },
                      { id: 'radar', icon: Hexagon, label: 'Radar' },
                      { id: 'radial', icon: Target, label: 'Radial' },
                      { id: 'treemap', icon: Box, label: 'Treemap' },
                      { id: 'treemap', icon: Box, label: 'Treemap' },
                      { id: 'funnel', icon: FilterIcon, label: 'Funnel' },
                      { id: 'stream', icon: Waves, label: 'Stream' },
                      { id: 'waterfall', icon: GitCommit, label: 'Waterfall' },
                      { id: 'heatmap', icon: Thermometer, label: 'Heatmap' },
                      { id: 'sankey', icon: GitMerge, label: 'Sankey' },
                      { id: 'geo', icon: MapIcon, label: 'Map' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => updateActiveConfig('chartType', type.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded border transition-colors aspect-square ${vizConfig.chartType === type.id
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-app)] text-gray-400 border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                          }`}
                        title={type.label}
                      >
                        <type.icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Show Legend</span>
                    <input
                      type="checkbox"
                      checked={vizConfig.showLegend !== false}
                      onChange={(e) => updateActiveConfig('showLegend', e.target.checked)}
                      className="toggle"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Show Grid</span>
                    <input
                      type="checkbox"
                      checked={vizConfig.showGrid !== false}
                      onChange={(e) => updateActiveConfig('showGrid', e.target.checked)}
                      className="toggle"
                    />
                  </div>

                  <div className="pt-4 border-t border-[var(--border-subtle)]">
                    <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Color Scheme</span>
                    <div className="flex gap-2">
                      {['default', 'warm', 'cool'].map(scheme => (
                        <button
                          key={scheme}
                          onClick={() => updateActiveConfig('colorScheme', scheme)}
                          className={`w-6 h-6 rounded-full border-2 ${vizConfig.colorScheme === scheme ? 'border-white' : 'border-transparent'} hover:scale-110 transition-transform`}
                          style={{ background: scheme === 'warm' ? '#f59e0b' : scheme === 'cool' ? '#3b82f6' : '#6366f1' }}
                          title={scheme}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
    }
  };

  const handleDragStart = (e, field) => {
    e.dataTransfer.setData('field', JSON.stringify(field));
  };

  return (
    <div className="flex flex-col h-screen text-gray-100 overflow-hidden font-sans bg-[var(--bg-app)]">

      {/* Top Menu Bar - Hide in Presentation Mode */}
      {!presentationMode && (
        <header className="h-12 flex items-center justify-between px-4 bg-[var(--bg-header)] border-b border-[var(--border-subtle)] select-none">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-violet-400 font-bold tracking-tight">
              <LayoutGrid className="w-5 h-5" />
              <span>EazyVibe <span className="text-gray-400 font-normal">Analytics</span></span>
            </div>

            <div className="h-5 w-px bg-[var(--border-strong)] mx-2" />

            <nav className="flex items-center gap-4 text-xs font-medium text-gray-400">
              <FileMenu onSave={handleSave} onLoad={handleLoadDashboard} config={vizConfig} />
              <button
                onClick={() => setShowAccelerators(true)}
                className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-yellow-400" /> Templates
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`hover:text-white transition-colors ${activeTab === 'database' ? 'text-white font-bold' : ''}`}
              >
                SQL Studio
              </button>
              <button
                onClick={() => setActiveTab('worksheet')}
                className={`hover:text-white transition-colors ${activeTab === 'worksheet' ? 'text-white font-bold' : ''}`}
              >
                Worksheet
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`hover:text-white transition-colors ${activeTab === 'dashboard' ? 'text-white font-bold' : ''}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`hover:text-white transition-colors ${activeTab === 'analysis' ? 'text-white font-bold' : ''}`}
              >
                Analysis
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[var(--bg-panel)] rounded-md border border-[var(--border-subtle)] p-1">
              <button onClick={handleUndo} className="p-1.5 hover:bg-[var(--bg-hover)] rounded text-gray-400 hover:text-white" title="Undo"><Undo className="w-3.5 h-3.5" /></button>
              <button onClick={handleRedo} className="p-1.5 hover:bg-[var(--bg-hover)] rounded text-gray-400 hover:text-white" title="Redo"><Redo className="w-3.5 h-3.5" /></button>
            </div>

            <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded text-xs font-semibold shadow-lg shadow-violet-500/10 transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Loading metadata...
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden w-full h-full relative">
            {renderContent()}

            {showAccelerators && <AcceleratorGallery onClose={() => setShowAccelerators(false)} onApply={handleApplyTemplate} />}

            {/* Help Modal */}
            {showHelp && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <HelpCircle className="w-6 h-6 text-violet-400" /> Help & Shortcuts
                  </h3>
                  <div className="space-y-4 text-sm text-gray-300">
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span>Presentation Mode</span>
                      <span className="font-mono bg-white/10 px-2 rounded">ESC to exit</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span>Save Worksheet</span>
                      <span className="font-mono bg-white/10 px-2 rounded">Ctrl + S</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span>Delete Sheet</span>
                      <span className="font-mono bg-white/10 px-2 rounded">Hover Tab & click X</span>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowHelp(false)}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:opacity-90"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Global Event Listener for ESC to exit presentation mode */}
      {presentationMode && (
        <div className="hidden" ref={() => {
          const handleEsc = (e) => {
            if (e.key === 'Escape') setPresentationMode(false);
          };
          window.addEventListener('keydown', handleEsc);
          return () => window.removeEventListener('keydown', handleEsc);
        }} />
      )}
    </div>
  );
}

export default App;
