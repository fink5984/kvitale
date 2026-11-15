"use client";

import { Eye, RotateCcw, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { adminApproveRefund, adminRequestRefund, adminResendConfirmation, adminResolveJob, adminRevealKvittel } from "@/app/actions/admin";
import { Button, Field, Modal, Notice, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? okText : (r.error ?? "error") });
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

export function OrderActions({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.orders.actions");
  const { pending, msg, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" loading={pending} onClick={() => run(() => adminResendConfirmation(orderId), t("resent"))}>
        {t("resend")}
      </Button>
      {msg && <span className={msg.ok ? "text-sm text-sage-600" : "text-sm text-oxblood-600"}>{msg.text}</span>}
    </div>
  );
}

export function ItemActions({ itemId, jobId, jobStatus, itemStatus, canManage, canRefund, canReveal }: { itemId: string; jobId: string | null; jobStatus: string | null; itemStatus: string; canManage: boolean; canRefund: boolean; canReveal: boolean }) {
  const t = useTranslations("admin.orders.actions");
  const tc = useTranslations("admin.common");
  const { pending, msg, run } = useAction();
  const [dialog, setDialog] = useState<null | "delivered" | "requeue" | "failed" | "refund" | "reveal">(null);
  const [reason, setReason] = useState("");
  const [images, setImages] = useState<string[] | null>(null);
  const resolvable = jobId && (jobStatus === "uncertain" || jobStatus === "failed");
  const refundable = canRefund && !["delivered", "refunded"].includes(itemStatus);

  const confirm = () => {
    if (!dialog) return;
    if (dialog === "reveal") {
      run(async () => {
        const r = await adminRevealKvittel(itemId, reason);
        if (r.ok) setImages(r.images);
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      }, t("revealed"));
    } else if (dialog === "refund") run(() => adminRequestRefund(itemId, reason), t("refundRequested"));
    else run(() => adminResolveJob(jobId!, dialog, reason), t("resolved"));
    setDialog(null);
    setReason("");
  };

  if (!resolvable && !refundable && !canReveal) return null;
  return (
    <div className="mt-5 border-t border-[var(--line)] pt-4">
      {jobStatus === "uncertain" && <Notice tone="warning" className="mb-3">{t("uncertainHelp")}</Notice>}
      <div className="flex flex-wrap gap-2">
        {resolvable && canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => setDialog("delivered")}>{t("markDelivered")}</Button>
            <Button size="sm" variant="outline" icon={<RotateCcw className="size-3.5" />} onClick={() => setDialog("requeue")}>{t("requeue")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog("failed")}>{t("markFailed")}</Button>
          </>
        )}
        {refundable && <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setDialog("refund")}>{t("refund")}</Button>}
        {canReveal && <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" />} onClick={() => setDialog("reveal")}>{t("reveal")}</Button>}
      </div>
      {msg && <p role="status" className={msg.ok ? "mt-2 text-sm text-sage-600" : "mt-2 text-sm text-oxblood-600"}>{msg.text}</p>}
      {images && (
        <div className="mt-4 flex flex-wrap gap-4 rounded-md bg-stone-100 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {images.map((src, i) => <img key={i} src={src} alt={t("revealAlt")} className="w-48 shadow-paper [image-rendering:pixelated]" />)}
          <Button size="sm" variant="ghost" onClick={() => setImages(null)}>{t("hide")}</Button>
        </div>
      )}
      <Modal open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} title={dialog ? t(`dialog.${dialog}`) : ""} description={dialog === "reveal" ? t("revealWarning") : t("dialogHint")} footer={<Button loading={pending} disabled={reason.trim().length < 4} onClick={confirm}>{t("confirm")}</Button>}>
        <Field label={tc("reason")} hint={tc("reasonHint")} htmlFor="reason">
          <Textarea id="reason" rows={3} className="min-h-0" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

export function RefundApprove({ refundId }: { refundId: string }) {
  const t = useTranslations("admin.orders.actions");
  const { pending, msg, run } = useAction();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="sm" loading={pending} onClick={() => run(() => adminApproveRefund(refundId), t("refundApproved"))}>{t("approve")}</Button>
      {msg && <span className={msg.ok ? "text-xs text-sage-600" : "text-xs text-oxblood-600"}>{msg.text}</span>}
    </span>
  );
}
