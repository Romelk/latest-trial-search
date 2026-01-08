import { NextRequest, NextResponse } from "next/server";
import { loadCatalog, type Product } from "@/lib/catalog";
import { generateProductInsight } from "@/lib/llm/product-insight";

export async function POST(request: NextRequest) {
  try {
    const { productId, provider = "openai", brief, candidateIds } = await request.json();

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    const catalog = loadCatalog();
    const product = catalog.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Get alternative products from candidateIds
    // Filter alternatives to match the original product's audience and scenarioId
    const alternatives: Product[] = [];
    if (candidateIds && Array.isArray(candidateIds)) {
      for (const id of candidateIds) {
        if (id !== productId && alternatives.length < 2) {
          const candidateProduct = catalog.find((p) => p.id === id);
          if (candidateProduct) {
            // Hard filter: must match audience and scenarioId
            if (candidateProduct.audience === product.audience && 
                candidateProduct.scenarioId === product.scenarioId) {
              // Additional filter: category whitelist
              const AUDIENCE_CATEGORY_WHITELIST: Record<"men" | "women" | "unisex", string[]> = {
                men: ["Shirts", "Polos", "Chinos", "Jeans", "Tees", "Blazers", "Sneakers", "Loafers", "Derbies"],
                women: ["Dresses", "Blouses", "Trousers", "Skirts", "Tees", "Blazers", "Sneakers", "Flats", "Heels", "Clutches"],
                unisex: ["Tees", "Overshirts", "Hoodies", "Jackets", "Trousers", "Sneakers", "Backpacks", "Sunglasses", "Beanies"],
              };
              const allowedCategories = AUDIENCE_CATEGORY_WHITELIST[product.audience];
              if (allowedCategories.includes(candidateProduct.category)) {
                // Color guardrail for Men: block pink unless in brief
                if (product.audience === "men" && candidateProduct.color.toLowerCase() === "pink") {
                  const briefText = JSON.stringify(brief || {}).toLowerCase();
                  const pinkKeywords = ["pink", "magenta", "pastel", "bold", "pop color"];
                  const hasPinkRequest = pinkKeywords.some((keyword) => briefText.includes(keyword));
                  if (!hasPinkRequest) {
                    continue; // Skip pink items for men
                  }
                }
                alternatives.push(candidateProduct);
              }
            }
          }
        }
      }
    }

    // Generate insights using LLM
    const insights = await generateProductInsight(
      provider as "openai" | "anthropic" | "gemini",
      product,
      brief || {},
      alternatives
    );

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Product insight error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

