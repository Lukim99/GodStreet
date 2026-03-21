import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(-1);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const url = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const socket = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('roomUpdate', (info) => {
      setRoomInfo(info);
      if (!info.started && gameState) setGameState(null);
      if (info.chatMessages) setChatMessages(info.chatMessages);
    });

    socket.on('chatMessage', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });
    socket.on('gameState', (state) => {
      setMyPlayerIndex(state.myPlayerIndex);
      setGameState(state);
    });
    socket.on('playerIndexUpdate', (newIndex) => {
      setMyPlayerIndex(newIndex);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((playerName) => {
    setError(null);
    socketRef.current?.emit('createRoom', playerName, (res) => {
      if (res.error) setError(res.error);
      else setMyPlayerIndex(res.playerIndex);
    });
  }, []);

  const joinRoom = useCallback((roomId, playerName) => {
    setError(null);
    socketRef.current?.emit('joinRoom', roomId.toUpperCase(), playerName, (res) => {
      if (res.error) setError(res.error);
      else setMyPlayerIndex(res.playerIndex);
    });
  }, []);

  const startGame = useCallback((roomId, options = {}) => {
    socketRef.current?.emit('startGame', roomId, options);
  }, []);

  const sendAction = useCallback((roomId, actionName, ...args) => {
    socketRef.current?.emit('gameAction', roomId, actionName, ...args);
  }, []);

  const toggleReady = useCallback((roomId) => {
    socketRef.current?.emit('toggleReady', roomId);
  }, []);

  const sendChatMessage = useCallback((roomId, message) => {
    socketRef.current?.emit('sendChatMessage', roomId, message);
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current?.connect();
    setRoomInfo(null);
    setGameState(null);
    setMyPlayerIndex(-1);
    setChatMessages([]);
    setError('');
  }, []);

  return {
    connected,
    roomInfo,
    gameState,
    myPlayerIndex,
    error,
    chatMessages,
    createRoom,
    joinRoom,
    startGame,
    sendAction,
    toggleReady,
    sendChatMessage,
    leaveRoom,
  };
}
