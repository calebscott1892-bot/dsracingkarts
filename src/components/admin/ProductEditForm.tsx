"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Save, ExternalLink, Star, Upload, X } from "lucide-react";

interface Props {
  product: any;
  allCategories: { id: string; name: string; slug: string; parent_id: string | null }[];
}

export function ProductEditForm({ product, allCategories }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    description: product.description || "",
    sku: product.sku || "",
    status: product.status,
    visibility: product.visibility,
    shipping_enabled: product.shipping_enabled,
    seo_title: product.seo_title || "",
    seo_description: product.seo_description || "",
  });

  const [variations, setVariations] = useState(
    product.product_variations?.map((v: any) => ({
      id: v.id,
      name: v.name,
      sku: v.sku || "",
      price: v.price,
      sale_price: v.sale_price || "",
    })) || []
  );

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    product.product_categories?.map((pc: any) => pc.category_id) || []
  );

  const [images, setImages] = useState<any[]>(
    product.product_images?.sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)) || []
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const { image } = await res.json();
        setImages((prev) => [...prev, image]);
        router.refresh();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImageDelete(imageId: string) {
    if (!confirm("Delete this image?")) return;
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    if (res.ok) {
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      router.refresh();
    }
  }

  async function handleSetPrimary(imageId: string) {
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    if (res.ok) {
      setImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
      router.refresh();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          variations,
          categories: selectedCategories,
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("Save failed. Check console for details.");
      }
    } catch (err) {
      console.error(err);
      alert("Save failed");
    }
    setSaving(false);
  }

  function updateField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateVariation(index: number, key: string, value: any) {
    setVariations((prev: any[]) =>
      prev.map((v, i) => (i === index ? { ...v, [key]: value } : v))
    );
  }

  function toggleCategory(catId: string) {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId]
    );
  }

  const isSquareSynced = Boolean(product.square_token);

  return (
    <div className="space-y-8">
      {isSquareSynced && (
        <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
          <p className="text-amber-300 text-sm font-medium mb-1">
            Square is the source of truth for this product
          </p>
          <p className="text-text-muted text-xs leading-relaxed">
            Changes to <span className="text-white">name</span>, <span className="text-white">description</span>, and <span className="text-white">variation price/SKU</span> will be overwritten the next time Square sends a catalog update. Edit those in the{" "}
            <a
              href={`https://squareup.com/dashboard/items/library/${product.square_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline hover:text-amber-200"
            >
              Square Dashboard
            </a>{" "}
            or use <span className="text-white">Bulk Pricing</span> for global % price changes. Status, visibility, SEO, categories, and images remain site-only and stick.
          </p>
        </div>
      )}

      {/* Basic info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-lg uppercase tracking-wider">Basic Information</h2>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
            Product Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
        </div>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
            Description (HTML)
          </label>
          <textarea
            rows={6}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => updateField("sku", e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
          </div>
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">Visibility</label>
            <select
              value={form.visibility}
              onChange={(e) => updateField("visibility", e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            >
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Variations */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-lg uppercase tracking-wider">
          Variations
        </h2>

        {variations.map((v: any, i: number) => (
          <div key={v.id || i} className="bg-surface-700/50 rounded p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-text-muted text-xs block mb-1">Name</label>
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariation(i, "name", e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
              <div>
                <label className="text-text-muted text-xs block mb-1">SKU</label>
                <input
                  type="text"
                  value={v.sku}
                  onChange={(e) => updateVariation(i, "sku", e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
              <div>
                <label className="text-text-muted text-xs block mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={v.price}
                  onChange={(e) =>
                    updateVariation(i, "price", parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
              <div>
                <label className="text-text-muted text-xs block mb-1">Sale Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={v.sale_price}
                  onChange={(e) =>
                    updateVariation(i, "sale_price", e.target.value ? parseFloat(e.target.value) : "")
                  }
                  className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Images */}
      {/* NOTE: Requires Supabase Storage bucket "product-images" to be created (public) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg uppercase tracking-wider">Images</h2>
          <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload Image"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">No images yet. Upload one above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img: any) => (
              <div
                key={img.id}
                className={`relative group border overflow-hidden ${
                  img.is_primary
                    ? "border-brand-red"
                    : "border-surface-600/50"
                }`}
              >
                <div className="aspect-square relative bg-surface-700">
                  <Image
                    src={img.url}
                    alt={img.alt_text || "Product image"}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                </div>
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!img.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(img.id)}
                      className="p-2 bg-surface-700 rounded hover:bg-brand-red transition-colors"
                      title="Set as primary"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleImageDelete(img.id)}
                    className="p-2 bg-surface-700 rounded hover:bg-red-600 transition-colors"
                    title="Delete image"
                  >
                    <X size={14} />
                  </button>
                </div>
                {img.is_primary && (
                  <div className="absolute top-1 left-1 bg-brand-red text-white text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-heading">
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-lg uppercase tracking-wider">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                selectedCategories.includes(cat.id)
                  ? "bg-brand-red text-white"
                  : "bg-surface-700 text-text-secondary hover:bg-surface-600"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div className="card p-6 space-y-4">
        <h2 className="font-heading text-lg uppercase tracking-wider">SEO</h2>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
            SEO Title
          </label>
          <input
            type="text"
            value={form.seo_title}
            onChange={(e) => updateField("seo_title", e.target.value)}
            className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
            SEO Description
          </label>
          <textarea
            rows={2}
            value={form.seo_description}
            onChange={(e) => updateField("seo_description", e.target.value)}
            className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? "Saving…" : "Save Product"}
        </button>
        <a
          href="https://squareup.com/dashboard/items/library"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2"
        >
          <ExternalLink size={16} /> Manage in Square
        </a>
      </div>
    </div>
  );
}
