# REG Payment System

## Backend
Enterprise payrol and employees management backend system built with NestJS, Prisma ORM & MySQL.

### Backend Features
- JWT Authentication
- Refresh Token 
- Role Based Access Control (RBAC)
- User Approval Workflow
- Employee Management
- Employee Transfer Requests
- Payroll Batch Processing
- Payment Structures
- Attendance & Time Tracking
- Department Management
- Working Location Management
- Enterprise Permissions System
- Prisma ORM Integration
- MySQL Database

### Tech Stack
1. NestJS
2. Prisma ORM
3. MySQL
4. JWT Authentication
5. TypeScript


## Project Structure
## Project Structure

```bash
reg_pay/
│
├── backend/
│   │
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   │
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   ├── dto/
│   │   │   ├── guards/
│   │   │   ├── interfaces/
│   │   │   ├── strategies/
│   │   │   ├── utils/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.module.ts
│   │   │   └── auth.service.ts
│   │   │
│   │   ├── users/
│   │   │   ├── dto/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.module.ts
│   │   │   └── users.service.ts
│   │   │
│   │   ├── employees/
│   │   │   ├── dto/
│   │   │   ├── employees.controller.ts
│   │   │   ├── employees.module.ts
│   │   │   └── employees.service.ts
│   │   │
│   │   ├── organization/
│   │   │   ├── dto/
│   │   │   ├── organization.controller.ts
│   │   │   ├── organization.module.ts
│   │   │   └── organization.service.ts
│   │   │
│   │   ├── permissions/
│   │   │   ├── dto/
│   │   │   ├── permissions.controller.ts
│   │   │   ├── permissions.module.ts
│   │   │   └── permissions.service.ts
│   │   │
│   │   ├── payroll/
│   │   │   ├── dto/
│   │   │   ├── payroll.controller.ts
│   │   │   ├── payroll.module.ts
│   │   │   └── payroll.service.ts
│   │   │
│   │   ├── payment-structures/
│   │   │   ├── dto/
│   │   │   ├── payment-structures.controller.ts
│   │   │   ├── payment-structures.module.ts
│   │   │   └── payment-structures.service.ts
│   │   │
│   │   ├── time-records/
│   │   │   ├── dto/
│   │   │   ├── time-records.controller.ts
│   │   │   ├── time-records.module.ts
│   │   │   └── time-records.service.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   │
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── enums/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   │
│   │   ├── config/
│   │   │   ├── env/
│   │   │   └── configuration.ts
│   │   │
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   │
│   ├── test/
│   │   ├── app.e2e-spec.ts
│   │   └── jest-e2e.json
│   │
│   ├── .env
│   ├── .gitignore
│   ├── eslint.config.mjs
│   ├── nest-cli.json
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── tsconfig.build.json
│   └── tsconfig.json
│
└── frontend/
```

## Backend Setup
1. Clone Repo
2. Navigate to backend folder
```bash
cd backend
```
3. Install dependencies
```bash
npm install
```
#### Database setup
1. Create **MySQL** Database
```bash
CREATE DATABASE reg_pay;
```
2. Configure Environment Variables
- Create **.env** under backend:
```bash
DATABASE_URL="mysql://root:password@localhost:3306/reg_pay"

PORT=3000

JWT_ACCESS_SECRET=supersecretaccess JWT_REFRESH_SECRET=supersecretrefresh JWT_ACCESS_EXPIRES_IN=15m JWT_REFRESH_EXPIRES_IN=7d SEED_SUPER_ADMIN_EMAIL=admin@regpay.local SEED_SUPER_ADMIN_PHONE=+250788000000 SEED_SUPER_ADMIN_PASSWORD=ChangeMe123!
```
#### Prisma Setup
1. 
```bash
npx prisma migrate dev --name init
```
2.
```bash
npm run seed:super-admin
```
### Start backend
1. 
```bash
npm run start:dev
```

## API Endpoints
- **`http://localhost:3000`**

1. Authentication
Authorization : Bearer ACCESS_TOKEN

- **Login**
Request: `POST /auth/login`
Body: {
    "identifier": "admin@regpay.local",
    "password": "ChangeMe123!"
}

### Main API Enpoints
```bash
1. Authentication
Method	                    Endpoint
POST	                    /auth/register
POST	                    /auth/login
POST	                    /auth/refresh
POST	                    /auth/logout
POST	                    /auth/logout-all

2. Users
Method	                     Endpoint
GET	                         /users
GET	                         /users/pending
PATCH	                     /users//approve
PATCH	                     /users//reject
PATCH	                     /users//suspend
PATCH	                     /users//roles
POST	                     /users//transfer-requests
PATCH	                     /users/transfer-requests//approve
PATCH	                     /users/transfer-requests//reject

3. Employees
Method	                      Endpoint
POST	                      /employees/register
POST	                      /employees
GET	                          /employees
GET	                          /employees/
PATCH	                      /employees//approve
PATCH	                      /employees//link-user
PATCH	                      /employees//transfer
PATCH	                      /employees/transfer-requests//approve
PATCH	                      /employees/transfer-requests//reject
PATCH	                      /employees//suspend
PATCH	                      /employees//reactivate

4. Organization
Method	                       Endpoint
POST	                       /organization/working-locations
GET	                           /organization/working-locations
POST	                       /organization/departments
GET	                           /organization/departments
PATCH	                       /organization/working-locations//manager
PATCH	                       /organization/departments//manager

5. Permissions
Method	                       Endpoint
POST	                       /permissions
GET	                           /permissions
POST	                       /permissions/assign-role
DELETE	                       /permissions/assign-role

6. Time Records
Method	                      Endpoint
POST	                      /time-records
PATCH	                      /time-records//clock-out
PATCH	                      /time-records//approve
GET	                          /time-records/employee/

7. Payment Structures
Method	                      Endpoint
POST	                      /payment-structures
PATCH	                      /payment-structures/
GET	                          /payment-structures/employee/
GET	                          /payment-structures/employee//active

8. Payroll
Method	                      Endpoint
POST	                      /payroll/batches
GET	                          /payroll/batches
GET	                          /payroll/batches/
PATCH	                      /payroll/batches//approve
PATCH	                      /payroll/batches//reject
PATCH	                      /payroll/batches/items//approve
PATCH	                      /payroll/batches/items//reject
```
