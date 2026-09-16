# Entrega — segunda etapa do Ficha TMJ

## Implementado

- Login por email/senha, saída, verificação do usuário e do perfil de equipe.
- Proxy de renovação de sessão; páginas dinâmicas e autorização no servidor.
- Validação completa com Zod, normalização de campos condicionais e erros em português.
- Cadastro transacional de família, crianças e primeira observação, com repetição idempotente.
- Listagem de famílias com busca, situação e paginação.
- Ficha detalhada, observações e atualização de situação com detecção de conflitos.
- Totais reais no dashboard e relatório agregado quando o Supabase está configurado.
- Estados de carregamento, falha, acesso negado e demonstração sem persistência.
- Testes automatizados e workflow de qualidade no GitHub Actions.

## Verificação local

Lint, TypeScript e build aprovados. Testes de idade, validação do cadastro e componente React aprovados. No PGlite, as duas migrations foram executadas e testadas: bloqueio de anônimos/usuários sem perfil, permissões da equipe, autoria de notas, gravação transacional, rollback, quantidade de crianças e repetição sem duplicação.

A navegação de demonstração, a nova página de acesso e o formulário em largura de celular foram inspecionados no navegador integrado, sem erros de console observados. Os testes do formulário cobrem as três etapas, idades, geração de crianças, campos condicionais, conclusão local e estado de envio conectado com resposta simulada.

## Limites e ativação

Nenhum projeto Supabase foi selecionado para o Ficha TMJ. Não foram criados projetos, aplicadas migrations em nuvem, configuradas credenciais, criadas contas nem publicado um deploy Vercel. Login real, renovação de sessão e gravação via API ainda precisam de verificação ponta a ponta após a escolha do projeto e provisionamento dos usuários.

A aplicação continua em demonstração local. Para ativar, siga o README: configure URL/chave pública, aplique as duas migrations em ordem, crie os perfis autorizados e reinicie/republique a aplicação. Se a migration inicial já estiver aplicada, execute apenas a segunda.

Edição completa de cadastros, convites/recuperação de senha, auditoria de alterações, relatórios avançados e exportação Excel ficam para próximas etapas.
