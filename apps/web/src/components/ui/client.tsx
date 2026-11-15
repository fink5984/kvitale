"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={rest.id ?? id} className={cn("group flex cursor-pointer items-start gap-3", className)}>
      <input id={rest.id ?? id} type="checkbox" className="peer mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-stone-400 bg-ivory-50 transition-colors checked:border-midnight-900 checked:bg-midnight-900 checked:bg-[url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='%23e0c385' stroke-width='2'/%3E%3C/svg%3E&quot;)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600" {...rest} />
      <span className="text-[0.92rem] leading-snug text-charcoal-800">
        {label}
        {description && <span className="mt-0.5 block text-[0.8rem] text-charcoal-500">{description}</span>}
      </span>
    </label>
  );
}

/** Segmented control — for small mutually exclusive choices (ben/bat, templates…) */

export function Modal({ open, onOpenChange, title, description, children, footer, closeLabel = "Close", wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; closeLabel?: string; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight-950/55 backdrop-blur-[3px] data-[state=open]:animate-[rise_.3s_ease-out]" />
        <Dialog.Content className={cn("fixed start-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--line)] bg-ivory-50 p-6 shadow-lift ltr:-translate-x-1/2 rtl:translate-x-1/2 sm:p-8", wide ? "max-w-3xl" : "max-w-lg")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl text-midnight-900">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1.5 text-sm text-charcoal-500">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-full text-charcoal-500 hover:bg-stone-100" aria-label={closeLabel}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


export function Drawer({ open, onOpenChange, title, children, side = "bottom", closeLabel = "Close" }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; children: ReactNode; side?: "bottom" | "end"; closeLabel?: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight-950/55 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-ivory-50 shadow-lift",
            side === "bottom" ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl data-[state=open]:animate-[rise_.35s_var(--ease-out-soft)]" : "inset-y-0 end-0 w-[min(28rem,100vw)]",
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            {side === "bottom" && <span className="absolute start-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-stone-300 rtl:translate-x-1/2" aria-hidden />}
            <Dialog.Title className="font-display text-xl">{title}</Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-stone-100" aria-label={closeLabel}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

