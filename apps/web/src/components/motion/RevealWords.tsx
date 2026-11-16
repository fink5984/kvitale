import { cn } from "@/lib/format";
import { InView } from "./InView";

/** A headline whose words rise into place. mode="load": CSS only, on first paint (hero). mode="scroll": when it enters the screen. */
export function RevealWords({ text, mode = "scroll", className }: { text: string; mode?: "load" | "scroll"; className?: string }) {
  const parts = text.split(/(\s+)/);
  let n = 0;
  const inner = parts.map((w, i) => (/^\s+$/.test(w) ? w : <span key={i} style={{ ["--w" as string]: n++ }}>{w}</span>));
  if (mode === "load") return <span className={cn("rw rw-load", className)}>{inner}</span>;
  return (
    <InView as="span" className={cn("rw rw-scroll", className)}>
      {inner}
    </InView>
  );
}
