export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const {
      address, city, state = "FL", zip, price, bedrooms, bathrooms, sqft,
      propertyType = "SINGLE_FAMILY", status = "ACTIVE", description, images = [],
    } = body

    if (!address?.trim() || !price) {
      return NextResponse.json({ error: "address and price are required" }, { status: 400 })
    }

    const property = await prisma.property.create({
      data: {
        address: address.trim(),
        city: city?.trim() || null,
        state: state?.trim() || "FL",
        zip: zip?.trim() || null,
        price: Number(price),
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        sqft: sqft ? Number(sqft) : null,
        propertyType,
        status,
        description: description?.trim() || null,
        images: JSON.stringify(images),
      },
    })

    return NextResponse.json({ property }, { status: 201 })
  } catch (e: any) {
    console.error("[Properties POST]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
