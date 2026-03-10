

## Plano: Corrigir URL do endpoint de profile assignment

### Problema

Os logs mostram erro 403 em todas as tentativas de atribuição de profile:
```
"Authorization header requires 'Credential' parameter. Authorization header requires 'Signature' parameter..."
```

Este é um erro AWS — significa que a URL está resolvendo para um recurso S3/CloudFront em vez da API Panda.

### Causa raiz

Dois problemas na URL:
1. **Domínio errado**: `api-v2.pandavideo.com` deveria ser `api-v2.pandavideo.com.br`
2. **Path errado**: `/profiles/` (plural) deveria ser `/profile/` (singular)

A URL correta segundo a documentação oficial do Panda é:
`https://api-v2.pandavideo.com.br/profile/?type=set-videos`

Os outros endpoints (folders, videos) funcionam com `.com` porque provavelmente têm redirect, mas o `/profile/` não.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/panda-sync/index.ts` | Corrigir URL de `PANDA_BASE/profiles/` para `https://api-v2.pandavideo.com.br/profile/` |
| `supabase/functions/panda-webhook/index.ts` | Mesma correção na URL do profile assignment |

### Detalhes

Linha 194-195 do `panda-sync`:
```
- `${PANDA_BASE}/profiles/?type=set-videos`
+ `https://api-v2.pandavideo.com.br/profile/?type=set-videos`
```

Linha 74-75 do `panda-webhook`:
```
- "https://api-v2.pandavideo.com/profiles/?type=set-videos"
+ "https://api-v2.pandavideo.com.br/profile/?type=set-videos"
```

### Sem mudanças no banco ou frontend

Apenas correção de URL nas duas Edge Functions.

