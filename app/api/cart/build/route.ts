import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";
import { generateProductReasons } from "@/lib/llm";

type CartItem = {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageUrl: string;
  category: string;
  color: string;
  why: string;
};

type Cart = {
  name: string;
  items: CartItem[];
  notes: string[];
};

function buildCarts(
  candidates: Array<{ product: any; score: number }>,
  provider: "openai" | "anthropic",
  query: string,
  preference?: string | null
): { budget: CartItem[]; balanced: CartItem[]; premium: CartItem[] } {
  const products = candidates.map((c) => c.product);

  // Sort by price
  const sortedByPrice = [...products].sort((a, b) => a.price - b.price);

  // Budget: lower third
  const budgetProducts = sortedByPrice.slice(0, Math.ceil(products.length / 3));
  // Balanced: middle third
  const balancedProducts = sortedByPrice.slice(
    Math.floor(products.length / 3),
    Math.floor((products.length * 2) / 3)
  );
  // Premium: upper third
  const premiumProducts = sortedByPrice.slice(Math.floor((products.length * 2) / 3));

  // Select 3 items per cart, trying to vary categories
  const selectDiverse = (pool: any[], count: number) => {
    const selected: any[] = [];
    const usedCategories = new Set<string>();

    // First pass: try to get different categories
    for (const product of pool) {
      if (selected.length >= count) break;
      if (!usedCategories.has(product.category) || selected.length < 2) {
        selected.push(product);
        usedCategories.add(product.category);
      }
    }

    // Fill remaining slots
    for (const product of pool) {
      if (selected.length >= count) break;
      if (!selected.find((p) => p.id === product.id)) {
        selected.push(product);
      }
    }

    return selected.slice(0, count);
  };

  const budgetItems = selectDiverse(budgetProducts, 3);
  const balancedItems = selectDiverse(balancedProducts, 3);
  const premiumItems = selectDiverse(premiumProducts, 3);

  return {
    budget: budgetItems.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
      color: p.color,
      why: "", // Will be filled by LLM
    })),
    balanced: balancedItems.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
      color: p.color,
      why: "", // Will be filled by LLM
    })),
    premium: premiumItems.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
      color: p.color,
      why: "", // Will be filled by LLM
    })),
  };
}

async function generateCartNotes(
  carts: { budget: CartItem[]; balanced: CartItem[]; premium: CartItem[] },
  provider: "openai" | "anthropic",
  query: string,
  preference?: string | null
): Promise<{ budget: Cart; balanced: Cart; premium: Cart }> {
  // Generate "why" for each item using LLM
  const allItems = [...carts.budget, ...carts.balanced, ...carts.premium];

  const productSummaries = allItems.map((item) => ({
    id: item.id,
    title: item.title,
    brand: item.brand,
    category: item.category,
    price: item.price,
  }));

  // Get reasons for all items
  const reasons = await generateProductReasons(
    provider,
    productSummaries,
    query,
    preference
  );

  // Assign reasons to items
  let reasonIdx = 0;
  const assignReasons = (items: CartItem[]) => {
    return items.map((item) => ({
      ...item,
      why: reasons[reasonIdx++]?.[0] || "Great choice for this cart",
    }));
  };

  const budgetWithWhy = assignReasons(carts.budget);
  const balancedWithWhy = assignReasons(carts.balanced);
  const premiumWithWhy = assignReasons(carts.premium);

  // Generate cart notes
  return {
    budget: {
      name: "Budget",
      items: budgetWithWhy,
      notes: [
        "Affordable options that don't compromise on style",
        "Perfect for everyday wear",
        "Great value for money",
      ],
    },
    balanced: {
      name: "Balanced",
      items: balancedWithWhy,
      notes: [
        "Great value with quality and style",
        "Versatile pieces for multiple occasions",
        "Balanced price-to-quality ratio",
      ],
    },
    premium: {
      name: "Premium",
      items: premiumWithWhy,
      notes: [
        "Premium quality and design",
        "Investment pieces for your wardrobe",
        "Top-tier materials and craftsmanship",
      ],
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { query, provider = "openai", preference } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const catalog = loadCatalog();
    const searchResults = searchProducts(catalog, query, 30);

    if (searchResults.length < 3) {
      return NextResponse.json(
        { error: "Not enough products found" },
        { status: 400 }
      );
    }

    // Build carts
    const carts = buildCarts(searchResults, provider as "openai" | "anthropic", query, preference);

    // Generate notes and "why" using LLM
    const cartsWithNotes = await generateCartNotes(
      carts,
      provider as "openai" | "anthropic",
      query,
      preference
    );

    return NextResponse.json({
      carts: [cartsWithNotes.budget, cartsWithNotes.balanced, cartsWithNotes.premium],
    });
  } catch (error) {
    console.error("Cart build error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

