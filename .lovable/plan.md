

## Criar Edge Function `panda-sync` e botão de sincronização

### Problema com o código proposto
O código proposto usa colunas que **nao existem** nas tabelas reais:
- `cursos` nao tem `nome`, `status`, `total_aulas` — tem `titulo`, `is_published`
- `aulas` nao tem `panda_folder_id`, `duracao`, `thumbnail_url`, `status` — tem `duracao_segundos`, `is_published`
- `aulas` exige `modulo_id` e `curso_id` (NOT NULL) — precisamos criar um modulo default por curso
- Nao existem constraints UNIQUE em `panda_folder_id` nem `panda_video_id` — necessarias para upsert

### Alteracoes

#### 1. Migration SQL
- `ALTER TABLE cursos ADD CONSTRAINT cursos_panda_folder_id_key UNIQUE (panda_folder_id)`
- `ALTER TABLE aulas ADD CONSTRAINT aulas_panda_video_id_key UNIQUE (panda_video_id)`

#### 2. Criar `supabase/functions/panda-sync/index.ts`
- Admin-only (verifica role via service_role client)
- Busca pastas do Panda (`GET /folders`, header `Authorization: apiKey`)
- Para cada pasta:
  - Upsert em `cursos` (`titulo`, `panda_folder_id`, `is_published: false`)
  - Upsert um modulo default em `modulos` (`titulo: "Geral"`, `curso_id`)
  - Busca videos da pasta (`GET /videos?folder_id=X`)
  - Para cada video: upsert em `aulas` (`titulo`, `panda_video_id`, `curso_id`, `modulo_id`, `duracao_segundos`, `is_published` baseado em status CONVERTED)
- Retorna JSON com `folders_synced`, `videos_synced`, `errors`

#### 3. Atualizar `supabase/config.toml`
- Adicionar `[functions.panda-sync]` com `verify_jwt = false` (auth manual no codigo)

#### 4. Atualizar `src/components/admin/AdminCursos.tsx`
- Adicionar botao "Sincronizar com Panda" ao lado do botao "Atualizar"
- Ao clicar: POST para panda-sync com token do usuario
- Toast de loading/sucesso/erro
- Apos sucesso: refetch das queries de cursos e aulas

### Arquivos alterados
1. Nova migration (unique constraints)
2. `supabase/functions/panda-sync/index.ts` (novo)
3. `supabase/config.toml` (nova entrada)
4. `src/components/admin/AdminCursos.tsx` (botao de sync)

Nenhum outro componente ou tela sera alterado.

