# Cloudflare D1 profile sync

NeonPocket Console can run without any application database. The default security model keeps the Neon API key local-only and encrypted in IndexedDB.

An optional Cloudflare D1 database can be bound to the Worker when you want lightweight app profile and audit records.

## What is stored

When `Settings -> API & Cloud profile -> Cloud profile sync` is enabled, the app can store:

- User display name
- User email
- SHA-256 hash of the Neon API key
- Short Neon API key hint such as `napi_…abcd`
- Device authentication enabled/disabled state
- Selected app settings subset
- Browser user agent
- Browser language
- Browser timezone
- Last request IP address, as seen by Cloudflare
- Audit event rows such as `profile_synced`

## What is not stored

The raw Neon API key is not stored in D1.

The raw Neon API key is also not stored in Worker environment variables. It remains user-provided and is only forwarded for the current Neon API request.

## Create a D1 database

```bash
npx wrangler d1 create neonpocket-profile
```

Cloudflare returns a binding block similar to:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "neonpocket-profile",
      "database_id": "<database-id-from-cloudflare>"
    }
  ]
}
```

Add that binding to your Worker configuration or bind it through the Cloudflare dashboard.

## Bind through wrangler.jsonc

Add this to the root `wrangler.jsonc` after replacing the database id:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "neonpocket-profile",
    "database_id": "<database-id-from-cloudflare>"
  }
]
```

Do not commit a fake database id. If you do not want D1 yet, leave the binding out. The app will continue to work.

## Schema

No manual migration is required for the first version. The Worker creates these tables on first profile sync if the D1 binding exists:

```sql
CREATE TABLE IF NOT EXISTS app_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  user_name TEXT,
  neon_key_hash TEXT,
  neon_key_hint TEXT,
  device_auth_enabled INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT,
  user_agent TEXT,
  language TEXT,
  timezone TEXT,
  last_ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
```

## Recommended setup

For production:

1. Keep Neon API key storage local-only.
2. Enable Device authentication in Settings.
3. Enable Cloud profile sync only if you want profile/audit analytics.
4. Use D1 for app metadata only, not as a secret vault.
