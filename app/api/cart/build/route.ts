import { NextRequest, NextResponse } from "next/server";
import { loadCatalog, type Product } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";
import { generateProductReasons } from "@/lib/llm";

// Audience category whitelists
const AUDIENCE_CATEGORY_WHITELIST: Record<"men" | "women" | "unisex", string[]> = {
  men: ["Shirts", "Polos", "Chinos", "Jeans", "Tees", "Blazers", "Sneakers", "Loafers", "Derbies"],
  women: ["Dresses", "Blouses", "Trousers", "Skirts", "Tees", "Blazers", "Sneakers", "Flats", "Heels", "Clutches"],
  unisex: ["Tees", "Overshirts", "Hoodies", "Jackets", "Trousers", "Sneakers", "Backpacks", "Sunglasses", "Beanies"],
};

type CartItem = {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageUrl: string;
  category: string;
  color: string;
  why: string;
  role: string; // Role field for bundle items
};

type Cart = {
  name: string;
  items: CartItem[];
  notes: string[];
};

// Role templates configuration
type RoleTemplate = {
  roles: Record<string, string[]>;
};

const ROLE_TEMPLATES: Record<string, Record<string, RoleTemplate[]>> = {
  nyc_dinner: {
    men: [
      {
        // Template A: Blazer + Shirt + Bottom + Footwear
        roles: {
          top: ["Shirts", "Polos"],
          bottom: ["Chinos", "Jeans", "Trousers", "Pants"],
          footwear: ["Loafers", "Derbies", "Sneakers"],
          addOn: ["Blazers"],
        },
      },
      {
        // Template B: Shirt + Bottom + Footwear (no blazer)
        roles: {
          top: ["Shirts", "Polos"],
          bottom: ["Chinos", "Jeans", "Trousers", "Pants"],
          footwear: ["Loafers", "Derbies", "Sneakers"],
        },
      },
    ],
    women: [
      {
        // Template A: Dress route
        roles: {
          primary: ["Dresses", "Dress", "Jumpsuit", "Jumpsuits"],
          footwear: ["Heels", "Flats", "Loafers", "Sneakers"],
          addOn: ["Blazers", "Jackets", "Clutches", "Handbags"],
        },
      },
      {
        // Template B: Separates route
        roles: {
          top: ["Blouses", "Tops", "Shirts"],
          bottom: ["Trousers", "Pants", "Skirts", "Jeans"],
          footwear: ["Heels", "Flats", "Loafers", "Sneakers"],
        },
      },
    ],
    unisex: [
      {
        // Template A: Top + Bottom + Footwear + Add-on
        roles: {
          top: ["Tees", "Overshirts"],
          bottom: ["Trousers", "Pants"],
          footwear: ["Sneakers"],
          addOn: ["Jackets", "Backpacks"],
        },
      },
      {
        // Template B: Top + Bottom + Footwear
        roles: {
          top: ["Tees", "Overshirts"],
          bottom: ["Trousers", "Pants"],
          footwear: ["Sneakers"],
        },
      },
    ],
  },
  summer_wedding: {
    men: [
      {
        roles: {
          top: ["Shirts", "Polos"],
          bottom: ["Chinos", "Trousers", "Pants"],
          footwear: ["Loafers", "Derbies"],
          addOn: ["Blazers"],
        },
      },
    ],
    women: [
      {
        roles: {
          primary: ["Dresses", "Dress"],
          footwear: ["Heels", "Flats"],
          addOn: ["Clutches", "Blazers"],
        },
      },
      {
        roles: {
          top: ["Blouses", "Tops"],
          bottom: ["Trousers", "Pants", "Skirts"],
          footwear: ["Heels", "Flats"],
        },
      },
    ],
    unisex: [
      {
        roles: {
          top: ["Tees", "Overshirts"],
          bottom: ["Trousers", "Pants"],
          footwear: ["Sneakers"],
          addOn: ["Jackets", "Sunglasses"],
        },
      },
    ],
  },
  biz_travel: {
    men: [
      {
        roles: {
          top: ["Shirts", "Polos", "Tees"],
          bottom: ["Chinos", "Trousers", "Pants"],
          footwear: ["Sneakers", "Loafers"],
          addOn: ["Blazers", "Jackets"],
        },
      },
    ],
    women: [
      {
        // Template A: Separates route
        roles: {
          top: ["Blouses", "Tops", "Tees"],
          bottom: ["Trousers", "Skirts"],
          footwear: ["Sneakers", "Flats"],
        },
      },
      {
        // Template B: With add-on
        roles: {
          top: ["Blouses", "Tops", "Tees"],
          bottom: ["Trousers", "Skirts"],
          footwear: ["Sneakers", "Flats"],
          addOn: ["Blazers", "Clutches"],
        },
      },
    ],
    unisex: [
      {
        roles: {
          top: ["Tees", "Overshirts"],
          bottom: ["Trousers", "Pants"],
          footwear: ["Sneakers"],
          addOn: ["Jackets", "Backpacks"],
        },
      },
    ],
  },
  chi_winter: {
    men: [
      {
        roles: {
          top: ["Shirts", "Polos", "Tees"],
          bottom: ["Chinos", "Jeans", "Trousers"],
          footwear: ["Sneakers", "Loafers", "Derbies"],
          addOn: ["Blazers", "Jackets"],
        },
      },
    ],
    women: [
      {
        // Template A: Dress route
        roles: {
          primary: ["Dresses", "Dress"],
          footwear: ["Sneakers", "Flats", "Heels"],
          addOn: ["Blazers", "Clutches"],
        },
      },
      {
        // Template B: Separates route
        roles: {
          top: ["Blouses", "Tops", "Tees"],
          bottom: ["Trousers", "Skirts", "Jeans"],
          footwear: ["Sneakers", "Flats", "Heels"],
        },
      },
      {
        // Template C: Separates with add-on
        roles: {
          top: ["Blouses", "Tops", "Tees"],
          bottom: ["Trousers", "Skirts", "Jeans"],
          footwear: ["Sneakers", "Flats", "Heels"],
          addOn: ["Blazers", "Clutches"],
        },
      },
    ],
    unisex: [
      {
        roles: {
          top: ["Tees", "Overshirts", "Hoodies"],
          bottom: ["Trousers", "Pants"],
          footwear: ["Sneakers"],
          addOn: ["Jackets", "Beanies"],
        },
      },
    ],
  },
  campus: {
    men: [
      {
        roles: {
          top: ["Tees", "Shirts", "Polos"],
          bottom: ["Jeans", "Chinos"],
          footwear: ["Sneakers"],
          addOn: ["Backpacks"],
        },
      },
    ],
    women: [
      {
        // Template A: Top + Bottom + Footwear
        roles: {
          top: ["Tees", "Blouses", "Tops"],
          bottom: ["Jeans", "Trousers", "Skirts"],
          footwear: ["Sneakers", "Flats"],
        },
      },
      {
        // Template B: With add-on
        roles: {
          top: ["Tees", "Blouses", "Tops"],
          bottom: ["Jeans", "Trousers", "Skirts"],
          footwear: ["Sneakers", "Flats"],
          addOn: ["Backpacks"],
        },
      },
    ],
    unisex: [
      {
        roles: {
          top: ["Tees", "Overshirts", "Hoodies"],
          bottom: ["Trousers", "Pants", "Jeans"],
          footwear: ["Sneakers"],
          addOn: ["Backpacks", "Beanies"],
        },
      },
    ],
  },
};

