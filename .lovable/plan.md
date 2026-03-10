

## Plano: Nova Página Inicial com Dois Carrosséis

### Resumo

Substituir todo o conteúdo da HomePage por duas seções de carrossel:
1. **Banners gerenciáveis** — imagens promocionais administráveis pelo painel admin
2. **Vinhos recentes** — os 10 vinhos mais novos, exibidos 3 por vez

---

### Dimensão recomendada das imagens (Linha 1)

As imagens dos banners devem ser enviadas em **1200 × 500 px** (proporção 12:5). Isso garante boa resolução em desktop e boa proporção em mobile. Formato: JPG ou WebP.

---

### Mudanças necessárias

#### 1. Nova tabela `home_banners` (migration)

```sql
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view active banners"
  ON public.home_banners FOR SELECT
  TO authenticated
  USING (is_active = true AND has_active_access(auth.uid()));

CREATE POLICY "Admins can manage banners"
  ON public.home_banners FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

#### 2. Nova aba "Banners" no Admin (`AdminPage.tsx`)

- Criar componente `AdminBanners.tsx` com CRUD simples: listar banners, upload de imagem (bucket `wine-images` ou novo bucket), definir link opcional, reordenar, ativar/desativar.
- Adicionar aba no `AdminPage.tsx`.

#### 3. Reescrever `HomePage.tsx`

**Linha 1 — Carrossel de Banners:**
- Usar `embla-carousel-react` (já instalado).
- Buscar `home_banners` ordenados por `sort_order`.
- Desktop/tablet: mostrar 3 slides visíveis por vez.
- Mobile: mostrar 1 slide por vez.
- Dots ou setas de navegação.
- Cada imagem pode ter link opcional (clicável).

**Linha 2 — Carrossel de Vinhos Recentes:**
- Query: 10 vinhos mais recentes (`status = 'curadoria'`, ordenados por `created_at DESC`, `LIMIT 10`).
- Reutilizar o componente `WineCard` existente.
- Desktop/tablet: 3 cards visíveis por vez, com scroll lateral.
- Mobile: 1 card por vez.
- Setas de navegação.

#### 4. Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/pages/HomePage.tsx` | Reescrever completamente |
| `src/components/admin/AdminBanners.tsx` | Criar (CRUD de banners) |
| `src/pages/AdminPage.tsx` | Adicionar aba "Banners" |
| Migration SQL | Criar tabela `home_banners` |

