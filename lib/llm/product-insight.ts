import type { Product } from "../catalog";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ProductInsight = {
  fitSummary: string;
  tradeoffs: string[];
  styling: string[];
  alternatives: Array<{ id: string; reason: string }>;
};

async function generateProductInsightOpenAI(
  product: Product,
  brief: Record<string, any>,
  alternatives: Product[]
): Promise<ProductInsight> {
  if (!process.env.OPENAI_API_KEY) {
    return generateProductInsightLocal(product, brief, alternatives);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const briefText = Object.entries(brief)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const alternativesText = alternatives
      .map((a) => `${a.id}: ${a.title} (${a.brand}) - $${a.price}`)
      .join("\n");

    const prompt = `You are a shopping assistant. Provide insights for this product:

Product: ${product.title} by ${product.brand}
Price: $${product.price}
Category: ${product.category}
Color: ${product.color}
Style: ${product.style}
Occasion tags: ${product.occasionTags.join(", ")}
Description: ${product.description}

User's brief: ${briefText || "None specified"}

Alternatives available:
${alternativesText}

Return ONLY a JSON object:
{
  "fitSummary": "one sentence explaining how this product fits the brief",
  "tradeoffs": ["short tradeoff 1", "short tradeoff 2", "short tradeoff 3"],
  "styling": ["styling tip 1", "styling tip 2", "styling tip 3"],
  "alternatives": [
    {"id": "productId1", "reason": "why alternative 1 might be better"},
    {"id": "productId2", "reason": "why alternative 2 might be better"}
  ]
}

Rules:
- Keep all text short and concise (max 15 words per item)
- Only use product attributes and brief, no fake reviews
- Alternatives must be from the provided list
- Be honest about tradeoffs`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful shopping assistant. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return generateProductInsightLocal(product, brief, alternatives);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insight = JSON.parse(jsonMatch[0]) as ProductInsight;
      // Ensure alternatives match provided products
      insight.alternatives = insight.alternatives
        .filter((alt) => alternatives.some((a) => a.id === alt.id))
        .slice(0, 2);
      return insight;
    }

    return generateProductInsightLocal(product, brief, alternatives);
  } catch (error) {
    console.error("OpenAI product insight error:", error);
    return generateProductInsightLocal(product, brief, alternatives);
  }
}

async function generateProductInsightAnthropic(
  product: Product,
  brief: Record<string, any>,
  alternatives: Product[]
): Promise<ProductInsight> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateProductInsightLocal(product, brief, alternatives);
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const briefText = Object.entries(brief)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const alternativesText = alternatives
      .map((a) => `${a.id}: ${a.title} (${a.brand}) - $${a.price}`)
      .join("\n");

    const prompt = `You are a shopping assistant. Provide insights for this product:

Product: ${product.title} by ${product.brand}
Price: $${product.price}
Category: ${product.category}
Color: ${product.color}
Style: ${product.style}
Occasion tags: ${product.occasionTags.join(", ")}
Description: ${product.description}

User's brief: ${briefText || "None specified"}

Alternatives available:
${alternativesText}

Return ONLY a JSON object:
{
  "fitSummary": "one sentence explaining how this product fits the brief",
  "tradeoffs": ["short tradeoff 1", "short tradeoff 2", "short tradeoff 3"],
  "styling": ["styling tip 1", "styling tip 2", "styling tip 3"],
  "alternatives": [
    {"id": "productId1", "reason": "why alternative 1 might be better"},
    {"id": "productId2", "reason": "why alternative 2 might be better"}
  ]
}

Rules:
- Keep all text short and concise (max 15 words per item)
- Only use product attributes and brief, no fake reviews
- Alternatives must be from the provided list
- Be honest about tradeoffs`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 400,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return generateProductInsightLocal(product, brief, alternatives);
    }

    const text = content.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insight = JSON.parse(jsonMatch[0]) as ProductInsight;
      // Ensure alternatives match provided products
      insight.alternatives = insight.alternatives
        .filter((alt) => alternatives.some((a) => a.id === alt.id))
        .slice(0, 2);
      return insight;
    }

    return generateProductInsightLocal(product, brief, alternatives);
  } catch (error) {
    console.error("Anthropic product insight error:", error);
    return generateProductInsightLocal(product, brief, alternatives);
  }
}

function generateProductInsightLocal(
  product: Product,
  brief: Record<string, any>,
  alternatives: Product[]
): ProductInsight {
  const fitSummary = `${product.category} in ${product.color} fits your needs.`;
  
  const tradeoffs = [
    `Price: $${product.price}`,
    `Style: ${product.style}`,
    `Occasions: ${product.occasionTags.slice(0, 2).join(", ")}`,
  ];

  const styling = [
    `Pair with ${product.category === "Shirts" ? "trousers" : product.category === "Dresses" ? "accessories" : "shirts"}`,
    `Works for ${product.occasionTags[0] || "casual"} occasions`,
    `${product.color} complements neutral colors`,
  ];

  const alternativesList = alternatives.slice(0, 2).map((alt) => ({
    id: alt.id,
    reason: alt.price < product.price
      ? `Lower price at $${alt.price}`
      : `Different style: ${alt.style}`,
  }));

  return {
    fitSummary,
    tradeoffs,
    styling,
    alternatives: alternativesList,
  };
}

async function generateProductInsightGemini(
  product: Product,
  brief: Record<string, any>,
  alternatives: Product[]
): Promise<ProductInsight> {
  if (!process.env.GOOGLE_API_KEY) {
    return generateProductInsightLocal(product, brief, alternatives);
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });

    const briefText = Object.entries(brief)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const alternativesText = alternatives
      .map((a) => `${a.id}: ${a.title} (${a.brand}) - $${a.price}`)
      .join("\n");

    const prompt = `Product: ${product.title} by ${product.brand}
Price: $${product.price}
Category: ${product.category}
Color: ${product.color}
Style: ${product.style}
Occasion tags: ${product.occasionTags.join(", ")}
Description: ${product.description}

User's brief: ${briefText || "None specified"}

Alternatives available:
${alternativesText}

Return JSON:
{
  "fitSummary": "one sentence explaining how this product fits the brief",
  "tradeoffs": ["short tradeoff 1", "short tradeoff 2", "short tradeoff 3"],
  "styling": ["styling tip 1", "styling tip 2", "styling tip 3"],
  "alternatives": [
    {"id": "productId1", "reason": "why alternative 1 might be better"},
    {"id": "productId2", "reason": "why alternative 2 might be better"}
  ]
}

Rules:
- Keep all text short (max 15 words per item)
- Only use product attributes and brief, no fake reviews
- Alternatives must be from the provided list
- Be honest about tradeoffs`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insight = JSON.parse(jsonMatch[0]) as ProductInsight;
      insight.alternatives = insight.alternatives
        .filter((alt) => alternatives.some((a) => a.id === alt.id))
        .slice(0, 2);
      return insight;
    }

    return generateProductInsightLocal(product, brief, alternatives);
  } catch (error) {
    console.error("Gemini product insight error:", error);
    return generateProductInsightLocal(product, brief, alternatives);
  }
}

export async function generateProductInsight(
  provider: "openai" | "anthropic" | "gemini",
  product: Product,
  brief: Record<string, any>,
  alternatives: Product[]
): Promise<ProductInsight> {
  if (provider === "openai") {
    return generateProductInsightOpenAI(product, brief, alternatives);
  }
  if (provider === "anthropic") {
    return generateProductInsightAnthropic(product, brief, alternatives);
  }
  return generateProductInsightGemini(product, brief, alternatives);
}

