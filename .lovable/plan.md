

# PLAN_INPUTS.md — Auditoria Técnica Completa

**Projeto:** Radar do Jovem  
**Data:** 2026-03-05  
**Escopo da auditoria:** Código-fonte completo (frontend, edge functions, migrations, configs, types, assets, DB schema, RLS)  
**Limitações:** Não foi possível inspecionar conteúdo real do banco (dados), logs de produção, ou métricas de infra. Não foi possível ler o conteúdo dos templates de e-mail individuais.

---

## 1) Resumo Executivo Técnico

Portal de membros "Radar do Jovem do Vinho" — plataforma de curadoria independente de vinhos no Brasil. Oferece catálogo curado com votação/comentários, sommelier AI (chatbot), parceiros com cupons, sistema de selos (perfil vinho/bebedor), ranking gamificado e painel admin completo.

**Personas/Roles:**
- **member** (comunidade ou radar) — acessa curadoria, vota, comenta, usa AI
- **admin** — gestão total via painel (vinhos, membros, parceiros, selos, banners, analytics, AI config)

**Módulos presentes:** Login/Auth, Home (banners + carrossel), Curadoria (filtros/paginação), Detalhe do vinho (votação/comentários/áudio), Sommelier AI (chatbot com RAG), Parceiros, Selos, Ranking (membros + vinhos), Minha Conta, Admin (8 abas), Webhook Hubla (membership automation), E-mail transacional customizado.

**Fora de escopo atual:** Signup público (apenas login — membros são criados via webhook ou admin), notificações push, dark mode toggle (CSS existe mas sem toggle UI), internacionalização, PWA.

---

## 2) Inventário do Projeto

### Estrutura de pastas (resumida)
```text
src/
├── assets/          # Logo, partner logos, seal icons, wine images
├── components/
│   ├── admin/       # AdminWines, AdminPartners, AdminSeals, AdminMembers,
│   │                # AdminAnalytics, AdminTutorials, AdminChat, AdminBanners,
│   │                # CsvImportDialog
│   ├── curadoria/   # WineCard, WineVoting, WineComments, AudioPlayer
│   └── ui/          # shadcn/ui components (40+ files)
├── contexts/        # AuthContext
├── hooks/           # useAnalytics, useFilterParams, use-mobile, use-toast
├── integrations/supabase/  # client.ts (auto), types.ts (auto)
├── lib/             # utils, sealIcons, partnerLogos
├── pages/           # 13 pages
└── test/            # setup.ts, example.test.ts
supabase/
├── functions/       # 6 edge functions
├── migrations/      # 25 migration files
└── config.toml
```

### Configs principais
| Arquivo | Finalidade |
|---------|-----------|
| `vite.config.ts` | Build/dev (port 8080, SWC plugin) |
| `tailwind.config.ts` | Design tokens, fonts, colors |
| `tsconfig*.json` | TypeScript (strict: false, path alias @/) |
| `eslint.config.js` | Linting (ts-eslint, react-hooks) |
| `postcss.config.js` | Tailwind + autoprefixer |
| `components.json` | shadcn/ui config |
| `supabase/config.toml` | Edge functions (3 com verify_jwt=false) |
| `vitest.config.ts` | Testes (jsdom, globals) |

### Scripts
- `dev` — Vite dev server
- `build` / `build:dev` — Vite build
- `test` / `test:watch` — Vitest
- `lint` — ESLint

### Dependências-chave
- **React 18 + React Router 6** — SPA com rotas protegidas
- **TanStack Query** — Data fetching/caching
- **Tailwind CSS + shadcn/ui** — Design system
- **Embla Carousel** — Carrosséis (home)
- **React Markdown** — Renderização de respostas do AI
- **date-fns** — Formatação de datas (pt-BR)
- **Recharts** — Gráficos (admin analytics)
- **Zod + React Hook Form** — Validação de formulários
- **Supabase JS** — Auth + DB + Storage + Edge Functions

