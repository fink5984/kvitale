"use client";

import { useEffect } from "react";
import { store } from "@/lib/store";

/** The basket (and the draft it came from) is only emptied once payment is confirmed by the server — never on a redirect. */
export function ClearCartWhenPaid({ paid }: { paid: boolean }) {
  useEffect(() => {
    if (paid) store.clearCart();
  }, [paid]);
  return null;
}
