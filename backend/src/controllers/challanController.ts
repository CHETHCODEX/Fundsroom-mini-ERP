import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest, ChallanItemInput } from '../types';

// Helper to generate unique challan number: CH-YYYYMMDD-XXXX
const generateChallanNumber = async (client: any): Promise<string> => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CH-${dateStr}-`;

  const countRes = await client.query(
    `SELECT COUNT(*) FROM challans WHERE challan_number LIKE $1`,
    [`${prefix}%`]
  );
  const nextSeq = (parseInt(countRes.rows[0].count, 10) + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
};

export const getChallans = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const customerId = req.query.customer_id ? parseInt(req.query.customer_id as string, 10) : null;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '15', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      const idx = values.length;
      conditions.push(`(LOWER(ch.challan_number) LIKE $${idx} OR LOWER(c.name) LIKE $${idx} OR LOWER(c.business_name) LIKE $${idx})`);
    }

    if (status.trim()) {
      values.push(status.trim());
      conditions.push(`ch.status = $${values.length}`);
    }

    if (customerId && !isNaN(customerId)) {
      values.push(customerId);
      conditions.push(`ch.customer_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) 
       FROM challans ch 
       JOIN customers c ON ch.customer_id = c.id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT 
        ch.*,
        c.name as customer_name,
        c.business_name as customer_business,
        c.mobile as customer_mobile,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM challan_items ci WHERE ci.challan_id = ch.id) as item_count
      FROM challans ch
      JOIN customers c ON ch.customer_id = c.id
      LEFT JOIN users u ON ch.created_by = u.id
      ${whereClause}
      ORDER BY ch.created_at DESC
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
    console.error('getChallans error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching challans.' });
  }
};

export const getChallanById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid challan ID.' });
      return;
    }

    const challanResult = await pool.query(
      `SELECT 
        ch.*,
        c.name as customer_name,
        c.business_name as customer_business,
        c.mobile as customer_mobile,
        c.email as customer_email,
        c.gst_number as customer_gst,
        c.address as customer_address,
        u.name as created_by_name
       FROM challans ch
       JOIN customers c ON ch.customer_id = c.id
       LEFT JOIN users u ON ch.created_by = u.id
       WHERE ch.id = $1`,
      [id]
    );

    if (challanResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Challan not found.' });
      return;
    }

    // Fetch snapshot items
    const itemsResult = await pool.query(
      `SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY id ASC`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...challanResult.rows[0],
        items: itemsResult.rows
      }
    });
  } catch (error: any) {
    console.error('getChallanById error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching challan details.' });
  }
};

