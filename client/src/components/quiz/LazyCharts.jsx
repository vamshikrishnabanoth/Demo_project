import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

export function ScoreDistributionChart({ data, tooltip }) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="range" stroke="var(--text-secondary)" tick={{ fontSize: 12, fontWeight: 700 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12, fontWeight: 700 }} />
                <Tooltip content={tooltip} />
                <Bar dataKey="count" name="Students" radius={[8, 8, 0, 0]} />
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
