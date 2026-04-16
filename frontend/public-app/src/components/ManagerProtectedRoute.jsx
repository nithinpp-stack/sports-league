import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ManagerProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!['manager', 'team_owner'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">Only team managers can access the bidding portal.</p>
        </div>
      </div>
    );
  }
  return children;
};

export default ManagerProtectedRoute;
