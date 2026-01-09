import type { Product } from "./catalog";
import { AUDIENCE_CATEGORIES } from "./catalog";

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
  excludeCategories?: string[] | null;
  sortBy?: "relevance" | "price_asc" | "price_desc";
};

/**
 * Synonym dictionary for common fashion terms
 */
const SYNONYMS: Record<string, string[]> = {
  "shoe": ["sneaker", "loafer", "derby", "heel", "flat", "footwear"],
  "shoes": ["sneakers", "trainers", "athletic shoes", "runners", "footwear"],
  "sneaker": ["sneakers", "trainers", "athletic shoes", "runners"],
  "snikers": ["sneakers", "sneaker"], // Common typo
  "sneakers": ["sneaker", "trainers", "athletic shoes", "runners"],
  "shirt": ["shirts", "blouse", "top", "tee", "t-shirt"],
  "shirts": ["shirt", "blouse", "top", "tee", "t-shirt"],
  "pants": ["trousers", "chinos", "jeans", "slacks"],
  "trousers": ["pants", "chinos", "jeans", "slacks"],
  "jacket": ["blazer", "coat", "outerwear"],
  "blazer": ["jacket", "coat", "blazers"],
  "bag": ["handbag", "purse", "clutch", "tote"],
  "handbag": ["bag", "purse", "clutch", "tote"],
  "purse": ["handbag", "bag", "clutch", "tote"],
};

/**
 * Common typo corrections
 */
const TYPO_CORRECTIONS: Record<string, string> = {
  "snikers": "sneakers",
  "sniker": "sneaker",
  "trainers": "sneakers",
  "trainer": "sneaker",
};

/**
 * Expand query tokens using synonyms
 */
function expandSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>();
  
  for (const token of tokens) {
    expanded.add(token); // Always include original token
    
    // Apply typo correction first
    const corrected = TYPO_CORRECTIONS[token.toLowerCase()] || token.toLowerCase();
    if (corrected !== token.toLowerCase()) {
      expanded.add(corrected);
    }
    
    // Add synonyms
    const synonyms = SYNONYMS[token.toLowerCase()] || SYNONYMS[corrected] || [];
    for (const synonym of synonyms) {
      expanded.add(synonym.toLowerCase());
      // Also add singular/plural variations
      if (synonym.endsWith("s") && synonym.length > 1) {
        expanded.add(synonym.slice(0, -1).toLowerCase());
      } else if (!synonym.endsWith("s")) {
        expanded.add((synonym + "s").toLowerCase());
      }
    }
    
    // Handle plural/singular variations
    if (token.endsWith("s") && token.length > 1) {
      const singular = token.slice(0, -1).toLowerCase();
      expanded.add(singular);
      const singularSynonyms = SYNONYMS[singular] || [];
      for (const synonym of singularSynonyms) {
        expanded.add(synonym.toLowerCase());
      }
    } else if (!token.endsWith("s")) {
      const plural = (token + "s").toLowerCase();
      expanded.add(plural);
      const pluralSynonyms = SYNONYMS[plural] || [];
      for (const synonym of pluralSynonyms) {
        expanded.add(synonym.toLowerCase());
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * Calculate Levenshtein distance between two strings (simple version)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];
  
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Fuzzy match category/color with typo tolerance
 */
function fuzzyMatchCategory(category: string, query: string, threshold: number = 2): boolean {
  const categoryLower = category.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match first
  if (categoryLower.includes(queryLower) || queryLower.includes(categoryLower)) {
    return true;
  }
  
  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(categoryLower, queryLower);
  const maxLength = Math.max(categoryLower.length, queryLower.length);
  
  // Only use fuzzy if the distance is small relative to length
  if (maxLength > 0 && distance <= threshold && distance / maxLength < 0.3) {
    return true;
  }
  
  return false;
}

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
export function extractConstraints(query: string, audience?: "men" | "women" | "unisex" | null): SearchConstraints {
  const constraints: SearchConstraints = {};
  
  // Apply typo correction to query BEFORE extracting constraints
  let correctedQuery = query.toLowerCase();
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    correctedQuery = correctedQuery.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correction);
  }
  const lowerQuery = correctedQuery; // Use corrected query for all checks

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

  // Category extraction with typo correction
  const categories = [
    "shirts", "trousers", "jeans", "t-shirts", "t shirts", "blazers",
    "dresses", "sneakers", "loafers", "derbies", "heels", "flats",
    "handbags", "watches", "polos", "chinos", "blouses", "skirts",
    "clutches", "overshirts", "hoodies", "jackets", "backpacks",
    "sunglasses", "beanies", "tees"
  ];

  // Check for specific category matches (after typo correction)
  let foundSpecificCategory = false;
  for (const category of categories) {
    // Use word boundary to match whole words only
    const categoryRegex = new RegExp(`\\b${category}\\b`, 'i');
    if (categoryRegex.test(lowerQuery)) {
      const properCategory = 
        category === "t-shirts" || category === "t shirts" ? "T-Shirts" :
        category.charAt(0).toUpperCase() + category.slice(1);
      constraints.category = properCategory; // Hard filter
      foundSpecificCategory = true;
      break;
    }
  }

  // Only if no specific category found, check for general "shoe" term
  if (!foundSpecificCategory && lowerQuery.includes("shoe")) {
    let footwear = ["Sneakers", "Loafers", "Derbies", "Heels", "Flats"];
    if (audience === "men") {
      footwear = footwear.filter(c => ["Sneakers", "Loafers", "Derbies"].includes(c));
    } else if (audience === "women") {
      footwear = footwear.filter(c => ["Sneakers", "Flats", "Heels"].includes(c));
    } else if (audience === "unisex") {
      footwear = ["Sneakers"];
    }
    constraints.includeKeywords = footwear;
  }

  // Color exclusion extraction (check first for "no black", "exclude black", etc.)
  // Use corrected query for color extraction too
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
  // Use corrected query for color extraction
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
 * Tokenize query into search terms and expand with synonyms
 */
function tokenizeQuery(query: string): string[] {
  const baseTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2) // Filter out very short tokens
    .filter((token) => !/^(the|and|or|for|with|under|below|max)$/i.test(token)); // Filter common words
  
  // Expand with synonyms
  const expanded = expandSynonyms(baseTokens);
  
  return Array.from(expanded);
}

