# REG-PAY System

Comprehensive Payroll and Employee Management System for REG (Rwanda Energy Group).

## Features

- **Multi-level Approval Workflow:** Supports request routing from Requestor to Branch Manager and then to Admin.
- **Actionable Notifications:** Approve or reject registrations, transfers, and payroll batches directly from the notification bell.
- **Role-Based Access Control (RBAC):** Fine-grained permissions for different organizational levels.
- **Automatic Routing:** Intelligently routes requests to the appropriate manager based on location.
- **Dockerized:** Easy deployment using Docker and Docker Compose.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MySQL 8.0 (if running locally)

## Getting Started

### Using Docker (Recommended)

1. Clone the repository.
2. Start Docker Desktop.
3. Review `env.docker` and change the local passwords/secrets if needed.
4. Run `docker compose --env-file .env.docker up --build`.
5. The backend will be available at `http://localhost:5000`.
6. The frontend will be available at `http://localhost:3001`.

Docker starts MySQL on `localhost:3306`. The MySQL image creates the `reg_pay` database and grants `reg_pay_user` access to it. On backend startup, Docker runs Prisma migrations, generates the Prisma client, runs `prisma db seed`, then starts the API.

Default seeded super admin from `env.docker`:

- Email: `admin@reg.rw`
- Phone: `+250788000000`
- Password: `Admin@RegPay2024!`

### Local Development

#### Backend

1. Navigate to `backend/`.
2. Install dependencies: `npm install`.
3. Configure `.env` with your database URL.
4. Run migrations: `npx prisma migrate dev`.
5. Start server: `npm run start:dev`.

#### Frontend

1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Configure `.env` with backend URL.
4. Start development server: `npm run dev`.

## Organizational Hierarchy

- **User:** Can request transfers and perform assigned tasks.
- **Branch Manager:** Manages employees and users within their working location.
- **Admin:** Global system management and final approvals.

## Multi-level Transfer Workflow

1. A **User** (with permission) creates a transfer request.
2. System automatically finds the **Branch Manager** of the requestor's location.
3. If no BM exists, it routes directly to **Admin**.
4. BM reviews and approves -> Request moves to **Admin**.
5. Admin reviews and approves -> Transfer is finalized.
6. Rejection at any level returns the request to the requestor with a reason.

## Support

Contact: [admin@regpay.local](mailto:admin@regpay.local)
