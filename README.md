# Ficha TMJ

Plataforma web para cadastro e acompanhamento de famílias atendidas por uma organização. Esta entrega é uma base visual funcional: os dados do formulário ficam **somente na memória da página**, sem envio, localStorage, cookies de cadastro ou persistência. Use apenas dados fictícios. Sair ou recarregar descarta o preenchimento.

## Tecnologias e requisitos

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, ESLint, Supabase/PostgreSQL e preparação para Supabase Auth. Node.js 22.16+ e npm 10+. Vercel é o destino de hospedagem previsto; Excel será somente uma exportação futura.

## Instalação e execução

```sh
git clone https://github.com/devhmb01-cloud/fichatmj.git
cd fichatmj
npm install
npm run dev
```

Abra http://localhost:3000. As rotas são `/`, `/familias`, `/novo` e `/relatorios`. O build e o desenvolvimento usam Webpack.

```sh
npm run lint
npm run typecheck
npm run build
npm start
npm run test:db
```

O último comando verifica a migration em PostgreSQL embutido (PGlite), com um mock mínimo de `auth.users` e `auth.uid()`. Não substitui testes de integração no Supabase real.

## Configuração do ambiente

Copie `.env.example` para `.env.local`. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a partir do painel do projeto. `NEXT_PUBLIC_SUPABASE_ANON_KEY` é uma alternativa legada. Não é necessário preencher nada para usar a prévia.

Os clientes em `src/lib/supabase` retornam `null` sem configuração e não são chamados pelo formulário. Nunca use `service_role` ou uma secret key em variáveis `NEXT_PUBLIC_`. `.env*` está ignorado, exceto `.env.example` vazio.

## Estrutura

```text
src/
  app/
    page.tsx                 Dashboard
    layout.tsx               Layout e metadados
    globals.css              Tema responsivo
    familias/page.tsx        Estado inicial da listagem
    novo/page.tsx            Cadastro
    relatorios/page.tsx      Relatórios futuros
  components/
    app-shell.tsx            Navegação compartilhada
    family-form.tsx          Formulário de três etapas
  lib/
    date.ts                  Datas e cálculo de idade
    supabase/client.ts       Cliente de navegador opcional
    supabase/server.ts       Cliente para Actions/Route Handlers
supabase/migrations/         Schema e políticas RLS
scripts/                     Verificação do banco
```

## Formulário

Responsável familiar, crianças e acompanhamento. Quantidade de filhos gera fichas individuais (0–30 nesta prévia). Alterar temporariamente a quantidade preserva as fichas em memória para evitar perdas acidentais; somente a quantidade selecionada é exibida. Campos de moradia, saúde, tratamento, fraldas e escola são condicionais. Desmarcar uma condição limpa seus detalhes. Idades são calculadas por data civil, sem converter nascimento para UTC. Datas de cadastro/modificação são geradas na primeira alteração e nas alterações seguintes; o banco será a autoridade desses timestamps na integração.

Há validação de obrigatórios, email, CEP, datas futuras e total de trabalhadores. A conclusão mostra explicitamente que nenhum dado foi salvo. Dashboard e relatórios não exibem dados inventados.

## Supabase e migrations

1. Crie um projeto Supabase administrado pela organização.
2. No SQL Editor de um projeto novo, execute o arquivo `supabase/migrations/20260916204009_initial_schema.sql` completo. A migration usa uma transação. Não reexecute sobre tabelas já criadas.
3. Alternativamente, use a CLI instalada: consulte `npx supabase --help`, configure o projeto e confira `npx supabase db push --help` antes de aplicar migrations por CLI. Escolha um fluxo; aplicação manual não registra automaticamente o histórico da CLI.
4. Configure Supabase Auth com acesso por convite e desative cadastro público/anônimo. Crie os usuários autorizados no painel e provisione cada registro em `profiles` administrativamente usando o UUID de `auth.users`. Não há criação automática de perfis pela aplicação.
5. Teste as políticas com usuários de cada papel antes de conectar dados reais.

Tabelas: `profiles`, `families`, `children`, `family_notes`. UUIDs, FKs, índices, constraints, timestamps e triggers de atualização estão incluídos. `number_of_children` é a quantidade declarada; a futura operação transacional de cadastro deverá manter a relação com as fichas de crianças.

### Modelo de acesso inicial

Uma única organização, com equipe explicitamente autorizada. `viewer` lê as famílias, crianças e notas; `staff` e `admin` também cadastram e alteram famílias/crianças e inserem notas. Qualquer usuário sem perfil, inclusive um cadastro Auth isolado, não acessa dados familiares. Usuários anônimos não possuem privilégios nas quatro tabelas. Perfis são somente leitura do próprio usuário; ninguém muda o próprio papel via API. Exclusão pela API, edição de notas e administração de perfis ficam bloqueadas. Não há função SECURITY DEFINER.

Todos os membros provisionados têm acesso à organização inteira. Defina escopos por equipe/família antes de adotar uma operação com múltiplas organizações. A autenticação, renovação de sessão via proxy, autorização de rotas e gravação no servidor ainda precisam ser implementadas. O helper de servidor deve ser usado em contextos que permitem escrever cookies.

## Dados sensíveis e LGPD

Antes de operação real, a organização deve definir finalidade, base legal, transparência, retenção, atendimento de direitos e responsáveis por acesso. Restrinja informações de saúde ao necessário. Não registre conteúdo de formulários em logs, telemetria, URLs ou relatórios públicos. Planeje auditoria, backups e testes de restauração, exclusão controlada, proteção das exportações e revisão periódica de permissões. RLS é uma camada de segurança, não uma implementação completa de conformidade.

## Vercel

Importe o repositório na Vercel com preset Next.js, raiz do repositório, instalação `npm ci` e build `npm run build`. Não há credenciais ou deploy criado nesta entrega. Configure as variáveis por ambiente e implemente autenticação/autorização antes de usar dados reais. A prévia funciona sem Supabase.

## Próximos passos

- Login por convite, sessão segura e proteção das rotas.
- Validação no servidor e cadastro transacional com tratamento de erros.
- Listagem, busca, edição e histórico de acompanhamento.
- Testes no Supabase real e revisão das permissões com a organização.
- Relatórios e exportação Excel com acesso restrito.
- Publicação na Vercel e operação monitorada.
