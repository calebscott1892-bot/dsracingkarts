// Shared client-side preference flags for the game engine.
// Lives outside React so the (non-React) renderer and physics can read it
// cheaply every frame without prop-drilling.

let reducedMotion = false;

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion = mq.matches;
  // Safari <14 only supports the deprecated addListener signature.
  const onChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
  };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/** True when the user has asked the OS to minimise non-essential motion. */
export function prefersReducedMotion(): boolean {
  return reducedMotion;
}
