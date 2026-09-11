export type UserRole = 'Admin' | 'Sales' | 'Warehouse' | 'Accounts';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type CustomerType = 'Retail' | 'Wholesale' | 'Distributor';
export type CustomerStatus = 'Lead' | 'Active' | 'Inactive';

export interface CustomerNote {
  id: number;
  customer_id: number;
  note: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email?: string | null;
  business_name: string;
  gst_number?: string | null;
  customer_type: CustomerType;
  address: string;
  status: CustomerStatus;
  follow_up_date?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  notes_count?: number;
  created_at: string;
  updated_at: string;
  follow_up_notes?: CustomerNote[];
  recent_challans?: Array<{
    id: number;
    challan_number: string;
    total_quantity: number;
    total_amount: number;
    status: ChallanStatus;
    created_at: string;
  }>;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit_price: number | string;
  current_stock: number;
  min_stock_alert: number;
  location: string;
  is_low_stock?: boolean;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity_changed: number;
  movement_type: MovementType;
  reason: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export type ChallanStatus = 'Draft' | 'Confirmed' | 'Cancelled';

export interface ChallanItem {
  id?: number;
  challan_id?: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Challan {
  id: number;
  challan_number: string;
  customer_id: number;
  customer_name?: string;
  customer_business?: string;
  customer_mobile?: string;
  customer_email?: string;
  customer_gst?: string;
  customer_address?: string;
  total_quantity: number;
  total_amount: number | string;
  status: ChallanStatus;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  item_count?: number;
  created_at: string;
  updated_at: string;
  items?: ChallanItem[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
