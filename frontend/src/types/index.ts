/**
 * Type definitions for UI component blocks.
 * These types match the JSON schema the LLM outputs.
 */

// Base block interface
export interface BaseBlock {
    type: string;
}

// Markdown block
export interface MarkdownBlock extends BaseBlock {
    type: 'markdown';
    content: string;
}

// KPI block
export interface KPIData {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
}

export interface KPIBlock extends BaseBlock {
    type: 'kpi';
    data: KPIData;
}

// KPI Group block
export interface KPIGroupBlock extends BaseBlock {
    type: 'kpiGroup';
    data: {
        items: KPIData[];
    };
}

// Chart dataset
export interface ChartDataset {
    name?: string;
    values: number[];
    color?: string;
}

// Bar Chart block
export interface BarChartBlock extends BaseBlock {
    type: 'barChart';
    data: {
        title?: string;
        labels: string[];
        datasets: ChartDataset[];
    };
}

// Line Chart block
export interface LineChartBlock extends BaseBlock {
    type: 'lineChart';
    data: {
        title?: string;
        labels: string[];
        datasets: ChartDataset[];
    };
}

// Pie Chart segment
export interface PieChartSegment {
    label: string;
    value: number;
    color?: string;
}

// Pie Chart block
export interface PieChartBlock extends BaseBlock {
    type: 'pieChart';
    data: {
        title?: string;
        segments: PieChartSegment[];
    };
}

// Table block
export interface TableBlock extends BaseBlock {
    type: 'table';
    data: {
        title?: string;
        columns: string[];
        rows: (string | number)[][];
    };
}

// List block
export interface ListBlock extends BaseBlock {
    type: 'list';
    data: {
        title?: string;
        items: string[];
        ordered?: boolean;
    };
}

// Union type of all blocks
export type UIBlock =
    | MarkdownBlock
    | KPIBlock
    | KPIGroupBlock
    | BarChartBlock
    | LineChartBlock
    | PieChartBlock
    | TableBlock
    | ListBlock;

// Response format from LLM
export interface LLMResponse {
    blocks: UIBlock[];
}

// Message types for chat
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    isLatest?: boolean;
    parsedBlocks?: UIBlock[];
}

// Uploaded file info
export interface UploadedFile {
    name: string;
    rowCount?: number;
    uploadedAt: Date;
}

// API response types
export interface SessionResponse {
    session_id: string;
    message: string;
}

export interface UploadResponse {
    success: boolean;
    session_id: string;
    message: string;
    content_length?: number;
    filename?: string;
    row_count?: number;
}

export interface HealthResponse {
    status: string;
    version: string;
}
