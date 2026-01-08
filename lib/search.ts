import type { Product } from "./catalog";

export type SearchConstraints = {
  budgetMax?: number;
  category?: string;
  color?: string;
  colorExclude?: string;
  occasion?: string;
  gender?: string;
  style?: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
};

export type SearchResult = {
  product: Product;
  score: number;
};

/**
 * Infer audience from query using light heuristics
 */
export function inferAudience(query: string): "men" | "women" | "unisex" | null {
  const lowerQuery = query.toLowerCase();

  // Men indicators
  const menPatterns = [
    /\bmen\b/,
    /\bmens\b/,
    /\bfor my husband\b/,
    /\bfor my boyfriend\b/,
    /\bfor him\b/,
  ];
  for (const pattern of menPatterns) {
    if (pattern.test(lowerQuery)) {
      return "men";
    }
  }

  // Women indicators
  const womenPatterns = [
    /\bwomen\b/,
    /\bwomens\b/,
    /\bdress\b/,
    /\bdresses\b/,
    /\bheels\b/,
    /\bfor my wife\b/,
    /\bfor my girlfriend\b/,
    /\bfor her\b/,
  ];
  for (const pattern of womenPatterns) {
    if (pattern.test(lowerQuery)) {
      return "women";
    }
  }

  // Unisex only for accessory categories
  const unisexAccessories = [
    /\bbackpack\b/,
    /\bbackpacks\b/,
    /\bbeanie\b/,
    /\bbeanies\b/,
    /\bgloves\b/,
    /\bsunglasses\b/,
  ];
  for (const pattern of unisexAccessories) {
    if (pattern.test(lowerQuery)) {
      return "unisex";
    }
  }

  return null;
}

/**
 * Extract constraints from search query using heuristics
 */
export function extractConstraints(query: string): SearchConstraints {
  const constraints: SearchConstraints = {};
  const lowerQuery = query.toLowerCase();

  // Budget extraction (USD) - handle various formats
  const budgetPatterns = [
    /(?:under|below|less than|max|maximum|upto|up to)\s*(?:\$|usd|dollars?)?\s*(\d+)/i,
    /(?:\$|usd|dollars?)\s*(\d+)\s*(?:and|or)\s*(?:below|under|less)/i,
    /(?:\$|usd|dollars?)\s*(\d+)\s*(?:max|maximum)/i,
    /(?:\$|usd|dollars?)\s*(\d+)/i, // Catch "$300" format
  ];

  for (const pattern of budgetPatterns) {
    const match = query.match(pattern);
    if (match) {
      constraints.budgetMax = parseInt(match[1], 10);
      break;
    }
  }

  // Category extraction
  const categories = [
    "shirts",
    "trousers",
    "jeans",
    "t-shirts",
    "t shirts",
    "blazers",
    "dresses",
    "sneakers",
    "loafers",
    "derbies",
    "heels",
    "flats",
    "handbags",
    "watches",
  ];

  // Special handling for "shoes" - it's a general term for footwear
  if (lowerQuery.includes("shoe")) {
    // Map "shoes" to a special keyword that will match all footwear categories
    constraints.includeKeywords = ["Sneakers", "Loafers", "Derbies", "Heels", "Flats"];
  } else {
    for (const category of categories) {
      if (lowerQuery.includes(category)) {
        // Map to proper category name
        const properCategory =
          category === "t-shirts" || category === "t shirts"
            ? "T-Shirts"
            : category.charAt(0).toUpperCase() + category.slice(1);
        constraints.category = properCategory;
        break;
      }
    }
  }

  // Color exclusion extraction (check first for "no black", "exclude black", etc.)
  const excludeColorPatterns = [
    /no\s+(\w+)/i,
    /exclude\s+(\w+)/i,
    /without\s+(\w+)/i,
    /not\s+(\w+)/i,
  ];
  
  const colors = [
    "black",
    "white",
    "navy",
    "gray",
    "grey",
    "beige",
    "brown",
    "blue",
    "red",
    "green",
    "pink",
    "purple",
    "yellow",
    "orange",
    "maroon",
    "olive",
  ];

  let foundExclude = false;
  for (const pattern of excludeColorPatterns) {
    const match = lowerQuery.match(pattern);
    if (match && colors.includes(match[1].toLowerCase())) {
      constraints.colorExclude =
        match[1].toLowerCase() === "grey" ? "Gray" : match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      foundExclude = true;
      break;
    }
  }

  // Color inclusion extraction (only if no exclusion found)
  if (!foundExclude) {
    for (const color of colors) {
      if (lowerQuery.includes(color)) {
        constraints.color =
          color === "grey" ? "Gray" : color.charAt(0).toUpperCase() + color.slice(1);
        break;
      }
    }
  }

  // Occasion extraction
  const occasions = [
    "casual",
    "formal",
    "party",
    "work",
    "wedding",
    "sports",
    "travel",
    "evening",
    "beach",
    "office",
  ];

  for (const occasion of occasions) {
    if (lowerQuery.includes(occasion)) {
      constraints.occasion =
        occasion.charAt(0).toUpperCase() + occasion.slice(1);
      break;
    }
  }

  // Gender extraction (simple heuristic)
  if (lowerQuery.includes("men") || lowerQuery.includes("male") || lowerQuery.includes("gents")) {
    constraints.gender = "Men";
  } else if (
    lowerQuery.includes("women") ||
    lowerQuery.includes("female") ||
    lowerQuery.includes("ladies")
  ) {
    constraints.gender = "Women";
  }

  // Style extraction
  const styles = [
    "minimalist",
    "vintage",
    "contemporary",
    "bohemian",
    "classic",
    "streetwear",
    "elegant",
    "sporty",
  ];

  for (const style of styles) {
    if (lowerQuery.includes(style)) {
      constraints.style =
        style.charAt(0).toUpperCase() + style.slice(1);
      break;
    }
  }

  return constraints;
}

