import { NextRequest, NextResponse } from "next/server";
import { generateCompareVerdict } from "@/lib/llm/compare-verdict";

export async function POST(request: NextRequest) {
  try {
    const { provider = "openai", brief, a, b } = await request.json();

    if (!a || !b) {
      return NextResponse.json(
        { error: "Both products required" },
        { status: 400 }
      );
    }

    // Generate verdict using LLM
    const verdict = await generateCompareVerdict(
      provider as "openai" | "anthropic",
      a,
      b,
      brief || {}
    );

    return NextResponse.json(verdict);
  } catch (error) {
    console.error("Compare verdict error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

