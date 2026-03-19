

## Plan: Enforce Unique `website_url` on Wines

### Problem
The manual wine creation form (not CSV import) does a plain `INSERT` without checking if a wine with the same `website_url` already exists. The CSV import already has dedup logic, but the manual form and DB itself have no constraint.

### Current State
- No duplicate `website_url` entries exist in the DB right now (only NULLs are duplicated, which is expected)
- CSV import already checks `website_url` and does update if found
- Manual form save does NOT check for existing `website_url`

### Changes

**1. Database: Add unique partial index on `website_url`**

Create a migration with a unique index that excludes NULLs and empty strings:
```sql
CREATE UNIQUE INDEX idx_wines_website_url_unique 
ON wines (website_url) 
WHERE website_url IS NOT NULL AND website_url != '';
```
This enforces uniqueness at the DB level as the last line of defense.

**2. Frontend: Update manual save to upsert by `website_url`**

In `AdminWines.tsx` `saveMutation`, when creating a new wine (not editing), check if a wine with that `website_url` already exists. If so, update that wine instead of inserting a new one. Show a toast informing the admin that an existing SKU was updated.

**3. No cleanup needed**
Query confirms zero duplicate `website_url` entries currently exist.

### Files changed
- **Migration**: new unique partial index on `wines.website_url`
- **`src/components/admin/AdminWines.tsx`**: add website_url existence check in `saveMutation`

No other functionality is altered.

