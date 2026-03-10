

## Fix: Order courses by `created_at ASC`

The current query orders by `sort_order ASC` (line 65). The user reports that toggling publish status causes reordering — this is likely because the `sort_order` values are being modified or are not unique/stable.

### Change

In `src/components/admin/AdminCursos.tsx` line 65, change:

```typescript
// Before
.order("sort_order", { ascending: true });

// After  
.order("created_at", { ascending: true });
```

Also update the `select` on line 64 to include `created_at` in the selected columns.

Single file change, single line edit.

