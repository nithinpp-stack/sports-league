import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from './Select';
import { getAuctionTier, AUCTION_TIER_HINT } from '../../utils/auctionTier';

const SKILL_OPTIONS = {
  cricket: ['batsman', 'bowler', 'allrounder', 'wicketkeeper'],
  football: ['goalkeeper', 'defender', 'midfielder', 'forward'],
  badminton: ['shuttler'],
};

// BWF event categories a shuttler can register for. Displayed as a checkbox
// group in the edit modal when sport === 'badminton'.
const BADMINTON_EVENTS = [
  { value: 'mens_singles', label: "Men's Singles" },
  { value: 'womens_singles', label: "Women's Singles" },
  { value: 'mens_doubles', label: "Men's Doubles" },
  { value: 'womens_doubles', label: "Women's Doubles" },
  { value: 'mixed_doubles', label: 'Mixed Doubles' },
];

export default function EditPlayerModal({ player, sport, onClose, tournamentId, selectedTeamId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', skill: '', age: '', phone: '', address: '', events: [], basePoints: 10 });
  const [editPlayerPhoto, setEditPlayerPhoto] = useState(null);
  const [editPlayerPhotoPreview, setEditPlayerPhotoPreview] = useState(null);
  const [editPlayerCurrentPhoto, setEditPlayerCurrentPhoto] = useState(null);

  useEffect(() => {
    if (player) {
      setForm({
        name: player.name || '',
        skill: player.skill || (sport === 'badminton' ? 'shuttler' : ''),
        age: player.age || '',
        phone: player.phone || '',
        address: player.address || '',
        events: Array.isArray(player.events) ? player.events : [],
        // Nullish on basePoints so a legitimate 0 isn't silently forced to 10.
        basePoints: player.basePoints ?? 10,
      });
      setEditPlayerCurrentPhoto(player.photo || null);
      setEditPlayerPhoto(null);
      setEditPlayerPhotoPreview(null);
    }
  }, [player, sport]);

  const mutation = useMutation({
    mutationFn: ({ playerId, data }) => api.put(`/players/${playerId}`, data),
    onSuccess: () => {
      toast.success('Player updated!');
      qc.invalidateQueries(['tournament-players', tournamentId]);
      qc.invalidateQueries(['team-players', selectedTeamId]);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update player'),
  });

  const skillOptions = SKILL_OPTIONS[sport] || [...SKILL_OPTIONS.cricket, ...SKILL_OPTIONS.football, ...SKILL_OPTIONS.badminton];

  const toggleEvent = (ev) => {
    setForm((f) => {
      const set = new Set(f.events || []);
      if (set.has(ev)) set.delete(ev);
      else set.add(ev);
      return { ...f, events: [...set] };
    });
  };

  const handleSave = async () => {
    const data = { ...form };
    if (data.age) data.age = Number(data.age);
    else delete data.age;
    if (!data.phone) delete data.phone;
    if (!data.address) delete data.address;
    // Coerce basePoints to a finite number — an empty string would fail schema
    // validation, and we'd rather fall back to the schema default (10).
    const pts = Number(data.basePoints);
    if (Number.isFinite(pts) && pts >= 0) data.basePoints = pts;
    else delete data.basePoints;
    // Events only ship for badminton; strip on other sports so the pre-validate
    // hook doesn't have to clean up after us.
    if (sport !== 'badminton') delete data.events;
    else if (!data.events?.length) delete data.events; // don't overwrite with []

    if (editPlayerPhoto) {
      try {
        const formData = new FormData();
        formData.append('photo', editPlayerPhoto);
        const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.photo = uploadRes.data?.url || uploadRes.data;
      } catch {
        toast.error('Photo upload failed');
        return;
      }
    }

    mutation.mutate({ playerId: player._id, data });
  };

  const photoSrc = editPlayerPhotoPreview || (editPlayerCurrentPhoto ? `${import.meta.env.VITE_API_URL || ''}${editPlayerCurrentPhoto}` : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-[dialogIn_0.15s_ease-out]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">Edit Player</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Photo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              {photoSrc ? (
                <div className="w-28 h-28 rounded-full border-2 border-gray-200 shadow-sm overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300">
                  <img key={photoSrc} src={photoSrc} alt="Player" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-3xl font-bold text-gray-500 border-2 border-gray-200 shadow-sm">
                  {form.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 cursor-pointer transition-colors">
                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">Change</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setEditPlayerPhoto(file);
                      setEditPlayerPhotoPreview(url);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Click photo to change</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill / Position</label>
                <Select
                  value={form.skill}
                  onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))}
                  className="w-full capitalize"
                >
                  {skillOptions.map((s) => (
                    <option key={s} value={s}>{s.replace(/[-_]/g, ' ')}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="e.g. Mumbai, India"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            {/* Base Points — drives which auction set the player lands in when
                Start Auction runs. Live tier pill so the admin can see the
                bucket update as they type, instead of having to remember the
                50/100 thresholds. */}
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
                  onChange={(e) => setForm((f) => ({ ...f, basePoints: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            {sport === 'badminton' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Events <span className="text-xs font-normal text-gray-500">(eligibility for match categories)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {BADMINTON_EVENTS.map((ev) => {
                    const checked = form.events?.includes(ev.value);
                    return (
                      <label
                        key={ev.value}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={() => toggleEvent(ev.value)}
                          className="w-3.5 h-3.5 accent-emerald-600"
                        />
                        {ev.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
          >
            Cancel
          </button>
          <button
            disabled={mutation.isPending}
            onClick={handleSave}
            className="flex-1 px-4 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
