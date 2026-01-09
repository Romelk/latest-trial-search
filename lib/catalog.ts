import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type Product = {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageUrl: string;
  category: string;
  color: string;
  size?: string;
  fit?: string;
  occasionTags: string[];
  style: string;
  description: string;
  scenarioId: "nyc_dinner" | "summer_wedding" | "biz_travel" | "chi_winter" | "campus";
  audience: "men" | "women" | "unisex";
  formality: "relaxed" | "smart_casual" | "formal" | "festive" | "outdoor";
  palette: "neutral" | "cool" | "warm";
  bundleRole: "anchor" | "core" | "add_on";
  inStock: boolean;
  stockCount: number;
  deliveryDays: number;
  season: "all" | "summer" | "winter";
};

// Audience-specific category definitions
export const AUDIENCE_CATEGORIES = {
  men: ["Shirts", "Polos", "Chinos", "Jeans", "Tees", "Blazers", "Sneakers", "Loafers", "Derbies"],
  women: ["Dresses", "Blouses", "Trousers", "Skirts", "Tees", "Blazers", "Sneakers", "Flats", "Heels", "Clutches"],
  unisex: ["Tees", "Overshirts", "Hoodies", "Jackets", "Trousers", "Sneakers", "Backpacks", "Sunglasses", "Beanies"],
};

// Scenario definitions
type Scenario = {
  id: "nyc_dinner" | "summer_wedding" | "biz_travel" | "chi_winter" | "campus";
  name: string;
  formality: "relaxed" | "smart_casual" | "formal" | "festive" | "outdoor";
  palette: "neutral" | "cool" | "warm";
  colors: string[];
  priceRange: { min: number; max: number };
  occasionTags: string[];
  deliveryDays: { min: number; max: number };
  season: "all" | "summer" | "winter";
  heroProducts: Record<"men" | "women" | "unisex", Array<{
    id: string;
    category: string;
    color: string;
    title: string;
    bundleRole: "anchor" | "core" | "add_on";
    price: number;
  }>>;
};