export const createChallan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { customer_id, status, notes, items } = req.body;

    // Validate customer
    if (!customer_id) {
      res.status(400).json({ success: false, message: 'Customer selection is required.' });
      return;
    }

    const challanStatus = status || 'Draft';
    if (challanStatus !== 'Draft' && challanStatus !== 'Confirmed') {
      res.status(400).json({
        success: false,
        message: "Status must be either 'Draft' or 'Confirmed' when creating a challan."
      });
      return;
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one product line item is required.'
      });
      return;
    }

    // Consolidate any duplicate product entries in request payload
    const itemMap = new Map<number, number>();
    for (const item of items as ChallanItemInput[]) {
      const pId = parseInt(item.product_id as any, 10);
      const qty = parseInt(item.quantity as any, 10);

      if (isNaN(pId) || pId <= 0) {
        res.status(400).json({ success: false, message: 'Invalid product_id in items.' });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({ success: false, message: `Invalid quantity for product ID ${pId}. Must be greater than 0.` });
        return;
      }

      itemMap.set(pId, (itemMap.get(pId) || 0) + qty);
    }

    const uniqueProductIds = Array.from(itemMap.keys()).sort((a, b) => a - b);

    await client.query('BEGIN');

    // 1. Verify customer exists
    const customerCheck = await client.query('SELECT id, name FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: `Customer with ID ${customer_id} does not exist.` });
      return;
    }

    // 2. Lock and fetch products ordered by ID to guarantee deadlock prevention
    // Use SELECT ... FOR UPDATE on all relevant products
    const productsRes = await client.query(
      `SELECT id, name, sku, unit_price, current_stock 
       FROM products 
       WHERE id = ANY($1::int[]) 
       ORDER BY id ASC 
       FOR UPDATE`,
      [uniqueProductIds]
    );

    if (productsRes.rows.length !== uniqueProductIds.length) {
      await client.query('ROLLBACK');
      const foundIds = new Set(productsRes.rows.map((r: any) => r.id));
      const missing = uniqueProductIds.filter(id => !foundIds.has(id));
      res.status(400).json({
        success: false,
        message: `Products with IDs [${missing.join(', ')}] were not found in the catalog.`
      });
      return;
    }

    const productMap = new Map<number, any>();
    for (const prod of productsRes.rows) {
      productMap.set(prod.id, prod);
    }

    // 3. If Confirmed, check stock availability for every product before making any changes
    if (challanStatus === 'Confirmed') {
      for (const [prodId, requestedQty] of itemMap.entries()) {
        const prod = productMap.get(prodId);
        const availableStock = parseInt(prod.current_stock, 10);

        if (availableStock < requestedQty) {
          await client.query('ROLLBACK');
          res.status(400).json({
            success: false,
            error: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for product '${prod.name}' (SKU: ${prod.sku}). Available: ${availableStock}, Requested: ${requestedQty}. Stock cannot go negative.`
          });
          return;
        }
      }
    }

    // 4. Generate unique challan number
    const challanNumber = await generateChallanNumber(client);

    // Calculate totals
    let totalQuantity = 0;
    let totalAmount = 0;
    const preparedItems: any[] = [];

    for (const [prodId, qty] of itemMap.entries()) {
      const prod = productMap.get(prodId);
      const unitPrice = parseFloat(prod.unit_price);
      const subtotal = unitPrice * qty;

      totalQuantity += qty;
      totalAmount += subtotal;

      preparedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        unit_price: unitPrice,
        quantity: qty,
        subtotal
      });
    }

    const userId = req.user?.id || null;

    // 5. Insert challan
    const challanInsert = await client.query(
      `INSERT INTO challans (
        challan_number, customer_id, total_quantity, total_amount, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [challanNumber, customer_id, totalQuantity, totalAmount, challanStatus, notes?.trim() || null, userId]
    );

    const newChallan = challanInsert.rows[0];

    // 6. Insert snapshot items
    for (const item of preparedItems) {
      await client.query(
        `INSERT INTO challan_items (
          challan_id, product_id, product_name, product_sku, unit_price, quantity, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newChallan.id, item.product_id, item.product_name, item.product_sku, item.unit_price, item.quantity, item.subtotal]
      );
    }

    // 7. If status is Confirmed: Deduct stock and write stock_movements OUT
    if (challanStatus === 'Confirmed') {
      for (const item of preparedItems) {
        // Deduct current_stock
        await client.query(
          `UPDATE products 
           SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );

        // Write audit log entry
        await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity_changed, movement_type, reason, created_by
          ) VALUES ($1, $2, 'OUT', $3, $4)`,
          [item.product_id, item.quantity, `Sales Challan ${challanNumber}`, userId]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Challan ${challanNumber} created successfully in '${challanStatus}' status.`,
      data: {
        ...newChallan,
        items: preparedItems
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('createChallan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error processing sales challan.' });
  } finally {
    client.release();
  }
};

export const confirmDraftChallan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid challan ID.' });
      return;
    }

    await client.query('BEGIN');

    // 1. Fetch and lock challan
    const challanRes = await client.query(
      `SELECT * FROM challans WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (challanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Challan not found.' });
      return;
    }

    const challan = challanRes.rows[0];

    if (challan.status === 'Confirmed') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Challan is already Confirmed.' });
      return;
    }

    if (challan.status === 'Cancelled') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Cannot confirm a Cancelled challan.' });
      return;
    }

    // 2. Fetch items for this challan
    const itemsRes = await client.query(
      `SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY product_id ASC`,
      [id]
    );

    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Challan has no items.' });
      return;
    }

    const productIds = itemsRes.rows.map((i: any) => i.product_id);

    // 3. Lock products ordered by ID
    const productsRes = await client.query(
      `SELECT id, name, sku, current_stock 
       FROM products 
       WHERE id = ANY($1::int[]) 
       ORDER BY id ASC 
       FOR UPDATE`,
      [productIds]
    );

    const productMap = new Map<number, any>();
    for (const prod of productsRes.rows) {
      productMap.set(prod.id, prod);
    }

    // 4. Verify stock sufficiency for every item
    for (const item of itemsRes.rows) {
      const prod = productMap.get(item.product_id);
      if (!prod) {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          message: `Product '${item.product_name}' (ID: ${item.product_id}) no longer exists in inventory.`
        });
        return;
      }

      const availableStock = parseInt(prod.current_stock, 10);
      if (availableStock < item.quantity) {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for product '${prod.name}' (SKU: ${prod.sku}). Available: ${availableStock}, Requested: ${item.quantity}. Stock cannot go negative.`
        });
        return;
      }
    }

    const userId = req.user?.id || null;

    // 5. Deduct stock and log movements
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE products 
         SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (
          product_id, quantity_changed, movement_type, reason, created_by
        ) VALUES ($1, $2, 'OUT', $3, $4)`,
        [item.product_id, item.quantity, `Sales Challan ${challan.challan_number}`, userId]
      );
    }

    // 6. Update challan status to Confirmed
    const updateRes = await client.query(
      `UPDATE challans 
       SET status = 'Confirmed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Challan ${challan.challan_number} confirmed and stock successfully deducted.`,
      data: updateRes.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('confirmDraftChallan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error confirming challan.' });
  } finally {
    client.release();
  }
};

export const cancelChallan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid challan ID.' });
      return;
    }

    await client.query('BEGIN');

    const challanRes = await client.query(
      `SELECT * FROM challans WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (challanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Challan not found.' });
      return;
    }

    const challan = challanRes.rows[0];

    if (challan.status === 'Cancelled') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Challan is already Cancelled.' });
      return;
    }

    const userId = req.user?.id || null;

    // If challan was Confirmed, restore stock and write stock_movements IN entries
    if (challan.status === 'Confirmed') {
      const itemsRes = await client.query(
        `SELECT * FROM challan_items WHERE challan_id = $1 ORDER BY product_id ASC`,
        [id]
      );

      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE products 
           SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );

        await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity_changed, movement_type, reason, created_by
          ) VALUES ($1, $2, 'IN', $3, $4)`,
          [item.product_id, item.quantity, `Cancelled Sales Challan ${challan.challan_number}`, userId]
        );
      }
    }

    // Update challan status to Cancelled
    const updateRes = await client.query(
      `UPDATE challans 
       SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Challan ${challan.challan_number} marked as Cancelled.${challan.status === 'Confirmed' ? ' Stock restored to inventory.' : ''}`,
      data: updateRes.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('cancelChallan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error cancelling challan.' });
  } finally {
    client.release();
  }
};
