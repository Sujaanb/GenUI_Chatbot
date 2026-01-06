/**
 * Markdown Block Component
 * Renders markdown content with styling.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MarkdownBlock as MarkdownBlockType } from '../../types';

interface MarkdownBlockProps {
    block: MarkdownBlockType;
}

export const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ block }) => {
    return (
        <div className="markdown-block prose prose-sm max-w-none">
            <ReactMarkdown
                components={{
                    // Custom heading styles
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-gray-800 mb-4 mt-6 first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-5 first:mt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-gray-700 mb-2 mt-4 first:mt-0">
                            {children}
                        </h3>
                    ),
                    // Paragraph styling
                    p: ({ children }) => (
                        <p className="text-gray-600 mb-3 leading-relaxed">{children}</p>
                    ),
                    // List styling
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 text-gray-600 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 text-gray-600 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    // Strong and emphasis
                    strong: ({ children }) => (
                        <strong className="font-semibold text-gray-800">{children}</strong>
                    ),
                    em: ({ children }) => <em className="italic">{children}</em>,
                    // Code blocks
                    code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600">
                                {children}
                            </code>
                        ) : (
                            <code className="block bg-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                                {children}
                            </code>
                        );
                    },
                    // Blockquote
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-3">
                            {children}
                        </blockquote>
                    ),
                }}
            >
                {block.content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownBlock;
