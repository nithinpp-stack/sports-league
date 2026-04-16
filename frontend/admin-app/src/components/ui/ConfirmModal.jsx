import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ConfirmContext = createContext();

/**
 * useConfirm() — promise-based confirmation dialog.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm('Delete this item?');
 *   if (ok) deleteMutation.mutate(id);
 *
 *   // With options:
 *   const ok = await confirm('Delete team "Warriors"?', {
 *     description: 'This cannot be undone.',
 *     confirmText: 'Delete',
 *     variant: 'danger',
 *   });
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((title, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ title, ...options });
    });
  }, []);

  const handleClose = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          title={state.title}
          description={state.description}
          confirmText={state.confirmText || 'Confirm'}
          cancelText={state.cancelText || 'Cancel'}
          variant={state.variant || 'default'}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ title, description, confirmText, cancelText, variant, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    // Focus confirm button
    setTimeout(() => confirmRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-[dialogIn_0.15s_ease-out]">
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
            isDanger ? 'bg-red-50' : 'bg-gray-100'
          }`}>
            {isDanger ? (
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                <path d="M12 15.75h.007v.008H12v-.008Z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            )}
          </div>

          {/* Text */}
          <h3 className="text-base font-semibold text-gray-900 text-center mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 text-center">{description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              isDanger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
