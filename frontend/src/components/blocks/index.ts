/**
 * Block Components Index
 * Exports all block components for use in the StreamingRenderer.
 */

export { MarkdownBlock } from './MarkdownBlock';
export { KPIBlockComponent, KPIGroupBlockComponent } from './KPICard';
export { BarChartBlock } from './BarChartBlock';
export { LineChartBlock } from './LineChartBlock';
export { PieChartBlock } from './PieChartBlock';
export { DataTableBlock } from './DataTableBlock';
export { ListBlock } from './ListBlock';

// Component registry mapping type names to components
import { MarkdownBlock } from './MarkdownBlock';
import { KPIBlockComponent, KPIGroupBlockComponent } from './KPICard';
import { BarChartBlock } from './BarChartBlock';
import { LineChartBlock } from './LineChartBlock';
import { PieChartBlock } from './PieChartBlock';
import { DataTableBlock } from './DataTableBlock';
import { ListBlock } from './ListBlock';
import type { UIBlock } from '../../types';
import React from 'react';

export const componentRegistry: Record<
    string,
    React.FC<{ block: UIBlock }>
> = {
    markdown: MarkdownBlock as React.FC<{ block: UIBlock }>,
    kpi: KPIBlockComponent as React.FC<{ block: UIBlock }>,
    kpiGroup: KPIGroupBlockComponent as React.FC<{ block: UIBlock }>,
    barChart: BarChartBlock as React.FC<{ block: UIBlock }>,
    lineChart: LineChartBlock as React.FC<{ block: UIBlock }>,
    pieChart: PieChartBlock as React.FC<{ block: UIBlock }>,
    table: DataTableBlock as React.FC<{ block: UIBlock }>,
    list: ListBlock as React.FC<{ block: UIBlock }>,
};
