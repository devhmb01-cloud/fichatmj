# Ficha TMJ — Módulo Alimentos & Cestas

Implementação na branch `feat/alimentos-cestas-20261107` derivada do MVP do Bazar. **Sem merge, deploy ou alterações em bancos hospedados** nesta entrega.

## Telas e fluxos

1. `/alimentos`: visão geral, cestas completas possíveis, meses estimados, famílias atendidas e lista de prioridades por menor cobertura.
2. `/alimentos/estoque`: cadastro de produtos por embalagem e entrada de doações/recebimentos.
3. `/alimentos/cesta`: composição por embalagem de uma cesta padrão e meta configurável de famílias por mês.
4. `/alimentos/entregas`: selecionar família por **código** e confirmar entrega, baixando a cesta do estoque com snapshot imutável.

Demonstração inicial: alimentos, quantidades e famílias **inteiramente fictícios**; os dados se perdem ao recarregar. Nunca use dados reais na versão demonstrativa.

## Indicadores e premissas

- `cestas possíveis = min(floor(estoque[item] / quantidade[item] por cesta))` considerando somente itens com quantidade por cesta positiva.
- `meses de cobertura = cestas possíveis / famílias atendidas por mês`.
- `falta para o próximo mês = max(0, famílias/mês × unidades por cesta − estoque)`.
- Ranking ordenado pelos **menores meses de cobertura**, destacando os itens que interrompem a montagem da cesta.
- Caso nenhum alimento esteja incluído na cesta, não há estimativa de meses (exibe `—`).
- A projeção não inclui validade, sazonalidade, itens perdidos, famílias com cestas diferentes nem doações futuras. Para operação real, configurar a meta mensal com a equipe da ONG.

**Exemplo fictício:** 40 famílias/mês, leite 45 caixas e 2 por cesta => apenas 22 cestas completas, cerca de 0,6 mês, mesmo que haja arroz para 90.

## Segurança e persistência futura

- `supabase/drafts/food_pantry.sql` é um **rascunho, não aplicado em produção ou staging remoto**. Cria apenas tabelas `food_*`, com RLS para perfis `staff`/`admin`, leitura mínima e RPCs transacionais para escrita.
- `food_distributions.family_id` referencia `public.families(id)`; não duplica nome, endereço, saúde ou outros dados sensíveis. A tela usa somente `family_code` e ID técnico, nunca informações de contato.
- Históricos auditáveis: entrada de estoque, alteração de cesta, alteração de meta e distribuição. Operações financeiras não envolvidas.
- Operações usam UUID de requisição para idempotência. Uma cesta mensal por família; duplicidade ou estoque insuficiente bloqueia a operação inteira.
- O banco conectado só é usado se `FOOD_PERSISTENCE_ENABLED=true` e a migração for aplicada **no ambiente autorizado**, com conta autenticada `staff`/`admin`. Flag ausente => demo em memória.
- Funções `SECURITY DEFINER` só são executáveis pelo papel `authenticated` e revalidam `auth.uid()` contra perfis de equipe. Revisar com os avisos do linter de segurança antes de qualquer publicação.
- **Não** habilitar essa flag na produção, não aplicar a migração ao projeto social e não colocar chaves secretas no frontend sem nova autorização explícita.

## Testes da branch

- `node --experimental-strip-types --test scripts/test-alimentos.mjs` — regras de cobertura, estoque, cadastro, distribuição e duplicidade.
- `node scripts/test-alimentos-db.mjs` — projeto isolado PGlite, RLS, RPCs e concorrência lógica.
- GitHub Actions `.github/workflows/alimentos-quality.yml`: npm ci, regras, banco isolado, lint, TypeScript, testes antigos do módulo famílias, build e Playwright mobile. Nenhuma etapa de deployment.

## Próxima ativação segura

1. Revisar com a equipe se todos recebem a mesma cesta e quantas famílias são atendidas em cada ciclo.
2. Validar a apresentação dos indicadores e o fluxo de seleção das famílias usando dados sintéticos.
3. Preparar uma migração oficial revisada e fazer um teste remoto **somente no Supabase separado de staging**, com dados e famílias sintéticos.
4. Configurar a flag somente em ambiente Preview isolado e protegido, nunca em production sem aprovação.
5. Após homologação e autorização específica, decidir publicação e estratégia de backup/auditoria sem afetar o cadastro das famílias.
