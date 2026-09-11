import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  FileText,
  AlertCircle,
  Package,
} from 'lucide-react';
import api from '../api/client';
import { Customer, Product } from '../types';
import Alert from '../components/Alert';

interface FormLineItem {
  id: string; // unique key for react rendering
  product_id: number | '';
  product_name: string;
  product_sku: string;
  unit_price: number;
  current_stock: number;
  quantity: number;
  subtotal: number;
}

export const CreateChallanPage: React.FC = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<FormLineItem[]>([
    {
      id: Math.random().toString(),
      product_id: '',
      product_name: '',
      product_sku: '',
      unit_price: 0,
      current_stock: 0,
      quantity: 1,
      subtotal: 0,
    },
  ]);

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load Customers and Products on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingData(true);
        const [custRes, prodRes] = await Promise.all([
          api.get('/customers', { params: { limit: 100 } }),
          api.get('/products', { params: { limit: 100 } }),
        ]);
        setCustomers(custRes.data.data);
        setProducts(prodRes.data.data);
      } catch (err: any) {
        setErrorMsg('Failed to load customers and product catalog for challan builder.');
      } finally {
        setLoadingData(false);
      }
    };
    loadInitialData();
  }, []);

  // Add new blank row
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        product_id: '',
        product_name: '',
        product_sku: '',
        unit_price: 0,
        current_stock: 0,
        quantity: 1,
        subtotal: 0,
      },
    ]);
  };

  // Remove row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A sales challan must contain at least one line item.');
      return;
    }
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  // Handle product selection on a row
  const handleProductChange = (index: number, selectedProdId: number) => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) return;

    const unitPrice = parseFloat(prod.unit_price as any);
    const updated = [...items];
    const qty = updated[index].quantity || 1;

    updated[index] = {
      ...updated[index],
      product_id: prod.id,
      product_name: prod.name,
      product_sku: prod.sku,
      unit_price: unitPrice,
      current_stock: prod.current_stock,
      quantity: qty,
      subtotal: unitPrice * qty,
    };
    setItems(updated);
  };

  // Handle quantity change on a row
  const handleQuantityChange = (index: number, val: number) => {
    const qty = Math.max(1, isNaN(val) ? 1 : val);
    const updated = [...items];
    const unitPrice = updated[index].unit_price || 0;

    updated[index] = {
      ...updated[index],
      quantity: qty,
      subtotal: unitPrice * qty,
    };
    setItems(updated);
  };

  // Compute grand totals
  const totalQuantity = items.reduce((sum, item) => sum + (item.product_id ? item.quantity : 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.product_id ? item.subtotal : 0), 0);

  // Submit Challan
  const handleSubmit = async (status: 'Draft' | 'Confirmed') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Front-end validation
    if (!customerId) {
      setErrorMsg('Please select a customer for this challan.');
      return;
    }

    const validItems = items.filter((i) => i.product_id !== '');
    if (validItems.length === 0) {
      setErrorMsg('Please select at least one valid product.');
      return;
    }

    // Client-side quick check for negative stock warning if confirming
    if (status === 'Confirmed') {
      for (const item of validItems) {
        if (item.quantity > item.current_stock) {
          // Note: we still allow submitting if user wishes to test backend atomic transaction error,
          // but show clear guidance or allow the backend to return its strict error!
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_id: customerId,
        status,
        notes: notes.trim() || undefined,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      };

      const res = await api.post('/challans', payload);
      setSuccessMsg(res.data.message);

      // Redirect back to challan list after brief confirmation
      setTimeout(() => {
        navigate('/challans');
      }, 1200);
    } catch (err: any) {
      const responseData = err.response?.data;
      if (responseData?.error === 'INSUFFICIENT_STOCK') {
        // High visibility inline error for stock constraints
        setErrorMsg(`⚠️ Stock Validation Error: ${responseData.message}`);
      } else {
        setErrorMsg(responseData?.message || 'Failed to create sales challan. Please check details.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
        Loading catalog and customer directory...
      </div>
    );
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div>
      {/* Top back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/challans" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          <span>Back to Challans List</span>
        </Link>
      </div>

      {/* Page Title */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)' }}>
          Create Sales Delivery Challan
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
          Select an account, add itemized product quantities, and save as Draft or Confirm for instant inventory deduction.
        </p>
      </div>

      {/* Prominent Inline Alert Message */}
      {errorMsg && (
        <Alert
          type="danger"
          message={errorMsg}
          onClose={() => setErrorMsg(null)}
        />
      )}

      {successMsg && (
        <Alert
          type="success"
          message={successMsg}
        />
      )}

      {/* Customer Selection & Details Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">1. Customer Information</h3>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Select Customer Account *</label>
              <select
                className="form-select"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value ? parseInt(e.target.value, 10) : '')}
                required
              >
                <option value="">-- Choose a registered customer / distributor --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name} ({c.name}) — {c.customer_type} [{c.mobile}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Dispatch / Shipping Notes</label>
              <input
                type="text"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Truck MH-12-8899, Gate Pass #102"
              />
            </div>
          </div>

          {selectedCustomer && (
            <div
              style={{
                background: 'var(--slate-50)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--slate-200)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Contact Person:</span>{' '}
                <strong>{selectedCustomer.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Phone:</span>{' '}
                <strong>{selectedCustomer.mobile}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)' }}>GSTIN:</span>{' '}
                <strong style={{ fontFamily: 'monospace' }}>{selectedCustomer.gst_number || 'Unregistered'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--slate-500)' }}>Delivery Address:</span>{' '}
                <span>{selectedCustomer.address}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Product Line Items Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">2. Itemized Product Selection (Multi-Item)</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
            <Plus size={14} />
            <span>Add Another Product</span>
          </button>
        </div>

        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, index) => {
              const isOverStock = item.product_id !== '' && item.quantity > item.current_stock;
              return (
                <div
                  key={item.id}
                  style={{
                    background: isOverStock ? 'var(--danger-light)' : 'var(--slate-50)',
                    border: `1px solid ${isOverStock ? 'var(--danger-border)' : 'var(--slate-200)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Product Dropdown */}
                    <div style={{ flex: 3, minWidth: '260px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Product Item #{index + 1} *
                      </label>
                      <select
                        className="form-select"
                        value={item.product_id}
                        onChange={(e) => handleProductChange(index, parseInt(e.target.value, 10))}
                        required
                      >
                        <option value="">-- Choose Product from Inventory --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} [{p.sku}] — In Stock: {p.current_stock}
                          </option>
                        ))}
                      </select>

                      {item.product_id !== '' && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', display: 'flex', gap: '0.75rem' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isOverStock ? 'var(--danger)' : 'var(--success)',
                            }}
                          >
                            📦 Available Stock: {item.current_stock} units
                          </span>
                          <span style={{ color: 'var(--slate-500)' }}>SKU: {item.product_sku}</span>
                        </div>
                      )}
                    </div>

                    {/* Unit Price (Snapshot display) */}
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Unit Price (INR)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        disabled
                        value={item.product_id !== '' ? `₹${item.unit_price.toFixed(2)}` : '—'}
                        style={{ background: '#fff', fontWeight: 600 }}
                      />
                    </div>

                    {/* Quantity Input */}
                    <div style={{ flex: 1, minWidth: '110px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Dispatch Qty *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10))}
                        required
                      />
                    </div>

                    {/* Line Subtotal */}
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Line Subtotal
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        disabled
                        value={item.product_id !== '' ? `₹${item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        style={{ background: '#fff', fontWeight: 700, color: 'var(--slate-900)' }}
                      />
                    </div>

                    {/* Delete button */}
                    <div style={{ alignSelf: 'center', paddingTop: '1.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRemoveItem(index)}
                        title="Remove product line"
                        style={{ color: 'var(--danger)', border: 'none' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isOverStock && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>
                      ⚠️ Warning: Requested quantity ({item.quantity}) exceeds on-hand stock ({item.current_stock}). Confirming will trigger transactional rollback.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
              <Plus size={14} />
              <span>Add Another Item Row</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary and Confirmation Action Card */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '2px solid var(--slate-300)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
              Order Totals
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem', marginTop: '0.25rem' }}>
              <div>
                Total Units: <strong style={{ fontSize: '1.25rem' }}>{totalQuantity}</strong>
              </div>
              <div>
                Total Value:{' '}
                <strong style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={() => handleSubmit('Draft')}
            >
              <FileText size={16} />
              <span>Save as Draft (No Stock Deduction)</span>
            </button>

            <button
              type="button"
              className="btn btn-success"
              disabled={submitting}
              onClick={() => handleSubmit('Confirmed')}
            >
              <CheckCircle2 size={16} />
              <span>{submitting ? 'Processing Transaction...' : 'Confirm Challan (Deduct Stock)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChallanPage;
