

## Correção da URL da API Panda na `panda-proxy`

### Problema
A URL base está usando `api-v2.pandavideo.com.br` (com `.br`), mas a URL oficial é `api-v2.pandavideo.com`.

### Alterações em `supabase/functions/panda-proxy/index.ts`

1. **Linha 9**: Trocar `https://api-v2.pandavideo.com.br` → `https://api-v2.pandavideo.com`
2. **Linha 82-83**: Adicionar log do status HTTP antes dos logs existentes:
   ```
   console.log('STATUS:', pandaRes.status)
   ```

Nenhuma outra alteração. Nenhum componente ou tela será modificado.

