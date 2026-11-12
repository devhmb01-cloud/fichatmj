/**
 * Modelo puro do MVP demonstrativo do bazar.
 * Nenhuma função faz chamadas à rede, banco de dados ou armazenamento persistente.
 */
export const BAZAR_PRICES = [2, 5, 8, 10, 12, 15, 30, 60] as const;
export type BazarPrice = (typeof BAZAR_PRICES)[number];
export type BazarStock = Record<BazarPrice, number>;
export type BazarCart = Partial<Record<BazarPrice, number>>;
export type BazarSale = {
  id: string;
  createdAt: string;
  lines: { price: BazarPrice; quantity: number }[];
  quantity: number;
  amount: number;
};

// TODOS os valores abaixo são fictícios e exclusivos da demonstração.
const DEMO_QUANTITIES: BazarStock = {
  2: 12,
  5: 58,
  8: 9,
  10: 42,
  12: 7,
  15: 31,
  30: 8,
  60: 2,
};

export function initialDemoStock(): BazarStock {
  return { ...DEMO_QUANTITIES };
}

export function isBazarPrice(value: number): value is BazarPrice {
  return BAZAR_PRICES.some((price) => price === value);
}

function checkQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
    throw new Error("A quantidade deve ser um número inteiro entre 1 e 10.000.");
  }
}

export function addDemoStock(
  stock: BazarStock,
  price: BazarPrice,
  quantity: number,
): BazarStock {
  if (!isBazarPrice(price)) throw new Error("Preço não permitido.");
  checkQuantity(quantity);
  const next = stock[price] + quantity;
  if (!Number.isSafeInteger(next)) throw new Error("Quantidade excede o limite permitido.");
  return { ...stock, [price]: next };
}

export function repriceDemoStock(
  stock: BazarStock,
  from: BazarPrice,
  to: BazarPrice,
  quantity: number,
): BazarStock {
  if (!isBazarPrice(from) || !isBazarPrice(to)) throw new Error("Preço não permitido.");
  checkQuantity(quantity);
  if (from === to) throw new Error("Selecione preços diferentes.");
  if (stock[from] < quantity) throw new Error("Quantidade maior que o estoque disponível.");
  return { ...stock, [from]: stock[from] - quantity, [to]: stock[to] + quantity };
}

export function checkoutDemoSale(
  stock: BazarStock,
  cart: BazarCart,
): { nextStock: BazarStock; lines: BazarSale["lines"]; quantity: number; amount: number } {
  const lines = Object.entries(cart).map(([key, quantity]) => ({
    price: Number(key),
    quantity,
  }));
  if (lines.length === 0) throw new Error("Selecione pelo menos uma peça.");

  let quantity = 0;
  let amount = 0;
  const nextStock = { ...stock };
  const checkedLines: BazarSale["lines"] = [];
  for (const line of lines) {
    if (!isBazarPrice(line.price)) throw new Error("Preço não permitido.");
    if (typeof line.quantity !== "number") throw new Error("Quantidade inválida.");
    checkQuantity(line.quantity);
    if (nextStock[line.price] < line.quantity) {
      throw new Error(`Estoque insuficiente para as peças de R$ ${line.price}.`);
    }
    quantity += line.quantity;
    amount += line.price * line.quantity;
    nextStock[line.price] -= line.quantity;
    checkedLines.push({ price: line.price, quantity: line.quantity });
  }
  return { nextStock, lines: checkedLines, quantity, amount };
}

export function stockTotal(stock: BazarStock): number {
  return BAZAR_PRICES.reduce((total, price) => total + stock[price], 0);
}

export function salesTotal(sales: BazarSale[]): number {
  return sales.reduce((total, sale) => total + sale.amount, 0);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
