# Entrega — edição de famílias

Na ficha, **Editar família** abre os dados atuais da mãe/responsável, filhos e demais membros. A equipe pode corrigir dados, adicionar filhos ou outros parentes e registrar saúde/tratamento, escola, profissão/trabalho e situação no domicílio (mora, não mora, falecido ou não informado). Saída da casa e falecimento preservam a ficha do membro. A observação opcional é acrescentada ao acompanhamento sem alterar notas anteriores.

A função edit_family salva tudo em uma transação com SECURITY INVOKER e autorização por perfil. Conserva os IDs, rejeita omissão de membros existentes, IDs duplicados e apropriação de membro de outra família. O controle de versão impede sobrescrita de edição concorrente, inclusive após mudanças diretas nos membros. Uma falha preserva o rascunho no formulário. Totais de moradores e trabalhadores são revisados manualmente.

## Verificação

- Lint, TypeScript, build e toda a suíte de testes aprovados.
- Componente: carregamento, edição da mãe/filho, inclusão de filho/parente, validação, falha com rascunho preservado e sucesso.
- PGlite: permissões, integridade, conservação de IDs, rollback, inclusão, mudança de situação, rejeição de conflitos e de IDs de outra família.
- Supabase real: migration aplicada, RLS habilitado, acesso anônimo negado. Um teste com dados fictícios executou cadastro e edição sob papel authenticated; a transação foi revertida integralmente.
- Navegador autenticado: botão e tela de edição carregam os dados atuais. Nenhum erro de console observado. Os registros existentes não foram alterados para testar.

## Estado do ambiente

Supabase conectado; administrador provisionado. O arquivo de ambiente permanece ignorado pelo Git, usando chave pública. O README registra a correspondência entre versões locais e remotas das migrations para evitar reaplicação pelo CLI.

O advisor não apontou problemas de tabelas/RLS; informou que a [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) está desabilitada no Auth. Essa configuração não foi modificada nesta entrega.

Não houve deploy Vercel. Auditoria automática dos valores anteriores, convites/recuperação de senha, relatórios avançados e exportação continuam pendentes.
