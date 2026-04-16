import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import env from './src/config/env.js';
import { setupSocketIO } from './src/socket/index.js';

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.corsOrigins,
    credentials: true,
  },
});

app.set('io', io);

setupSocketIO(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const start = async () => {
  await connectDB();
  httpServer.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });
};

start();

