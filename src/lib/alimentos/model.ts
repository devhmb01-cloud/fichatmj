/** Regras puras. A unidade é a embalagem (ex.: pacote de 1 kg), não gramas. */
export type FoodItem = { id: string; name: string; unit: string; stock: number; perBasket: number };
export type FoodLot = { id: string; itemId: string; remaining: number; expiresOn: string | null; createdAt: string; origin: "legacy" | "donation" };
export type FoodLossReason = "expired" | "damaged" | "unfit" | "other";
export type FoodLoss = { id: string; itemId: string; lotId: string; quantity: number; reason: FoodLossReason; recordedAt: string };
export const LOSS_REASON_LABELS: Record<FoodLossReason,string> = { expired: "Vencimento", damaged: "Avaria", unfit: "Impróprio para consumo", other: "Outro" };
export function brazilToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
}
export function lotValidity(state: FoodState, itemId: string, today = brazilToday()) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) throw new Error("Alimento não encontrado.");
  const relevant = (state.lots ?? []).filter(l => l.itemId === itemId && l.remaining > 0);
  const expiringLimit = new Date(today + "T12:00:00Z");
  expiringLimit.setUTCDate(expiringLimit.getUTCDate() + 30);
  const limit = expiringLimit.toISOString().slice(0,10);
  const expired = relevant.filter(l => l.expiresOn !== null && l.expiresOn < today).reduce((v,l) => v+l.remaining,0);
  const nearExpiry = relevant.filter(l => l.expiresOn !== null && l.expiresOn >= today && l.expiresOn <= limit).reduce((v,l) => v+l.remaining,0);
  const unknown = relevant.filter(l => l.expiresOn === null).reduce((v,l) => v+l.remaining,0);
  const usable = state.lots ? relevant.reduce((v,l)=>v + ((l.expiresOn === null || l.expiresOn >= today) ? l.remaining : 0),0) : item.stock;
  return { usable: Math.min(item.stock,usable), expired, nearExpiry, unknown };
}
export type FoodFamily = { id: string; code: string };
export type FoodDistributionLine = { itemId: string; name: string; unit: string; quantity: number };
export type FoodDistribution = { id: string; familyId: string; deliveredAt: string; lines: FoodDistributionLine[] };
export type FoodState = { items: FoodItem[]; families: FoodFamily[]; distributions: FoodDistribution[]; monthlyFamilies: number; lots?: FoodLot[]; losses?: FoodLoss[] };
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
    lots: DEMO_FOODS.map(item => ({ id: `sim-lote-${item.id}`,itemId:item.id,remaining:item.stock,expiresOn:null,createdAt:'2026-01-01T12:00:00Z',origin:'legacy' as const })),
    losses: [],
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
  return receiveFoodLot(state,itemId,quantity,null);
}
export function receiveFoodLot(state: FoodState, itemId: string, quantity: number, expiresOn: string | null, id = crypto.randomUUID()): FoodState {
  if (expiresOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(Date.parse(expiresOn+"T12:00:00Z")) || expiresOn < brazilToday()))
    throw new Error("Não registre alimentos vencidos.");
  if (state.lots?.some(l => l.id === id)) throw new Error("Lote duplicado.");
  assertQuantity(quantity);
  if (!state.items.some(item => item.id === itemId)) throw new Error("Alimento não encontrado.");
  const items = state.items.map(item => {
    if (item.id !== itemId) return item;
    if (!Number.isSafeInteger(item.stock + quantity) || item.stock + quantity > 10000000)
      throw new Error("Estoque excede o limite permitido.");
    return { ...item, stock: item.stock + quantity };
  });
  const lot: FoodLot = { id,itemId,remaining:quantity,expiresOn,createdAt:new Date().toISOString(),origin:"donation" };
  return { ...state,items,lots:state.lots ? [lot,...state.lots] : undefined };
}
export function registerFoodLoss(state: FoodState, lotId: string, quantity: number, reason: FoodLossReason, id = crypto.randomUUID()): FoodState {
  assertQuantity(quantity);
  if (!Object.hasOwn(LOSS_REASON_LABELS,reason)) throw new Error("Motivo inválido.");
  const lot = state.lots?.find(l => l.id === lotId);
  if (!lot || lot.remaining < quantity) throw new Error("Lote inexistente ou quantidade maior que o saldo.");
  if (state.losses?.some(l => l.id === id)) throw new Error("Perda já registrada.");
  return {
    ...state,
    items:state.items.map(item => item.id === lot.itemId ? {...item,stock:item.stock-quantity} : item),
    lots:state.lots?.map(l => l.id === lotId ? {...l,remaining:l.remaining-quantity} : l),
    losses:[{id,itemId:lot.itemId,lotId,quantity,reason,recordedAt:new Date().toISOString()},...(state.losses??[])],
  };
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
  const usable = (item: FoodItem) => lotValidity(state,item.id).usable;
  const basketCapacity = active.length ? Math.min(...active.map(item => Math.floor(usable(item) / item.perBasket))) : 0;
  const needs: FoodNeed[] = active.map(item => {
    const neededPerMonth = item.perBasket * state.monthlyFamilies;
    const stock = usable(item);
    return {
      itemId: item.id, name: item.name, unit: item.unit, stock,
      perBasket: item.perBasket, neededPerMonth,
      missingNextMonth: Math.max(0, neededPerMonth - stock), months: stock / neededPerMonth,
    };
  }).sort((a, b) => a.months - b.months || b.missingNextMonth - a.missingNextMonth);
  return {
    basketsPossible: basketCapacity,
    monthsCoverage: active.length ? basketCapacity / state.monthlyFamilies : null,
    activeItems: active.length,
    nextMonthShortages: needs.filter(item => item.missingNextMonth > 0),
    needs,
    totalPackages: state.items.reduce((total, item) => total + item.stock, 0),
    usablePackages: state.items.reduce((total,item) => total + lotValidity(state,item.id).usable,0),
    expiredPackages: state.items.reduce((total,item) => total + lotValidity(state,item.id).expired,0),
    nearExpiryPackages: state.items.reduce((total,item) => total + lotValidity(state,item.id).nearExpiry,0),
    unknownExpiryPackages: state.items.reduce((total,item) => total + lotValidity(state,item.id).unknown,0),
    recordedLosses: (state.losses ?? []).reduce((total,loss) => total+loss.quantity,0),
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
    if (lotValidity(state,item.id,deliveredAt.slice(0,10)).usable < item.perBasket)
      throw new Error(`Estoque válido insuficiente de ${item.name}.`);
  }
  const lines: FoodDistributionLine[] = active.map(item => ({
    itemId: item.id, name: item.name, unit: item.unit, quantity: item.perBasket,
  }));
  return {
    ...state,
    items: state.items.map(item => ({ ...item, stock: stockAfterDelivery(item,state) })),
    lots: state.lots ? lotsAfterDelivery(state,deliveredAt.slice(0,10)) : undefined,
    distributions: [{ id: deliveryId, familyId, deliveredAt, lines }, ...state.distributions],
  };
}

function lotsAfterDelivery(state: FoodState, today: string): FoodLot[] {
  const lots = (state.lots ?? []).map(l => ({...l}));
  for (const item of state.items.filter(i => i.perBasket > 0)) {
    let needed = item.perBasket;
    const ordered = lots.filter(l => l.itemId === item.id && l.remaining>0 &&
      (l.expiresOn === null || l.expiresOn >= today))
      .sort((a,b) => (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") ||
        a.createdAt.localeCompare(b.createdAt));
    for (const lot of ordered) {
      const take = Math.min(lot.remaining,needed);
      lot.remaining -= take; needed -= take;
      if(needed===0) break;
    }
    if (needed>0) throw new Error("Estoque válido insuficiente.");
  }
  return lots;
}
function stockAfterDelivery(item: FoodItem,state:FoodState) {
  return item.stock - (item.perBasket > 0 ? item.perBasket : 0);
}