/**
 * Tokenize query into search terms
 */
function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2) // Filter out very short tokens
    .filter((token) => !/^(the|and|or|for|with|under|below|max)$/i.test(token)); // Filter common words
}

/**
 * Calculate relevance score for a product based on query tokens
 */
function calculateScore(
  product: Product,
  tokens: string[],
  constraints: SearchConstraints
): number {
  let score = 0;

  // Note: Hard filters are now handled by preFilter() for better performance
  // This function only does scoring, so products passed here already match hard constraints

  // Soft scoring: token matches
  const productText = [
    product.title,
    product.brand,
    product.category,
    product.color,
    product.style,
    product.description,
    ...product.occasionTags,
  ]
    .join(" ")
    .toLowerCase();

  // Scenario matching boost - check if query mentions scenario keywords
  const scenarioMatches: Record<string, string[]> = {
    "summer_wedding": ["summer", "wedding", "outdoor", "festive"],
    "nyc_dinner": ["nyc", "new york", "dinner", "evening", "work"],
    "biz_travel": ["business", "travel", "trip", "airport"],
    "chi_winter": ["chicago", "winter", "cold", "snow"],
    "campus": ["campus", "college", "university", "school"],
  };
  
  if (product.scenarioId && scenarioMatches[product.scenarioId]) {
    const scenarioKeywords = scenarioMatches[product.scenarioId];
    const queryLower = tokens.join(" ").toLowerCase();
    for (const keyword of scenarioKeywords) {
      if (queryLower.includes(keyword)) {
        score += 15; // Strong boost for scenario match
        break;
      }
    }
  }

  for (const token of tokens) {
    // Title matches (highest weight)
    if (product.title.toLowerCase().includes(token)) {
      score += 10;
    }

    // Brand matches
    if (product.brand.toLowerCase().includes(token)) {
      score += 8;
    }

    // Category matches
    if (product.category.toLowerCase().includes(token)) {
      score += 7;
    }

    // Color matches
    if (product.color.toLowerCase().includes(token)) {
      score += 6;
    }

    // Style matches
    if (product.style.toLowerCase().includes(token)) {
      score += 5;
    }

    // Occasion tag matches
    if (
      product.occasionTags.some((tag) =>
        tag.toLowerCase().includes(token)
      )
    ) {
      score += 4;
    }

    // Description matches (lower weight)
    if (product.description.toLowerCase().includes(token)) {
      score += 2;
    }
    
    // ScenarioId matching (boost products from matching scenario)
    if (token === "summer" && product.scenarioId === "summer_wedding") {
      score += 8;
    }
    if (token === "wedding" && product.scenarioId === "summer_wedding") {
      score += 8;
    }
    if (token === "outdoor" && product.scenarioId === "summer_wedding") {
      score += 6;
    }
  }

  // Boost score for products that match extracted constraints
  if (constraints.category && product.category === constraints.category) {
    score += 5;
  }
  if (constraints.color && product.color === constraints.color) {
    score += 4;
  }
  if (
    constraints.occasion &&
    product.occasionTags.some(
      (tag) => tag.toLowerCase() === constraints.occasion!.toLowerCase()
    )
  ) {
    score += 3;
  }
  if (constraints.style && product.style === constraints.style) {
    score += 3;
  }

  // Price proximity bonus (if budget constraint exists)
  if (constraints.budgetMax) {
    const priceDiff = constraints.budgetMax - product.price;
    if (priceDiff > 0) {
      // Bonus for products well under budget
      score += Math.min(priceDiff / 100, 5);
    }
  }

  return score;
}

