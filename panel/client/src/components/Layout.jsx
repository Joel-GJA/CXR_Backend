import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/overview',    icon: '⬡', label: 'Overview'     },
  { to: '/hostmanager', icon: '⚡', label: 'Host Manager', tag: 'CORE' },
  { to: '/rooms',       icon: '◈', label: 'Rooms'        },
  { to: '/services',    icon: '⚙', label: 'Services'     },
  { to: '/logs',        icon: '≡', label: 'Logs'         },
  { to: '/health',      icon: '◉', label: 'Health'       },
  { to: '/events',      icon: '◎', label: 'Events'       },
];

export default function Layout({ children }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="brand-icon">CX</div>
            <div>
              <div className="brand-text-title">CXR Ops Panel</div>
              <div className="brand-text-sub">Phase 3 · Nareen</div>
            </div>
          </div>
          <div className="brand-pill">⬡ Phase 3 Active</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Navigation</div>
          {NAV.map(({ to, icon, label, tag }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {tag && <span className="nav-tag">{tag}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sf-status">
            <div className="status-pulse" />
            <span className="sf-label">Online · Port 4000</span>
          </div>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
