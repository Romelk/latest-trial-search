import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { searchProducts, extractConstraints } from "@/lib/search";
import { generateShoppingBrief, generateProductReasons } from "@/lib/llm";
import { generateConstraintDelta } from "@/lib/llm/constraint-delta";

type Intent = "CLEAR" | "AMBIGUOUS" | "GOAL";

function detectIntent(query: string): Intent {
  const lowerQuery = query.toLowerCase().trim();

  // GOAL: includes context like occasion, event, "I need", "help me", "for my"
  const goalPatterns = [
    /i need/i,
    /help me/i,
    /for my/i,
    /looking for/i,
    /want to/i,
    /trying to/i,
    /need to/i,
  ];

  for (const pattern of goalPatterns) {
    if (pattern.test(query)) {
      return "GOAL";
    }
  }

  // AMBIGUOUS: very short (1-2 words) or category-only
  const words = lowerQuery.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 2) {
    return "AMBIGUOUS";
  }

  // Check if it's just a category
  const categories = [
    "shirts",
    "trousers",
    "jeans",
    "t-shirts",
    "blazers",
    "dresses",
    "sneakers",
    "loafers",
    "handbags",
    "watches",
  ];
  if (words.length === 1 && categories.includes(words[0])) {
    return "AMBIGUOUS";
  }

  return "CLEAR";
}

