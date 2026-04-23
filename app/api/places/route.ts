import { NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GOOGLE_MAPS_API_KEY

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 })
  }

  const { searchParams } = req.nextUrl
  const query = searchParams.get("q")
  const placeId = searchParams.get("place_id")

  if (placeId) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
    url.searchParams.set("place_id", placeId)
    url.searchParams.set("fields", "place_id,name,formatted_address,address_components")
    url.searchParams.set("language", "ja")
    url.searchParams.set("key", API_KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== "OK") {
      return NextResponse.json({ error: data.status }, { status: 400 })
    }

    const p = data.result
    const get = (type: string) =>
      (p.address_components as { long_name: string; types: string[] }[])
        ?.find((c) => c.types.includes(type))?.long_name ?? ""

    return NextResponse.json({
      id: p.place_id,
      name: p.name,
      formatted_address: p.formatted_address,
      zip: get("postal_code"),
      province: get("administrative_area_level_1"),
      city: get("locality") || get("sublocality_level_1"),
      address1: p.formatted_address,
    })
  }

  if (query) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
    url.searchParams.set("input", query)
    url.searchParams.set("types", "lodging")
    url.searchParams.set("language", "ja")
    url.searchParams.set("key", API_KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ error: data.status }, { status: 400 })
    }

    const predictions = (data.predictions ?? []).map((p: {
      place_id: string
      structured_formatting: { main_text: string; secondary_text: string }
    }) => ({
      place_id: p.place_id,
      name: p.structured_formatting.main_text,
      secondary: p.structured_formatting.secondary_text,
    }))

    return NextResponse.json({ predictions })
  }

  return NextResponse.json({ error: "Missing q or place_id parameter" }, { status: 400 })
}
