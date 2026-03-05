

## Diagnóstico

O problema é que o domínio de email `notify.jovemdovinho.com.br` (ou `jovemdovinho.com.br`) ainda está com status **"initiated" / "Pending"** — a verificação DNS nunca foi concluída. Por isso, o sistema de email customizado não está ativo e os emails caem no fallback padrão ("auth-lovable").

O código da edge function `auth-email-hook` está correto e bem configurado. O problema não é de código, é de DNS.

## O que precisa acontecer

1. **Completar a verificação DNS do domínio de email** — Os registros DNS necessários (geralmente CNAME/TXT para verificação e SPF/DKIM) precisam ser adicionados no provedor de DNS do domínio `jovemdovinho.com.br`. Sem isso, o sistema não autoriza o envio pelo domínio customizado.

2. **Verificar/corrigir o subdomínio configurado** — O edge function usa `notify.jovemdovinho.com.br` como sender domain, mas o domínio registrado no workspace é `jovemdovinho.com.br` (sem o prefixo `notify`). Pode haver uma inconsistência que precisa ser resolvida na configuração.

3. **Redeployar a edge function** após a verificação DNS estar completa, para garantir que a versão mais recente está ativa.

## Próximo passo

Abra as configurações de email para verificar os registros DNS pendentes e completar a configuração do domínio. Os registros necessários estarão listados lá.

<lov-actions>
<lov-open-email-setup>Configurar domínio de email</lov-open-email-setup>
</lov-actions>

