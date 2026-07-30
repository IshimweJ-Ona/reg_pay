# REG-PAY Backend

NestJS + Prisma (MySQL) API for the REG-PAY payroll and employee management system.

See the [repository root README](../README.md) for full setup instructions (Docker and local). Quick reference for local development once `.env` is configured (copy `.env.example`):

```bash
npm install
npx prisma migrate dev
npm run seed:super-admin
npm run start:dev
```

## Scripts

- `npm run start:dev` - start the API in watch mode.
- `npm run start:prod` - start the compiled API (used in production/Docker).
- `npm run build` - compile TypeScript to `dist/`.
- `npm run lint` - run ESLint with `--fix`.
- `npm run test` / `test:e2e` / `test:cov` - unit tests, e2e tests, coverage.
- `npm run seed:super-admin` - run `prisma/seed.ts` (creates the super admin, working locations, roles, and sample employees).

## API documentation

Once the server is running, Swagger UI is available at `http://localhost:5000/api`.
