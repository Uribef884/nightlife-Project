import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
    }
  
    // Validate that the URL is from our S3 bucket
    if (!url.startsWith("https://nightlife-files.s3.amazonaws.com/")) {
      return NextResponse.json({ error: "Invalid URL domain" }, { status: 400 });
    }
  
    // Fetch the PDF from S3
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NightLife-PDF-Proxy/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PDF", status: response.status },
        { status: response.status }
      );
    }
  
    // Stream the PDF content instead of buffering it all
    const cleanHeaders = new Headers();
    cleanHeaders.set("Content-Type", "application/pdf");
    cleanHeaders.set("Content-Disposition", "inline");
    // Add cache-busting to prevent stale PDFs
    cleanHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    cleanHeaders.set("Pragma", "no-cache");
    cleanHeaders.set("Expires", "0");
    cleanHeaders.set("Access-Control-Allow-Origin", "*");
    cleanHeaders.set("X-Frame-Options", "SAMEORIGIN");
    
    // Stream the response for better performance
    return new NextResponse(response.body, {
      status: 200,
      headers: cleanHeaders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
