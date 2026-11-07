/** Regras puras. A unidade é a embalagem (ex.: pacote de 1 kg), não gramas. */
export type FoodItem = { id: string; name: string; unit: string; stock: number; perBasket: number };
export type FoodFamily = { id: string; code: string };
export type FoodDistributionLine = { itemId: string; name: string; unit: string; quantity: number };
export type FoodDistribution = { id: string; familyId: string; deliveredAt: string; lines: FoodDistributionLine[] };
export type FoodState = { items: FoodItem[]; families: FoodFamily[]; distributions: FoodDistribution[]; monthlyFamilies: number };
export type FoodNeed = { itemId: string; name: string; unit: string; stock: number; perBasket: number; neededPerMonth: number; missingNextMonth: number; months: number };
const DEMO_FOODS: FoodItem[] = [
  { id: "f-arroz", name: "Arroz", unit: "pacote de 5 kg", stock: 90, perBasket: 1 },
  { id: "f-feijao", name: "Feijão", unit: "pacote de 1 kg", stock: 160, perBasket: 2 },
  { id: "f-oleo", name: "Óleo", unit: "garrafa de 900 ml", stock: 40, perBasket: 1 },
  { id: "f-acucar", name: "Açúcar", unit: "pacote de 1 kg", stock: 100, perBasket: 1 },
  { id: "f-macarrao", name: "Macarrão", unit: "pacote de 500 g", stock: 120, perBasket: 2 },
  { id: "f-leite", name: "Leite", unit: "caixa de 1 L", stock: 45, perBasket: 2 },
  { id: "f-farinha", name: "Farinha", unit: "pacote de 1 kg", stock: 55, perBasket: 1 },
  { id: "f-sal", name: "Sal", unit: "pacote de 1 kg", stock: 150, perBasket: 1 },
  { id: "f-cafe", name: "Café", unit: "pacote de 500 g", stock: 35, perBasket: 1 },
];
export function initialFoodDemo(): FoodState {
  return {
    items: DEMO_FOODS.map(item => ({ ...item })),
    families: ["001", "002", "003", "004"].map(i => ({ id: `sim-${i}`, code: `FAM-SIM-${i}` })),
    distributions: [], monthlyFamilies: 40,
  };
}
export function assertQuantity(value: number, min = 1, max = 10000): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Informe um número inteiro entre ${min} e ${max}.`);
  }
}
export function addFoodItem(state: FoodState, id: string, name: string, unit: string, perBasket: number): FoodState {
  const cleanName = name.trim(), cleanUnit = unit.trim();
  if (!id || cleanName.length < 2 || cleanName.length > 100 || cleanUnit.length < 2 || cleanUnit.length > 60)
    throw new Error("Informe nome e embalagem válidos para o alimento.");
  assertQuantity(perBasket, 0, 100);
  if (state.items.some(item => item.id === id ||
    (item.name.toLocaleLowerCase("pt-BR") === cleanName.toLocaleLowerCase("pt-BR") &&
    item.unit.toLocaleLowerCase("pt-BR") === cleanUnit.toLocaleLowerCase("pt-BR")))) {
    throw new Error("Esse alimento e embalagem já estão cadastrados.");
  }
  return { ...state, items: [...state.items, { id, name: cleanName, unit: cleanUnit, stock: 0, perBasket }] };
}
export function receiveFood(state: FoodState, itemId: string, quantity: number): FoodState {
  assertQuantity(quantity);
  if (!state.items.some(item => item.id === itemId)) throw new Error("Alimento não encontrado.");
  return { ...state, items: state.items.map(item => {
    if (item.id !== itemId) return item;
    if (!Number.isSafeInteger(item.stock + quantity) || item.stock + quantity > 10000000)
      throw new Error("Estoque excede o limite permitido.");
    return { ...item, stock: item.stock + quantity };
  }) };
}
export function setFoodBasketQuantity(state: FoodState, itemId: string, quantity: number): FoodState {
  assertQuantity(quantity, 0, 100);
  if (!state.items.some(item => item.id === itemId)) throw new Error("Alimento não encontrado.");
  return { ...state, items: state.items.map(item => item.id === itemId ? { ...item, perBasket: quantity } : item) };
}
export function setFoodMonthlyFamilies(state: FoodState, monthlyFamilies: number): FoodState {
  assertQuantity(monthlyFamilies, 1, 10000);
  return { ...state, monthlyFamilies };
}
export function foodMetrics(state: FoodState) {
  const active = state.items.filter(item => item.perBasket > 0);
  const basketCapacity = active.length ? Math.min(...active.map(item => Math.floor(item.stock / item.perBasket))) : 0;
  const needs: FoodNeed[] = active.map(item => {
    const neededPerMonth = item.perBasket * state.monthlyFamilies;
    return {
      itemId: item.id, name: item.name, unit: item.unit, stock: item.stock,
      perBasket: item.perBasket, neededPerMonth,
      missingNextMonth: Math.max(0, neededPerMonth - item.stock), months: item.stock / neededPerMonth,
    };
  }).sort((a, b) => a.months - b.months || b.missingNextMonth - a.missingNextMonth);
  return {
    basketsPossible: basketCapacity,
    monthsCoverage: active.length ? basketCapacity / state.monthlyFamilies : null,
    activeItems: active.length,
    nextMonthShortages: needs.filter(item => item.missingNextMonth > 0),
    needs,
    totalPackages: state.items.reduce((total, item) => total + item.stock, 0),
    deliveries: state.distributions.length,
    familiesServed: new Set(state.distributions.map(d => d.familyId)).size,
  };
}
export function deliverFoodBasket(state: FoodState, familyId: string, deliveryId: string, deliveredAt: string): FoodState {
  if (!state.families.some(family => family.id === familyId)) throw new Error("Selecione uma família cadastrada.");
  if (!deliveryId) throw new Error("Identificador de entrega inválido.");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(deliveredAt) || !Number.isFinite(Date.parse(deliveredAt)))
    throw new Error("Data da entrega inválida.");
  if (state.distributions.some(d => d.id === deliveryId)) throw new Error("Entrega já registrada.");
  const sameMonth = deliveredAt.slice(0, 7);
  if (state.distributions.some(d => d.familyId === familyId && d.deliveredAt.slice(0, 7) === sameMonth))
    throw new Error("Esta família já recebeu uma cesta neste mês.");
  const active = state.items.filter(item => item.perBasket > 0);
  if (!active.length) throw new Error("Configure primeiro os alimentos da cesta padrão.");
  for (const item of active) {
    if (item.stock < item.perBasket) throw new Error(`Estoque insuficiente de ${item.name}.`);
  }
  const lines: FoodDistributionLine[] = active.map(item => ({
    itemId: item.id, name: item.name, unit: item.unit, quantity: item.perBasket,
  }));
  return {
    ...state,
    items: state.items.map(item => ({ ...item, stock: item.stock - item.perBasket })),
    distributions: [{ id: deliveryId, familyId, deliveredAt, lines }, ...state.distributions],
  };
}
