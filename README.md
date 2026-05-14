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

JWT_ACCESS_SECRET=supersecretaccess JWT_REFRESH_SECRET=supersecretrefresh

JWT_ACCESS_EXPIRES_IN=15m JWT_REFRESH_EXPIRES_IN=7d 

SEED_SUPER_ADMIN_EMAIL=admin@regpay.local SEED_SUPER_ADMIN_PHONE=+250788000000 SEED_SUPER_ADMIN_PASSWORD=ChangeMe123!
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
# Backend API Endpoints

Base URL is controlled in the frontend by `NEXT_PUBLIC_API_URL` and currently defaults to:

```env
http://localhost:5000
```
```bash
1. General
| Method | Endpoint | Description / Body         |
| ------ | -------- | -------------------------- |
| GET    | `/`      | Backend hello/status route |

2. Auth
| Method | Endpoint           | Body                                                                                                                           |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth/register`   | `first_name`, `last_name`, `email`, `phone_number`, `password`, `gender` <br> Optional: `department_id`, `working_location_id` |
| POST   | `/auth/login`      | `identifier` (email or phone number), `password`                                                                               |
| POST   | `/auth/refresh`    | `refresh_token`                                                                                                                |
| POST   | `/auth/logout`     | `refresh_token` <br> Requires Bearer token                                                                                     |
| POST   | `/auth/logout-all` | Requires Bearer token                                                                                                          |

3. Users
| Method | Endpoint                                 | Description / Body                                               |
| ------ | ---------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/users`                                 | Same body as `/auth/register`                                    |
| GET    | `/users`                                 | Roles: `SUPER_ADMIN`, `ADMIN`                                    |
| GET    | `/users/pending`                         | Roles: `SUPER_ADMIN`, `ADMIN`                                    |
| PATCH  | `/users/:uuid/approve`                   | `working_location_id`, `department_id` <br> Optional: `role_ids` |
| PATCH  | `/users/:uuid/reject`                    | `reason`                                                         |
| PATCH  | `/users/:uuid/suspend`                   | No body                                                          |
| PATCH  | `/users/:uuid/roles`                     | `role_ids`                                                       |
| POST   | `/users/:uuid/transfer-requests`         | `working_location_id` <br> Optional: `department_id`, `reason`   |
| PATCH  | `/users/transfer-requests/:uuid/approve` | No body                                                          |
| PATCH  | `/users/transfer-requests/:uuid/reject`  | `rejection_reason`                                               |

4. Employees
| Method | Endpoint                                     | Description / Body                                                                                                                                                                  |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/employees/register`                        | `first_name`, `last_name`, `gender` <br> Optional: `user_id`, `email`, `phone_number`, `password`, `national_id`, `hire_date`, `department_id`, `working_location_id`. If `password` is provided, email and phone are required and a linked inactive user account is created. Employment category is assigned later by admin or branch manager. |
| POST   | `/employees`                                 | Same body as register <br> Requires roles and `employees.create`                                                                                                                    |
| GET    | `/employees`                                 | Requires `employees.read`                                                                                                                                                           |
| GET    | `/employees/:uuid`                           | Requires `employees.read`                                                                                                                                                           |
| PATCH  | `/employees/:uuid/approve`                   | `working_location_id`, `department_id`, `employment_category_id`, `hire_date`                                                                                                       |
| PATCH  | `/employees/:uuid/link-user`                 | `user_id`                                                                                                                                                                           |
| PATCH  | `/employees/:uuid/transfer`                  | `working_location_id`, `department_id` <br> Optional: `employment_category_id`, `reason`                                                                                            |
| PATCH  | `/employees/transfer-requests/:uuid/approve` | No body                                                                                                                                                                             |
| PATCH  | `/employees/transfer-requests/:uuid/reject`  | `rejection_reason`                                                                                                                                                                  |
| PATCH  | `/employees/:uuid/suspend`                   | Optional: `reason`                                                                                                                                                                  |
| PATCH  | `/employees/:uuid/reactivate`                | No body                                                                                                                                                                             |

