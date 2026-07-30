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
3. Review `.env.docker` and change the local passwords/secrets if needed.
4. Run `docker compose --env-file .env.docker up --build`.
5. The backend will be available at `http://localhost:5000`.
6. The frontend will be available at `http://localhost:3001`.

Docker starts MySQL on `localhost:3306`. The MySQL image creates the `reg_pay` database and grants `reg_pay_user` access to it. On backend startup, the container applies Prisma migrations, runs the seed script (`npm run seed:super-admin`), then starts the API (see `backend/docker-entrypoint.sh`).

Default seeded super admin from `.env.docker`:

- Email: `admin@reg.rw`
- Phone: `+250788000000`
- Password: `Admin@RegPay2024!`

### Local Development

#### Backend

1. Navigate to `backend/`.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` and fill in your local MySQL connection details.
4. Run migrations: `npx prisma migrate dev`.
5. Seed the database (creates the super admin account): `npm run seed:super-admin`.
6. Start server: `npm run start:dev`.

#### Frontend

1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` (defaults already point at `http://localhost:5000`).
4. Start development server: `npm run dev`.

## Using the App for Testing

Open the frontend (`http://localhost:3001` via Docker, `http://localhost:3000` via `npm run dev`) and log in at `/auth/login` with any account below - `npm run seed:super-admin` creates all of them automatically, so there's no manual setup needed to explore every role.

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | `admin@reg.rw` | `Admin@RegPay2024!` | Full, unscoped system access. |
| Branch Manager | `bm.kic@reg.rw` | `Branch@Manager2024!` | Manages the Kicukiro branch only. One is seeded per branch - swap `kic` for any code below. |
| HR (Headquarters) | `hr.hq@reg.rw` | `Staff@RegPay2024!` | Gives **final** payroll approval for every branch's batches. |
| HR (Kicukiro branch) | `hr.kic@reg.rw` | `Staff@RegPay2024!` | Branch-level HR only - no final payroll-approval authority. Also has `employees.suspend` explicitly revoked (permission-override example). |
| Accountant (HQ) | `accountant.hq@reg.rw` | `Staff@RegPay2024!` | Has `employees.read_all` granted directly, beyond its normal role permissions (permission-override example). |
| Attendant (Kicukiro) | `attendant.kic@reg.rw` | `Staff@RegPay2024!` | Plain ATTENDANT-role account, no overrides. |
| Pending registration | `pending.applicant@reg.rw` | `Staff@RegPay2024!` | Status is PENDING - use to test the approve/reject registration workflow. |
| Suspended account | `suspended.msz@reg.rw` | `Staff@RegPay2024!` | Status is SUSPENDED - confirms an already-issued session is rejected on its next request. |

Every branch manager follows the same `bm.<code>@reg.rw` / `Branch@Manager2024!` pattern. The 9 seeded branch codes: `kic` (Kicukiro), `msz` (Musanze), `rbv` (Rubavu), `huy` (Huye), `mhg` (Muhanga), `rsz` (Rusizi), `nyg` (Nyagatare), `rwm` (Rwamagana), `krg` (Karongi) - plus HQ, which has no branch manager (it's run by the super admin and HQ-based roles).

Attendance, payroll batches, and Ikimina savings start empty by design - create them through the app (Attendance → Daily Logger, Payroll → Generate New Batch) to exercise those flows with real data.

### Testing the API directly

With the backend running, Swagger UI is available at `http://localhost:5000/api`. Call `POST /auth/login` with any account above, then click **Authorize** and paste the returned `access_token` (no `Bearer` prefix needed) to try any endpoint.

### Running the automated test suite

```bash
cd backend
npm run test       # unit tests
npm run test:e2e   # end-to-end tests
npm run test:cov   # coverage report
```

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
