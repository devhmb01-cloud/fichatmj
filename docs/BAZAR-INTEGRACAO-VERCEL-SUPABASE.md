# Ficha TMJ — integração funcional do Bazar (revisão de segurança)

Data: 2026-11-07
Status: **código de persistência implementado e testado em banco isolado; não ativado no site publicado**.

## Ambiente identificado

- **GitHub:** devhmb01-cloud/fichatmj; branch isolada feat/bazar-mvp-demo-20261107.
- **Vercel Devhmb:** projeto fichatmj, equipe dev-hmb, plano Hobby, produção ligada à branch main. Site: https://fichatmj-wine.vercel.app
- **Supabase Devhmb:** zcjiupytkgthaxitrttg, organização no plano Free, status ACTIVE_HEALTHY após a restauração anterior.
- **Produção Vercel:** variáveis públicas do Supabase registradas com conteúdo protegido; a correspondência de valores não foi comprovada, não foram copiadas chaves. Nenhuma variável de integração foi alterada.
- **Deploys:** não há deploy do branch Bazar; o vercel.json mantém git.deploymentEnabled[feat/bazar-mvp-demo-20261107] = false.

## Implementação criada na branch

- supabase/drafts/bazar_persistence.sql: **rascunho não aplicado**, com três tabelas comerciais exclusivas (bazar_inventory, bazar_movements e bazar_sales), todas com RLS e grants mínimos.
- Operações transacionais com RPC: entrada de peças por quantidade e preço, transferência de preços e venda com várias faixas. Todas exigem perfil staff/admin, incluem UUID de requisição para deduplicação e evitam estoque negativo.
- src/app/bazar/actions.ts: Server Actions para leitura e gravação, com validação e verificação de sessão; nenhuma chave privada em código ou navegador.
- src/components/bazar/bazar-demo-context.tsx: suporte à persistência real mediante opt-in, com UUID estável ao repetir uma operação incerta.
- Interface mobile: mantém a versão demonstrativa quando persistência está desativada. Modo conectado carrega saldos reais do banco, registra operações e informa erros.

**Feature flag:** a persistência só entra em funcionamento com \`BAZAR_PERSISTENCE_ENABLED=true\` em um ambiente configurado e após aplicar o esquema correspondente. Flag ausente = demonstração, sem qualquer escrita no Supabase.

## Testes realizados

- scripts/test-bazar-persistence.mjs executa o rascunho SQL num PGlite isolado com perfis fictícios. Verifica criação de tabelas, estoque inicial zero, entrada, reprecificação, venda idempotente, recusa de estoque negativo, rollback e restrições de acesso.
- Fluxos antigos do módulo de famílias preservados, com CI automatizado da branch.
- Teste no navegador mobile em modo demonstrativo. **Ainda falta um E2E conectado com Supabase Auth e API reais, em ambiente totalmente isolado.**

## Proteção de dados

- Nenhuma tabela, política ou dado das famílias foi modificado.
- O Bazar só guarda quantidades/preços, vendas, datas e UUID do responsável interno, sem cadastro de compradores nessa etapa.
- Não realizar testes com dados pessoais de famílias ou clientes.
- O banco real permanece inalterado. Não usar o projeto existente como ambiente de testes.

## Etapas restantes para ativação definitiva

1. Criar ou disponibilizar um ambiente de teste Supabase separado, sem cobrança; aplicar o rascunho SQL **somente no teste**, verificar grants, RLS, sessão real, RPCs e concorrência.
2. Gerar e revisar a migração oficial usando a CLI Supabase; não aplicar diretamente o rascunho em produção.
3. Confirmar qual projeto Supabase a produção Vercel utiliza (sem publicar ou copiar chaves).
4. Verificar custo adicional de R$ 0, testar backup/rollback e autorizar uma janela de lançamento.
5. Só então aplicar migração revisada, configurar a flag de persistência no destino autorizado e publicar a versão testada. Revalidar login, estoques, vendas e regressão de famílias.

**Não houve merge, deploy, Preview, migração remota, alteração de dados familiares ou compra de recursos pagos nesta etapa.**
