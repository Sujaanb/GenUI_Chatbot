/**
 * Bar Chart Block Component
 * Displays bar chart using Recharts.
 * Supports click-to-drill-down functionality.
 */

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { BarChartBlock as BarChartBlockType } from '../../types';

// Default colors for chart bars
const DEFAULT_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
];

interface BarChartBlockProps {
    block: BarChartBlockType;
    onDrillDown?: (query: string) => void;
}

export const BarChartBlock: React.FC<BarChartBlockProps> = ({ block, onDrillDown }) => {
    const { data } = block;

    // Transform data for Recharts format
    const chartData = data.labels.map((label, index) => {
        const dataPoint: Record<string, string | number> = { name: label };
        data.datasets.forEach((dataset, datasetIndex) => {
            const key = dataset.name || `Series ${datasetIndex + 1}`;
            dataPoint[key] = dataset.values[index] ?? 0;
        });
        return dataPoint;
    });

    // Handle bar click for drill-down
    const handleBarClick = (barData: Record<string, unknown>) => {
        if (onDrillDown && barData?.name) {
            const query = `Show me ONLY the details about "${barData.name}". Do not include information about other categories.`;
            onDrillDown(query);
        }
    };

    return (
        <div className="bar-chart-block bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            {data.title && (
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{data.title}</h3>
            )}
            {onDrillDown && (
                <p className="text-xs text-gray-400 mb-2">💡 Click on a bar to explore</p>
            )}
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: '#6B7280' }}
                            axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#6B7280' }}
                            axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                            cursor={onDrillDown ? { fill: 'rgba(59, 130, 246, 0.1)' } : undefined}
                        />
                        {data.datasets.length > 1 && <Legend />}
                        {data.datasets.map((dataset, index) => (
                            <Bar
                                key={index}
                                dataKey={dataset.name || `Series ${index + 1}`}
                                fill={dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                                onClick={handleBarClick}
                                className={onDrillDown ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BarChartBlock;
