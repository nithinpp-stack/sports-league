import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import TournamentBracket from '../components/TournamentBracket';
import { MapPin, Calendar } from '../components/ui/Icons';
import { useAds, AdStrip } from '../components/AdComponents';

const BASE_TABS = ['Overview', 'Standings', 'Matches', 'Teams'];
// Knockout-style badminton formats — these tournaments don't have a league
// table that makes sense, so we swap "Standings" for "Bracket" in the tab strip.
// 'Round Robin' and group-only formats keep the standings table.
const KNOCKOUT_BADMINTON_FORMATS = new Set([
  'Knockout',
  'Double Elimination',
  'Group + Knockout',
  'Singles',
  'Doubles',
  'Mixed Doubles',
]);

const isBracketFormat = (sport, format) =>
  sport === 'badminton' && KNOCKOUT_BADMINTON_FORMATS.has(format);

// Rankings tab is badminton-only; Bracket tab replaces Standings for knockout formats.
const getTabs = (sport, format) => {
  if (sport !== 'badminton') return BASE_TABS;
  const standingsOrBracket = isBracketFormat(sport, format) ? 'Bracket' : 'Standings';
  return ['Overview', standingsOrBracket, 'Rankings', 'Matches', 'Teams'];
};

const BADMINTON_CATEGORIES = [
  { value: 'all', label: 'All Matches' },
  { value: 'mens_singles', label: "Men's Singles" },
  { value: 'womens_singles', label: "Women's Singles" },
  { value: 'mens_doubles', label: "Men's Doubles" },
  { value: 'womens_doubles', label: "Women's Doubles" },
  { value: 'mixed_doubles', label: 'Mixed Doubles' },
];

