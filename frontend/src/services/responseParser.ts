/**
 * Response parser for streaming JSON from LLM.
 * Handles partial JSON parsing for progressive rendering.
 */

import type { UIBlock, LLMResponse } from '../types';

/**
 * Attempts to parse a potentially incomplete JSON string.
 * Returns as many complete blocks as possible from the streamed response.
 */
export function parseStreamingResponse(jsonString: string): {
    blocks: UIBlock[];
    isComplete: boolean;
    error: string | null;
} {
    // Trim whitespace
    const trimmed = jsonString.trim();

    if (!trimmed) {
        return { blocks: [], isComplete: false, error: null };
    }

    // Try to parse as complete JSON first
    try {
        const parsed = JSON.parse(trimmed) as LLMResponse;
        if (parsed.blocks && Array.isArray(parsed.blocks)) {
            return { blocks: parsed.blocks, isComplete: true, error: null };
        }
        return { blocks: [], isComplete: true, error: 'Invalid response format: missing blocks array' };
    } catch {
        // Not complete JSON yet, try to extract partial blocks
    }

    // Try to extract complete blocks from partial JSON
    const blocks = extractPartialBlocks(trimmed);
    return { blocks, isComplete: false, error: null };
}

/**
 * Extracts complete block objects from a partial JSON response.
 * Uses regex and bracket matching to find complete JSON objects.
 */
function extractPartialBlocks(partialJson: string): UIBlock[] {
    const blocks: UIBlock[] = [];

    // Find the start of the blocks array
    const blocksMatch = partialJson.match(/"blocks"\s*:\s*\[/);
    if (!blocksMatch || blocksMatch.index === undefined) {
        return blocks;
    }

    const startIndex = blocksMatch.index + blocksMatch[0].length;
    let remaining = partialJson.slice(startIndex);

    // Extract each complete block object
    while (remaining.length > 0) {
        // Skip whitespace and commas
        remaining = remaining.replace(/^[\s,]+/, '');

        if (!remaining.startsWith('{')) {
            break;
        }

        // Find the matching closing brace
        const blockEnd = findMatchingBrace(remaining);
        if (blockEnd === -1) {
            break; // Incomplete block
        }

        const blockJson = remaining.slice(0, blockEnd + 1);
        try {
            const block = JSON.parse(blockJson) as UIBlock;
            if (block.type) {
                blocks.push(block);
            }
        } catch {
            // Invalid JSON, skip
        }

        remaining = remaining.slice(blockEnd + 1);
    }

    return blocks;
}

/**
 * Finds the index of the matching closing brace for an opening brace at index 0.
 */
function findMatchingBrace(str: string): number {
    if (!str.startsWith('{')) {
        return -1;
    }

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\' && inString) {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }

    return -1; // No matching brace found
}

/**
 * Validates that a block has the required structure.
 */
export function isValidBlock(block: unknown): block is UIBlock {
    if (typeof block !== 'object' || block === null) {
        return false;
    }

    const typedBlock = block as Record<string, unknown>;

    if (typeof typedBlock.type !== 'string') {
        return false;
    }

    const validTypes = [
        'markdown',
        'kpi',
        'kpiGroup',
        'barChart',
        'lineChart',
        'pieChart',
        'table',
        'list'
    ];

    return validTypes.includes(typedBlock.type);
}

/**
 * Extracts plain text from blocks for export purposes.
 */
export function blocksToPlainText(blocks: UIBlock[]): string {
    return blocks.map(block => {
        switch (block.type) {
            case 'markdown':
                return block.content;
            case 'kpi':
                return `${block.data.title}: ${block.data.value}`;
            case 'kpiGroup':
                return block.data.items.map(item => `${item.title}: ${item.value}`).join('\n');
            case 'barChart':
            case 'lineChart':
                if (block.data.title) {
                    return `[Chart: ${block.data.title}]`;
                }
                return '[Chart]';
            case 'pieChart':
                if (block.data.title) {
                    return `[Pie Chart: ${block.data.title}]`;
                }
                return '[Pie Chart]';
            case 'table':
                if (block.data.title) {
                    return `[Table: ${block.data.title}]`;
                }
                return '[Table]';
            case 'list':
                const prefix = block.data.title ? `${block.data.title}:\n` : '';
                return prefix + block.data.items.map((item, i) =>
                    block.data.ordered ? `${i + 1}. ${item}` : `• ${item}`
                ).join('\n');
            default:
                return '';
        }
    }).filter(Boolean).join('\n\n');
}
