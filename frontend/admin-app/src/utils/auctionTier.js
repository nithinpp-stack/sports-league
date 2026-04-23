// Mirrors the auto-bucketing rule in backend/src/controllers/auctionController.js
// (startAuction → playerSets). Kept in sync by convention — if the thresholds
// change in the controller, update them here too so the badge stays honest.
//   >= 100 → Marquee
//   50–99  → Capped
//   < 50   → Uncapped
export function getAuctionTier(basePoints) {
  const pts = Number(basePoints);
  if (!Number.isFinite(pts) || pts < 50) {
    return {
      name: 'Uncapped',
      badge: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  }
  if (pts < 100) {
    return {
      name: 'Capped',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  return {
    name: 'Marquee',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

// Short tier-threshold hint shown under the input.
export const AUCTION_TIER_HINT = '< 50 = Uncapped · 50–99 = Capped · 100+ = Marquee';
