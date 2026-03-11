

## Analise: Por que NÃO implementar as 3 funções separadas

### Estado atual (já funcionando)

1. **PandaPlayer.tsx** — Já foi simplificado (mensagem anterior). Constrói a URL do iframe diretamente no client sem precisar de Edge Function. Funciona.

2. **panda-sync** — Já faz sync + profile assignment. Funciona (exceto o 500 do Panda na API de profile, que é um problema do lado do Panda, não de arquitetura).

3. **panda-webhook** — Já processa eventos do Panda. Funciona.

### Problemas no prompt proposto

| Problema | Detalhe |
|----------|---------|
| `panda-player` desnecessário | O player já funciona 100% client-side. Adicionar um round-trip ao backend para gerar uma URL que o client já sabe construir adiciona latência sem benefício. |
| Campos errados no `panda-profile-manager` | O prompt usa `profile_id` e `video_ids`, mas acabamos de corrigir para `profile` e `videos`. Implementar o prompt como está reintroduziria o bug 400. |
| PandaPlayer.tsx quebrado | O componente proposto chama `fetch('/panda-player')` — URL incorreta. Deveria ser `supabase.functions.invoke()` ou URL completa. Além disso, remove toda a lógica de progress tracking e postMessage que já funciona. |
| `req.json()` lido duas vezes | No `panda-player`, o body é lido com `await req.json()` no handler principal e depois novamente dentro de `logPlayback`. Isso causa erro. |
| Duplicação de responsabilidade | O `panda-profile-manager` duplica o webhook handling que já existe em `panda-webhook`. |

### Recomendação

Nenhuma mudança de código é necessária agora. O player foi simplificado na mensagem anterior e deve funcionar. As duas ações pendentes são:

1. **Testar o player** — Abrir uma aula no preview e verificar se o vídeo carrega sem erro.
2. **Verificar o PANDA_PROFILE_ID** — O erro 500 na atribuição de profile é um problema do Panda (profile inexistente ou sem permissão). Isso precisa ser verificado no painel do Panda Video, não com mudanças de código.

Se após testar o player o vídeo ainda falhar, o próximo passo seria inspecionar os logs do console e network requests para identificar exatamente onde o iframe falha.

