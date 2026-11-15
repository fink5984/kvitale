"use client";

import { useSyncExternalStore } from "react";
import type { CartEntry, KvittelContentInput } from "./kvittel-schema";

/**
 * Guest draft & cart. Privacy default: sessionStorage (cleared when the tab
 * closes). Survives page navigation and language switches within the tab.
 * "Remember on this device" moves it to localStorage with a 7-day expiry.
 */
export interface DraftState {
  graveSlugs: string[];
  content: KvittelContentInput;
  editingEntryId: string | null;
}

interface State {
  v: 1;
  draft: DraftState | null;
  cart: CartEntry[];
  remember: boolean;
  savedAt: number;
}

const KEY = "kv_state_v1";
const TTL_MS = 7 * 86400000;
const empty: State = { v: 1, draft: null, cart: [], remember: false, savedAt: 0 };

let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed.v === 1 && (!parsed.remember || Date.now() - parsed.savedAt < TTL_MS)) state = parsed;
      else localStorage.removeItem(KEY);
    }
  } catch {
    state = empty;
  }
}

function persist() {
  try {
    state = { ...state, savedAt: Date.now() };
    const raw = JSON.stringify(state);
    sessionStorage.setItem(KEY, raw);
    if (state.remember) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode) — keep in memory */
  }
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

export const store = {
  get: () => {
    load();
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setDraft(draft: DraftState | null) {
    set({ draft });
  },
  addToCart(entry: CartEntry) {
    const others = state.cart.filter((e) => e.id !== entry.id);
    set({ cart: [...others, entry], draft: null });
  },
  removeFromCart(id: string) {
    set({ cart: state.cart.filter((e) => e.id !== id) });
  },
  clearCart() {
    set({ cart: [], draft: null });
  },
  setRemember(remember: boolean) {
    set({ remember });
  },
  /** Explicit "erase everything I typed on this device" */
  wipe() {
    state = empty;
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    } catch {}
    listeners.forEach((l) => l());
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(empty),
  );
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyContent(nusach: KvittelContentInput["nusach"], graveDisplayName = ""): KvittelContentInput {
  return {
    template: "simple",
    nusach,
    graveDisplayName,
    people: [{ id: newId(), mode: "free", given: "", relation: "none", freeText: "" }],
    topics: [],
    request: "",
    signature: "",
    showBH: false,
  };
}

/** True when the person has typed anything worth keeping. */
export function hasText(c: KvittelContentInput): boolean {
  return c.request.trim().length > 0 || c.people.some((p) => (p.freeText ?? p.given ?? "").trim().length > 0) || !!c.handwritingRef;
}
