import { loadCatalog } from "../lib/catalog";
import { searchProducts, extractConstraints, getConstraintChips } from "../lib/search";

console.log("🧪 Running smoke tests for search system...\n");

const catalog = loadCatalog();
console.log(`📦 Loaded catalog with ${catalog.length} products\n`);

const testQueries = [
  "black shirts under 2000",
  "formal blazers for men",
  "casual sneakers",
];

testQueries.forEach((query, index) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Test ${index + 1}: "${query}"`);
  console.log("=".repeat(60));

  const constraints = extractConstraints(query);
  console.log("\n📋 Extracted Constraints:");
  console.log(JSON.stringify(constraints, null, 2));

  const chips = getConstraintChips(constraints);
  console.log("\n🏷️  Constraint Chips:", chips.join(", ") || "None");

  const results = searchProducts(catalog, query, 5);
  console.log(`\n🔍 Found ${results.length} results (showing top 5):\n`);

  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.product.title}`);
    console.log(`   Brand: ${result.product.brand} | Price: ₹${result.product.price}`);
    console.log(`   Category: ${result.product.category} | Color: ${result.product.color}`);
    console.log(`   Score: ${result.score.toFixed(2)}`);
    console.log("");
  });
});

console.log("\n✅ Smoke tests completed!");

