import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const catalogPath = join(process.cwd(), "data", "catalog.json");

console.log("Reading catalog...");
const catalogContent = readFileSync(catalogPath, "utf-8");
const catalog = JSON.parse(catalogContent);

console.log(`Found ${catalog.length} products`);

let updatedCount = 0;

// Update all imageUrl fields
const updatedCatalog = catalog.map((product: any) => {
  // Check if it's using picsum.photos
  if (product.imageUrl && product.imageUrl.includes("picsum.photos")) {
    // Extract product ID from the URL or use the product.id
    const productId = product.id;
    product.imageUrl = `/api/images/${productId}`;
    updatedCount++;
  }
  return product;
});

console.log(`Updated ${updatedCount} products`);

// Write back to file
console.log("Writing updated catalog...");
writeFileSync(catalogPath, JSON.stringify(updatedCatalog, null, 2), "utf-8");

console.log("✅ Catalog updated successfully!");