/**
 * Calculate relevance score for a product based on query tokens
 */
function calculateScore(
  product: Product,
  tokens: string[],
  constraints: SearchConstraints,
  originalQuery: string = ""
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

  // Track original query tokens (before synonym expansion) for exact match bonus
  const originalQueryLower = originalQuery.toLowerCase();
  const originalTokens = originalQueryLower
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter((token) => !/^(the|and|or|for|with|under|below|max)$/i.test(token));

  for (const token of tokens) {
    const isOriginalToken = originalTokens.some(orig => orig === token || orig.includes(token) || token.includes(orig));
    const matchBonus = isOriginalToken ? 2 : 0; // Bonus for exact query matches
    
    // Title matches (highest weight)
    if (product.title.toLowerCase().includes(token)) {
      score += 10 + matchBonus;
    }

    // Brand matches
    if (product.brand.toLowerCase().includes(token)) {
      score += 8 + matchBonus;
    }

    // Category matches (with fuzzy matching fallback)
    if (product.category.toLowerCase().includes(token)) {
      score += 7 + matchBonus;
    } else if (fuzzyMatchCategory(product.category, token)) {
      score += 5; // Lower score for fuzzy matches
    }

    // Color matches (with fuzzy matching fallback)
    if (product.color.toLowerCase().includes(token)) {
      score += 6 + matchBonus;
    } else if (fuzzyMatchCategory(product.color, token)) {
      score += 4; // Lower score for fuzzy matches
    }

    // Style matches
    if (product.style.toLowerCase().includes(token)) {
      score += 5 + matchBonus;
    }

    // Occasion tag matches
    if (
      product.occasionTags.some((tag) =>
        tag.toLowerCase().includes(token)
      )
    ) {
      score += 4 + matchBonus;
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
function preFilter(product: Product, constraints: SearchConstraints, audience?: "men" | "women" | "unisex" | null): boolean {
  // Audience-based category filtering
  if (audience && AUDIENCE_CATEGORIES[audience]) {
    const allowedCategories = AUDIENCE_CATEGORIES[audience];
    if (!allowedCategories.includes(product.category)) {
      return false;
    }
  }

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
    // Additional check: ensure keyword is valid for audience
    if (audience && AUDIENCE_CATEGORIES[audience]) {
      const allowedCategories = AUDIENCE_CATEGORIES[audience];
      if (!allowedCategories.includes(product.category)) {
        return false;
      }
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

  // Category exclusion filter
  if (constraints.excludeCategories && constraints.excludeCategories.length > 0) {
    if (constraints.excludeCategories.includes(product.category)) {
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
  limit: number = 24,
  audience?: "men" | "women" | "unisex" | null,
  sortBy: "relevance" | "price_asc" | "price_desc" = "relevance"
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const tokens = tokenizeQuery(query);
  const constraints = extractConstraints(query, audience);
  constraints.sortBy = sortBy;

  // Step 1: Quick pre-filter to reduce the number of products we need to score
  const preFiltered = products.filter((product) => preFilter(product, constraints, audience));

  // Step 2: Score only the pre-filtered products
  let scored: SearchResult[] = preFiltered
    .map((product) => ({
      product,
      score: calculateScore(product, tokens, constraints, query),
    }))
    .filter((result) => result.score >= 0) // Remove any that failed scoring
    .sort((a, b) => b.score - a.score); // Sort by score descending

  // Apply sorting if specified
  if (sortBy === "price_asc") {
    scored = scored.sort((a, b) => {
      if (a.score !== b.score && Math.abs(a.score - b.score) > 5) {
        // Only use price as primary sort if scores are very close
        return b.score - a.score;
      }
      return a.product.price - b.product.price;
    });
  } else if (sortBy === "price_desc") {
    scored = scored.sort((a, b) => {
      if (a.score !== b.score && Math.abs(a.score - b.score) > 5) {
        // Only use price as primary sort if scores are very close
        return b.score - a.score;
      }
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
  if (constraints.excludeCategories && constraints.excludeCategories.length > 0) {
    chips.push(...constraints.excludeCategories.map((cat) => `Exclude ${cat}`));
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


