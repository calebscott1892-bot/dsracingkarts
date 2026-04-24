import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!admin || !["admin", "super_admin"].includes(admin.role)) return null;
  return supabase;
}

export async function POST() {
  const supabase = await verifyAdmin();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Square access token is missing" }, { status: 500 });
  }

  const square = getSquareClient();
  const writeClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : supabase;

  let cursor: string | undefined;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    do {
      // Square SDK v38 builds invalid query strings when optional params are
      // passed alongside `undefined`. Cursor-only pagination avoids the malformed
      // `&&&` query parameters while still returning the default 100 customers.
      const response = cursor
        ? await square.customersApi.listCustomers(cursor)
        : await square.customersApi.listCustomers();

      const customers = response.result.customers || [];
      cursor = response.result.cursor;

      for (const c of customers) {
        if (!c.emailAddress) {
          skipped++;
          continue;
        }

        // Build upsert payload — Square uses cents for money, not here though
        const payload = {
          email: c.emailAddress.toLowerCase().trim(),
          first_name: c.givenName || null,
          last_name: c.familyName || null,
          phone: c.phoneNumber || null,
          address_line1: c.address?.addressLine1 || null,
          address_line2: c.address?.addressLine2 || null,
          city: c.address?.locality || null,
          state: c.address?.administrativeDistrictLevel1 || null,
          postcode: c.address?.postalCode || null,
          country: c.address?.country || "AU",
          square_customer_id: c.id || null,
        };

        const { error } = await writeClient
          .from("customers")
          .upsert(payload, { onConflict: "email", ignoreDuplicates: false });

        if (error) {
          errors.push(`${c.emailAddress}: ${error.message}`);
        } else {
          imported++;
        }
      }
    } while (cursor);

    return NextResponse.json({ imported, skipped, errors });
  } catch (err: any) {
    let errorBody = err?.body;
    if (typeof err?.body === "string") {
      try {
        errorBody = JSON.parse(err.body);
      } catch {
        errorBody = undefined;
      }
    }
    const squareMessage = errorBody?.errors
      ?.map((entry: { detail?: string; code?: string }) => entry.detail || entry.code)
      .filter(Boolean)
      .join(" | ");

    return NextResponse.json(
      { error: squareMessage || err?.message || "Square API error" },
      { status: 500 }
    );
  }
}
