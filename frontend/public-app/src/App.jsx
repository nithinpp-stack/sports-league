import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Matches from './pages/Matches';
import LiveMatches from './pages/LiveMatches';
import MatchDetail from './pages/MatchDetail';
import TeamProfile from './pages/TeamProfile';
import PlayerProfile from './pages/PlayerProfile';
import AuctionViewer from './pages/AuctionViewer';
import Profile from './pages/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={
        theme === 'dark'
          ? {
              style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
              success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
            }
          : {
              style: { background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
              success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
            }
      }
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ThemedToaster />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/matches/live" element={<LiveMatches />} />
                <Route path="/matches/:id" element={<MatchDetail />} />
                <Route path="/teams/:id" element={<TeamProfile />} />
                <Route path="/players/:id" element={<PlayerProfile />} />
                <Route path="/auctions/:tournamentId" element={<AuctionViewer />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
