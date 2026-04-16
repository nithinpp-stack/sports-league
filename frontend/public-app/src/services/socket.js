import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const liveScoreSocket = io(`${SOCKET_URL}/live-scoring`, {
  autoConnect: false,
  transports: ['websocket'],
});

export const auctionSocket = io(`${SOCKET_URL}/auction`, {
  autoConnect: false,
  transports: ['websocket'],
});