/**
 * Quick pre-filter based on hard constraints (before expensive scoring)
 */
function preFilter(product: Product, constraints: SearchConstraints): boolean {
  // Budget filter
  if (constraints.budgetMax && product.price > constraints.budgetMax) {
    return false;
  }

  // Category filter
  if (constraints.category && product.category !== constraints.category) {
    return false;
  }

  // Color include filter
  if (constraints.color && product.color !== constraints.color) {
    return false;
  }

  // Color exclude filter
  if (constraints.colorExclude && product.color.toLowerCase() === constraints.colorExclude.toLowerCase()) {
    return false;
  }

  // Include keywords filter (e.g., for "shoes" -> footwear categories)
  if (constraints.includeKeywords && constraints.includeKeywords.length > 0) {
    const productCategory = product.category.toLowerCase();
    const matches = constraints.includeKeywords.some((keyword) => 
      productCategory === keyword.toLowerCase()
    );
    if (!matches) {
      return false;
    }
  }

  // Exclude keywords filter
  if (constraints.excludeKeywords && constraints.excludeKeywords.length > 0) {
    const productText = [
      product.title,
      product.description,
      product.category,
      product.color,
    ].join(" ").toLowerCase();
    if (constraints.excludeKeywords.some((keyword) => productText.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  // Occasion filter
  if (
    constraints.occasion &&
    !product.occasionTags.some(
      (tag) => tag.toLowerCase() === constraints.occasion!.toLowerCase()
    )
  ) {
    return false;
  }

  // Style filter
  if (constraints.style && product.style !== constraints.style) {
    return false;
  }

  return true;
}

/**
 * Search products with scoring and filtering
 */
export function searchProducts(
  products: Product[],
  query: string,
  limit: number = 24
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const tokens = tokenizeQuery(query);
  const constraints = extractConstraints(query);

  // Step 1: Quick pre-filter to reduce the number of products we need to score
  const preFiltered = products.filter((product) => preFilter(product, constraints));

  // Step 2: Score only the pre-filtered products
  let scored: SearchResult[] = preFiltered
    .map((product) => ({
      product,
      score: calculateScore(product, tokens, constraints),
    }))
    .filter((result) => result.score >= 0) // Remove any that failed scoring
    .sort((a, b) => b.score - a.score); // Sort by score descending

  // Apply sorting if specified
  if ((constraints as any).sortBy === "price_asc") {
    scored = scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score; // Keep score as primary
      return a.product.price - b.product.price;
    });
  } else if ((constraints as any).sortBy === "price_desc") {
    scored = scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score; // Keep score as primary
      return b.product.price - a.product.price;
    });
  }

  return scored.slice(0, limit); // Take top N
}

/**
 * Get constraint chips for UI display
 */
export function getConstraintChips(constraints: SearchConstraints): string[] {
  const chips: string[] = [];

  if (constraints.budgetMax) {
    chips.push(`Under $${constraints.budgetMax}`);
  }
  if (constraints.category) {
    chips.push(constraints.category);
  }
  if (constraints.color) {
    chips.push(constraints.color);
  }
  if (constraints.colorExclude) {
    chips.push(`Exclude ${constraints.colorExclude}`);
  }
  if (constraints.occasion) {
    chips.push(constraints.occasion);
  }
  if (constraints.style) {
    chips.push(constraints.style);
  }
  if (constraints.gender) {
    chips.push(constraints.gender);
  }
  if (constraints.includeKeywords && constraints.includeKeywords.length > 0) {
    chips.push(...constraints.includeKeywords.map((k) => `Only ${k}`));
  }
  if (constraints.excludeKeywords && constraints.excludeKeywords.length > 0) {
    chips.push(...constraints.excludeKeywords.map((k) => `No ${k}`));
  }

  return chips;
}

