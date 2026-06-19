#!/bin/sh
set -eu

echo "Waiting for database and applying Prisma migrations..."
until npx prisma migrate deploy; do
  echo "Database is not ready yet. Retrying in 5 seconds..."
  sleep 5
done

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npx prisma db seed

echo "Starting backend..."
exec npm run start:prod
