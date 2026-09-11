import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import api from '../api/client';
import { Challan, Pagination } from '../types';
import Badge from '../components/Badge';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ChallansPage: React.FC = () => {
  const { hasRole } = useAuth();
  const canCreate = hasRole('Admin', 'Sales');

  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Challan Detail Modal State
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Confirming action state
  const [actionLoading, setActionLoading] = useState(false);

  const fetchChallans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/challans', {
        params: {
          search,
          status: statusFilter,
          page,
          limit: 10,
        },
      });
      setChallans(res.data.data);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch sales challans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, [search, statusFilter, page]);

  const handleOpenDetail = async (id: number) => {
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/challans/${id}`);
      setSelectedChallan(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch challan details.');
      setIsDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirmDraft = async (id: number) => {
    if (!window.confirm('Are you sure you want to confirm this challan? Stock will be deducted immediately.')) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.post(`/challans/${id}/confirm`);
      setSuccessMsg(res.data.message || 'Challan successfully confirmed and inventory deducted.');
      setIsDetailModalOpen(false);
      fetchChallans();
    } catch (err: any) {
      const errorData = err.response?.data;
      setError(errorData?.message || 'Failed to confirm challan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelChallan = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this challan?')) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.put(`/challans/${id}/cancel`);
      setSuccessMsg(res.data.message || 'Challan cancelled.');
      setIsDetailModalOpen(false);
      fetchChallans();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel challan.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      {/* Header action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Sales Delivery Challans</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
            Track outward dispatches, customer item snapshots, and stock allocations.
          </p>
        </div>
        {canCreate && (
          <Link to="/challans/create" className="btn btn-primary">
            <Plus size={16} />
            <span>Generate New Challan</span>
          </Link>
        )}
      </div>

      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '220px', position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)',
                  display: 'flex',
                }}
              >
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search by Challan #, customer name, or business..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Draft">Draft</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Challan Number</th>
              <th>Customer & Firm</th>
              <th>Total Units</th>
              <th>Total Value</th>
              <th>Status</th>
              <th>Created On</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                  Loading sales challans...
                </td>
              </tr>
            ) : challans.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                  No challan documents found.
                </td>
              </tr>
            ) : (
              challans.map((ch) => (
                <tr key={ch.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--slate-900)' }}>
                      {ch.challan_number}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{ch.customer_business}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>{ch.customer_name}</div>
                  </td>
                  <td>
                    <strong>{ch.total_quantity}</strong> units
                  </td>
                  <td>
                    <strong>₹{parseFloat(ch.total_amount as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </td>
                  <td>
                    <Badge status={ch.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--slate-600)' }}>
                      {new Date(ch.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetail(ch.id)}
                        title="View Challan Slip / Invoice"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                      {canCreate && ch.status === 'Draft' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleConfirmDraft(ch.id)}
                          title="Confirm & Deduct Stock"
                        >
                          <CheckCircle2 size={14} />
                          <span>Confirm</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="pagination">
          <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
            Showing <strong>{challans.length}</strong> of <strong>{pagination.total}</strong> challans
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {page} / {pagination.totalPages || 1}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Challan View / Printable Slip Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Sales Delivery Challan: ${selectedChallan?.challan_number || ''}`}
        maxWidth="800px"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-500)' }}>
            Loading challan data snapshot...
          </div>
        ) : selectedChallan ? (
          <div>
            {/* Printable Slip Header */}
            <div
              style={{
                borderBottom: '2px solid var(--slate-900)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>FundsRoom Wholesale Ltd</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', margin: '0.2rem 0 0' }}>
                  Industrial Area, Phase II, Pune, Maharashtra - 411019
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', margin: '0.1rem 0 0' }}>
                  GSTIN: 27AABCF9999P1Z3 • Contact: support@fundsroom.com
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                  DELIVERY CHALLAN
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
                  {selectedChallan.challan_number}
                </div>
                <div style={{ marginTop: '0.35rem' }}>
                  <Badge status={selectedChallan.status} />
                </div>
              </div>
            </div>

            {/* Bill To & Dispatch Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <div style={{ background: 'var(--slate-50)', padding: '0.85rem', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                  Consignee / Customer Details
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)', marginTop: '0.25rem' }}>
                  {selectedChallan.customer_business}
                </div>
                <div>Attn: {selectedChallan.customer_name}</div>
                <div>Phone: {selectedChallan.customer_mobile}</div>
                <div>GSTIN: {selectedChallan.customer_gst || 'Unregistered'}</div>
                <div style={{ marginTop: '0.25rem', color: 'var(--slate-600)' }}>
                  {selectedChallan.customer_address}
                </div>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: '0.85rem', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                  Dispatch Information
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  Date of Issue:{' '}
                  <strong>
                    {new Date(selectedChallan.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </strong>
                </div>
                <div>Prepared By: <strong>{selectedChallan.created_by_name || 'Sales Staff'}</strong></div>
                {selectedChallan.notes && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff', borderRadius: '4px', border: '1px solid var(--slate-200)' }}>
                    <strong>Dispatch Notes:</strong> {selectedChallan.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Snapshot Items Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '0.5rem' }}>
                Itemized Product Snapshot (Locked at transaction time)
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>SKU</th>
                      <th>Product Description</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Line Total (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChallan.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.product_sku}</td>
                        <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ textAlign: 'right' }}>₹{parseFloat(item.unit_price as any).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{parseFloat(item.subtotal as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--slate-50)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ textAlign: 'right' }}>
                        Total Summary:
                      </td>
                      <td style={{ textAlign: 'right' }}>{selectedChallan.total_quantity} units</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.05rem' }}>
                        ₹{parseFloat(selectedChallan.total_amount as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--slate-200)', paddingTop: '1rem' }}>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {canCreate && selectedChallan.status === 'Draft' && (
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={actionLoading}
                    onClick={() => handleConfirmDraft(selectedChallan.id)}
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm & Deduct Stock</span>
                  </button>
                )}

                {canCreate && selectedChallan.status !== 'Cancelled' && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading}
                    onClick={() => handleCancelChallan(selectedChallan.id)}
                  >
                    <XCircle size={14} />
                    <span>Cancel Challan</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ChallansPage;
