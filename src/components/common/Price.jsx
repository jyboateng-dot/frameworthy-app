import React from 'react';

// Renders a GHS amount with the currency label sized smaller than the price
// digits, proportional to whatever size/weight/color the caller sets via
// className on the wrapper — the label is 0.65em of that, not a fixed size,
// so it stays properly relative wherever this is dropped in.
const Price = ({ amount, className = '', prefix = '' }) => (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
        {prefix}
        <span className="text-[0.65em] font-bold opacity-70">GHS</span>
        <span className="leading-none">{Number(amount || 0).toFixed(2)}</span>
    </span>
);

export default Price;
