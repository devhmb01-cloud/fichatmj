# Integração funcional do Bazar — Ficha TMJ

Atualizado em 2026-11-07. Estado: **ativado somente no ambiente Preview + Supabase de testes**. A produção permanece intacta.

## Ambientes

| Item | Produção (preservada) | Testes (isolado) |
| --- | --- | --- |
| GitHub | `main` no SHA `bd146e79a616ce64fafc62088962eecc93dec73a` | `feat/bazar-mvp-demo-20261107` |
| Supabase | `zcjiupytkgthaxitrttg` | `liuuptgcdvpevkyfienb` |
| Banco | Cinco tabelas sociais já existentes | As cinco tabelas da estrutura e três tabelas do Bazar, **sem dados reais** |
| Vercel | `fichatmj-wine.vercel.app` | `https://fichatmj-nc5ecplw6-dev-hmb.vercel.app` |
| Persistência do Bazar | Não habilitada | `BAZAR_PERSISTENCE_ENABLED=true` na Preview da branch |
| Deploy | Versão anterior, sem alteração | Preview manual do commit `11d76cd940e1da99f3e0926f7df12ef332b414b0`, READY |

Ambos os projetos Supabase foram verificados como `ACTIVE_HEALTHY`. A conta Supabase Devhmb está no plano Free. O projeto de testes recebeu orçamento confirmado de **US$ 0/mês** na criação. A Vercel Devhmb usa plano Hobby; nenhuma contratação de recurso pago foi realizada.

A URL e a publishable key do **banco de testes**, e a feature flag, foram configuradas somente no destino **Preview** e exclusivamente para a branch do Bazar. Nenhuma chave foi gravada no repositório ou copiada da produção. A Vercel protege o Preview com autenticação de equipe (SSO).

## Banco de testes preparado

Foram aplicadas quatro migrações **exclusivamente no banco de testes**:

1. Esquema original de perfis e famílias, sem registros pessoais;
2. Fluxo de cadastro de famílias;
3. Fluxo de edição de famílias;
4. `supabase/drafts/bazar_persistence.sql`, com `bazar_inventory`, `bazar_movements` e `bazar_sales`.

O estoque do Bazar começa zerado. Perfis **sintéticos** de equipe e visualizador foram cadastrados no banco de testes para validar autorização; esses registros **não foram criados via Supabase Auth Admin e não são contas prontas para login interativo**.

## Resultados verificados

- Script de testes em PGlite do próprio projeto passou no GitHub Actions (SHA `11d76cd`).
- No Supabase de testes foram validados entrada de 8 peças a R$ 5, deduplicação da entrada, reprecificação de 3 peças para R$ 10, venda de duas peças a R$ 5 e uma a R$ 10, deduplicação da venda, bloqueio de estoque insuficiente e recusa de escrita para perfil visualizador.
- Resultado da operação no banco de testes: **5 peças, 1 venda, R$ 20** (todos fictícios).
- Teste de permissões efetivas com `SET LOCAL ROLE`: leitura de estoque por membro visualizador permitida; escrita pelo visualizador negada; acesso anônimo negado. Esse teste simula o contexto JWT no banco e **não equivale ao login real pela API de Auth**.
- RLS habilitado nas oito tabelas do banco de testes.
- Vercel Preview: build do Next.js concluído, implantação **READY**, rotas do Bazar geradas.
- Segurança: Supabase emitiu advertência sobre funções `SECURITY DEFINER` executáveis por usuários autenticados e sobre proteção de senhas vazadas desativada. O corpo das RPCs valida perfil staff/admin; ainda requer revisão antes da liberação para produção.

## Limitações e próximos passos

- **E2E da sessão de usuário real não executado**: criar uma conta fictícia com o Supabase Auth (via interface oficial), provisionar seu registro na tabela `profiles` com perfil staff de testes e validar login, entrada e venda pela URL Preview.
- Validar a API e a autenticação no navegador; revisar eventuais falhas e logs, e repetir testes de autorização (usuário não autorizado, visualizador e staff).
- A interface exibe receitas com base nas últimas 1.000 vendas consultadas; um relatório financeiro completo exige agregação específica.
- Revisar o draft SQL para uma migração oficial e documentação de recuperação/backup antes de produção.
- Supabase Free pode pausar por inatividade. Manter o projeto de testes sem dados reais.
- **Não aplicar migrações no Supabase da ONG, não ativar a flag no destino Production, não copiar dados sociais, não fazer merge, deploy de produção nem contratar recursos pagos sem nova autorização explícita.**

## Links

- Vercel Preview: https://fichatmj-nc5ecplw6-dev-hmb.vercel.app/bazar
- Supabase de testes: https://supabase.com/dashboard/project/liuuptgcdvpevkyfienb
- Supabase original: https://supabase.com/dashboard/project/zcjiupytkgthaxitrttg
