"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

interface Props {
  paused: boolean;
  canPause: boolean;
  onPauseToggle: () => void;
}

/**
 * Mobile-first arcade controller bar that sits BELOW the game canvas.
 * Shape: [ BRAKE ][ PAUSE ][ GO ] — three buttons forming one rectangle,
 * styled like a chunky 2000s-era handheld controller. Each button has a
 * white embossed glyph and a press-down animation.
 *
 * Buttons fire synthetic KeyW (gas) / KeyS (brake) keyboard events so they
 * tap into the same input pipeline as desktop keyboard play.
 */
export function ArcadeControls({ paused, canPause, onPauseToggle }: Props) {
  const [gasDown, setGasDown] = useState(false);
  const [brakeDown, setBrakeDown] = useState(false);

  // Defensive: if the user lifts off-screen, ensure we release the keys.
  useEffect(() => {
    const release = () => {
      if (gasDown) {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
        setGasDown(false);
      }
      if (brakeDown) {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyS" }));
        setBrakeDown(false);
      }
    };
    window.addEventListener("touchcancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("touchcancel", release);
      window.removeEventListener("blur", release);
    };
  }, [gasDown, brakeDown]);

  function pressGas(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (paused) return;
    setGasDown(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  }
  function releaseGas(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setGasDown(false);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
  }
  function pressBrake(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (paused) return;
    setBrakeDown(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyS" }));
  }
  function releaseBrake(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setBrakeDown(false);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyS" }));
  }

  return (
    <div
      className="md:hidden w-full bg-black select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Faux-controller frame */}
      <div className="relative bg-gradient-to-b from-[#1c1f24] via-[#13161a] to-[#0a0c0f] border-t-2 border-surface-700 px-2 py-2.5">
        {/* The three-button rectangle */}
        <div className="flex items-stretch gap-1.5 h-[78px]">
          {/* BRAKE — blue, left, large */}
          <ControllerButton
            kind="brake"
            pressed={brakeDown && !paused}
            disabled={paused}
            onPress={pressBrake}
            onRelease={releaseBrake}
          />

          {/* PAUSE — small square, center */}
          <PauseButton paused={paused} disabled={!canPause} onPress={onPauseToggle} />

          {/* GO — red, right, large */}
          <ControllerButton
            kind="gas"
            pressed={gasDown && !paused}
            disabled={paused}
            onPress={pressGas}
            onRelease={releaseGas}
          />
        </div>
      </div>
    </div>
  );
}

// ── BRAKE / GO buttons ─────────────────────────────────────────────────────
function ControllerButton({
  kind,
  pressed,
  disabled,
  onPress,
  onRelease,
}: {
  kind: "gas" | "brake";
  pressed: boolean;
  disabled: boolean;
  onPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onRelease: (e: React.TouchEvent | React.MouseEvent) => void;
}) {
  const isGas = kind === "gas";
  const label = isGas ? "GO" : "BRAKE";

  // Colour palette per state. "live" = restful, "dim" = pressed.
  const live = isGas ? "#dc2433" : "#1f5dd6";
  const dim  = isGas ? "#7a1219" : "#11357a";
  const accent = isGas ? "#ffe4b5" : "#bcd6ff";
  const bg = pressed ? dim : live;
  const shadow = pressed
    ? "inset 0 4px 8px rgba(0,0,0,0.55), 0 0 0 1.5px #00000080"
    : `0 4px 0 ${dim}, 0 6px 12px rgba(0,0,0,0.55), inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.18)`;

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      onTouchCancel={onRelease}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={(e) => { if (pressed) onRelease(e); }}
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 relative flex flex-col items-center justify-center rounded-md transition-transform duration-75 active:scale-[0.98] disabled:opacity-50"
      style={{
        background: bg,
        boxShadow: shadow,
        transform: pressed ? "translateY(3px)" : "translateY(0)",
        border: `1.5px solid ${dim}`,
      }}
    >
      {/* White embossed glyph: arrow up for GO, arrow down for BRAKE */}
      <Glyph kind={kind} pressed={pressed} accent={accent} />
      <span
        className="font-digital text-[10px] tracking-[0.35em] mt-0.5"
        style={{ color: pressed ? "rgba(255,255,255,0.7)" : "#fff" }}
      >
        {label}
      </span>
    </button>
  );
}

function Glyph({ kind, pressed, accent }: { kind: "gas" | "brake"; pressed: boolean; accent: string }) {
  // Plate background — slightly inset white/grey square with the chevron on top.
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 38,
        height: 26,
        background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
        borderRadius: 4,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25)",
        opacity: pressed ? 0.85 : 1,
      }}
    >
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
        {kind === "gas" ? (
          // Up-pointing chevron (GO)
          <polygon points="11,1 21,11 16,11 16,13 6,13 6,11 1,11" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        ) : (
          // Down-pointing chevron (BRAKE)
          <polygon points="11,13 21,3 16,3 16,1 6,1 6,3 1,3" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        )}
      </svg>
    </div>
  );
}

// ── Pause button (small square in the centre) ──────────────────────────────
function PauseButton({
  paused,
  disabled,
  onPress,
}: {
  paused: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const live = "#475260";
  const dim = "#1d232b";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex flex-col items-center justify-center rounded-md transition-transform duration-75 active:translate-y-[2px] disabled:opacity-40"
      style={{
        width: 64,
        background: paused ? dim : live,
        boxShadow: paused
          ? "inset 0 3px 6px rgba(0,0,0,0.55)"
          : "0 4px 0 #1d232b, 0 5px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
        border: "1.5px solid #1d232b",
      }}
      aria-label={paused ? "Resume" : "Pause"}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 22,
          background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
          borderRadius: 4,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25)",
        }}
      >
        {paused ? (
          <Play size={14} color="#e6e9ef" strokeWidth={2.2} fill="#e6e9ef" />
        ) : (
          <Pause size={14} color="#e6e9ef" strokeWidth={2.2} fill="#e6e9ef" />
        )}
      </div>
      <span className="font-digital text-[8px] tracking-[0.3em] text-text-muted mt-0.5">
        {paused ? "PLAY" : "MENU"}
      </span>
    </button>
  );
}
