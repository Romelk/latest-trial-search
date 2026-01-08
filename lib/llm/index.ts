import * as openai from "./openai";
import * as anthropic from "./anthropic";

export type ShoppingBrief = {
  budgetMax?: number | null;
  category?: string | null;
  color?: string | null;
  occasion?: string | null;
  style?: string | null;
  notes?: string;
};

export async function generateShoppingBrief(
  provider: "openai" | "anthropic",
  query: string,
  userAnswer?: string | null
): Promise<ShoppingBrief> {
  if (provider === "openai") {
    return openai.generateShoppingBrief(query, userAnswer);
  }
  return anthropic.generateShoppingBrief(query, userAnswer);
}

export async function generateProductReasons(
  provider: "openai" | "anthropic",
  products: Array<{ id: string; title: string; brand: string; category: string; price: number }>,
  query: string,
  userAnswer?: string | null
): Promise<string[][]> {
  if (provider === "openai") {
    return openai.generateProductReasons(products, query, userAnswer);
  }
  return anthropic.generateProductReasons(products, query, userAnswer);
}