// Role classifier helper
function classifyProductRole(product: Product): {
  categoryNormalized: string;
  roleCandidates: string[];
} {
  const categoryLower = product.category.toLowerCase();
  const roles: string[] = [];
  
  // Primary (dresses, jumpsuits)
  if (['dress', 'dresses', 'jumpsuit', 'jumpsuits'].includes(categoryLower)) {
    roles.push('primary');
  }
  
  // Top
  if (['blouses', 'tops', 'shirts', 'tees', 't-shirts'].includes(categoryLower)) {
    roles.push('top');
  }
  
  // Bottom
  if (['trousers', 'pants', 'skirts', 'jeans', 'chinos'].includes(categoryLower)) {
    roles.push('bottom');
  }
  
  // Footwear
  if (['heels', 'flats', 'loafers', 'sneakers', 'derbies'].includes(categoryLower)) {
    roles.push('footwear');
  }
  
  // Add-on
  if (['blazers', 'jackets', 'clutches', 'handbags'].includes(categoryLower)) {
    roles.push('addOn');
  }
  
  return {
    categoryNormalized: categoryLower,
    roleCandidates: roles.length > 0 ? roles : ['item']
  };
}

// Score a product for a specific role in a bundle
function scoreProductForRole(
  product: Product,
  role: string,
  query: string,
  tier: "budget" | "balanced" | "premium",
  priceTiers: { budgetMax: number; balancedMin: number; balancedMax: number; premiumMin: number },
  otherItems: Product[]
): number {
  let score = 0;
  
  // Price tier match
  if (tier === "budget" && product.price <= priceTiers.budgetMax) score += 10;
  else if (tier === "balanced" && product.price >= priceTiers.balancedMin && product.price <= priceTiers.balancedMax) score += 10;
  else if (tier === "premium" && product.price >= priceTiers.premiumMin) score += 10;
  
  // Occasion tags match (evening, dinner, party)
  const lowerQuery = query.toLowerCase();
  const hasEvening = lowerQuery.includes("evening") || lowerQuery.includes("dinner") || lowerQuery.includes("party");
  if (hasEvening && product.occasionTags.some(tag => 
    tag.toLowerCase().includes("evening") || 
    tag.toLowerCase().includes("dinner") || 
    tag.toLowerCase().includes("party")
  )) {
    score += 5;
  }
  
  // Formality match
  if (lowerQuery.includes("formal") && product.formality === "formal") score += 5;
  if (lowerQuery.includes("smart") && product.formality === "smart_casual") score += 5;
  
  // Delivery alignment (within 2 days of each other)
  if (otherItems.length > 0) {
    const avgDelivery = otherItems.reduce((sum, p) => sum + p.deliveryDays, 0) / otherItems.length;
    const deliveryDiff = Math.abs(product.deliveryDays - avgDelivery);
    if (deliveryDiff <= 2) score += 3;
  }
  
  return score;
}

