

## Plano: Reestruturar Header e Sidebar

### Resumo

Três mudanças principais:

1. **Header global (todas as páginas):** Fundo azul primário (`bg-primary`) com logo + "Radar do Jovem" — visível em desktop e mobile.

2. **Sidebar (topo):** Substituir o bloco atual de logo/título pelo widget do usuário (avatar ou ícone de status, nome, badge, ranking mensal) — o banner que hoje está na HomePage vai para o topo da sidebar (desktop) e para o header no mobile (como avatar clicável ou compacto).

3. **Rankings e fallback de avatar:** Quando o usuário não tem foto (`avatar_url`), usar o ícone de status (Target para Radar, Wine para outros) como fallback no Avatar, tanto na sidebar quanto na página de ranking.

### Detalhes das mudanças

#### `src/components/AppLayout.tsx`
- **Header (desktop + mobile):** Adicionar uma barra fixa no topo com `bg-primary text-white`, contendo logo + "Radar do Jovem". No mobile, manter o botão de menu hambúrguer nesse header.
- **Sidebar (topo, desktop):** Remover o bloco logo/título. No lugar, colocar um mini-card do usuário com: avatar (foto ou ícone de status como fallback), nome, badge de membership e ranking mensal. Buscar esses dados via `profiles`, `memberships` e `get_rankings` RPC (mesmo padrão da HomePage).
- **Mobile:** No header, ao lado do logo, colocar o avatar compacto do usuário (foto ou ícone de status).

#### `src/pages/HomePage.tsx`
- Remover o banner de saudação (seção "Greeting Banner"), já que essas informações estarão permanentemente na sidebar/header.

#### `src/pages/RankingPage.tsx`
- No `AvatarFallback` do pódio e da tabela, ao invés de mostrar iniciais em texto, mostrar o ícone de status (Target/Wine) baseado no `membership_type` do entry.

#### `src/components/MemberBadge.tsx`
- Sem alterações, será reutilizado.

### Arquivos modificados
- `src/components/AppLayout.tsx` — header global + sidebar com user widget
- `src/pages/HomePage.tsx` — remover greeting banner
- `src/pages/RankingPage.tsx` — avatar fallback com ícone de status

