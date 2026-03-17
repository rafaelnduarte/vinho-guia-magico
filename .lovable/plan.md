# Jovem do Vinho — Technical Source of Truth

> Última atualização: 2026-03-11

---

## 1. Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18 + Vite + TypeScript |
| Estilização | Tailwind CSS 3 + tailwindcss-animate + shadcn/ui |
| State / Data | TanStack Query v5, react-hook-form + zod |
| Routing | react-router-dom v6 |
| Backend | Lovable Cloud (Supabase nativo) — Auth, Database (RLS), Storage, Edge Functions |
| Animação | framer-motion (quando necessário), embla-carousel-react |
| Fonts | Open Sans (body), Lore Bold/Regular (headings), Space Mono (mono) |
| Markdown | react-markdown |
| Charts | recharts |

---

## 2. Database Schema

### 2.1 Core

| Tabela | Propósito | Campos-chave |
|--------|-----------|-------------|
| `profiles` | Dados públicos do usuário | user_id, full_name, avatar_url, must_change_password, onboarding_completed, last_seen_at |
| `user_roles` | Roles separados (nunca em profiles) | user_id, role (enum `app_role`: admin, member) |
| `memberships` | Assinaturas ativas/inativas | user_id, status, source (hubla/manual), membership_type (comunidade/radar), external_id |

### 2.2 Curadoria

| Tabela | Propósito |
|--------|-----------|
| `wines` | Catálogo de vinhos (status: curadoria, acervo, rascunho) |
| `wine_votes` | Votos dos membros em vinhos |
| `wine_comments` | Comentários dos membros |
| `wine_seals` | Relação N:N entre wines e seals |
| `seals` | Selos de categorização (ex: Clássico, Natureba) |
| `thomas_notes` | Notas do curador (opinion/pairing, visibility: public/private) |

### 2.3 Cursos

| Tabela | Propósito |
|--------|-----------|
| `cursos` | Cursos/trilhas (panda_folder_id para sync) |
| `aulas` | Aulas dentro de cursos (panda_video_id, panda_quiz_id) |
| `matriculas` | Inscrição do usuário em curso |
| `progresso` | Posição de playback e conclusão por aula |
| `downloads` | Downloads de materiais (panda_download_url) |

### 2.4 AI / Chat

| Tabela | Propósito |
|--------|-----------|
| `chat_sessions` | Sessões do Sommelier AI por usuário |
| `chat_messages` | Mensagens (role, tokens_in/out, cost_usd/brl, mode) |
| `chat_feedback` | Feedback (rating, comment) por mensagem |
| `ai_pricing_config` | Config singleton: modelo, limites, system prompt |
| `ai_knowledge_base` | Base de conhecimento para RAG (título, conteúdo, file_url) |
| `usage_ledger` | Consolidado mensal de uso por usuário |

### 2.5 Infra

| Tabela | Propósito |
|--------|-----------|
| `analytics_events` | Eventos de analytics client-side |
| `webhook_events` | Payloads de webhooks recebidos (idempotência via event_id) |
| `webhook_logs` | Log detalhado de processamento |
| `home_banners` | Banners da homepage (image_url, link_url, sort_order) |
| `partners` | Parceiros com descontos (logo, cupom, categoria) |

### 2.6 Views

| View | Propósito | ⚠️ Status |
|------|-----------|-----------|
| `profiles_public` | user_id, full_name, avatar_url (sem PII) | **P0**: adicionar RLS restritivo |
| `chat_messages_safe` | Mensagens sem campos de custo | **P0**: adicionar RLS restritivo |

### 2.7 Funções SQL Críticas

| Função | Tipo | Propósito |
|--------|------|-----------|
| `has_active_access(uuid)` | SECURITY DEFINER | Gate principal: admin OR membership ativa |
| `has_role(uuid, app_role)` | SECURITY DEFINER | Verifica role específico |
| `handle_new_user()` | TRIGGER (auth.users INSERT) | Cria profile + role `member` automaticamente |
| `get_rankings(period)` | RPC | Ranking de membros por votos+comentários |
| `get_wine_rankings(period)` | RPC | Ranking de vinhos por engajamento |
| `list_members_paginated(...)` | RPC | Listagem paginada para admin |
| `trg_curso_cascata_aulas()` | TRIGGER | Publish/unpublish cascata curso→aulas |
| `trg_aula_cascata_curso()` | TRIGGER | Auto-publish/unpublish curso quando aulas mudam |
| `update_updated_at_column()` | TRIGGER | Atualiza updated_at automaticamente |

### 2.8 Enum

```sql
app_role: 'admin' | 'member'
```

---

## 3. Security & Auth

### Princípios

- **RLS RESTRICTIVE** em todas as tabelas — nenhuma tabela sem política
- `has_active_access()` como gate principal para leitura de conteúdo
- Roles **sempre** na tabela `user_roles`, nunca em profiles
- Membership types (`comunidade`/`radar`) são visuais — não afetam permissão de acesso
- Toda chave privada reside exclusivamente em Edge Functions (secrets), nunca no client
- AuthContext implementa dual-loading (session + membership) para evitar flash de bloqueio

### Fluxo de Autenticação

1. Hubla webhook → `hubla-webhook` Edge Function → cria user + membership + role
2. Senha inicial = email do usuário → `must_change_password = true`
3. Primeiro login → ForceChangePasswordPage → troca senha
4. Após troca → OnboardingDialog → `onboarding_completed = true`
5. Navegação normal com `ProtectedRoute` verificando `has_active_access`

