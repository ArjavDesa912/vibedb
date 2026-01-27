import React, { useState, useRef, useEffect } from 'react';
import { FileDown, FileUp, File, Save, Settings } from 'lucide-react';

export default function FileMenu({ onSave, onLoad, config }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "workbook_config.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setIsOpen(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                onLoad(json);
                alert("Configuration loaded successfully!");
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
        setIsOpen(false);
        e.target.value = null; // Reset
    };

    return (
        <div className="relative text-xs font-medium text-gray-400" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`hover:text-white transition-colors ${isOpen ? 'text-white' : ''}`}
            >
                File
            </button>

            {isOpen && (
                <div className="absolute top-8 left-0 w-48 bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-xl rounded-md z-50 flex flex-col py-1 text-gray-300">
                    <button
                        onClick={() => { onLoad(null); setIsOpen(false); }} // Reset for New
                        className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-hover)] text-left"
                    >
                        <File className="w-4 h-4 text-gray-500" /> New Workbook
                    </button>
                    <div className="h-px bg-[var(--border-subtle)] my-1" />

                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-hover)] text-left"
                    >
                        <FileUp className="w-4 h-4 text-gray-500" /> Open from File...
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleFileChange}
                    />

                    <button
                        onClick={() => { onSave(); setIsOpen(false); }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-hover)] text-left"
                    >
                        <Save className="w-4 h-4 text-gray-500" /> Save to Database
                    </button>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-hover)] text-left"
                    >
                        <FileDown className="w-4 h-4 text-gray-500" /> Export Configuration
                    </button>

                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-hover)] text-left text-gray-500 cursor-not-allowed">
                        <Settings className="w-4 h-4" /> Settings
                    </button>
                </div>
            )}
        </div>
    );
}
