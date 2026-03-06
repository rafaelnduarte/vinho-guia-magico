

# Auditoria Completa da Base de Dados

Aqui esta o relatório exaustivo de tudo que existe implementado no projeto.

---

## 1. ENUMS

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
```

Apenas um enum existe no schema `public`.

---

## 2. TABELAS

### 2.1 `profiles`
```sql
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE,
  full_name   text,
  avatar_url  text,
  bio         text,
  last_seen_at    timestamptz,
  must_change_password boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```
- FK: nenhuma (user_id referencia auth.users logicamente, mas sem FK declarada)

### 2.2 `user_roles`
```sql
CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role    app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);
```

### 2.3 `memberships`
```sql
CREATE TABLE public.memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  source          text NOT NULL DEFAULT 'manual',
  external_id     text,
  membership_type text NOT NULL DEFAULT 'comunidade',
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### 2.4 `wines`
```sql
CREATE TABLE public.wines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  producer       text,
  country        text,
  region         text,
  type           text,
  grape          text,
  vintage        integer,
  importer       text,
  price_range    text,
  rating         numeric,
  description    text,
  tasting_notes  text,
  image_url      text,
  audio_url      text,
  website_url    text,
  status         text NOT NULL DEFAULT 'curadoria',
  drink_or_cellar text,
  is_published   boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

### 2.5 `wine_votes`
```sql
CREATE TABLE public.wine_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id    uuid NOT NULL,
  user_id    uuid NOT NULL,
  vote       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wine_id, user_id)
);
```

### 2.6 `wine_comments`
```sql
CREATE TABLE public.wine_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id    uuid NOT NULL,
  user_id    uuid NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.7 `wine_seals`
```sql
CREATE TABLE public.wine_seals (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id uuid NOT NULL,
  seal_id uuid NOT NULL,
  UNIQUE (wine_id, seal_id)
);
```

### 2.8 `seals`
```sql
CREATE TABLE public.seals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL,
  icon        text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### 2.9 `thomas_notes`
```sql
CREATE TABLE public.thomas_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id    uuid NOT NULL,
  note_type  text NOT NULL DEFAULT 'opinion',
  note_text  text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.10 `partners`
```sql
CREATE TABLE public.partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  logo_url     text,
  website_url  text,
  coupon_code  text,
  conditions   text,
  contact_info text,
  category     text NOT NULL DEFAULT 'importadoras',
  discount     text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### 2.11 `home_banners`
```sql
CREATE TABLE public.home_banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url  text NOT NULL,
  link_url   text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.12 `analytics_events`
```sql
CREATE TABLE public.analytics_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  event_type text NOT NULL,
  page       text,
  metadata   jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.13 `chat_sessions`
```sql
CREATE TABLE public.chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  title      text DEFAULT 'Nova conversa',
  summary    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.14 `chat_messages`
```sql
CREATE TABLE public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role       text NOT NULL,
  content    text NOT NULL,
  mode       text DEFAULT 'economico',
  tokens_in  integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  cost_usd   numeric DEFAULT 0,
  cost_brl   numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.15 `chat_feedback`
```sql
CREATE TABLE public.chat_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id    uuid NOT NULL,
  rating     integer,
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.16 `ai_pricing_config`
```sql
CREATE TABLE public.ai_pricing_config (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name              text NOT NULL DEFAULT 'google/gemini-3-flash-preview' UNIQUE,
  system_prompt           text NOT NULL DEFAULT '...(prompt longo)...',
  price_in_per_1k         numeric NOT NULL DEFAULT 0.00010,
  price_out_per_1k        numeric NOT NULL DEFAULT 0.00040,
  usd_brl_rate            numeric NOT NULL DEFAULT 5.00,
  monthly_cap_brl         numeric NOT NULL DEFAULT 10.00,
  max_tokens_economico    integer NOT NULL DEFAULT 350,
  max_tokens_detalhado    integer NOT NULL DEFAULT 700,
  max_tokens_ultra_economico integer NOT NULL DEFAULT 180,
  rate_limit_per_5min     integer NOT NULL DEFAULT 10,
  rate_limit_per_day      integer NOT NULL DEFAULT 60,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
```

