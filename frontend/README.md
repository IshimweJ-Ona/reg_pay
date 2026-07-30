# REG-PAY Frontend

Next.js frontend for the REG-PAY payroll and employee management system.

See the [repository root README](../README.md) for full setup instructions (Docker and local). Quick reference for local development once `.env` is configured (copy `.env.example`):

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. This is the local dev server port; the dockerized frontend runs on port `3001` instead (see the root README).

## Scripts

- `npm run dev` - start the Next.js dev server.
- `npm run build` - build for production.
- `npm run start` - run the production build (used in Docker).
- `npm run lint` - run ESLint.
