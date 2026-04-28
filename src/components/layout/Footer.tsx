import Link from "next/link";
import { Facebook, Mail, MapPin, Phone } from "lucide-react";
import { AppointmentAddress } from "./AppointmentPopup";
import C4FooterCredit from "../c4-footer-credit/C4FooterCredit";

export function Footer() {
  return (
    <footer className="bg-racing-dark carbon-fiber mt-16">
      <div className="chequered-stripe-sm" />

      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="mb-4">
            <span className="font-heading text-3xl uppercase tracking-[0.2em] text-white">
              DS<span className="text-racing-red">R</span>
            </span>
          </div>
          <p className="text-text-secondary text-sm leading-relaxed mb-5">
            Go kart parts, engines &amp; expert race service. By appointment only — Long Reef Crescent, Woodbine, NSW.
          </p>
          <div className="flex gap-3">
            <a href="https://www.facebook.com/dsracingkarts" target="_blank" rel="noopener noreferrer"
              className="w-11 h-11 flex items-center justify-center bg-surface-700 hover:bg-racing-red text-text-muted hover:text-white transition-all">
              <Facebook size={18} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-heading uppercase tracking-[0.2em] text-xs text-racing-red mb-5">Shop</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/shop" className="text-text-secondary hover:text-white hover:pl-1 transition-all">All Products</Link></li>
            <li><Link href="/#categories" className="text-text-secondary hover:text-white hover:pl-1 transition-all">Categories</Link></li>
            <li><Link href="/gift-card" className="text-text-secondary hover:text-white hover:pl-1 transition-all">E-Gift Card</Link></li>
            <li><Link href="/predator-chassis" className="text-text-secondary hover:text-white hover:pl-1 transition-all">Preloved Predator Chassis Available</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading uppercase tracking-[0.2em] text-xs text-racing-red mb-5">Support</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/contact" className="text-text-secondary hover:text-white hover:pl-1 transition-all">Contact Us</Link></li>
            <li><Link href="/terms" className="text-text-secondary hover:text-white hover:pl-1 transition-all">Terms &amp; Conditions</Link></li>
            <li><Link href="/privacy" className="text-text-secondary hover:text-white hover:pl-1 transition-all">Privacy Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading uppercase tracking-[0.2em] text-xs text-racing-red mb-5">Get In Touch</h4>
          <ul className="space-y-3 text-sm text-text-secondary">
            <li>
              <AppointmentAddress className="flex items-center gap-2.5 text-text-secondary hover:text-white transition-colors cursor-pointer text-left">
                <MapPin size={14} className="text-racing-red shrink-0" />Long Reef Crescent, Woodbine, NSW
              </AppointmentAddress>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail size={14} className="text-racing-red shrink-0" />
              <a href="mailto:dsracing@bigpond.com" className="hover:text-white transition-colors">dsracing@bigpond.com</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone size={14} className="text-racing-red shrink-0" />
              <a href="tel:+61492454854" className="hover:text-white transition-colors">0492 454 854</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Facebook size={14} className="text-racing-red shrink-0" />
              <a href="https://www.facebook.com/dsracingkarts" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Message us on Facebook</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-surface-600/50">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-text-muted text-xs">&copy; {new Date().getFullYear()} DS Racing Karts. All rights reserved.</p>
          <div className="flex items-center gap-2 text-text-muted/60 text-[11px] tracking-wide">
            <span className="uppercase">Designed&nbsp;by</span>
            <C4FooterCredit
              href="https://c4studios.com.au"
              label="Designed by C4 Studios"
              size={36}
              showText={false}
              openInNewTab={true}
              colorScheme="dark"
            />
          </div>
          <div className="flex gap-4 text-xs text-text-muted">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
