import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../types';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Customer metrics
    const custStats = await pool.query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE status = 'Active') as active_customers,
        COUNT(*) FILTER (WHERE status = 'Lead') as active_leads
      FROM customers
    `);

    // 2. Product & Inventory metrics
    const prodStats = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE current_stock <= min_stock_alert) as low_stock_alerts,
        COALESCE(SUM(current_stock), 0) as total_units_in_stock
      FROM products
    `);

    // 3. Challan metrics
    const challanStats = await pool.query(`
      SELECT 
        COUNT(*) as total_challans,
        COUNT(*) FILTER (WHERE status = 'Confirmed') as confirmed_challans,
        COUNT(*) FILTER (WHERE status = 'Draft') as draft_challans,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'Confirmed'), 0) as total_confirmed_revenue
      FROM challans
    `);

    // 4. Recent activity
    const recentChallans = await pool.query(`
      SELECT ch.id, ch.challan_number, ch.total_amount, ch.status, ch.created_at, c.business_name
      FROM challans ch
      JOIN customers c ON ch.customer_id = c.id
      ORDER BY ch.created_at DESC
      LIMIT 5
    `);

    const lowStockItems = await pool.query(`
      SELECT id, name, sku, current_stock, min_stock_alert, location
      FROM products
      WHERE current_stock <= min_stock_alert
      ORDER BY current_stock ASC
      LIMIT 5
    `);

    res.status(200).json({
      success: true,
      data: {
        customers: {
          total: parseInt(custStats.rows[0].total_customers, 10),
          active: parseInt(custStats.rows[0].active_customers, 10),
          leads: parseInt(custStats.rows[0].active_leads, 10),
        },
        inventory: {
          totalProducts: parseInt(prodStats.rows[0].total_products, 10),
          lowStockAlerts: parseInt(prodStats.rows[0].low_stock_alerts, 10),
          totalStockUnits: parseInt(prodStats.rows[0].total_units_in_stock, 10),
        },
        challans: {
          total: parseInt(challanStats.rows[0].total_challans, 10),
          confirmed: parseInt(challanStats.rows[0].confirmed_challans, 10),
          draft: parseInt(challanStats.rows[0].draft_challans, 10),
          revenue: parseFloat(challanStats.rows[0].total_confirmed_revenue),
        },
        recentChallans: recentChallans.rows,
        lowStockItems: lowStockItems.rows,
      }
    });
  } catch (error: any) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching dashboard stats.' });
  }
};
