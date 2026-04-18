"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ArrowRight, Command } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  image_url: string | null;
  sku: string | null;
  category: string | null;
  category_slug: string | null;
}

interface Props {
  initialQuery?: string;
}

export function SearchAutocomplete({ initialQuery = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  // Fetch with debounce
  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const data = await resp.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
      setActiveIndex(-1);
    } catch (err: any) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Global ⌘K / Ctrl+K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function viewAllResults() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("search", query);
    params.delete("page");
    router.push(`/shop?${params.toString()}`);
    setOpen(false);
    inputRef.current?.blur();
  }

  function goToResult(r: SearchResult) {
    router.push(`/product/${r.slug}`);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        goToResult(results[activeIndex]);
      } else if (query.trim().length >= 2) {
        viewAllResults();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown =
    open && (query.trim().length >= 2 || results.length > 0);

  function highlight(text: string) {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${escapeRegex(query.trim())})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-brand-red/25 text-white px-0.5 rounded-sm">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Glow ring on focus */}
      <div
        className={`relative transition-all duration-300 ${
          open ? "ring-1 ring-brand-red/40 shadow-[0_0_24px_rgba(230,0,18,0.15)]" : ""
        }`}
      >
        <div className="flex items-center bg-surface-800/80 backdrop-blur-sm border border-surface-600 hover:border-surface-500 focus-within:border-brand-red/60 transition-colors">
          <Search
            size={18}
            className="ml-4 text-text-muted shrink-0 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search chains, engines, racewear…"
            aria-label="Search products"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            className="flex-1 bg-transparent px-3 py-4 text-white placeholder:text-text-muted focus:outline-none text-sm md:text-base"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="mr-2 p-2 text-text-muted hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden md:flex items-center gap-1 mr-4 px-2 py-1 bg-surface-700 border border-surface-600 text-text-muted text-[10px] font-heading tracking-wider">
            <Command size={10} />K
          </kbd>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-2 bg-surface-800 border border-surface-600 shadow-2xl z-50 animate-fade-in overflow-hidden"
          role="listbox"
        >
          {/* Red accent bar */}
          <div className="h-[2px] bg-gradient-to-r from-brand-red via-brand-red/50 to-transparent" />

          {loading && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="inline-block w-4 h-4 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-xs mt-3 font-heading uppercase tracking-wider">
                Searching…
              </p>
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-text-muted text-sm">
                No products match <span className="text-white">&ldquo;{query}&rdquo;</span>
              </p>
              <p className="text-text-muted text-xs mt-2">Try a simpler term or browse by category.</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="px-4 py-2 border-b border-surface-700 flex items-center justify-between">
                <span className="text-text-muted text-[10px] font-heading uppercase tracking-[0.2em]">
                  Products
                </span>
                <span className="text-text-muted text-[10px] font-heading tracking-wider">
                  {total} {total === 1 ? "match" : "matches"}
                </span>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {results.map((r, idx) => (
                  <li key={r.id} role="option" aria-selected={idx === activeIndex}>
                    <Link
                      href={`/product/${r.slug}`}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex items-center gap-4 px-4 py-3 border-l-2 transition-colors ${
                        idx === activeIndex
                          ? "bg-surface-700/60 border-brand-red"
                          : "border-transparent hover:bg-surface-700/40"
                      }`}
                    >
                      <div className="w-14 h-14 shrink-0 bg-surface-700 relative overflow-hidden">
                        {r.image_url ? (
                          <Image
                            src={r.image_url}
                            alt={r.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full carbon-bg" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{highlight(r.name)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.category && (
                            <span className="text-[10px] font-heading uppercase tracking-[0.15em] text-brand-red/80">
                              {r.category}
                            </span>
                          )}
                          {r.sku && (
                            <span className="text-[10px] text-text-muted truncate">
                              SKU: {r.sku}
                            </span>
                          )}
                        </div>
                      </div>
                      {typeof r.price === "number" && r.price > 0 && (
                        <span className="shrink-0 font-heading text-sm text-white tracking-wide">
                          {formatPrice(r.price)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              {total > results.length && (
                <button
                  onClick={viewAllResults}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-700/40 hover:bg-surface-700 border-t border-surface-700 text-left transition-colors group"
                >
                  <span className="text-sm text-text-secondary group-hover:text-white transition-colors">
                    View all {total} results
                  </span>
                  <ArrowRight
                    size={14}
                    className="text-brand-red transition-transform group-hover:translate-x-1"
                  />
                </button>
              )}
            </>
          )}

          {/* Footer hint */}
          {(results.length > 0 || query.trim().length >= 2) && (
            <div className="px-4 py-2 bg-surface-900 border-t border-surface-700 flex items-center gap-3 text-[10px] text-text-muted font-heading uppercase tracking-[0.15em]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded-sm">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded-sm">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded-sm">esc</kbd>
                close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
