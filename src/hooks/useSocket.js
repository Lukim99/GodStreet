import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SESSION_KEY = 'godstreet:session';

const loadSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore storage errors */
  }
};

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

    socket.on('connect', () => {
      setConnected(true);
      // 저장된 세션이 있으면 자동 재접속 시도
      const session = loadSession();
      if (session?.roomId && session?.token) {
        socket.emit('rejoinRoom', session.roomId, session.token, (res) => {
          if (res?.error) {
            saveSession(null);
          } else {
            setMyPlayerIndex(res.playerIndex);
            saveSession({ roomId: res.roomId, token: res.token });
          }
        });
      }
    });
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
      else {
        setMyPlayerIndex(res.playerIndex);
        saveSession({ roomId: res.roomId, token: res.token });
      }
    });
  }, []);

  const joinRoom = useCallback((roomId, playerName) => {
    setError(null);
    socketRef.current?.emit('joinRoom', roomId.toUpperCase(), playerName, (res) => {
      if (res.error) setError(res.error);
      else {
        setMyPlayerIndex(res.playerIndex);
        saveSession({ roomId: res.roomId, token: res.token });
      }
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
    saveSession(null);
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
