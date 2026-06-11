export interface InputState {
  p1Accelerate: boolean;
  p1Brake: boolean;
  p1Left: boolean;
  p1Right: boolean;
  p2Accelerate: boolean;
  p2Brake: boolean;
  p2Left: boolean;
  p2Right: boolean;
}

export function createInputHandler(): {
  state: InputState;
  attach: () => void;
  detach: () => void;
  setTouch: (accel: boolean, brake: boolean) => void;
} {
  const state: InputState = {
    p1Accelerate: false,
    p1Brake: false,
    p1Left: false,
    p1Right: false,
    p2Accelerate: false,
    p2Brake: false,
    p2Left: false,
    p2Right: false,
  };

  function onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": state.p1Accelerate = true; e.preventDefault(); break;
      case "KeyS": state.p1Brake = true; e.preventDefault(); break;
      case "KeyA": state.p1Left = true; e.preventDefault(); break;
      case "KeyD": state.p1Right = true; e.preventDefault(); break;
      case "ArrowUp": state.p2Accelerate = true; e.preventDefault(); break;
      case "ArrowDown": state.p2Brake = true; e.preventDefault(); break;
      case "ArrowLeft": state.p2Left = true; e.preventDefault(); break;
      case "ArrowRight": state.p2Right = true; e.preventDefault(); break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": state.p1Accelerate = false; break;
      case "KeyS": state.p1Brake = false; break;
      case "KeyA": state.p1Left = false; break;
      case "KeyD": state.p1Right = false; break;
      case "ArrowUp": state.p2Accelerate = false; break;
      case "ArrowDown": state.p2Brake = false; break;
      case "ArrowLeft": state.p2Left = false; break;
      case "ArrowRight": state.p2Right = false; break;
    }
  }

  return {
    state,
    attach() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      state.p1Accelerate = false;
      state.p1Brake = false;
      state.p1Left = false;
      state.p1Right = false;
      state.p2Accelerate = false;
      state.p2Brake = false;
      state.p2Left = false;
      state.p2Right = false;
    },
    /** Direct setter for touch controls */
    setTouch(accel: boolean, brake: boolean) {
      state.p1Accelerate = accel;
      state.p1Brake = brake;
    },
  };
}
