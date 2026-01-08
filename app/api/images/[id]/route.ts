import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params;
    
    // Construct the image path
    const imagePath = join(process.cwd(), "data", "image", `${imageId}.png`);
    
    // Check if image exists
    if (!existsSync(imagePath)) {
      return new NextResponse("Image not found", { status: 404 });
    }
    
    // Read the image file
    const imageBuffer = readFileSync(imagePath);
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new NextResponse("Error serving image", { status: 500 });
  }
}

