export type CompareVerdict = {
  verdict: string;
  bulletsA: string[];
  bulletsB: string[];
  tags?: string[];
};

async function generateCompareVerdictOpenAI(
  productA: any,
  productB: any,
  brief: Record<string, any>
): Promise<CompareVerdict> {
  if (!process.env.OPENAI_API_KEY) {
    return generateCompareVerdictLocal(productA, productB, brief);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const briefText = Object.entries(brief)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const prompt = `Compare two products for a user:

Product A: ${productA.title} by ${productA.brand}
- Price: ₹${productA.price}
- Category: ${productA.category}
- Color: ${productA.color}
- Style: ${productA.style}
- Occasions: ${productA.occasionTags?.join(", ") || "N/A"}

Product B: ${productB.title} by ${productB.brand}
- Price: ₹${productB.price}
- Category: ${productB.category}
- Color: ${productB.color}
- Style: ${productB.style}
- Occasions: ${productB.occasionTags?.join(", ") || "N/A"}

User's brief: ${briefText || "None specified"}

Return ONLY a JSON object:
{
  "verdict": "short verdict: Choose A if..., choose B if...",
  "bulletsA": ["advantage 1", "advantage 2", "advantage 3"],
  "bulletsB": ["advantage 1", "advantage 2", "advantage 3"],
  "tags": ["Best for budget", "Best for formal", "Best for comfort"] // 1-3 tags
}

Rules:
- Keep verdict under 30 words
- Bullets max 10 words each
- Tags should reflect brief priorities
- Be decisive and grounded in attributes`;

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
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return generateCompareVerdictLocal(productA, productB, brief);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CompareVerdict;
    }

    return generateCompareVerdictLocal(productA, productB, brief);
  } catch (error) {
    console.error("OpenAI compare verdict error:", error);
    return generateCompareVerdictLocal(productA, productB, brief);
  }
}

async function generateCompareVerdictAnthropic(
  productA: any,
  productB: any,
  brief: Record<string, any>
): Promise<CompareVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateCompareVerdictLocal(productA, productB, brief);
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const briefText = Object.entries(brief)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const prompt = `Compare two products for a user:

Product A: ${productA.title} by ${productA.brand}
- Price: ₹${productA.price}
- Category: ${productA.category}
- Color: ${productA.color}
- Style: ${productA.style}
- Occasions: ${productA.occasionTags?.join(", ") || "N/A"}

Product B: ${productB.title} by ${productB.brand}
- Price: ₹${productB.price}
- Category: ${productB.category}
- Color: ${productB.color}
- Style: ${productB.style}
- Occasions: ${productB.occasionTags?.join(", ") || "N/A"}

User's brief: ${briefText || "None specified"}

Return ONLY a JSON object:
{
  "verdict": "short verdict: Choose A if..., choose B if...",
  "bulletsA": ["advantage 1", "advantage 2", "advantage 3"],
  "bulletsB": ["advantage 1", "advantage 2", "advantage 3"],
  "tags": ["Best for budget", "Best for formal", "Best for comfort"] // 1-3 tags
}

Rules:
- Keep verdict under 30 words
- Bullets max 10 words each
- Tags should reflect brief priorities
- Be decisive and grounded in attributes`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
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
      return generateCompareVerdictLocal(productA, productB, brief);
    }

    const text = content.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CompareVerdict;
    }

    return generateCompareVerdictLocal(productA, productB, brief);
  } catch (error) {
    console.error("Anthropic compare verdict error:", error);
    return generateCompareVerdictLocal(productA, productB, brief);
  }
}

function generateCompareVerdictLocal(
  productA: any,
  productB: any,
  brief: Record<string, any>
): CompareVerdict {
  const cheaper = productA.price < productB.price ? "A" : "B";
  const moreFormal = productA.style === "Formal" || productB.style === "Formal" 
    ? (productA.style === "Formal" ? "A" : "B")
    : null;

  const verdict = `Choose ${cheaper} for budget, ${moreFormal || "A"} for formal occasions.`;

  const bulletsA = [
    `Price: ₹${productA.price}`,
    `Style: ${productA.style}`,
    `Color: ${productA.color}`,
  ];

  const bulletsB = [
    `Price: ₹${productB.price}`,
    `Style: ${productB.style}`,
    `Color: ${productB.color}`,
  ];

  const tags: string[] = [];
  if (productA.price < productB.price) {
    tags.push("Best for budget");
  } else {
    tags.push("Best for budget");
  }
  if (productA.style === "Formal" || productB.style === "Formal") {
    tags.push("Best for formal");
  }

  return {
    verdict,
    bulletsA,
    bulletsB,
    tags,
  };
}

export async function generateCompareVerdict(
  provider: "openai" | "anthropic",
  productA: any,
  productB: any,
  brief: Record<string, any>
): Promise<CompareVerdict> {
  if (provider === "openai") {
    return generateCompareVerdictOpenAI(productA, productB, brief);
  }
  return generateCompareVerdictAnthropic(productA, productB, brief);
}

