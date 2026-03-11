

# Plano: Reescrita completa do `plan.md` como Source of Truth

## Objetivo

Substituir o conteúdo atual do `.lovable/plan.md` (que contém apenas o plano dos banners da homepage) por um documento técnico completo e definitivo, cobrindo toda a arquitetura do projeto.

## Estrutura do novo `plan.md`

O documento terá ~7 seções, baseadas na auditoria do código atual:

### 1. Tech Stack
- React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Lovable Cloud (Supabase nativo) — Auth, Database com RLS, Storage, Edge Functions
- TanStack Query v5, react-router-dom v6, embla-carousel-react
- Fonts: Open Sans (body), Lore (headings), Space Mono (mono)

### 2. Database Schema (27 tabelas/views)
Documentação compacta de todas as tabelas com propósito e campos-chave:
- **Core**: profiles, user_roles, memberships
- **Curadoria**: wines, wine_votes, wine_comments, wine_seals, seals, thomas_notes
- **Cursos**: cursos, aulas, matriculas, progresso, downloads
- **AI/Chat**: chat_sessions, chat_messages, chat_feedback, ai_pricing_config, ai_knowledge_base, usage_ledger
- **Infra**: analytics_events, webhook_events, webhook_logs, home_banners, partners
- **Views**: profiles_public, chat_messages_safe

Incluir: funções SQL críticas (`has_active_access`, `has_role`, `handle_new_user`, `get_rankings`, triggers de cascata curso/aula), enum `app_role`.

### 3. Security & Auth
- RLS RESTRICTIVE em todas as tabelas; função `has_active_access` como gate principal
- Roles via tabela `user_roles` (nunca em profiles); enum `admin | member`
- Membership types: `comunidade | radar` (visual only, não afeta permissão)
- AuthContext com dual-loading (session + membership) para evitar flash de tela de bloqueio
- Views `profiles_public` e `chat_messages_safe`: **P0** — adicionar RLS restritivo
- Secrets: toda chave privada em Edge Functions, nunca no client

### 4. Edge Functions (12 funções)
Catálogo com propósito e secrets usados:
| Função | Propósito | Secrets |
|--------|-----------|---------|
| auth-email-hook | Emails transacionais customizados | — |
| hubla-webhook | Ativação/cancelamento de memberships | HUBLA_WEBHOOK_SECRET |
| sommelier-chat | Chat AI com Gemini/GPT | LOVABLE_API_KEY |
| panda-sync | Sincronização de cursos/aulas com Panda | PANDA_API_KEY, PANDA_PROFILE_ID |
| panda-webhook | Eventos automáticos do Panda | PANDA_WEBHOOK_SECRET, PANDA_API_KEY, PANDA_PROFILE_ID |
| panda-token | (desativado) Geração de JWT para player | PANDA_SECRET_KEY |
| panda-proxy | Proxy para API Panda | PANDA_API_KEY |
| admin-members | Listagem paginada de membros | — |
| parse-knowledge-file | Parse de arquivos para knowledge base | — |
| migrate-drive-urls / rehost-drive-file | Migração de URLs do Drive | — |

### 5. Data Layer & Performance
- **Diretriz Anti-Overfetch (P0)**: CuradoriaPage carrega ALL wines client-side. Migrar para paginação server-side via `.range()` ou RPC, selecionando apenas campos necessários com `.select("id,name,producer,...")`
- **Query Keys**: padronizar como arrays descritivos `["wines", "curadoria", { page, filters }]`
- **staleTime**: dados estáticos (selos, parceiros) = 5min; dados dinâmicos (votos, comentários) = 30s; config (ai_pricing) = 10min
- **Storage buckets**: wine-images (public), partner-logos (public), wine-audio (public), email-assets (public), knowledge-files (private)

### 6. Design System
- CSS tokens via variáveis HSL em `index.css` (light/dark)
- Tokens semânticos: `--wine`, `--gold`, `--cream`, `--highlight`
- Tipografia: `font-sans` (Open Sans), `font-serif`/`font-display` (Lore), `font-mono` (Space Mono)
- Headings usam Lore via `@layer base` rule
- Regra: Zero Magic Numbers — usar tokens do tema ou classes utilitárias Tailwind
- Componentes: shadcn/ui com customizações mínimas; classe `.glass` para cards translúcidos

### 7. Roadmap de Estabilização

**P0 — Curto Prazo:**
- [ ] Paginação server-side na CuradoriaPage (eliminar overfetch)
- [ ] RLS nas views `profiles_public` e `chat_messages_safe`
- [ ] Validar trigger `handle_new_user` — contingência via Edge Function se falhar
- [ ] Verificar `PANDA_PROFILE_ID` no painel Panda (erro 500 persistente)

**P1 — Médio Prazo:**
- [ ] Centralizar Query Keys em arquivo dedicado (`src/lib/queryKeys.ts`)
- [ ] Error Boundaries globais (wrap no App.tsx)
- [ ] Configurar staleTime padrão no QueryClient
- [ ] DNS do subdomínio `notify.jovemdovinho.com.br` para branding de emails

**P2 — Longo Prazo:**
- [ ] Suite de testes Vitest (hooks, utils, componentes críticos)
- [ ] Dashboard de monitoramento de webhook_logs
- [ ] Otimização de webhook processing (batch operations no hubla-webhook)

## Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `.lovable/plan.md` | Reescrita completa |

Nenhuma mudança em código, banco ou Edge Functions — apenas documentação.

