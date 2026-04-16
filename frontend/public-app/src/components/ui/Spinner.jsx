import React from 'react';

const SIZES = {
  sm: 'h-6 w-6 border-[1.5px]',
  md: 'h-10 w-10 border-2',
  lg: 'h-14 w-14 border-2',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div className={`flex justify-center py-16 ${className}`}>
      <div className={`animate-spin rounded-full border-emerald-500 border-t-transparent ${SIZES[size] || SIZES.md}`} />
    </div>
  );
}
