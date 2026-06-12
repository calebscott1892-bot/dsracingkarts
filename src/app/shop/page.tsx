import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import {
  ShopPageView,
  SHOP_DESCRIPTION,
  type ShopViewParams,
} from "@/components/shop/ShopPageView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  searchParams: Promise<ShopViewParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const canonicalParams = new URLSearchParams();
  if (params.page && params.page !== "1") canonicalParams.set("page", params.page);

  return {
    title: "Shop All Products",
    description: SHOP_DESCRIPTION,
    alternates: {
      canonical: canonicalParams.toString() ? `/shop?${canonicalParams.toString()}` : "/shop",
    },
    robots: params.search?.trim()
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;

  // Categories moved to /shop/<slug>. Old ?category= links (bookmarks, Google's
  // index, Square descriptions) follow a permanent redirect to the new home.
  if (params.category) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.sort) qs.set("sort", params.sort);
    if (params.page && params.page !== "1") qs.set("page", params.page);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    permanentRedirect(`/shop/${encodeURIComponent(params.category)}${suffix}`);
  }

  return <ShopPageView params={params} />;
}
