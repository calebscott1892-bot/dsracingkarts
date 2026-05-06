"use client";

import { useEffect, useState } from "react";
import C4FooterCredit from "./C4FooterCredit";

type Props = {
  href?: string;
  label?: string;
  size?: number;
  showText?: boolean;
  openInNewTab?: boolean;
  colorScheme?: "dark" | "light" | "auto";
};

export default function C4FooterCreditMounted(props: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <a
        href={props.href || "https://c4studios.com.au"}
        target={props.openInNewTab === false ? undefined : "_blank"}
        rel={props.openInNewTab === false ? undefined : "noopener noreferrer"}
        aria-label={props.label || "Designed by C4 Studios"}
        className="inline-flex h-9 items-center font-heading text-xs tracking-[0.2em] text-text-muted"
      >
        C4
      </a>
    );
  }

  return <C4FooterCredit {...props} />;
}
