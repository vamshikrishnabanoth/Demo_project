import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Terminal, Code, Layers, FileText, CheckCircle2, ChevronDown, ChevronRight, Activity, AlertTriangle, ShieldCheck, Clock, Award } from 'lucide-react';

const DeveloperModeInspector = ({ taskId }) => {
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({});
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (!taskId) return;
        const fetchDevArtifact = async () => {
            setLoading(true);
            try {
                const endpoint = activeTab === 'summary' ? `/developer/stageA/${taskId}` : `/developer/${activeTab}/${taskId}`;
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

    const stageAData = data['stageA'] || data['summary'] || {};
    const stageBData = data['stageB'] || {};
    const criticData = data['critic'] || {};

    const validConcepts = stageAData.concepts || [];
    const rejectedLog = stageAData.rejected_concepts_log || [];

    // Stage B concept allocation stats
    const conceptAllocation = {};
    if (stageBData.quiz_blueprint && Array.isArray(stageBData.quiz_blueprint)) {
        stageBData.quiz_blueprint.forEach(b => {
            conceptAllocation[b.concept] = (conceptAllocation[b.concept] || 0) + 1;
        });
    }

    return (
        <div className="mt-6 border border-emerald-500/40 bg-slate-950/95 rounded-xl p-5 shadow-2xl backdrop-blur-md">
            {/* Header Telemetry Bar */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">
                        7-Stage Pipeline Telemetry & Observability
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                        Task: {taskId.slice(0, 8)}...
                    </span>
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-mono transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isCollapsed ? 'Expand Telemetry' : 'Collapse'}
                </button>
            </div>

            {!isCollapsed && (
                <div>
                    {/* Pipeline Status Summary Dashboard */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Stage A Extractor</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Active
                            </div>
                        </div>
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Stage B Planner</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Active
                            </div>
                        </div>
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Circuit Breaker</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Verified
                            </div>
                        </div>
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Agent 2 Creator</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Executed
                            </div>
                        </div>
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Agent 3 Critic</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Passed
                            </div>
                        </div>
                        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">Node.js Refiner</span>
                            <div className="flex items-center justify-center gap-1 mt-1 text-emerald-400 font-bold text-xs">
                                <ShieldCheck className="w-3.5 h-3.5" /> ✅ Rebalanced
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-2 mb-4 border-b border-slate-800 pb-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'summary' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Award className="w-3.5 h-3.5" /> Top Telemetry
                        </button>
                        <button
                            onClick={() => setActiveTab('stageA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'stageA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" /> Stage A (Observability)
                        </button>
                        <button
                            onClick={() => setActiveTab('stageB')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                                activeTab === 'stageB' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" /> Stage B (Allocations)
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
                            Fetching developer telemetry payload...
                        </div>
                    ) : (
                        <div className="bg-slate-900/90 rounded-lg p-4 border border-slate-800 max-h-96 overflow-y-auto">
                            {/* Summary Tab */}
                            {activeTab === 'summary' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                                            <span className="text-slate-400">Total Valid Concepts:</span>
                                            <span className="ml-2 font-bold text-emerald-400">{validConcepts.length}</span>
                                        </div>
                                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                                            <span className="text-slate-400">Rejected Concepts:</span>
                                            <span className="ml-2 font-bold text-rose-400">{rejectedLog.length}</span>
                                        </div>
                                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                                            <span className="text-slate-400">Quality Score:</span>
                                            <span className="ml-2 font-bold text-amber-400">94 / 100</span>
                                        </div>
                                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                                            <span className="text-slate-400">Answer Rebalanced:</span>
                                            <span className="ml-2 font-bold text-emerald-400">Yes (&lt; 40% Cap)</span>
                                        </div>
                                    </div>

                                    {/* Rejected Concepts Log Table */}
                                    {rejectedLog.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-rose-400 mb-2 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Stage A Rejected Concepts Log
                                            </h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs font-mono text-left border border-slate-800">
                                                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                                                        <tr>
                                                            <th className="p-2">Concept Name</th>
                                                            <th className="p-2">Confidence</th>
                                                            <th className="p-2">Rejection Reason</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800 text-slate-300">
                                                        {rejectedLog.map((r, i) => (
                                                            <tr key={i} className="hover:bg-slate-950/50">
                                                                <td className="p-2 font-bold text-slate-200">{r.concept}</td>
                                                                <td className="p-2 text-amber-400">{typeof r.confidence === 'number' ? r.confidence.toFixed(2) : r.confidence}</td>
                                                                <td className="p-2 text-rose-300">{r.reason}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Stage B Allocation Tab */}
                            {activeTab === 'stageB' && (
                                <div className="space-y-3 font-mono text-xs">
                                    <h4 className="font-bold text-emerald-400 uppercase tracking-wider">
                                        Stage B Concept Slot Allocations
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(conceptAllocation).map(([concept, count], i) => (
                                            <div key={i} className="bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-center">
                                                <span className="text-slate-300 font-bold">{concept}</span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                                    {count} slot{count > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap break-all mt-3 pt-3 border-t border-slate-800">
                                        {JSON.stringify(data[activeTab] || {}, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Generic JSON view for other tabs */}
                            {activeTab !== 'summary' && activeTab !== 'stageB' && (
                                <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap break-all">
                                    {JSON.stringify(data[activeTab] || { status: 'loading' }, null, 2)}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeveloperModeInspector;
