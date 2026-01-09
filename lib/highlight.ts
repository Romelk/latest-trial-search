/**
 * Synonym dictionary for common fashion terms (used for highlighting)
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
 * Highlight matching terms in text
 * This is a client-safe function that doesn't depend on Node.js modules
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || !text) return text;
  
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter((token) => !/^(the|and|or|for|with|under|below|max)$/i.test(token));
  
  // Also expand with synonyms for highlighting
  const expandedTokens = expandSynonyms(tokens);
  const allTokens = Array.from(new Set([...tokens, ...expandedTokens]));
  
  let highlighted = text;
  
  // Sort by length (longest first) to avoid partial matches
  const sortedTokens = allTokens.sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    if (token.length < 2) continue;
    
    // Find all occurrences (case-insensitive)
    const regex = new RegExp(`(${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  }
  
  return highlighted;
}

