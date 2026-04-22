"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  productCount: number;
}

interface Props {
  categories: Category[];
}

const inputClass =
  "bg-surface-700 border border-surface-600 rounded px-3 py-1.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50";

export function CategoriesManager({ categories }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState<string | "root" | null>(null);
  const [addName, setAddName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Save failed");
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Products in this category will be uncategorised.`)) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Delete failed");
    }
  }

  async function handleAdd(parentId: string | null) {
    if (!addName.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName, parent_id: parentId }),
    });
    if (res.ok) {
      setShowAdd(null);
      setAddName("");
      if (parentId) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Create failed");
    }
    setSaving(false);
  }

  // Render inline rather than as nested components so inputs don't remount and drop focus.
  function renderInlineEdit(id: string) {
    return (
      <span className="flex items-center gap-1.5 ml-2">
        <input
          autoFocus
          className={inputClass + " w-48"}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename(id);
            if (e.key === "Escape") setEditingId(null);
          }}
        />
        <button
          onClick={() => handleRename(id)}
          disabled={saving}
          className="p-1.5 bg-green-700/40 hover:bg-green-700/70 rounded text-green-400 transition-colors"
        >
          <Check size={12} />
        </button>
        <button
          onClick={() => setEditingId(null)}
          className="p-1.5 bg-surface-600 hover:bg-surface-500 rounded text-text-muted transition-colors"
        >
          <X size={12} />
        </button>
      </span>
    );
  }

  function renderAddRow(parentId: string | null) {
    return (
      <tr className="border-t border-brand-red/20 bg-brand-red/5">
        <td className="px-4 py-2.5" colSpan={4}>
          <span className={parentId ? "pl-8 flex items-center gap-2" : "flex items-center gap-2"}>
            <input
              autoFocus
              className={inputClass + " w-52"}
              value={addName}
              placeholder={parentId ? "Subcategory name..." : "New category name..."}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd(parentId);
                if (e.key === "Escape") {
                  setShowAdd(null);
                  setAddName("");
                }
              }}
            />
            <button
              onClick={() => handleAdd(parentId)}
              disabled={saving || !addName.trim()}
              className="px-3 py-1.5 bg-brand-red hover:bg-brand-red/80 rounded text-xs text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => {
                setShowAdd(null);
                setAddName("");
              }}
              className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded text-xs text-text-muted transition-colors"
            >
              Cancel
            </button>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl uppercase tracking-wider">Categories</h1>
        <button
          onClick={() => {
            setShowAdd("root");
            setAddName("");
          }}
          className="flex items-center gap-2 btn-primary text-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left bg-surface-700/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {showAdd === "root" && renderAddRow(null)}

            {parents.map((parent) => {
              const children = childrenOf(parent.id);
              const isExpanded = expanded.has(parent.id);
              const isEditing = editingId === parent.id;

              return (
                <Fragment key={parent.id}>
                  <tr className="border-t border-surface-600/50 hover:bg-surface-700/30">
                    <td className="px-4 py-3 text-white font-medium">
                      <span className="flex items-center gap-1">
                        {children.length > 0 ? (
                          <button
                            onClick={() => toggleExpand(parent.id)}
                            className="text-text-muted hover:text-white transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="w-[14px]" />
                        )}
                        {isEditing ? renderInlineEdit(parent.id) : <span>{parent.name}</span>}
                        {children.length > 0 && (
                          <span className="ml-2 text-xs text-text-muted font-normal">
                            ({children.length} sub)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{parent.slug}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{parent.productCount}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setShowAdd(parent.id);
                            setAddName("");
                          }}
                          title="Add subcategory"
                          className="p-1.5 text-text-muted hover:text-white hover:bg-surface-600 rounded transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(parent.id);
                            setEditName(parent.name);
                          }}
                          title="Rename"
                          className="p-1.5 text-text-muted hover:text-white hover:bg-surface-600 rounded transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(parent.id, parent.name)}
                          title="Delete"
                          className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </td>
                  </tr>

                  {showAdd === parent.id && renderAddRow(parent.id)}

                  {isExpanded &&
                    children.map((child) => (
                      <tr key={child.id} className="border-t border-surface-600/30 hover:bg-surface-700/20">
                        <td className="px-4 py-2.5 text-text-secondary pl-10">
                          <span className="flex items-center gap-1">
                            <span className="text-text-muted mr-1">└</span>
                            {editingId === child.id ? renderInlineEdit(child.id) : <span>{child.name}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{child.slug}</td>
                        <td className="px-4 py-2.5 font-mono text-text-secondary">{child.productCount}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                setEditingId(child.id);
                                setEditName(child.name);
                              }}
                              title="Rename"
                              className="p-1.5 text-text-muted hover:text-white hover:bg-surface-600 rounded transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(child.id, child.name)}
                              title="Delete"
                              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {categories.length === 0 && (
          <p className="text-text-muted text-center py-8">No categories yet. Add one above.</p>
        )}
      </div>

      <p className="text-text-muted text-xs mt-4 text-center">
        {categories.length} categories total
      </p>
    </div>
  );
}
