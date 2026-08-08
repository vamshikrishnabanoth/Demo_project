import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    AreaChart, Area
} from 'recharts';

export function ScoreDistributionChart({ data, tooltip, name = "Students" }) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fontSize: 12, fontWeight: 700 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12, fontWeight: 700 }} />
                <Tooltip content={tooltip} />
                <Bar dataKey="count" name={name} radius={[8, 8, 0, 0]} />
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
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={themePalette[index % themePalette.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export function TimeSpentChart({ data, onQuestionClick }) {
    const renderDot = (props) => {
        const { cx, cy, payload } = props;
        if (!cx || !cy || !payload) return null;
        let fillColor = '#10b981';
        if (payload.isCorrect === false) fillColor = '#ef4444';
        if (payload.isCorrect === null || payload.status === 'Skipped') fillColor = '#64748b';

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
                <div className="bg-slate-900/90 text-white border border-purple-500/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl space-y-1">
                    <p className="font-black text-sm text-purple-300 italic">{dataPoint.name}</p>
                    <p className="text-xs font-bold text-slate-200">
                        Time Spent (Seconds) : <span className="font-black text-amber-400">{dataPoint.timeSpent}s</span>
                    </p>
                    {dataPoint.status && (
                        <p className={`text-[11px] font-black uppercase tracking-wider ${
                            dataPoint.isCorrect ? 'text-emerald-400' : dataPoint.isCorrect === false ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                            {dataPoint.status} {dataPoint.isCorrect ? '✓' : dataPoint.isCorrect === false ? '✗' : '-'}
                        </p>
                    )}
                    <p className="text-[9px] font-bold text-purple-400/80 italic mt-1">Click to analyze question</p>
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
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
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
                                    fill="#94a3b8"
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
                    stroke="#94a3b8"
                    unit="s"
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
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