function buildCarts(
  candidates: Array<{ product: Product; score: number }>,
  provider: "openai" | "anthropic" | "gemini",
  query: string,
  preference: string | null | undefined,
  audience: "men" | "women" | "unisex" | null,
  scenarioId: string | null,
  allowUnisexMix: boolean = false,
  anchorProductId?: string | null
): { budget: CartItem[]; balanced: CartItem[]; premium: CartItem[] } {
  // Filter candidates by audience category whitelist and other constraints
  let products = candidates.map((c: { product: Product; score: number }) => c.product);
  
  // Hard filter: scenarioId AND audience
  if (scenarioId) {
    products = products.filter((p) => p.scenarioId === scenarioId);
  }
  
  if (audience) {
    // Filter by audience, with optional unisex mixing
    if (allowUnisexMix) {
      products = products.filter((p) => p.audience === audience || p.audience === "unisex");
    } else {
      products = products.filter((p) => p.audience === audience);
    }
    
    // Filter by category whitelist
    const allowedCategories = AUDIENCE_CATEGORY_WHITELIST[audience];
    products = products.filter((p) => allowedCategories.includes(p.category));
    
    // Hard guardrail: Block T-Shirts if query contains 'smart' AND ('evening' OR 'dinner' OR 'party') AND NOT ('casual' OR 'relaxed')
    const lowerQuery = query.toLowerCase();
    const hasSmart = lowerQuery.includes("smart");
    const hasEvening = lowerQuery.includes("evening") || lowerQuery.includes("dinner") || lowerQuery.includes("party");
    const hasCasualOrRelaxed = lowerQuery.includes("casual") || lowerQuery.includes("relaxed");
    
    if (hasSmart && hasEvening && !hasCasualOrRelaxed) {
      products = products.filter((p) => p.category !== "Tees" && p.category !== "T-Shirts");
    }
    
    // Color guardrail for Men: block pink unless explicitly requested
    if (audience === "men") {
      const pinkKeywords = ["pink", "magenta", "pastel", "bold", "pop color"];
      const hasPinkRequest = pinkKeywords.some((keyword) => lowerQuery.includes(keyword));
      
      if (!hasPinkRequest) {
        products = products.filter((p) => p.color.toLowerCase() !== "pink");
      }
    }
  }

  if (products.length < 3) {
    throw new Error("Not enough products after filtering");
  }

  // Sort by price for tier calculation
  const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
  const minPrice = sortedByPrice[0].price;
  const maxPrice = sortedByPrice[sortedByPrice.length - 1].price;
  const priceRange = maxPrice - minPrice;
  
  // Define price tiers using quantiles
  // If price range is very small (all products similar price), use simpler division
  let budgetMax: number;
  let balancedMin: number;
  let balancedMax: number;
  let premiumMin: number;
  
  if (priceRange < 10) {
    // Very small price range - divide products into thirds by index
    const third = Math.floor(sortedByPrice.length / 3);
    budgetMax = sortedByPrice[Math.max(third - 1, 0)].price;
    balancedMin = sortedByPrice[third].price;
    balancedMax = sortedByPrice[Math.min(third * 2, sortedByPrice.length - 1)].price;
    premiumMin = sortedByPrice[Math.min(third * 2 + 1, sortedByPrice.length - 1)].price;
  } else {
    budgetMax = minPrice + priceRange * 0.33;
    balancedMin = minPrice + priceRange * 0.33;
    balancedMax = minPrice + priceRange * 0.67;
    premiumMin = minPrice + priceRange * 0.67;
  }

  // Get templates for this scenario + audience
  const templates = scenarioId && audience 
    ? ROLE_TEMPLATES[scenarioId]?.[audience] || []
    : [];

  // Function to build a bundle using a template with scoring
  const buildBundleWithTemplate = (
    pool: Product[],
    template: RoleTemplate,
    tier: "budget" | "balanced" | "premium",
    query: string
  ): CartItem[] | null => {
    // If anchor product is provided, ensure it's included in the bundle
    let anchorProduct: Product | null = null;
    if (anchorProductId) {
      anchorProduct = pool.find(p => p.id === anchorProductId) || null;
    }
    
    // Filter pool by price tier, but exclude anchor product (anchor always included regardless of price)
    const filteredPool = pool.filter((p) => {
      // Always exclude anchor product from price tier filtering - it will be added separately
      if (anchorProduct && p.id === anchorProduct.id) return false;
      
      if (tier === "budget") return p.price <= budgetMax;
      if (tier === "balanced") return p.price >= balancedMin && p.price <= balancedMax;
      if (tier === "premium") return p.price >= premiumMin;
      return true;
    });

    const bundle: CartItem[] = [];
    const usedProductIds = new Set<string>();
    const priceTiers = { budgetMax, balancedMin, balancedMax, premiumMin };
    
    // Always include anchor product first with its dynamically determined role
    if (anchorProduct) {
      const anchorClassification = classifyProductRole(anchorProduct);
      // Determine anchor's role: use first matching role from template, or first role candidate
      let anchorRole: string | null = null;
      
      // First, try to match anchor's role candidates with template roles
      for (const roleCandidate of anchorClassification.roleCandidates) {
        if (template.roles[roleCandidate]) {
          anchorRole = roleCandidate;
          break;
        }
      }
      
      // If no direct match, check if anchor's category matches any template role's allowed categories
      if (!anchorRole) {
        for (const [role, allowedCategories] of Object.entries(template.roles)) {
          if (allowedCategories.includes(anchorProduct.category)) {
            anchorRole = role;
            break;
          }
        }
      }
      
      // If still no match, use first role candidate (shouldn't happen for valid products)
      if (!anchorRole && anchorClassification.roleCandidates.length > 0) {
        anchorRole = anchorClassification.roleCandidates[0];
      }
      
      // Add anchor product to bundle with its determined role
      if (anchorRole) {
        bundle.push({
          id: anchorProduct.id,
          title: anchorProduct.title,
          brand: anchorProduct.brand,
          price: anchorProduct.price,
          imageUrl: anchorProduct.imageUrl,
          category: anchorProduct.category,
          color: anchorProduct.color,
          why: "", // Will be filled by LLM
          role: anchorRole,
        });
        usedProductIds.add(anchorProduct.id);
      }
    }

    // Try to fill each role with scoring
    for (const [role, allowedCategories] of Object.entries(template.roles)) {
      // Skip if role already filled (e.g., by anchor product)
      if (bundle.some(b => b.role === role)) continue;
      
      // Get already selected products for scoring context
      const selectedProducts = bundle.map(b => pool.find(pp => pp.id === b.id)).filter((p): p is Product => p !== undefined);
      
      const candidates = filteredPool
        .filter(
          (p) => !usedProductIds.has(p.id) && allowedCategories.includes(p.category)
        )
        .map((p) => ({
          product: p,
          score: scoreProductForRole(p, role, query, tier, priceTiers, selectedProducts),
        }))
        .sort((a, b) => b.score - a.score); // Sort by score descending

      if (candidates.length === 0) {
        return null; // Can't complete this template
      }

      // Select best candidate by score
      const selected = candidates[0].product;
      bundle.push({
        id: selected.id,
        title: selected.title,
        brand: selected.brand,
        price: selected.price,
        imageUrl: selected.imageUrl,
        category: selected.category,
        color: selected.color,
        why: "", // Will be filled by LLM
        role: role,
      });
      usedProductIds.add(selected.id);
    }

    return bundle.length === Object.keys(template.roles).length ? bundle : null;
  };

  // Validation function - checks if bundle has all required roles for its template
  const validateBundle = (
    bundle: CartItem[],
    template: RoleTemplate
  ): boolean => {
    const requiredRoles = new Set(Object.keys(template.roles));
    const bundleRoles = new Set(bundle.map(b => b.role));
    return requiredRoles.size === bundleRoles.size && 
           Array.from(requiredRoles).every(r => bundleRoles.has(r));
  };

  // Build bundles for each tier with validation
  const buildTierBundle = (tier: "budget" | "balanced" | "premium"): CartItem[] => {
    if (templates.length > 0) {
      // Try each template until one works
      for (const template of templates) {
        const bundle = buildBundleWithTemplate(products, template, tier, query);
        if (bundle && validateBundle(bundle, template)) {
          return bundle;
        }
      }
      
      // If all templates failed, log why and try fallback
      console.warn(`Template failed for ${scenarioId}/${audience}/${tier}. Available products: ${products.length}, Categories: ${[...new Set(products.map(p => p.category))].join(', ')}`);
      
      // Fallback: try to build a complete look using role classifier
      return buildFallbackBundle(products, tier, query);
    }

    // No templates available - use fallback
    console.warn(`No templates for ${scenarioId}/${audience}. Using fallback bundle builder.`);
    return buildFallbackBundle(products, tier, query);
  };

  // Fallback bundle builder when templates aren't available or fail
  const buildFallbackBundle = (
    pool: Product[],
    tier: "budget" | "balanced" | "premium",
    query: string
  ): CartItem[] => {
    // If anchor product is provided, ensure it's included in the bundle
    let anchorProduct: Product | null = null;
    if (anchorProductId) {
      anchorProduct = pool.find(p => p.id === anchorProductId) || null;
    }
    
    // Filter pool by price tier, but exclude anchor product (anchor always included regardless of price)
    const filteredPool = pool.filter((p) => {
      // Always exclude anchor product from price tier filtering - it will be added separately
      if (anchorProduct && p.id === anchorProduct.id) return false;
      
      if (tier === "budget") return p.price <= budgetMax;
      if (tier === "balanced") return p.price >= balancedMin && p.price <= balancedMax;
      if (tier === "premium") return p.price >= premiumMin;
      return true;
    });

    // Try to build a diverse bundle with different roles
    const bundle: CartItem[] = [];
    const usedProductIds = new Set<string>();
    const usedRoles = new Set<string>();

    // Always include anchor product first with its dynamically determined role
    if (anchorProduct) {
      const classification = classifyProductRole(anchorProduct);
      // Use first role candidate (footwear for shoes, top for shirts, etc.)
      const role = classification.roleCandidates[0] || 'item';
      bundle.push({
        id: anchorProduct.id,
        title: anchorProduct.title,
        brand: anchorProduct.brand,
        price: anchorProduct.price,
        imageUrl: anchorProduct.imageUrl,
        category: anchorProduct.category,
        color: anchorProduct.color,
        why: "",
        role: role,
      });
      usedProductIds.add(anchorProduct.id);
      usedRoles.add(role);
    }

    // Priority order: primary/top, bottom, footwear, addOn
    const rolePriority = ['primary', 'top', 'bottom', 'footwear', 'addOn'];
    
    for (const role of rolePriority) {
      if (bundle.length >= 3) break;
      // Skip role already filled by anchor product
      if (usedRoles.has(role)) continue;
      
      const candidates = filteredPool
        .filter(p => {
          if (usedProductIds.has(p.id)) return false;
          const classification = classifyProductRole(p);
          return classification.roleCandidates.includes(role);
        })
        .map(p => ({
          product: p,
          score: scoreProductForRole(p, role, query, tier, { budgetMax, balancedMin, balancedMax, premiumMin }, bundle.map(b => {
            return pool.find(pp => pp.id === b.id)!;
          }).filter((p): p is Product => p !== undefined)),
        }))
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const selected = candidates[0].product;
        const classification = classifyProductRole(selected);
        const assignedRole = classification.roleCandidates.find(r => rolePriority.includes(r)) || role;
        
        bundle.push({
          id: selected.id,
          title: selected.title,
          brand: selected.brand,
          price: selected.price,
          imageUrl: selected.imageUrl,
          category: selected.category,
          color: selected.color,
          why: "",
          role: assignedRole,
        });
        usedProductIds.add(selected.id);
        usedRoles.add(assignedRole);
      }
    }

    // Fill remaining slots with any available products
    for (const product of filteredPool) {
      if (bundle.length >= 3) break;
      if (usedProductIds.has(product.id)) continue;
      
      const classification = classifyProductRole(product);
      const role = classification.roleCandidates[0] || 'item';
      
      bundle.push({
        id: product.id,
        title: product.title,
        brand: product.brand,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        color: product.color,
        why: "",
        role: role,
      });
      usedProductIds.add(product.id);
    }

    return bundle.slice(0, 3);
  };

  const budgetBundle = buildTierBundle("budget");
  const balancedBundle = buildTierBundle("balanced");
  const premiumBundle = buildTierBundle("premium");
  
  // Check if any bundle is empty and provide helpful error
  if (budgetBundle.length === 0 || balancedBundle.length === 0 || premiumBundle.length === 0) {
    const missingTiers = [];
    if (budgetBundle.length === 0) missingTiers.push("budget");
    if (balancedBundle.length === 0) missingTiers.push("balanced");
    if (premiumBundle.length === 0) missingTiers.push("premium");
    
    const availableCategories = [...new Set(products.map(p => p.category))].join(', ');
    const hasTemplates = templates.length > 0;
    
    throw new Error(
      `Could not build complete bundles for ${missingTiers.join(', ')} tier(s). ` +
      `Scenario: ${scenarioId || 'none'}, Audience: ${audience || 'none'}, ` +
      `Templates available: ${hasTemplates}, Products: ${products.length}, ` +
      `Categories: ${availableCategories || 'none'}`
    );
  }
  
  return {
    budget: budgetBundle,
    balanced: balancedBundle,
    premium: premiumBundle,
  };
}

