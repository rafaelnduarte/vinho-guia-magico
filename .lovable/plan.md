

## Remover extensão ".mp4" dos nomes de aulas nos KPIs

### Problema
Os títulos das aulas vindos da tabela `aulas` contêm a extensão `.mp4` (ex: `"Introdução ao Vinho.mp4"`). Isso aparece nos rankings e na tabela detalhada.

### Solução
Criar uma função utilitária `cleanTitle` no componente `AdminConsumptionKPIs.tsx` que remove `.mp4` do final do título:

```tsx
function cleanTitle(t: string): string {
  return t.replace(/\.mp4$/i, "");
}
```

Aplicar nos 4 pontos onde títulos de aulas são exibidos:

1. **Linha ~121** — `aulaCompletionList` mapping: `titulo: cleanTitle(aulaMap[aulaId]?.titulo ?? "Desconhecida")`
2. **Linha ~151** — `mostWatched` mapping: `titulo: cleanTitle(aulaMap[aulaId]?.titulo ?? "Desconhecida")`
3. **Linha ~194** — `funnelData` aula names: `cleanTitle(aula.titulo.slice(0, 20))` → `cleanTitle(aula.titulo).slice(0, 20)`
4. **Linha ~218** — `detailedAulas` mapping: `titulo` field wrapped with `cleanTitle(aula.titulo)`

### Arquivo modificado
`src/components/admin/AdminConsumptionKPIs.tsx` — adicionar função `cleanTitle` e aplicar nos 4 locais acima.

