import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const MANAGER_ROLES = ['manager', 'team_owner'];

export default function AdminProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // For managers we resolve their team's tournament once so we can redirect
  // them off admin-only routes (e.g. "/") into their auction bidding page.
  // `undefined` = not yet resolved, `null` = resolved to nothing.
  const [managerTournamentId, setManagerTournamentId] = useState(undefined);
  const isManager = MANAGER_ROLES.includes(user?.role);

  useEffect(() => {
    if (!user) return;
    if (!isManager) {
      setManagerTournamentId(null);
      return;
    }
    let cancelled = false;
    api.get('/teams/my-team')
      .then((res) => {
        const team = res.data?.data ?? res.data;
        const tid = team?.tournamentId?._id || team?.tournamentId;
        if (!cancelled) setManagerTournamentId(tid || null);
      })
      .catch(() => { if (!cancelled) setManagerTournamentId(null); });
    return () => { cancelled = true; };
  }, [user, isManager]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-emerald-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isManager) {
    // Wait for the team lookup before deciding where to send the manager,
    // otherwise we race with the redirect and flash the Dashboard.
    if (managerTournamentId === undefined) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-emerald-400 text-lg">Loading...</div>
        </div>
      );
    }
    // Managers may only access the bidding page. Anything else (/, /teams, …)
    // gets bounced to their auction. If they have no team yet, keep them on /
    // where Sidebar shows the "No team assigned" hint.
    const onBidPage = location.pathname.startsWith('/auctions/')
      && location.pathname.endsWith('/bid');
    if (managerTournamentId && !onBidPage) {
      return <Navigate to={`/auctions/${managerTournamentId}/bid`} replace />;
    }
  }

  return <Outlet />;
}
