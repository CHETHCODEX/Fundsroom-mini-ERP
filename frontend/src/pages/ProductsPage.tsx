import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  History,
  Edit2,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
} from 'lucide-react';
import api from '../api/client';
import { Product, StockMovement, Pagination } from '../types';
import Badge from '../components/Badge';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ProductsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const canManageStock = hasRole('Admin', 'Warehouse');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Add / Edit Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    current_stock: '0',
    min_stock_alert: '10',
    location: '',
  });

  // Adjust Stock Modal
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({
    quantity: '',
    movement_type: 'IN' as 'IN' | 'OUT',
    reason: '',
  });

  // Movement History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/products', {
        params: {
          search,
          category: categoryFilter,
          low_stock: lowStockOnly ? 'true' : undefined,
          page,
          limit: 15,
        },
      });
      setProducts(res.data.data);
      setPagination(res.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter, lowStockOnly, page]);

  // Open Add Product Modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      category: '',
      unit_price: '',
      current_stock: '0',
      min_stock_alert: '10',
      location: '',
    });
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit_price: p.unit_price.toString(),
      current_stock: p.current_stock.toString(),
      min_stock_alert: p.min_stock_alert.toString(),
      location: p.location,
    });
    setIsProductModalOpen(true);
  };

  // Open Adjust Stock Modal
  const handleOpenAdjustStock = (p: Product) => {
    setSelectedProductForStock(p);
    setStockForm({
      quantity: '',
      movement_type: 'IN',
      reason: '',
    });
    setIsStockModalOpen(true);
  };

  // Open Movement History Modal
  const handleOpenHistory = async (p: Product) => {
    setSelectedProductForHistory(p);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get('/products/movements', {
        params: { product_id: p.id, limit: 20 },
      });
      setMovements(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch stock movement log.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Save Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, productForm);
        setSuccessMsg(`Product '${productForm.name}' updated successfully.`);
      } else {
        await api.post('/products', productForm);
        setSuccessMsg(`Product '${productForm.name}' added to inventory.`);
      }
      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product.');
    }
  };

  // Execute Stock Adjustment
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock) return;

    try {
      await api.post(`/products/${selectedProductForStock.id}/adjust-stock`, stockForm);
      setSuccessMsg(
        `Stock for '${selectedProductForStock.name}' adjusted ${stockForm.movement_type} by ${stockForm.quantity} units.`
      );
      setIsStockModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to adjust stock.');
    }
  };

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Product Catalog & Warehouse Stock</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
            Monitor inventory levels, safety thresholds, locations, and audit logs.
          </p>
        </div>
        {canManageStock && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add New Product</span>
          </button>
        )}
      </div>

      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                placeholder="Search by SKU code or product name..."
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
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Categories</option>
                <option value="Fasteners">Fasteners</option>
                <option value="Electrical">Electrical</option>
                <option value="Power Tools">Power Tools</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--slate-700)' }}>
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => {
                    setLowStockOnly(e.target.checked);
                    setPage(1);
                  }}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={15} color="var(--danger)" />
                  <span>Show Low Stock Only</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU / Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit Price (INR)</th>
              <th>Stock On Hand</th>
              <th>Warehouse Location</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                  Loading warehouse inventory...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                  No products found matching the criteria.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLowStock = p.current_stock <= p.min_stock_alert;
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--slate-800)' }}>
                        {p.sku}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{p.name}</div>
                    </td>
                    <td>
                      <Badge status={p.category} />
                    </td>
                    <td>
                      <strong>₹{parseFloat(p.unit_price as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: isLowStock ? 'var(--danger)' : 'var(--slate-900)',
                          }}
                        >
                          {p.current_stock}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                          / min: {p.min_stock_alert}
                        </span>
                        {isLowStock && (
                          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                            Low
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate-600)' }}>{p.location}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        {canManageStock && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenAdjustStock(p)}
                            title="Adjust Stock (IN / OUT)"
                          >
                            <ArrowUpDown size={14} />
                            <span>Adjust</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenHistory(p)}
                          title="Stock Movement Log"
                        >
                          <History size={14} />
                        </button>
                        {canManageStock && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div className="pagination">
          <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
            Showing <strong>{products.length}</strong> of <strong>{pagination.total}</strong> products
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

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.sku}` : 'Add Product to Catalog'}
      >
        <form onSubmit={handleSaveProduct}>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-input"
              required
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="e.g. High Tensile M12 Hex Bolt (Pack of 50)"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU / Item Code *</label>
              <input
                type="text"
                className="form-input"
                required
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                placeholder="FST-BLT-M12"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <input
                type="text"
                className="form-input"
                required
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                placeholder="e.g. Fasteners, Electrical, Tools"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Price (INR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                required
                value={productForm.unit_price}
                onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                placeholder="550.00"
              />
            </div>
            {!editingProduct && (
              <div className="form-group">
                <label className="form-label">Initial Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={productForm.current_stock}
                  onChange={(e) => setProductForm({ ...productForm, current_stock: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Min Stock Alert Threshold</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={productForm.min_stock_alert}
                onChange={(e) => setProductForm({ ...productForm, min_stock_alert: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Warehouse Storage Location *</label>
              <input
                type="text"
                className="form-input"
                required
                value={productForm.location}
                onChange={(e) => setProductForm({ ...productForm, location: e.target.value })}
                placeholder="Bay A-2, Rack 04"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsProductModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title={`Adjust Stock: ${selectedProductForStock?.name}`}
      >
        <form onSubmit={handleAdjustStockSubmit}>
          <div style={{ background: 'var(--slate-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid var(--slate-200)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
              Current Stock on Hand: <strong>{selectedProductForStock?.current_stock} units</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
              SKU: {selectedProductForStock?.sku} • Location: {selectedProductForStock?.location}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Adjustment Type *</label>
              <select
                className="form-select"
                value={stockForm.movement_type}
                onChange={(e) => setStockForm({ ...stockForm, movement_type: e.target.value as 'IN' | 'OUT' })}
              >
                <option value="IN">IN (Goods Received / Stock Inward)</option>
                <option value="OUT">OUT (Damaged / Manual Reduction)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Changed *</label>
              <input
                type="number"
                min="1"
                required
                className="form-input"
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                placeholder="e.g. 25"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Audit Reason *</label>
            <input
              type="text"
              required
              className="form-input"
              value={stockForm.reason}
              onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })}
              placeholder="e.g. Supplier shipment receipt PO #4092, or Damaged goods write-off"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsStockModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm Stock Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Movement Log Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Stock Movement History: ${selectedProductForHistory?.sku}`}
        maxWidth="750px"
      >
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
          Showing historical audit log for: <strong>{selectedProductForHistory?.name}</strong>
        </div>

        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
            Loading audit movements...
          </div>
        ) : movements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
            No stock movements logged yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Reason / Context</th>
                  <th>Authorized By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>
                      <Badge status={m.movement_type} />
                    </td>
                    <td>
                      <strong style={{ color: m.movement_type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                        {m.movement_type === 'IN' ? `+${m.quantity_changed}` : `-${m.quantity_changed}`}
                      </strong>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{m.reason}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--slate-600)' }}>
                      {m.created_by_name || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ProductsPage;
