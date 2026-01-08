import * as openai from "./openai";
import * as anthropic from "./anthropic";
import * as gemini from "./gemini";

export type ShoppingBrief = {
  budgetMax?: number | null;
  category?: string | null;
  color?: string | null;
  occasion?: string | null;
  style?: string | null;
  notes?: string;
};

export async function generateShoppingBrief(
  provider: "openai" | "anthropic" | "gemini",
  query: string,
  userAnswer?: string | null
): Promise<ShoppingBrief> {
  if (provider === "openai") {
    return openai.generateShoppingBrief(query, userAnswer);
  }
  if (provider === "anthropic") {
    return anthropic.generateShoppingBrief(query, userAnswer);
  }
  return gemini.generateShoppingBrief(query, userAnswer);
}

export async function generateProductReasons(
  provider: "openai" | "anthropic" | "gemini",
  products: Array<{ id: string; title: string; brand: string; category: string; price: number; role?: string }>,
  query: string,
  userAnswer?: string | null
): Promise<string[][]> {
  if (provider === "openai") {
    return openai.generateProductReasons(products, query, userAnswer);
  }
  if (provider === "anthropic") {
    return anthropic.generateProductReasons(products, query, userAnswer);
  }
  return gemini.generateProductReasons(products, query, userAnswer);
}

