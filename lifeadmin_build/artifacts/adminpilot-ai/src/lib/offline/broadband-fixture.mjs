// Synthetic-only comparison boundary. Not imported by the app and has no network implementation.
import {recurringCost} from './bill-overview.mjs';
import {validDiaryDate} from './diary.mjs';
const fallback = reason => ({status:'manual',reason,offers:[]});
const poundsToPence = value => typeof value === 'string' && /^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value) ? Math.round(Number(value)*100) : null;
function syntheticSource(source) {
  if (!source || !validDiaryDate(source.checkedOn)) return null;
  try {
    const url=new URL(source.url);
    if (url.protocol!=='https:' || !url.hostname.endsWith('.example') || url.username || url.password || url.search || url.hash) return null;
    return {url:url.href,checkedOn:source.checkedOn};
  } catch { return null; }
}
export function broadbandFixtureQuery(requirements) {
  // No arbitrary strings, provider name, address, account identifier, free text or bill object.
  if (requirements?.country!=='United Kingdom' || ![36,67,100,150,300,500,900].includes(requirements?.speedMbps)) return null;
  return {service:'broadband',country:'United Kingdom',minimumSpeedMbps:requirements.speedMbps};
}
export function assessBroadbandFixture(bill,offer,requirements,now=new Date()) {
  const date=now.toISOString().slice(0,10), source=syntheticSource(offer?.source);
  if (!source || source.checkedOn>date || !validDiaryDate(offer?.activeFrom) || !validDiaryDate(offer?.activeUntil)) return null;
  if (offer.activeFrom>date || offer.activeUntil<date || offer.activeUntil<offer.activeFrom) return null;
  // Fresh retrieval is not evidence of an active window. Missing fee or price periods fail closed.
  if (!Array.isArray(offer.periods) || !offer.periods.length || offer.periods.length>12) return null;
  let months=0,total=0;
  for (const period of offer.periods) {
    const price=poundsToPence(period.monthly);
    if (price===null || !Number.isInteger(period.months) || period.months<1 || period.months>60) return null;
    months+=period.months; total+=price*period.months;
  }
  const fee=poundsToPence(offer.oneOffFee), current=recurringCost(bill);
  if (months!==24 || fee===null || offer.currency!=='GBP') return null;
  total+=fee;
  const eligibilitySource=syntheticSource(offer.eligibilityEvidence);
  const eligibilitySupported=offer.addressEligibility==='supported' && eligibilitySource && eligibilitySource.checkedOn<=date;
  const equivalent=offer.equivalenceConfirmed===true && offer.service==='broadband' && offer.speedMbps>=requirements.speedMbps && offer.featuresMatch===true && offer.feesComplete===true && offer.priceChangesComplete===true;
  const currentMonthly=poundsToPence(String(bill.details?.amount || ''));
  const comparable=equivalent && current?.currency==='GBP' && bill.details?.billing_frequency==='Monthly' && currentMonthly!==null;
  const currentTotal=comparable?currentMonthly*24:null;
  return {source,activeFrom:offer.activeFrom,activeUntil:offer.activeUntil,months,alternativeTotal:total/100,
    currentTotal:currentTotal===null?null:currentTotal/100, indicativeSaving:currentTotal===null?null:(currentTotal-total)/100,
    equivalence:equivalent?'customer-confirmed':'unverified',addressEligibility:eligibilitySupported?'separately-supported':'unverified',
    eligibilityEvidence:eligibilitySupported?eligibilitySource:null,synthetic:true,notice:'Fictional research fixture. No real offer, coverage or eligibility has been verified.'};
}
export async function compareBroadbandFixture(bill,requirements,fakeAdapter,now=new Date()) {
  const query=broadbandFixtureQuery(requirements);
  if (!query || typeof fakeAdapter!=='function') return fallback('missing-requirements');
  let response;
  try { response=await fakeAdapter(query); } catch { return fallback('adapter-unavailable'); }
  if (response?.status==='quota_exhausted') return fallback('quota-exhausted');
  if (response?.status!=='ok' || !Array.isArray(response.offers)) return fallback('adapter-unavailable');
  const offers=response.offers.slice(0,20).map(offer=>assessBroadbandFixture(bill,offer,requirements,now)).filter(Boolean);
  return offers.length?{status:'synthetic-results',offers}:fallback('no-active-evidenced-candidates');
}
