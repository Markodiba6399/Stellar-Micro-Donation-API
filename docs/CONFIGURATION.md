# Configuration Guide

## Unsafe Development Flags

The following environment variables are provided for local development and **must never be enabled in production**. The startup checks (`src/utils/startupChecks.js`) will **abort the process** if any of these flags are `true` when `NODE_ENV=production`.

| Variable | Purpose | Production behaviour |
|---|---|---|
| `DISABLE_RATE_LIMIT` | Bypass all rate-limiting middleware | **Startup fails** |
| `CORS_ALLOW_ALL` | Allow every origin in CORS responses | **Startup fails** |
| `DEBUG_MODE` | Enable verbose debug logging | **Startup fails** |
| `DRY_RUN` | Skip real Stellar transactions | **Startup fails** |

In non-production environments the server starts but logs a prominent `⚠ WARN` for each active flag.

### Example — safe `.env` for production

```env
NODE_ENV=production
DISABLE_RATE_LIMIT=false
CORS_ALLOW_ALL=false
DEBUG_MODE=false
DRY_RUN=false
CORS_ALLOWED_ORIGINS=https://app.example.com
```

---

## Secret Strength Requirements

All signing and encryption secrets are validated at startup. The server **will refuse to start** if any secret fails the following rules:

1. **Minimum length** — at least 32 bytes (64 hex chars for hex secrets, 32 chars for others).
2. **No known placeholders** — values containing `changeme`, `secret`, `password`, `placeholder`, `example`, `todo`, `fixme`, or the patterns from `.env.example` are rejected.
3. **Unique across roles** — `ENCRYPTION_KEY`, `EXPORT_SIGNING_SECRET`, `ANONYMOUS_DONATION_SECRET`, and `JWT_SECRET` must all be distinct values.

| Variable | Role |
|---|---|
| `ENCRYPTION_KEY` | AES-256 data encryption (64 hex chars) |
| `EXPORT_SIGNING_SECRET` | HMAC signature for CSV/JSON exports |
| `ANONYMOUS_DONATION_SECRET` | Token derivation for anonymous donations |
| `JWT_SECRET` | JWT signing |

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## SSRF Protection

All outbound HTTP requests (webhooks, IPFS pinning, federation lookups) are validated by `src/utils/ssrf.js` before the connection is made. The validator:

- Enforces **HTTPS only** (rejects `http:`, `file:`, etc.).
- Blocks requests to private/loopback/link-local/cloud-metadata IP ranges:
  - `127.0.0.0/8` (loopback)
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private)
  - `169.254.0.0/16` (link-local / AWS Instance Metadata Service)
  - `fc00::/7`, `fe80::/10` (IPv6 ULA / link-local)
- Performs **DNS resolution** and validates every returned IP to prevent DNS-rebinding attacks.

Affected callers: `WebhookService`, `src/utils/ipfs.js`, `src/utils/federation.js`.

---

## Horizon Connection Pool Sizing

`StellarService` round-robins Horizon calls across a small pool of `Horizon.Server`
instances (`src/services/HorizonPool.js`) so that a single misbehaving connection
doesn't serialize every Stellar call behind it. Pool behaviour is controlled by:

| Variable | Default | Purpose |
|---|---|---|
| `HORIZON_POOL_SIZE` | `3` (capped at `10`) | Number of `Horizon.Server` instances per process |
| `HORIZON_POOL_COOLDOWN_MS` | `30000` | How long a member that hit a transient network error stays out of rotation before a health-check re-admits it |

### Why pool size matters

- **Too small** — every retry/backoff on a failing member serializes calls onto
  the remaining members, increasing p95/p99 latency under load and bringing
  the failing member back into rotation (via cooldown) before traffic has
  recovered.
- **Too large** — `HORIZON_POOL_SIZE` is *per process*. The number that matters
  for rate-limit purposes is `HORIZON_POOL_SIZE × number_of_instances`. The
  public Horizon fleet (`horizon.stellar.org` / `horizon-testnet.stellar.org`)
  rate-limits per source IP; a self-hosted Horizon enforces whatever limit
  operators configure. Sizing the pool without accounting for instance count
  is the single most common way to get an entire fleet throttled at once.

### Sizing guidance

1. Start from your Horizon rate limit (requests/second) for the IP(s) your
   fleet egresses from.
2. Decide your target fleet-wide concurrent-request budget, leaving headroom
   (e.g. 70-80% of the hard limit) for retries and bursts.
3. `HORIZON_POOL_SIZE ≈ target_budget / number_of_instances`. Round down —
   it is always safer to under-provision a pool (callers wait briefly via
   round-robin reuse) than to over-provision and trip the shared rate limit.
4. Re-check the math whenever you change instance count (e.g. autoscaling)
   — the pool size is per-instance and does not adjust itself.
5. `HORIZON_POOL_COOLDOWN_MS` should be long enough that a transient Horizon
   blip doesn't flap a member in and out of rotation, but short enough that a
   recovered Horizon node isn't left idle for minutes. 30s (the default) is a
   reasonable starting point; raise it if `horizon_pool_cooldown_events_total`
   shows members flapping repeatedly.

### Observability

Pool health is exposed via Prometheus metrics (`src/utils/metrics.js`,
scraped at `/metrics`):

| Metric | Type | Meaning |
|---|---|---|
| `horizon_pool_size` | Gauge | Configured pool size |
| `horizon_pool_healthy_count` | Gauge | Members currently in rotation |
| `horizon_pool_unhealthy_count` | Gauge | Members currently cooling down |
| `horizon_pool_cooldown_events_total` | Counter | Times a member was marked unhealthy after a transient failure |
| `horizon_pool_recovery_events_total` | Counter | Times a member was re-admitted after cooldown |
| `horizon_pool_acquire_duration_seconds` | Histogram | Time spent in `getServer()` acquiring a pool member |

A sustained rise in `horizon_pool_unhealthy_count` or a high rate of
`horizon_pool_cooldown_events_total` indicates the pool is undersized or
Horizon itself is degraded — both are strong signals to revisit the sizing
math above before tripping the fleet-wide rate limit.

### Retry / circuit-breaker integration

Cooldown is already tied into the unified retry policy: `StellarService._executeWithRetry`
(`src/services/StellarService.js`) wraps every Horizon call in the shared
circuit breaker, and on a transient network error it calls
`HorizonPool.markUnhealthy()` for the specific member that failed *before*
retrying on the next pool member. This means a single bad connection is
isolated within the same retry attempt rather than waiting for a future
request to discover it.
