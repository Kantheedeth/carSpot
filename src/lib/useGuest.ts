"use client";

import { useEffect, useState } from "react";

export function useGuest() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cookies = document.cookie || "";
    setIsGuest(cookies.includes("carspot_guest_ui=1"));
  }, []);

  return isGuest;
}
