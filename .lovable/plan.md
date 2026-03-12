

## Plan: Panda Video Audit — Full Cross-Validation

### Problem
The player returns 404 on `config.json` because some `panda_video_id` values stored in the `aulas` table may not correspond to valid videos on Panda's CDN.

### Approach
Create a new edge function `panda-audit` that performs a complete cross-validation, and add a UI button in the Diagnostics admin panel to trigger it.

### Changes

**1. New edge function: `supabase/functions/panda-audit/index.ts`**

Admin-only function that:
- Reads all `panda_video_id` + `titulo` from `aulas` table (service role)
- Fetches ALL videos from Panda API (`GET /videos` with pagination — page=1,2,3... until empty)
- Builds two sets: `supaVideoIds` and `pandaVideoIds`
- Compares and produces:
  - **Inconsistent**: IDs in Supabase but NOT in Panda (broken references)
  - **Orphans**: IDs in Panda but NOT in Supabase (unused videos)
- For each inconsistent ID, attempts fuzzy title matching against Panda videos (normalized lowercase comparison)
- Validates `config.json` for each Supabase video: `GET https://config.tv.pandavideo.com.br/embed/v2/{id}.json` — records 200 vs 404/other
- Returns full audit report with: totals, inconsistencies, orphans, config validation results, suggested corrections

**2. Update `supabase/config.toml`** — skip (auto-managed)

**3. Update `src/components/admin/AdminPandaDiagnostics.tsx`**

Add a new Card "Auditoria Completa" with:
- Button to trigger the audit
- Display results: summary counts, tables for inconsistencies/orphans/config failures
- Show suggested corrections (fuzzy matches) with title similarity

### Technical Details

- Panda pagination: `GET /videos?page=1&limit=50` — loop until `videos` array is empty
- Fuzzy matching: normalize titles (lowercase, remove `.mp4`, trim numbers/dashes) and check `includes()` both ways
- Config validation: batch requests with small delays to avoid rate limiting
- No changes to any other functionality
