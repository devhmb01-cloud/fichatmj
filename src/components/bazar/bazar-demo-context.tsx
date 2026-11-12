"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { addBazarPieces, repriceBazarPieces, registerBazarSale, type BazarServerState } from "@/app/bazar/actions";
import {
  addDemoStock,
  checkoutDemoSale,
  initialDemoStock,
  repriceDemoStock,
  type BazarCart,
  type BazarPrice,
  type BazarSale,
  type BazarStock,
} from "@/lib/bazar/demo-model";

type Outcome = { ok: true; message: string } | { ok: false; message: string };
type BazarDemoContextValue = {
  stock: BazarStock;
  sales: BazarSale[];
  persistent: boolean;
  pending: boolean;
  addPieces: (price: BazarPrice, quantity: number) => Promise<Outcome>;
  repricePieces: (from: BazarPrice, to: BazarPrice, quantity: number) => Promise<Outcome>;
  registerSale: (cart: BazarCart) => Promise<Outcome>;
  resetDemo: () => void;
};

const BazarContext = createContext<BazarDemoContextValue | null>(null);

export function BazarDemoProvider({
  children, persistent = false, initialState,
}: {
  children: ReactNode;
  persistent?: boolean;
  initialState?: BazarServerState;
}) {
  const [stock, setStock] = useState<BazarStock>(initialState?.stock ?? initialDemoStock());
  const [sales, setSales] = useState<BazarSale[]>(initialState?.sales ?? []);
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  // Retain the same request ID when retrying an uncertain network failure.
  const retryRef = useRef<{ key: string; id: string } | null>(null);

  async function run(
    key: string,
    call: (id: string) => Promise<import("@/app/bazar/actions").BazarActionResponse>,
    message: string
  ): Promise<Outcome> {
    if (busyRef.current) return { ok: false, message: "Uma operação já está em andamento." };
    busyRef.current = true;
    setPending(true);
    const id = retryRef.current?.key === key ? retryRef.current.id : crypto.randomUUID();
    retryRef.current = { key, id };
    try {
      const result = await call(id);
      if (!result.ok) return { ok: false, message: result.message };
      retryRef.current = null;
      setStock(result.state.stock);
      setSales(result.state.sales);
      return { ok: true, message: result.duplicate ? "Operação já registrada anteriormente." : message };
    } catch {
      return { ok: false, message: "Falha de conexão. Confira o resultado antes de repetir." };
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  async function addPieces(price: BazarPrice, quantity: number): Promise<Outcome> {
    if (persistent) {
      return run("entry:" + price + ":" + quantity,
        id => addBazarPieces({ price, quantity, requestId: id }),
        String(quantity) + " peça(s) adicionada(s) ao estoque.");
    }
    try {
      const next = addDemoStock(stock, price, quantity);
      setStock(next);
      return { ok: true, message: String(quantity) + " peça(s) adicionada(s) ao estoque fictício." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível adicionar." };
    }
  }

  async function repricePieces(from: BazarPrice, to: BazarPrice, quantity: number): Promise<Outcome> {
    if (persistent) {
      return run("reprice:" + from + ":" + to + ":" + quantity,
        id => repriceBazarPieces({ from, to, quantity, requestId: id }),
        String(quantity) + " peça(s) reprecificada(s).");
    }
    try {
      const next = repriceDemoStock(stock, from, to, quantity);
      setStock(next);
      return { ok: true, message: String(quantity) + " peça(s) reprecificada(s) na simulação." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível reprecificar." };
    }
  }

  async function registerSale(cart: BazarCart): Promise<Outcome> {
    if (persistent) {
      const lines = Object.entries(cart).map(([price, quantity]) => ({
        price: Number(price), quantity
      }));
      return run("sale:" + JSON.stringify(lines),
        id => registerBazarSale({ lines, requestId: id }), "Venda registrada no Bazar.");
    }
    try {
      const result = checkoutDemoSale(stock, cart);
      setStock(result.nextStock);
      setSales(current => [{
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        lines: result.lines,
        quantity: result.quantity,
        amount: result.amount,
      }, ...current]);
      return { ok: true, message: "Venda simulada registrada: " + result.quantity + " peça(s)." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível registrar." };
    }
  }

  function resetDemo() {
    if (persistent) return;
    setStock(initialDemoStock());
    setSales([]);
  }

  return (
    <BazarContext.Provider value={{ stock, sales, persistent, pending,
      addPieces, repricePieces, registerSale, resetDemo }}>
      {children}
    </BazarContext.Provider>
  );
}

export function useBazarDemo() {
  const context = useContext(BazarContext);
  if (!context) throw new Error("O módulo Bazar deve ser usado dentro do BazarDemoProvider.");
  return context;
}
