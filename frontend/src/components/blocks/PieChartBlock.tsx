/**
 * Pie Chart Block Component
 * Displays pie/donut chart using Recharts.
 * Supports click-to-drill-down functionality.
 */

import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { PieChartBlock as PieChartBlockType } from '../../types';

// Default colors for pie segments
const DEFAULT_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
];

interface PieChartBlockProps {
    block: PieChartBlockType;
    onDrillDown?: (query: string) => void;
}

export const PieChartBlock: React.FC<PieChartBlockProps> = ({ block, onDrillDown }) => {
    const { data } = block;

    // Transform data for Recharts format
    const chartData = data.segments.map((segment, index) => ({
        name: segment.label,
        value: segment.value,
        color: segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));

    // Calculate total for percentage
    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    // Handle segment click for drill-down
    const handleSegmentClick = (segmentData: { name: string; value: number }) => {
        if (onDrillDown && segmentData?.name) {
            const query = `Show me ONLY the details about "${segmentData.name}". Do not include information about other categories.`;
            onDrillDown(query);
        }
    };

    // Custom label renderer
    const renderLabel = ({
        cx,
        cy,
        midAngle,
        innerRadius,
        outerRadius,
        percent,
    }: {
        cx: number;
        cy: number;
        midAngle: number;
        innerRadius: number;
        outerRadius: number;
        percent: number;
    }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent < 0.05) return null; // Don't show label for small segments

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-xs font-medium"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="pie-chart-block bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            {data.title && (
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{data.title}</h3>
            )}
            {onDrillDown && (
                <p className="text-xs text-gray-400 mb-2">💡 Click on a segment to explore</p>
            )}
            <div className="h-[480px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderLabel}
                            outerRadius={180}
                            innerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            onClick={(_, index) => handleSegmentClick(chartData[index])}
                            className={onDrillDown ? 'cursor-pointer' : ''}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    className={onDrillDown ? 'hover:opacity-80 transition-opacity' : ''}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => [
                                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                                '',
                            ]}
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                        />
                        <Legend
                            layout="horizontal"
                            align="center"
                            verticalAlign="bottom"
                            iconType="circle"
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PieChartBlock;
