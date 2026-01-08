import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ShoppingBrief = {
  budgetMax?: number | null;
  category?: string | null;
  color?: string | null;
  occasion?: string | null;
  style?: string | null;
  notes?: string;
};

export async function generateShoppingBrief(
  query: string,
  userAnswer?: string | null
): Promise<ShoppingBrief> {
  if (!openai) {
    // Fallback to local dummy brief
    return {
      budgetMax: null,
      category: null,
      color: null,
      occasion: null,
      style: null,
      notes: "Local fallback: No API key configured",
    };
  }

  try {
    const prompt = `You are a shopping assistant. Based on the user's query and optional answer, create a shopping brief in JSON format.

Query: "${query}"
${userAnswer ? `User's answer: "${userAnswer}"` : ""}

Return ONLY a JSON object with these fields (use null if not specified):
{
  "budgetMax": number or null,
  "category": string or null,
  "color": string or null,
  "occasion": string or null,
  "style": string or null,
  "notes": string (brief shopping context)
}

Keep it concise. Only include fields that are clearly mentioned.`;

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
      throw new Error("No response from OpenAI");
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ShoppingBrief;
    }

    throw new Error("Invalid JSON response");
  } catch (error) {
    console.error("OpenAI error:", error);
    return {
      budgetMax: null,
      category: null,
      color: null,
      occasion: null,
      style: null,
      notes: "Error generating brief",
    };
  }
}

export async function generateProductReasons(
  products: Array<{ id: string; title: string; brand: string; category: string; price: number }>,
  query: string,
  userAnswer?: string | null
): Promise<string[][]> {
  if (!openai) {
    // Fallback to local reasons
    return products.map(() => [
      "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }

  try {
    const productList = products
      .slice(0, 24)
      .map((p, idx) => `${idx + 1}. ${p.title} (${p.brand}) - ₹${p.price}`)
      .join("\n");

    const prompt = `You are a shopping assistant. For each product below, provide exactly 3 short reasons (one line each) why it matches the user's search.

Query: "${query}"
${userAnswer ? `User's answer: "${userAnswer}"` : ""}

Products:
${productList}

Return ONLY a JSON array of arrays. Each inner array has exactly 3 strings (reasons).
Format: [["reason1", "reason2", "reason3"], ["reason1", "reason2", "reason3"], ...]

Keep reasons concise (max 15 words each).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful shopping assistant. Return only valid JSON arrays.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const reasons = JSON.parse(jsonMatch[0]) as string[][];
      // Ensure we have reasons for all products
      while (reasons.length < products.length) {
        reasons.push(["Matches your search", "Good quality", "Great value"]);
      }
      return reasons.slice(0, products.length);
    }

    throw new Error("Invalid JSON response");
  } catch (error) {
    console.error("OpenAI error:", error);
    return products.map(() => [
      "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }
}

