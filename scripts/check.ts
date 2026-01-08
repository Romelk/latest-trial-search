import { readFileSync } from "fs";
import { join } from "path";
import { type Product } from "../lib/catalog";

const catalogPath = join(process.cwd(), "data", "catalog.json");

console.log("Validating catalog structure...\n");

try {
  const fileContent = readFileSync(catalogPath, "utf-8");
  const products = JSON.parse(fileContent) as Product[];

  const scenarios = ["nyc_dinner", "summer_wedding", "biz_travel", "chi_winter", "campus"];
  const audiences = ["men", "women", "unisex"];

  // Check 1: 5 scenarios exist
  const uniqueScenarios = new Set(products.map((p) => p.scenarioId));
  console.log(`✓ Check 1: Scenarios found: ${uniqueScenarios.size}`);
  for (const scenario of scenarios) {
    if (!uniqueScenarios.has(scenario as any)) {
      console.error(`  ✗ Missing scenario: ${scenario}`);
      process.exit(1);
    }
  }
  console.log(`  All 5 scenarios present: ${Array.from(uniqueScenarios).join(", ")}\n`);

  // Check 2: Each scenario has 3 audiences
  console.log("✓ Check 2: Audiences per scenario:");
  for (const scenario of scenarios) {
    const scenarioProducts = products.filter((p) => p.scenarioId === scenario);
    const uniqueAudiences = new Set(scenarioProducts.map((p) => p.audience));
    console.log(`  ${scenario}: ${uniqueAudiences.size} audiences (${Array.from(uniqueAudiences).join(", ")})`);
    
    if (uniqueAudiences.size !== 3) {
      console.error(`  ✗ ${scenario} has ${uniqueAudiences.size} audiences, expected 3`);
      process.exit(1);
    }
    
    for (const audience of audiences) {
      if (!uniqueAudiences.has(audience as any)) {
        console.error(`  ✗ ${scenario} missing audience: ${audience}`);
        process.exit(1);
      }
    }
  }
  console.log("  All scenarios have 3 audiences (men, women, unisex)\n");

  // Check 3: Each scenario+audience has 60 items
  console.log("✓ Check 3: Products per scenario+audience:");
  let totalProducts = 0;
  for (const scenario of scenarios) {
    for (const audience of audiences) {
      const count = products.filter(
        (p) => p.scenarioId === scenario && p.audience === audience
      ).length;
      totalProducts += count;
      console.log(`  ${scenario} + ${audience}: ${count} products`);
      
      if (count !== 60) {
        console.error(`  ✗ ${scenario} + ${audience} has ${count} products, expected 60`);
        process.exit(1);
      }
    }
  }
  console.log(`\n  Total products: ${totalProducts} (expected 900)\n`);

  // Check 4: Hero products exist (6 per audience per scenario = 90 total)
  console.log("✓ Check 4: Hero products (6 per audience per scenario):");
  let heroCount = 0;
  for (const scenario of scenarios) {
    const scenarioPrefix = scenario === "nyc_dinner" ? "nyc" :
                          scenario === "summer_wedding" ? "wed" :
                          scenario === "biz_travel" ? "trv" :
                          scenario === "chi_winter" ? "chi" : "cmp";
    
    for (const audience of audiences) {
      const audiencePrefix = audience === "men" ? "men" : audience === "women" ? "wom" : "uni";
      const heroIds = Array.from({ length: 6 }, (_, i) => 
        `prod-${scenarioPrefix}-${audiencePrefix}-${String(i + 1).padStart(3, "0")}`
      );
      
      const foundHeroes = heroIds.filter(id => products.some(p => p.id === id));
      heroCount += foundHeroes.length;
      console.log(`  ${scenario} + ${audience}: ${foundHeroes.length}/6 hero products`);
      
      if (foundHeroes.length !== 6) {
        console.error(`  ✗ ${scenario} + ${audience} has ${foundHeroes.length} hero products, expected 6`);
        const missing = heroIds.filter(id => !foundHeroes.includes(id));
        console.error(`    Missing: ${missing.join(", ")}`);
        process.exit(1);
      }
    }
  }
  console.log(`\n  Total hero products: ${heroCount} (expected 90)\n`);

  // Check 5: All products have required fields
  console.log("✓ Check 5: Required fields validation:");
  const requiredFields = ["id", "title", "brand", "price", "imageUrl", "category", "color", 
                          "scenarioId", "audience", "formality", "palette", "bundleRole", 
                          "inStock", "stockCount", "deliveryDays", "season"];
  
  let missingFields = 0;
  for (const product of products) {
    for (const field of requiredFields) {
      if (!(field in product)) {
        console.error(`  ✗ Product ${product.id} missing field: ${field}`);
        missingFields++;
      }
    }
  }
  
  if (missingFields > 0) {
    console.error(`  ✗ Found ${missingFields} missing field(s)`);
    process.exit(1);
  }
  console.log(`  All ${products.length} products have required fields\n`);

  console.log("✅ All validation checks passed!");
  console.log(`\nSummary:`);
  console.log(`  - Scenarios: ${scenarios.length}`);
  console.log(`  - Audiences per scenario: ${audiences.length}`);
  console.log(`  - Products per scenario+audience: 60`);
  console.log(`  - Total products: ${totalProducts}`);
  console.log(`  - Hero products: ${heroCount}`);

} catch (error) {
  console.error("Error validating catalog:", error);
  process.exit(1);
}

