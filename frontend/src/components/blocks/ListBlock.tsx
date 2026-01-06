/**
 * List Block Component
 * Displays bulleted or numbered lists.
 */

import React from 'react';
import type { ListBlock as ListBlockType } from '../../types';

interface ListBlockProps {
    block: ListBlockType;
}

export const ListBlock: React.FC<ListBlockProps> = ({ block }) => {
    const { data } = block;
    const isOrdered = data.ordered ?? false;

    const ListTag = isOrdered ? 'ol' : 'ul';

    return (
        <div className="list-block bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            {data.title && (
                <h3 className="text-lg font-semibold text-gray-800 mb-3">{data.title}</h3>
            )}
            <ListTag
                className={`space-y-2 text-gray-700 ${isOrdered
                        ? 'list-decimal list-inside'
                        : 'list-disc list-inside'
                    }`}
            >
                {data.items.map((item, index) => (
                    <li key={index} className="ml-2 leading-relaxed">
                        {item}
                    </li>
                ))}
            </ListTag>
        </div>
    );
};

export default ListBlock;
