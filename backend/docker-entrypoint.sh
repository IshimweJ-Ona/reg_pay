#!/bin/sh
set -eu

echo "Waiting for database and applying Prisma migrations..."
until ./node_modules/.bin/prisma migrate deploy; do
  echo "Database is not ready yet. Retrying in 5 seconds..."
  sleep 5
done

echo "Seeding database..."
npm run seed:super-admin

echo "Starting backend..."
exec npm run start:prod
