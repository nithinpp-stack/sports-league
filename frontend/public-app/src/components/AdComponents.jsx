import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

const SPORT_IMAGES = {
  cricket: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=400&fit=crop&crop=center',
  football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop&crop=center',
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=400&fit=crop&crop=center',
  all: 'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=800&h=400&fit=crop&crop=center',
};
const getAdImage = (ad) => ad?.imageUrl || SPORT_IMAGES[ad?.sport] || SPORT_IMAGES.all;

// Hook to fetch ads by placement
export function useAds(placement, sport) {
  const { data } = useQuery({
    queryKey: ['public-ads', placement, sport],
    queryFn: () => {
      const params = new URLSearchParams();
      if (placement) params.set('placement', placement);
      if (sport && sport !== 'all') params.set('sport', sport);
      return api.get(`/ads/public?${params}`).then(r => r.data?.ads || []);
    },
    staleTime: 60000,
  });
  return data || [];
}

// Popup Ad — shown on page load with close button
export function AdPopup({ onClose, ad }) {
  if (!ad) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-[popIn_0.3s_ease-out]">
        <button onClick={onClose} className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className="relative h-48 sm:h-56">
          <img src={getAdImage(ad)} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Sponsored
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{ad.title}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 sm:p-6">
          {ad.description && <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed mb-4">{ad.description}</p>}
          <div className="flex items-center gap-3">
            {ad.targetUrl ? (
              <Link to={ad.targetUrl} onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm">
                Learn More <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            ) : null}
            <button onClick={onClose} className="px-5 py-3 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes popIn { 0% { transform: scale(0.9) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// Banner Ad — full-width with background image
export function AdBanner({ ad }) {
  if (!ad) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-gray-700/40">
      <img src={getAdImage(ad)} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
      <div className="relative z-10 flex items-center gap-6 px-6 sm:px-10 py-12 sm:py-16">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-white/50 uppercase tracking-widest mb-2">Sponsored</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{ad.title}</p>
          {ad.description && <p className="text-sm text-white/60 mt-2">{ad.description}</p>}
          {ad.sport && ad.sport !== 'all' && (
            <span className="inline-block text-[11px] text-white/70 bg-white/10 px-2.5 py-1 rounded-full mt-3 capitalize">{ad.sport}</span>
          )}
        </div>
        <span className="absolute top-3 right-4 text-[9px] text-white/30 font-medium uppercase tracking-wider">Ad</span>
      </div>
    </div>
  );
}

// Strip Ad — narrow full-width bar
export function AdStrip({ ad }) {
  if (!ad) return null;
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 px-5 py-3 flex items-center gap-4">
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest shrink-0">Ad</span>
        <p className="text-white text-xs font-medium flex-1 truncate">{ad.title}</p>
        {ad.targetUrl && (
          <Link to={ad.targetUrl} className="shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-full border border-white/20 transition-colors">
            View →
          </Link>
        )}
      </div>
    </div>
  );
}

// Inline Ad — compact card with image
export function AdInline({ ad }) {
  if (!ad) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-200/40 dark:border-amber-500/15">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30" />
      <div className="relative z-10 flex items-center gap-5 px-5 py-4">
        <img src={getAdImage(ad)} alt="" className="w-14 h-14 rounded-xl object-cover border border-amber-200/50 dark:border-amber-500/20 shadow-sm shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-0.5">Sponsored</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{ad.title}</p>
          {ad.description && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{ad.description}</p>}
        </div>
        {ad.targetUrl && (
          <Link to={ad.targetUrl} className="shrink-0 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
            View →
          </Link>
        )}
        <span className="absolute top-2 right-3 text-[8px] text-slate-400 dark:text-gray-500 font-semibold uppercase tracking-widest">Ad</span>
      </div>
    </div>
  );
}
