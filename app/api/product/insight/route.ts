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
    const alternatives: Product[] = [];
    if (candidateIds && Array.isArray(candidateIds)) {
      for (const id of candidateIds) {
        if (id !== productId && alternatives.length < 2) {
          const product = catalog.find((p) => p.id === id);
          if (product) {
            alternatives.push(product);
          }
        }
      }
    }

    // Generate insights using LLM
    const insights = await generateProductInsight(
      provider as "openai" | "anthropic",
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

