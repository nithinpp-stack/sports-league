import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FiUsers,
  FiAward,
  FiActivity,
  FiTrendingUp,
  FiTrendingDown,
  FiCalendar,
  FiChevronRight,
} from 'react-icons/fi';
import api from '../services/api';
import dayjs from 'dayjs';

/* ─── Stat Card (shadcn style) ─── */
function StatCard({ title, value, description, trend, trendLabel, icon: Icon }) {
  const isUp = trend >= 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-emerald-50/40 to-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {trend !== undefined && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
              isUp
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            {isUp ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
            {isUp ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        {value ?? '—'}
      </p>
      {(description || trendLabel) && (
        <p className="mt-1.5 text-xs text-gray-400">
          {trendLabel && (
            <span className={isUp ? 'text-emerald-600' : 'text-red-500'}>
              {trendLabel}
            </span>
          )}
          {trendLabel && description ? ' · ' : ''}
          {description}
        </p>
      )}
      {Icon && (
        <Icon
          className="absolute -right-2 -bottom-2 text-gray-100"
          size={64}
          strokeWidth={1}
        />
      )}
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const map = {
    live: 'border-red-200 bg-red-50 text-red-700',
    completed: 'border-gray-200 bg-gray-50 text-gray-600',
    upcoming: 'border-blue-200 bg-blue-50 text-blue-700',
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        map[status] || map.upcoming
      }`}
    >
      {status === 'live' && (
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      {status}
    </span>
  );
}

/* ─── Section wrapper ─── */
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {children}
    </div>
  );
}
function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {action}
    </div>
  );
}

/* ─── Chart tooltip ─── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/dashboard/admin/stats').then((r) => r.data),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: () => api.get('/dashboard/admin/recent-activity').then((r) => r.data),
  });

  /* Build area-chart data from recent matches by date */
  const chartData = React.useMemo(() => {
    if (!activity?.recentMatches) return [];
    const byDate = {};
    const allMatches = activity.recentMatches || [];
    allMatches.forEach((m) => {
      const day = dayjs(m.date || m.createdAt).format('MMM DD');
      byDate[day] = (byDate[day] || 0) + 1;
    });
    // Pad to at least 6 points
    const today = dayjs();
    for (let i = 5; i >= 0; i--) {
      const d = today.subtract(i, 'day').format('MMM DD');
      if (!byDate[d]) byDate[d] = 0;
    }
    return Object.entries(byDate)
      .sort((a, b) => dayjs(a[0], 'MMM DD').valueOf() - dayjs(b[0], 'MMM DD').valueOf())
      .map(([date, count]) => ({ date, matches: count }));
  }, [activity]);

  const recentMatches = activity?.recentMatches || [];
  const recentUsers = activity?.recentUsers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of your sports league platform.
        </p>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats?.users ?? stats?.totalUsers}
          trend={12.5}
          trendLabel="Trending up this month"
          description="since platform launch"
          icon={FiUsers}
        />
        <StatCard
          title="Tournaments"
          value={stats?.tournaments ?? stats?.totalTournaments}
          trend={stats?.activeTournaments > 0 ? 8.2 : -5}
          trendLabel={`${stats?.activeTournaments ?? 0} active`}
          description="across all seasons"
          icon={FiAward}
        />
        <StatCard
          title="Live Matches"
          value={stats?.liveMatches}
          trend={stats?.liveMatches > 0 ? 100 : 0}
          trendLabel={stats?.liveMatches > 0 ? 'Matches in progress' : 'No live matches'}
          icon={FiActivity}
        />
        <StatCard
          title="Total Players"
          value={stats?.players ?? stats?.totalPlayers}
          trend={4.5}
          trendLabel="Growing steadily"
          description={`${stats?.teams ?? stats?.totalTeams ?? 0} teams registered`}
          icon={FiTrendingUp}
        />
      </div>

      {/* ─── Area Chart ─── */}
      <Card>
        <CardHeader
          title="Match Activity"
          action={
            <span className="text-xs text-gray-400">Last 7 days</span>
          }
        />
        <div className="px-5 py-4">
          {statsLoading ? (
            <div className="flex h-[260px] items-center justify-center">
              <span className="text-sm text-gray-400">Loading chart...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="matches"
                  name="Matches"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorMatches)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ─── Data Table + Recent Users ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Matches Table — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={`Recent Matches (${recentMatches.length})`}
            action={
              <Link
                to="/tournaments"
                className="px-3 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              >
                See All
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Match
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activityLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : recentMatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                      No recent matches
                    </td>
                  </tr>
                ) : (
                  recentMatches.map((m) => (
                    <tr
                      key={m._id}
                      className="transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">
                          {m.team1Id?.name ?? 'TBD'}{' '}
                          <span className="text-gray-400">vs</span>{' '}
                          {m.team2Id?.name ?? 'TBD'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <FiCalendar size={13} className="text-gray-400" />
                          {dayjs(m.date || m.createdAt).format('MMM D, YYYY')}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {m.result?.summary || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Users — 1/3 width */}
        <Card>
          <CardHeader
            title={`Recent Users (${recentUsers.length})`}
            action={
              <Link
                to="/users"
                className="px-3 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
              >
                See All
              </Link>
            }
          />
          <div className="divide-y divide-gray-50">
            {activityLoading ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Loading...</p>
            ) : recentUsers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No recent users</p>
            ) : (
              recentUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/50"
                >
                  {/* Avatar circle */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                        u.role === 'super_admin'
                          ? 'border-purple-200 bg-purple-50 text-purple-700'
                          : u.role === 'scorer'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : u.role === 'team_owner'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {u.role?.replace('_', ' ')}
                    </span>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      {dayjs(u.createdAt).format('MMM D')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
