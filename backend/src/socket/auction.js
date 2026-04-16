export const setupAuction = (io) => {
  const auction = io.of('/auction');

  auction.on('connection', (socket) => {
    console.log(`[auction] Socket connected: ${socket.id}`);

    socket.on('join-auction', (tournamentId) => {
      const room = `auction:${tournamentId}`;
      socket.join(room);
      console.log(`[auction] Socket ${socket.id} joined room ${room}`);
    });

    socket.on('leave-auction', (tournamentId) => {
      const room = `auction:${tournamentId}`;
      socket.leave(room);
      console.log(`[auction] Socket ${socket.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[auction] Socket disconnected: ${socket.id}`);
    });
  });
};