### Padrões de nomenclatura
- Rotas: português (`/curadoria`, `/parceiros`, `/selos`, `/minha-conta`)
- Componentes: PascalCase, agrupados por feature (`admin/`, `curadoria/`)
- Hooks: `use` prefix (`useAnalytics`, `useFilterParams`)
- Edge functions: kebab-case (`sommelier-chat`, `hubla-webhook`)

---

## 3) Stack & Runtime

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Router | React Router v6 (BrowserRouter) |
| State/Data | TanStack Query (queries) + useState (local) |
| Backend/BaaS | Lovable Cloud (Supabase) |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (email/password, no signup público) |
| Storage | Supabase Storage (4 buckets públicos) |
| Serverless | 6 Deno Edge Functions |
| AI | Lovable AI Gateway (`google/gemini-3-flash-preview`) |
| Email | Lovable Email (React Email templates, domínio custom `jovemdovinho.com.br`) |
| Hospedagem | Lovable (preview + published em `vinho-guia-magico.lovable.app`) |

**Ambientes:** Apenas produção (Lovable Cloud). Sem staging separado. `build:dev` existe mas sem diferenças de config documentadas.

---

## 4) Configuração & Variáveis de Ambiente

### Env vars (frontend — `.env`)
| Variável | Tipo | Uso |
|----------|------|-----|
| `VITE_SUPABASE_URL` | Pública | Client Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pública | Anon key |
| `VITE_SUPABASE_PROJECT_ID` | Pública | ID do projeto |

### Secrets (edge functions — Supabase Secrets)
| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | Edge functions |
| `SUPABASE_ANON_KEY` | User client nas functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client nas functions |
| `SUPABASE_DB_URL` | [TO BE COMPLETED: verificar se é usado em alguma function] |
| `SUPABASE_PUBLISHABLE_KEY` | Duplicata do anon key? |
| `LOVABLE_API_KEY` | AI Gateway + Email |
| `HUBLA_WEBHOOK_SECRET` | Validação do webhook Hubla |

**Lacuna:** `SUPABASE_DB_URL` e `SUPABASE_PUBLISHABLE_KEY` parecem não ser usados diretamente em nenhuma edge function visível.

---

## 5) Arquitetura

### Camadas
```text
┌──────────────────────────────────────────┐
│  UI (React + Tailwind + shadcn/ui)       │
│  Pages → Components → UI primitives     │
├──────────────────────────────────────────┤
│  Data Layer (TanStack Query + Supabase)  │
│  Hooks (useAnalytics, useFilterParams)   │
│  Context (AuthContext)                   │
├──────────────────────────────────────────┤
│  Edge Functions (Deno)                   │
│  sommelier-chat, hubla-webhook,          │
│  admin-members, auth-email-hook,         │
│  migrate-drive-urls, rehost-drive-file   │
├──────────────────────────────────────────┤
│  Supabase (Postgres + Auth + Storage)    │
│  RLS policies + DB functions             │
└──────────────────────────────────────────┘
```

### Padrão arquitetural
Feature-based (componentes agrupados por domínio: `admin/`, `curadoria/`), com camada de dados inline nos componentes (queries diretas ao Supabase nos pages/components, sem services layer).

### Pontos de acoplamento / riscos
1. **Queries inline em componentes** — sem abstração de services; duplicação de queries entre HomePage e CuradoriaPage
2. **`profiles_public` view** — referenciada com `as any` cast, indica tipo não gerado
3. **`partnerLogos.ts`** — mapeamento `good-clothing` ↔ `saida-emergencia` parece invertido (linhas 56-60)
4. **RLS com RESTRICTIVE policies** — todas as policies são `Permissive: No` (RESTRICTIVE), o que significa que TODAS precisam passar. Isso é intencional e funciona, mas pode causar bloqueio inesperado se novas policies forem adicionadas sem entender o padrão.

### Onde colocar código novo
- Novo hook: `src/hooks/`
- Novo componente de feature: `src/components/<feature>/`
- Nova página: `src/pages/` + rota em `App.tsx`
- Nova edge function: `supabase/functions/<nome>/index.ts`

---

## 6) Rotas/Páginas e Navegação

