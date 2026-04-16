import { setupLiveScoring } from './liveScoring.js';
import { setupAuction } from './auction.js';

export const setupSocketIO = (io) => {
  setupLiveScoring(io);
  setupAuction(io);
  console.log('Socket.IO namespaces registered');
};
