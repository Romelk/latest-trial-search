import { GoogleGenerativeAI } from "@google/generative-ai";

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
  if (!process.env.GOOGLE_API_KEY) {
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
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });

    const prompt = `Extract shopping constraints from this query: "${query}"
${userAnswer ? `User's answer: "${userAnswer}"` : ""}

Return JSON with: budgetMax (number or null), category (string or null), color (string or null), occasion (string or null), style (string or null), notes (string).
Keep it concise.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ShoppingBrief;
    }

    throw new Error("Invalid JSON response");
  } catch (error) {
    console.error("Gemini error:", error);
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
  if (!process.env.GOOGLE_API_KEY) {
    // Fallback to local reasons
    return products.map((p) => [
      p.role ? `Perfect ${p.role} for this look` : "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });

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

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    
    // Try to extract JSON from markdown code blocks first
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    // Clean up JSON text
    jsonText = jsonText
      .replace(/,\s*\]/g, ']')
      .replace(/,\s*\}/g, '}')
      .trim();

    try {
      // Better truncation handling
      const trimmedJson = jsonText.trim();
      
      if (trimmedJson && !trimmedJson.endsWith(']')) {
        const completeElements: string[] = [];
        const elementPattern = /\["([^"]*)","([^"]*)","([^"]*)"\]/g;
        let match;
        while ((match = elementPattern.exec(trimmedJson)) !== null) {
          completeElements.push(match[0]);
        }
        
        if (completeElements.length > 0) {
          jsonText = '[' + completeElements.join(',') + ']';
        } else {
          const lastBracketIndex = trimmedJson.lastIndexOf(']');
          if (lastBracketIndex > 0) {
            const beforeLastBracket = trimmedJson.substring(0, lastBracketIndex);
            const lastOpeningBracket = beforeLastBracket.lastIndexOf('[');
            if (lastOpeningBracket >= 0) {
              const element = trimmedJson.substring(lastOpeningBracket, lastBracketIndex + 1);
              const stringCount = (element.match(/","/g) || []).length;
              if (stringCount >= 2) {
                const beforeElement = trimmedJson.substring(0, lastOpeningBracket);
                jsonText = beforeElement.replace(/,\s*$/, '') + element + ']';
              } else {
                jsonText = beforeLastBracket.replace(/,\s*$/, '') + ']';
              }
            }
          }
        }
      }

      if (!jsonText.trim().endsWith(']')) {
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
      
      if (!Array.isArray(reasons) || !reasons.every((r) => Array.isArray(r))) {
        throw new Error("Invalid format: not an array of arrays");
      }
      
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

      while (validReasons.length < products.length) {
        validReasons.push(["Matches your search", "Good quality", "Great value"]);
      }
      return validReasons.slice(0, products.length);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Attempted to parse:", jsonText.substring(0, 500));
      console.warn("Falling back to default reasons due to JSON parse error");
      return products.map(() => [
        "Matches your search criteria",
        "Good value for money",
        "Popular choice",
      ]);
    }
  } catch (error) {
    console.error("Gemini error:", error);
    return products.map(() => [
      "Matches your search criteria",
      "Good value for money",
      "Popular choice",
    ]);
  }
}