const SCENARIOS: Scenario[] = [
  {
    id: "nyc_dinner",
    name: "NYC Work Dinner",
    formality: "smart_casual",
    palette: "neutral",
    colors: ["Navy", "Gray", "Black", "White", "Beige"],
    priceRange: { min: 89, max: 450 },
    occasionTags: ["Work", "Evening", "Office"],
    deliveryDays: { min: 1, max: 2 },
    season: "all",
    heroProducts: {
      men: [
        { id: "prod-nyc-men-001", category: "Blazers", color: "Navy", title: "Navy Smart Blazer", bundleRole: "anchor", price: 289 },
        { id: "prod-nyc-men-002", category: "Shirts", color: "White", title: "Crisp White Dress Shirt", bundleRole: "core", price: 89 },
        { id: "prod-nyc-men-003", category: "Chinos", color: "Gray", title: "Gray Chino Trousers", bundleRole: "core", price: 129 },
        { id: "prod-nyc-men-004", category: "Loafers", color: "Brown", title: "Brown Leather Loafers", bundleRole: "core", price: 199 },
        { id: "prod-nyc-men-005", category: "Shirts", color: "Navy", title: "Navy Button-Down Shirt", bundleRole: "add_on", price: 79 },
        { id: "prod-nyc-men-006", category: "Blazers", color: "Black", title: "Classic Black Blazer", bundleRole: "add_on", price: 279 },
      ],
      women: [
        { id: "prod-nyc-wom-001", category: "Blazers", color: "Navy", title: "Navy Tailored Blazer", bundleRole: "anchor", price: 299 },
        { id: "prod-nyc-wom-002", category: "Blouses", color: "White", title: "Silk White Blouse", bundleRole: "core", price: 89 },
        { id: "prod-nyc-wom-003", category: "Trousers", color: "Gray", title: "Gray Wide-Leg Trousers", bundleRole: "core", price: 119 },
        { id: "prod-nyc-wom-004", category: "Heels", color: "Black", title: "Black Pumps", bundleRole: "core", price: 149 },
        { id: "prod-nyc-wom-005", category: "Clutches", color: "Black", title: "Evening Clutch", bundleRole: "add_on", price: 89 },
        { id: "prod-nyc-wom-006", category: "Dresses", color: "Navy", title: "Navy Wrap Dress", bundleRole: "add_on", price: 159 },
      ],
      unisex: [
        { id: "prod-nyc-uni-001", category: "Blazers", color: "Navy", title: "Unisex Navy Blazer", bundleRole: "anchor", price: 269 },
        { id: "prod-nyc-uni-002", category: "Overshirts", color: "White", title: "White Overshirt", bundleRole: "core", price: 79 },
        { id: "prod-nyc-uni-003", category: "Trousers", color: "Gray", title: "Gray Tailored Trousers", bundleRole: "core", price: 109 },
        { id: "prod-nyc-uni-004", category: "Sneakers", color: "White", title: "White Minimalist Sneakers", bundleRole: "core", price: 129 },
        { id: "prod-nyc-uni-005", category: "Backpacks", color: "Black", title: "Leather Backpack", bundleRole: "add_on", price: 199 },
        { id: "prod-nyc-uni-006", category: "Sunglasses", color: "Black", title: "Classic Aviators", bundleRole: "add_on", price: 89 },
      ],
    },
  },
  {
    id: "summer_wedding",
    name: "Summer Outdoor Wedding",
    formality: "festive",
    palette: "warm",
    colors: ["Beige", "Navy", "Pink", "White", "Yellow"],
    priceRange: { min: 79, max: 350 },
    occasionTags: ["Wedding", "Party", "Evening"],
    deliveryDays: { min: 2, max: 5 },
    season: "summer",
    heroProducts: {
      men: [
        { id: "prod-wed-men-001", category: "Blazers", color: "Navy", title: "Navy Linen Blazer", bundleRole: "anchor", price: 249 },
        { id: "prod-wed-men-002", category: "Shirts", color: "White", title: "White Linen Shirt", bundleRole: "core", price: 89 },
        { id: "prod-wed-men-003", category: "Chinos", color: "Beige", title: "Beige Chinos", bundleRole: "core", price: 119 },
        { id: "prod-wed-men-004", category: "Loafers", color: "Brown", title: "Brown Suede Loafers", bundleRole: "core", price: 149 },
        { id: "prod-wed-men-005", category: "Polos", color: "Navy", title: "Navy Polo Shirt", bundleRole: "add_on", price: 69 },
        { id: "prod-wed-men-006", category: "Derbies", color: "Brown", title: "Brown Leather Derbies", bundleRole: "add_on", price: 179 },
      ],
      women: [
        { id: "prod-wed-wom-001", category: "Dresses", color: "Beige", title: "Elegant Beige Midi Dress", bundleRole: "anchor", price: 189 },
        { id: "prod-wed-wom-002", category: "Blazers", color: "Navy", title: "Navy Summer Blazer", bundleRole: "core", price: 249 },
        { id: "prod-wed-wom-003", category: "Heels", color: "Nude", title: "Nude Heels", bundleRole: "core", price: 129 },
        { id: "prod-wed-wom-004", category: "Clutches", color: "Beige", title: "Beige Clutch Bag", bundleRole: "add_on", price: 89 },
        { id: "prod-wed-wom-005", category: "Dresses", color: "Pink", title: "Floral Pink Dress", bundleRole: "add_on", price: 159 },
        { id: "prod-wed-wom-006", category: "Blouses", color: "White", title: "White Floral Blouse", bundleRole: "add_on", price: 79 },
      ],
      unisex: [
        { id: "prod-wed-uni-001", category: "Jackets", color: "Beige", title: "Beige Linen Jacket", bundleRole: "anchor", price: 199 },
        { id: "prod-wed-uni-002", category: "Overshirts", color: "White", title: "White Linen Overshirt", bundleRole: "core", price: 89 },
        { id: "prod-wed-uni-003", category: "Trousers", color: "Navy", title: "Navy Linen Trousers", bundleRole: "core", price: 119 },
        { id: "prod-wed-uni-004", category: "Sneakers", color: "White", title: "White Canvas Sneakers", bundleRole: "core", price: 99 },
        { id: "prod-wed-uni-005", category: "Sunglasses", color: "Brown", title: "Brown Aviators", bundleRole: "add_on", price: 79 },
        { id: "prod-wed-uni-006", category: "Backpacks", color: "Beige", title: "Beige Canvas Backpack", bundleRole: "add_on", price: 89 },
      ],
    },
  },
  {
    id: "biz_travel",
    name: "Business Travel Capsule",
    formality: "smart_casual",
    palette: "neutral",
    colors: ["Navy", "Gray", "Black", "White", "Beige"],
    priceRange: { min: 59, max: 320 },
    occasionTags: ["Travel", "Work", "Office"],
    deliveryDays: { min: 1, max: 3 },
    season: "all",
    heroProducts: {
      men: [
        { id: "prod-trv-men-001", category: "Blazers", color: "Navy", title: "Wrinkle-Free Travel Blazer", bundleRole: "anchor", price: 279 },
        { id: "prod-trv-men-002", category: "Shirts", color: "White", title: "Non-Iron Dress Shirt", bundleRole: "core", price: 79 },
        { id: "prod-trv-men-003", category: "Chinos", color: "Navy", title: "Stretch Travel Chinos", bundleRole: "core", price: 119 },
        { id: "prod-trv-men-004", category: "Sneakers", color: "White", title: "Comfortable White Sneakers", bundleRole: "core", price: 129 },
        { id: "prod-trv-men-005", category: "Shirts", color: "Blue", title: "Wrinkle-Resistant Blue Shirt", bundleRole: "add_on", price: 69 },
        { id: "prod-trv-men-006", category: "Polos", color: "Navy", title: "Navy Travel Polo", bundleRole: "add_on", price: 59 },
      ],
      women: [
        { id: "prod-trv-wom-001", category: "Blazers", color: "Navy", title: "Wrinkle-Free Blazer", bundleRole: "anchor", price: 269 },
        { id: "prod-trv-wom-002", category: "Blouses", color: "White", title: "Non-Iron White Blouse", bundleRole: "core", price: 79 },
        { id: "prod-trv-wom-003", category: "Trousers", color: "Navy", title: "Stretch Travel Trousers", bundleRole: "core", price: 109 },
        { id: "prod-trv-wom-004", category: "Sneakers", color: "White", title: "Comfortable White Sneakers", bundleRole: "core", price: 119 },
        { id: "prod-trv-wom-005", category: "Clutches", color: "Black", title: "Travel Clutch", bundleRole: "add_on", price: 89 },
        { id: "prod-trv-wom-006", category: "Blouses", color: "Blue", title: "Wrinkle-Resistant Blue Blouse", bundleRole: "add_on", price: 69 },
      ],
      unisex: [
        { id: "prod-trv-uni-001", category: "Jackets", color: "Navy", title: "Travel Jacket", bundleRole: "anchor", price: 249 },
        { id: "prod-trv-uni-002", category: "Overshirts", color: "White", title: "White Travel Overshirt", bundleRole: "core", price: 79 },
        { id: "prod-trv-uni-003", category: "Trousers", color: "Navy", title: "Stretch Travel Trousers", bundleRole: "core", price: 109 },
        { id: "prod-trv-uni-004", category: "Sneakers", color: "White", title: "Comfortable White Sneakers", bundleRole: "core", price: 119 },
        { id: "prod-trv-uni-005", category: "Backpacks", color: "Black", title: "Carry-On Travel Backpack", bundleRole: "add_on", price: 199 },
        { id: "prod-trv-uni-006", category: "Tees", color: "Navy", title: "Navy Travel Tee", bundleRole: "add_on", price: 39 },
      ],
    },
  },
  {
    id: "chi_winter",
    name: "Chicago Winter Commute",
    formality: "smart_casual",
    palette: "cool",
    colors: ["Navy", "Gray", "Black", "Brown", "Olive"],
    priceRange: { min: 69, max: 380 },
    occasionTags: ["Work", "Office", "Casual"],
    deliveryDays: { min: 2, max: 4 },
    season: "winter",
    heroProducts: {
      men: [
        { id: "prod-chi-men-001", category: "Blazers", color: "Navy", title: "Warm Wool Blazer", bundleRole: "anchor", price: 329 },
        { id: "prod-chi-men-002", category: "Chinos", color: "Gray", title: "Insulated Winter Chinos", bundleRole: "core", price: 139 },
        { id: "prod-chi-men-003", category: "Shirts", color: "White", title: "Long-Sleeve Dress Shirt", bundleRole: "core", price: 89 },
        { id: "prod-chi-men-004", category: "Sneakers", color: "Black", title: "Weatherproof Black Sneakers", bundleRole: "core", price: 149 },
        { id: "prod-chi-men-005", category: "Blazers", color: "Black", title: "Classic Black Blazer", bundleRole: "add_on", price: 279 },
        { id: "prod-chi-men-006", category: "Polos", color: "Navy", title: "Long-Sleeve Polo", bundleRole: "add_on", price: 69 },
      ],
      women: [
        { id: "prod-chi-wom-001", category: "Blazers", color: "Navy", title: "Warm Wool Blazer", bundleRole: "anchor", price: 319 },
        { id: "prod-chi-wom-002", category: "Trousers", color: "Gray", title: "Insulated Winter Trousers", bundleRole: "core", price: 129 },
        { id: "prod-chi-wom-003", category: "Blouses", color: "White", title: "Long-Sleeve Blouse", bundleRole: "core", price: 79 },
        { id: "prod-chi-wom-004", category: "Sneakers", color: "Black", title: "Weatherproof Black Sneakers", bundleRole: "core", price: 139 },
        { id: "prod-chi-wom-005", category: "Clutches", color: "Brown", title: "Leather Briefcase", bundleRole: "add_on", price: 229 },
        { id: "prod-chi-wom-006", category: "Blazers", color: "Black", title: "Classic Black Blazer", bundleRole: "add_on", price: 269 },
      ],
      unisex: [
        { id: "prod-chi-uni-001", category: "Jackets", color: "Navy", title: "Warm Wool Jacket", bundleRole: "anchor", price: 299 },
        { id: "prod-chi-uni-002", category: "Trousers", color: "Gray", title: "Insulated Winter Trousers", bundleRole: "core", price: 119 },
        { id: "prod-chi-uni-003", category: "Hoodies", color: "Black", title: "Warm Fleece Hoodie", bundleRole: "core", price: 89 },
        { id: "prod-chi-uni-004", category: "Sneakers", color: "Black", title: "Weatherproof Black Sneakers", bundleRole: "core", price: 139 },
        { id: "prod-chi-uni-005", category: "Backpacks", color: "Brown", title: "Leather Backpack", bundleRole: "add_on", price: 239 },
        { id: "prod-chi-uni-006", category: "Beanies", color: "Black", title: "Wool Beanie", bundleRole: "add_on", price: 29 },
      ],
    },
  },
  {
    id: "campus",
    name: "Back-to-School Essentials",
    formality: "relaxed",
    palette: "cool",
    colors: ["Blue", "Black", "Gray", "White", "Navy"],
    priceRange: { min: 29, max: 180 },
    occasionTags: ["Casual", "Sports", "Travel"],
    deliveryDays: { min: 3, max: 7 },
    season: "all",
    heroProducts: {
      men: [
        { id: "prod-cmp-men-001", category: "Tees", color: "Blue", title: "Classic Blue T-Shirt", bundleRole: "anchor", price: 29 },
        { id: "prod-cmp-men-002", category: "Jeans", color: "Blue", title: "Comfortable Blue Jeans", bundleRole: "core", price: 79 },
        { id: "prod-cmp-men-003", category: "Sneakers", color: "White", title: "White Athletic Sneakers", bundleRole: "core", price: 89 },
        { id: "prod-cmp-men-004", category: "Tees", color: "Gray", title: "Gray Casual T-Shirt", bundleRole: "add_on", price: 24 },
        { id: "prod-cmp-men-005", category: "Sneakers", color: "Black", title: "Black Everyday Sneakers", bundleRole: "add_on", price: 79 },
        { id: "prod-cmp-men-006", category: "Polos", color: "Navy", title: "Navy Polo Shirt", bundleRole: "add_on", price: 49 },
      ],
      women: [
        { id: "prod-cmp-wom-001", category: "Tees", color: "Blue", title: "Classic Blue T-Shirt", bundleRole: "anchor", price: 29 },
        { id: "prod-cmp-wom-002", category: "Trousers", color: "Navy", title: "Comfortable Navy Trousers", bundleRole: "core", price: 69 },
        { id: "prod-cmp-wom-003", category: "Sneakers", color: "White", title: "White Athletic Sneakers", bundleRole: "core", price: 89 },
        { id: "prod-cmp-wom-004", category: "Clutches", color: "Black", title: "Backpack Style Bag", bundleRole: "add_on", price: 59 },
        { id: "prod-cmp-wom-005", category: "Tees", color: "Gray", title: "Gray Casual T-Shirt", bundleRole: "add_on", price: 24 },
        { id: "prod-cmp-wom-006", category: "Flats", color: "Black", title: "Black Ballet Flats", bundleRole: "add_on", price: 49 },
      ],
      unisex: [
        { id: "prod-cmp-uni-001", category: "Tees", color: "Blue", title: "Classic Blue T-Shirt", bundleRole: "anchor", price: 29 },
        { id: "prod-cmp-uni-002", category: "Hoodies", color: "Gray", title: "Gray Campus Hoodie", bundleRole: "core", price: 69 },
        { id: "prod-cmp-uni-003", category: "Sneakers", color: "White", title: "White Athletic Sneakers", bundleRole: "core", price: 89 },
        { id: "prod-cmp-uni-004", category: "Backpacks", color: "Black", title: "Backpack Style Bag", bundleRole: "add_on", price: 59 },
        { id: "prod-cmp-uni-005", category: "Tees", color: "Black", title: "Black Casual T-Shirt", bundleRole: "add_on", price: 24 },
        { id: "prod-cmp-uni-006", category: "Beanies", color: "Navy", title: "Navy Beanie", bundleRole: "add_on", price: 19 },
      ],
    },
  },
];

