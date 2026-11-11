"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  addFoodItem, deliverFoodBasket, initialFoodDemo, receiveFoodLot, registerFoodLoss, type FoodLossReason, confirmFoodLotExpiry,
  setFoodBasketQuantity, setFoodMonthlyFamilies, type FoodState,
} from "@/lib/alimentos/model";
import {
  createFoodItem, deliverFood, receiveFoodStock, recordFoodLoss, confirmUnknownLotExpiry,
  updateBasketItem, updateMonthlyFamilies, type FoodActionResponse,
} from "@/app/alimentos/actions";

type Outcome = { ok: boolean; message: string };
type Context = {
  data: FoodState;
  persistent: boolean;
  pending: boolean;
  addItem: (name: string, unit: string, basket: number) => Promise<Outcome>;
  receive: (itemId: string, quantity: number, expiresOn: string | null) => Promise<Outcome>;
  recordLoss: (lotId: string, quantity: number, reason: FoodLossReason) => Promise<Outcome>;
  confirmExpiry: (lotId: string, expiresOn: string) => Promise<Outcome>;
  updateBasket: (itemId: string, quantity: number) => Promise<Outcome>;
  updateTarget: (count: number) => Promise<Outcome>;
  deliver: (familyId: string) => Promise<Outcome>;
  resetDemo: () => void;
};
const FoodContext = createContext<Context | null>(null);
export function FoodProvider({ children, initialState, persistent = false }: {
  children: ReactNode; initialState?: FoodState; persistent?: boolean;
}) {
  const [data, setData] = useState<FoodState>(initialState ?? initialFoodDemo());
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  async function remote(key: string, callback: (id: string) => Promise<FoodActionResponse>, success: string): Promise<Outcome> {
    if (busy.current) return { ok: false, message: "Uma operação já está em andamento." };
    busy.current = true; setPending(true);
    const id = retry.current?.key === key ? retry.current.id : crypto.randomUUID();
    retry.current = { key, id };
    try {
      const result = await callback(id);
      if (!result.ok) return { ok: false, message: result.message };
      setData(result.state);
      retry.current = null;
      return { ok: true, message: result.duplicate ? "Operação já registrada anteriormente." : success };
    } catch {
      return { ok: false, message: "Falha de conexão. Verifique o estoque antes de tentar novamente." };
    } finally { busy.current = false; setPending(false); }
  }
  function local(callback: () => FoodState, success: string): Outcome {
    try { setData(callback()); return { ok: true, message: success + " (simulação)" }; }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Operação inválida." }; }
  }
  const addItem: Context["addItem"] = async (name, unit, basket) => persistent
    ? remote(`new:${name}:${unit}:${basket}`, id => createFoodItem({ requestId: id, name, unit, perBasket: basket }), "Alimento cadastrado.")
    : local(() => addFoodItem(data, crypto.randomUUID(), name, unit, basket), "Alimento cadastrado");
  const receive: Context["receive"] = async (itemId, quantity, expiresOn) => persistent
    ? remote(`receive:${itemId}:${quantity}:${expiresOn ?? "unknown"}`, id => receiveFoodStock({ requestId: id, itemId, quantity, expiresOn }), "Entrada e validade registradas.")
    : local(() => receiveFoodLot(data, itemId, quantity, expiresOn), "Entrada registrada");
  const recordLoss: Context["recordLoss"] = async (lotId, quantity, reason) => persistent
    ? remote(`loss:${lotId}:${quantity}:${reason}`, id => recordFoodLoss({requestId:id,lotId,quantity,reason}),"Perda registrada e saldo atualizado.")
    : local(() => registerFoodLoss(data,lotId,quantity,reason), "Perda registrada");
  const confirmExpiry: Context["confirmExpiry"] = async (lotId,expiresOn) => persistent
    ? remote(`expiry:${lotId}:${expiresOn}`,id=>confirmUnknownLotExpiry({requestId:id,lotId,expiresOn}),"Validade confirmada e histórico atualizado.")
    : local(()=>confirmFoodLotExpiry(data,lotId,expiresOn),"Validade confirmada");
  const updateBasket: Context["updateBasket"] = async (itemId, quantity) => persistent
    ? remote(`basket:${itemId}:${quantity}`, id => updateBasketItem({ requestId: id, itemId, perBasket: quantity }), "Cesta padrão atualizada.")
    : local(() => setFoodBasketQuantity(data, itemId, quantity), "Composição atualizada");
  const updateTarget: Context["updateTarget"] = async (count) => persistent
    ? remote(`target:${count}`, id => updateMonthlyFamilies({ requestId: id, monthlyFamilies: count }), "Meta mensal atualizada.")
    : local(() => setFoodMonthlyFamilies(data, count), "Meta mensal atualizada");
  const deliver: Context["deliver"] = async familyId => persistent
    ? remote(`deliver:${familyId}`, id => deliverFood({ requestId: id, familyId }), "Cesta entregue e estoque atualizado.")
    : local(() => deliverFoodBasket(data, familyId, crypto.randomUUID(), new Date().toISOString()), "Cesta entregue e estoque atualizado");
  function resetDemo() { if (!persistent) setData(initialFoodDemo()); }
  return <FoodContext.Provider value={{ data, persistent, pending, addItem, receive, recordLoss, confirmExpiry, updateBasket, updateTarget, deliver, resetDemo }}>{children}</FoodContext.Provider>;
}
export function useFood() {
  const value = useContext(FoodContext);
  if (!value) throw new Error("Alimentos deve estar dentro do FoodProvider.");
  return value;
}
