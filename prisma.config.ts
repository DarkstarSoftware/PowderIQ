// prisma.config.ts
import { defineConfig } from 'prisma/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manually parse .env.local to handle Supabase URLs with special characters (&)
// that confuse shell `source` and dotenv parsers
function loadEnvFile(filename: string): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

// Load .env.local first, fall back to .env
const localEnv = loadEnvFile('.env.local');
const baseEnv  = loadEnvFile('.env');
const env      = { ...baseEnv, ...localEnv, ...process.env };

// Derive a direct (non-pooled) URL for migrations from DATABASE_URL if DIRECT_URL isn't set.
// Supabase pooler uses port 6543 with pgbouncer=true — migrations need port 5432 directly.
function getDirectUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.port = '5432';
    url.searchParams.delete('pgbouncer');
    url.searchParams.delete('connection_limit');
    url.searchParams.delete('connect_timeout');
    url.searchParams.delete('pool_timeout');
    // Also change the host from pooler to direct
    // Supabase pooler host: aws-0-*.pooler.supabase.com
    // Supabase direct host: aws-0-*.supabase.com (without .pooler)
    url.hostname = url.hostname.replace('.pooler.supabase.com', '.supabase.com');
    return url.toString();
  } catch {
    return raw;
  }
}

const dbUrl = env.DATABASE_URL ?? '';
const directUrl = env.DIRECT_URL || getDirectUrl(dbUrl);

export default defineConfig({
  datasource: {
    url: directUrl,
  },
});
