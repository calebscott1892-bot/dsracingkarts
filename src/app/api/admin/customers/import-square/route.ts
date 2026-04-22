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

  const square = getSquareClient();
  const serviceClient = createServiceClient();

  let cursor: string | undefined;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    do {
      const response = await square.customersApi.listCustomers(
        cursor,
        100, // max per page
        undefined,
        undefined
      );

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
          city: c.address?.locality || null,
          state: c.address?.administrativeDistrictLevel1 || null,
          postcode: c.address?.postalCode || null,
        };

        const { error } = await serviceClient
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
    return NextResponse.json(
      { error: err?.message || "Square API error" },
      { status: 500 }
    );
  }
}