### 2.17 `ai_knowledge_base`
```sql
CREATE TABLE public.ai_knowledge_base (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  content    text NOT NULL,
  category   text NOT NULL DEFAULT 'geral',
  file_url   text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.18 `usage_ledger`
```sql
CREATE TABLE public.usage_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  month             text NOT NULL,
  input_tokens      bigint DEFAULT 0,
  output_tokens     bigint DEFAULT 0,
  estimated_cost_usd numeric DEFAULT 0,
  estimated_cost_brl numeric DEFAULT 0,
  request_count     integer DEFAULT 0,
  last_request_at   timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
```

### 2.19 `webhook_events`
```sql
CREATE TABLE public.webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text NOT NULL UNIQUE,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 2.20 `webhook_logs`
```sql
CREATE TABLE public.webhook_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   text,
  action     text NOT NULL,
  status     text NOT NULL,
  details    jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 3. VIEWS

### 3.1 `profiles_public`
```sql
CREATE VIEW public.profiles_public AS
  SELECT user_id, full_name, avatar_url FROM profiles;
```

### 3.2 `chat_messages_safe`
```sql
CREATE VIEW public.chat_messages_safe AS
  SELECT id, session_id, role, content, mode, created_at FROM chat_messages;
```

---

## 4. FUNCTIONS

### 4.1 `has_role(_user_id uuid, _role app_role) → boolean`
```sql
-- SECURITY DEFINER, STABLE
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
);
```

### 4.2 `has_active_access(_user_id uuid) → boolean`
```sql
-- SECURITY DEFINER, plpgsql
RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM memberships WHERE user_id = _user_id AND status = 'active');
```

### 4.3 `handle_new_user() → trigger`
```sql
-- SECURITY DEFINER, plpgsql
-- Insere profile + user_role 'member' ao criar usuário
INSERT INTO profiles (user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'member');
```
⚠️ **Nota**: Embora esta função exista, **nenhum trigger está associado a ela no schema `public`**. Ela provavelmente está ligada a um trigger em `auth.users` (schema reservado), que não é visível via queries no schema público.

### 4.4 `get_rankings(period text) → TABLE`
```sql
-- SECURITY DEFINER, retorna ranking de usuários por votos + comentários
-- Parâmetro: 'week', 'month', 'year', 'all'
-- Retorna: user_id, full_name, avatar_url, vote_count, comment_count, total_points, role, membership_type
```

### 4.5 `get_wine_rankings(period text) → TABLE`
```sql
-- SECURITY DEFINER, retorna ranking de vinhos por votos + comentários
-- Retorna: wine_id, wine_name, wine_type, wine_country, wine_image_url, vote_count, comment_count, total_points
```

### 4.6 `update_updated_at_column() → trigger`
```sql
-- Define NEW.updated_at = now()
-- Usada para auto-atualizar timestamps
```

---

## 5. TRIGGERS

⚠️ **Nenhum trigger encontrado no schema `public`.** A função `handle_new_user` e `update_updated_at_column` existem, mas não possuem triggers registrados em tabelas públicas. `handle_new_user` provavelmente está em `auth.users`.

---

## 6. RLS POLICIES (todas as tabelas)

### `profiles`
| Policy | Cmd | USING | WITH CHECK |
|---|---|---|---|
| Users can read own profile | SELECT | `auth.uid() = user_id` | |
| Users can update own profile | UPDATE | `auth.uid() = user_id` | |
| Users can insert own profile | INSERT | | `auth.uid() = user_id` |
| Members can read basic profile info | SELECT | `has_active_access(auth.uid())` | |
| Admins can read all profiles | SELECT | `has_role(auth.uid(), 'admin')` | |
| Admins can manage profiles | ALL | `has_role(auth.uid(), 'admin')` | |

### `user_roles`
| Policy | Cmd | USING | WITH CHECK |
|---|---|---|---|
| Users can read own roles | SELECT | `auth.uid() = user_id` | |
| Admins can read all roles | SELECT | `has_role(auth.uid(), 'admin')` | |
| Admins can manage roles | ALL | `has_role(auth.uid(), 'admin')` | |
| Only admins can insert roles | INSERT | | `has_role(auth.uid(), 'admin')` |

### `memberships`
| Policy | Cmd | USING |
|---|---|---|
| Users can read own membership | SELECT | `auth.uid() = user_id` |
| Admins can manage memberships | ALL | `has_role(auth.uid(), 'admin')` |

### `wines`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read visible wines | SELECT | `status IN ('curadoria','acervo') AND has_active_access(auth.uid())` |
| Admins can manage wines | ALL | `has_role(auth.uid(), 'admin')` |

### `wine_votes`
| Policy | Cmd | Expressão |
|---|---|---|
| Active members can view votes | SELECT | `has_active_access(auth.uid())` |
| Active members can insert votes | INSERT | WITH CHECK: `auth.uid() = user_id AND has_active_access(auth.uid())` |
| Users can update their own vote | UPDATE | `auth.uid() = user_id` |
| Users can delete their own vote | DELETE | `auth.uid() = user_id` |

### `wine_comments`
| Policy | Cmd | Expressão |
|---|---|---|
| Active members can view comments | SELECT | `has_active_access(auth.uid())` |
| Active members can insert comments | INSERT | WITH CHECK: `auth.uid() = user_id AND has_active_access(auth.uid())` |
| Users can update their own comment | UPDATE | `auth.uid() = user_id` |
| Users can delete their own comment | DELETE | `auth.uid() = user_id` |

### `wine_seals`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read wine_seals | SELECT | `has_active_access(auth.uid())` |
| Admins can manage wine_seals | ALL | `has_role(auth.uid(), 'admin')` |

### `seals`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read seals | SELECT | `has_active_access(auth.uid())` |
| Admins can manage seals | ALL | `has_role(auth.uid(), 'admin')` |

### `thomas_notes`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read public notes | SELECT | `visibility = 'public' AND has_active_access(auth.uid())` |
| Admins can manage thomas_notes | ALL | `has_role(auth.uid(), 'admin')` |

### `partners`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read active partners | SELECT | `is_active = true AND has_active_access(auth.uid())` |
| Admins can manage partners | ALL | `has_role(auth.uid(), 'admin')` |

### `home_banners`
| Policy | Cmd | USING |
|---|---|---|
| Active members can view active banners | SELECT | `is_active = true AND has_active_access(auth.uid())` |
| Admins can manage banners | ALL | `has_role(auth.uid(), 'admin')` |

### `analytics_events`
| Policy | Cmd | Expressão |
|---|---|---|
| Admins can read analytics | SELECT | `has_role(auth.uid(), 'admin')` |
| Users can insert own events | INSERT | WITH CHECK: `auth.uid() = user_id` |
| ❌ UPDATE/DELETE | — | Nenhuma policy (bloqueado) |

### `chat_sessions`
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| Users can manage own sessions | ALL | `auth.uid() = user_id` |
| Admins can read all sessions | SELECT | `has_role(auth.uid(), 'admin')` |

### `chat_messages`
| Policy | Cmd | Expressão |
|---|---|---|
| Users can read own messages without cost | SELECT | `EXISTS (SELECT 1 FROM chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())` |
| Users can insert own messages | INSERT | WITH CHECK: mesma subquery |
| Admins can read all messages | SELECT | `has_role(auth.uid(), 'admin')` |
| No client updates | UPDATE | `false` |
| No client deletes | DELETE | `false` |

### `chat_feedback`
| Policy | Cmd | Expressão |
|---|---|---|
| Users can manage own feedback | ALL | `auth.uid() = user_id` |
| Admins can read all feedback | SELECT | `has_role(auth.uid(), 'admin')` |

### `ai_pricing_config`
| Policy | Cmd | USING |
|---|---|---|
| Anyone can read pricing config | SELECT | `has_active_access(auth.uid())` |
| Admins can manage pricing config | ALL | `has_role(auth.uid(), 'admin')` |

### `ai_knowledge_base`
| Policy | Cmd | USING |
|---|---|---|
| Active members can read active knowledge | SELECT | `is_active = true AND has_active_access(auth.uid())` |
| Admins can manage knowledge base | ALL | `has_role(auth.uid(), 'admin')` |

### `usage_ledger`
| Policy | Cmd | USING |
|---|---|---|
| Users can read own usage | SELECT | `auth.uid() = user_id` |
| Admins can read all usage | SELECT | `has_role(auth.uid(), 'admin')` |
| No client inserts | INSERT | `false` |
| No client updates | UPDATE | `false` |
| No client deletes | DELETE | `false` |

### `webhook_events`
| Policy | Cmd | Expressão |
|---|---|---|
| Admins can read webhook events | SELECT | `has_role(auth.uid(), 'admin')` |
| No client inserts | INSERT | `false` |
| ❌ UPDATE/DELETE | — | Nenhuma policy (bloqueado) |

### `webhook_logs`
| Policy | Cmd | Expressão |
|---|---|---|
| Admins can read webhook logs | SELECT | `has_role(auth.uid(), 'admin')` |
| No client inserts | INSERT | `false` |
| ❌ UPDATE/DELETE | — | Nenhuma policy (bloqueado) |

---

## 7. ÍNDICES (excluindo PKs)

| Tabela | Índice | Tipo | Campos |
|---|---|---|---|
| ai_pricing_config | ai_pricing_config_model_name_key | UNIQUE btree | `model_name` |
| analytics_events | idx_analytics_created_at | btree | `created_at` |
| analytics_events | idx_analytics_event_type | btree | `event_type` |
| analytics_events | idx_analytics_events_created_at | btree | `created_at DESC` |
| analytics_events | idx_analytics_events_event_type | btree | `event_type` |
| chat_messages | idx_chat_messages_created | btree | `created_at` |
| chat_messages | idx_chat_messages_session | btree | `session_id` |
| chat_sessions | idx_chat_sessions_user | btree | `user_id` |
| profiles | profiles_user_id_key | UNIQUE btree | `user_id` |
| thomas_notes | idx_thomas_notes_wine | btree | `wine_id` |
| usage_ledger | idx_usage_ledger_user_month | btree | `user_id, month` |
| usage_ledger | usage_ledger_user_id_month_key | UNIQUE btree | `user_id, month` |
| user_roles | user_roles_user_id_role_key | UNIQUE btree | `user_id, role` |
| webhook_events | webhook_events_event_id_key | UNIQUE btree | `event_id` |
| wine_seals | wine_seals_wine_id_seal_id_key | UNIQUE btree | `wine_id, seal_id` |
| wine_votes | wine_votes_wine_id_user_id_key | UNIQUE btree | `wine_id, user_id` |
| wines | idx_wines_country | btree | `country` |
| wines | idx_wines_importer | btree | `importer` |
| wines | idx_wines_is_published | btree | `is_published` |
| wines | idx_wines_type | btree | `type` |
| wines | idx_wines_vintage | btree | `vintage` |

⚠️ **Nota**: `analytics_events` tem índices duplicados para `created_at` e `event_type` (2 cada). Não causa erro, mas é redundante.

---

## 8. EDGE FUNCTIONS

| Função | Endpoint | Método | Descrição |
|---|---|---|---|
| `admin-members` | `POST /functions/v1/admin-members` | POST | CRUD de membros (list, create, update, delete, reset password, set password, reset onboarding). Requer admin. |
| `auth-email-hook` | `POST /functions/v1/auth-email-hook` | POST | Hook de email customizado para templates de autenticação (signup, recovery, invite, etc.). `verify_jwt = false` |
| `hubla-webhook` | `POST /functions/v1/hubla-webhook` | POST | Webhook da Hubla para ativação/cancelamento de memberships. Valida via `x-hubla-token`. `verify_jwt = false` |
| `sommelier-chat` | `POST /functions/v1/sommelier-chat` | POST | Chat AI com sommelier virtual. Usa Lovable AI gateway. `verify_jwt = false` |
| `migrate-drive-urls` | `POST /functions/v1/migrate-drive-urls` | POST | Migra URLs do Google Drive para storage interno. Requer admin. |
| `rehost-drive-file` | `POST /functions/v1/rehost-drive-file` | POST | Re-hospeda arquivo individual do Drive no storage. Requer admin. |
| `parse-knowledge-file` | `POST /functions/v1/parse-knowledge-file` | POST | Extrai texto de PDFs para base de conhecimento do AI. Usa Lovable AI gateway. Requer admin. |

---

## 9. VARIÁVEIS DE AMBIENTE (Secrets)

| Nome | Uso |
|---|---|
| `SUPABASE_URL` | URL do projeto backend |
| `SUPABASE_ANON_KEY` | Chave pública para client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço para operações admin em Edge Functions |
| `SUPABASE_DB_URL` | Conexão direta ao banco |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública (alias) |
| `HUBLA_WEBHOOK_SECRET` | Token de validação dos webhooks da Hubla |
| `LOVABLE_API_KEY` | Chave para AI gateway (sommelier-chat, parse-knowledge-file) |

---

## 10. STORAGE BUCKETS

| Bucket | Público |
|---|---|
| `wine-images` | Sim |
| `partner-logos` | Sim |
| `wine-audio` | Sim |
| `email-assets` | Sim |
| `knowledge-files` | Não |

---

Este relatório cobre **100% do que existe implementado** no backend. Pode usar para comparar com o script gerado externamente.

