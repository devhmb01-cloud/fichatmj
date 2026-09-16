# Ficha TMJ

Plataforma web para cadastro e acompanhamento de famílias atendidas por uma organização.

## Funcionalidades

- Dashboard com totais reais no modo conectado.
- Login por email/senha para usuários previamente autorizados e saída da sessão.
- Proteção de rotas e operações no servidor, renovação de sessão e RLS.
- Cadastro em três etapas: responsável, crianças e acompanhamento.
- Crianças dinâmicas, campos condicionais e cálculo automático de idade.
- Gravação transacional de família, crianças e primeira observação. Uma repetição do mesmo envio não duplica o cadastro.
- Busca por responsável, filtro por situação e paginação de 20 famílias.
- Ficha detalhada, alteração da situação e inclusão de observações.
- Detecção de alterações simultâneas ao atualizar a situação.
- Relatório agregado por situação. Exportação Excel fica para uma próxima etapa.

## Dois modos de execução

**Demonstração:** sem URL e chave Supabase, o formulário funciona somente em memória, sem enviar ou persistir cadastros. Use apenas dados fictícios. Sair ou recarregar descarta o preenchimento. A tela de login explica que a integração ainda não está configurada.

**Conectado:** com as duas variáveis configuradas, exige autenticação e perfil de equipe. O formulário passa a salvar no Supabase e as páginas consultam os registros protegidos por RLS. Configuração parcial resulta em erro; ela não ativa uma demonstração silenciosa. Falhas de acesso/banco não geram números fictícios nem abrem acesso público.

## Tecnologias e requisitos

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase/PostgreSQL, Supabase Auth e Zod. Node.js 22.16+ e npm 10+. ESLint, Prettier, Testing Library/JSDOM e PGlite para qualidade. Vercel é a hospedagem prevista; Excel não é o banco de dados.

```sh
git clone https://github.com/devhmb01-cloud/fichatmj.git
cd fichatmj
npm ci
npm run dev
```

Abra http://localhost:3000. Desenvolvimento e build usam Webpack.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Testes individuais: `test:date`, `test:registration`, `test:form` e `test:db`. Os testes do componente usam JSDOM e simulam a resposta do servidor; o banco é PostgreSQL embutido com mocks mínimos de Auth. Eles não substituem testes com o Supabase real. O GitHub Actions executa os checks em pushes para main e pull requests.

## Ambiente e Supabase

1. Escolha ou crie um projeto Supabase específico para a organização. Esta entrega não configura projetos remotos automaticamente.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A chave legada `NEXT_PUBLIC_SUPABASE_ANON_KEY` é alternativa à publishable key.
3. Nunca use `service_role` ou secret key no frontend. Não envie `.env.local` ao Git. O exemplo contém somente variáveis vazias.
4. Aplique as duas migrations, em ordem, no SQL Editor de um projeto novo:
   - `supabase/migrations/20260916204009_initial_schema.sql`
   - `supabase/migrations/20260916205702_family_registration.sql`
5. Se a primeira migration já foi aplicada, execute somente a segunda. Não reexecute arquivos sobre objetos existentes.
6. Alternativamente, configure a CLI instalada. Consulte `npx supabase --help` e `npx supabase db push --help` antes de aplicar por CLI. Aplicação pelo SQL Editor não registra automaticamente o histórico da CLI; escolha um fluxo e reconcilie o histórico antes de alternar.
7. Em Auth, desative cadastro público e login anônimo. Provisione contas da equipe pelo painel, com email confirmado e senha definida por um fluxo administrativo seguro. O app não tem cadastro público nem recuperação de senha; a administração deve cuidar desses fluxos nesta etapa.
8. Para cada conta, crie administrativamente um registro em `public.profiles`, com `id` igual ao UUID de `auth.users`, `full_name` e `role` (`admin`, `staff` ou `viewer`). Não há autopromoção pelo aplicativo.
9. Reinicie o servidor após configurar as variáveis. Em hospedagem, faça um novo deploy.
10. Confira login, expiração de sessão, bloqueio de usuário sem perfil e operações com cada papel no projeto real antes de iniciar operação.

## Segurança e modelo de acesso

Uma organização por banco. Todos os perfis provisionados têm acesso aos dados da organização inteira. `viewer` lê; `staff` e `admin` cadastram/atualizam famílias e crianças e inserem notas. Um usuário Auth sem perfil não acessa os dados familiares. Anônimos não têm privilégios nas tabelas ou na função de cadastro.

Cada página e Server Action exige usuário verificado e consulta o perfil no banco. A interface é uma conveniência; a autorização também ocorre no servidor e no PostgreSQL. O proxy renova a sessão, as páginas são dinâmicas e as respostas protegidas não podem ser compartilhadas em cache. Credenciais e dados de formulários não são registrados em logs da aplicação.

As tabelas têm UUIDs, FKs, índices, constraints, timestamps e RLS. A função `register_family` é SECURITY INVOKER: mantém as permissões do usuário, não utiliza service role e executa tudo na mesma transação. O identificador de requisição evita duplicação em novas tentativas. Caso a resposta seja perdida, tente novamente na mesma tela; recarregá-la descarta esse identificador.

A validação compartilhada é executada novamente no servidor e permite somente campos conhecidos. Campos ocultos são normalizados para nulo. Timestamps são definidos no banco. A atualização de situação verifica `updated_at` para evitar sobrescrever uma alteração concorrente. Notas guardam a autoria, não podem ser editadas ou excluídas pela API e exibem até as 50 mais recentes. Exclusão de famílias e administração de perfis seguem bloqueadas na API.

A quantidade declarada de filhos e as fichas são consistentes no cadastro transacional. Alterações administrativas diretas no banco devem manter essa relação. A futura edição completa de cadastros deverá usar outra operação transacional.

## Estrutura

```text
src/
  app/
    page.tsx                  Dashboard
    layout.tsx                Layout dinâmico, sem cache compartilhado
    login/                    Página e ações de sessão
    acesso-negado/            Aviso de permissão insuficiente
    familias/
      page.tsx                Listagem
      actions.ts              Busca autenticada
      [id]/                   Ficha, notas e atualização de situação
    novo/                     Formulário e ação de cadastro
    relatorios/               Indicadores agregados
    error.tsx / loading.tsx   Estados de erro e carregamento
  components/                 Navegação e formulários
  lib/
    auth.ts                   Usuário verificado e autorização
    date.ts                   Datas e idade
    families/                 Validação, tipos e consultas
    supabase/                 Configuração e clientes
  proxy.ts                    Renovação de sessão e proteção inicial
supabase/migrations/          Schema, RLS e cadastro transacional
scripts/                      Testes automatizados
.github/workflows/quality.yml Verificação contínua
```

## Dados sensíveis

A organização deve definir finalidade, base legal, transparência, retenção, atendimento de direitos e responsáveis pelo acesso antes de operação real. Restrinja dados de saúde ao necessário, revise os papéis autorizados e configure backups/restauração. Não publique exportações nem registre formulários em telemetria. A busca não coloca o nome pesquisado na URL de navegação. RLS e autenticação não representam conformidade completa com a LGPD.

## Vercel e próximos passos

Importe o repositório com preset Next.js, instalação `npm ci`, build `npm run build` e raiz do repositório. Configure variáveis por ambiente. Não houve deploy nesta etapa.

Pendências: definir o projeto Supabase e provisionar a equipe; validar Auth/API e sessões de ponta a ponta com o banco real; edição completa de cadastros; recuperação de senha/convites; auditoria de alterações; relatórios avançados e Excel; política operacional de retenção; publicação e monitoramento na Vercel.
