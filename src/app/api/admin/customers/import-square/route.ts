import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";

/**
 * One-shot import of all Square customers into the local `customers` table.
 *
 * Notes for future readers:
 *  - We use `searchCustomers` (POST body) rather than `listCustomers` (GET query
 *    params) because Square SDK v38 builds malformed query strings when
 *    optional params are mixed with undefined values, which produced the
 *    "400 error" the client kept hitting.
 *  - Per-row failures are captured into `errors[]` and never break the whole
 *    import. The route only returns non-2xx for environment / schema-level
 *    failures the admin needs to act on.
 *  - We probe the `customers` table for the expected unique constraint up
 *    front so we surface the real cause if `onConflict: "email"` is going
 *    to fail.
 */

export const maxDuration = 60; // Vercel: bump from default 10s for big imports

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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST() {
  const session = await verifyAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "Square access token is missing on the server (SQUARE_ACCESS_TOKEN)." },
      { status: 500 }
    );
  }

  const writeClient = getAdminClient() ?? session;

  // ── Probe the customers table so we fail loudly with a useful message
  //    if it's missing or unreachable, rather than per-row deep in the loop.
  {
    const { error: probeError } = await writeClient.from("customers").select("email").limit(1);
    if (probeError) {
      return NextResponse.json(
        {
          error: `Customers table is unreachable: ${probeError.message}. ` +
            `If the column or table is missing, an admin needs to apply the customers schema migration.`,
        },
        { status: 500 }
      );
    }
  }

  const square = getSquareClient();
  let cursor: string | undefined;
  let imported = 0;
  let skipped = 0;
  let upsertConflictDetected = false;
  const errors: { email?: string; message: string }[] = [];

  try {
    do {
      // POST-based search avoids the SDK v38 query-string bug entirely.
      const response = await square.customersApi.searchCustomers({
        cursor,
        limit: BigInt(100),
      });

      const customers = response.result.customers || [];
      cursor = response.result.cursor;

      for (const c of customers) {
        if (!c.emailAddress) {
          skipped++;
          continue;
        }

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
          // Detect a missing unique-on-email index so we can tell the admin.
          if (
            !upsertConflictDetected &&
            /no unique or exclusion constraint/i.test(error.message)
          ) {
            upsertConflictDetected = true;
          }
          errors.push({ email: c.emailAddress, message: error.message });
        } else {
          imported++;
        }
      }
    } while (cursor);

    if (upsertConflictDetected) {
      return NextResponse.json(
        {
          error:
            "Customers table is missing a UNIQUE index on email — Square import can't dedupe " +
            "without it. Run: CREATE UNIQUE INDEX customers_email_key ON customers (email).",
          imported,
          skipped,
          errorCount: errors.length,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imported,
      skipped,
      errorCount: errors.length,
      // Include just the first few row errors so the admin can debug without
      // returning thousands of lines.
      sampleErrors: errors.slice(0, 5),
    });
  } catch (err: any) {
    // Square SDK throws ApiError instances with .body or .errors.
    let errorBody = err?.body;
    if (typeof errorBody === "string") {
      try {
        errorBody = JSON.parse(errorBody);
      } catch {
        errorBody = undefined;
      }
    }
    const squareMessage = errorBody?.errors
      ?.map((entry: { detail?: string; code?: string }) => entry.detail || entry.code)
      .filter(Boolean)
      .join(" | ");

    const status =
      typeof err?.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;

    console.error("[customers/import-square] failed:", err);

    return NextResponse.json(
      {
        error:
          squareMessage ||
          err?.message ||
          "Square API error — check SQUARE_ACCESS_TOKEN and that it has Customers read scope.",
        imported,
        skipped,
      },
      { status }
    );
  }
}
