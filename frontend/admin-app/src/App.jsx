import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmModal';

import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './components/AdminLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TournamentManagement from './pages/TournamentManagement';
import TournamentDetail from './pages/TournamentDetail';
import TeamManagement from './pages/TeamManagement';
import PlayerManagement from './pages/PlayerManagement';
import UserManagement from './pages/UserManagement';
import RegistrationManagement from './pages/RegistrationManagement';
import LiveScoringPanel from './pages/LiveScoringPanel';
import AuctionControl from './pages/AuctionControl';
import AuctionBidding from './pages/AuctionBidding';
import RoleManagement from './pages/RoleManagement';
import ManagerListing from './pages/ManagerListing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="/tournaments" element={<TournamentManagement />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route path="/teams" element={<TeamManagement />} />
                <Route path="/managers" element={<ManagerListing />} />
                <Route path="/players" element={<PlayerManagement />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/registrations" element={<RegistrationManagement />} />
                <Route path="/matches/:matchId/score" element={<LiveScoringPanel />} />
                <Route path="/auctions/:tournamentId" element={<AuctionControl />} />
                <Route path="/auctions/:tournamentId/bid" element={<AuctionBidding />} />
                <Route path="/roles" element={<RoleManagement />} />
                <Route path="/roles/:id" element={<RoleManagement />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </ConfirmProvider>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
