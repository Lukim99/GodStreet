import { createServer } from 'http';
import { Server } from 'socket.io';
import { createInitialGameState, actions, finalizeGameState, sanitizeStateForPlayer, handlePlayerDisconnect } from '../src/game/engine.js';

/* global process */
const PORT = process.env.PORT || 8080;
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const rooms = new Map();

const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const getRoomInfo = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    players: room.players.map((p) => ({ name: p.name, connected: p.connected, ready: p.ready || false })),
    started: room.started,
    maxPlayers: 10,
    settings: room.settings,
    lastResult: room.lastResult || null,
    chatMessages: room.chatMessages || [],
  };
};

const broadcastRoomUpdate = (roomId) => {
  const info = getRoomInfo(roomId);
  if (info) io.to(roomId).emit('roomUpdate', info);
};

const broadcastGameState = (roomId) => {
  const room = rooms.get(roomId);
  if (!room || !room.gameState) return;
  room.players.forEach((player, index) => {
    if (!player.socketId) return;
    const sanitized = sanitizeStateForPlayer(room.gameState, index);
    io.to(player.socketId).emit('gameState', { ...sanitized, myPlayerIndex: index });
  });
};

const canPlayerAct = (room, playerIndex) => {
  const gs = room.gameState;
  if (!gs) return false;
  if (gs.finalVolatilityPending) return false;
  if (gs.turnPhase === 'COUNTER') return playerIndex === gs.counterPlayerIndex;
  return playerIndex === gs.currentPlayerIndex;
};

const clearPendingEndTimeout = (room) => {
  if (!room?.pendingEndTimeout) return;
  clearTimeout(room.pendingEndTimeout);
  room.pendingEndTimeout = null;
};

