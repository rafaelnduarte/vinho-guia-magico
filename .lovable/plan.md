

## Plano: Edge Function `panda-token` + Integração no Player

### Contexto

A `PANDA_SECRET_KEY` já está configurada. Falta criar a Edge Function que gera JWTs assinados e integrar o token na URL do iframe.

**Nota importante**: O projeto usa React (não Vue). O prompt menciona Vue mas o componente real é `PandaPlayer.tsx`. A integração será feita via iframe com query param `token=`, não via `new PandaPlayer()` (API que não existe na prática).

### Mudanças

#### 1. Criar `supabase/functions/panda-token/index.ts`

Edge Function que:
- Recebe `POST { video_id, user_id, aula_id }`
- Valida o bearer token do usuário (auth do Supabase)
- Gera JWT assinado com `PANDA_SECRET_KEY` usando `jose` (HS256)
- Payload: `video_id`, `user_id`, `aula_id`, `iat`, `exp` (24h)
- Retorna `{ token }` com CORS headers

#### 2. Atualizar `supabase/config.toml`

Adicionar entrada para `panda-token` com `verify_jwt = false` (validação manual no código).

#### 3. Atualizar `src/components/cursos/PandaPlayer.tsx`

- Aceitar nova prop `userId` (string)
- No mount, chamar `supabase.functions.invoke("panda-token", { body: { video_id, user_id, aula_id } })` para obter o token JWT
- Adicionar `&token={jwt}` à URL do iframe
- Mostrar loader enquanto o token é gerado
- Em caso de erro no token, renderizar o player sem token (fallback)

#### 4. Atualizar `src/pages/AulaPage.tsx`

- Passar `userId={user.id}` ao componente `PandaPlayer`

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/panda-token/index.ts` | Criar |
| `supabase/config.toml` | Adicionar `[functions.panda-token]` |
| `src/components/cursos/PandaPlayer.tsx` | Adicionar fetch de token + query param |
| `src/pages/AulaPage.tsx` | Passar `userId` prop |

### Sem mudanças no banco

Nenhuma tabela ou RLS alterada.

### Nenhuma outra tela ou componente será alterada