| Path | Página | Proteção | Finalidade |
|------|--------|----------|-----------|
| `/login` | LoginPage | Pública | Login email/senha |
| `/reset-password` | ResetPasswordPage | Pública | Reset de senha |
| `/` | HomePage | Auth + Membership | Banners + vinhos recentes |
| `/curadoria` | CuradoriaPage | Auth + Membership | Catálogo com filtros |
| `/curadoria/:id` | WineDetailPage | Auth + Membership | Detalhe, votação, comentários |
| `/sommelier` | SommelierPage | Auth + Membership | Chat AI |
| `/parceiros` | ParceirosPage | Auth + Membership | Cupons de parceiros |
| `/selos` | SelosPage | Auth + Membership | Explicação dos selos |
| `/minha-conta` | MyAccountPage | Auth + Membership | Perfil + senha |
| `/ranking` | RankingPage | Auth + Membership | Ranking membros/vinhos |
| `/admin` | AdminPage | Auth + Admin role | Painel admin (8 abas) |
| `*` | NotFound | — | 404 |

**Layout:** `AppLayout` com sidebar desktop (264px) + header mobile fixo + hamburger overlay. Logo centralizado no header. Avatar compacto à esquerda no mobile.

**Guardas:**
- `ProtectedRoute` — redireciona `/login` se não logado; bloqueia acesso se membership inativa
- `AdminRoute` — redireciona `/` se role ≠ admin

**Estados UI padrão:** Loading (Loader2 spinner), Empty (ícone + texto), Error (toast via sonner/shadcn). Não há error boundary global.

---

## 7) Design System e CSS

### Estratégia
Tailwind CSS + CSS custom properties (HSL) + shadcn/ui components. Sem CSS Modules. Sem styled-components.

### Tokens

**Cores (light mode):**
- Primary: `201 57% 28%` (azul petróleo escuro)
- Secondary: `216 63% 14%` (azul muito escuro)
- Accent: `47 93% 81%` (dourado/gold)
- Highlight: `18 93% 56%` (laranja)
- Background: `209 40% 96%` (cinza azulado claro)
- Destructive: `0 72% 50%` (vermelho)
- Wine tokens: mapeados para os mesmos azuis (não são cores de vinho/burgundy)

**Dark mode:** Definido em CSS (`.dark`) mas sem toggle na UI.

**Tipografia:**
- Sans: Open Sans (body, labels)
- Display/Serif: Lore (custom OTF, headings, titles)
- Mono: Space Mono

**Heading override:** Todos os h1-h6 usam font-family Lore com `letter-spacing: -0.04em`

**Breakpoints:** Tailwind defaults (`sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1400px`)

**Radius:** `0.5rem` base

**Shadows:** Custom scale (2xs → 2xl) via CSS variables

### Componentes UI (shadcn/ui)
40+ primitivos instalados: Accordion, Alert, Avatar, Badge, Button, Calendar, Card, Carousel, Chart, Checkbox, Command, Dialog, Drawer, Dropdown, Form, HoverCard, Input, Label, Menubar, NavigationMenu, Pagination, Popover, Progress, RadioGroup, Resizable, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip.

**Custom components:** MemberBadge (3 variants: admin/radar/comunidade), WineCard, AudioPlayer, CarouselArrows.

### Acessibilidade
- Focus rings via Tailwind `ring` utilities
- `aria-label` em botões de navegação do carrossel
- Sem testes de contraste documentados
- Sem skip-to-content link

### Anti-padrões detectados
- Uso frequente de `text-[10px]` e `text-[11px]` (fora da scale do Tailwind)
- `as any` casts em dados do Supabase (wine seals, profiles_public)
- Classe utilitária `.glass` definida mas raramente usada

---

## 8) Base de Dados

### Entidades (17 tabelas + 1 view)

