/**
 * KPI Card Component
 * Displays key metrics with optional trend indicators.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIBlock as KPIBlockType, KPIGroupBlock as KPIGroupBlockType, KPIData } from '../../types';

interface KPICardProps {
    data: KPIData;
}

const KPICard: React.FC<KPICardProps> = ({ data }) => {
    const getTrendIcon = () => {
        if (!data.trend || !data.trendDirection) return null;

        switch (data.trendDirection) {
            case 'up':
                return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'down':
                return <TrendingDown className="w-4 h-4 text-red-500" />;
            case 'neutral':
                return <Minus className="w-4 h-4 text-gray-400" />;
            default:
                return null;
        }
    };

    const getTrendColor = () => {
        if (!data.trendDirection) return 'text-gray-500';
        switch (data.trendDirection) {
            case 'up':
                return 'text-green-500';
            case 'down':
                return 'text-red-500';
            default:
                return 'text-gray-500';
        }
    };

    return (
        <div className="kpi-card bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    {data.title}
                </p>
                {data.trend && (
                    <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                        {getTrendIcon()}
                        <span className="text-xs font-medium">{data.trend}</span>
                    </div>
                )}
            </div>
            <p className="text-3xl font-bold text-gray-800">{data.value}</p>
            {data.subtitle && (
                <p className="text-xs text-gray-400 mt-1">{data.subtitle}</p>
            )}
        </div>
    );
};

// Single KPI Block
interface SingleKPIBlockProps {
    block: KPIBlockType;
}

export const KPIBlockComponent: React.FC<SingleKPIBlockProps> = ({ block }) => {
    return (
        <div className="kpi-single mb-4">
            <KPICard data={block.data} />
        </div>
    );
};

// KPI Group Block
interface KPIGroupBlockProps {
    block: KPIGroupBlockType;
}

export const KPIGroupBlockComponent: React.FC<KPIGroupBlockProps> = ({ block }) => {
    return (
        <div className="kpi-group grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {block.data.items.map((item, index) => (
                <KPICard key={index} data={item} />
            ))}
        </div>
    );
};

export default KPICard;
