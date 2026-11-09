"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { Copy, ExternalLink } from "lucide-react";
import { buildUpiPaymentUri, isValidUpiId } from "@/lib/upi-payment";

export default function UpiPaymentQr({
  upiId,
  payeeName,
  amount,
  orderNumber,
  compact = false,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  orderNumber: string | number;
  compact?: boolean;
}) {
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  const uri = useMemo(() => {
    if (!isValidUpiId(upiId) || amount <= 0) return "";
    return buildUpiPaymentUri({ upiId, payeeName, amount, orderNumber });
  }, [amount, orderNumber, payeeName, upiId]);

  useEffect(() => {
    let active = true;
    if (!uri) { setSrc(""); return; }
    void QRCode.toDataURL(uri, { width: compact ? 220 : 320, margin: 2, errorCorrectionLevel: "M" })
      .then((value) => { if (active) setSrc(value); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [compact, uri]);

  if (!uri) return null;
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-center text-neutral-900">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Scan and pay via UPI</p>
      <p className="mt-1 text-xl font-black tabular-nums">₹{amount.toFixed(2)}</p>
      <p className="text-xs text-neutral-500">Order #{orderNumber} · {payeeName}</p>
      {src ? <Image src={src} alt={`UPI payment QR for order ${orderNumber}`} width={compact ? 176 : 224} height={compact ? 176 : 224} unoptimized className="mx-auto mt-3 max-w-full" /> : <div className="mx-auto mt-3 h-44 w-44 animate-pulse rounded-xl bg-neutral-100" />}
      <p className="mt-2 break-all font-mono text-xs text-neutral-600">{upiId}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a href={uri} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3 text-xs font-bold text-white">
          <ExternalLink className="h-3.5 w-3.5" /> Open UPI app
        </a>
        <button type="button" onClick={() => void navigator.clipboard.writeText(upiId).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold">
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy UPI ID"}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-amber-700">Payment is marked paid only after restaurant staff verifies it.</p>
    </section>
  );
}
