// prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Used by Prisma Migrate (direct DB connection)
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});