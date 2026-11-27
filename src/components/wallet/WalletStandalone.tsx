"use client";
import { useState } from "react";
import type { ServiceStickerPass } from "@/adapters/contracts";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { LockScreenPush, WalletPassPreview } from "./WalletPass";

export function WalletStandalone(props: { pass: ServiceStickerPass; version: number; qr: string; updatedAt: string; vehicleId: string; workshopName: string; defaultMessage: string }) {
  const { call, pending, error } = useAction();
  const [push, setPush] = useState<string | null>(null);
  return (
    <div>
      <div className="relative min-h-[500px]">
        <WalletPassPreview pass={props.pass} version={props.version} qr={props.qr} updatedAt={props.updatedAt} />
        {push ? <LockScreenPush title={props.workshopName} message={push} onDone={() => setPush(null)} /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a className="btn btn-primary" href={`/api/wallet/${props.pass.serialNumber}?format=apple`} target="_blank" rel="noreferrer">
          <Icon name="wallet" size={18} /> Add to Apple Wallet
        </a>
        <a className="btn btn-secondary" href={`/api/wallet/${props.pass.serialNumber}?format=google`} target="_blank" rel="noreferrer">
          <Icon name="wallet" size={18} /> Add to Google Wallet
        </a>
      </div>
      <button
        type="button"
        className="btn btn-secondary mt-3 w-full"
        disabled={pending}
        onClick={async () => {
          if (await call("/api/wallet/push", { vehicleId: props.vehicleId, message: props.defaultMessage })) setPush(props.defaultMessage);
        }}
      >
        <Icon name="bolt" size={18} /> Simulate lock-screen service reminder push
      </button>
      <div className="mt-2">
        <ErrorBanner error={error} />
      </div>
    </div>
  );
}
