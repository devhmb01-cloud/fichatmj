# Integração Vercel + Supabase — Ficha TMJ / Bazar

**Status em 2026-11-07:** contas Devhmb corretamente conectadas; Vercel original identificado; Supabase hospedado INACTIVE; módulo do bazar ainda em demonstração, sem persistência. **Nenhuma conexão nova foi implantada.**

## Ambiente confirmado (somente leitura)

- GitHub: `devhmb01-cloud/fichatmj`, branch de testes `feat/bazar-mvp-demo-20261107`. A branch `main` permanece como fonte da produção.
- Vercel: equipe **dev-hmb** (plano Hobby), projeto **fichatmj**, ID `prj_ERV1KDII1TMLAkmxeim4nfhfHBeH`, conectado ao GitHub acima.
- Implantação Vercel mais recente: **READY / production**, commit `bd146e79a616ce64fafc62088962eecc93dec73a` da `main`. Domínio do site existente: `fichatmj-wine.vercel.app`. O campo de projeto `live` retornou `false`, portanto não interpretar READY como comprovação de disponibilidade do site.
- Vercel possui, exclusivamente no alvo `production`, as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Os valores não foram descriptografados, expostos nem alterados.** Não foram encontradas implantações da branch de testes.
- Supabase: conexão **devhmb**, projeto `zcjiupytkgthaxitrttg`, região São Paulo (`sa-east-1`), estado **INACTIVE**. A inspeção das tabelas retornou “Database is possibly not accessible at the moment”. Não foi feita nenhuma alteração ou tentativa de recuperação. Não há branches remotas do Supabase.

## Impedimento atual

Não é possível validar o acesso do Bazar ao Supabase hospedado enquanto esse banco estiver inativo. O status **INACTIVE** pode ocorrer por pausa do plano gratuito; não há evidência suficiente para afirmar que este seja o motivo, nem que as variáveis Vercel apontem para esse projeto.

A documentação oficial explica que um projeto gratuito pausado pode ser retomado no painel, dentro das condições de restauração vigentes. Confirmar **custo adicional R$ 0** antes de qualquer recuperação ou criação de recurso. Referência: https://supabase.com/docs/guides/platform/free-project-pausing

## Procedimento seguro recomendado

1. No painel Supabase Devhmb, verificar se o projeto `zcjiupytkgthaxitrttg` possui a ação `Resume project`, conferir plano e condições. Restaurar somente depois de decisão explícita da organização, preservando possíveis registros de famílias.
2. Confirmar **sem expor os segredos** que URL e chave pública configuradas na Vercel pertencem ao projeto correto. Jamais colocar `service_role` ou segredo em `NEXT_PUBLIC_*`.
3. Para desenvolver o Bazar, usar **PGlite/Supabase local com dados sintéticos** e novas estruturas isoladas: saldo por preço, movimentos, vendas, itens e auditoria de reprecificações. Não reutilizar a tabela de famílias.
4. Proteger os novos dados por regras RLS e permissões próprias do Bazar, com testes de acesso indevido e garantia de que o registro de vendas é atômico/idempotente.
5. Quando existir um ambiente de testes remoto gratuito autorizado, configurar valores **somente na Preview/Development específica**, sem alterar as variáveis Production e sem disparar deploy involuntário.
6. Repetir os checks: lint, TypeScript, testes antigos de famílias, testes de bazar, build e teste mobile. Rever aplicação antes de qualquer publicação.

## Limites de operação

- **Não executar** deploy/Preview, merge, alteração de banco real, restauração do Supabase, migrações remotas ou uso de recursos pagos nesta fase.
- Não usar dados reais de famílias ou clientes nos testes.
- Preservar a `main`, o projeto Vercel em produção e as configurações existentes.
- O `vercel.json` da branch de teste contém bloqueio de implantação automática nessa branch; não remover sem autorização.
