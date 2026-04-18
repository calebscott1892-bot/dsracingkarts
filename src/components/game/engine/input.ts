export interface InputState {
  p1Accelerate: boolean;
  p1Brake: boolean;
  p2Accelerate: boolean;
  p2Brake: boolean;
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
    p2Accelerate: false,
    p2Brake: false,
  };

  function onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": state.p1Accelerate = true; e.preventDefault(); break;
      case "KeyS": state.p1Brake = true; e.preventDefault(); break;
      case "ArrowUp": state.p2Accelerate = true; e.preventDefault(); break;
      case "ArrowDown": state.p2Brake = true; e.preventDefault(); break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": state.p1Accelerate = false; break;
      case "KeyS": state.p1Brake = false; break;
      case "ArrowUp": state.p2Accelerate = false; break;
      case "ArrowDown": state.p2Brake = false; break;
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
      state.p2Accelerate = false;
      state.p2Brake = false;
    },
    /** Direct setter for touch controls */
    setTouch(accel: boolean, brake: boolean) {
      state.p1Accelerate = accel;
      state.p1Brake = brake;
    },
  };
}
