import * as openai from "./openai";
import * as anthropic from "./anthropic";

export type ConstraintDelta = {
  budgetMax?: number | null;
  category?: string | null;
  colorInclude?: string | null;
  colorExclude?: string | null;
  style?: string | null;
  occasion?: string | null;
  includeKeywords?: string[] | null;
  excludeKeywords?: string[] | null;
  sortBy?: "price_asc" | "price_desc" | null;
};

async function generateConstraintDeltaOpenAI(
  followUp: string,
  existingConstraints: Record<string, any>
): Promise<ConstraintDelta> {
  if (!process.env.OPENAI_API_KEY) {
    return parseConstraintDeltaLocal(followUp);
  }

  try {
    const OpenAI = require("openai").default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a shopping assistant. A user wants to refine their search with: "${followUp}"

Current constraints: ${JSON.stringify(existingConstraints)}

Extract only the NEW or CHANGED constraints from the follow-up. Return ONLY a JSON object with these optional fields (use null if not specified):
{
  "budgetMax": number or null,
  "category": string or null,
  "colorInclude": string or null,
  "colorExclude": string or null,
  "style": string or null,
  "occasion": string or null,
  "includeKeywords": string[] or null,
  "excludeKeywords": string[] or null,
  "sortBy": "price_asc" | "price_desc" | null
}

Rules:
- If user says "exclude black", set colorExclude: "Black"
- If user says "under 4000", set budgetMax: 4000
- If user says "only linen", set includeKeywords: ["linen"]
- If user says "show sneakers", set category: "Sneakers"
- If user says "more formal", set style: "Formal" and occasion: "Formal"
- If user says "cheapest first", set sortBy: "price_asc"

Keep it minimal - only include what changed.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful shopping assistant. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return parseConstraintDeltaLocal(followUp);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ConstraintDelta;
    }

    return parseConstraintDeltaLocal(followUp);
  } catch (error) {
    console.error("OpenAI constraint delta error:", error);
    return parseConstraintDeltaLocal(followUp);
  }
}

async function generateConstraintDeltaAnthropic(
  followUp: string,
  existingConstraints: Record<string, any>
): Promise<ConstraintDelta> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return parseConstraintDeltaLocal(followUp);
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are a shopping assistant. A user wants to refine their search with: "${followUp}"

Current constraints: ${JSON.stringify(existingConstraints)}

Extract only the NEW or CHANGED constraints from the follow-up. Return ONLY a JSON object with these optional fields (use null if not specified):
{
  "budgetMax": number or null,
  "category": string or null,
  "colorInclude": string or null,
  "colorExclude": string or null,
  "style": string or null,
  "occasion": string or null,
  "includeKeywords": string[] or null,
  "excludeKeywords": string[] or null,
  "sortBy": "price_asc" | "price_desc" | null
}

Rules:
- If user says "exclude black", set colorExclude: "Black"
- If user says "under 4000", set budgetMax: 4000
- If user says "only linen", set includeKeywords: ["linen"]
- If user says "show sneakers", set category: "Sneakers"
- If user says "more formal", set style: "Formal" and occasion: "Formal"
- If user says "cheapest first", set sortBy: "price_asc"

Keep it minimal - only include what changed.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return parseConstraintDeltaLocal(followUp);
    }

    const text = content.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ConstraintDelta;
    }

    return parseConstraintDeltaLocal(followUp);
  } catch (error) {
    console.error("Anthropic constraint delta error:", error);
    return parseConstraintDeltaLocal(followUp);
  }
}

function parseConstraintDeltaLocal(followUp: string): ConstraintDelta {
  const delta: ConstraintDelta = {};
  const lower = followUp.toLowerCase();

  // Budget
  const budgetMatch = lower.match(/(?:under|below|less than|upto|up to)\s*(?:₹|rs\.?|inr)?\s*(\d+)/);
  if (budgetMatch) {
    delta.budgetMax = parseInt(budgetMatch[1], 10);
  }

  // Exclude colors
  const excludeColorMatch = lower.match(/exclude\s+(\w+)/);
  if (excludeColorMatch) {
    delta.colorExclude = excludeColorMatch[1].charAt(0).toUpperCase() + excludeColorMatch[1].slice(1);
  }

  // Include colors
  const includeColorMatch = lower.match(/(?:only|show|in)\s+(\w+)/);
  const colors = ["black", "white", "navy", "gray", "blue", "red", "green", "pink", "purple", "yellow", "orange"];
  if (includeColorMatch && colors.includes(includeColorMatch[1])) {
    delta.colorInclude = includeColorMatch[1].charAt(0).toUpperCase() + includeColorMatch[1].slice(1);
  }

  // Category
  const categories = ["shirts", "trousers", "jeans", "t-shirts", "blazers", "dresses", "sneakers", "loafers", "handbags", "watches"];
  for (const cat of categories) {
    if (lower.includes(cat)) {
      delta.category = cat === "t-shirts" ? "T-Shirts" : cat.charAt(0).toUpperCase() + cat.slice(1);
      break;
    }
  }

  // Style/Formal
  if (lower.includes("more formal") || lower.includes("formal")) {
    delta.style = "Formal";
    delta.occasion = "Formal";
  } else if (lower.includes("more relaxed") || lower.includes("casual")) {
    delta.style = "Casual";
    delta.occasion = "Casual";
  }

  // Sort
  if (lower.includes("cheapest") || lower.includes("lowest price")) {
    delta.sortBy = "price_asc";
  } else if (lower.includes("expensive") || lower.includes("highest price")) {
    delta.sortBy = "price_desc";
  }

  return delta;
}

export async function generateConstraintDelta(
  provider: "openai" | "anthropic",
  followUp: string,
  existingConstraints: Record<string, any>
): Promise<ConstraintDelta> {
  if (provider === "openai") {
    return generateConstraintDeltaOpenAI(followUp, existingConstraints);
  }
  return generateConstraintDeltaAnthropic(followUp, existingConstraints);
}

