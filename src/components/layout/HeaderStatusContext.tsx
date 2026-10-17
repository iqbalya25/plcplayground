"use client";

import * as React from "react";

export type StatusState = "ok" | "warn" | "error" | "idle";

interface HeaderStatus {
  label: string;
  state: StatusState;
}

/** Camera button state published by a page (the wiring page). null = no button. */
interface CameraToggle {
  open: boolean;
  onToggle: () => void;
}

const DEFAULT_STATUS: HeaderStatus = { label: "—", state: "idle" };

const HeaderStatusContext = React.createContext<{
  status: HeaderStatus;
  setStatus: (s: HeaderStatus) => void;
  camera: CameraToggle | null;
  setCamera: (c: CameraToggle | null) => void;
}>({
  status: DEFAULT_STATUS,
  setStatus: () => {},
  camera: null,
  setCamera: () => {},
});

export function HeaderStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<HeaderStatus>(DEFAULT_STATUS);
  const [camera, setCamera] = React.useState<CameraToggle | null>(null);
  return (
    <HeaderStatusContext.Provider
      value={{ status, setStatus, camera, setCamera }}
    >
      {children}
    </HeaderStatusContext.Provider>
  );
}

/** Call from a page's shell component to publish its own status into the navbar. */
export function usePublishHeaderStatus(status: HeaderStatus) {
  const { setStatus } = React.useContext(HeaderStatusContext);
  React.useEffect(() => {
    setStatus(status);
    return () => setStatus(DEFAULT_STATUS);
  }, [status.label, status.state]);
}

/** Call from the wiring page to show the Camera button in the navbar. */
export function usePublishCameraToggle(open: boolean, onToggle: () => void) {
  const { setCamera } = React.useContext(HeaderStatusContext);
  React.useEffect(() => {
    setCamera({ open, onToggle });
    return () => setCamera(null);
  }, [open, onToggle, setCamera]);
}

export function useHeaderStatus() {
  return React.useContext(HeaderStatusContext).status;
}

export function useCameraToggle() {
  return React.useContext(HeaderStatusContext).camera;
}
