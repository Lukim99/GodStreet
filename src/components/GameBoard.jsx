import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { CARD_MAP } from '../game/cardLibrary';
import { getPlayerMetrics, formatSignedCurrency, formatSignedPercent } from '../game/engine';
import { CARD_TYPES, COUNTER_CARD_EFFECTS, TURN_PHASES } from '../game/constants';
import { playSound, playSoundForPriceChange, playStartSound, startBgm, stopBgm } from '../utils/sound';

const MAX_HAND = 8;
const PHASE_LABEL = { CARD: '카드 턴', COUNTER: '카운터 턴', TRADE: '매매 턴' };
const CARD_TYPE_SYMBOLS = {
  [CARD_TYPES.ATTACK]: '/symbols/act.png',
  [CARD_TYPES.COUNTER]: '/symbols/counter.png',
  [CARD_TYPES.FREE]: '/symbols/pre.png',
  [CARD_TYPES.BLACK_SWAN]: '/symbols/blackswan.png',
};
const btn = (v, on = true) => `gb-btn gb-btn--${v}${on ? '' : ' is-off'}`;

function StockChart({ history }) {
  if (!history || history.length < 2) return <div className="chart-placeholder">차트 데이터 없음</div>;
  const candles = [];
  for (let i = 1; i < history.length; i++) {
    const open = history[i - 1];
    const close = history[i];
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    candles.push({ open, close, high, low });
  }
  const allPrices = history;
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;
  const w = 100 / candles.length;
  const toY = (p) => 90 - ((p - min) / range) * 80;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
      {candles.map((c, i) => {
        const x = i * w + w / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? '#4ade80' : '#f87171';
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBottom = toY(Math.min(c.open, c.close));
        const wickTop = toY(c.high);
        const wickBottom = toY(c.low);
        return (
          <g key={i}>
            <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            <rect x={x - w * 0.3} y={bodyTop} width={w * 0.6} height={Math.max(0.5, bodyBottom - bodyTop)} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

function PlayerSidebar({ players, price, currentIdx, myIdx, canTarget, onSelectTarget, playerAnimations, isTargeting }) {
  return (
    <aside className="sidebar">
      {players.map((p, i) => {
        const m = getPlayerMetrics(p, price);
        const isCurrent = i === currentIdx;
        const isMe = i === myIdx;
        const profitAmt = m.profitAmount;
        const profitPct = m.profitPercent;
        const clickable = canTarget && !isMe;
        const isTargetable = isTargeting && !isMe;
        const animation = playerAnimations[p.id] || null;
        return (
          <div
            key={p.id}
            className={`sb-card${isCurrent ? ' is-turn' : ''}${isMe ? ' is-me' : ''}${clickable ? ' is-clickable' : ''}${isTargetable ? ' is-targeting' : ''}`}
            onClick={() => clickable && onSelectTarget(p.id)}
          >
            <div className="sb-card__head">
              <span className="sb-card__name">{p.name}{isMe ? ' ◆' : ''}</span>
              <span className={`sb-card__cash${animation?.cashDelta ? ` ${animation.cashDelta > 0 ? 'is-up' : 'is-down'}` : ''}`}>${Math.round(p.cash).toLocaleString()}</span>
            </div>
            <div className="sb-card__body">
              <span className={`sb-card__stocks${animation?.stockDelta ? ` ${animation.stockDelta > 0 ? 'is-up' : 'is-down'}` : ''}`}>보유 주식 {p.stocks}주</span>
              <span>평가금액 ${m.marketValue.toLocaleString()}</span>
              <span className={profitAmt >= 0 ? 'clr-up' : 'clr-down'}>
                {formatSignedCurrency(profitAmt)} ({formatSignedPercent(profitPct)})
              </span>
              <span>총 자산 ${m.totalAssets.toLocaleString()}</span>
            </div>
            {animation?.cashDelta ? (
              <span className={`sb-float sb-float--cash ${animation.cashDelta > 0 ? 'is-up' : 'is-down'}`}>
                {animation.cashDelta > 0 ? '+' : '-'}${Math.abs(Math.round(animation.cashDelta)).toLocaleString()}
              </span>
            ) : null}
            {animation?.stockDelta ? (
              <span className={`sb-float sb-float--stocks ${animation.stockDelta > 0 ? 'is-up' : 'is-down'}`}>
                보유 주식 {animation.stockDelta > 0 ? '+' : '-'}{Math.abs(animation.stockDelta)}주
              </span>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}

export default function GameBoard({ game, myPlayerIndex, onAction }) {
  const [tradeQty, setTradeQty] = useState(10);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [playerAnimations, setPlayerAnimations] = useState({});
  const lastPriceMoveRef = useRef(null);
  const prevPlayersRef = useRef(game.players);
  const prevPlayedCardsLenRef = useRef(0);
  const prevCounterCardRef = useRef(null);
  const bgmStartedRef = useRef(false);

  const me = game.players[myPlayerIndex];
  const currentPlayer = game.players[game.currentPlayerIndex];
  const targetPlayer = game.players.find((p) => p.id === game.selectedTargetPlayerId);
  const selectedCard = game.selectedCardDetailId ? CARD_MAP[game.selectedCardDetailId] : null;
  const displayCard = hoveredCard || selectedCard;

  const isMyTurn = myPlayerIndex === game.currentPlayerIndex;
  const isMyCounter = myPlayerIndex === game.counterPlayerIndex;
  const isFinalVolatilityPending = !!game.finalVolatilityPending;

  const canPlayCards = !isFinalVolatilityPending && isMyTurn && game.turnPhase === TURN_PHASES.CARD;
  const canCounter = !isFinalVolatilityPending && isMyCounter && game.turnPhase === TURN_PHASES.COUNTER;
  const canTrade = !isFinalVolatilityPending && isMyTurn && game.turnPhase === TURN_PHASES.TRADE;

  const myHand = useMemo(() => me.hand.map((id) => CARD_MAP[id]).filter(Boolean), [me.hand]);
  const counterCards = useMemo(() => {
    const attackCard = game.pendingCardAction ? CARD_MAP[game.pendingCardAction.cardId] : null;
    const isMarketManipulation = attackCard?.effect?.market !== undefined;
    const isMarginCall = attackCard?.effect?.special === 'margin_call';
    return me.hand
      .map((id) => CARD_MAP[id])
      .filter((c) => {
        if (c?.type !== CARD_TYPES.COUNTER) return false;
        if (c.effect.onlyForMarketManipulation && !isMarketManipulation) return false;
        if (c.effect.counterType === COUNTER_CARD_EFFECTS.MARGIN_DEPOSIT && !isMarginCall) return false;
        return true;
      });
  }, [me.hand, game.pendingCardAction]);
  const displayHand = canCounter ? counterCards : myHand;

  const momentumQty = game.momentumSelection?.quantity ?? 1;
  const isMomentumSelecting = canCounter && game.momentumSelection?.cardId;
  const [momentumInput, setMomentumInput] = useState(momentumQty);

  const act = useCallback(
    (name, ...args) => {
      playSound('buttonClick');
      onAction(name, ...args);
    },
    [onAction],
  );

  useEffect(() => {
    const m = game.lastResolvedPriceMove;
    if (!m) return;
    const prev = lastPriceMoveRef.current;
    const same = prev && prev.previousPrice === m.previousPrice && prev.nextPrice === m.nextPrice && prev.sourceName === m.sourceName;
    if (!same) {
      lastPriceMoveRef.current = m;
      if (m.direction) playSoundForPriceChange(m.direction);
    }
  }, [game.lastResolvedPriceMove]);

  useEffect(() => {
    const prevPlayers = prevPlayersRef.current;
    if (!prevPlayers || prevPlayers.length !== game.players.length) {
      prevPlayersRef.current = game.players;
      return;
    }

    const nextAnimations = {};
    game.players.forEach((player, index) => {
      const prevPlayer = prevPlayers[index];
      if (!prevPlayer || prevPlayer.id !== player.id) return;
      const cashDelta = Math.round((player.cash - prevPlayer.cash) * 100) / 100;
      const stockDelta = player.stocks - prevPlayer.stocks;
      if (cashDelta !== 0 || stockDelta !== 0) {
        nextAnimations[player.id] = { cashDelta, stockDelta, timestamp: Date.now() };
      }
    });

    if (Object.keys(nextAnimations).length > 0) {
      const startTimeout = setTimeout(() => setPlayerAnimations(nextAnimations), 0);
      const timeout = setTimeout(() => setPlayerAnimations({}), 500);
      prevPlayersRef.current = game.players;
      return () => {
        clearTimeout(startTimeout);
        clearTimeout(timeout);
      };
    }

    prevPlayersRef.current = game.players;
    return undefined;
  }, [game.players]);

  useEffect(() => {
    if (canTrade && game.turnPhase === TURN_PHASES.TRADE && isMyTurn) {
      const skipEffect = me.activeEffects.some((e) => e.type === 'skip_trade_this_turn');
      if (skipEffect) {
        setTimeout(() => act('skipTrade'), 500);
      }
    }
  }, [canTrade, game.turnPhase, isMyTurn, me.activeEffects, act]);

  useEffect(() => {
    setMomentumInput(momentumQty);
  }, [momentumQty]);

  useEffect(() => {
    if (!bgmStartedRef.current) {
      bgmStartedRef.current = true;
      playStartSound();
      const bgmTimer = setTimeout(() => startBgm(), 1500);
      return () => clearTimeout(bgmTimer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (game.gameOver) {
      stopBgm();
    }
  }, [game.gameOver]);

  useEffect(() => {
    const currentLen = game.turnPlayedCards?.length || 0;
    if (currentLen > prevPlayedCardsLenRef.current) {
      playSound('pop');
    }
    prevPlayedCardsLenRef.current = currentLen;
  }, [game.turnPlayedCards]);

  useEffect(() => {
    const currentCounterCardId = game.lastCounterCard?.cardId;
    if (currentCounterCardId && currentCounterCardId !== prevCounterCardRef.current) {
      playSound('pop');
    }
    prevCounterCardRef.current = currentCounterCardId;
  }, [game.lastCounterCard]);

  const emptySlots = Math.max(0, MAX_HAND - displayHand.length);
  const maxBuyQty = game.price > 0 ? Math.floor(me.cash / game.price) : 0;

  const pendingDirection = useMemo(() => {
    if (!game.pendingCardAction) return null;
    const aCard = CARD_MAP[game.pendingCardAction.cardId];
    const baseDir = aCard?.effect?.market?.direction;
    if (!baseDir) return null;
    return game.pendingCardAction.reversedDirection ? (baseDir === 'up' ? 'down' : 'up') : baseDir;
  }, [game.pendingCardAction]);
  const momentumAutoLabel = pendingDirection === 'up' ? '매수' : '매도';

  return (
    <div className="board">
      {/* ====== LEFT COLUMN ====== */}
      <div className="board__left">
        <div className="status-bar">
          <span className="status-bar__round">{Math.min(game.roundNumber, game.maxRounds)}/{game.maxRounds} 라운드</span>
        </div>
        {/* Top row: chart + price */}
        <div className="top-row">
          <div className="chart-box">
            <div className="chart-box__label">주식 차트</div>
            <StockChart history={game.priceHistory} />
          </div>
          <div className="price-box">
            <div className="price-box__label">주식 현재가</div>
            <div className="price-box__value">
              ${game.price.toFixed(2)}
              {(game.riseMultiplier !== 1.0 || game.fallMultiplier !== 1.0) && (
                <span className="price-box__multipliers">
                  {game.riseMultiplier !== 1.0 && <span className="clr-up">↑×{game.riseMultiplier.toFixed(1)}</span>}
                  {game.fallMultiplier !== 1.0 && <span className="clr-down">↓×{game.fallMultiplier.toFixed(1)}</span>}
                </span>
              )}
            </div>
            <div className="price-box__phase">{/*PHASE_LABEL[game.turnPhase] || game.turnPhase*/}</div>
            {game.lastResolvedPriceMove && (
              <div className={`price-box__move ${game.lastResolvedPriceMove.direction === 'up' ? 'clr-up' : 'clr-down'}`}>
                ${game.lastResolvedPriceMove.previousPrice.toFixed(2)} → ${game.lastResolvedPriceMove.nextPrice.toFixed(2)}
                {game.lastResolvedPriceMove.previousPrice > 0 && (() => {
                  const pct = ((game.lastResolvedPriceMove.nextPrice - game.lastResolvedPriceMove.previousPrice) / game.lastResolvedPriceMove.previousPrice * 100);
                  return (
                    <span className="price-box__pct">
                      ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Middle: table area */}
        <div className="table-area">
          <div className="table-area__current">{currentPlayer.name}</div>
          <div className="table-area__target">{targetPlayer?.name ?? ''}</div>
          
          {/* Left side: played cards this turn */}
          <div className="table-area__left">
            {(game.turnPlayedCards || []).length > 0 && (
              <div className="table-area__played-wrap">
                <div className="table-area__played-player">{currentPlayer.name}</div>
                <div className="table-area__played-cards">
                  {(game.turnPlayedCards || []).map((cardId, idx) => {
                    const card = CARD_MAP[cardId];
                    if (!card) return null;
                    const typeClass = {
                      [CARD_TYPES.ATTACK]: 'hc--attack',
                      [CARD_TYPES.COUNTER]: 'hc--counter',
                      [CARD_TYPES.FREE]: 'hc--free',
                      [CARD_TYPES.BLACK_SWAN]: 'hc--black-swan',
                    }[card.type] || '';
                    const typeSymbol = CARD_TYPE_SYMBOLS[card.type];
                    return (
                      <div
                        key={`played-${idx}`}
                        className={`hc hc--table ${typeClass}`}
                        onMouseEnter={() => setHoveredCard(card)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <span className="hc__top">
                          {typeSymbol ? <span className="hc__icon" style={{ '--hc-icon': `url(${typeSymbol})` }} /> : null}
                        </span>
                        <span className="hc__name">{card.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right side: counter card */}
          <div className="table-area__right">
            {game.lastCounterCard && (() => {
              const card = CARD_MAP[game.lastCounterCard.cardId];
              if (!card) return null;
              const typeSymbol = CARD_TYPE_SYMBOLS[card.type];
              return (
                <div className="table-area__counter-wrap">
                  <div className="table-area__counter-player">{game.lastCounterCard.playerName}</div>
                  <div
                    className="hc hc--table hc--counter"
                    onMouseEnter={() => setHoveredCard(card)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <span className="hc__top">
                      {typeSymbol ? <span className="hc__icon" style={{ '--hc-icon': `url(${typeSymbol})` }} /> : null}
                    </span>
                    <span className="hc__name">{card.name}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action controls overlay */}
          <div className="table-area__controls">
            {canPlayCards && !game.pendingTargetSelection && (
              <div className="ctrl-row">
                <button type="button" className={btn('ghost')} onClick={() => act('drawAndPass')}>카드 없이 넘기기</button>
              </div>
            )}
            {canTrade && (
              <div className="trade-ui">
                <div className="trade-ui__top">
                  <span className="trade-ui__label">매매</span>
                </div>
                <div className="trade-ui__main">
                  <button type="button" className="trade-ui__btn trade-ui__btn--buy" onClick={() => { playSound('trade'); act('buyStocks', tradeQty); }}>매수</button>
                  <div className="trade-ui__input-wrap">
                    <input type="number" min={1} value={tradeQty} onChange={(e) => setTradeQty(Number(e.target.value))} className="trade-ui__input" />
                  </div>
                  <button type="button" className="trade-ui__btn trade-ui__btn--sell" onClick={() => { playSound('trade'); act('sellStocks', tradeQty); }}>매도</button>
                </div>
                <div className="trade-ui__bottom">
                  <button type="button" className="trade-ui__quick" onClick={() => setTradeQty(maxBuyQty)}>매수 최대</button>
                  <button type="button" className="trade-ui__skip" onClick={() => act('skipTrade')}>건너뛰기</button>
                  <button type="button" className="trade-ui__quick" onClick={() => setTradeQty(me.stocks)}>매도 최대</button>
                </div>
              </div>
            )}
            {canCounter && (
              <div className="ctrl-row ctrl-row--counter">
                {isMomentumSelecting && pendingDirection && (
                  <div className="ctrl-momentum">
                    <span className="ctrl-momentum__label">모멘텀 ({momentumAutoLabel})</span>
                    <input
                      type="number"
                      min={1}
                      value={momentumInput}
                      onChange={(e) => setMomentumInput(e.target.value)}
                      onBlur={(e) => {
                        const val = Math.max(1, Math.floor(Number(e.target.value) || 1));
                        setMomentumInput(val);
                        act('setMomentumSelection', { quantity: val });
                      }}
                      className="ctrl-input"
                      placeholder="수량"
                    />
                    <span className="ctrl-momentum__unit">주</span>
                    <button type="button" className={btn('primary')} onClick={() => { onAction('setMomentumSelection', { quantity: Math.max(1, Math.floor(Number(momentumInput) || 1)) }); setTimeout(() => act('confirmMomentumCounter'), 50); }}>확정</button>
                    <button type="button" className={btn('ghost')} onClick={() => act('cancelMomentumCounter')}>취소</button>
                  </div>
                )}
                {!isMomentumSelecting && <button type="button" className={btn('ghost')} onClick={() => act('skipCounter')}>카운터 넘기기</button>}
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: hand + card description */}
        <div className="bottom-row">
          <div className="hand-zone">
            <div className="hand-zone__label">카드 목록 ({displayHand.length}/{MAX_HAND}){canCounter && ' - 카운터'}</div>
            <div className="hand-grid">
              {displayHand.map((card) => {
                const playable = canPlayCards
                  && card.type !== CARD_TYPES.COUNTER
                  && !(card.type === CARD_TYPES.FREE && (game.cardActionState.freeCardUsed || game.cardActionState.nonFreeCardUsed))
                  && !((card.type === CARD_TYPES.ATTACK || card.type === CARD_TYPES.BLACK_SWAN) && game.cardActionState.nonFreeCardUsed);
                const isBlindFundSelection = isMyTurn && game.pendingBlindFundCardId && card.id !== game.pendingBlindFundCardId;
                const isCounterCard = canCounter && !isMomentumSelecting && card.type === CARD_TYPES.COUNTER;
                const typeClass = {
                  [CARD_TYPES.ATTACK]: 'hc--attack',
                  [CARD_TYPES.COUNTER]: 'hc--counter',
                  [CARD_TYPES.FREE]: 'hc--free',
                  [CARD_TYPES.BLACK_SWAN]: 'hc--black-swan',
                }[card.type] || '';
                const typeSymbol = CARD_TYPE_SYMBOLS[card.type];
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`hc ${typeClass}${playable || isCounterCard || isBlindFundSelection ? '' : ' hc--off'}${isBlindFundSelection ? ' hc--selectable' : ''}`}
                    onMouseEnter={() => setHoveredCard(card)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onClick={() => {
                      if (isBlindFundSelection) {
                        act('playCard', game.pendingBlindFundCardId, card.id);
                      } else if (isCounterCard) {
                        act('useCounterCard', card.id);
                      } else if (playable) {
                        act('playCard', card.id);
                      } else {
                        act('selectCardDetail', card.id);
                      }
                    }}
                  >
                    <span className="hc__top">
                      {typeSymbol ? <span className="hc__icon" style={{ '--hc-icon': `url(${typeSymbol})` }} /> : null}
                    </span>
                    <span className="hc__name">{card.name}</span>
                  </button>
                );
              })}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} className="hc hc--empty"><span>-</span></div>
              ))}
            </div>
          </div>
          <div className="desc-zone">
            <div className="desc-zone__label">카드 설명</div>
            <div className="desc-zone__body">
              {displayCard ? (
                <>
                  <div className="desc-zone__name">{displayCard.name}</div>
                  <div className="desc-zone__text">{displayCard.description}</div>
                </>
              ) : (
                <div className="desc-zone__placeholder">카드에 마우스를 올리면 설명이 표시됩니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT SIDEBAR ====== */}
      <PlayerSidebar
        players={game.players}
        price={game.price}
        currentIdx={game.currentPlayerIndex}
        myIdx={myPlayerIndex}
        canTarget={!!game.pendingTargetSelection && isMyTurn}
        onSelectTarget={(id) => act('selectTarget', id)}
        playerAnimations={playerAnimations}
        isTargeting={!!game.pendingTargetSelection && isMyTurn}
      />
    </div>
  );
}
