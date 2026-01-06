/**
 * Data Table Block Component
 * Displays tabular data with styling.
 * Supports click-to-drill-down functionality on rows.
 */

import React from 'react';
import type { TableBlock as TableBlockType } from '../../types';

interface DataTableBlockProps {
    block: TableBlockType;
    onDrillDown?: (query: string) => void;
}

export const DataTableBlock: React.FC<DataTableBlockProps> = ({ block, onDrillDown }) => {
    const { data } = block;

    // Handle row click for drill-down
    const handleRowClick = (row: (string | number)[]) => {
        if (onDrillDown && row.length > 0) {
            const firstCol = row[0];
            const query = `Show me ONLY the details about "${firstCol}". Do not include information about other items.`;
            onDrillDown(query);
        }
    };

    return (
        <div className="table-block bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            {data.title && (
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">{data.title}</h3>
                    {onDrillDown && (
                        <span className="text-xs text-gray-400">💡 Click a row to explore</span>
                    )}
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50">
                            {data.columns.map((column, index) => (
                                <th
                                    key={index}
                                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-100"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.rows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`transition-colors ${onDrillDown
                                    ? 'hover:bg-blue-50 cursor-pointer'
                                    : 'hover:bg-gray-50'
                                    }`}
                                onClick={() => onDrillDown && handleRowClick(row)}
                            >
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className="px-4 py-3 text-sm text-gray-700"
                                    >
                                        {formatCellValue(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {data.rows.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                    No data available
                </div>
            )}
        </div>
    );
};

/**
 * Format cell value for display
 */
function formatCellValue(value: string | number): React.ReactNode {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }

    // Check for status-like values and add color coding
    const valueLower = value.toLowerCase();

    if (['open', 'pending', 'in progress', 'active'].includes(valueLower)) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {value}
            </span>
        );
    }

    if (['closed', 'resolved', 'completed', 'done'].includes(valueLower)) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {value}
            </span>
        );
    }

    if (['critical', 'high', 'urgent', 'error', 'failed'].includes(valueLower)) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {value}
            </span>
        );
    }

    if (['medium', 'normal', 'moderate'].includes(valueLower)) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {value}
            </span>
        );
    }

    if (['low', 'minor'].includes(valueLower)) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {value}
            </span>
        );
    }

    return value;
}

export default DataTableBlock;
