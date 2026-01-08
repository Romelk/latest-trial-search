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
};

const CATEGORIES = [
  "Shirts",
  "Trousers",
  "Jeans",
  "T-Shirts",
  "Blazers",
  "Dresses",
  "Sneakers",
  "Loafers",
  "Handbags",
  "Watches",
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

const COLORS = [
  "Black",
  "White",
  "Navy",
  "Gray",
  "Beige",
  "Brown",
  "Blue",
  "Red",
  "Green",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Maroon",
  "Olive",
];

const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Fitted"];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const OCCASION_TAGS = [
  "Casual",
  "Formal",
  "Party",
  "Work",
  "Wedding",
  "Sports",
  "Travel",
  "Evening",
  "Beach",
  "Office",
];

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

function generateProduct(id: number): Product {
  const category = CATEGORIES[id % CATEGORIES.length];
  const brand = BRANDS[Math.floor(id / 40) % BRANDS.length];
  const color = COLORS[id % COLORS.length];
  const fit = FITS[id % FITS.length];
  const size = SIZES[id % SIZES.length];
  const style = STYLES[id % STYLES.length];
  
  // Generate occasion tags (1-3 tags per product)
  const numTags = (id % 3) + 1;
  const shuffledOccasions = [...OCCASION_TAGS].sort(() => Math.random() - 0.5);
  const occasionTags = shuffledOccasions.slice(0, numTags);

  // Generate price between 799 and 14999
  const price = 799 + (id * 37) % (14999 - 799);

  // Generate title
  const titleVariants = [
    `${brand} ${category} - ${color}`,
    `${color} ${category} by ${brand}`,
    `${brand} ${style} ${category}`,
    `${fit} Fit ${category} - ${brand}`,
    `${brand} ${category} ${style} Collection`,
    `${color} ${fit} ${category}`,
    `${brand} Premium ${category}`,
    `${style} ${category} - ${brand}`,
  ];
  const title = titleVariants[id % titleVariants.length];

  // Generate description
  const descriptions = [
    `Premium ${color.toLowerCase()} ${category.toLowerCase()} from ${brand}. Perfect for ${occasionTags[0].toLowerCase()} occasions.`,
    `Stylish ${category.toLowerCase()} featuring ${style.toLowerCase()} design. Made with quality materials.`,
    `Comfortable ${fit.toLowerCase()} fit ${category.toLowerCase()} in ${color.toLowerCase()}. Ideal for ${occasionTags.join(" and ").toLowerCase()} wear.`,
    `Elegant ${category.toLowerCase()} by ${brand}. ${style} style that suits multiple occasions.`,
    `High-quality ${category.toLowerCase()} in ${color.toLowerCase()}. Perfect fit for ${occasionTags[0].toLowerCase()} settings.`,
  ];
  const description = descriptions[id % descriptions.length];

  return {
    id: `prod-${id.toString().padStart(4, "0")}`,
    title,
    brand,
    price,
    imageUrl: `https://picsum.photos/seed/${id}/600/800`,
    category,
    color,
    size: category !== "Watches" && category !== "Handbags" ? size : undefined,
    fit: category !== "Watches" && category !== "Handbags" ? fit : undefined,
    occasionTags,
    style,
    description,
  };
}

export function generateCatalog(count: number = 400): Product[] {
  const products: Product[] = [];
  for (let i = 1; i <= count; i++) {
    products.push(generateProduct(i));
  }
  return products;
}

export function loadCatalog(): Product[] {
  const catalogPath = join(process.cwd(), "data", "catalog.json");
  
  if (!existsSync(catalogPath)) {
    console.log("Catalog not found. Generating new catalog...");
    const products = generateCatalog(400);
    writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
    console.log(`Generated catalog with ${products.length} products`);
    return products;
  }

  try {
    const fileContent = readFileSync(catalogPath, "utf-8");
    const products = JSON.parse(fileContent) as Product[];
    return products;
  } catch (error) {
    console.error("Error loading catalog:", error);
    // Fallback to generating
    const products = generateCatalog(400);
    writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
    return products;
  }
}