| Tabela | Finalidade | RLS |
|--------|-----------|-----|
| `wines` | Catálogo de vinhos | ✅ has_active_access + admin |
| `wine_seals` | Relação N:N vinho↔selo | ✅ |
| `wine_votes` | Votos (recommend/not_recommend) | ✅ |
| `wine_comments` | Comentários de membros | ✅ |
| `seals` | Selos (perfil_vinho, perfil_cliente) | ✅ |
| `thomas_notes` | Notas do sommelier Thomas | ✅ (public visibility) |
| `partners` | Parceiros com cupons | ✅ |
| `profiles` | Dados de perfil do usuário | ✅ |
| `profiles_public` | View pública (user_id, full_name, avatar_url) | ❌ sem RLS (view) |
| `memberships` | Status de assinatura | ✅ |
| `user_roles` | Roles (admin/member) | ✅ |
| `home_banners` | Banners da home page | ✅ |
| `chat_sessions` | Sessões do sommelier AI | ✅ |
| `chat_messages` | Mensagens do chat AI | ✅ |
| `chat_messages_safe` | View sem dados sensíveis | ❌ sem RLS (view) |
| `chat_feedback` | Feedback em mensagens AI | ✅ |
| `usage_ledger` | Consumo mensal de AI | ✅ (no client writes) |
| `ai_pricing_config` | Config do AI (prompt, limites, preços) | ✅ |
| `ai_knowledge_base` | Base de conhecimento para RAG | ✅ |
| `analytics_events` | Eventos de analytics | ✅ |
| `webhook_events` | Eventos de webhook (idempotência) | ✅ |
| `webhook_logs` | Logs de webhook | ✅ |

### DB Functions
- `has_active_access(uuid)` — SECURITY DEFINER, verifica admin OR membership ativa
- `has_role(uuid, app_role)` — SECURITY DEFINER, verifica role
- `handle_new_user()` — Trigger function (cria profile + role member)
- `get_rankings(period)` — Rankings de membros
- `get_wine_rankings(period)` — Rankings de vinhos
- `update_updated_at_column()` — Trigger para updated_at

### Triggers
Nota: O schema lista "no triggers" mas `handle_new_user()` é uma trigger function. **Conflito detectado**: A function existe mas o trigger `on auth.users AFTER INSERT` pode não estar registrado (ou está em schema reservado `auth` e não aparece na listagem).

**Pergunta:** O trigger `handle_new_user()` está de fato ativo em `auth.users`?

### PII
- `profiles.full_name`, `profiles.avatar_url`, `profiles.bio` — dados pessoais
- `auth.users.email` — e-mail (acessado via admin API nas edge functions)
- Webhook payloads — redactados antes de armazenar (SENSITIVE_KEYS list)

### Padrões de consulta
- Filtragem client-side após fetch completo (CuradoriaPage carrega TODOS os vinhos, filtra em memória)
- Paginação client-side (PAGE_SIZE = 9)
- Rankings via RPC (server-side aggregation)

### Migração/Seed
25 migration files sequenciais. Sem seed file documentado.

---

## 9) Camada de Dados e Hooks

### Biblioteca: TanStack Query v5

### Hooks customizados

| Hook | Domínio | Responsabilidade |
|------|---------|-----------------|
| `useAuth()` | Auth | User, session, role, membershipActive, signOut |
| `useAnalytics()` | Analytics | track, trackPageView, trackFilterUsed, trackWineOpened |
| `useFilterParams()` | URL | get/set/getNum para search params com auto-reset de page |
| `useMobile()` | UI | Detecção de viewport mobile |

### Padrões de query (TanStack Query)

**Queries inline nos componentes** — sem hooks wrapper dedicados:
- `["curadoria-wines"]` — todos vinhos (sem staleTime custom)
- `["curadoria-wine-seals"]` — todos wine_seals
- `["curadoria-vote-counts"]` — todos votos
- `["curadoria-comment-counts"]` — todos comentários
- `["wine-detail", id]` — vinho individual
- `["wine-votes", wineId]` — votos de um vinho
- `["wine-comments", wineId]` — comentários de um vinho
- `["partners"]` — parceiros ativos
- `["seals"]` — todos selos
- `["rankings", period]` — ranking membros (RPC)
- `["wine-rankings", period]` — ranking vinhos (RPC)
- `["chat-sessions", userId]` — sessões do chat
- `["chat-usage", userId]` — usage ledger

**Mutations:**
- `voteMutation` — insert/update/delete voto → invalidate `["wine-votes", wineId]`
- `addComment` / `deleteComment` → invalidate `["wine-comments", wineId]`

