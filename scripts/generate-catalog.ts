import { writeFileSync } from "fs";
import { join } from "path";
import { generateCatalog } from "../lib/catalog";

const products = generateCatalog(400);
const catalogPath = join(process.cwd(), "data", "catalog.json");

writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
console.log(`✓ Generated catalog with ${products.length} products at ${catalogPath}`);

