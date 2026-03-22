import { useEffect, useState, useRef } from 'react';

export default function Lobby({ connected, roomInfo, error, myPlayerIndex, chatMessages, onCreateRoom, onJoinRoom, onStartGame, onToggleReady, onSendChatMessage, onLeaveRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState('main');
  const [chatMessage, setChatMessage] = useState('');
  const [maxRounds, setMaxRounds] = useState(10);
  const [startingCash, setStartingCash] = useState(10000);
  const [startingPrice, setStartingPrice] = useState(100);
  const [targetCash, setTargetCash] = useState(100000);
  const chatMessagesRef = useRef(null);
  const [playerBubbles, setPlayerBubbles] = useState({});


  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!chatMessages.length || !roomInfo) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    const playerIdx = roomInfo.players.findIndex(p => p.name === lastMsg.sender);
    if (playerIdx === -1) return;
    
    queueMicrotask(() => setPlayerBubbles(prev => ({ ...prev, [playerIdx]: lastMsg.text })));
    const timer = setTimeout(() => {
      setPlayerBubbles(prev => {
        const next = { ...prev };
        delete next[playerIdx];
        return next;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [chatMessages, roomInfo]);

  if (roomInfo) {
    const isHost = myPlayerIndex === 0;
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
                    {playerBubbles[i] && <div className="player-card__bubble">{playerBubbles[i]}</div>}
                  </div>
                );
              })}
              {Array.from({ length: 10 - roomInfo.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="player-card player-card--empty" />
              ))}
            </div>
            <div className="lobby-chat">
              <div className="lobby-chat__label">채팅</div>
              <div className="lobby-chat__messages" ref={chatMessagesRef}>
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
      </div>
    );
  }

  if (view === 'guide') {
    return (
      <div className="guide">
        <div className="guide__container">
          <div className="guide__header">
            <h1 className="guide__title">GOD STREET</h1>
            <p className="guide__tagline">게임 설명서</p>
          </div>

          <section className="guide__section">
            <p className="guide__intro">
              갓스트리트는 주식 시장을 배경으로 한 <strong>턴제 멀티플레이 카드 게임</strong>입니다.<br />
              카드를 사용해 주가를 조작하고, 주식을 매매하여 최종적으로 가장 많은 총 자산을 보유한 플레이어가 승리합니다.
            </p>
          </section>

          <section className="guide__section">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#9654;</span>
              게임 진행 방식
            </h2>
            <p className="guide__text">
              모든 플레이어는 순서대로 자신의 턴을 진행하며, 하나의 턴은 <strong>카드 사용 단계</strong>와 <strong>주식 매매 단계</strong>로 구성됩니다.
            </p>
          </section>

          <section className="guide__section">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#127183;</span>
              카드 종류
            </h2>
            <div className="guide__cards">
              <div className="guide__card-item guide__card-item--red">
                <div className="guide__card-label">행동 카드</div>
                <div className="guide__card-desc">주가를 조작하거나 타인을 방해하는 기본적인 카드입니다.</div>
              </div>
              <div className="guide__card-item guide__card-item--purple">
                <div className="guide__card-label">블랙스완 카드</div>
                <div className="guide__card-desc">주가를 크게 조작하거나 게임의 판도를 바꿀 수 있는 강력한 카드입니다.</div>
              </div>
              <div className="guide__card-item guide__card-item--green">
                <div className="guide__card-label">프리 카드</div>
                <div className="guide__card-desc">사용 후 행동 카드나 블랙스완 카드를 한 번 더 사용할 수 있습니다.</div>
              </div>
              <div className="guide__card-item guide__card-item--blue">
                <div className="guide__card-label">카운터 카드</div>
                <div className="guide__card-desc">상대의 행동 카드에 대응하여 효과를 무효화하거나 반격할 수 있습니다.</div>
              </div>
            </div>
          </section>

          <section className="guide__section">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#9878;</span>
              카드 사용 단계
            </h2>
            <div className="guide__steps">
              <div className="guide__step">
                <div className="guide__step-num">1</div>
                <div className="guide__step-body">
                  <strong>카드 선택</strong> — 카운터 카드를 제외한 보유 카드 중 하나를 사용하거나, 사용하지 않고 바로 매매 단계로 넘어갈 수 있습니다.
                </div>
              </div>
              <div className="guide__step">
                <div className="guide__step-num">2</div>
                <div className="guide__step-body">
                  <strong>카운터 턴</strong> — 행동 카드를 사용하면, 다음 순서부터 각 플레이어에게 카운터 기회가 주어집니다.
                </div>
              </div>
              <div className="guide__step">
                <div className="guide__step-num">3</div>
                <div className="guide__step-body">
                  <strong>카운터 해결</strong> — 카운터 카드를 사용하면 즉시 카운터 턴이 종료됩니다. 모두 넘기면 원래 카드 효과가 적용됩니다.
                </div>
              </div>
            </div>
          </section>

          <section className="guide__section">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#128200;</span>
              주식 매매 단계
            </h2>
            <p className="guide__text">
              카드 효과가 적용된 현재 주가를 기준으로 보유 현금으로 주식을 <strong>매수</strong>하거나, 가진 주식을 <strong>매도</strong>하여 차익을 실현합니다.
            </p>
          </section>

          <section className="guide__section">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#128260;</span>
              라운드 전환
            </h2>
            <p className="guide__text">
              마지막 플레이어까지 차례를 끝내면 라운드가 종료되고, 새로운 라운드가 시작됩니다.<br />
              새로운 라운드가 시작되면 <strong>-10%부터 +10%</strong>까지 랜덤으로 주가가 변동됩니다.<br />
              최종 라운드가 끝나면 <strong>-30%부터 +30%</strong>까지 랜덤으로 주가가 변동됩니다.
            </p>
          </section>

          <section className="guide__section guide__section--highlight">
            <h2 className="guide__section-title">
              <span className="guide__section-icon">&#127942;</span>
              자산 및 승리 조건
            </h2>
            <div className="guide__rules">
              <div className="guide__rule">
                <span>플레이어의 자산은 <strong>보유 현금 + 주식 평가금액</strong>의 합산으로 계산됩니다.</span>
              </div>
              <div className="guide__rule">
                <span>게임 진행 중 보유 현금이 <strong>마이너스</strong>가 되는 상황이 발생할 수 있습니다.</span>
              </div>
              <div className="guide__rule">
                <span>최종 라운드의 마지막 플레이어 턴 종료 후, <strong>총 자산이 가장 많은 플레이어</strong>가 1위가 됩니다.</span>
              </div>
              <div className="guide__rule">
                <span><strong>목표 금액</strong>을 현금으로 보유한 플레이어가 나타나면 즉시 게임이 종료됩니다.</span>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="guide__back-btn"
            onClick={() => setView('main')}
          >
            돌아가기
          </button>
        </div>
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
            <button
              type="button"
              className="lobby__btn lobby__btn--guide"
              onClick={() => setView('guide')}
            >
              게임 설명
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
