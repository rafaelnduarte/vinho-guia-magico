

## Analise: Duas questões distintas

### 1. Profile Assignment — Erro 500 do Panda

Os logs mostram consistentemente:
```
status=500 body={"errCode":"InternalServerError","errMsg":"InternalError","detail":"Error to update videos profiles"}
```

Os campos `profile` e `videos` estão corretos. O 500 é um erro interno do Panda. Possíveis causas:
- O valor de `PANDA_PROFILE_ID` está incorreto ou o profile foi deletado no painel Panda
- A API Key não tem permissão para esse profile
- Bug temporário da API Panda

**Ação necessária do seu lado**: Verificar no painel do Panda Video se o Profile ID configurado em `PANDA_PROFILE_ID` existe e está ativo. Listar os profiles disponíveis:
```
GET https://api-v2.pandavideo.com.br/profile/
Authorization: <PANDA_API_KEY>
```

### 2. Vídeo falha ao carregar — Provável causa: Token JWT

Os logs do `panda-token` confirmam que o JWT é gerado com sucesso. Porém, o parâmetro `token` no player do Panda é especificamente para **Watermark Groups (DRM)**, não para autenticação genérica.

Se a conta não tem watermark habilitado, ou se o `PANDA_SECRET_KEY` não corresponde a um watermark group configurado, o player rejeita o token e mostra "This video encountered an error".

### Plano proposto

**Testar primeiro sem token**: Modificar o `PandaPlayer.tsx` para NÃO enviar o `token` na URL do iframe. Se os vídeos voltarem a funcionar, confirma que o token é a causa.

| Arquivo | Mudança |
|---------|---------|
| `src/components/cursos/PandaPlayer.tsx` | Remover fetch do token e o parâmetro `token` da URL. Simplificar para carregar o iframe direto, sem JWT. Remover loading state do token. |

O componente voltará a ser simples:
```typescript
const src = `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?v=${pandaVideoId}&autoplay=false&loop=false&playsinline=true${startAt > 0 ? `&start=${Math.floor(startAt)}` : ''}`;
```

Se os vídeos funcionarem sem token, o próximo passo seria configurar corretamente o Watermark Group no painel Panda e usar o secret correto desse grupo.

