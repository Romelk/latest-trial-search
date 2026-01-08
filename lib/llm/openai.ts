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
  products: Array<{ id: string; title: string; brand: string; category: string; price: number; role?: string }>,
  query: string,
  userAnswer?: string | null
): Promise<string[][]> {
  if (!openai) {
    // Fallback to local reasons
    return products.map((p) => [
      p.role ? `Perfect ${p.role} for this look` : "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }

  try {
    const productList = products
      .slice(0, 24)
      .map((p, idx) => {
        const roleInfo = p.role ? ` [Role: ${p.role}]` : "";
        return `${idx + 1}. ${p.title} (${p.brand}) - $${p.price}${roleInfo}`;
      })
      .join("\n");

    const prompt = `For each product, return 3 short reasons (max 12 words each) why it matches "${query}".
${userAnswer ? `User said: "${userAnswer}"` : ""}

${productList}

Return JSON array: [["reason1","reason2","reason3"], ...]
No reviews. Keep it short.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful shopping assistant. Return only valid JSON arrays. Keep responses concise.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Try to extract JSON from markdown code blocks first
    let jsonText = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      // Try to find JSON array in content
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    // Clean up JSON text - remove trailing commas, fix common issues
    jsonText = jsonText
      .replace(/,\s*\]/g, ']') // Remove trailing commas before closing bracket
      .replace(/,\s*\}/g, '}') // Remove trailing commas before closing brace
      .trim();

    try {
      // Check if JSON appears truncated (incomplete string at the end)
      const trimmedJson = jsonText.trim();
      
      // Better truncation handling: find last complete array element
      if (trimmedJson && !trimmedJson.endsWith(']')) {
        // Find all complete array elements: ["str1","str2","str3"]
        const completeElements: string[] = [];
        let searchIndex = 0;
        const elementPattern = /\["([^"]*)","([^"]*)","([^"]*)"\]/g;
        let match;
        while ((match = elementPattern.exec(trimmedJson)) !== null) {
          completeElements.push(match[0]);
          searchIndex = match.index + match[0].length;
        }
        
        if (completeElements.length > 0) {
          // Reconstruct JSON from complete elements only
          jsonText = '[' + completeElements.join(',') + ']';
        } else {
          // Fallback: try to fix incomplete last element
          // Find where the last complete element ends
          const lastBracketIndex = trimmedJson.lastIndexOf(']');
          if (lastBracketIndex > 0) {
            // Find the start of that element
            const beforeLastBracket = trimmedJson.substring(0, lastBracketIndex);
            const lastOpeningBracket = beforeLastBracket.lastIndexOf('[');
            if (lastOpeningBracket >= 0) {
              // Check if the element looks complete (has 3 strings)
              const element = trimmedJson.substring(lastOpeningBracket, lastBracketIndex + 1);
              const stringCount = (element.match(/","/g) || []).length;
              if (stringCount >= 2) {
                // Element has at least 2 strings, try to close it properly
                const beforeElement = trimmedJson.substring(0, lastOpeningBracket);
                jsonText = beforeElement.replace(/,\s*$/, '') + element + ']';
              } else {
                // Remove incomplete element
                jsonText = beforeLastBracket.replace(/,\s*$/, '') + ']';
              }
            }
          }
        }
      }

      // Final safety check
      if (!jsonText.trim().endsWith(']')) {
        // Find last complete array element and close
        const lastCompleteIndex = jsonText.lastIndexOf('"]');
        if (lastCompleteIndex > 0) {
          const beforeIncomplete = jsonText.substring(0, lastCompleteIndex + 2);
          const lastArrayStart = beforeIncomplete.lastIndexOf('[');
          if (lastArrayStart >= 0) {
            jsonText = beforeIncomplete.substring(0, lastArrayStart).replace(/,\s*$/, '') + beforeIncomplete.substring(lastArrayStart) + ']';
          }
        } else {
          jsonText = jsonText.replace(/[^\]]*$/, ']');
        }
      }

      const reasons = JSON.parse(jsonText) as string[][];
      // Validate it's an array of arrays
      if (!Array.isArray(reasons) || !reasons.every((r) => Array.isArray(r))) {
        throw new Error("Invalid format: not an array of arrays");
      }
      
      // Ensure all inner arrays have exactly 3 strings
      const validReasons = reasons.map(r => {
        if (Array.isArray(r) && r.length > 0) {
          return r.slice(0, 3).filter(s => typeof s === 'string' && s.length > 0);
        }
        return ["Matches your search", "Good quality", "Great value"];
      }).map(r => {
        while (r.length < 3) {
          r.push("Good value");
        }
        return r.slice(0, 3);
      });

      // Ensure we have reasons for all products
      while (validReasons.length < products.length) {
        validReasons.push(["Matches your search", "Good quality", "Great value"]);
      }
      return validReasons.slice(0, products.length);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Attempted to parse:", jsonText.substring(0, 500));
      // Return fallback reasons instead of throwing
      console.warn("Falling back to default reasons due to JSON parse error");
      return products.map(() => [
        "Matches your search criteria",
        "Good value for money",
        "Popular choice",
      ]);
    }
  } catch (error) {
    console.error("OpenAI error:", error);
    return products.map(() => [
      "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }
}