**Cache/Invalidation:** Nenhum `staleTime` ou `gcTime` customizado. Defaults do TanStack Query.

### Anti-padrões detectados
1. **Overfetch em CuradoriaPage** — carrega TODOS os vinhos + TODOS os seals + TODOS os votos + TODOS os comentários de uma vez. Filtragem/paginação é client-side. Funciona com < 1000 vinhos, mas escala mal.
2. **Duplicação de lógica de seal mapping** entre HomePage e CuradoriaPage (categorias `perfil_vinho`/`perfil_cliente`).
3. **No error boundaries** — queries com erros vão para estado de erro do TanStack Query mas sem UI global de fallback.

---

## 10) APIs Internas / Edge Functions

| Function | JWT | Método | Finalidade |
|----------|-----|--------|-----------|
| `sommelier-chat` | ❌ (verify_jwt=false, mas verifica auth header manualmente) | POST | Chat AI com RAG, budget, rate limiting |
| `hubla-webhook` | ❌ | POST | Webhook de pagamento (ativa/cancela memberships) |
| `admin-members` | Sim (manual check) | POST | CRUD de membros (6 actions) |
| `auth-email-hook` | ❌ | POST | E-mail transacional (signup, recovery, etc.) |
| `migrate-drive-urls` | ? | ? | [TO BE COMPLETED: migração de URLs do Drive] |
| `rehost-drive-file` | ? | ? | [TO BE COMPLETED: rehost de arquivos do Drive] |

### sommelier-chat — Detalhes
- Auth: header `authorization` → getUser()
- Budget: `usage_ledger` por mês, cap em `ai_pricing_config.monthly_cap_brl`
- Rate limit: 5min sliding window + daily cap
- RAG: keyword search em `wines` + fallback top 5 + seals + thomas_notes + knowledge_base
- Modelo: `google/gemini-3-flash-preview` via Lovable AI Gateway
- Resumo de conversa: auto-gerado a cada 6 mensagens quando > 12

### admin-members — Actions
`list_members`, `get_member_detail`, `create_member`, `update_member`, `reset_password`, `delete_user`, `set_password`

### hubla-webhook — Fluxo
1. Valida `x-hubla-token` contra secret
2. Idempotência via `webhook_events`
3. Redacta payload sensível
4. Activation: cria user se não existe → upsert membership → ensure role
5. Cancellation: marca membership como inactive

---

## 11) Integrações Externas & Webhooks

### Hubla (pagamentos)
- **Credencial:** `HUBLA_WEBHOOK_SECRET` (secret)
- **Eventos de ativação:** NewUser, subscription.activated, subscription.renewed, purchase.approved, purchase.completed, payment.approved, invoice.paid
- **Eventos de cancelamento:** subscription.cancelled/canceled/expired, purchase.refunded/chargeback, payment.refunded
- **Idempotência:** Via `webhook_events` table (event_id)
- **Replay protection:** Idempotência por event_id; sem validação de timestamp
- **Contingência:** Erros logados em `webhook_logs`, retorna 500

### Lovable AI Gateway
- **Credencial:** `LOVABLE_API_KEY`
- **Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Modelo:** `google/gemini-3-flash-preview`

### Lovable Email
- **Domínio custom:** `notify.jovemdovinho.com.br` (sender), `jovemdovinho.com.br` (from)
- **Templates:** signup, invite, magiclink, recovery, email_change, reauthentication

---

## 12) Segurança, Privacidade e Compliance

### Auth & Authz
- **Auth:** Supabase Auth (email/password). Sem signup público (membros criados via webhook ou admin).
- **Roles:** Enum `app_role` (admin, member) na tabela `user_roles`. Verificação via `has_role()` SECURITY DEFINER.
- **Membership check:** `has_active_access()` SECURITY DEFINER — admin OR membership ativa.
- **Todas RLS policies são RESTRICTIVE** (Permissive: No).

### Rotas protegidas
- Frontend: `ProtectedRoute` (auth + membership), `AdminRoute` (auth + admin role)
- Edge functions: verificação manual de auth header + role check (admin-members)

