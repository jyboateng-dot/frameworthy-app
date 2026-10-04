import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function getPageItems(currentPage, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, 'end-gap', totalPages];
    if (currentPage >= totalPages - 3) {
        return [1, 'start-gap', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'start-gap', currentPage - 1, currentPage, currentPage + 1, 'end-gap', totalPages];
}

const CollectionPagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const activePage = Math.max(1, Math.min(totalPages, currentPage));
    const pages = getPageItems(activePage, totalPages);
    const buttonClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-sm border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500';
    const idleClass = 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100';
    const disabledClass = 'cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300';

    const control = (label, icon, page, disabled) => (
        <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onPageChange(page)}
            className={`${buttonClass} gap-1 ${disabled ? disabledClass : idleClass}`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <nav aria-label="Collection pages" className="mt-12 border-t border-stone-200 pt-6">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                {control('First page', <ChevronsLeft size={15} aria-hidden="true" />, 1, activePage === 1)}
                {control('Previous page', <ChevronLeft size={15} aria-hidden="true" />, activePage - 1, activePage === 1)}
                <div role="group" className="flex items-center gap-1" aria-label={`Page ${activePage} of ${totalPages}`}>
                    {pages.map(item => typeof item === 'number' ? (
                        <button
                            key={item}
                            type="button"
                            aria-label={`Page ${item}`}
                            aria-current={item === activePage ? 'page' : undefined}
                            onClick={() => onPageChange(item)}
                            className={`${buttonClass} ${item === activePage ? 'border-stone-900 bg-stone-900 text-white' : idleClass}`}
                        >
                            {item}
                        </button>
                    ) : (
                        <button
                            key={item}
                            type="button"
                            aria-label={item === 'start-gap' ? 'Jump back 5 pages' : 'Jump forward 5 pages'}
                            title={item === 'start-gap' ? 'Jump back 5 pages' : 'Jump forward 5 pages'}
                            onClick={() => onPageChange(Math.max(1, Math.min(totalPages, activePage + (item === 'start-gap' ? -5 : 5))))}
                            className="inline-flex h-9 min-w-8 items-center justify-center rounded-sm px-1 text-sm text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
                        >
                            <span aria-hidden="true">…</span>
                        </button>
                    ))}
                </div>
                {control('Next page', <ChevronRight size={15} aria-hidden="true" />, activePage + 1, activePage === totalPages)}
                {control('Last page', <ChevronsRight size={15} aria-hidden="true" />, totalPages, activePage === totalPages)}
            </div>
            <p className="mt-3 text-center text-[11px] text-stone-500">Page {activePage} of {totalPages}</p>
        </nav>
    );
};

export default CollectionPagination;
