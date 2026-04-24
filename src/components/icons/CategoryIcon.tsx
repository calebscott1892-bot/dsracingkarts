import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: Partial<IconProps> = {
  viewBox: "0 0 64 64",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function SteeringIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="5" />
      <path d="M14 28c6-2 12-3 18-3s12 1 18 3" />
      <path d="M32 37v15" />
      <path d="M18 50c3-6 8-10 14-10s11 4 14 10" />
      <path d="M10 32h8M46 32h8" />
    </svg>
  );
}

function ChainsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="10" y="22" width="18" height="20" rx="9" />
      <rect x="36" y="22" width="18" height="20" rx="9" />
      <path d="M26 32h12" />
      <circle cx="19" cy="32" r="2.5" />
      <circle cx="45" cy="32" r="2.5" />
    </svg>
  );
}

function BrakesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="32" cy="32" r="20" />
      <circle cx="32" cy="32" r="13" />
      <circle cx="32" cy="32" r="4" />
      <path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M18 46l4-4M42 22l4-4" />
      <path d="M40 22h10v10" strokeWidth={2.2} />
    </svg>
  );
}

function AxlesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="6" y="28" width="52" height="8" rx="1" />
      <circle cx="14" cy="32" r="2" />
      <circle cx="50" cy="32" r="2" />
      <path d="M4 26v12M60 26v12" />
      <path d="M22 28v8M42 28v8" />
    </svg>
  );
}

function StubAxlesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="22" cy="32" r="12" />
      <circle cx="22" cy="32" r="4" />
      <rect x="32" y="28" width="22" height="8" rx="1" />
      <path d="M54 26v12" />
      <path d="M40 28v8M48 28v8" />
    </svg>
  );
}

function BearingsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="8" />
      <circle cx="32" cy="12" r="3" />
      <circle cx="32" cy="52" r="3" />
      <circle cx="12" cy="32" r="3" />
      <circle cx="52" cy="32" r="3" />
      <circle cx="18" cy="18" r="3" />
      <circle cx="46" cy="18" r="3" />
      <circle cx="18" cy="46" r="3" />
      <circle cx="46" cy="46" r="3" />
    </svg>
  );
}

function RacewearIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 38c0-12 9-22 22-22 10 0 18 7 18 17v7a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-2z" />
      <path d="M22 38h28" />
      <path d="M24 28c4-3 9-4 14-4" />
      <path d="M52 32h4v6h-4" />
      <circle cx="18" cy="42" r="1.5" />
    </svg>
  );
}

function MiscIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="14" y="14" width="16" height="16" />
      <rect x="34" y="14" width="16" height="16" fill="currentColor" fillOpacity="0.15" />
      <rect x="14" y="34" width="16" height="16" fill="currentColor" fillOpacity="0.15" />
      <rect x="34" y="34" width="16" height="16" />
      <path d="M8 10l4-4M56 10l-4-4M8 54l4 4M56 54l-4 4" />
    </svg>
  );
}

function FuelIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 16h22v38a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" />
      <path d="M22 16v-4h14v4" />
      <path d="M40 24h8v14a4 4 0 0 1-4 4" />
      <path d="M44 42v4" />
      <path d="M24 28h10v6H24z" />
    </svg>
  );
}

function ServicesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M44 12a10 10 0 0 0-13 13L12 44a4 4 0 0 0 0 6 4 4 0 0 0 6 0l19-19a10 10 0 0 0 13-13l-6 6-6-2-2-6z" />
    </svg>
  );
}

function TieRodIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="14" cy="32" r="6" />
      <circle cx="14" cy="32" r="2" />
      <circle cx="50" cy="32" r="6" />
      <circle cx="50" cy="32" r="2" />
      <path d="M20 32h24" />
      <path d="M22 29h20v6H22z" fill="currentColor" fillOpacity="0.1" />
    </svg>
  );
}

function CarRacingIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 38c0-2 2-4 4-4h6l4-8h18l6 8h6c4 0 8 2 8 6v4H6z" />
      <circle cx="18" cy="44" r="5" />
      <circle cx="46" cy="44" r="5" />
      <path d="M28 26h8v-4h-8z" />
    </svg>
  );
}

function ChassisIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="10" y="18" width="44" height="26" rx="3" />
      <path d="M16 24h32" />
      <path d="M16 30h32" />
      <path d="M16 36h20" />
      <circle cx="20" cy="48" r="4" />
      <circle cx="44" cy="48" r="4" />
    </svg>
  );
}

function ChassisComponentsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="24" cy="24" r="8" />
      <circle cx="24" cy="24" r="3" />
      <path d="M30 30l10 10" />
      <rect x="40" y="40" width="12" height="8" rx="1" />
      <path d="M10 44h20" />
      <path d="M14 50h12" />
    </svg>
  );
}

function EngineIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="12" y="22" width="28" height="20" rx="2" />
      <path d="M40 26h10v12H40" />
      <path d="M18 22v-6h16v6" />
      <circle cx="20" cy="32" r="2" />
      <circle cx="32" cy="32" r="2" />
      <path d="M14 46h24" />
    </svg>
  );
}

const ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  "steering-components": SteeringIcon,
  "chains": ChainsIcon,
  "brakes-components": BrakesIcon,
  "axles-components": AxlesIcon,
  "stub-axles-accessories": StubAxlesIcon,
  "bearings": BearingsIcon,
  "chassis": ChassisIcon,
  "chassis-components": ChassisComponentsIcon,
  "engines-accessories": EngineIcon,
  "racewear": RacewearIcon,
  "miscellaneous": MiscIcon,
  "fuel-tank-accessories": FuelIcon,
  "services": ServicesIcon,
  "tie-rods-ends": TieRodIcon,
  "car-racing": CarRacingIcon,
};

export function CategoryIcon({
  slug,
  className,
  ...rest
}: { slug: string; className?: string } & IconProps) {
  const Icon = ICONS[slug] ?? MiscIcon;
  return <Icon className={className} {...rest} />;
}

export function hasCategoryIcon(slug: string): boolean {
  return slug in ICONS;
}
