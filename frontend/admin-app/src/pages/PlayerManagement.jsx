import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Pagination from '../components/Pagination';

const SKILLS_BY_SPORT = {
  cricket: ['batsman', 'bowler', 'allrounder', 'wicketkeeper'],
  football: ['goalkeeper', 'defender', 'midfielder', 'forward'],
};
const BATTING_STYLES = ['right-hand', 'left-hand'];
const BOWLING_STYLES = ['fast', 'medium', 'spin', 'none'];

export default function PlayerManagement() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: '',
    sport: 'cricket',
    skill: 'batsman',
    age: '',
    battingStyle: 'right-hand',
    bowlingStyle: 'none',
    phone: '',
    address: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const { data: playersData, isLoading } = useQuery({
    queryKey: ['players', page],
    queryFn: () => api.get(`/players?page=${page}&limit=10`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/players', data),
    onSuccess: () => {
      toast.success('Player created!');
      qc.invalidateQueries(['players']);
      setShowForm(false);
      setForm({ name: '', sport: 'cricket', skill: 'batsman', age: '', battingStyle: 'right-hand', bowlingStyle: 'none', phone: '', address: '' });
      setPhotoFile(null);
      setPhotoPreview(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create player'),
  });

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, age: form.age ? Number(form.age) : undefined };
    if (!payload.phone) delete payload.phone;
    if (!payload.address) delete payload.address;

    // Upload photo first if selected
    if (photoFile) {
      try {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.photo = uploadRes.data?.url || uploadRes.data;
      } catch (err) {
        toast.error('Photo upload failed');
        return;
      }
    }

    createMutation.mutate(payload);
  };

  const players = Array.isArray(playersData) ? playersData : playersData?.players ?? [];
  const pagination = playersData?._pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Players</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Create Player</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                min={15}
                max={60}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 8901"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="mt-2 h-20 w-20 rounded-lg object-cover border border-gray-200" />
              )}
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Player'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Loading players...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Name</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Skill</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Team</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Photo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{p.skill?.replace(/[-_]/g, ' ')}</td>
                  <td className="px-6 py-4 text-gray-600">{p.teamId?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'sold' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'unsold' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {p.status ?? 'available'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{p.photo ? <img src={`${import.meta.env.VITE_API_URL || ''}${p.photo}`} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-gray-400">—</span>}</td>
                </tr>
              ))}
              {!players.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No players found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pagination?.pages} total={pagination?.total} limit={10} onPageChange={setPage} />
      </div>
    </div>
  );
}