### Storage Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| wine-images | ✅ | Fotos de vinhos |
| partner-logos | ✅ | Logos de parceiros |
| wine-audio | ✅ | Áudios de curadoria |
| email-assets | ✅ | Assets de templates de email |
| knowledge-files | ❌ | Arquivos da base de conhecimento AI |

---

## 4. Edge Functions

| Função | JWT | Propósito | Secrets |
|--------|-----|-----------|---------|
| `auth-email-hook` | ❌ | Emails transacionais customizados (signup, recovery, etc) | — |
| `hubla-webhook` | ❌ | Ativação/cancelamento de memberships via Hubla | HUBLA_WEBHOOK_SECRET |
| `sommelier-chat` | ❌ | Chat AI (Sommelier) com RAG + controle de custo | LOVABLE_API_KEY |
| `panda-sync` | ❌ | Sincronização de cursos/aulas com Panda Video | PANDA_API_KEY, PANDA_PROFILE_ID |
| `panda-webhook` | ❌ | Eventos automáticos do Panda (encoding done, etc) | PANDA_WEBHOOK_SECRET, PANDA_API_KEY, PANDA_PROFILE_ID |
| `panda-token` | ❌ | ⚠️ Desativado — geração de JWT para player (watermark groups) | PANDA_SECRET_KEY |
| `panda-proxy` | ❌ | Proxy seguro para API Panda (listagem de folders/videos) | PANDA_API_KEY |
| `admin-members` | ✅ | Listagem paginada de membros (usa service_role) | — |
| `parse-knowledge-file` | ✅ | Parse de PDFs/TXT para knowledge base via AI | LOVABLE_API_KEY |
| `migrate-drive-urls` | ✅ | Migração batch de URLs do Google Drive | — |
| `rehost-drive-file` | ✅ | Re-hospedagem individual de arquivo do Drive | — |

### Secrets Configurados

HUBLA_WEBHOOK_SECRET, PANDA_WEBHOOK_SECRET, PANDA_API_KEY, PANDA_PROFILE_ID, PANDA_SECRET_KEY, N8N_WEBHOOK_URL, LOVABLE_API_KEY (+ auto: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_PUBLISHABLE_KEY)

---

## 5. Data Layer & Performance

### Diretriz Anti-Overfetch (P0)

A `CuradoriaPage` atualmente carrega TODOS os vinhos client-side. **DEVE** ser migrada para:
- Paginação server-side via `.range(from, to)` ou RPC dedicada
- Seleção de campos mínimos: `.select("id, name, producer, country, type, grape, image_url, status, rating, vintage, created_at")`
- Filtros aplicados na query, não no client

### Query Keys (Padrão)

```typescript
// Padrão: ["domínio", "escopo", { params }]
["wines", "curadoria", { page: 1, status: "curadoria", type: "tinto" }]
["wines", "detail", wineId]
["cursos", "list"]
["rankings", "users", { period: "month" }]
["banners", "home"]
```

### staleTime Recomendado

| Tipo de dado | staleTime |
|-------------|-----------|
| Selos, parceiros, cursos | 5 min (300_000) |
| Vinhos (lista), banners | 2 min (120_000) |
| Votos, comentários | 30s (30_000) |
| AI config, usage | 10 min (600_000) |
| Rankings | 1 min (60_000) |

---

## 6. Design System

### Tokens CSS (HSL em `index.css`)

```
--background, --foreground          // Base
--card, --card-foreground           // Cards
--primary, --primary-foreground     // Ações principais
--secondary, --secondary-foreground // Ações secundárias
--muted, --muted-foreground         // Texto sutil
--accent, --accent-foreground       // Destaque
--destructive                       // Erros
--wine                              // Cor principal do tema (vinho)
--gold                              // Destaques dourados
--cream                             // Fundos suaves
--highlight                         // Alertas/badges
```

### Tipografia

| Token | Fonte | Uso |
|-------|-------|-----|
| `font-sans` | Open Sans | Corpo de texto |
| `font-serif` / `font-display` | Lore | Títulos, headings (via `@layer base`) |
| `font-mono` | Space Mono | Código, dados técnicos |

### Regras

- **Zero Magic Numbers**: toda cor, espaçamento e tipografia via tokens do tema ou classes Tailwind
- Componentes shadcn/ui com customizações mínimas
- Classe `.glass` para cards com efeito translúcido
- Cores sempre via variáveis semânticas, nunca hardcoded (`bg-primary`, não `bg-[#722F37]`)

---

## 7. Roadmap de Estabilização

### P0 — Curto Prazo (Crítico)

- [ ] Paginação server-side na CuradoriaPage (eliminar overfetch)
- [ ] RLS restritivo nas views `profiles_public` e `chat_messages_safe`
- [ ] Validar trigger `handle_new_user` — contingência via Edge Function se falhar
- [ ] Verificar `PANDA_PROFILE_ID` no painel Panda (erro 500 persistente na API)
- [ ] Resolver playback do player Panda (token removido, testar sem autenticação)

### P1 — Médio Prazo

- [ ] Centralizar Query Keys em `src/lib/queryKeys.ts`
- [ ] Error Boundaries globais (wrap no App.tsx)
- [ ] Configurar staleTime padrão no QueryClient provider
- [ ] DNS do subdomínio `notify.jovemdovinho.com.br` para branding de emails
- [ ] Implementar contingência para `handle_new_user` via Edge Function

### P2 — Longo Prazo

- [ ] Suite de testes Vitest (hooks, utils, componentes críticos)
- [ ] Dashboard de monitoramento de webhook_logs no admin
- [ ] Otimização de webhook processing (batch operations no hubla-webhook)
- [ ] Implementar watermark groups no Panda para re-ativar token JWT
