import FoodStockClient from "@/components/alimentos/food-stock-client";

export default async function FoodStock({ searchParams }: Readonly<{
  searchParams: Promise<{ item?: string | string[] }>;
}>) {
  const params = await searchParams;
  const item = typeof params.item === "string" ? params.item : "";
  return <FoodStockClient key={item} initialItemId={item} />;
}
