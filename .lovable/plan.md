

## Plano: Adicionar debug + corrigir exibição de título na AulaPage

### Diagnóstico
Consultei os dados reais do curso PP Bordeaux. As 7 aulas estão com títulos corretos (PP Bordeaux - 1 até PP Bordeaux - 7). A lógica de ordenação com `localeCompare` numeric é correta e deve produzir a ordem 1→2→3→4→5→6→7.

O código atual (linhas 78-83) parece correto. O bug pode ser:
- Um problema de timing/race condition na atualização de estado
- O `navigate()` re-renderizando antes do `useEffect` completar o re-fetch

### Mudanças em `src/pages/AulaPage.tsx`

| Mudança | Descrição |
|---------|-----------|
| Adicionar logs de debug | Console logs para rastrear a ordem dos siblings e o cálculo de prev/next |
| Sanitizar título exibido | Aplicar `sanitizarTitulo()` no h2 da aula (linha 202) para remover .mp4 |
| Garantir reset de prev/next | Resetar `prevAulaId` e `nextAulaId` no início do useEffect para evitar stale state |

### Detalhes

1. No início do `useEffect` (linha 48), adicionar:
```typescript
setPrevAulaId(null);
setNextAulaId(null);
```

2. Após o sort dos siblings (linha 80), adicionar:
```typescript
console.log('[NAV] Siblings ordenados:', siblings.map(s => s.titulo));
console.log('[NAV] Aula atual:', aulaId, 'Index:', idx);
```

3. Adicionar função `sanitizarTitulo` e aplicar na linha 202.

Isso resolve o potencial problema de stale state (prev/next da aula anterior sendo usados brevemente antes do re-fetch completar) e fornece logs para diagnosticar se o bug persistir.

