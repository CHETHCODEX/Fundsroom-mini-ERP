-- ============================================================================
-- FundsRoom Mini ERP + CRM Database Schema
-- Database Target: PostgreSQL (Supabase, Neon, Render Postgres, Local)
-- ============================================================================

-- Clean up existing tables in reverse dependency order
DROP TABLE IF EXISTS challan_items CASCADE;
DROP TABLE IF EXISTS challans CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS customer_notes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS & ROLES TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Sales', 'Warehouse', 'Accounts')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CUSTOMERS TABLE (CRM)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    business_name VARCHAR(200) NOT NULL,
    gst_number VARCHAR(20),
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('Retail', 'Wholesale', 'Distributor')),
    address TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Active', 'Inactive')),
    follow_up_date DATE,
    notes TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CUSTOMER FOLLOW-UP NOTES (Append-only timeline)
CREATE TABLE customer_notes (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRODUCTS & INVENTORY TABLE
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_alert INT NOT NULL DEFAULT 10 CHECK (min_stock_alert >= 0),
    location VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. STOCK MOVEMENTS LOG TABLE (Audit trail for inventory)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_changed INT NOT NULL CHECK (quantity_changed > 0),
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    reason VARCHAR(255) NOT NULL,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SALES CHALLANS TABLE
CREATE TABLE challans (
    id SERIAL PRIMARY KEY,
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    total_quantity INT NOT NULL CHECK (total_quantity > 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed', 'Cancelled')),
    notes TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. CHALLAN ITEMS TABLE (Stores snapshot of product at time of sale)
CREATE TABLE challan_items (
    id SERIAL PRIMARY KEY,
    challan_id INT NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(200) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- PERFORMANCE INDEXES
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_customers_search ON customers(name, mobile, business_name);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_challans_number ON challans(challan_number);
CREATE INDEX idx_challans_customer ON challans(customer_id);
CREATE INDEX idx_challans_status ON challans(status);
CREATE INDEX idx_challan_items_challan ON challan_items(challan_id);

-- ============================================================================
-- SEED DATA
-- Default password for all seed accounts is: password123
-- Hash generated using bcrypt: $2a$10$4n96hIuB7v23x31WdI5aEOWJz10/aZJ3.5n9h6w0bZk2R2k9eA.1m
-- ============================================================================

INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Admin User', 'admin@fundsroom.com', '$2a$10$SyC14qCHmMWL5vhPEsxO/Oj5H4mc/WPy/Ff2h3q5Rrow7ZQ1oLQgS', 'Admin'),
(2, 'Sarah Sales', 'sales@fundsroom.com', '$2a$10$SyC14qCHmMWL5vhPEsxO/Oj5H4mc/WPy/Ff2h3q5Rrow7ZQ1oLQgS', 'Sales'),
(3, 'Warren Warehouse', 'warehouse@fundsroom.com', '$2a$10$SyC14qCHmMWL5vhPEsxO/Oj5H4mc/WPy/Ff2h3q5Rrow7ZQ1oLQgS', 'Warehouse'),
(4, 'Alex Accounts', 'accounts@fundsroom.com', '$2a$10$SyC14qCHmMWL5vhPEsxO/Oj5H4mc/WPy/Ff2h3q5Rrow7ZQ1oLQgS', 'Accounts');

-- Sync user sequence
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Seed Customers
INSERT INTO customers (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes, created_by) VALUES
(1, 'Rajesh Sharma', '9876543210', 'rajesh@sharmatraders.in', 'Sharma Traders Pvt Ltd', '27AABCS1429B1Z8', 'Distributor', 'Plot 42, Sector 18, MIDC Bhosari, Pune - 411026', 'Active', '2026-09-20', 'High-volume buyer of industrial fasteners and fasteners accessories.', 2),
(2, 'Pooja Mehta', '9822012345', 'pooja@mehtahardware.com', 'Mehta Hardware Mart', '27AAECP4589C1ZT', 'Wholesale', 'Shop 12-14, Laxmi Road Hardware Market, Pune - 411030', 'Active', '2026-09-15', 'Regular monthly orders, prefers 15-day payment terms.', 2),
(3, 'Vikram Patil', '9765432190', 'vikram@patilelectricals.com', 'Patil Electrical & Automation', '27AASPP7890D1Z2', 'Retail', 'Building 4, Chinchwad Station Road, Pune - 411019', 'Lead', '2026-09-12', 'Interested in bulk industrial cable supply. Follow up after proposal review.', 2),
(4, 'Anand Deshmukh', '9890123456', 'anand@deshmukhconstructions.in', 'Deshmukh Infrastructure Ltd', '27AAJCD6789E1ZX', 'Wholesale', 'Tower B, Senapati Bapat Road, Pune - 411016', 'Active', '2026-09-25', 'Supplying hardware & tools for ongoing commercial project.', 2),
(5, 'Suresh Kumar', '9422334455', 'suresh@kumarretail.in', 'Kumar Retail Depot', NULL, 'Retail', 'Near Bus Stand, Hadapsar, Pune - 411028', 'Inactive', NULL, 'Account dormant since Q1 due to store renovation.', 2);

SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

-- Seed Customer Follow-up Notes
INSERT INTO customer_notes (customer_id, note, created_by, created_at) VALUES
(1, 'Initial onboarding call completed. Approved credit limit of Rs 5,00,000.', 2, CURRENT_TIMESTAMP - INTERVAL '10 days'),
(1, 'Client requested revised catalog for Q3 fastener pricing.', 2, CURRENT_TIMESTAMP - INTERVAL '3 days'),
(3, 'Lead generated from industrial trade fair. Sent introductory quotation.', 2, CURRENT_TIMESTAMP - INTERVAL '2 days');

-- Seed Products
INSERT INTO products (id, name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES
(1, 'High Tensile M10 Bolt (Pack of 100)', 'FST-BLT-M10', 'Fasteners', 450.00, 150, 25, 'Bay A-1, Rack 03'),
(2, 'Stainless Steel Nut M10 (Pack of 100)', 'FST-NUT-M10', 'Fasteners', 320.00, 200, 30, 'Bay A-1, Rack 04'),
(3, 'Industrial Copper Cable 4 sq mm (100m Roll)', 'CBL-COP-04', 'Electrical', 4200.00, 35, 10, 'Bay B-2, Rack 01'),
(4, 'Armoured Multi-core Cable 6 sq mm (50m Roll)', 'CBL-ARM-06', 'Electrical', 5800.00, 18, 5, 'Bay B-2, Rack 02'),
(5, 'Heavy Duty Angle Grinder 850W', 'TOL-GRN-850', 'Power Tools', 2750.00, 8, 10, 'Bay C-1, Secure Cage'),
(6, 'Professional Rotary Hammer Drill 800W', 'TOL-DRL-800', 'Power Tools', 4500.00, 14, 5, 'Bay C-1, Secure Cage'),
(7, 'Corrugated Shipping Box 5-Ply (Bundle of 25)', 'PKG-BOX-5P', 'Packaging', 850.00, 4, 15, 'Warehouse Floor D'),
(8, 'Industrial Stretch Film Wrap 500mm x 300m', 'PKG-STR-500', 'Packaging', 620.00, 45, 10, 'Warehouse Floor D');

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Seed Initial Stock Movements
INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by) VALUES
(1, 150, 'IN', 'Initial warehouse inventory import', 3),
(2, 200, 'IN', 'Initial warehouse inventory import', 3),
(3, 35, 'IN', 'Initial warehouse inventory import', 3),
(4, 18, 'IN', 'Initial warehouse inventory import', 3),
(5, 8, 'IN', 'Initial warehouse inventory import', 3),
(6, 14, 'IN', 'Initial warehouse inventory import', 3),
(7, 4, 'IN', 'Initial warehouse inventory import', 3),
(8, 45, 'IN', 'Initial warehouse inventory import', 3);

-- Seed Sample Challans
-- Sample 1: Confirmed Challan
INSERT INTO challans (id, challan_number, customer_id, total_quantity, total_amount, status, notes, created_by, created_at) VALUES
(1, 'CH-20260901-0001', 1, 15, 12700.00, 'Confirmed', 'Dispatched via Express Cargo Truck MH-12-AB-1234', 2, CURRENT_TIMESTAMP - INTERVAL '5 days');

INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity, subtotal) VALUES
(1, 1, 'High Tensile M10 Bolt (Pack of 100)', 'FST-BLT-M10', 450.00, 10, 4500.00),
(1, 3, 'Industrial Copper Cable 4 sq mm (100m Roll)', 'CBL-COP-04', 4200.00, 1, 4200.00),
(1, 8, 'Industrial Stretch Film Wrap 500mm x 300m', 'PKG-STR-500', 620.00, 4, 2480.00),
(1, 2, 'Stainless Steel Nut M10 (Pack of 100)', 'FST-NUT-M10', 320.00, 5, 1600.00);

-- Stock movement OUT for Confirmed challan
INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by, created_at) VALUES
(1, 10, 'OUT', 'Sales Challan CH-20260901-0001', 2, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(3, 1, 'OUT', 'Sales Challan CH-20260901-0001', 2, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(8, 4, 'OUT', 'Sales Challan CH-20260901-0001', 2, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(2, 5, 'OUT', 'Sales Challan CH-20260901-0001', 2, CURRENT_TIMESTAMP - INTERVAL '5 days');

-- Sample 2: Draft Challan (Stock not yet deducted)
INSERT INTO challans (id, challan_number, customer_id, total_quantity, total_amount, status, notes, created_by, created_at) VALUES
(2, 'CH-20260910-0002', 2, 6, 9240.00, 'Draft', 'Pending warehouse packing verification', 2, CURRENT_TIMESTAMP - INTERVAL '1 days');

INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity, subtotal) VALUES
(2, 5, 'Heavy Duty Angle Grinder 850W', 'TOL-GRN-850', 2750.00, 2, 5500.00),
(2, 8, 'Industrial Stretch Film Wrap 500mm x 300m', 'PKG-STR-500', 620.00, 4, 2480.00),
(2, 2, 'Stainless Steel Nut M10 (Pack of 100)', 'FST-NUT-M10', 320.00, 4, 1280.00);

SELECT setval('challans_id_seq', (SELECT MAX(id) FROM challans));
