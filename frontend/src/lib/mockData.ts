export interface Property {
  id: string;
  title?: string;
  apartmentName?: string;
  totalFlatsAvailable?: number;
  sourcePlatform?: string;
  sourceUrl?: string;
  address: string;
  locality: string;
  city: string;
  price: number;
  priceType: "rent" | "buy";
  size: number;
  bhk: string;
  floor: string;
  bathrooms?: number;
  balconies?: number;
  furnishing: string;
  amenities: string[];
  matchScore: number;
  legalStatus: "clean" | "caution" | "high_risk";
  photoRedFlags: string[];
  aiInsight: string;
  aiDetailOverview?: string;
  aiLocationInsights?: string;
  aiInvestmentOutlook?: string;
  aiNegotiationTips?: string;
  aiHighlights?: string[];
  aiWatchouts?: string[];
  daysListed: number;
  images: string[];
}

export interface Negotiation {
  id: string;
  propertyId: string;
  propertyAddress: string;
  listedPrice: number;
  currentOffer: number;
  status: "active" | "paused" | "waiting_for_broker" | "closed_won" | "closed_lost";
  tone: "aggressive" | "balanced" | "polite";
  messages: { role: "agent" | "broker"; content: string; timestamp: string }[];
  fairValueMin: number;
  fairValueMax: number;
  turnCount: number;
}

export interface LegalReport {
  id: string;
  propertyId: string;
  rera: { status: string; number: string; complaints: number };
  encumbrance: { status: string; details: string };
  propertyTax: { status: string; details: string };
  builderTrackRecord: { status: string; details: string };
  overallRisk: "clean" | "caution" | "high_risk";
  summary: string;
}

export interface Document {
  id: string;
  propertyId?: string;
  type: "rent_agreement" | "sale_deed" | "legal_report" | "receipt" | "photo";
  filename: string;
  date: string;
  aiSummary: string;
  category: "Agreements" | "Legal Reports" | "Receipts" | "Property Photos" | "Negotiation Transcripts";
}

export interface ActivityItem {
  id: string;
  type: "match" | "negotiation" | "legal" | "document" | "alert" | "system";
  text: string;
  propertyName?: string;
  timestamp: string;
  actionLabel?: string;
  actionHref?: string;
}