const scheduleDelayedLobbyReturn = (roomId) => {
  const room = rooms.get(roomId);
  if (!room || !room.gameState?.finalVolatilityPending || !room.gameState?.result) return;
  clearPendingEndTimeout(room);
  room.pendingEndTimeout = setTimeout(() => {
    const latestRoom = rooms.get(roomId);
    if (!latestRoom || !latestRoom.gameState?.result) return;
    latestRoom.lastResult = latestRoom.gameState.result;
    latestRoom.gameState = null;
    latestRoom.started = false;
    latestRoom.pendingEndTimeout = null;
    broadcastRoomUpdate(roomId);
  }, 5000);
};

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('createRoom', (playerName, callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      players: [{ socketId: socket.id, name: playerName || 'Player1', connected: true, ready: false }],
      gameState: null,
      started: false,
      settings: { maxRounds: 10, startingCash: 10000, startingPrice: 100, targetCash: 100000 },
      lastResult: null,
      pendingEndTimeout: null,
      chatMessages: [],
    });
    socket.join(roomId);
    currentRoomId = roomId;
    callback({ roomId, playerIndex: 0 });
    broadcastRoomUpdate(roomId);
  });

  socket.on('joinRoom', (roomId, playerName, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback({ error: '존재하지 않는 방입니다.' });
    if (room.started) return callback({ error: '이미 시작된 게임입니다.' });
    if (room.players.length >= 10) return callback({ error: '방이 가득 찼습니다.' });

    const idx = room.players.length;
    room.players.push({ socketId: socket.id, name: playerName || `Player${idx + 1}`, connected: true, ready: false });
    socket.join(roomId);
    currentRoomId = roomId;
    callback({ roomId, playerIndex: idx });
    broadcastRoomUpdate(roomId);
  });

  socket.on('startGame', (roomId, options = {}) => {
    const room = rooms.get(roomId);
    if (!room || room.started || room.players.length < 2) return;
    clearPendingEndTimeout(room);
    room.settings = {
      maxRounds: Math.max(5, Math.min(100, Math.floor(Number(options.maxRounds) || room.settings?.maxRounds || 10))),
      startingCash: Math.max(1000, Math.min(1000000, Math.floor(Number(options.startingCash) || room.settings?.startingCash || 10000))),
      startingPrice: Math.max(10, Math.min(10000, Math.floor(Number(options.startingPrice) || room.settings?.startingPrice || 100))),
      targetCash: Math.max(10000, Math.min(10000000, Math.floor(Number(options.targetCash) || room.settings?.targetCash || 100000))),
    };
    room.players.forEach((p) => { p.ready = false; });
    const names = room.players.map((p) => p.name);
    room.gameState = createInitialGameState(room.players.length, names, room.settings);
    room.started = true;
    room.lastResult = null;
    broadcastRoomUpdate(roomId);
    broadcastGameState(roomId);
  });

  socket.on('gameAction', (roomId, actionName, ...args) => {
    const room = rooms.get(roomId);
    if (!room || !room.started || !room.gameState) return;
    const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1) return;

    const allowedAnytime = ['selectTarget', 'selectCardDetail', 'setMomentumSelection', 'confirmMomentumCounter', 'cancelMomentumCounter'];
    if (!allowedAnytime.includes(actionName) && !canPlayerAct(room, playerIndex)) return;

    const action = actions[actionName];
    if (!action) return;

    room.gameState = finalizeGameState(action(room.gameState, ...args));

    if (room.gameState?.finalVolatilityPending && room.gameState?.result) {
      broadcastGameState(roomId);
      scheduleDelayedLobbyReturn(roomId);
      return;
    }

    if (room.gameState?.gameOver) {
      clearPendingEndTimeout(room);
      room.lastResult = room.gameState.result;
      room.gameState = null;
      room.started = false;
      broadcastRoomUpdate(roomId);
      return;
    }

    broadcastGameState(roomId);
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const roomId = currentRoomId;

    const idx = room.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) return;

    if (room.started && room.gameState) {
      room.gameState = handlePlayerDisconnect(room.gameState, idx);

      if (room.gameState?.finalVolatilityPending && room.gameState?.result) {
        broadcastGameState(roomId);
        scheduleDelayedLobbyReturn(roomId);
      } else if (room.gameState?.gameOver) {
        clearPendingEndTimeout(room);
        room.lastResult = room.gameState.result;
        room.gameState = null;
        room.started = false;
      } else {
        broadcastGameState(roomId);
      }
    }

    if (!room.started) {
      room.players.splice(idx, 1);
      const anyConnected = room.players.some((p) => p.connected);
      if (!anyConnected || room.players.length === 0) {
        clearPendingEndTimeout(room);
        rooms.delete(roomId);
      } else {
        room.players.forEach((p, newIdx) => {
          if (p.socketId) {
            io.to(p.socketId).emit('playerIndexUpdate', newIdx);
          }
        });
        broadcastRoomUpdate(roomId);
      }
    } else {
      room.players[idx].connected = false;
      room.players[idx].socketId = null;
      const anyConnected = room.players.some((p) => p.connected);
      if (!anyConnected) {
        clearPendingEndTimeout(room);
        rooms.delete(roomId);
      } else {
        broadcastRoomUpdate(roomId);
      }
    }
  });

  socket.on('toggleReady', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.started) return;
    const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1 || playerIndex === 0) return;
    room.players[playerIndex].ready = !room.players[playerIndex].ready;
    broadcastRoomUpdate(roomId);
  });

  socket.on('sendChatMessage', (roomId, message) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    const chatMsg = {
      sender: player.name,
      text: message,
      timestamp: Date.now(),
    };
    room.chatMessages.push(chatMsg);
    io.to(roomId).emit('chatMessage', chatMsg);
  });

  socket.on('rejoinRoom', (roomId, playerIndex, callback) => {
    const room = rooms.get(roomId);
    if (!room || playerIndex < 0 || playerIndex >= room.players.length) {
      return callback({ error: '재접속 실패' });
    }
    room.players[playerIndex].socketId = socket.id;
    room.players[playerIndex].connected = true;
    socket.join(roomId);
    currentRoomId = roomId;
    callback({ roomId, playerIndex });
    broadcastRoomUpdate(roomId);
    if (room.started) broadcastGameState(roomId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`God Street server running on http://localhost:${PORT}`);
});