### PII
- Payloads de webhook são redactados antes de armazenar (CPF, cartão, etc.)
- Perfis públicos expostos via `profiles_public` view (apenas nome + avatar)
- E-mails acessados apenas via admin API (edge functions com service role key)

### Input validation
- Sommelier: message length ≤ 2000 chars
- Profile: bio ≤ 140 chars, avatar ≤ 2MB
- Senha: ≥ 6 caracteres
- Sem sanitização de HTML/XSS explícita (React escapa por padrão; ReactMarkdown no chat pode ser vetor se conteúdo malicioso vier da AI)

### Lacunas
- **Sem CSRF protection** — Supabase JWT mitiga parcialmente
- **Sem rate limiting no frontend** — debounce ausente em votação/comentários
- **Password reset não previne email enumeration** — ✅ já tratado (sempre mostra mesma mensagem)
- **`listUsers()` no webhook** — iteração completa para achar por email; escala mal com muitos users

---

## 13) Observabilidade

### Logs
- `console.error` / `console.warn` em edge functions
- `console.warn` em `useAnalytics` (silent fail)
- Sem logging structured/provider (Sentry, LogRocket, etc.)

### Analytics
- Tabela `analytics_events` com 3 tipos: `page_view`, `filter_used`, `wine_opened`
- Admins são excluídos do tracking
- `last_seen_at` atualizado no profile a cada mudança de rota

### Webhook logs
- `webhook_logs` table com action/status/details

### AI usage
- `usage_ledger` por mês (tokens in/out, cost USD/BRL, request count)
- `chat_messages` com tokens e cost por mensagem

### Lacunas
- Sem error tracking (Sentry ou similar)
- Sem health check endpoint
- Sem alertas de budget AI ou falhas de webhook
- Analytics não trackeiam duração de sessão ou bounce rate

---

## 14) Performance e Escalabilidade

### Estratégias encontradas
- `loading="lazy"` em imagens
- `group-hover:scale-105 transition-transform` — GPU-accelerated
- TanStack Query cache (defaults)
- Rankings via RPC (aggregation no DB)
- Conversation summary (compact history > 12 msgs)
- AI token limits por mode (economico/detalhado/ultra_economico)

### Gargalos prováveis
1. **CuradoriaPage** — carrega TODOS vinhos + seals + votes + comments upfront. Com > 200 vinhos, já pode causar lentidão
2. **`admin.listUsers()`** no hubla-webhook — iteração linear por e-mail; O(n) em cada webhook
3. **Rate limiting no sommelier-chat** — faz 2 queries para contar mensagens recentes usando `IN (session_ids)`. Ineficiente com muitas sessões
4. **Embla carousel re-renders** — queries sem staleTime; cada navegação de volta à home refaz as queries

### Melhorias recomendadas (sem implementar)
- Server-side pagination/filtering na curadoria (query params → supabase filters)
- Index em `chat_messages(session_id, created_at)` para rate limiting
- Lookup de user por email no webhook via `auth.admin.getUserByEmail()` ao invés de `listUsers()`
- `staleTime` nos queries de vinhos/selos (dados mudam raramente)

---

## 15) Testes, Qualidade e Critérios de Aceite

### Suite de testes
- **Vitest** configurado com jsdom + `@testing-library/react`
- **Apenas 1 test file**: `src/test/example.test.ts` (provavelmente placeholder)
- **Sem testes de componente, integração ou e2e**

### Linters/Formatters
- ESLint com `typescript-eslint` + `react-hooks` + `react-refresh`
- `noUnusedLocals: false`, `noUnusedParameters: false`, `strict: false`
- Sem Prettier configurado

### Given/When/Then — Fluxos críticos

1. **Login de membro**
   - Given: membro com membership ativa
   - When: insere email + senha e clica Entrar
   - Then: redireciona para `/`, sidebar mostra nome + badge

2. **Votação em vinho**
   - Given: membro logado na página de detalhe
   - When: clica ThumbsUp
   - Then: botão fica "default" variant, contador incrementa; segundo clique remove voto

