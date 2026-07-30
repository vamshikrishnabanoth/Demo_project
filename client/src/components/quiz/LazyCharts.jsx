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