const BRANDS = [
  "StyleCraft",
  "UrbanEdge",
  "ClassicWear",
  "ModernFit",
  "EliteFashion",
  "TrendSet",
  "PremiumStyle",
  "FashionHub",
  "DesignerWear",
  "LuxuryBrand",
];

const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Fitted"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const STYLES = [
  "Minimalist",
  "Vintage",
  "Contemporary",
  "Bohemian",
  "Classic",
  "Streetwear",
  "Elegant",
  "Sporty",
  "Casual",
  "Formal",
];

// Map scenario IDs to their product ID prefixes
function getScenarioPrefix(scenarioId: string): string {
  const prefixMap: Record<string, string> = {
    "nyc_dinner": "nyc",
    "summer_wedding": "wed",
    "biz_travel": "trv",
    "chi_winter": "chi",
    "campus": "cmp",
  };
  return prefixMap[scenarioId] || scenarioId.slice(0, 3);
}

function generateProductForScenario(
  scenario: Scenario,
  audience: "men" | "women" | "unisex",
  index: number,
  isHero: boolean = false
): Product {
  const scenarioPrefix = getScenarioPrefix(scenario.id);
  const audiencePrefix = audience === "men" ? "men" : audience === "women" ? "wom" : "uni";
  const heroProduct = isHero
    ? scenario.heroProducts[audience]?.find((h) => h.id === `prod-${scenarioPrefix}-${audiencePrefix}-${String(index + 1).padStart(3, "0")}`)
    : null;

  const categories = AUDIENCE_CATEGORIES[audience];
  let category = heroProduct
    ? heroProduct.category
    : categories[index % categories.length];
  
  // Hard constraint: men products must NEVER use "Tops" category
  if (audience === "men" && category === "Tops") {
    // Replace with a valid men's category
    category = categories.find((c) => c !== "Tops") || categories[0];
  }
  const color = heroProduct
    ? heroProduct.color
    : scenario.colors[index % scenario.colors.length];
  const brand = BRANDS[index % BRANDS.length];
  const fit = FITS[index % FITS.length];
  const size = SIZES[index % SIZES.length];
  const style = STYLES[index % STYLES.length];

  const occasionTags = [...scenario.occasionTags];
  if (scenario.formality === "smart_casual") {
    occasionTags.push("Casual");
  }

  // Generate price
  const price = heroProduct
    ? heroProduct.price
    : scenario.priceRange.min +
      Math.floor(
        ((index * 17) % (scenario.priceRange.max - scenario.priceRange.min + 1))
      );

  // Generate title - ensure men products never use "top", "blouse", or standalone "dress"/"dresses" in title
  // Note: "Dress Shirt" is a valid men's term and should be allowed
  let title: string;
  if (heroProduct) {
    title = heroProduct.title;
    // For hero products, ensure they don't have forbidden words (but allow "dress shirt")
    if (audience === "men") {
      const lowerTitle = title.toLowerCase();
      // Check for forbidden patterns: "top" (not part of "stop"), "blouse", standalone "dress" or "dresses"
      if (lowerTitle.includes("blouse") || 
          (lowerTitle.includes("dress") && !lowerTitle.includes("dress shirt") && !lowerTitle.includes("dress shirt"))) {
        // Replace forbidden words
        if (lowerTitle.includes("blouse")) {
          title = title.replace(/blouse/gi, "Shirt");
        }
        // Only replace standalone "dress" or "dresses", not "dress shirt"
        if (lowerTitle.includes("dress") && !lowerTitle.includes("dress shirt")) {
          const dressPattern = /\bdress(es)?\b/gi;
          title = title.replace(dressPattern, category);
        }
      }
      // Check for "top" but not as part of "stop" or other words
      if (/\btop\b/i.test(title) && !/\bstop\b/i.test(title)) {
        title = title.replace(/\btop\b/gi, "Shirt");
      }
    }
  } else {
    title = `${brand} ${category} - ${color}`;
    
    // For men audience, ensure title doesn't contain forbidden words
    if (audience === "men") {
      const lowerTitle = title.toLowerCase();
      // Check for forbidden patterns
      if (lowerTitle.includes("blouse") || 
          (lowerTitle.includes("dress") && !lowerTitle.includes("dress shirt"))) {
        if (lowerTitle.includes("blouse")) {
          title = title.replace(/blouse/gi, "Shirt");
        }
        if (lowerTitle.includes("dress") && !lowerTitle.includes("dress shirt")) {
          const dressPattern = /\bdress(es)?\b/gi;
          title = title.replace(dressPattern, category);
        }
      }
      if (/\btop\b/i.test(title) && !/\bstop\b/i.test(title)) {
        title = title.replace(/\btop\b/gi, "Shirt");
      }
    }
  }

  // Generate description - ensure men products never use inappropriate terms
  const descriptions = [
    `Perfect for ${scenario.name.toLowerCase()}. ${color} ${category.toLowerCase()} from ${brand}.`,
    `Stylish ${category.toLowerCase()} featuring ${style.toLowerCase()} design. Ideal for ${scenario.name.toLowerCase()}.`,
    `Comfortable ${fit.toLowerCase()} fit ${category.toLowerCase()} in ${color.toLowerCase()}.`,
    `High-quality ${category.toLowerCase()} by ${brand}. Designed for ${scenario.name.toLowerCase()}.`,
  ];
  let description = descriptions[index % descriptions.length];
  
  // For men audience, clean description of forbidden terms
  if (audience === "men") {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes("top") || lowerDesc.includes("blouse") || lowerDesc.includes("dress")) {
      description = description.replace(/top/gi, "shirt");
      description = description.replace(/blouse/gi, "shirt");
      description = description.replace(/dress/gi, category.toLowerCase());
    }
  }

  // Determine bundle role
  const bundleRole = heroProduct
    ? heroProduct.bundleRole
    : index < 2
    ? "anchor"
    : index < 4
    ? "core"
    : "add_on";

  // Generate stock info
  const inStock = Math.random() > 0.1; // 90% in stock
  const stockCount = inStock ? Math.floor(Math.random() * 50) + 5 : 0;

  // Generate delivery days
  const deliveryDays =
    scenario.deliveryDays.min +
    Math.floor(
      Math.random() * (scenario.deliveryDays.max - scenario.deliveryDays.min + 1)
    );

  // Generate product ID
  const productId = heroProduct
    ? heroProduct.id
    : `prod-${scenarioPrefix}-${audiencePrefix}-${String(index + 1).padStart(3, "0")}`;

  // Determine if category should have size/fit
  const hasSizeFit = !["Watches", "Handbags", "Clutches", "Sunglasses", "Beanies", "Backpacks"].includes(category);

  return {
    id: productId,
    title,
    brand,
    price,
    imageUrl: `/api/images/${productId}`,
    category,
    color,
    size: hasSizeFit ? size : undefined,
    fit: hasSizeFit ? fit : undefined,
    occasionTags,
    style,
    description,
    scenarioId: scenario.id,
    audience,
    formality: scenario.formality,
    palette: scenario.palette,
    bundleRole,
    inStock,
    stockCount,
    deliveryDays,
    season: scenario.season,
  };
}

