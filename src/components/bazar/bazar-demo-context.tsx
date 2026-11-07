"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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
  addPieces: (price: BazarPrice, quantity: number) => Outcome;
  repricePieces: (from: BazarPrice, to: BazarPrice, quantity: number) => Outcome;
  registerSale: (cart: BazarCart) => Outcome;
  resetDemo: () => void;
};

const BazarContext = createContext<BazarDemoContextValue | null>(null);

export function BazarDemoProvider({ children }: { children: ReactNode }) {
  const [stock, setStock] = useState<BazarStock>(initialDemoStock);
  const [sales, setSales] = useState<BazarSale[]>([]);

  function addPieces(price: BazarPrice, quantity: number): Outcome {
    try {
      const next = addDemoStock(stock, price, quantity);
      setStock(next);
      return { ok: true, message: `${quantity} peça(s) adicionada(s) ao estoque fictício.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível adicionar." };
    }
  }

  function repricePieces(from: BazarPrice, to: BazarPrice, quantity: number): Outcome {
    try {
      const next = repriceDemoStock(stock, from, to, quantity);
      setStock(next);
      return { ok: true, message: `${quantity} peça(s) reprecificada(s) na simulação.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível reprecificar." };
    }
  }

  function registerSale(cart: BazarCart): Outcome {
    try {
      const result = checkoutDemoSale(stock, cart);
      setStock(result.nextStock);
      setSales((current) => [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          lines: result.lines,
          quantity: result.quantity,
          amount: result.amount,
        },
        ...current,
      ]);
      return { ok: true, message: `Venda simulada registrada: ${result.quantity} peça(s).` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível registrar." };
    }
  }

  function resetDemo() {
    setStock(initialDemoStock());
    setSales([]);
  }

  return (
    <BazarContext.Provider value={{ stock, sales, addPieces, repricePieces, registerSale, resetDemo }}>
      {children}
    </BazarContext.Provider>
  );
}

export function useBazarDemo() {
  const context = useContext(BazarContext);
  if (!context) throw new Error("O módulo Bazar deve ser usado dentro do BazarDemoProvider.");
  return context;
}
