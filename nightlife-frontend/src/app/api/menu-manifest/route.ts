import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const menuId = searchParams.get("menuId");

    if (!clubId || !menuId) {
      return NextResponse.json({ error: "Missing clubId or menuId parameter" }, { status: 400 });
    }

    // Construct the S3 URL for the manifest using the correct path structure
    const manifestUrl = `https://nightlife-files.s3.amazonaws.com/clubs/${clubId}/menu/${menuId}/manifest.json`;
    
    // Fetch the manifest from S3
    const response = await fetch(manifestUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    const manifest = await response.json();
    
    // Return the manifest with proper headers
    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error fetching menu manifest:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
