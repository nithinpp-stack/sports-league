export const setupLiveScoring = (io) => {
  const liveScoring = io.of('/live-scoring');

  liveScoring.on('connection', (socket) => {
    console.log(`[live-scoring] Socket connected: ${socket.id}`);

    socket.on('join-match', (matchId) => {
      const room = `match:${matchId}`;
      socket.join(room);
      console.log(`[live-scoring] Socket ${socket.id} joined room ${room}`);
    });

    socket.on('leave-match', (matchId) => {
      const room = `match:${matchId}`;
      socket.leave(room);
      console.log(`[live-scoring] Socket ${socket.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[live-scoring] Socket disconnected: ${socket.id}`);
    });
  });
};
