'use client';

import { useEffect, useRef } from 'react';
import C4FooterCredit from '@/components/c4-footer-credit/C4FooterCredit';

/**
 * C4 Studios card for the sponsors carousel.
 * Matches SponsorCard dimensions, renders the animated C4 badge.
 * Auto-advances to the mono (stage 1) animation on mount.
 */
export default function C4SponsorCard() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-advance to stage 1 (mono) so the logo isn't in dormant state
    const timer = setTimeout(() => {
      const anchor = wrapperRef.current?.querySelector('a');
      if (anchor) {
        anchor.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="flex-shrink-0 mx-2 md:mx-3 bg-black rounded-md overflow-hidden flex items-center justify-center w-[140px] h-[80px] md:w-[180px] md:h-[100px]"
    >
      <C4FooterCredit
        href="https://c4studios.com.au"
        size={44}
        showText={false}
        colorScheme="dark"
      />
    </div>
  );
}
