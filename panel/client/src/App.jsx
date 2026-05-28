import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext.jsx';
import Layout      from './components/Layout.jsx';
import Login       from './pages/Login.jsx';
import Overview    from './pages/Overview.jsx';
import HostManager from './pages/HostManager.jsx';
import Rooms       from './pages/Rooms.jsx';
import Services    from './pages/Services.jsx';
import Logs        from './pages/Logs.jsx';
import Health      from './pages/Health.jsx';
import Events      from './pages/Events.jsx';
import Builds      from './pages/Builds.jsx';
import Users       from './pages/Users.jsx';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/overview" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  );

  return (
    <Layout>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/"            element={<Navigate to="/overview" replace />} />
          <Route path="/login"       element={<Navigate to="/overview" replace />} />
          <Route path="/overview"    element={<ProtectedRoute><Overview /></ProtectedRoute>} />
          <Route path="/hostmanager" element={<ProtectedRoute><HostManager /></ProtectedRoute>} />
          <Route path="/rooms"       element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
          <Route path="/services"    element={<ProtectedRoute><Services /></ProtectedRoute>} />
          <Route path="/logs"        element={<ProtectedRoute><Logs /></ProtectedRoute>} />
          <Route path="/health"      element={<ProtectedRoute><Health /></ProtectedRoute>} />
          <Route path="/events"      element={<ProtectedRoute><Events /></ProtectedRoute>} />
          <Route path="/builds"      element={<ProtectedRoute><Builds /></ProtectedRoute>} />
          <Route path="/users"       element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
          <Route path="*"            element={<Navigate to="/overview" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
