import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout      from './components/Layout.jsx';
import Overview    from './pages/Overview.jsx';
import HostManager from './pages/HostManager.jsx';
import Rooms       from './pages/Rooms.jsx';
import Services    from './pages/Services.jsx';
import Logs        from './pages/Logs.jsx';
import Health      from './pages/Health.jsx';
import Events      from './pages/Events.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"            element={<Navigate to="/overview" replace />} />
        <Route path="/overview"    element={<Overview />} />
        <Route path="/hostmanager" element={<HostManager />} />
        <Route path="/rooms"       element={<Rooms />} />
        <Route path="/services"    element={<Services />} />
        <Route path="/logs"        element={<Logs />} />
        <Route path="/health"      element={<Health />} />
        <Route path="/events"      element={<Events />} />
      </Routes>
    </Layout>
  );
}
