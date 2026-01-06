/**
 * Line Chart Block Component
 * Displays line chart using Recharts.
 * Supports click-to-drill-down functionality.
 */

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { LineChartBlock as LineChartBlockType } from '../../types';

// Default colors for chart lines
const DEFAULT_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
];

interface LineChartBlockProps {
    block: LineChartBlockType;
    onDrillDown?: (query: string) => void;
}

export const LineChartBlock: React.FC<LineChartBlockProps> = ({ block, onDrillDown }) => {
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

    // Handle chart click for drill-down
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChartClick = (chartEvent: any) => {
        if (onDrillDown && chartEvent?.activePayload?.[0]?.payload?.name) {
            const pointName = chartEvent.activePayload[0].payload.name;
            const query = `Show me ONLY the details for "${pointName}". Do not include information about other time periods.`;
            onDrillDown(query);
        }
    };

    return (
        <div className="line-chart-block bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            {data.title && (
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{data.title}</h3>
            )}
            {onDrillDown && (
                <p className="text-xs text-gray-400 mb-2">💡 Click on a data point to explore</p>
            )}
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        onClick={onDrillDown ? handleChartClick : undefined}
                        style={{ cursor: onDrillDown ? 'pointer' : 'default' }}
                    >
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
                        />
                        {data.datasets.length > 1 && <Legend />}
                        {data.datasets.map((dataset, index) => (
                            <Line
                                key={index}
                                type="monotone"
                                dataKey={dataset.name || `Series ${index + 1}`}
                                stroke={dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                                strokeWidth={2}
                                dot={{
                                    fill: dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                                    strokeWidth: 2,
                                    r: 4,
                                }}
                                activeDot={{
                                    r: 8,
                                    stroke: dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                                    strokeWidth: 2,
                                    fill: 'white',
                                }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default LineChartBlock;

