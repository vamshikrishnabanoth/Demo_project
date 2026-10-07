import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    AreaChart, Area
} from 'recharts';
import { BIN_COLORS } from '../../utils/binColors';

export function ScoreDistributionChart({ data, tooltip, name = "Students", height = 280 }) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fontSize: 11, fontWeight: 800 }} interval={0} />
                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12, fontWeight: 700 }} />
                <Tooltip content={tooltip} />
                <Bar dataKey="count" name={name} radius={[8, 8, 0, 0]}>
                    {(data || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || BIN_COLORS[index % BIN_COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export function AccuracyPieChart({ data, colors }) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}

export function MasteryRadarChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <RadarChart cx="50%" cy="50%" outerRadius={80} data={data}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--text-secondary)" tick={{ fontSize: 11, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Mastery" dataKey="A" stroke="var(--bg-accent)" fill="var(--bg-accent)" fillOpacity={0.4} />
            </RadarChart>
        </ResponsiveContainer>
    );
}

export function QuestionPerformanceChart({ data, themePalette, onQuestionClick, CustomTooltip }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart 
                data={data} 
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length) {
                        onQuestionClick(state.activePayload[0].payload.index);
                    }
                }}
                style={{ cursor: 'pointer' }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                    dataKey="name" 
                    stroke="#334155" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={(props) => {
                        const { x, y, payload } = props;
                        if (!payload) return null;
                        const qNum = parseInt(payload.value.replace('Q', ''), 10) - 1;
                        return (
                            <g 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onQuestionClick(qNum);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <text 
                                    x={x} 
                                    y={y + 15} 
                                    textAnchor="middle" 
                                    fill="#334155" 
                                    className="font-bold hover:fill-[var(--text-accent)] transition-colors hover:underline"
                                    style={{ fontSize: '12px', fontWeight: 700 }}
                                >
                                    {payload.value}
                                </text>
                            </g>
                        );
                    }}
                />
                <YAxis stroke="#334155" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={CustomTooltip ? <CustomTooltip /> : undefined} cursor={{ fill: 'rgba(19,62,135,0.06)' }} />
                <Bar dataKey="correct" name="Correct Answers" radius={[8, 8, 0, 0]} maxBarSize={50}>
                    {data.map((entry, index) => {
                        const palette = themePalette || BIN_COLORS;
                        return <Cell key={`cell-${index}`} fill={entry.fill || palette[index % palette.length]} />;
                    })}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export function TimeSpentChart({ data, onQuestionClick }) {
    const renderDot = (props) => {
        const { cx, cy, payload } = props;
        if (!cx || !cy || !payload) return null;
        let fillColor = '#0284c7';
        if (payload.isCorrect === true) {
            fillColor = '#10b981';
        } else if (payload.isCorrect === false) {
            fillColor = '#ef4444';
        } else if (payload.accuracy !== undefined) {
            fillColor = payload.accuracy >= 70 ? '#10b981' : payload.accuracy >= 40 ? '#f59e0b' : '#ef4444';
        } else if (payload.status === 'Skipped') {
            fillColor = '#64748b';
        }

        return (
            <circle
                key={`dot-${payload.index}`}
                cx={cx}
                cy={cy}
                r={6}
                fill={fillColor}
                stroke="#ffffff"
                strokeWidth={2}
                onClick={(e) => {
                    e.stopPropagation();
                    if (typeof payload.index === 'number') {
                        onQuestionClick(payload.index);
                    }
                }}
                style={{ cursor: 'pointer' }}
                className="transition-transform hover:scale-150"
            />
        );
    };

    const TimeTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div className="bg-slate-900 text-white border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl space-y-1.5 min-w-[190px]">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                        <p className="font-black text-sm text-sky-400">{dataPoint.name}</p>
                        {dataPoint.accuracy !== undefined && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {dataPoint.accuracy}% accuracy
                            </span>
                        )}
                    </div>
                    <p className="text-xs font-bold text-slate-200 flex items-center justify-between">
                        <span>{dataPoint.label || 'Time Spent'}:</span>
                        <span className="font-black text-amber-400">{dataPoint.timeSpent ?? 0}s</span>
                    </p>
                    {dataPoint.avgTimeSpent !== undefined && dataPoint.avgTimeSpent !== dataPoint.timeSpent && (
                        <p className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                            <span>Class Avg:</span>
                            <span className="font-bold text-slate-300">{dataPoint.avgTimeSpent}s</span>
                        </p>
                    )}
                    {dataPoint.status && (
                        <div className="pt-1">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                dataPoint.isCorrect === true ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                dataPoint.isCorrect === false ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                'bg-slate-800 text-slate-300'
                            }`}>
                                {dataPoint.status}
                            </span>
                        </div>
                    )}
                    <p className="text-[9px] font-bold text-slate-400 italic pt-1 border-t border-slate-800/80">
                        Click to analyze question →
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart
                data={data}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length) {
                        onQuestionClick(state.activePayload[0].payload.index);
                    }
                }}
                style={{ cursor: 'pointer' }}
            >
                <defs>
                    <linearGradient id="timeSpentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.7} vertical={false} />
                <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={(props) => {
                        const { x, y, payload } = props;
                        if (!payload) return null;
                        const qNum = parseInt(payload.value.replace('Q', ''), 10) - 1;
                        return (
                            <g
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onQuestionClick(qNum);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <text
                                    x={x}
                                    y={y + 15}
                                    textAnchor="middle"
                                    fill="#64748b"
                                    className="font-bold hover:fill-[var(--text-accent)] transition-colors hover:underline"
                                    style={{ fontSize: '12px', fontWeight: 700 }}
                                >
                                    {payload.value}
                                </text>
                            </g>
                        );
                    }}
                />
                <YAxis
                    stroke="#64748b"
                    unit="s"
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip content={<TimeTooltip />} />
                <Area
                    type="monotone"
                    dataKey="timeSpent"
                    stroke="#0284c7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#timeSpentGradient)"
                    dot={renderDot}
                    activeDot={{ r: 9, stroke: '#ffffff', strokeWidth: 3 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
