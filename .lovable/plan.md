

# Plan: Separar status, tipo e role na importação CSV de membros

## Problema
A importação CSV atual tem apenas 5 colunas: `email`, `full_name`, `status`, `source`, `external_id`. Faltam `membership_type` (radar/comunidade) e `role` (admin/member). O `handleImport` também não envia esses campos para a Edge Function.

## Alterações

### 1. `src/components/admin/AdminMembers.tsx`

**memberColumns** (linha 16-22): Adicionar duas novas colunas ao array:
- `membership_type` com label "Tipo" e validação para aceitar apenas `radar` ou `comunidade`
- `role` com label "Role" e validação para aceitar apenas `admin` ou `member`

**handleImport** (linha 72-97): Passar `membership_type` e `role` do CSV para a chamada `create_member`:
```typescript
await callAdminMembers("create_member", {
  email: rows[i].email?.toLowerCase(),
  full_name: rows[i].full_name,
  status: rows[i].status?.toLowerCase() || "active",
  membership_type: rows[i].membership_type?.toLowerCase() || "comunidade",
  role: rows[i].role?.toLowerCase() || "member",
  source: rows[i].source || "csv_import",
});
```

Nenhuma alteração necessária na Edge Function -- ela já aceita `membership_type` e `role` no `create_member` (linha 142).

