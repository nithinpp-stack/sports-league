import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Pagination from '../components/Pagination';
import { getAuctionTier, AUCTION_TIER_HINT } from '../utils/auctionTier';

// Sport-scoped field options. Shuttler is the only skill for badminton —
// event categories (mens_singles etc.) carry the finer-grained classification
// and are collected in a separate multi-select.
const SKILLS_BY_SPORT = {
  cricket: ['batsman', 'bowler', 'allrounder', 'wicketkeeper'],
  football: ['goalkeeper', 'defender', 'midfielder', 'forward'],
  badminton: ['shuttler'],
};
const BATTING_STYLES = ['right-hand', 'left-hand'];
const BOWLING_STYLES = ['fast', 'medium', 'spin', 'none'];

// Badminton event categories — these match the backend enum exactly and drive
// per-event eligibility when assigning shuttlers to matches.
const BADMINTON_EVENTS = [
  { value: 'mens_singles', label: "Men's Singles" },
  { value: 'womens_singles', label: "Women's Singles" },
  { value: 'mens_doubles', label: "Men's Doubles" },
  { value: 'womens_doubles', label: "Women's Doubles" },
  { value: 'mixed_doubles', label: 'Mixed Doubles' },
];

const EMPTY_FORM = {
  name: '',
  sport: 'cricket',
  skill: 'batsman',
  age: '',
  battingStyle: 'right-hand',
  bowlingStyle: 'none',
  events: [],
  phone: '',
  address: '',
  // Default 10 matches the Player schema default and keeps every new player
  // in the Uncapped tier unless the admin raises it.
  basePoints: 10,
};

export default function PlayerManagement() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
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
      setForm(EMPTY_FORM);
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

  // When the admin flips sports we have to reset the skill (a cricket 'batsman'
  // is an invalid badminton skill) and clear any fields that don't apply to
  // the new sport. The validator rejects these cross-sport mixes.
  const handleSportChange = (nextSport) => {
    const defaultSkill = SKILLS_BY_SPORT[nextSport]?.[0] ?? '';
    setForm((f) => ({
      ...f,
      sport: nextSport,
      skill: defaultSkill,
      // Cricket-only fields
      battingStyle: nextSport === 'cricket' ? f.battingStyle || 'right-hand' : 'right-hand',
      bowlingStyle: nextSport === 'cricket' ? f.bowlingStyle || 'none' : 'none',
      // Badminton-only field
      events: nextSport === 'badminton' ? f.events : [],
    }));
  };

  const toggleEvent = (value) => {
    setForm((f) => {
      const has = f.events.includes(value);
      return {
        ...f,
        events: has ? f.events.filter((v) => v !== value) : [...f.events, value],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Build a sport-specific payload so we don't send cricket styles for a
    // badminton player (the validator will 400 otherwise).
    const payload = {
      name: form.name.trim(),
      sport: form.sport,
      skill: form.skill,
      age: form.age ? Number(form.age) : undefined,
    };

    if (form.sport === 'cricket') {
      payload.battingStyle = form.battingStyle;
      payload.bowlingStyle = form.bowlingStyle;
    }
    if (form.sport === 'badminton') {
      if (!form.events.length) {
        toast.error('Pick at least one badminton category (event)');
        return;
      }
      payload.events = form.events;
    }

    if (form.phone) payload.phone = form.phone;
    if (form.address) payload.address = form.address;
    // Only ship basePoints when the admin actually touched it (or left the
    // default 10) — send as a Number so the schema doesn't reject an empty
    // string. Falsy/invalid values fall through to the schema default.
    const pts = Number(form.basePoints);
    if (Number.isFinite(pts) && pts >= 0) payload.basePoints = pts;

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

  const skillsForSport = SKILLS_BY_SPORT[form.sport] || [];

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Sport *</label>
              <select
                value={form.sport}
                onChange={(e) => handleSportChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize bg-white"
              >
                <option value="cricket">Cricket</option>
                <option value="football">Football</option>
                <option value="badminton">Badminton</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skill *</label>
              <select
                value={form.skill}
                onChange={(e) => setForm({ ...form, skill: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize bg-white"
              >
                {skillsForSport.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                min={10}
                max={70}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Base Points — the auction's starting bid AND the input that
                decides which tier the player lands in (Uncapped/Capped/
                Marquee). The live pill mirrors the same rule the backend
                uses in startAuction, so admins never have to guess. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Points
                <span className="ml-2 text-xs font-normal text-gray-500">auction starting bid</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={form.basePoints}
                  onChange={(e) => setForm({ ...form, basePoints: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {(() => {
                  const tier = getAuctionTier(form.basePoints);
                  return (
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${tier.badge}`}>
                      {tier.name}
                    </span>
                  );
                })()}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{AUCTION_TIER_HINT}</p>
            </div>

            {/* Cricket-only fields */}
            {form.sport === 'cricket' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batting Style</label>
                  <select
                    value={form.battingStyle}
                    onChange={(e) => setForm({ ...form, battingStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize bg-white"
                  >
                    {BATTING_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bowling Style</label>
                  <select
                    value={form.bowlingStyle}
                    onChange={(e) => setForm({ ...form, bowlingStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize bg-white"
                  >
                    {BOWLING_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Badminton-only: category multi-select. An admin has to pick at
                least one event for the shuttler to be eligible for any match. */}
            {form.sport === 'badminton' && (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories (Events) *
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    Pick every event this shuttler competes in
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {BADMINTON_EVENTS.map((ev) => {
                    const active = form.events.includes(ev.value);
                    return (
                      <button
                        type="button"
                        key={ev.value}
                        onClick={() => toggleEvent(ev.value)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {active ? '✓ ' : ''}{ev.label}
                      </button>
                    );
                  })}
                </div>
                {form.events.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Select at least one category — otherwise this shuttler won't be eligible for any event.
                  </p>
                )}
              </div>
            )}

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
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Sport</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Skill</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Categories</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Team</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Photo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{p.sport ?? 'cricket'}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{p.skill?.replace(/[-_]/g, ' ')}</td>
                  <td className="px-6 py-4">
                    {Array.isArray(p.events) && p.events.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.events.map((ev) => (
                          <span
                            key={ev}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            {ev.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">No players found.</td>
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