export async function POST(request: NextRequest) {
  try {
    const { query, provider = "openai", userAnswer, session, followUp, constraintsOverride } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const catalog = loadCatalog();
    
    // Handle follow-up refinement
    if (followUp && session) {
      const existingConstraints = constraintsOverride || extractConstraints(session.originalQuery);
      
      // Generate constraint delta from follow-up
      const delta = await generateConstraintDelta(
        provider as "openai" | "anthropic",
        followUp,
        existingConstraints
      );

      // Merge delta into existing constraints
      const mergedConstraints = {
        ...existingConstraints,
        ...delta,
        // Handle color exclude
        color: delta.colorExclude ? undefined : (delta.colorInclude || existingConstraints.color),
        colorExclude: delta.colorExclude || existingConstraints.colorExclude,
      };

      // Re-run search with merged constraints - first get candidates
      const searchResults = searchProducts(catalog, session.originalQuery, 100);
      
      // Apply merged constraints to filter results
      const filteredProducts = searchResults
        .filter((r) => {
          // Apply budget filter (check for null/undefined explicitly)
          if (mergedConstraints.budgetMax !== null && mergedConstraints.budgetMax !== undefined) {
            if (r.product.price > mergedConstraints.budgetMax) {
              return false;
            }
          }
          
          // Apply category filter
          if (mergedConstraints.category && r.product.category !== mergedConstraints.category) {
            return false;
          }
          
          // Apply color include filter
          if (mergedConstraints.color && r.product.color !== mergedConstraints.color) {
            return false;
          }
          
          // Apply color exclude filter
          if (mergedConstraints.colorExclude && r.product.color.toLowerCase() === mergedConstraints.colorExclude.toLowerCase()) {
            return false;
          }
          
          // Apply style filter
          if (mergedConstraints.style && r.product.style !== mergedConstraints.style) {
            return false;
          }
          
          // Apply occasion filter
          if (mergedConstraints.occasion && !r.product.occasionTags.some(
            (tag) => tag.toLowerCase() === mergedConstraints.occasion!.toLowerCase()
          )) {
            return false;
          }
          
          // Apply exclude keywords filter
          if (mergedConstraints.excludeKeywords && mergedConstraints.excludeKeywords.length > 0) {
            const productText = [r.product.title, r.product.description].join(" ").toLowerCase();
            if (mergedConstraints.excludeKeywords.some((k: string) => productText.includes(k.toLowerCase()))) {
              return false;
            }
          }
          
          // Apply include keywords filter
          if (mergedConstraints.includeKeywords && mergedConstraints.includeKeywords.length > 0) {
            const productText = [r.product.title, r.product.description].join(" ").toLowerCase();
            const hasAllKeywords = mergedConstraints.includeKeywords.every((k: string) => 
              productText.includes(k.toLowerCase())
            );
            if (!hasAllKeywords) {
              return false;
            }
          }
          
          return true;
        })
        .sort((a, b) => {
          // Apply sorting
          if ((mergedConstraints as any).sortBy === "price_asc") {
            if (a.product.price !== b.product.price) {
              return a.product.price - b.product.price;
            }
            return b.score - a.score; // Secondary sort by score
          } else if ((mergedConstraints as any).sortBy === "price_desc") {
            if (a.product.price !== b.product.price) {
              return b.product.price - a.product.price;
            }
            return b.score - a.score; // Secondary sort by score
          }
          return b.score - a.score; // Default: sort by score
        })
        .slice(0, 24);

      const productSummaries = filteredProducts.map((r) => ({
        id: r.product.id,
        title: r.product.title,
        brand: r.product.brand,
        category: r.product.category,
        price: r.product.price,
      }));

      const reasons = await generateProductReasons(
        provider as "openai" | "anthropic",
        productSummaries,
        session.originalQuery,
        followUp
      );

      const results = filteredProducts.map((result, idx) => ({
        id: result.product.id,
        title: result.product.title,
        brand: result.product.brand,
        price: result.product.price,
        imageUrl: result.product.imageUrl,
        category: result.product.category,
        color: result.product.color,
        reasons: reasons[idx] || ["Matches your search", "Good quality", "Great value"],
      }));

      return NextResponse.json({
        intent: "CLEAR", // Follow-ups are always CLEAR
        assistantQuestion: null,
        session: { ...session, asked: true },
        constraints: {
          budgetMax: mergedConstraints.budgetMax ?? null,
          category: mergedConstraints.category ?? null,
          color: mergedConstraints.color ?? null,
          colorExclude: mergedConstraints.colorExclude ?? null,
          occasion: mergedConstraints.occasion ?? null,
          style: mergedConstraints.style ?? null,
        },
        results,
      });
    }

    // Original search flow
    const intent = detectIntent(query);

    // Determine if we should ask a question
    let assistantQuestion: string | null = null;
    let newSession = session || { originalQuery: query, asked: false };

    if (
      (intent === "GOAL" || intent === "AMBIGUOUS") &&
      !userAnswer &&
      !newSession.asked
    ) {
      assistantQuestion = "Do you want it more relaxed or more formal?";
      // Keep asked as false until user answers
      newSession.asked = false;
    } else if (userAnswer) {
      // Mark as asked after user provides an answer
      newSession.asked = true;
    }

    // Get local search results (top 30 candidates)
    const searchResults = searchProducts(catalog, query, 30);

    // If we have a user answer or session is already asked, use LLM to refine
    let constraints = extractConstraints(query);
    let finalProducts = searchResults.map((r) => r.product);

    if (userAnswer || newSession.asked) {
      // Generate shopping brief from LLM
      const brief = await generateShoppingBrief(
        provider as "openai" | "anthropic",
        query,
        userAnswer
      );

      // Merge LLM constraints with extracted constraints
      constraints = {
        budgetMax: brief.budgetMax ?? constraints.budgetMax,
        category: brief.category ?? constraints.category,
        color: brief.color ?? constraints.color,
        occasion: brief.occasion ?? constraints.occasion,
        style: brief.style ?? constraints.style,
      };

      // Re-search with merged constraints
      const refinedResults = searchProducts(catalog, query, 30);
      finalProducts = refinedResults.map((r) => r.product);
    }

    // Get top 24 products
    const topProducts = finalProducts.slice(0, 24);

    // Generate reasons using LLM (only if we have API keys, otherwise use local)
    const productSummaries = topProducts.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      category: p.category,
      price: p.price,
    }));

    const reasons = await generateProductReasons(
      provider as "openai" | "anthropic",
      productSummaries,
      query,
      userAnswer
    );

    // Format results with reasons
    const results = topProducts.map((product, idx) => ({
      id: product.id,
      title: product.title,
      brand: product.brand,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      color: product.color,
      reasons: reasons[idx] || ["Matches your search", "Good quality", "Great value"],
    }));

    return NextResponse.json({
      intent,
      assistantQuestion,
      session: assistantQuestion || newSession.asked ? newSession : null,
      constraints: {
        budgetMax: constraints.budgetMax ?? null,
        category: constraints.category ?? null,
        color: constraints.color ?? null,
        colorExclude: (constraints as any).colorExclude ?? null,
        occasion: constraints.occasion ?? null,
        style: constraints.style ?? null,
      },
      results,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
