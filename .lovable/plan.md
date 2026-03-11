

## Plano: Navegação prev/next em ordem alfabética

Mudança de 1 linha em `src/pages/AulaPage.tsx`:

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/pages/AulaPage.tsx` | 63-66 | Trocar `.select("id, sort_order").order("sort_order")` por `.select("id, titulo").order("titulo", { ascending: true })` |

A query de siblings já é usada para determinar prev/next via `findIndex`. Basta ordenar por `titulo` em vez de `sort_order` para que a navegação siga a mesma ordem alfabética da listagem.

