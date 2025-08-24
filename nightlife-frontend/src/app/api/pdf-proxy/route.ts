import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const strategy = searchParams.get("strategy") || "default";

    if (!url) {
      return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
    }
  
    // Validate URL - allow S3 bucket URLs and external URLs for testing
    const isS3Url = url.startsWith("https://nightlife-files.s3.amazonaws.com/");
    const isExternalTestUrl = process.env.NODE_ENV === "development" && (
      url.startsWith("https://www.w3.org/") ||
      url.startsWith("https://www.africau.edu/")
    );
    
    if (!isS3Url && !isExternalTestUrl) {
      return NextResponse.json({ error: "Invalid URL domain" }, { status: 400 });
    }
  
    // Fetch the PDF
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
    
    // For iframe strategy, use inline to show in browser
    // For other strategies, use attachment to force download
    if (strategy === "iframe") {
      cleanHeaders.set("Content-Disposition", "inline");
    } else {
      cleanHeaders.set("Content-Disposition", "attachment; filename=menu.pdf");
    }
    
    // Forward performance headers if present
    if (response.headers.has("Content-Length")) {
      cleanHeaders.set("Content-Length", response.headers.get("Content-Length")!);
    }
    if (response.headers.has("Accept-Ranges")) {
      cleanHeaders.set("Accept-Ranges", response.headers.get("Accept-Ranges")!);
    }
    
    // Add cache-busting to prevent stale PDFs
    cleanHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    cleanHeaders.set("Pragma", "no-cache");
    cleanHeaders.set("Expires", "0");
    
    // CORS headers for cross-origin requests
    cleanHeaders.set("Access-Control-Allow-Origin", "*");
    cleanHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    cleanHeaders.set("Access-Control-Allow-Headers", "Content-Type");
    
    // Stream the response for better performance
    return new NextResponse(response.body, {
      status: 200,
      headers: cleanHeaders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  // Handle preflight requests for CORS
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
