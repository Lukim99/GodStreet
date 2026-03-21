import { useEffect, useState } from 'react';

export default function Lobby({ connected, roomInfo, error, myPlayerIndex, chatMessages, onCreateRoom, onJoinRoom, onStartGame, onToggleReady, onSendChatMessage, onLeaveRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState('main');
  const [resultModalOpen, setResultModalOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [maxRounds, setMaxRounds] = useState(10);
  const [startingCash, setStartingCash] = useState(10000);
  const [startingPrice, setStartingPrice] = useState(100);
  const [targetCash, setTargetCash] = useState(100000);

  useEffect(() => {
    if (!roomInfo?.lastResult) return;
    const timer = setTimeout(() => setResultModalOpen(true), 0);
    return () => clearTimeout(timer);
  }, [roomInfo?.lastResult]);

  if (roomInfo) {
    const isHost = myPlayerIndex === 0;
    const shouldShowResultModal = !!roomInfo.lastResult && resultModalOpen;
    const me = roomInfo.players[myPlayerIndex];
    const allReady = roomInfo.players.slice(1).every((p) => p.ready);
    const canStart = isHost && roomInfo.players.length >= 2 && allReady;

    const handleCopyCode = () => {
      navigator.clipboard.writeText(roomInfo.roomId).then(() => {
        alert(`방 코드가 복사되었습니다!`);
      }).catch(() => {
        alert('복사에 실패했습니다.');
      });
    };

    const handleSendChat = () => {
      if (!chatMessage.trim()) return;
      onSendChatMessage(roomInfo.roomId, chatMessage);
      setChatMessage('');
    };

    return (
      <div className="lobby-room">
        <div className="lobby-room__header">
          <div className="lobby-room__header-left">
            <h1 className="lobby-room__title">GOD STREET</h1>
            <button type="button" className="lobby-room__btn" onClick={handleCopyCode}>코드 복사</button>
            {isHost ? (
              <button
                type="button"
                className="lobby-room__btn lobby-room__btn--start"
                disabled={!canStart}
                onClick={() => onStartGame(roomInfo.roomId, { maxRounds, startingCash, startingPrice, targetCash })}
              >
                게임 시작
              </button>
            ) : (
              <button
                type="button"
                className={`lobby-room__btn${me?.ready ? ' lobby-room__btn--ready' : ''}`}
                onClick={() => onToggleReady(roomInfo.roomId)}
              >
                {me?.ready ? '준비 취소' : '준비'}
              </button>
            )}
          </div>
          <button type="button" className="lobby-room__btn lobby-room__btn--leave" onClick={onLeaveRoom}>←</button>
        </div>
        <div className="lobby-room__body">
          <div className="lobby-room__left">
            <div className="player-grid">
              {roomInfo.players.map((p, i) => {
                const isMe = i === myPlayerIndex;
                const isHost = i === 0;
                let statusText = '대기';
                let statusClass = '';
                if (isHost) {
                  statusText = '방장';
                  statusClass = 'status-host';
                } else if (p.ready) {
                  statusText = '준비';
                  statusClass = 'status-ready';
                }
                return (
                  <div key={i} className={`player-card${isHost ? ' is-host' : ''}${p.ready ? ' is-ready' : ''}`}>
                    <div className="player-card__name">{p.name}</div>
                    <div className={`player-card__status ${statusClass}`}>{statusText}</div>
                    <img src="/symbols/lobby.png" alt="avatar" className="player-card__avatar" />
                    {isMe && <span className="player-card__diamond">♦</span>}
                  </div>
                );
              })}
              {Array.from({ length: 10 - roomInfo.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="player-card player-card--empty" />
              ))}
            </div>
            <div className="lobby-chat">
              <div className="lobby-chat__label">채팅</div>
              <div className="lobby-chat__messages">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="lobby-chat__msg">
                    {msg.sender}: {msg.text}
                  </div>
                ))}
              </div>
              <div className="lobby-chat__input-row">
                <input
                  type="text"
                  className="lobby-chat__input"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="메시지 입력..."
                />
                <button type="button" className="lobby-chat__send" onClick={handleSendChat}>↑</button>
              </div>
            </div>
          </div>
          <div className="lobby-room__right">
            <div className="game-settings">
              <div className="game-settings__title">게임 설정</div>
              <div className="game-settings__item">
                <label>최대 라운드</label>
                <input
                  type="number"
                  value={isHost ? maxRounds : (roomInfo.settings?.maxRounds ?? 10)}
                  disabled={!isHost}
                  onChange={(e) => setMaxRounds(Number(e.target.value) || 0)}
                  onBlur={(e) => setMaxRounds(Math.max(5, Math.min(100, Number(e.target.value) || 5)))}
                />
              </div>
              <div className="game-settings__item">
                <label>시작 현금</label>
                <input
                  type="number"
                  value={isHost ? startingCash : (roomInfo.settings?.startingCash ?? 10000)}
                  disabled={!isHost}
                  onChange={(e) => setStartingCash(Number(e.target.value) || 0)}
                  onBlur={(e) => setStartingCash(Math.max(1000, Math.min(1000000, Number(e.target.value) || 10000)))}
                />
              </div>
              <div className="game-settings__item">
                <label>시작 주가</label>
                <input
                  type="number"
                  value={isHost ? startingPrice : (roomInfo.settings?.startingPrice ?? 100)}
                  disabled={!isHost}
                  onChange={(e) => setStartingPrice(Number(e.target.value) || 0)}
                  onBlur={(e) => setStartingPrice(Math.max(10, Math.min(10000, Number(e.target.value) || 100)))}
                />
              </div>
              <div className="game-settings__item">
                <label>목표 현금</label>
                <input
                  type="number"
                  value={isHost ? targetCash : (roomInfo.settings?.targetCash ?? 100000)}
                  disabled={!isHost}
                  onChange={(e) => setTargetCash(Number(e.target.value) || 0)}
                  onBlur={(e) => setTargetCash(Math.max(10000, Math.min(10000000, Number(e.target.value) || 100000)))}
                />
              </div>
            </div>
          </div>
        </div>
        {shouldShowResultModal && (
          <div className="result-modal">
            <div className="result-modal__backdrop" onClick={() => setResultModalOpen(false)} />
            <div className="result-modal__dialog">
              <div className="result-panel">
                <div className="result-panel__header">
                  <div>
                    <div className="result-panel__title">경기 결과</div>
                    <div className="result-panel__reason">{/* roomInfo.lastResult.reason */}</div>
                  </div>
                  <button type="button" className="result-panel__close" onClick={() => setResultModalOpen(false)}>닫기</button>
                </div>
                <div className="result-panel__list">
                  {roomInfo.lastResult.rankings.map((entry, index) => (
                    <div key={entry.playerIndex} className={`result-row${entry.isWinner ? ' is-winner' : ''}`}>
                      <div className="result-row__rank">#{index + 1}</div>
                      <div className="result-row__main">
                        <div className="result-row__name">{entry.name}{entry.isWinner ? ' 👑' : ''}</div>
                        <div className="result-row__stats">
                          <span>총 자산 ${Math.round(entry.totalAssets).toLocaleString()}</span>
                          <span>주식 {entry.stocks}주</span>
                          <span>평가금액 ${Math.round(entry.marketValue).toLocaleString()}</span>
                          <span>평가손익 {entry.profitAmount >= 0 ? '+' : '-'}${Math.abs(Math.round(entry.profitAmount)).toLocaleString()}</span>
                          <span>현금 ${Math.round(entry.cash).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby__card">
        <h1 className="lobby__title">GOD STREET</h1>
        <p className="lobby__subtitle">Bull & Bear Brawl</p>
        {!connected && <p className="lobby__error">서버에 연결 중...</p>}
        {error && <p className="lobby__error">{error}</p>}

        {view === 'main' && (
          <div className="lobby__actions">
            <input
              className="lobby__input"
              placeholder="닉네임 입력"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={12}
            />
            <button
              type="button"
              className="lobby__btn lobby__btn--create"
              disabled={!connected || !playerName.trim()}
              onClick={() => { setView('main'); onCreateRoom(playerName.trim()); }}
            >
              방 만들기
            </button>
            <button
              type="button"
              className="lobby__btn lobby__btn--join"
              disabled={!connected || !playerName.trim()}
              onClick={() => setView('join')}
            >
              방 참가하기
            </button>
          </div>
        )}

        {view === 'join' && (
          <div className="lobby__actions">
            <input
              className="lobby__input"
              placeholder="방 코드 입력 (4자리)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <button
              type="button"
              className="lobby__btn lobby__btn--create"
              disabled={!connected || joinCode.length < 4}
              onClick={() => onJoinRoom(joinCode, playerName.trim())}
            >
              참가
            </button>
            <button
              type="button"
              className="lobby__btn lobby__btn--back"
              onClick={() => setView('main')}
            >
              뒤로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
