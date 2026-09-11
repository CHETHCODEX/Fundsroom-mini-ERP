import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Plus,
  FileText,
  MessageSquare,
} from 'lucide-react';
import api from '../api/client';
import { Customer } from '../types';
import Badge from '../components/Badge';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const canAddNote = hasRole('Admin', 'Sales');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New follow-up note form state
  const [newNote, setNewNote] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve customer details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
  }, [id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setSubmittingNote(true);
      await api.post(`/customers/${id}/notes`, {
        note: newNote.trim(),
        follow_up_date: nextFollowUpDate || undefined,
      });
      setSuccessMsg('Follow-up note logged into timeline.');
      setNewNote('');
      setNextFollowUpDate('');
      fetchCustomerDetail();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to append follow-up note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
        Loading customer dossier...
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: '2rem' }}>
        <Alert type="danger" message="Customer record not found." />
        <Link to="/customers" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Top back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/customers" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          <span>Back to Customer Directory</span>
        </Link>
      </div>

      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

      {/* Profile Overview Card */}
      <div className="card">
        <div className="card-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>
                {customer.business_name}
              </h2>
              <Badge status={customer.status} />
              <Badge status={customer.customer_type} />
            </div>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', margin: 0 }}>
              Primary Contact: <strong>{customer.name}</strong> • Account ID: #{customer.id}
            </p>
          </div>
          {hasRole('Admin', 'Sales') && (
            <Link to="/challans/create" className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Create Sales Challan</span>
            </Link>
          )}
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                Contact Details
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.9rem' }}>
                <Phone size={15} color="var(--primary)" />
                <strong>{customer.mobile}</strong>
              </div>
              {customer.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                  <Mail size={15} color="var(--slate-400)" />
                  <span>{customer.email}</span>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                Tax & Regulatory
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
                GSTIN:{' '}
                <strong style={{ fontFamily: 'monospace' }}>
                  {customer.gst_number || 'Unregistered / Exempt'}
                </strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                Registered on: {new Date(customer.created_at).toLocaleDateString('en-IN')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                Next Follow-Up
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.9rem' }}>
                <Calendar size={15} color="var(--warning)" />
                <strong>
                  {customer.follow_up_date
                    ? new Date(customer.follow_up_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'No pending follow-up scheduled'}
                </strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                Delivery Address
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--slate-700)' }}>
                <MapPin size={16} color="var(--slate-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{customer.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two column layout: Follow-up Timeline & Challan History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        {/* Follow-up Notes Timeline */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="var(--primary)" />
              <span>CRM Follow-Up Timeline</span>
            </h3>
          </div>

          <div className="card-body">
            {/* Add Note Form */}
            {canAddNote && (
              <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem', background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--slate-200)' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Log Interaction / Call Note
                  </label>
                  <textarea
                    className="form-textarea"
                    required
                    placeholder="Enter discussion details, customer requirements, quotation remarks..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      Update Next Follow-Up Date (Optional)
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submittingNote || !newNote.trim()}
                  >
                    <Plus size={14} />
                    <span>{submittingNote ? 'Appending...' : 'Append Follow-Up'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Timeline Stream */}
            <div className="timeline">
              {customer.follow_up_notes && customer.follow_up_notes.length > 0 ? (
                customer.follow_up_notes.map((n) => (
                  <div className="timeline-item" key={n.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-author">{n.created_by_name || 'System / Staff'}</span>
                        <span>
                          {new Date(n.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate-700)', whiteSpace: 'pre-wrap' }}>
                        {n.note}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--slate-400)', fontSize: '0.85rem', padding: '1rem 0' }}>
                  No historical follow-up notes logged for this customer yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Challans for this customer */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--primary)" />
              <span>Orders & Sales Challans</span>
            </h3>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan #</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.recent_challans && customer.recent_challans.length > 0 ? (
                  customer.recent_challans.map((ch) => (
                    <tr key={ch.id}>
                      <td style={{ fontWeight: 600 }}>{ch.challan_number}</td>
                      <td>{ch.total_quantity} units</td>
                      <td>₹{parseFloat(ch.total_amount as any).toLocaleString('en-IN')}</td>
                      <td>
                        <Badge status={ch.status} />
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                        {new Date(ch.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                      No sales challans recorded for this customer yet.
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

export default CustomerDetailPage;