5. Organization
| Method | Endpoint                                      | Description / Body                                                 |
| ------ | --------------------------------------------- | ------------------------------------------------------------------ |
| POST   | `/organization/working-locations`             | `name`, `type` (`HQ` or `BRANCH`), `address`                       |
| GET    | `/organization/working-locations`             | Public lookup route for registration forms                         |
| POST   | `/organization/departments`                   | `working_location_id`, `code`, `name` <br> Optional: `description` |
| GET    | `/organization/departments`                   | Public lookup route. Optional query: `working_location_id`         |
| PATCH  | `/organization/working-locations/:uuid/manager` | `user_id`                                                        |
| PATCH  | `/organization/departments/:uuid/manager`     | `user_id`                                                          |

6. Permissions
| Method | Endpoint                   | Description / Body                       |
| ------ | -------------------------- | ---------------------------------------- |
| POST   | `/permissions`             | `name`, `module_name`, `permission_key`  |
| GET    | `/permissions`             | Requires `permissions.read`              |
| POST   | `/permissions/assign-role` | `role_id`, `permission_id`               |
| DELETE | `/permissions/assign-role` | Query params: `role_id`, `permission_id` |

7. Time Records
| Method | Endpoint                             | Description / Body                                                              |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| POST   | `/time-records`                      | `employee_id`, `attendance_date` <br> Optional: `clock_in`, `attendance_status` |
| PATCH  | `/time-records/:uuid/clock-out`      | Optional: `clock_out`, `attendance_status`                                      |
| PATCH  | `/time-records/:uuid/approve`        | Optional: `comment`                                                             |
| GET    | `/time-records/employee/:employeeId` | Requires `attendance.read`                                                      |

9. Payment Structures 
| Method | Endpoint                                                       | Description / Body                                                                                                    |
| ------ | -------------------------------------------------------------- |------------------------------------------------------- |
| POST   | `/payment-structures`| `employee_id`, `payroll_frequency`, `basic_salary`, `daily_rate`, `overtime_rate`, `tax_percentage`, `effective_from` |

| PATCH  | `/payment-structures/:uuid`                                    | Optional: `payroll_frequency`, `basic_salary`, `daily_rate`, `overtime_rate`, `tax_percentage`, `effective_to`        |
| GET    | `/payment-structures/employee/:employeeId`                     | Payment structures for employee                                                                                       |
| GET    | `/payment-structures/employee/:employeeId/active`              | Active payment structure                                                                                              |
| POST   | `/payment-structures/deduction-types`                          | `name`, `deduction_mode` <br> Optional: `amount`, `percentage_value`, `is_mandatory`                                  |
| GET    | `/payment-structures/decution-types`                           | ⚠ Backend route currently spelled `decution-types`                                                                    |
| PATCH  | `/payment-structures/deduction-types/:uuid`                    | Update deduction type                                                                                                 |
| POST   | `/payment-structures/employee-dedductions`                     | ⚠ Backend route currently spelled `employee-dedductions`                                                              |
| GET    | `/payment-structures/employee-dedductions/empoyee/:employeeId` | ⚠ Backend route currently spelled `empoyee`                                                                           |
| PATCH  | `/payment-structures/employee-deductions/:uuid`                | Update employee deduction                                                                                             |
| PATCH  | `/payment-structures/employee-deductions/:uuid/delete`         | Soft delete employee deduction                                                                                        |

10. Payroll
| Method | Endpoint                               | Description / Body                                                                       |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST   | `/payroll/batches`                     | `working_location_id`, `payroll_month`, `payroll_year`, `payment_date`, `payment_method` |
| GET    | `/payroll/batches`                     | List payroll batches                                                                     |
| GET    | `/payroll/batches/:uuid`               | Payroll batch details                                                                    |
| PATCH  | `/payroll/batches/:uuid/approve`       | Optional: `comment`                                                                      |
| PATCH  | `/payroll/batches/:uuid/reject`        | `rejection_reason`                                                                       |
| PATCH  | `/payroll/batches/items/:uuid/approve` | Optional: `comment`                                                                      |
| PATCH  | `/payroll/batches/items/:uuid/reject`  | `rejection_reason`                                                                       |
```
