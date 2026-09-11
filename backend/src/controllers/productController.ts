import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../types';

export const getProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';
    const lowStock = req.query.low_stock === 'true';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      const idx = values.length;
      conditions.push(`(LOWER(p.name) LIKE $${idx} OR LOWER(p.sku) LIKE $${idx})`);
    }

    if (category.trim()) {
      values.push(category.trim());
      conditions.push(`p.category = $${values.length}`);
    }

    if (lowStock) {
      conditions.push(`p.current_stock <= p.min_stock_alert`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT 
        p.*,
        (p.current_stock <= p.min_stock_alert) as is_low_stock
      FROM products p
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);

    res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching products.' });
  }
};

export const getProductById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid product ID.' });
      return;
    }

    const productResult = await pool.query(
      `SELECT p.*, (p.current_stock <= p.min_stock_alert) as is_low_stock
       FROM products p
       WHERE p.id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    // Fetch recent stock movements for this product
    const movementsResult = await pool.query(
      `SELECT sm.*, u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC
       LIMIT 10`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...productResult.rows[0],
        recent_movements: movementsResult.rows
      }
    });
  } catch (error: any) {
    console.error('getProductById error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error retrieving product.' });
  }
};

export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = req.body;

    if (!name || !sku || !category || unit_price === undefined || !location) {
      res.status(400).json({
        success: false,
        message: 'Name, SKU, category, unit_price, and location are required.'
      });
      return;
    }

    const parsedPrice = parseFloat(unit_price);
    const parsedStock = parseInt(current_stock || '0', 10);
    const parsedMinStock = parseInt(min_stock_alert || '10', 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ success: false, message: 'Unit price must be a non-negative number.' });
      return;
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      res.status(400).json({ success: false, message: 'Current stock must be a non-negative integer.' });
      return;
    }

    if (isNaN(parsedMinStock) || parsedMinStock < 0) {
      res.status(400).json({ success: false, message: 'Minimum stock alert must be a non-negative integer.' });
      return;
    }

    const skuNormalized = sku.trim().toUpperCase();

    // Check unique SKU
    const existingSku = await client.query('SELECT id FROM products WHERE UPPER(sku) = $1', [skuNormalized]);
    if (existingSku.rows.length > 0) {
      res.status(400).json({ success: false, message: `Product with SKU '${skuNormalized}' already exists.` });
      return;
    }

    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), skuNormalized, category.trim(), parsedPrice, parsedStock, parsedMinStock, location.trim()]
    );

    const product = insertResult.rows[0];

    // If initial stock is greater than 0, write an initial stock_movements IN row
    if (parsedStock > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
         VALUES ($1, $2, 'IN', 'Initial stock entry upon product creation', $3)`,
        [product.id, parsedStock, req.user?.id || null]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating product.' });
  } finally {
    client.release();
  }
};

export const updateProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid product ID.' });
      return;
    }

    const { name, sku, category, unit_price, min_stock_alert, location } = req.body;

    if (!name || !sku || !category || unit_price === undefined || !location) {
      res.status(400).json({
        success: false,
        message: 'Name, SKU, category, unit_price, and location are required.'
      });
      return;
    }

    const parsedPrice = parseFloat(unit_price);
    const parsedMinStock = parseInt(min_stock_alert || '10', 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ success: false, message: 'Unit price must be non-negative.' });
      return;
    }

    const skuNormalized = sku.trim().toUpperCase();

    // Check unique SKU excluding current product
    const existingSku = await pool.query(
      'SELECT id FROM products WHERE UPPER(sku) = $1 AND id != $2',
      [skuNormalized, id]
    );
    if (existingSku.rows.length > 0) {
      res.status(400).json({ success: false, message: `Product with SKU '${skuNormalized}' already exists.` });
      return;
    }

    const result = await pool.query(
      `UPDATE products SET
        name = $1,
        sku = $2,
        category = $3,
        unit_price = $4,
        min_stock_alert = $5,
        location = $6,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name.trim(), skuNormalized, category.trim(), parsedPrice, parsedMinStock, location.trim(), id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('updateProduct error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating product.' });
  }
};

export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid product ID.' });
      return;
    }

    const { quantity, movement_type, reason } = req.body;

    if (!quantity || !movement_type || !reason) {
      res.status(400).json({
        success: false,
        message: 'Quantity, movement_type (IN/OUT), and reason are required.'
      });
      return;
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
      return;
    }

    if (movement_type !== 'IN' && movement_type !== 'OUT') {
      res.status(400).json({ success: false, message: "movement_type must be either 'IN' or 'OUT'." });
      return;
    }

    await client.query('BEGIN');

    // Row-locking to prevent concurrent stock calculation issues
    const productRes = await client.query(
      'SELECT id, name, sku, current_stock FROM products WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (productRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    const product = productRes.rows[0];
    const currentStock = parseInt(product.current_stock, 10);

    if (movement_type === 'OUT' && currentStock < parsedQty) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: `Insufficient stock for product '${product.name}' (SKU: ${product.sku}). Available: ${currentStock}, Requested reduction: ${parsedQty}.`
      });
      return;
    }

    const newStock = movement_type === 'IN' ? currentStock + parsedQty : currentStock - parsedQty;

    await client.query(
      'UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStock, id]
    );

    const movementRes = await client.query(
      `INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, parsedQty, movement_type, reason.trim(), req.user?.id || null]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Stock successfully adjusted ${movement_type} by ${parsedQty} units.`,
      data: {
        product_id: id,
        name: product.name,
        previous_stock: currentStock,
        new_stock: newStock,
        movement: movementRes.rows[0]
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('adjustStock error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error adjusting stock.' });
  } finally {
    client.release();
  }
};

export const getStockMovements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id as string, 10) : null;
    const movementType = (req.query.movement_type as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (productId && !isNaN(productId)) {
      values.push(productId);
      conditions.push(`sm.product_id = $${values.length}`);
    }

    if (movementType && (movementType === 'IN' || movementType === 'OUT')) {
      values.push(movementType);
      conditions.push(`sm.movement_type = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM stock_movements sm ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku as product_sku,
        u.name as created_by_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);

    res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('getStockMovements error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching stock movements.' });
  }
};
