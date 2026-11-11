# Conferência de validade de lotes antigos — ambiente de testes

Este incremento complementa `food_expiry_lots.sql`. Seu propósito é permitir preencher **apenas** datas ainda desconhecidas em lotes com saldo positivo, sem alterar contagens, baixas ou histórico de famílias.

- A data informada deve corresponder à embalagem real; aceita vencimentos passados, pois servem para impedir distribuição inadvertida de produtos vencidos
- Cada correção é única e auditada com usuário, lote, data e horário
- Não altera a validade de lotes que já possuem data; casos desse tipo exigem outro processo de correção auditada
- Não registra perdas automaticamente. Produtos vencidos deixam de contar para cestas, mas permanecem no saldo bruto até um descarte registrado
- A operação é idempotente e limitada a equipe staff/admin; RLS limita leitura do histórico
- Dados anteriores da ONG, ambiente Production da Vercel e banco original não fazem parte da implantação

Validar com `node scripts/test-alimentos-validade-update-db.mjs` em PGlite; aplicar somente ao Supabase staging após CI verde.
