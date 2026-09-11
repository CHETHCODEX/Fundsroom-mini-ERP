import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  FileText,
  TrendingUp,
  PlusCircle,
  ArrowUpRight,
} from 'lucide-react';
import api from '../api/client';
import Badge from '../components/Badge';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard/stats');
        setStats(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>
        Loading dashboard statistics...
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '1.5rem',
          borderRadius: 'var(--radius)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
            Welcome back, {user?.name}!
          </h2>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.875rem' }}>
            Operational role: <strong>{user?.role}</strong>. Wholesale inventory and customer portal live metrics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {hasRole('Admin', 'Sales') && (
            <Link to="/challans/create" className="btn btn-primary btn-sm">
              <PlusCircle size={16} />
              <span>Create Challan</span>
            </Link>
          )}
          {hasRole('Admin', 'Warehouse') && (
            <Link to="/products" className="btn btn-secondary btn-sm">
              <Package size={16} />
              <span>Inventory</span>
            </Link>
          )}
        </div>
      </div>

      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

      {/* Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--success-light)', color: 'var(--success)' }}
          >
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              ₹{(stats?.challans?.revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Confirmed Challan Revenue</div>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
          >
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.customers?.total || 0}</div>
            <div className="stat-label">
              Total Customers ({stats?.customers?.leads || 0} Active Leads)
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrapper"
            style={{
              background: (stats?.inventory?.lowStockAlerts || 0) > 0 ? 'var(--danger-light)' : 'var(--slate-100)',
              color: (stats?.inventory?.lowStockAlerts || 0) > 0 ? 'var(--danger)' : 'var(--slate-600)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: (stats?.inventory?.lowStockAlerts || 0) > 0 ? 'var(--danger)' : 'inherit' }}>
              {stats?.inventory?.lowStockAlerts || 0}
            </div>
            <div className="stat-label">Low Stock Warnings</div>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon-wrapper"
            style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
          >
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.challans?.total || 0}</div>
            <div className="stat-label">
              Total Challans ({stats?.challans?.confirmed || 0} Confirmed)
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Challans Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Sales Challans</h3>
            <Link to="/challans" className="btn btn-secondary btn-sm">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentChallans?.length > 0 ? (
                  stats.recentChallans.map((ch: any) => (
                    <tr key={ch.id}>
                      <td style={{ fontWeight: 600 }}>{ch.challan_number}</td>
                      <td>{ch.business_name}</td>
                      <td>₹{parseFloat(ch.total_amount).toLocaleString('en-IN')}</td>
                      <td>
                        <Badge status={ch.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '2rem' }}>
                      No challans generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Inventory Threshold Alerts</span>
              {stats?.inventory?.lowStockAlerts > 0 && (
                <span className="badge badge-danger">{stats.inventory.lowStockAlerts} items</span>
              )}
            </h3>
            <Link to="/products" className="btn btn-secondary btn-sm">
              Manage Stock <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Stock / Min</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {stats?.lowStockItems?.length > 0 ? (
                  stats.lowStockItems.map((prod: any) => (
                    <tr key={prod.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prod.sku}</span>
                      </td>
                      <td>{prod.name}</td>
                      <td>
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          {prod.current_stock}
                        </span>{' '}
                        <span style={{ color: 'var(--slate-400)' }}>/ {prod.min_stock_alert}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>{prod.location}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--success)', padding: '2rem' }}>
                      All items are stocked above minimum threshold limits.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
