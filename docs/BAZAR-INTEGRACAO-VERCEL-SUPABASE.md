# Integração Vercel + Supabase — Bazar (ambiente isolado)

Status: **planejamento validado, conexões da aplicação ainda NÃO ativadas**.
Data: 2026-11-07. Não utilizar dados pessoais reais neste estágio.

## Diagnóstico somente em leitura

- O conector Supabase **devhmb** está disponível. O único projeto listado nessa conta está **INACTIVE**. Não foi reativado e não foi usada nenhuma tabela de produção.
- A conexão Vercel disponível é da conta/time **GUKH7** em plano Hobby. O projeto com nome **fichatmj** ali está sem domínio, implantação ou ligação Git registrada e sem variáveis de ambiente. O repositório `devhmb01-cloud/fichatmj` não apareceu entre os repositórios acessíveis à conexão Vercel.
- O repositório GitHub **devhmb01-cloud/fichatmj** possui branch de teste `feat/bazar-mvp-demo-20261107` com o MVP do Bazar em memória, sem gravações no Supabase.
- O arquivo `vercel.json` dessa branch desabilita seu deployment automático. Não remover essa restrição sem autorização expressa.

## Próximas ações, antes de qualquer conexão remota

1. **Confirmar o proprietário da implantação original**: verificar no painel Vercel qual time controla a aplicação existente, seu projeto/dominio e vínculo Git. Não criar outro projeto de mesmo nome nem usar `create_git_project`: essa ação pode iniciar deploy automático.
2. **Confirmar o papel do projeto Supabase inativo**: ele pode conter os dados das famílias. Não reativar, aplicar migrações, inserir dados, nem vinculá-lo como staging sem avaliação explícita.
3. **Ambiente de teste gratuito e isolado**: usar Supabase local com dados sintéticos (preferível); projeto remoto de testes apenas se houver vaga no plano gratuito, sem cobrança, e autorização para a criação.
4. **Separar variáveis de ambiente**: quando houver banco de teste, configurar URL e chave pública/publishable apenas no destino de desenvolvimento/preview autorizado, nunca registrar chaves em Git. A `service_role` não deve ir para o navegador.
5. **Modelar e testar controle do Bazar**: entrada por quantidade e preço, reprecificação como transferência, venda atômica e bloqueio de estoque negativo. Tabelas comerciais com RLS e autorização específica, sem conceder a todos os operadores acesso às famílias.
6. **Conferir gates**: lint, types, testes de estoque/venda, testes existentes das famílias, build e smoke mobile. Primeiro testar com Supabase local; não alterar a instância real da ONG.
7. **Publicação**: depende de nova autorização expressa. Vincular um projeto da Vercel ao Git pode provocar deploy; não fazer isso por consequência implícita deste documento.

## Requisitos de segurança

- Manter módulo de famílias e políticas existentes intactos.
- Registros de compradores, se implementados, serão opcionais e não poderão reutilizar contatos das famílias; exigir consentimento granular para mensagens.
- Não contratar recursos pagos, não executar deploy/Preview, não fazer merge nem migrar banco real.
- Em caso de dúvida sobre Vercel ou Supabase de produção, interromper alterações remotas.