function Countdown({ target }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diffMs = target.valueOf() - now;
  if (diffMs <= 0) return <span>starting any moment</span>;
  const total = Math.floor(diffMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return <span className="tabular-nums">{pad(h)}:{pad(m)}:{pad(s)}</span>;
}

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [registered, setRegistered] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', skill: '', age: '', phone: '' });
  const [regUploading, setRegUploading] = useState(false);
  const [regPhotoPreview, setRegPhotoPreview] = useState(null);
  const [regPhoto, setRegPhoto] = useState(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  const { data: tournament, isLoading: tLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.get(`/tournaments/${id}`).then((r) => r.data.tournament),
  });

  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: matchesData } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => api.get(`/matches?tournamentId=${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: standingsData } = useQuery({
    queryKey: ['tournament-standings', id],
    queryFn: () => api.get(`/tournaments/${id}/standings`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: rankingsData } = useQuery({
    queryKey: ['tournament-rankings', id],
    queryFn: () => api.get(`/tournaments/${id}/rankings`).then((r) => r.data),
    // Rankings are badminton-only
    enabled: !!id && tournament?.sport === 'badminton',
  });

  const bracketFormat = isBracketFormat(tournament?.sport, tournament?.format);
  const { data: bracketData, isLoading: bracketLoading } = useQuery({
    queryKey: ['tournament-bracket', id],
    queryFn: () => api.get(`/tournaments/${id}/bracket`).then((r) => r.data),
    // Only fetch for knockout-style formats; saves a round-trip on round-robin
    enabled: !!id && bracketFormat,
  });

  const { data: playersData } = useQuery({
    queryKey: ['tournament-players', id],
    queryFn: () => api.get(`/players?tournamentId=${id}&limit=200`).then((r) => r.data),
    // Player lineups are only rendered for badminton match cards
    enabled: !!id && tournament?.sport === 'badminton',
  });

  const { data: auctionData } = useQuery({
    queryKey: ['auction-check', id],
    queryFn: async () => {
      try {
        const r = await api.get(`/auctions/${id}`);
        return r.data?.auction || r.data;
      } catch { return null; }
    },
    enabled: !!id,
    retry: false,
  });
  const hasAuction = !!auctionData;

  const registerMutation = useMutation({
    mutationFn: () => api.post('/players/register-tournament', { tournamentId: id }),
    onSuccess: () => {
      setRegistered(true);
      toast.success('Registration submitted! Awaiting admin approval.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const teams = teamsData?.teams || [];
  const matches = matchesData?.matches || [];
  const standings = standingsData?.standings || [];
  const rankings = rankingsData?.rankings || [];
  const players = playersData?.players || playersData?.data?.players || [];
  const sport = tournament?.sport || 'cricket';

  // Group players by team for quick lookup in the match cards
  const playersByTeam = React.useMemo(() => {
    const map = {};
    for (const p of players) {
      const tid = (p.teamId?._id || p.teamId || '').toString();
      if (!tid) continue;
      if (!map[tid]) map[tid] = [];
      map[tid].push(p);
    }
    return map;
  }, [players]);
  const canRegister = tournament?.status === 'draft' || tournament?.status === 'registration' || tournament?.status === 'active';

  const skillOptions = (() => {
    const s = tournament?.sport;
    if (s === 'football') return ['goalkeeper', 'defender', 'midfielder', 'forward'];
    if (s === 'badminton') return ['shuttler'];
    return ['batsman', 'bowler', 'allrounder', 'wicketkeeper'];
  })();

  const handleRegPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegPhotoPreview(URL.createObjectURL(file));
    setRegPhoto(file);
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim()) { toast.error('Name is required'); return; }
    setRegSubmitting(true);
    try {
      let photoUrl = null;
      if (regPhoto) {
        setRegUploading(true);
        const formData = new FormData();
        formData.append('photo', regPhoto);
        try {
          const uploadRes = await api.post('/upload/public', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          photoUrl = uploadRes.data?.data?.url || uploadRes.data?.url || uploadRes.data;
        } catch {
          toast.error('Photo upload failed');
        }
        setRegUploading(false);
      }
      await api.post('/players/public-register', {
        name: regForm.name.trim(),
        tournamentId: id,
        skill: regForm.skill || undefined,
        age: regForm.age || undefined,
        phone: regForm.phone || undefined,
        sport: tournament?.sport || undefined,
        photo: photoUrl || undefined,
      });
      setRegistered(true);
      setShowRegForm(false);
      setRegForm({ name: '', skill: '', age: '', phone: '' });
      setRegPhoto(null);
      setRegPhotoPreview(null);
      toast.success('Registration submitted! Awaiting admin approval.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setRegSubmitting(false);
    }
  };
  const stripAds = useAds('strip');

  if (tLoading) {
    return <Spinner />;
  }

  if (!tournament) {
    return <p className="text-slate-500 dark:text-gray-400 text-center py-16">Tournament not found.</p>;
  }

  const thTd = 'px-4 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider';
  const td = 'px-4 py-3 text-center text-slate-600 dark:text-gray-300';

  return (
    <div>
      {/* Hero Header with Sport-specific Background Image */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <img
          src={
            sport === 'football' ? 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=400&fit=crop&crop=center'
            : sport === 'badminton' ? 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1200&h=400&fit=crop&crop=center'
            : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200&h=400&fit=crop&crop=center'
          }
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/70 to-slate-900/50 dark:from-gray-950/90 dark:via-gray-950/75 dark:to-gray-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />

        <div className="relative z-10 p-8 sm:p-10 py-28 sm:py-40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <StatusBadge status={tournament.status} />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 mb-2 tracking-tight">{tournament.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                {tournament.format && <span className="capitalize flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{tournament.format}</span>}
                {tournament.location && <span className="flex items-center gap-1.5"><MapPin size={14} /> {tournament.location}</span>}
                {tournament.startDate && <span className="flex items-center gap-1.5"><Calendar size={14} /> {dayjs(tournament.startDate).format('DD MMM YYYY')}</span>}
                {tournament.sport && <span className="capitalize flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 8 9 8s2-4 4.5-4a2.5 2.5 0 0 1 0 5H12"/><path d="M6 9h12l-1.5 9H7.5L6 9z"/></svg>{tournament.sport}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="text-right">
                <p className="text-3xl font-black">{teams.length}</p>
                <p className="text-xs text-slate-300 font-medium">Teams</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-right">
                <p className="text-3xl font-black">{matches.length}</p>
                <p className="text-xs text-slate-300 font-medium">Matches</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              {hasAuction && (
                <Link
                  to={`/auctions/${id}`}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Auction
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Ad Strip */}
        {stripAds[0] && <div className="relative z-10"><AdStrip ad={stripAds[0]} /></div>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-gray-700">
        {getTabs(sport, tournament?.format).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-4">
          {canRegister && (
            <div className="bg-emerald-50 dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <p className="text-slate-700 dark:text-gray-300 text-sm">
                {registered
                  ? 'Your registration is pending admin approval.'
                  : 'Interested in playing? Register now for this tournament.'}
              </p>
              {registered ? (
                <button disabled className="px-4 py-2 bg-slate-100 dark:bg-gray-600 text-slate-400 dark:text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">
                  Registration Pending
                </button>
              ) : (
                <button
                  onClick={() => setShowRegForm(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Register
                </button>
              )}
            </div>
          )}

          {/* Registration Form Modal */}
          {showRegForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowRegForm(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Register for Tournament</h3>
                  <button onClick={() => setShowRegForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={handleRegSubmit} className="space-y-4">
                  {/* Photo */}
                  <div className="flex flex-col items-center">
                    <label className="cursor-pointer group">
                      {regPhotoPreview ? (
                        <img src={regPhotoPreview} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-300" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-emerald-400 transition-colors">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleRegPhotoChange} />
                    </label>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Tap to add photo</p>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={regForm.name}
                      onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Your full name"
                    />
                  </div>

                  {/* Skill */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Skill / Position</label>
                    <select
                      value={regForm.skill}
                      onChange={(e) => setRegForm((f) => ({ ...f, skill: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select skill</option>
                      {skillOptions.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Age</label>
                    <input
                      type="number"
                      value={regForm.age}
                      onChange={(e) => setRegForm((f) => ({ ...f, age: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Your age"
                      min="5"
                      max="100"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Phone</label>
                    <input
                      type="text"
                      value={regForm.phone}
                      onChange={(e) => setRegForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Your phone number"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={regSubmitting || regUploading}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {regUploading ? 'Uploading photo...' : regSubmitting ? 'Submitting...' : 'Submit Registration'}
                  </button>
                </form>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Teams', value: teams.length },
              { label: 'Matches', value: matches.length },
              { label: 'Format', value: tournament.format || '–' },
              { label: 'Status', value: tournament.status },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 capitalize">{stat.value}</p>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Ad Strip */}
          {stripAds[0] && <AdStrip ad={stripAds[0]} />}

        </div>
      )}

      {/* Bracket — knockout-style badminton formats only */}
      {activeTab === 'Bracket' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 font-medium">
              Knockout bracket
            </span>
            <span className="text-slate-400 dark:text-gray-500">
              Winners advance right. Tap any match to open the scorecard.
            </span>
          </div>
          <TournamentBracket
            rounds={bracketData?.rounds || []}
            totalTeams={bracketData?.totalTeams ?? teams.length}
            loading={bracketLoading}
          />
        </div>
      )}

      {/* Standings */}
      {activeTab === 'Standings' && (
        <div className="overflow-x-auto bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none">
          {standings.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400 p-6">No standings available yet.</p>
          ) : sport === 'cricket' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                  <th className={`${thTd} text-left`}>#</th>
                  <th className={`${thTd} text-left`}>Team</th>
                  <th className={thTd}>P</th>
                  <th className={thTd}>W</th>
                  <th className={thTd}>L</th>
                  <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr key={row.team?._id || idx} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {row.team?.name || row.teamName || 'Unknown'}
                    </td>
                    <td className={td}>{row.played ?? row.P ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.won ?? row.W ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.lost ?? row.L ?? 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points ?? row.Pts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sport === 'badminton' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                  <th className={`${thTd} text-left`}>#</th>
                  <th className={`${thTd} text-left`}>Team</th>
                  <th className={thTd}>P</th>
                  <th className={thTd}>W</th>
                  <th className={thTd}>L</th>
                  <th className={thTd} title="Game difference">GD</th>
                  <th className={thTd} title="Point difference">PD</th>
                  <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr key={row.team?._id || idx} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {row.team?.name || 'Unknown'}
                    </td>
                    <td className={td}>{row.played ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.won ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.lost ?? 0}</td>
                    <td className={td}>
                      {row.gameDiff != null
                        ? (row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff)
                        : 0}
                    </td>
                    <td className={td}>
                      {row.pointDiff != null
                        ? (row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff)
                        : 0}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                  <th className={`${thTd} text-left`}>#</th>
                  <th className={`${thTd} text-left`}>Team</th>
                  <th className={thTd}>P</th>
                  <th className={thTd}>W</th>
                  <th className={thTd}>D</th>
                  <th className={thTd}>L</th>
                  <th className={thTd}>GD</th>
                  <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr key={row.team?._id || idx} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {row.team?.name || row.teamName || 'Unknown'}
                    </td>
                    <td className={td}>{row.played ?? row.P ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.won ?? row.W ?? 0}</td>
                    <td className={td}>{row.drawn ?? row.D ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.lost ?? row.L ?? 0}</td>
                    <td className={td}>
                      {row.goalDifference != null
                        ? (row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference)
                        : row.GD ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points ?? row.Pts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rankings — badminton only (BWF-style: finish position drives points) */}
      {activeTab === 'Rankings' && sport === 'badminton' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 font-medium">
              BWF-style ranking
            </span>
            <span className="text-slate-400 dark:text-gray-500">
              Points = team's finishing bracket (Winner 1000 · RU 700 · SF 450 · QF 250) + 50 per match win + 10 per appearance.
            </span>
          </div>
          <div className="overflow-x-auto bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none">
            {rankings.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-400 p-6">
                No rankings yet. Rankings appear after players have featured in at least one match.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                    <th className={`${thTd} text-left`}>#</th>
                    <th className={`${thTd} text-left`}>Player</th>
                    <th className={`${thTd} text-left`}>Team</th>
                    <th className={`${thTd} text-left`}>Finish</th>
                    <th className={thTd}>M</th>
                    <th className={thTd}>W</th>
                    <th className={thTd}>L</th>
                    <th className={thTd}>PW</th>
                    <th className={thTd}>PL</th>
                    <th className={thTd}>Win %</th>
                    <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row) => {
                    const finishKey = row.finish?.key;
                    const finishBadge = {
                      winner: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
                      runnerUp: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
                      semiFinal: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
                      quarterFinal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
                      r16: 'bg-slate-100 text-slate-600 dark:bg-gray-700/60 dark:text-gray-300',
                      r32: 'bg-slate-100 text-slate-600 dark:bg-gray-700/60 dark:text-gray-300',
                      participated: 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400',
                    }[finishKey] || 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400';

                    return (
                      <tr
                        key={row.player._id}
                        className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-400 dark:text-gray-400 font-semibold">
                          {row.rank <= 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                row.rank === 1
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                  : row.rank === 2
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                                  : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                              }`}
                            >
                              {row.rank}
                            </span>
                          ) : (
                            row.rank
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {row.player.name}
                          {row.player.skill && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400 dark:text-gray-500 font-medium">
                              {row.player.skill}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                          {row.team?.name || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {row.finish ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${finishBadge}`}
                              title={`${row.finish.label} · +${row.finish.points} pts`}
                            >
                              {row.finish.label}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={td}>{row.matches}</td>
                        <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.stats.wins}</td>
                        <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.stats.losses}</td>
                        <td className={td}>{row.stats.pointsWon}</td>
                        <td className={td}>{row.stats.pointsLost}</td>
                        <td className={td}>{row.stats.winRate}%</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Matches */}
      {activeTab === 'Matches' && (
        <div className="space-y-3">
          {sport === 'badminton' && (
            <div className="flex flex-wrap gap-0.5 p-0.5 bg-slate-800 dark:bg-black rounded-lg mb-4 overflow-hidden shadow-md shadow-slate-900/20 dark:shadow-black/40">
              {BADMINTON_CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`flex-1 min-w-[140px] px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors ${
                      isActive
                        ? 'bg-white text-emerald-600 dark:bg-white dark:text-emerald-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
          {(() => {
            // Badminton match ordering: upcoming/live first (soonest date), then completed (most recent first)
            const sortByStatus = (list) =>
              [...list].sort((a, b) => {
                const order = { upcoming: 0, live: 0, completed: 1, cancelled: 2 };
                const ao = order[a.status] ?? 3;
                const bo = order[b.status] ?? 3;
                if (ao !== bo) return ao - bo;
                // within upcoming/live: soonest first; within completed: most recent first
                const da = new Date(a.date).getTime();
                const db = new Date(b.date).getTime();
                return a.status === 'completed' ? db - da : da - db;
              });

            const visibleMatches = sport === 'badminton'
              ? (activeCategory === 'all'
                  ? sortByStatus(matches)
                  : sortByStatus(matches.filter((m) => m.category === activeCategory)))
              : matches;
            if (matches.length === 0) {
              return <p className="text-slate-500 dark:text-gray-400">No matches scheduled yet.</p>;
            }
            if (visibleMatches.length === 0) {
              return <p className="text-slate-500 dark:text-gray-400">No matches in this category yet.</p>;
            }

            // Split into upcoming-ish and completed so both sections are visible
            const isUpcomingish = (s) => s === 'upcoming' || s === 'live';
            const upcomingMatches = visibleMatches.filter((m) => isUpcomingish(m.status));
            const completedMatches = visibleMatches.filter((m) => !isUpcomingish(m.status));
            const showSections = sport === 'badminton' && upcomingMatches.length > 0 && completedMatches.length > 0;
            const isBadminton = sport === 'badminton';
            const categoryLabelMap = BADMINTON_CATEGORIES.reduce(
              (acc, c) => ({ ...acc, [c.value]: c.label }),
              {}
            );
            const getPlayerLimit = (matchCategory) => {
              const effective = activeCategory === 'all' ? matchCategory : activeCategory;
              return effective && effective.includes('doubles') ? 2 : 1;
            };
            const renderCard = (m) => {
              const matchDate = dayjs(m.date);
              const isToday = m.status === 'upcoming' && matchDate.isSame(dayjs(), 'day');

              // ---------- Non-badminton: original simple card (unchanged) ----------
              if (!isBadminton) {
                return (
                  <Link
                    key={m._id}
                    to={`/matches/${m._id}`}
                    className="flex items-center justify-between bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl px-5 py-4 transition-all duration-200 shadow-sm group"
                  >
                    <div>
                      <p className="text-slate-900 dark:text-white font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                        {m.team1Id?.name || 'TBD'} vs {m.team2Id?.name || 'TBD'}
                      </p>
                      <p className="text-slate-400 dark:text-gray-400 text-sm mt-0.5">
                        {isToday ? `Today, ${matchDate.format('HH:mm')}` : matchDate.format('DD MMM YYYY, HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isToday && (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-700/60">
                          <span className="relative flex w-1.5 h-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </span>
                          Live in <Countdown target={matchDate} />
                        </span>
                      )}
                      {m.result?.summary && <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{m.result.summary}</span>}
                      <StatusBadge status={m.status} />
                    </div>
                  </Link>
                );
              }

              // ---------- Badminton: two-column card with player lineups ----------
              const t1Id = (m.team1Id?._id || m.team1Id || '').toString();
              const t2Id = (m.team2Id?._id || m.team2Id || '').toString();
              const limitPlayers = getPlayerLimit(m.category);
              const t1Players = (playersByTeam[t1Id] || []).slice(0, limitPlayers);
              const t2Players = (playersByTeam[t2Id] || []).slice(0, limitPlayers);
              const isCompleted = m.status === 'completed';
              const winnerId = (m.result?.winner?._id || m.result?.winner || '').toString();
              const t1IsWinner = isCompleted && winnerId === t1Id;
              const t2IsWinner = isCompleted && winnerId === t2Id;
              const scores = Array.isArray(m.result?.scores) ? m.result.scores : [];
              return (
              <Link
                key={m._id}
                to={`/matches/${m._id}`}
                className="block bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl px-5 py-4 transition-all duration-200 shadow-sm group"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Team 1 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm sm:text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors truncate ${
                        t1IsWinner
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isCompleted
                          ? 'text-slate-500 dark:text-gray-400'
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {m.team1Id?.name || 'TBD'}
                      </p>
                      {t1IsWinner && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                          W
                        </span>
                      )}
                    </div>
                    {t1Players.length > 0 && (
                      <p className="text-slate-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                        {t1Players.map((p) => p.name).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Middle: VS or game-by-game scores */}
                  {isCompleted && scores.length > 0 ? (
                    <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
                      <div className="flex items-center gap-1.5">
                        {scores.map((g, i) => {
                          const t1Won = g.team1Points > g.team2Points;
                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center text-xs font-mono tabular-nums bg-slate-50 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 rounded px-1.5 py-0.5"
                            >
                              <span className={t1Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-gray-400'}>
                                {g.team1Points}
                              </span>
                              <span className={!t1Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-gray-400'}>
                                {g.team2Points}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider shrink-0">vs</span>
                  )}

                  {/* Team 2 */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {t2IsWinner && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                          W
                        </span>
                      )}
                      <p className={`font-semibold text-sm sm:text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors truncate ${
                        t2IsWinner
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isCompleted
                          ? 'text-slate-500 dark:text-gray-400'
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {m.team2Id?.name || 'TBD'}
                      </p>
                    </div>
                    {t2Players.length > 0 && (
                      <p className="text-slate-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                        {t2Players.map((p) => p.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta row: time + status + result */}
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-gray-700/60">
                  <span className="text-slate-500 dark:text-gray-400 text-xs flex items-center gap-2 min-w-0">
                    <span className="truncate">
                      {isToday ? `Today, ${matchDate.format('HH:mm')}` : matchDate.format('DD MMM YYYY, HH:mm')}
                      {m.venue && <span className="ml-2 text-slate-400 dark:text-gray-500">• {m.venue}</span>}
                    </span>
                    {activeCategory === 'all' && m.category && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/60 shrink-0">
                        {categoryLabelMap[m.category] || m.category}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-700/60">
                        <span className="relative flex w-1.5 h-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                        Live in <Countdown target={matchDate} />
                      </span>
                    )}
                    {m.result?.summary && (
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        {m.result.summary}
                      </span>
                    )}
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              </Link>
              );
            };

            const SectionHeader = ({ label, count, accent }) => (
              <div className="flex items-center gap-2 mt-1 mb-1 first:mt-0">
                <h4 className={`text-[11px] font-bold uppercase tracking-wider ${accent}`}>{label}</h4>
                <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500">({count})</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700/60" />
              </div>
            );

            if (showSections) {
              return (
                <>
                  <SectionHeader label="Upcoming" count={upcomingMatches.length} accent="text-emerald-600 dark:text-emerald-400" />
                  {upcomingMatches.map(renderCard)}
                  <SectionHeader label="Results" count={completedMatches.length} accent="text-slate-500 dark:text-gray-400" />
                  {completedMatches.map(renderCard)}
                </>
              );
            }
            return visibleMatches.map(renderCard);
          })()}
        </div>
      )}

      {/* Teams */}
      {activeTab === 'Teams' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400">No teams yet.</p>
          ) : (
            teams.map((team) => (
              <Link
                key={team._id}
                to={`/teams/${team._id}`}
                className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-800 rounded-xl p-5 transition-all duration-200 hover:shadow-md"
              >
                <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{team.name}</h3>
                {team.owner && <p className="text-slate-500 dark:text-gray-400 text-sm">Owner: {team.owner.name || team.owner}</p>}
                {team.budget != null && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1 font-medium">Budget: ₹{team.budget?.toLocaleString()}</p>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
