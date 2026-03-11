

## Plano: Recovery Automático de Videos Panda + Dashboard Admin

### Analise

O JWT no player ja esta implementado. O diagnostico manual (`panda-diagnostics`) tambem. O que falta e a camada de **recovery automatico** quando um video e detectado como problematico, e uma interface admin para executar/monitorar essas acoes.

### Escopo real (simplificado)

O prompt do usuario propoe 6 pilares, mas pilares 1 e 2 ja existem. Pilares 3-6 serao consolidados de forma pragmatica:

- **1 Edge Function** (`panda-recovery`) com as 3 estrategias (recover, reprocess, reupload) em cascata, em vez de 4 functions separadas
- **1 tabela** (`recovery_logs`) para auditoria — a tabela `video_health_logs` e desnecessaria pois o diagnostico ja retorna dados em tempo real
- **1 componente admin** integrado na aba Diagnostico existente, sem criar pagina nova

### Mudancas

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabela `recovery_logs` |
| `supabase/functions/panda-recovery/index.ts` | Nova Edge Function com 3 estrategias em cascata |
| `supabase/config.toml` | Adicionar `panda-recovery` com `verify_jwt = false` |
| `src/components/admin/AdminPandaDiagnostics.tsx` | Adicionar botoes de recovery apos diagnostico + historico de logs |

### Detalhes

**Tabela `recovery_logs`:**
- `id`, `video_id`, `action` (RECOVER/REPROCESS/REUPLOAD), `status` (started/completed/failed), `new_video_id` (para reupload), `error_message`, `created_at`
- RLS: apenas admins podem ler; sem inserts/updates do client (service_role apenas)

**Edge Function `panda-recovery`:**
- Recebe `{ video_id, strategy, file_url?, title?, folder_id? }`
- Auth: admin-only via `getClaims` + `has_role`
- Estrategias:
  - `RECOVER`: `POST /videos/{id}/recover` no Panda
  - `REPROCESS`: `PUT /videos/{id}` com `status: "uploaded"`
  - `REUPLOAD`: `DELETE /videos/{id}` + `POST /videos` com source URL
- Loga resultado em `recovery_logs` via service_role client
- Para REUPLOAD: tambem atualiza `aulas.panda_video_id` automaticamente

**Admin UI (na aba Diagnostico existente):**
- Apos rodar diagnostico e detectar problemas, mostrar botoes: "Recuperar", "Reprocessar", "Re-upload"
- Tabela de historico de recovery logs abaixo
- Status com badges coloridos (started/completed/failed)

### Nota sobre a API Panda

O endpoint `POST /videos/{id}/recover` pode nao existir na API v2 do Panda. Se nao funcionar, a cascata pula direto para REPROCESS. A Edge Function trata erros graciosamente.

