# MVP Bazar — versão de demonstração

Esta entrega acrescenta três telas móveis ao Ficha TMJ: `/bazar` (painel), `/bazar/estoque` (lotes por preço e reprecificação) e `/bazar/vendas` (caixa rápido).

## Garantias desta versão

- Todos os números iniciais são explicitamente **fictícios**.
- Não existe qualquer leitura ou gravação no Supabase pelo módulo de bazar.
- O estado da simulação existe apenas em memória e **reinicia ao recarregar**.
- Não há captura de nome, telefone ou dados de compradores neste MVP.
- Não há alteração de tabelas, migrations, infraestrutura ou deploy.
- Todas as telas do módulo chamam `requireTeam()` no layout. Em ambiente conectado, exige sessão de equipe; no modo demo já previsto pelo Ficha TMJ, permite testes sem persistência.

## Preços do teste

R$ 2, R$ 5, R$ 8, R$ 10, R$ 12, R$ 15, R$ 30 e R$ 60. A lista é fixa apenas nesta versão; não representa um catálogo oficial aprovado pela ONG.

## Como validar

1. Aplicar esta mudança em uma branch isolada, sem Vercel Preview ou deploy.
2. Instalar as dependências do repositório original com `npm ci`, se possível em ambiente local.
3. Rodar `node --experimental-strip-types --test scripts/test-bazar.mjs` e depois `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
4. Iniciar `npm run dev` sem credenciais de Supabase para visualizar somente dados fictícios.
5. Visitar `/bazar` e verificar o total de peças; em `/bazar/estoque`, adicionar um lote e reprecificar; em `/bazar/vendas`, vender duas peças de R$ 5 e uma de R$ 15 (total R$ 25).
6. Verificar que o painel reflete a venda e que recarregar reinicia todos os dados.
7. Confirmar que o módulo de famílias permanece intocado e que nenhuma chamada de rede transmite dados do bazar.

## Limites conhecidos

- Sem persistência e sem uso multiusuário; não é um caixa de produção.
- Não trata pagamentos, estornos, descontos, perdas ou devoluções.
- Não há acompanhamento por categoria top/bottom: o estoque é somente por preço, reduzindo o trabalho dos voluntários.
- Não há inventário real, cadastro de compradores ou política de privacidade implementados.
- A liberação para uso real exigirá desenho dos papéis de acesso e uma base de dados separada, com RLS validado.
