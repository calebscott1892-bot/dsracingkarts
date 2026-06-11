"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

interface Props {
  paused: boolean;
  canPause: boolean;
  onPauseToggle: () => void;
}

type ButtonKind = "gas" | "brake" | "left" | "right";

const KEY_FOR_KIND: Record<ButtonKind, string> = {
  gas: "KeyW",
  brake: "KeyS",
  left: "KeyA",
  right: "KeyD",
};

/**
 * Mobile-first arcade controller bar that sits BELOW the game canvas.
 * Shape: [ ◀ ][ ▶ ][ PAUSE ][ BRAKE ][ GO ] — steering under the left thumb,
 * pedals under the right, styled like a chunky 2000s-era handheld controller.
 *
 * Buttons fire synthetic keyboard events (W/S gas-brake, A/D steer) so they
 * tap into the same input pipeline as desktop keyboard play.
 */
export function ArcadeControls({ paused, canPause, onPauseToggle }: Props) {
  const [down, setDown] = useState<Record<ButtonKind, boolean>>({
    gas: false,
    brake: false,
    left: false,
    right: false,
  });

  // Release every key unconditionally (a spurious keyup is harmless). Used
  // wherever a held button could otherwise latch its key: lifting off-screen,
  // tab blur, pausing (disabled buttons swallow the touchend), and unmount
  // (race end while a button is held).
  function releaseAllKeys() {
    for (const code of Object.values(KEY_FOR_KIND)) {
      window.dispatchEvent(new KeyboardEvent("keyup", { code }));
    }
    setDown({ gas: false, brake: false, left: false, right: false });
  }

  useEffect(() => {
    const release = () => releaseAllKeys();
    window.addEventListener("touchcancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("touchcancel", release);
      window.removeEventListener("blur", release);
      release(); // unmount with a button held → don't leave the key latched
    };
     
  }, []);

  // Pausing disables the buttons, which suppresses their release events —
  // proactively let go of everything when the pause overlay comes up.
  useEffect(() => {
    if (paused) releaseAllKeys();
     
  }, [paused]);

  function press(kind: ButtonKind) {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (paused) return;
      setDown((prev) => ({ ...prev, [kind]: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { code: KEY_FOR_KIND[kind] }));
    };
  }
  function release(kind: ButtonKind) {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      setDown((prev) => ({ ...prev, [kind]: false }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: KEY_FOR_KIND[kind] }));
    };
  }

  return (
    <div
      className="md:hidden w-full bg-black select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Faux-controller frame */}
      <div className="relative bg-gradient-to-b from-[#1c1f24] via-[#13161a] to-[#0a0c0f] border-t-2 border-surface-700 px-2 py-2.5">
        {/* The five-button rectangle */}
        <div className="flex items-stretch gap-1.5 h-[78px]">
          {/* STEER ◀ ▶ — graphite pair, left thumb */}
          <ControllerButton
            kind="left"
            pressed={down.left && !paused}
            disabled={paused}
            onPress={press("left")}
            onRelease={release("left")}
          />
          <ControllerButton
            kind="right"
            pressed={down.right && !paused}
            disabled={paused}
            onPress={press("right")}
            onRelease={release("right")}
          />

          {/* PAUSE — small square, center */}
          <PauseButton paused={paused} disabled={!canPause} onPress={onPauseToggle} />

          {/* BRAKE + GO — pedals, right thumb */}
          <ControllerButton
            kind="brake"
            pressed={down.brake && !paused}
            disabled={paused}
            onPress={press("brake")}
            onRelease={release("brake")}
          />
          <ControllerButton
            kind="gas"
            pressed={down.gas && !paused}
            disabled={paused}
            onPress={press("gas")}
            onRelease={release("gas")}
          />
        </div>
      </div>
    </div>
  );
}

// ── Action buttons ─────────────────────────────────────────────────────────
const BUTTON_STYLE: Record<ButtonKind, { live: string; dim: string; accent: string; label: string }> = {
  gas: { live: "#dc2433", dim: "#7a1219", accent: "#ffe4b5", label: "GO" },
  brake: { live: "#1f5dd6", dim: "#11357a", accent: "#bcd6ff", label: "BRAKE" },
  left: { live: "#3a424d", dim: "#1c2127", accent: "#e6e9ef", label: "LEFT" },
  right: { live: "#3a424d", dim: "#1c2127", accent: "#e6e9ef", label: "RIGHT" },
};

function ControllerButton({
  kind,
  pressed,
  disabled,
  onPress,
  onRelease,
}: {
  kind: ButtonKind;
  pressed: boolean;
  disabled: boolean;
  onPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onRelease: (e: React.TouchEvent | React.MouseEvent) => void;
}) {
  const { live, dim, accent, label } = BUTTON_STYLE[kind];
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
      <Glyph kind={kind} pressed={pressed} accent={accent} />
      <span
        className="font-digital text-[9px] tracking-[0.3em] mt-0.5"
        style={{ color: pressed ? "rgba(255,255,255,0.7)" : "#fff" }}
      >
        {label}
      </span>
    </button>
  );
}

function Glyph({ kind, pressed, accent }: { kind: ButtonKind; pressed: boolean; accent: string }) {
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
        {kind === "gas" && (
          <polygon points="11,1 21,11 16,11 16,13 6,13 6,11 1,11" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        )}
        {kind === "brake" && (
          <polygon points="11,13 21,3 16,3 16,1 6,1 6,3 1,3" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        )}
        {kind === "left" && (
          <polygon points="1,7 11,1 11,4.5 21,4.5 21,9.5 11,9.5 11,13" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        )}
        {kind === "right" && (
          <polygon points="21,7 11,1 11,4.5 1,4.5 1,9.5 11,9.5 11,13" fill={accent} stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
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
      className="relative flex flex-col items-center justify-center rounded-md transition-transform duration-75 active:translate-y-[2px] disabled:opacity-40 shrink-0"
      style={{
        width: 52,
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