async function generateCartNotes(
  carts: { budget: CartItem[]; balanced: CartItem[]; premium: CartItem[] },
  provider: "openai" | "anthropic" | "gemini",
  query: string,
  preference?: string | null
): Promise<{ budget: Cart; balanced: Cart; premium: Cart }> {
  // Generate role-specific reasons for each item
  const allItems = [...carts.budget, ...carts.balanced, ...carts.premium];

  // Create product summaries with role context
  const productSummaries = allItems.map((item) => ({
    id: item.id,
    title: item.title,
    brand: item.brand,
    category: item.category,
    price: item.price,
    role: item.role, // Include role for LLM context
  }));

  // Get reasons for all items (with role context)
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
      why: reasons[reasonIdx++]?.[0] || `Perfect ${item.role} for this look`,
    }));
  };

  const budgetWithWhy = assignReasons(carts.budget);
  const balancedWithWhy = assignReasons(carts.balanced);
  const premiumWithWhy = assignReasons(carts.premium);

  // Generate bundle notes (complete look descriptions)
  const generateBundleNotes = async (items: CartItem[], tier: string): Promise<string[]> => {
    // Use LLM to generate 3 notes about the complete look
    // For now, return template notes - you can enhance with LLM later
    const itemCategories = items.map((i) => i.category).join(", ");
    const roles = items.map((i) => i.role).join(", ");
    return [
      `A complete ${tier.toLowerCase()} look featuring ${itemCategories}`,
      `Perfectly coordinated pieces (${roles}) for a polished ensemble`,
      `Ready-to-wear combination that works together seamlessly`,
    ];
  };

  const budgetNotes = await generateBundleNotes(budgetWithWhy, "Budget");
  const balancedNotes = await generateBundleNotes(balancedWithWhy, "Balanced");
  const premiumNotes = await generateBundleNotes(premiumWithWhy, "Premium");

  return {
    budget: {
      name: "Budget",
      items: budgetWithWhy,
      notes: budgetNotes,
    },
    balanced: {
      name: "Balanced",
      items: balancedWithWhy,
      notes: balancedNotes,
    },
    premium: {
      name: "Premium",
      items: premiumWithWhy,
      notes: premiumNotes,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { query, provider = "openai", preference, audience, scenarioId, allowUnisexMix = false, anchorProductId } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const catalog = loadCatalog();
    
    // Filter by audience if present (pre-filter for search)
    let filteredCatalog = catalog;
    if (audience && (audience === "men" || audience === "women" || audience === "unisex")) {
      filteredCatalog = catalog.filter((p) => p.audience === audience);
    }
    
    // Filter by scenarioId if present
    if (scenarioId) {
      filteredCatalog = filteredCatalog.filter((p) => p.scenarioId === scenarioId);
    }
    
    // Find anchor product if provided
    let anchorProduct: Product | null = null;
    if (anchorProductId) {
      anchorProduct = catalog.find(p => p.id === anchorProductId) || null;
    }
    
    let searchResults: Array<{ product: Product; score: number }>;

    if (anchorProductId && anchorProduct) {
      // "Complete the look" mode: expand pool to all products in scenario/audience
      // This allows finding complementary items (top, bottom, addOn) even if original query was specific
      
      // Ensure anchor product is in filteredCatalog (it should be, but add it if missing)
      const anchorInFiltered = filteredCatalog.some(p => p.id === anchorProductId);
      if (!anchorInFiltered) {
        // Add anchor product to filteredCatalog if it matches the filters
        if ((!audience || anchorProduct.audience === audience) && 
            (!scenarioId || anchorProduct.scenarioId === scenarioId)) {
          filteredCatalog = [anchorProduct, ...filteredCatalog];
        }
      }
      
      searchResults = filteredCatalog.map(p => ({
        product: p,
        score: p.id === anchorProductId ? 1000 : 50 // Boost anchor, give others baseline score
      }));
      
      // Ensure anchor is first
      const anchorIdx = searchResults.findIndex(r => r.product.id === anchorProductId);
      if (anchorIdx > 0) {
        const anchor = searchResults.splice(anchorIdx, 1)[0];
        searchResults.unshift(anchor);
      }
    } else {
      // Normal search mode: use query-based search
      searchResults = searchProducts(filteredCatalog, query, 100); // Get more candidates for filtering
      
      // If anchor product is provided and not in results, add it to the pool
      if (anchorProduct) {
        const anchorInResults = searchResults.find(r => r.product.id === anchorProductId);
        if (!anchorInResults) {
          // Add anchor product to search results with high score
          searchResults.unshift({ product: anchorProduct, score: 1000 });
        } else {
          // Boost anchor product score
          const idx = searchResults.findIndex(r => r.product.id === anchorProductId);
          if (idx >= 0) {
            searchResults[idx].score = 1000;
            // Move to front
            const anchor = searchResults.splice(idx, 1)[0];
            searchResults.unshift(anchor);
          }
        }
      }
    }

    if (searchResults.length < 3) {
      return NextResponse.json(
        { error: "Not enough products found" },
        { status: 400 }
      );
    }

    // Build carts with additional filtering
    const carts = buildCarts(
      searchResults, 
      provider as "openai" | "anthropic" | "gemini", 
      query, 
      preference,
      audience || null,
      scenarioId || null,
      allowUnisexMix,
      anchorProductId
    );

    // Generate notes and "why" using LLM
    const cartsWithNotes = await generateCartNotes(
      carts,
      provider as "openai" | "anthropic" | "gemini",
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
