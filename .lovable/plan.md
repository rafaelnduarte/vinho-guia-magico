

## Plano: Otimizar Player Panda Video + Detecção de Falha + HLS Fallback

### Análise

O problema real: vídeos com `duration=0` e `qualities=[]` no Panda falham silenciosamente no iframe. A solução envolve 3 camadas:

1. **Performance hints** (DNS prefetch/preconnect) no `index.html`
2. **PandaPlayer aprimorado** com detecção de timeout/erro e estado visual de falha
3. **HLS fallback** via `hls.js` quando o iframe falha

**Nota importante sobre HLS:** A URL `https://b-vz-7b95acb0-d42.tv.pandavideo.com.br/{id}/playlist.m3u8` pode exigir autenticação no Panda. Se o vídeo tem `duration=0` e nenhuma qualidade, o HLS provavelmente também falhará (o vídeo não foi processado). O fallback HLS funcionará para vídeos processados cujo iframe falha, mas não para vídeos corrompidos/não processados.

### Mudanças

| Arquivo | Ação |
|---------|------|
| `index.html` | Adicionar DNS prefetch + preconnect para domínios Panda |
| `src/components/cursos/PandaPlayer.tsx` | Reescrever com detecção de timeout, estado de erro, e fallback HLS |
| `src/components/cursos/HLSPlayer.tsx` | Novo componente HLS fallback usando `hls.js` dinâmico |
| `package.json` | Adicionar `hls.js` como dependência |

### Detalhes

**index.html** — Adicionar no `<head>`:
```html
<link rel="dns-prefetch" href="https://player-vz-7b95acb0-d42.tv.pandavideo.com.br" />
<link rel="dns-prefetch" href="https://b-vz-7b95acb0-d42.tv.pandavideo.com.br" />
<link rel="preconnect" href="https://player-vz-7b95acb0-d42.tv.pandavideo.com.br" crossorigin />
<link rel="preconnect" href="https://b-vz-7b95acb0-d42.tv.pandavideo.com.br" crossorigin />
```

**PandaPlayer.tsx** — Lógica:
1. Renderizar iframe Panda normalmente
2. Se após 15s não receber nenhum `postMessage` do player → ativar HLS fallback
3. Se iframe emitir erro → ativar HLS fallback
4. Manter todas as props existentes (`onProgress`, `onComplete`, `startAt`)
5. Mostrar indicador visual de "carregando" e "modo fallback"

**HLSPlayer.tsx** — Componente:
1. Import dinâmico de `hls.js` (não carrega se não for necessário)
2. Suporte nativo Safari/iOS via `canPlayType`
3. Auto-quality selection
4. Propagar `onProgress` e `onComplete` para manter compatibilidade com AulaPage
5. Estado de erro amigável se HLS também falhar

**Sem mudanças** na `AulaPage.tsx` — a interface do PandaPlayer permanece idêntica.

