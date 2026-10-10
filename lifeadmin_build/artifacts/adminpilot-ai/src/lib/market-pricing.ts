// Indicative one-time market prices. Stripe checkout verifies the exact price.
export const MARKET_PRICES = {
  GBP: { label: "United Kingdom", price: "£1.99" },
  USD: { label: "United States", price: "$1.99" },
  EUR: { label: "Eurozone", price: "€1.99" },
  CAD: { label: "Canada", price: "C$2.99" },
  AUD: { label: "Australia", price: "A$3.99" },
  INR: { label: "India", price: "₹199" },
} as const;

export type MarketCurrency = keyof typeof MARKET_PRICES;
export type MarketSelection = MarketCurrency | "OTHER";

export function initialMarket(): MarketSelection {
  if (typeof navigator === "undefined") return "OTHER";
  const locale = navigator.language.replace("_", "-");
  const region = locale.split("-")[1]?.toUpperCase();
  if (region === "GB") return "GBP";
  if (region === "US") return "USD";
  if (region === "CA") return "CAD";
  if (region === "AU") return "AUD";
  if (region === "IN") return "INR";
  if (region && ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"].includes(region)) return "EUR";
  // Language is not reliable evidence of billing country.
  return "OTHER";
}
