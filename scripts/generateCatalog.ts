import { writeFileSync } from "fs";
import { join } from "path";
import { generateCatalog } from "../lib/catalog";

const products = generateCatalog();
const catalogPath = join(process.cwd(), "data", "catalog.json");

writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
console.log(`✓ Generated scenario-based catalog with ${products.length} products at ${catalogPath}`);
console.log(`  - 60 products per audience per scenario (3 audiences × 5 scenarios = 900 total)`);
console.log(`  - 6 hero products per audience per scenario (6 × 3 × 5 = 90 hero products)`);

