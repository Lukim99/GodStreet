import { useCallback } from 'react';
import './App.css';
import GameBoard from './components/GameBoard';
import Lobby from './components/Lobby';
import useSocket from './hooks/useSocket';

function App() {
  const {
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
  } = useSocket();

  const handleAction = useCallback(
    (actionName, ...args) => {
      if (roomInfo?.roomId) sendAction(roomInfo.roomId, actionName, ...args);
    },
    [roomInfo, sendAction],
  );

  if (!gameState || !roomInfo?.started) {
    return (
      <div className="app-shell">
        <Lobby
          connected={connected}
          roomInfo={roomInfo}
          error={error}
          myPlayerIndex={myPlayerIndex}
          chatMessages={chatMessages}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartGame={startGame}
          onToggleReady={toggleReady}
          onSendChatMessage={sendChatMessage}
          onLeaveRoom={leaveRoom}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <GameBoard game={gameState} myPlayerIndex={myPlayerIndex} onAction={handleAction} />
    </div>
  );
}

export default App;