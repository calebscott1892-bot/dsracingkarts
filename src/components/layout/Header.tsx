"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ShoppingCart, Menu, X, Phone } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import C4FooterCredit from "../c4-footer-credit/C4FooterCredit";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { cart } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // 5 nav links — Shop in the middle (index 2)
  const navLinks = [
    { href: "/about", label: "About" },
    { href: "/services", label: "Services" },
    { href: "/shop", label: "Shop" },
    { href: "/sponsors", label: "Sponsors" },
    { href: "/#categories", label: "Categories" },
  ];

  return (
    <>
      {/* Racing stripe top — red accent */}
      <div className="h-1 bg-racing-red" />

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white shadow-md"
            : "bg-white"
        }`}
      >
        {/* Top bar: Logo centered, icons on right */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 -ml-2 text-racing-black hover:text-racing-red transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* C4 Studios credit — desktop only */}
            <div className="hidden md:flex items-center ml-4 lg:ml-7 opacity-60 hover:opacity-100 transition-opacity">
              <a href="https://c4studios.com.au" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black rounded-full px-3.5 py-1.5 shadow-sm hover:bg-black transition-colors">
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/50 font-heading whitespace-nowrap">designed with</span>
                <C4FooterCredit
                  size={32}
                  showText={false}
                  colorScheme="dark"
                  initialStage={1}
                />
              </a>
            </div>

            {/* Logo — centered */}
            <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center">
              <Image
                src="/images/history/Site Logo (2).png"
                alt="DS Racing Karts"
                width={80}
                height={50}
                className="h-10 md:h-12 w-auto object-contain"
                priority
              />
            </Link>

            {/* Right actions — Contact (phone) + Cart */}
            <div className="flex items-center gap-1 ml-auto">
              <Link
                href="/contact"
                className="relative p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-racing-black/60 hover:text-racing-red transition-colors"
                aria-label="Contact us"
              >
                <Phone size={18} />
              </Link>
              <Link href="/cart" className="relative p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-racing-black/60 hover:text-racing-red transition-colors">
                <ShoppingCart size={18} />
                {cart.item_count > 0 && (
                  <span className="absolute top-1 right-0.5 bg-racing-red text-white text-[9px] w-4 h-4 flex items-center justify-center font-bold rounded-full">
                    {cart.item_count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Desktop navigation — 5 links, Shop highlighted in centre */}
        <nav className="hidden md:block border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-center gap-0.5 h-11">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    link.label === "Shop"
                      ? "relative font-heading text-[11px] uppercase tracking-[0.12em] bg-racing-red text-white hover:bg-racing-red/90 px-6 py-1.5 transition-colors whitespace-nowrap"
                      : "relative font-heading text-[11px] uppercase tracking-[0.12em] text-racing-black/70 hover:text-racing-red px-3 lg:px-5 py-2 transition-colors whitespace-nowrap"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Red line under nav */}
        <div className="h-[3px] bg-racing-red" />

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-x-0 top-[calc(4rem+7px)] bottom-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
        )}

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden bg-surface-800 border-t border-surface-600 px-4 py-4 space-y-0.5 animate-fade-in relative z-50 shadow-xl max-h-[70vh] overflow-y-auto">
            <Link
              href="/"
              className="block font-heading text-sm uppercase tracking-[0.1em] text-text-secondary
                         hover:text-white py-2.5 px-3 border-l-2 border-transparent
                         hover:border-brand-red hover:bg-surface-700 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block font-heading text-sm uppercase tracking-[0.1em] text-text-secondary
                           hover:text-white py-2.5 px-3 border-l-2 border-transparent
                           hover:border-brand-red hover:bg-surface-700 transition-all"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="block font-heading text-sm uppercase tracking-[0.1em] text-brand-red
                         py-2.5 px-3 border-l-2 border-brand-red bg-brand-red/10 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Contact Us
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
