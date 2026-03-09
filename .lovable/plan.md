

## Plano: Nova Aba "Cursos" no Painel Admin + Edge Functions

### Resumo

Adicionar a 9a aba "Cursos" ao painel Admin com grid de pastas do Panda Vídeo, modal de vídeos, e duas Edge Functions (proxy de leitura + webhook de sincronização). Nenhum componente/aba/rota existente será modificado.

---

### 1. Edge Function: `panda-proxy` (leitura segura)

**Arquivo:** `supabase/functions/panda-proxy/index.ts`

- Aceita query param `resource`: `folders` ou `videos&folder_id={id}`
- Injeta `Authorization: Bearer {PANDA_API_KEY}` no request para `api-v2.pandavideo.com.br`
- Valida JWT do Supabase Auth + verifica `has_role(uid, 'admin')` via query ao banco
- Retorna 401 se não autorizado
- Faz proxy GET e retorna JSON do Panda

### 2. Edge Function: `panda-webhook` (sincronização automática)

**Arquivo:** `supabase/functions/panda-webhook/index.ts`

- `verify_jwt = false` (chamado pelo Panda, não pelo usuário)
- Valida via query param `?token=` comparando com `N8N_WEBHOOK_URL` (ou outro secret — nota: o `PANDA_WEBHOOK_SECRET` foi removido, usaremos um token fixo gerado ou pediremos um novo secret)
- Eventos capturados:
  - `folder.created` → INSERT em `cursos` (status draft)
  - `video.created` → INSERT em `aulas` + atualiza contagem
  - `video.encoded` → UPDATE aula `is_published = true`
  - `video.deleted` → UPDATE aula (soft delete)
  - `folder.deleted` → UPDATE curso status archived
- Todos os eventos logados em `webhook_logs`

**Nota sobre autenticação do webhook:** Como o `PANDA_WEBHOOK_SECRET` foi removido a seu pedido, será necessário um secret para validar o token do webhook. Vou solicitar a criação de um novo secret `PANDA_WEBHOOK_TOKEN` para este fim.

### 3. Componente: `AdminCursos.tsx`

**Arquivo:** `src/components/admin/AdminCursos.tsx`

- **Cabeçalho:** "CURSOS (N)" — mesmo padrão bold do AdminWines
- **Grid 3 colunas** de cards de pastas (via `panda-proxy?resource=folders`):
  - Ícone `FolderOpen`
  - Nome da pasta
  - Badge com total de vídeos
  - Badge de sincronização (verde = existe em `cursos`, amarelo = pendente)
  - Botão "Ver Vídeos"
- **Loading:** Skeleton cards
- **Empty:** Mensagem "Nenhuma pasta encontrada"

### 4. Modal de Vídeos

Dentro de `AdminCursos.tsx` — Dialog/Modal ao clicar "Ver Vídeos":

- Header: nome da pasta + badge total + botão X
- Tabela com colunas: #, Título, Duração (mm:ss), Status (badge colorido), Sync (verde/amarelo), Upload (data pt-BR)
- Padrão visual idêntico à tabela de Vinhos (header dark, rows alternadas, hover)
- Loading: skeleton rows
- Empty: "Nenhum vídeo nesta pasta"

### 5. Alteração no AdminPage.tsx (cirúrgica)

- Importar `AdminCursos`
- Adicionar `<TabsTrigger value="cursos">` após "Jovem AI"
- Adicionar `<TabsContent value="cursos"><AdminCursos /></TabsContent>`
- Nenhuma outra alteração

### 6. Secret necessário

Será solicitado: **`PANDA_WEBHOOK_TOKEN`** — token customizado para validar chamadas do webhook do Panda (substitui o antigo `PANDA_WEBHOOK_SECRET`).

---

### Ordem de execução

1. Solicitar secret `PANDA_WEBHOOK_TOKEN`
2. Deploy Edge Function `panda-proxy`
3. Deploy Edge Function `panda-webhook`
4. Criar componente `AdminCursos.tsx`
5. Atualizar `AdminPage.tsx` (apenas adicionar aba)

