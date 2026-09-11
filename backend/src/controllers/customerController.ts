import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../types';

export const getCustomers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const customerType = (req.query.customer_type as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '10', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      const idx = values.length;
      conditions.push(
        `(LOWER(c.name) LIKE $${idx} OR LOWER(c.mobile) LIKE $${idx} OR LOWER(c.business_name) LIKE $${idx} OR LOWER(COALESCE(c.email, '')) LIKE $${idx})`
      );
    }

    if (status.trim()) {
      values.push(status.trim());
      conditions.push(`c.status = $${values.length}`);
    }

    if (customerType.trim()) {
      values.push(customerType.trim());
      conditions.push(`c.customer_type = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM customers c ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query
    const query = `
      SELECT 
        c.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM customer_notes cn WHERE cn.customer_id = c.id) as notes_count
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
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
    console.error('getCustomers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching customers.' });
  }
};

export const getCustomerById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid customer ID.' });
      return;
    }

    const customerResult = await pool.query(
      `SELECT c.*, u.name as created_by_name
       FROM customers c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (customerResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    // Fetch chronological follow-up notes
    const notesResult = await pool.query(
      `SELECT cn.id, cn.note, cn.created_at, u.name as created_by_name
       FROM customer_notes cn
       LEFT JOIN users u ON cn.created_by = u.id
       WHERE cn.customer_id = $1
       ORDER BY cn.created_at DESC`,
      [id]
    );

    // Fetch recent challans for this customer
    const challansResult = await pool.query(
      `SELECT id, challan_number, total_quantity, total_amount, status, created_at
       FROM challans
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...customerResult.rows[0],
        follow_up_notes: notesResult.rows,
        recent_challans: challansResult.rows
      }
    });
  } catch (error: any) {
    console.error('getCustomerById error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error retrieving customer details.' });
  }
};

export const createCustomer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      mobile,
      email,
      business_name,
      gst_number,
      customer_type,
      address,
      status,
      follow_up_date,
      notes
    } = req.body;

    // Validation
    if (!name || !mobile || !business_name || !customer_type || !address) {
      res.status(400).json({
        success: false,
        message: 'Name, mobile, business_name, customer_type, and address are mandatory fields.'
      });
      return;
    }

    const validTypes = ['Retail', 'Wholesale', 'Distributor'];
    if (!validTypes.includes(customer_type)) {
      res.status(400).json({
        success: false,
        message: `Invalid customer_type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    const validStatuses = ['Lead', 'Active', 'Inactive'];
    const currentStatus = status || 'Lead';
    if (!validStatuses.includes(currentStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const userId = req.user?.id || null;

    const result = await pool.query(
      `INSERT INTO customers (
        name, mobile, email, business_name, gst_number, customer_type,
        address, status, follow_up_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        name.trim(),
        mobile.trim(),
        email?.trim() || null,
        business_name.trim(),
        gst_number?.trim() || null,
        customer_type,
        address.trim(),
        currentStatus,
        follow_up_date || null,
        notes?.trim() || null,
        userId
      ]
    );

    const newCustomer = result.rows[0];

    // If initial notes are provided, also create an initial entry in customer_notes
    if (notes?.trim()) {
      await pool.query(
        `INSERT INTO customer_notes (customer_id, note, created_by)
         VALUES ($1, $2, $3)`,
        [newCustomer.id, notes.trim(), userId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      data: newCustomer
    });
  } catch (error: any) {
    console.error('createCustomer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating customer.' });
  }
};

export const updateCustomer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid customer ID.' });
      return;
    }

    const {
      name,
      mobile,
      email,
      business_name,
      gst_number,
      customer_type,
      address,
      status,
      follow_up_date,
      notes
    } = req.body;

    if (!name || !mobile || !business_name || !customer_type || !address) {
      res.status(400).json({
        success: false,
        message: 'Name, mobile, business_name, customer_type, and address are mandatory fields.'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE customers SET
        name = $1,
        mobile = $2,
        email = $3,
        business_name = $4,
        gst_number = $5,
        customer_type = $6,
        address = $7,
        status = $8,
        follow_up_date = $9,
        notes = $10,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        name.trim(),
        mobile.trim(),
        email?.trim() || null,
        business_name.trim(),
        gst_number?.trim() || null,
        customer_type,
        address.trim(),
        status,
        follow_up_date || null,
        notes?.trim() || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully.',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('updateCustomer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating customer.' });
  }
};

export const addCustomerNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid customer ID.' });
      return;
    }

    const { note, follow_up_date } = req.body;

    if (!note || !note.trim()) {
      res.status(400).json({ success: false, message: 'Note text cannot be empty.' });
      return;
    }

    const userId = req.user?.id || null;

    // Check if customer exists
    const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (customerCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found.' });
      return;
    }

    // Insert follow-up note
    const insertResult = await pool.query(
      `INSERT INTO customer_notes (customer_id, note, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, customer_id, note, created_at`,
      [id, note.trim(), userId]
    );

    // Optionally update the follow_up_date and timestamp on the customer
    if (follow_up_date) {
      await pool.query(
        'UPDATE customers SET follow_up_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [follow_up_date, id]
      );
    } else {
      await pool.query(
        'UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    }

    const createdNote = insertResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Follow-up note appended successfully.',
      data: {
        ...createdNote,
        created_by_name: req.user?.name || 'System'
      }
    });
  } catch (error: any) {
    console.error('addCustomerNote error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error adding follow-up note.' });
  }
};
