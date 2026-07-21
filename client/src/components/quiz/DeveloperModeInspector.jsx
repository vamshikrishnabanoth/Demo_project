import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Terminal, Code, Layers, FileText, CheckCircle2, ChevronDown, ChevronRight, Activity } from 'lucide-react';

const DeveloperModeInspector = ({ taskId }) => {
    const [activeTab, setActiveTab] = useState('stageA');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({});
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (!taskId) return;
        const fetchDevArtifact = async () => {
            setLoading(true);
            try {
                const endpoint = `/developer/${activeTab}/${taskId}`;
                const res = await api.get(endpoint);
                setData(prev => ({ ...prev, [activeTab]: res.data }));
            } catch (err) {
                console.warn(`Developer Mode fetch error for ${activeTab}:`, err);
                setData(prev => ({ ...prev, [activeTab]: { error: 'Artifact pending or taskId expired' } }));
            } finally {
                setLoading(false);
            }
        };
        fetchDevArtifact();
    }, [taskId, activeTab]);

    if (!taskId) return null;

    return (
        <div className="mt-6 border border-emerald-500/30 bg-slate-950/90 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                        5-Stage Developer Pipeline Inspector
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        Task: {taskId.slice(0, 8)}...
                    </span>
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-mono"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isCollapsed ? 'Expand JSON' : 'Collapse'}
                </button>
            </div>

            {!isCollapsed && (
                <div>
                    {/* Navigation Tabs */}
                    <div className="flex gap-2 mb-3 border-b border-slate-800 pb-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('stageA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'stageA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" /> Stage A (Concepts)
                        </button>
                        <button
                            onClick={() => setActiveTab('stageB')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'stageB' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" /> Stage B (Blueprint)
                        </button>
                        <button
                            onClick={() => setActiveTab('rag')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'rag' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Code className="w-3.5 h-3.5" /> Dual RAG
                        </button>
                        <button
                            onClick={() => setActiveTab('critic')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'critic' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5" /> Critic & Refinement
                        </button>
                    </div>

                    {/* Content Display */}
                    {loading ? (
                        <div className="p-4 text-xs font-mono text-slate-400 animate-pulse">
                            Fetching developer artifact payload from backend...
                        </div>
                    ) : (
                        <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 max-h-80 overflow-y-auto">
                            {data[activeTab]?.promptSummary && (
                                <p className="text-xs text-amber-400/90 font-mono mb-2 border-b border-slate-800 pb-1">
                                    ℹ️ Prompt Summary: {data[activeTab].promptSummary}
                                </p>
                            )}
                            <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap break-all">
                                {JSON.stringify(data[activeTab] || { status: 'loading' }, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeveloperModeInspector;
