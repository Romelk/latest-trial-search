import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { searchProducts, extractConstraints, inferAudience } from "@/lib/search";
import { generateShoppingBrief, generateProductReasons } from "@/lib/llm";
import { generateConstraintDelta } from "@/lib/llm/constraint-delta";

type Intent = "CLEAR" | "AMBIGUOUS" | "GOAL";

function detectIntent(query: string): Intent {
  const lowerQuery = query.toLowerCase().trim();

  // GOAL: includes context like occasion, event, "I need", "help me", "for my", "I have", "I want"
  const goalPatterns = [
    /i need/i,
    /help me/i,
    /for my/i,
    /looking for/i,
    /want to/i,
    /i want/i,  // "I want something" pattern
    /trying to/i,
    /need to/i,
    /i have/i,  // "I have a date night" pattern
    /i'm going/i,
    /i'm attending/i,
    /attending/i,
    /going to/i,
  ];

  for (const pattern of goalPatterns) {
    if (pattern.test(query)) {
      return "GOAL";
    }
  }

  // GOAL: includes context words about events/occasions (date night, wedding, dinner, party, weekend, etc.)
  const contextWords = [
    "date night",
    "wedding",
    "dinner",
    "party",
    "event",
    "occasion",
    "weekend",
    "evening",
    "night out",
    "meeting",
    "interview",
    "celebration",
    "vacation",
    "travel",
    "trip",
  ];

  for (const context of contextWords) {
    if (lowerQuery.includes(context)) {
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
    const { query, provider = "openai", userAnswer, session, followUp, constraintsOverride, audience } = await request.json();

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

      // Get audience from session or use provided
      const currentAudience = session.audience || audience || null;

      // Re-run search with merged constraints - first get candidates
      const searchResults = searchProducts(catalog, session.originalQuery, 100);
      
      // Apply merged constraints and audience filter to filter results
      const filteredProducts = searchResults
        .filter((r) => {
          // Apply audience filter if present
          if (currentAudience && r.product.audience !== currentAudience) {
            return false;
          }
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
        session: { ...session, asked: true, audience: currentAudience },
        audience: currentAudience,
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

    // Infer or get audience
    let currentAudience: "men" | "women" | "unisex" | null = null;
    
    // If audience is provided in request (from UI button click), use it
    if (audience && (audience === "men" || audience === "women" || audience === "unisex")) {
      currentAudience = audience;
    } else if (session?.audience) {
      // Use audience from existing session
      currentAudience = session.audience;
    } else if (userAnswer && (userAnswer.toLowerCase().includes("men") || userAnswer.toLowerCase().includes("women") || userAnswer.toLowerCase().includes("unisex"))) {
      // Parse audience from user answer
      const lowerAnswer = userAnswer.toLowerCase();
      if (lowerAnswer.includes("men")) {
        currentAudience = "men";
      } else if (lowerAnswer.includes("women")) {
        currentAudience = "women";
      } else if (lowerAnswer.includes("unisex")) {
        currentAudience = "unisex";
      }
    } else {
      // Try to infer from query
      currentAudience = inferAudience(query);
    }

    // Determine if we should ask audience question
    let assistantQuestion: string | null = null;
    let newSession = session || { originalQuery: query, asked: false, audience: null };

    // Ask audience question if audience is null and we haven't asked yet
    if (!currentAudience && !newSession.asked) {
      assistantQuestion = "Who is this for: Men, Women, or Unisex?";
      newSession.asked = false;
      newSession.audience = null;
    } else if (userAnswer && !currentAudience) {
      // If user provided answer but we still don't have audience, try to parse it
      const lowerAnswer = userAnswer.toLowerCase();
      if (lowerAnswer.includes("men")) {
        currentAudience = "men";
      } else if (lowerAnswer.includes("women")) {
        currentAudience = "women";
      } else if (lowerAnswer.includes("unisex")) {
        currentAudience = "unisex";
      }
      if (currentAudience) {
        newSession.audience = currentAudience;
        newSession.asked = true;
      }
    } else if (currentAudience) {
      // We have audience, mark session as set
      newSession.audience = currentAudience;
      newSession.asked = true;
    }

    // Filter catalog by audience if present
    let filteredCatalog = catalog;
    if (currentAudience) {
      filteredCatalog = catalog.filter((p) => p.audience === currentAudience);
    }

    // Extract constraints from query first
    let constraints = extractConstraints(query);
    
    // Get local search results (top 30 candidates) from filtered catalog
    // searchProducts already applies constraints internally, but we pass the query
    const searchResults = searchProducts(filteredCatalog, query, 100); // Get more candidates
    
    // Apply additional filters that might not be in searchProducts
    let filteredResults = searchResults
      .filter((r) => {
        // Apply budget filter explicitly (double-check)
        if (constraints.budgetMax !== null && constraints.budgetMax !== undefined) {
          if (r.product.price > constraints.budgetMax) {
            return false;
          }
        }
        // Apply color exclude explicitly (double-check)
        if (constraints.colorExclude) {
          if (r.product.color.toLowerCase() === constraints.colorExclude.toLowerCase()) {
            return false;
          }
        }
        return true;
      });
    
    let finalProducts = filteredResults.map((r) => r.product);

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
      scenarioId: product.scenarioId,
      reasons: reasons[idx] || ["Matches your search", "Good quality", "Great value"],
    }));

    // Extract scenarioId from first result (if available)
    const detectedScenarioId = topProducts[0]?.scenarioId || null;

    return NextResponse.json({
      intent,
      assistantQuestion,
      session: assistantQuestion || newSession.asked ? newSession : null,
      audience: currentAudience,
      scenarioId: detectedScenarioId,
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
