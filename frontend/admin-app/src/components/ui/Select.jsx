import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom Select dropdown matching premium UI reference.
 *
 * Props:
 *  - value: current selected value (string)
 *  - onChange: (value) => void
 *  - options: [{ value, label, group? }]  OR  children (<option> elements)
 *  - placeholder: placeholder text when nothing is selected
 *  - className: additional wrapper classes
 *  - disabled: boolean
 *  - label: group label shown above options (like "Fruits" in reference)
 */
export default function Select({
  value,
  onChange,
  options: optionsProp,
  children,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  label,
  required,
  name,
}) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  // Parse options from either prop or children
  const options = React.useMemo(() => {
    if (optionsProp) return optionsProp;
    if (!children) return [];
    const items = [];
    React.Children.forEach(children, (child) => {
      if (!child || child.type !== 'option') return;
      items.push({
        value: child.props.value ?? '',
        label: child.props.children ?? '',
        disabled: child.props.disabled,
      });
    });
    return items;
  }, [optionsProp, children]);

  // Filter out the empty placeholder option for display
  const selectableOptions = options.filter((o) => o.value !== '');
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption?.value ? selectedOption.label : '';

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current && highlightIdx >= 0) {
      const item = listRef.current.children[label ? highlightIdx + 1 : highlightIdx];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open, label]);

  const handleSelect = useCallback((val) => {
    onChange?.({ target: { value: val, name } }); // mimic native event shape
    setOpen(false);
  }, [onChange, name]);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        const idx = selectableOptions.findIndex((o) => String(o.value) === String(value));
        setHighlightIdx(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, selectableOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightIdx >= 0 && selectableOptions[highlightIdx]) {
          handleSelect(selectableOptions[highlightIdx].value);
        }
        break;
      case 'Escape':
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  }, [open, disabled, highlightIdx, selectableOptions, value, handleSelect]);

  // Open and set initial highlight
  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      const idx = selectableOptions.findIndex((o) => String(o.value) === String(value));
      setHighlightIdx(idx >= 0 ? idx : 0);
    }
    setOpen(!open);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Hidden native select for form submission */}
      {name && (
        <select name={name} value={value} required={required} tabIndex={-1}
          onChange={() => {}} className="sr-only" aria-hidden="true">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2.5 text-sm text-left transition-all
          ${open ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={displayLabel ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {displayLabel || placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-[fadeIn_0.12s_ease-out]">
          <ul
            ref={listRef}
            role="listbox"
            className="py-1 max-h-60 overflow-y-auto"
          >
            {/* Group label */}
            {label && (
              <li className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider select-none">
                {label}
              </li>
            )}

            {selectableOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No options available</li>
            )}

            {selectableOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === highlightIdx;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors select-none flex items-center justify-between
                    ${opt.disabled ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${isHighlighted && !opt.disabled ? 'bg-gray-50' : ''}
                    ${isSelected && !isHighlighted ? 'text-emerald-600 font-medium' : ''}
                    ${isSelected && isHighlighted ? 'bg-emerald-50 text-emerald-600 font-medium' : ''}
                    ${!isSelected && !isHighlighted && !opt.disabled ? 'text-gray-700' : ''}
                  `}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
