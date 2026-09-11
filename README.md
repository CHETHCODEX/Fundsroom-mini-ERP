# FundsRoom Operations Portal — Mini ERP + CRM

A production-grade, full-stack Mini ERP and CRM Operations Portal designed for wholesale and distribution enterprises. Built with a **Node.js / Express / TypeScript** backend, **PostgreSQL** relational database with strict ACID transactions, and a **React / TypeScript / Vite** responsive admin interface.

---

## 🌐 Live Production Deployments

- 🖥️ **Live Web Application (Frontend)**: [https://fundsroom-mini-erp-lyart.vercel.app](https://fundsroom-mini-erp-lyart.vercel.app)
- ⚙️ **Live REST API (Backend)**: [https://fundsroom-mini-erp-jt8x.onrender.com/api](https://fundsroom-mini-erp-jt8x.onrender.com/api)
- 🩺 **API Health Check**: [https://fundsroom-mini-erp-jt8x.onrender.com/api/health](https://fundsroom-mini-erp-jt8x.onrender.com/api/health)
- 📦 **GitHub Repository**: [https://github.com/CHETHCODEX/Fundsroom-mini-ERP](https://github.com/CHETHCODEX/Fundsroom-mini-ERP)
- 🗄️ **Database**: Cloud PostgreSQL on Neon.tech (Serverless)

---

## 🏗️ Architecture Overview

```
                          ┌────────────────────────┐
                          │   React + Vite Client  │
                          │      (Port: 5173)      │
                          └───────────┬────────────┘
                                      │ REST APIs + JWT Bearer
                                      ▼
                          ┌────────────────────────┐
                          │ Express + Node Backend │
                          │      (Port: 5000)      │
                          └───────────┬────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
    [Pessimistic Row Lock]                             [Audit Logging]
  SELECT ... FOR UPDATE                              INSERT INTO stock_movements
            │                                                   │
            ▼                                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database                             │
│   users • customers • customer_notes • products • challans • items     │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Highlights
1. **Concurrency & Negative Stock Prevention**:
   - Every confirmed sales challan is wrapped in a strict PostgreSQL transaction (`BEGIN ... COMMIT / ROLLBACK`).
   - Line items are sorted by `product_id` and locked using `SELECT ... FOR UPDATE` to avoid deadlocks and isolate against race conditions under concurrent checkouts.
   - Availability is verified inside the locked state; if any item exceeds on-hand stock, the entire transaction rolls back immediately and returns HTTP `400 Bad Request` with error code `INSUFFICIENT_STOCK`.
2. **Product Snapshots on Sale**:
   - `challan_items` stores an immutable snapshot of `product_name`, `product_sku`, and `unit_price` at the moment of creation, shielding historical invoices against future catalog price edits.
3. **Audit Trail**:
   - Every inventory adjustment (manual inward/outward adjustments or challan dispatches) writes an immutable record to `stock_movements`.
4. **Role-Based Access Control (RBAC)**:
   - Four distinct employee personas: `Admin`, `Sales`, `Warehouse`, and `Accounts`.

---

## 👥 Default Test Credentials

All pre-seeded test accounts use the password: `password123`

| Role | Email Address | Password | Permissions & Scope |
|---|---|---|---|
| **Admin** | `admin@fundsroom.com` | `password123` | Full access across CRM, Inventory, Challans, and User Management |
| **Sales** | `sales@fundsroom.com` | `password123` | Manage Customers, append follow-up notes, generate & confirm Challans |
| **Warehouse** | `warehouse@fundsroom.com` | `password123` | View catalog, execute stock adjustments (IN/OUT), audit logs |
| **Accounts** | `accounts@fundsroom.com` | `password123` | Review confirmed invoices, delivery slips, customer balances |

> *Tip: The frontend login page includes 1-click quick login buttons for all four roles.*

---

## 🚀 Quickstart: Local Setup Instructions

### Prerequisites
- **Node.js**: v18+ (tested on Node v22.x)
- **npm**: v9+
- **PostgreSQL**: Local instance OR a free cloud database (Supabase / Neon / Render Postgres)

---

### Step 1: Database Setup
You can use a local PostgreSQL instance or create a free PostgreSQL database on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).

1. Execute the complete schema and seed file [`sql/schema.sql`](sql/schema.sql):
   ```bash
   psql -U postgres -d fundsroom_db -f sql/schema.sql
   ```
   *Alternatively, using Neon/Supabase SQL Editor, simply copy-paste the contents of `sql/schema.sql` and run it.*

---

### Step 2: Backend Setup
1. Navigate into the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fundsroom_db
   JWT_SECRET=supersecret_fundsroom_jwt_key_2026_change_in_production
   FRONTEND_URL=http://localhost:5173
   ```
4. Build and start the backend:
   ```bash
   # Build TypeScript
   npm run build

   # Start production server
   npm start

   # OR run development server with hot-reload:
   npm run dev
   ```
   Backend API will run at: `http://localhost:5000/api`
   Health check: `http://localhost:5000/api/health`

---

### Step 3: Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` points to the backend:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Start Vite development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

---

## 🔒 Concurrency & Stock Deduction Logic

The sales challan confirmation engine implements pessimistic row-locking (`SELECT ... FOR UPDATE`):

```sql
-- 1. Sort product IDs ascending to prevent distributed deadlocks
SELECT id, name, sku, unit_price, current_stock 
FROM products 
WHERE id = ANY($1::int[]) 
ORDER BY id ASC 
FOR UPDATE;

-- 2. Verify stock >= requested_quantity inside the locked lock boundary
-- If any item fails, transaction executes ROLLBACK and aborts.

-- 3. Deduct stock safely
UPDATE products 
SET current_stock = current_stock - $qty, updated_at = CURRENT_TIMESTAMP 
WHERE id = $productId;

-- 4. Record stock audit movement
INSERT INTO stock_movements (product_id, quantity_changed, movement_type, reason, created_by)
VALUES ($productId, $qty, 'OUT', 'Sales Challan ' || $challanNumber, $userId);

-- 5. Commit transaction atomically
COMMIT;
```

---

## 📮 Postman API Collection & Testing

A complete Postman test collection is provided in the repository root: [`postman_collection.json`](postman_collection.json).

### Importing and Running:
1. Open **Postman** -> Click **Import** -> Select `postman_collection.json`.
2. The collection defines two variables:
   - `baseUrl`: `http://localhost:5000/api`
   - `token`: automatically populated upon running any `Login` request!
3. **Core Test Scenarios**:
   - **Login**: Execute `1. Authentication & RBAC -> Login - Admin`. Token will be captured and used for subsequent requests.
   - **Customer CRM**: Create customer, list with pagination/search, append timestamped follow-up note.
   - **Products**: Check low-stock alerts, adjust inventory IN/OUT.
   - **Challan Success Case**: `4. Sales Challan Module -> Create Challan - Confirmed [SUCCESS CASE]`. Verifies HTTP 201 and stock reduction.
   - **Challan Insufficient Stock Failure Case**: `4. Sales Challan Module -> Create Challan - Confirmed [FAILURE CASE - Insufficient Stock 400]`. Sends quantity `999999` exceeding stock. Verifies HTTP 400, `INSUFFICIENT_STOCK` error code, and zero database modification (rollback).

---

## ☁️ Cloud Deployment Guide

### 1. Database Deployment (Supabase / Neon)
1. Sign up for a free account on [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
2. Create a new PostgreSQL database instance.
3. In the SQL Editor on your cloud dashboard, open and paste the contents of [`sql/schema.sql`](sql/schema.sql) and execute it.
4. Copy the connection string (ensure pooling or direct URI with `sslmode=require`).

### 2. Backend Deployment (Render.com)
1. Push this repository to GitHub.
2. Log into [Render](https://render.com) -> New **Web Service**.
3. Select your repository.
4. Set the following configuration:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Configure Environment Variables in Render:
   - `DATABASE_URL`: *Your Neon / Supabase connection string*
   - `JWT_SECRET`: *A strong random secret string*
   - `PORT`: `5000`
   - `FRONTEND_URL`: *Your Vercel frontend URL (or `*` during initial launch)*
6. Click **Deploy Web Service**. Copy your backend URL (e.g. `https://fundsroom-backend.onrender.com`).

### 3. Frontend Deployment (Vercel)
1. Log into [Vercel](https://vercel.com) -> **Add New Project**.
2. Select your repository.
3. Set the following configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL`: `https://fundsroom-backend.onrender.com/api`
5. Click **Deploy**. Your frontend will be live on Vercel with HTTPS!

---

## ⚠️ Known Limitations & Future Roadmap

1. **GST Invoice Tax Calculation Engine**: Current challan stores basic gross subtotals; future enhancement can support IGST/CGST/SGST 18% breakdowns based on state code matching.
2. **Automated Purchase Order (PO) Inward Ingest**: Stock inward currently handled via manual adjustment or PO remarks; a dedicated Purchase Order to GRN (Goods Receipt Note) workflow would further streamline vendor replenishment.
3. **Partial Challan Fulfillment**: Challans currently process fully; partial shipment splitting (backorder queues) can be added as order volume scales.
4. **Document Export**: PDF export currently utilizes the browser's native print engine (`window.print()`); server-side PDF generation using headless Puppeteer or PDFKit can be added for automated emailing.

---

## 📄 License
MIT License. Built for FundsRoom Technical Evaluation.