export function generateCatalog(): Product[] {
  const products: Product[] = [];
  const audiences: Array<"men" | "women" | "unisex"> = ["men", "women", "unisex"];

  for (const scenario of SCENARIOS) {
    for (const audience of audiences) {
      // Generate 6 hero products first (with fixed IDs)
      const heroProducts = scenario.heroProducts[audience] || [];
      for (let i = 0; i < 6; i++) {
        if (heroProducts[i]) {
          products.push(generateProductForScenario(scenario, audience, i, true));
        }
      }

      // Generate remaining products (54 more to reach 60 per audience per scenario)
      for (let i = 6; i < 60; i++) {
        products.push(generateProductForScenario(scenario, audience, i, false));
      }
    }
  }

  return products;
}

// In-memory cache for the catalog
let catalogCache: Product[] | null = null;
let catalogCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export function loadCatalog(): Product[] {
  // Return cached catalog if still valid
  if (catalogCache && Date.now() - catalogCacheTime < CACHE_TTL) {
    return catalogCache;
  }

  const catalogPath = join(process.cwd(), "data", "catalog.json");
  
  if (!existsSync(catalogPath)) {
    console.log("Catalog not found. Generating new scenario-based catalog...");
    const products = generateCatalog();
    writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
    console.log(`Generated catalog with ${products.length} products across ${SCENARIOS.length} scenarios and 3 audiences`);
    catalogCache = products;
    catalogCacheTime = Date.now();
    return products;
  }

  try {
    const fileContent = readFileSync(catalogPath, "utf-8");
    const products = JSON.parse(fileContent) as Product[];
    catalogCache = products;
    catalogCacheTime = Date.now();
    return products;
  } catch (error) {
    console.error("Error loading catalog:", error);
    // Fallback to generating
    const products = generateCatalog();
    writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
    catalogCache = products;
    catalogCacheTime = Date.now();
    return products;
  }
}

// Function to clear cache (useful for testing or when catalog is updated)
export function clearCatalogCache() {
  catalogCache = null;
  catalogCacheTime = 0;
}

