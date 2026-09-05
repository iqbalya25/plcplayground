"use client";

import * as React from "react";

export type StatusState = "ok" | "warn" | "error" | "idle";

interface HeaderStatus {
  label: string;
  state: StatusState;
}

const DEFAULT_STATUS: HeaderStatus = { label: "—", state: "idle" };

const HeaderStatusContext = React.createContext<{
  status: HeaderStatus;
  setStatus: (s: HeaderStatus) => void;
}>({ status: DEFAULT_STATUS, setStatus: () => {} });

export function HeaderStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<HeaderStatus>(DEFAULT_STATUS);
  return (
    <HeaderStatusContext.Provider value={{ status, setStatus }}>
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

export function useHeaderStatus() {
  return React.useContext(HeaderStatusContext).status;
}
