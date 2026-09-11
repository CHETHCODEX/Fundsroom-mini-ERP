import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  PlusCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Operations Overview';
    if (path === '/customers') return 'Customer CRM';
    if (path.startsWith('/customers/')) return 'Customer Dossier & History';
    if (path.startsWith('/products')) return 'Product Catalog & Inventory';
    if (path === '/challans/create') return 'Create Sales Challan';
    if (path.startsWith('/challans')) return 'Sales Challan Management';
    return 'Portal';
  };

  return (
    <div className="app-layout">
      {/* Sidebar Overlay on mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 35,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">FR</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">FundsRoom</span>
            <span className="sidebar-brand-sub">ERP & CRM Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Operations</div>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <div className="sidebar-section-title">CRM & Sales</div>
          <NavLink
            to="/customers"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Users size={18} />
            <span>Customers CRM</span>
          </NavLink>

          <NavLink
            to="/challans"
            end
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <FileText size={18} />
            <span>Sales Challans</span>
          </NavLink>

          {hasRole('Admin', 'Sales') && (
            <NavLink
              to="/challans/create"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <PlusCircle size={18} />
              <span>Create Challan</span>
            </NavLink>
          )}

          <div className="sidebar-section-title">Warehouse & Stock</div>
          <NavLink
            to="/products"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Package size={18} />
            <span>Products & Stock</span>
          </NavLink>
        </nav>

        {/* User Card & Logout Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="user-avatar">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role-tag">
                <Badge status={user?.role || 'User'} />
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ border: 'none', padding: '0.4rem', color: 'var(--slate-500)' }}
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ display: 'md:none' }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--slate-500)' }}>
              <ShieldCheck size={16} color="var(--primary)" />
              <span>Role:</span>
              <strong>{user?.role}</strong>
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
