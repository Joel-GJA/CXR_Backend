import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/overview',    icon: '▣', label: 'Overview'     },
  { to: '/hostmanager', icon: '⚡', label: 'Host Manager' },
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
          <span className="brand-tag">CXR</span>
          <div>
            <div className="brand-title">Ops Panel</div>
            <div className="brand-sub">Phase 3 · Nareen</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot online" />
          <span>Phase 3</span>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
