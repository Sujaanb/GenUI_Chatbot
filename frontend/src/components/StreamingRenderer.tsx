/**
 * Streaming Renderer Component
 * Parses streaming JSON response and renders UI blocks progressively.
 */

import React, { useMemo } from 'react';
import { parseStreamingResponse } from '../services/responseParser';
import { componentRegistry } from './blocks';
import type { UIBlock } from '../types';

interface StreamingRendererProps {
    /** The raw JSON response string (may be partial during streaming) */
    response: string;
    /** Whether the response is still streaming */
    isStreaming: boolean;
}

export const StreamingRenderer: React.FC<StreamingRendererProps> = ({
    response,
    isStreaming,
}) => {
    // Parse the response to extract blocks
    const { blocks, error } = useMemo(() => {
        if (!response.trim()) {
            return { blocks: [], error: null };
        }
        return parseStreamingResponse(response);
    }, [response]);

    // Show error if parsing failed
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Error parsing response</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    // Show loading placeholder if no blocks yet and still streaming
    if (blocks.length === 0 && isStreaming) {
        return (
            <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
        );
    }

    // Show placeholder if completely empty
    if (blocks.length === 0) {
        return (
            <div className="text-gray-500 italic">
                No response content
            </div>
        );
    }

    return (
        <div className="streaming-renderer space-y-4">
            {blocks.map((block, index) => (
                <BlockRenderer key={`${block.type}-${index}`} block={block} />
            ))}

            {/* Show streaming indicator at the end */}
            {isStreaming && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span>Loading more...</span>
                </div>
            )}
        </div>
    );
};

/**
 * Renders a single block using the component registry.
 */
interface BlockRendererProps {
    block: UIBlock;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ block }) => {
    const Component = componentRegistry[block.type];

    if (!Component) {
        // Unknown block type - show as JSON for debugging
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
                <p className="font-medium text-sm">Unknown block type: {block.type}</p>
                <pre className="text-xs mt-2 overflow-x-auto">
                    {JSON.stringify(block, null, 2)}
                </pre>
            </div>
        );
    }

    return <Component block={block} />;
};

export default StreamingRenderer;