3. **Webhook Hubla (ativação)**
   - Given: novo pagamento com email não existente
   - When: POST no webhook com token válido
   - Then: user criado, membership ativa, profile criado, role member inserido

4. **Sommelier AI**
   - Given: membro com créditos disponíveis
   - When: envia mensagem
   - Then: resposta em markdown, usage atualizado, sessão criada

5. **Admin cria membro**
   - Given: admin logado no painel
   - When: preenche email/nome e clica criar
   - Then: user criado no auth, membership inserida, aparece na lista

---

## 16) Runbooks Operacionais

### Rodar local
```bash
git clone <repo>
cd <project>
npm install   # ou bun install
npm run dev   # http://localhost:8080
```

### Build e deploy
- Frontend: commit no repo → Lovable auto-deploy OU "Publish" no editor
- Edge functions: deploy automático pelo Lovable Cloud
- DB migrations: executadas via Lovable migration tool

### Erros comuns
| Erro | Causa provável | Ação |
|------|---------------|------|
| 401 no sommelier-chat | Token expirado | Re-login |
| "Acesso bloqueado" | Membership inativa | Verificar no admin → Membros |
| Webhook 401 | HUBLA_WEBHOOK_SECRET incorreto | Atualizar secret |
| Selos não aparecem | Categoria errada no DB (`tipo_vinho` vs `perfil_vinho`) | Verificar `seals.category` |
| Imagens não carregam | URL do Drive expirada | Usar `rehost-drive-file` |

---

## 17) Lacunas + Perguntas Priorizadas

### P0 — Bloqueia produção
1. **Trigger `handle_new_user` pode não estar ativo** — se não houver trigger em `auth.users`, novos users criados via admin ou webhook não terão profile/role automaticamente (as functions fazem isso manualmente, mas é redundância frágil).
   - **Pergunta:** O trigger `handle_new_user()` está ativo em `auth.users AFTER INSERT`?

2. **`profiles_public` sem RLS** — view expõe nome e avatar de todos os users sem restrição.
   - **Pergunta:** É intencional que qualquer usuário autenticado veja todos os perfis?

### P1 — Importante
3. **Overfetch na CuradoriaPage** — sem paginação server-side; vai quebrar com > 1000 vinhos.
   - **Pergunta:** Quantos vinhos existem atualmente? Há plano de crescimento?

4. **`listUsers()` no webhook** — O(n) para encontrar user por email.
   - **Pergunta:** Quantos users existem? Hubla envia webhook com user ID ou só email?

5. **Sem error tracking** — erros em produção são invisíveis.
   - **Pergunta:** Deseja integrar algum serviço de monitoramento?

6. **Sem testes** — apenas 1 test placeholder.
   - **Pergunta:** Há interesse em cobertura mínima de testes nos fluxos críticos?

7. **`partnerLogos.ts` mapeamento invertido** — `good-clothing` aponta para `saida-de-emergencia.png` e vice-versa.
   - **Pergunta:** Isso é intencional ou bug?

### P2 — Melhoria
8. **Dark mode sem toggle** — CSS definido mas inacessível ao user.
9. **Sem debounce na busca** da curadoria — cada keystroke re-filtra.
10. **Sem `staleTime`** nos queries — dados estáticos (selos, parceiros) são re-fetched a cada mount.
11. **`WineDetailPage` linha 83** — filtra por `perfil_bebedor` mas DB usa `perfil_cliente`. Inconsistência que pode esconder selos do tipo bebedor na página de detalhe.
    - **Pergunta:** Confirmar se a categoria correta é `perfil_cliente` (como usado no CuradoriaPage) ou `perfil_bebedor`.

---

**Pacote de saída pronto para gerar plan.md: SIM, com ressalvas.**

O inventário cobre stack, DB, APIs, hooks, design system, segurança e observabilidade com detalhes suficientes para gerar um plan.md completo. As lacunas identificadas (17 items) têm perguntas objetivas associadas. Os 3 itens P0/P1 mais críticos devem ser respondidos antes de finalizar o plano: trigger de new user, overfetch na curadoria, e mapeamento invertido de logos.

