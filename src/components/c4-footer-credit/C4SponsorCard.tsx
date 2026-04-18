'use client';

import C4FooterCredit from '@/components/c4-footer-credit/C4FooterCredit';

/**
 * C4 Studios card for the sponsors carousel.
 * Matches SponsorCard dimensions, renders the animated C4 badge.
 * Starts at mono (stage 1) via initialStage prop.
 */
export default function C4SponsorCard() {
  return (
    <a
      href="https://c4studios.com.au"
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 mx-2 md:mx-3 bg-black rounded-md overflow-hidden flex items-center justify-center w-[140px] h-[80px] md:w-[180px] md:h-[100px]"
    >
      <C4FooterCredit
        size={44}
        showText={false}
        colorScheme="dark"
        initialStage={1}
      />
    </a>
  );
}
