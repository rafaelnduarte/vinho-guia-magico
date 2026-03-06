

## Diagnóstico

O problema está **100% identificado**. Todos os webhooks da Hubla estão falhando com `no_email_found` — visível nos logs do `webhook_logs`.

**Causa raiz:** O código extrai os dados do usuário usando campos que não existem no payload real da Hubla:

```text
// O código atual espera:
event.userEmail        → NÃO EXISTE
event.userName         → NÃO EXISTE
event.subscriptionId   → NÃO EXISTE
event.productName      → NÃO EXISTE

// O payload real da Hubla tem:
event.user.email                    → "dargham.lucas@gmail.com"
event.user.firstName / lastName     → "Lucas" / "Simionato"
event.subscription.id               → "2c935e8e-..."
event.subscription.payer.email      → (fallback)
event.product.name                  → "Comunidade do Jovem"
```

Os campos estão aninhados um nível mais fundo do que o código espera. Por isso, `email` é sempre `undefined`, e o webhook retorna `no_email` sem criar nenhum usuário.

## Correção

Alterar a extração de dados na edge function `hubla-webhook/index.ts` (linhas 124-131) para acessar os caminhos corretos do payload Hubla v2:

- **Email**: `event.user?.email ?? event.subscription?.payer?.email ?? event.invoice?.payer?.email`
- **Nome**: `event.user?.firstName + " " + event.user?.lastName` (com fallbacks)
- **External ID**: `event.subscription?.id ?? event.invoice?.id`
- **Product name**: `event.product?.name ?? event.products?.[0]?.name`

Também vou adicionar um log de debug que registra os caminhos disponíveis no payload quando o email não é encontrado, para facilitar troubleshooting futuro.

Após a correção, os webhooks pendentes que já foram registrados como `no_email_found` precisarão ser reprocessados manualmente (ou novas compras serão processadas automaticamente).

