import type { VehicleCard, VehicleDetail } from "@/domain/garage";
import type { ServiceStickerPass } from "@/adapters/contracts";
import type { Workshop } from "@/db/schema";

export type PublicWorkshop = Pick<
  Workshop,
  | "name"
  | "phone"
  | "email"
  | "hoursText"
  | "brandPrimary"
  | "brandAccent"
  | "licenceState"
  | "licenceType"
  | "licenceNumber"
  | "addressLine"
  | "suburb"
  | "state"
  | "postcode"
  | "paytoEnabled"
  | "cardEnabled"
  | "bnplEnabled"
  | "bnplMinCents"
  | "smsSenderId"
  | "wms"
>;

export interface GarageData {
  workshop: PublicWorkshop;
  licence: string;
  householdName: string;
  people: { id: string; firstName: string; lastName: string; role: string }[];
  cards: VehicleCard[];
  detail: VehicleDetail;
  today: string;
  bookingDays: string[];
  pass: ServiceStickerPass | null;
  qr: string | null;
  passVersion: number;
  passUpdatedAt: string | null;
  lastPush: { at: string; message: string } | null;
  paidQuoteIds: string[];
}

export type SheetState =
  | { kind: "approve"; quoteId: string }
  | { kind: "refuse"; findingId: string }
  | { kind: "declineQuote"; quoteId: string }
  | { kind: "plan"; findingId: string }
  | { kind: "resolved"; findingId: string }
  | { kind: "book"; findingIds: string[] }
  | { kind: "mod" }
  | { kind: "checkout"; quoteId: string }
  | { kind: "wallet" }
  | null;
