import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  expired: 'bg-gray-100 text-gray-700',
};

const DEFAULT_SPORT_IMAGES = {
  cricket: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=400&fit=crop&crop=center',
  football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop&crop=center',
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=400&fit=crop&crop=center',
  all: 'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=800&h=400&fit=crop&crop=center',
};

const getAdImage = (ad) => ad.imageUrl || DEFAULT_SPORT_IMAGES[ad.sport] || DEFAULT_SPORT_IMAGES.all;

const PLACEMENT_OPTIONS = [
  { value: 'popup', label: 'Popup' },
  { value: 'banner', label: 'Banner' },
  { value: 'strip', label: 'Strip' },
  { value: 'inline', label: 'Inline' },
];

const SPORT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'football', label: 'Football' },
  { value: 'badminton', label: 'Badminton' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
];

const EMPTY_FORM = {
  title: '',
  description: '',
  imageUrl: '',
  placement: 'banner',
  sport: 'all',
  targetUrl: '',
  startDate: '',
  endDate: '',
  status: 'active',
  priority: 0,
};

export default function AdsManagement() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);

  const { data: adsData, isLoading } = useQuery({
    queryKey: ['ads'],
    queryFn: () => api.get('/ads').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/ads', data),
    onSuccess: () => {
      toast.success('Ad created!');
      qc.invalidateQueries(['ads']);
      resetForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create ad'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ads/${id}`, data),
    onSuccess: () => {
      toast.success('Ad updated!');
      qc.invalidateQueries(['ads']);
      resetForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update ad'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/ads/${id}`),
    onSuccess: () => {
      toast.success('Ad deleted!');
      qc.invalidateQueries(['ads']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete ad'),
  });

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, priority: Number(form.priority) || 0 };
    // Convert empty date strings to null
    if (!payload.startDate) payload.startDate = null;
    if (!payload.endDate) payload.endDate = null;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (ad) => {
    setForm({
      title: ad.title || '',
      description: ad.description || '',
      imageUrl: ad.imageUrl || '',
      placement: ad.placement || 'banner',
      sport: ad.sport || 'all',
      targetUrl: ad.targetUrl || '',
      startDate: ad.startDate ? ad.startDate.slice(0, 10) : '',
      endDate: ad.endDate ? ad.endDate.slice(0, 10) : '',
      status: ad.status || 'active',
      priority: ad.priority ?? 0,
    });
    setEditingId(ad._id);
    setShowForm(true);
  };

  const handleDelete = async (ad) => {
    if (!await confirm('Delete this ad?', { variant: 'danger', confirmText: 'Delete' })) return;
    deleteMutation.mutate(ad._id);
  };

  const ads = adsData?.ads ?? adsData?.data?.ads ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Ads</h2>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create'}
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            {editingId ? 'Edit Ad' : 'Create Ad'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
              <input
                value={form.targetUrl}
                onChange={(e) => set('targetUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-sm text-gray-500 truncate">{form.imageUrl ? 'Image selected' : 'Choose image...'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append('photo', file);
                        const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = res.data?.url || res.data?.data?.url;
                        if (url) set('imageUrl', url);
                        toast.success('Image uploaded');
                      } catch { toast.error('Upload failed'); }
                      setUploading(false);
                    }}
                  />
                </label>
                {form.imageUrl && (
                  <button type="button" onClick={() => set('imageUrl', '')} className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              {uploading && <p className="text-xs text-emerald-600 mt-1 animate-pulse">Uploading...</p>}
              <div className="mt-2">
                <img
                  src={form.imageUrl ? `${import.meta.env.VITE_API_URL || ''}${form.imageUrl}` : (DEFAULT_SPORT_IMAGES[form.sport] || DEFAULT_SPORT_IMAGES.all)}
                  alt="Ad preview"
                  className="w-full h-32 rounded-lg border border-gray-200 object-cover"
                  onError={(e) => { e.target.src = DEFAULT_SPORT_IMAGES.all; }}
                />
                {!form.imageUrl && (
                  <p className="text-[10px] text-gray-400 mt-1">No image added — using default {form.sport === 'all' ? 'sports' : form.sport} image</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placement *</label>
              <Select
                value={form.placement}
                onChange={(e) => set('placement', e.target.value)}
                options={PLACEMENT_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
              <Select
                value={form.sport}
                onChange={(e) => set('sport', e.target.value)}
                options={SPORT_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                options={STATUS_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : editingId ? 'Update Ad' : 'Create Ad'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Loading ads...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Title</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Placement</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Sport</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Dates</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ads.map((ad) => (
                <tr key={ad._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAdImage(ad)}
                        alt=""
                        className="w-12 h-8 rounded object-cover border border-gray-200 shrink-0"
                        onError={(e) => { e.target.src = DEFAULT_SPORT_IMAGES.all; }}
                      />
                      <span className="font-medium text-gray-900">{ad.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize text-gray-600">{ad.placement}</td>
                  <td className="px-6 py-4 capitalize text-gray-600">{ad.sport}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[ad.status] || 'bg-gray-100 text-gray-700'}`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-xs">
                    {ad.startDate ? new Date(ad.startDate).toLocaleDateString() : '—'}
                    {' - '}
                    {ad.endDate ? new Date(ad.endDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    <button
                      onClick={() => handleEdit(ad)}
                      className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ad)}
                      className="text-red-600 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!ads.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No ads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
