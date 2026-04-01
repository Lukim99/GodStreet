import { CARD_MAP, CARD_LIBRARY } from './cardLibrary.js';
import { TURN_PHASES, COUNTER_CARD_EFFECTS } from './constants.js';

const MOMENTUM_MODES = {
  BUY: 'buy',
  SELL: 'sell',
};

export const shuffleArray = (items) => {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }
  return nextItems;
};

export const formatSignedCurrency = (value) => {
  const rounded = Math.round(value);
  if (rounded > 0) return `+$${rounded.toLocaleString()}`;
  if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString()}`;
  return '$0';
};

export const formatSignedPercent = (value) => {
  if (value > 0) return `+${value.toFixed(1)}%`;
  if (value < 0) return `${value.toFixed(1)}%`;
  return '0.0%';
};

const clampMaxRounds = (value) => Math.max(5, Math.min(100, Math.floor(Number(value) || 10)));
const getRandomPercentBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const getPlayerMetrics = (player, price) => {
  const marketValue = player.stocks * price;
  const costBasis = player.stocks * player.averageBuyPrice;
  const profitAmount = marketValue - costBasis;
  const profitPercent = costBasis > 0 ? (profitAmount / costBasis) * 100 : 0;
  const totalAssets = player.cash + marketValue;
  const perShareAmount = player.stocks > 0 ? price - player.averageBuyPrice : 0;
  const perSharePercent = player.averageBuyPrice > 0 ? ((price - player.averageBuyPrice) / player.averageBuyPrice) * 100 : 0;
  return { marketValue, costBasis, profitAmount, profitPercent, totalAssets, perShareAmount, perSharePercent };
};

const applyBuyTransaction = (player, price, quantity) => {
  if (quantity <= 0 || price <= 0) return player;
  const totalCost = quantity * price;
  const nextStocks = player.stocks + quantity;
  const nextAverageBuyPrice = nextStocks > 0
    ? Math.floor(((player.averageBuyPrice * player.stocks) + totalCost) / nextStocks)
    : 0;

  return {
    ...player,
    cash: player.cash - totalCost,
    stocks: nextStocks,
    averageBuyPrice: nextAverageBuyPrice,
  };
};

const createRoundLimitResult = (state, reason) => {
  const maxAssets = Math.max(...state.players.map((player) => getPlayerMetrics(player, state.price).totalAssets));
  const winnerIndexes = state.players
    .map((player, index) => ({ index, totalAssets: getPlayerMetrics(player, state.price).totalAssets }))
    .filter((entry) => entry.totalAssets === maxAssets)
    .map((entry) => entry.index);
  return createGameResult(state, reason, winnerIndexes);
};

const applySellTransaction = (player, price, quantity) => {
  if (quantity <= 0 || price <= 0) return player;
  const nextStocks = Math.max(0, player.stocks - quantity);
  const executedQuantity = player.stocks - nextStocks;

  return {
    ...player,
    cash: player.cash + executedQuantity * price,
    stocks: nextStocks,
    averageBuyPrice: nextStocks === 0 ? 0 : player.averageBuyPrice,
  };
};

const createInitialPlayers = (count = 2, names = [], startingCash = 10000) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i] || `Player${i + 1}`,
    cash: startingCash,
    stocks: 0,
    averageBuyPrice: 0,
    activeEffects: [],
    hand: [],
    pendingHedgeCompensation: 0,
    isEliminated: false,
  }));

const createTurnOrder = (count = 2) => shuffleArray(Array.from({ length: count }, (_, index) => index));
const getTurnOrder = (state) => state.turnOrder?.length ? state.turnOrder : state.players.map((_, index) => index);
const getTurnOrderPosition = (state, playerIndex) => getTurnOrder(state).findIndex((index) => index === playerIndex);
const findNextTurnOrderPlayerIndex = (state, currentIndex, excludedIndexes = []) => {
  const turnOrder = getTurnOrder(state);
  if (!turnOrder.length) return -1;

  const excludedSet = new Set(excludedIndexes);
  const currentPosition = getTurnOrderPosition(state, currentIndex);

  for (let step = 1; step <= turnOrder.length; step += 1) {
    const position = currentPosition === -1 ? step - 1 : (currentPosition + step) % turnOrder.length;
    const nextIndex = turnOrder[position];
    if (excludedSet.has(nextIndex)) continue;
    if (!state.players[nextIndex] || state.players[nextIndex].isEliminated) continue;
    return nextIndex;
  }

  return -1;
};

const getOpponentIndexes = (players, playerIndex) => players.map((_, index) => index).filter((index) => index !== playerIndex);
const findNextOpponentIndex = (players, playerIndex) => getOpponentIndexes(players, playerIndex)[0] ?? playerIndex;

const getActivePlayerIndexes = (state) => state.players
  .map((player, index) => ({ player, index }))
  .filter(({ player }) => !player.isEliminated)
  .map(({ index }) => index);

const createGameResult = (state, reason, winnerIndexes = []) => {
  const rankings = state.players
    .map((player, index) => {
      const metrics = getPlayerMetrics(player, state.price);
      return {
        playerIndex: index,
        name: player.name,
        isWinner: winnerIndexes.includes(index),
        isEliminated: player.isEliminated,
        cash: player.cash,
        stocks: player.stocks,
        marketValue: metrics.marketValue,
        profitAmount: metrics.profitAmount,
        totalAssets: metrics.totalAssets,
      };
    })
    .sort((a, b) => b.totalAssets - a.totalAssets);

  return {
    reason,
    rankings,
    winners: winnerIndexes,
  };
};

const applyEliminationsAndVictory = (state) => {
  let eliminatedNames = [];
  let nextState = {
    ...state,
    players: state.players.map((player) => {
      if (player.isEliminated) return player;
      const totalAssets = getPlayerMetrics(player, state.price).totalAssets;
      if (totalAssets > 0) return player;
      eliminatedNames.push(player.name);
      return { ...player, isEliminated: true, hand: [] };
    }),
  };

  if (eliminatedNames.length > 0 && !nextState.gameOver) {
    nextState = {
      ...nextState,
      statusMessage: eliminatedNames.length === 1
        ? `${eliminatedNames[0]}님이 총 자산 $0 이하로 탈락했습니다.`
        : `${eliminatedNames.join(', ')}님이 총 자산 $0 이하로 탈락했습니다.`,
    };
  }

  const activeIndexes = getActivePlayerIndexes(nextState);
  const targetCash = nextState.targetCash || 100000;
  const cashWinnerIndexes = activeIndexes.filter((index) => nextState.players[index].cash >= targetCash);
  if (cashWinnerIndexes.length > 0) {
    const winnerIndex = cashWinnerIndexes.sort((a, b) => nextState.players[b].cash - nextState.players[a].cash)[0];
    return {
      ...nextState,
      gameOver: true,
      result: createGameResult(nextState, `${nextState.players[winnerIndex].name}님이 보유 현금 $${targetCash.toLocaleString()}을 달성했습니다.`, [winnerIndex]),
      statusMessage: `${nextState.players[winnerIndex].name}님이 즉시 승리했습니다.`,
    };
  }

  if (activeIndexes.length <= 1) {
    return {
      ...nextState,
      gameOver: true,
      result: createGameResult(nextState, activeIndexes.length === 1 ? `${nextState.players[activeIndexes[0]].name}님만 생존했습니다.` : '모든 플레이어가 탈락했습니다.' , activeIndexes),
      statusMessage: activeIndexes.length === 1 ? `${nextState.players[activeIndexes[0]].name}님이 승리했습니다.` : '게임이 종료되었습니다.',
    };
  }

  return nextState;
};

const removeFirstCardFromHand = (hand, cardId) => {
  const removeIndex = hand.indexOf(cardId);
  if (removeIndex === -1) return hand;
  return hand.filter((_, index) => index !== removeIndex);
};

const removeCardFromHand = (players, playerIndex, cardId) =>
  players.map((player, index) =>
    index === playerIndex
      ? {
          ...player,
          hand: removeFirstCardFromHand(player.hand, cardId),
        }
      : player
  );

const discardOneAdditionalCard = (players, playerIndex, discardPile) => {
  const player = players[playerIndex];
  if (player.hand.length === 0) {
    return { players, discardPile };
  }

  const discardedCardId = player.hand[0];
  return {
    players: players.map((targetPlayer, index) =>
      index === playerIndex
        ? { ...targetPlayer, hand: targetPlayer.hand.slice(1) }
        : targetPlayer
    ),
    discardPile: [...discardPile, discardedCardId],
  };
};

export const drawCardsForPlayer = (players, deck, discardPile, playerIndex, amount) => {
  let nextPlayers = players;
  let nextDeck = [...deck];
  let nextDiscardPile = [...discardPile];

  for (let count = 0; count < amount; count += 1) {
    const currentHand = nextPlayers[playerIndex]?.hand || [];
    if (currentHand.length >= 8) break;

    if (nextDeck.length === 0 && nextDiscardPile.length > 0) {
      nextDeck = shuffleArray(nextDiscardPile);
      nextDiscardPile = [];
    }

    if (nextDeck.length === 0) break;

    const drawnCardId = nextDeck.shift();
    nextPlayers = nextPlayers.map((player, index) =>
      index === playerIndex ? { ...player, hand: [...player.hand, drawnCardId] } : player
    );
  }

  return { players: nextPlayers, deck: nextDeck, discardPile: nextDiscardPile };
};

const forceSellAll = (player, price) => ({
  ...player,
  cash: player.cash + player.stocks * price,
  stocks: 0,
  averageBuyPrice: 0,
});

const forceBuyAll = (player, price, allowNegativeCash = false) => {
  if (price <= 0) return player;

  const buyingPower = allowNegativeCash ? Math.max(player.cash, 0) : Math.max(player.cash, 0);
  const quantity = Math.floor(buyingPower / price);
  if (quantity <= 0) return player;

  return applyBuyTransaction(player, price, quantity);
};

const applyMarketMoveToState = (game, rawNextPrice, sourceName, meta = {}) => {
  const normalizedNextPrice = Math.max(0, Math.round(rawNextPrice * 100) / 100);
  const priceBeforeMove = game.price;
  const actualNextPrice = normalizedNextPrice <= 0 ? 100 : normalizedNextPrice;
  const priceDropAmount = Math.max(0, priceBeforeMove - actualNextPrice);
  const nextPlayers = game.players.map((player, index) => {
    const hasHedge = player.activeEffects.some((effect) => effect.type === 'hedge_until_trade_phase');
    const isCurrentTurnPlayer = index === game.currentPlayerIndex;
    if (!hasHedge || !isCurrentTurnPlayer || priceDropAmount <= 0 || player.stocks <= 0) return player;

    const pendingHedgeCompensation = (player.pendingHedgeCompensation || 0) + Math.floor(priceDropAmount * player.stocks * 1.0);
    return {
      ...player,
      pendingHedgeCompensation,
    };
  });

  if (normalizedNextPrice <= 1) {
    return {
      ...game,
      price: 100,
      priceHistory: [...(game.priceHistory || []), 100],
      players: nextPlayers.map((player) => ({ ...player, stocks: 0, averageBuyPrice: 0 })),
      lastResolvedPriceMove: {
        sourceName,
        previousPrice: priceBeforeMove,
        nextPrice: 100,
        direction: priceBeforeMove >= 100 ? 'down' : 'up',
        meta,
      },
      statusMessage: '주가가 $1 이하로 떨어져 상장폐지 되었습니다.',
    };
  }

  return {
    ...game,
    price: normalizedNextPrice,
    priceHistory: [...(game.priceHistory || []), normalizedNextPrice],
    players: nextPlayers,
    lastResolvedPriceMove: {
      sourceName,
      previousPrice: priceBeforeMove,
      nextPrice: normalizedNextPrice,
      direction: normalizedNextPrice > priceBeforeMove ? 'up' : normalizedNextPrice < priceBeforeMove ? 'down' : 'flat',
      meta,
    },
    statusMessage: '매매할 차례입니다.',
  };
};

const applyBuffs = (game, buffs = [], playedByIndex) => {
  let nextGame = { ...game };
  buffs.forEach((buff) => {
    nextGame[buff.target] = Math.max(0, Number((nextGame[buff.target] + buff.value).toFixed(1)));
  });
  
  if (playedByIndex !== undefined) {
    nextGame.players = nextGame.players.map((player, index) => {
      if (index === playedByIndex) return player;
      const buffEffect = {
        type: 'buff_multipliers',
        playedByIndex,
        riseMultiplierDelta: buffs.find((b) => b.target === 'riseMultiplier')?.value || 0,
        fallMultiplierDelta: buffs.find((b) => b.target === 'fallMultiplier')?.value || 0,
      };
      return {
        ...player,
        activeEffects: [...player.activeEffects, buffEffect],
      };
    });
  }
  
  return nextGame;
};

const executeBaseMarketEffect = (game, card, pendingAction) => {
  if (!card.effect.market) return game;

  const marketEffect = card.effect.market;
  const multiplier = marketEffect.multiplierKey ? game[marketEffect.multiplierKey] : 1;
  const direction = pendingAction?.reversedDirection
    ? marketEffect.direction === 'up' ? 'down' : 'up'
    : marketEffect.direction;

  if (marketEffect.mode === 'percent') {
    const deltaPercent = marketEffect.value * multiplier;
    const nextPrice = direction === 'up'
      ? game.price * (1 + deltaPercent / 100)
      : game.price * (1 - deltaPercent / 100);
    return applyMarketMoveToState(game, nextPrice, card.name);
  }

  const deltaAmount = Math.floor(marketEffect.value * multiplier);
  const nextPrice = direction === 'up' ? game.price + deltaAmount : game.price - deltaAmount;
  return applyMarketMoveToState(game, nextPrice, card.name);
};

export const createInitialGameState = (playerCount = 2, playerNames = [], options = {}) => {
  const count = Math.max(2, Math.min(10, playerCount));
  const maxRounds = clampMaxRounds(options.maxRounds);
  const startingCash = Math.max(1000, Math.min(1000000, Math.floor(Number(options.startingCash) || 10000)));
  const startingPrice = Math.max(10, Math.min(10000, Math.floor(Number(options.startingPrice) || 100)));
  const targetCash = Math.max(10000, Math.min(10000000, Math.floor(Number(options.targetCash) || 100000)));
  const startingDeck = shuffleArray(CARD_LIBRARY.map((card) => card.id));
  let nextPlayers = createInitialPlayers(count, playerNames, startingCash);
  let nextDeck = [...startingDeck];
  let nextDiscardPile = [];
  const turnOrder = createTurnOrder(count);
  const firstPlayerIndex = turnOrder[0] ?? 0;
  const initialTargetIndex = turnOrder[1] ?? firstPlayerIndex;

  nextPlayers.forEach((_, playerIndex) => {
    const drawResult = drawCardsForPlayer(nextPlayers, nextDeck, nextDiscardPile, playerIndex, 5);
    nextPlayers = drawResult.players;
    nextDeck = drawResult.deck;
    nextDiscardPile = drawResult.discardPile;
  });

  return {
    price: startingPrice,
    priceHistory: [startingPrice],
    riseMultiplier: 1.0,
    fallMultiplier: 1.0,
    players: nextPlayers,
    turnOrder,
    currentPlayerIndex: firstPlayerIndex,
    turnPhase: TURN_PHASES.CARD,
    statusMessage: '세력 싸움에 오신걸 환영합니다.',
    pendingCardAction: null,
    counterPlayerIndex: null,
    globalEffects: [],
    cardActionState: { freeCardUsed: false, nonFreeCardUsed: false },
    turnPlayedCards: [],
    lastCounterCard: null,
    deck: nextDeck,
    discardPile: nextDiscardPile,
    selectedCardDetailId: null,
    selectedTargetPlayerId: nextPlayers[initialTargetIndex]?.id ?? nextPlayers[firstPlayerIndex]?.id,
    lastResolvedPriceMove: null,
    momentumSelection: null,
    pendingTargetSelection: null,
    roundNumber: 1,
    maxRounds,
    targetCash,
    finalVolatilityPending: false,
    gameOver: false,
    result: null,
  };
};

export const sanitizeStateForPlayer = (state, playerIndex) => ({
  ...state,
  deck: { length: state.deck.length },
  players: state.players.map((player, index) =>
    index === playerIndex
      ? player
      : { ...player, hand: Array.from({ length: player.hand.length }, () => 'hidden') }
  ),
});

export const getTargetPlayerIndex = (state) => {
  const targetIndex = state.players.findIndex((player) => player.id === state.selectedTargetPlayerId);
  if (targetIndex !== -1 && targetIndex !== state.currentPlayerIndex) return targetIndex;
  const fallbackTargetIndex = findNextTurnOrderPlayerIndex(state, state.currentPlayerIndex, [state.currentPlayerIndex]);
  return fallbackTargetIndex !== -1 ? fallbackTargetIndex : findNextOpponentIndex(state.players, state.currentPlayerIndex);
};

const resolveCardEffect = (state, card, pendingAction = null) => {
  let nextState = { ...state };

  if (pendingAction?.premarketTrades?.length) {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) => {
        const tradeInstruction = pendingAction.premarketTrades.find((trade) => trade.playerIndex === index);
        if (!tradeInstruction) return player;
        return tradeInstruction.mode === 'sell_all'
          ? forceSellAll(player, nextState.price)
          : forceBuyAll(player, nextState.price, true);
      }),
    };
  }

  if (card.effect.market) {
    nextState = executeBaseMarketEffect(nextState, card, pendingAction);
  }

  if (card.effect.buffs) {
    nextState = applyBuffs(nextState, card.effect.buffs, pendingAction.playedByIndex);
  }

  if (card.effect.special === 'margin_call') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) => {
        if (index === state.currentPlayerIndex) return player;
        const blocked = pendingAction?.marginCallBlockedPlayerIndexes?.includes(index);
        if (blocked) return player;
        return forceSellAll(player, nextState.price);
      }),
      statusMessage: '반대매매 효과가 처리되었습니다.',
    };
  }

  if (card.effect.special === 'hostile_ma') {
    const targetIndex = pendingAction?.targetPlayerIndex ?? getTargetPlayerIndex(nextState);
    const actorIndex = pendingAction?.playedByIndex ?? nextState.currentPlayerIndex;
    const target = nextState.players[targetIndex];
    const forcedShares = Math.floor(target.stocks * (card.effect.sharePercent / 100));
    const hostileMaPrice = Math.max(0, nextState.price * 0.95);

    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) => {
        if (index === actorIndex) {
          const nextStocks = player.stocks + forcedShares;
          const nextAverageBuyPrice = nextStocks > 0
            ? Math.floor(((player.averageBuyPrice * player.stocks) + (forcedShares * hostileMaPrice)) / nextStocks)
            : 0;
          return {
            ...player,
            cash: player.cash - (forcedShares * hostileMaPrice),
            stocks: nextStocks,
            averageBuyPrice: nextAverageBuyPrice,
          };
        }

        if (index === targetIndex) {
          const nextStocks = player.stocks - forcedShares;
          return {
            ...player,
            cash: player.cash + (forcedShares * hostileMaPrice),
            stocks: nextStocks,
            averageBuyPrice: nextStocks === 0 ? 0 : player.averageBuyPrice,
          };
        }

        return player;
      }),
      statusMessage: `적대적 M&A가 발동되어 ${nextState.players[targetIndex].name}의 주식 ${forcedShares}주가 현재가 대비 5% 할인된 가격으로 강제 매수되었습니다.`,
    };
  }

  if (card.effect.special === 'leverage') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              activeEffects: [
                ...player.activeEffects.filter((effect) => effect.type !== 'leverage_until_own_turn_start'),
                {
                  type: 'leverage_until_own_turn_start',
                  label: `레버리지 x${card.effect.leverageMultiplier}`,
                  multiplier: card.effect.leverageMultiplier,
                  extraBoughtShares: 0,
                },
              ],
            }
          : player
      ),
      statusMessage: `${card.name}가 적용되었습니다.\n이번 턴 매수 시 추가 매수가 발생하고 다음 턴 시작 시 추가 매수분만 자동 매도됩니다.`,
    };
  }

  if (card.effect.special === 'dividend') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex ? { ...player, cash: player.cash + (player.stocks * 5) } : player
      ),
      statusMessage: '배당금 지급이 적용되었습니다.',
    };
  }

  if (card.effect.special === 'hedge') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              pendingHedgeCompensation: 0,
              activeEffects: [
                ...player.activeEffects.filter((effect) => effect.type !== 'hedge_until_trade_phase'),
                { type: 'hedge_until_trade_phase', label: '헷징' },
              ],
            }
          : player
      ),
      statusMessage: '헷징이 적용되었습니다.\n자신의 턴에 발생한 하락분은 매매 턴 직전에 현금 보상됩니다.',
    };
  }

  if (card.effect.special === 'blind_fund') {
    const discardCardId = pendingAction?.discardCardId;
    let discarded;
    if (discardCardId) {
      discarded = {
        players: nextState.players.map((p, i) => 
          i === state.currentPlayerIndex 
            ? { ...p, hand: p.hand.filter((cid) => cid !== discardCardId) }
            : p
        ),
        discardPile: [...nextState.discardPile, discardCardId],
      };
    } else {
      discarded = discardOneAdditionalCard(nextState.players, state.currentPlayerIndex, nextState.discardPile);
    }
    const drawn = drawCardsForPlayer(discarded.players, nextState.deck, discarded.discardPile, state.currentPlayerIndex, 1);
    nextState = {
      ...nextState,
      players: drawn.players,
      deck: drawn.deck,
      discardPile: drawn.discardPile,
      statusMessage: '손패 1장을 버리고 카드 1장을 뽑았습니다.',
    };
  }

  if (card.effect.special === 'inflation') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex ? player : { ...player, cash: Math.floor(player.cash * 0.95) }
      ),
      statusMessage: '인플레이션이 발동해 다른 플레이어들의 현금이 5% 감소했습니다.',
    };
  }

  if (card.effect.special === 'bailout') {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex ? { ...player, cash: 500 } : player
      ),
      statusMessage: '구제금융이 적용되어 보유 현금이 $0으로 탕감되고 $500을 지원받았습니다.',
    };
  }

  if (card.effect.special === 'call_option') {
    const strikePrice = nextState.price * (1 + card.effect.strikePercent / 100);
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              cash: player.cash - card.effect.cost,
              activeEffects: [
                ...player.activeEffects,
                { type: 'call_option', strikePrice, payoutPerDollar: card.effect.payoutPerDollar },
              ],
            }
          : player
      ),
      statusMessage: `콜옵션 매수: 행사가 $${strikePrice.toFixed(2)} (현재가 +5%)`,
    };
  }

  if (card.effect.special === 'put_option') {
    const strikePrice = nextState.price * (1 - card.effect.strikePercent / 100);
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              cash: player.cash - card.effect.cost,
              activeEffects: [
                ...player.activeEffects,
                { type: 'put_option', strikePrice, payoutPerDollar: card.effect.payoutPerDollar },
              ],
            }
          : player
      ),
      statusMessage: `풋옵션 매수: 행사가 $${strikePrice.toFixed(2)} (현재가 -5%)`,
    };
  }

  if (card.effect.special === 'rumor') {
    const randomPercent = Math.floor(Math.random() * 401) - 200;
    const newPrice = Math.max(1, nextState.price * (1 + randomPercent / 10));
    const symbol = randomPercent >= 0 ? '+' : '';
    nextState = {
      ...nextState,
      price: newPrice,
      priceHistory: [...nextState.priceHistory, newPrice],
      statusMessage: `미확인 찌라시! 주가가 ${symbol}${(randomPercent / 10).toFixed(1)}% 변동했습니다.`,
    };
  }

  if (card.effect.globalEffect) {
    nextState = {
      ...nextState,
      globalEffects: [
        ...nextState.globalEffects.filter((effect) => effect.type !== card.effect.globalEffect.type),
        { ...card.effect.globalEffect, playedByIndex: pendingAction.playedByIndex },
      ],
    };
  }

  if (card.effect.skipTrade) {
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) =>
        index === state.currentPlayerIndex
          ? {
              ...player,
              activeEffects: [
                ...player.activeEffects.filter((effect) => effect.type !== 'skip_trade_this_turn'),
                { type: 'skip_trade_this_turn', label: '매매 건너뛰기' },
              ],
            }
          : player
      ),
    };
  }

  if (pendingAction?.momentumTrade) {
    const { playerIndex, mode, quantity } = pendingAction.momentumTrade;
    nextState = {
      ...nextState,
      players: nextState.players.map((player, index) => {
        if (index !== playerIndex) return player;

        if (mode === MOMENTUM_MODES.SELL) {
          if (player.stocks <= 0) return player;
          return applySellTransaction(player, nextState.price, Math.min(player.stocks, quantity));
        }

        const affordableQuantity = Math.floor(Math.max(player.cash, 0) / nextState.price);
        if (affordableQuantity <= 0) return player;
        return applyBuyTransaction(player, nextState.price, Math.min(affordableQuantity, quantity));
      }),
      statusMessage: `${nextState.players[playerIndex]?.name ?? '플레이어'}가 모멘텀 거래를 실행했습니다.`,
    };
  }

  if (pendingAction?.extraMarketRepeats && card.effect.market) {
    for (let repeat = 0; repeat < pendingAction.extraMarketRepeats; repeat += 1) {
      nextState = executeBaseMarketEffect(nextState, card, pendingAction);
    }
  }

  return nextState;
};

const resolvePendingCardAction = (state) => {
  if (!state.pendingCardAction) {
    return applyPendingHedgeForTradePhase({ ...state, turnPhase: TURN_PHASES.TRADE });
  }

  const pendingCard = CARD_MAP[state.pendingCardAction.cardId];
  if (!pendingCard) {
    return applyPendingHedgeForTradePhase({ ...state, pendingCardAction: null, counterPlayerIndex: null, turnPhase: TURN_PHASES.TRADE });
  }

  if (state.pendingCardAction.cancelled) {
    return applyPendingHedgeForTradePhase({
      ...state,
      pendingCardAction: null,
      counterPlayerIndex: null,
      turnPhase: TURN_PHASES.TRADE,
      statusMessage: `${pendingCard.name} 카드가 무효화되었습니다.`,
    });
  }

  const nextState = resolveCardEffect(state, pendingCard, state.pendingCardAction);
  return applyPendingHedgeForTradePhase({ ...nextState, pendingCardAction: null, counterPlayerIndex: null, turnPhase: TURN_PHASES.TRADE, momentumSelection: null });
};

const applyMomentumCounter = (game) => {
  if (game.turnPhase !== TURN_PHASES.COUNTER || game.counterPlayerIndex === null || !game.pendingCardAction) return game;
  const momentumCardId = game.momentumSelection?.cardId;
  if (!momentumCardId) return game;

  const card = CARD_MAP[momentumCardId];
  if (!card || card.effect?.counterType !== COUNTER_CARD_EFFECTS.MOMENTUM) return game;

  const counterPlayerState = game.players[game.counterPlayerIndex];
  if (!counterPlayerState.hand.includes(momentumCardId)) return game;

  const attackCard = CARD_MAP[game.pendingCardAction.cardId];
  const baseDirection = attackCard?.effect?.market?.direction;
  if (!baseDirection) return game;

  const effectiveDirection = game.pendingCardAction.reversedDirection
    ? (baseDirection === 'up' ? 'down' : 'up')
    : baseDirection;
  const autoMode = effectiveDirection === 'up' ? MOMENTUM_MODES.BUY : MOMENTUM_MODES.SELL;
  const qty = Math.max(1, Math.floor(Number(game.momentumSelection?.quantity) || 1));
  const modeLabel = autoMode === MOMENTUM_MODES.BUY ? '매수' : '매도';
  const mktVal = attackCard?.effect?.market?.value ?? 0;
  const mktSymbol = effectiveDirection === 'up' ? '+' : '-';
  const attackCardName = attackCard?.name ?? '알 수 없는 카드';
  const counterName = counterPlayerState.name;
  const fmtCounter = (counterCardName, result) => `${counterName}님이 ${attackCardName} 카드를 ${counterCardName} 카드로 카운터쳤습니다!\n(${result})`;

  const nextState = {
    ...game,
    players: removeCardFromHand(game.players, game.counterPlayerIndex, momentumCardId),
    discardPile: [...game.discardPile, momentumCardId],
    selectedCardDetailId: momentumCardId,
    lastCounterCard: { cardId: momentumCardId, playerIndex: game.counterPlayerIndex, playerName: counterName },
    pendingCardAction: {
      ...game.pendingCardAction,
      momentumTrade: {
        playerIndex: game.counterPlayerIndex,
        mode: autoMode,
        quantity: qty,
      },
      extraMarketRepeats: game.pendingCardAction.extraMarketRepeats + 1,
    },
    momentumSelection: null,
    statusMessage: fmtCounter('모멘텀 전략', `${counterName}님 ${qty}주 ${modeLabel} 후 추가로 ${mktSymbol}${mktVal}% 변동`),
  };

  return advanceCounterTurnOrResolve(nextState, true);
};

const advanceCounterTurnOrResolve = (state, counterWasUsed = false) => {
  const pendingCard = state.pendingCardAction ? CARD_MAP[state.pendingCardAction.cardId] : null;
  const isMarginCall = pendingCard?.effect?.special === 'margin_call';
  const onlyTargetCanCounter = state.pendingCardAction?.onlyTargetCanCounter;
  
  if (onlyTargetCanCounter) {
    return resolvePendingCardAction(state);
  }
  
  if (counterWasUsed && !isMarginCall) {
    return resolvePendingCardAction(state);
  }
  
  const nextCounterIndex = findNextTurnOrderPlayerIndex(state, state.counterPlayerIndex, [state.currentPlayerIndex]);
  if (nextCounterIndex === -1) {
    return resolvePendingCardAction(state);
  }
  return { 
    ...state, 
    counterPlayerIndex: nextCounterIndex
  };
};

const applyPendingHedgeForTradePhase = (state) => ({
  ...state,
  players: state.players.map((player, index) => {
    if (index !== state.currentPlayerIndex || !player.pendingHedgeCompensation) {
      return {
        ...player,
        pendingHedgeCompensation: player.pendingHedgeCompensation || 0,
      };
    }

    return {
      ...player,
      cash: player.cash + player.pendingHedgeCompensation,
      pendingHedgeCompensation: 0,
      activeEffects: player.activeEffects.filter((effect) => effect.type !== 'hedge_until_trade_phase'),
    };
  }),
});

export const finalizeGameState = (state) => {
  let nextState = applyEliminationsAndVictory(state);
  if (nextState.gameOver) return nextState;

  if (nextState.roundNumber > nextState.maxRounds) {
    if (nextState.finalVolatilityPending) return nextState;

    const finalShockPercent = getRandomPercentBetween(-30, 30);
    const shockedState = applyMarketMoveToState(
      nextState,
      nextState.price * (1 + finalShockPercent / 100),
      '최종 미친 변동성',
      { phase: 'final_round_showdown', percent: finalShockPercent }
    );
    const stabilizedState = applyEliminationsAndVictory(shockedState);
    return {
      ...stabilizedState,
      finalVolatilityPending: true,
      result: createRoundLimitResult(stabilizedState, `${nextState.maxRounds}바퀴 종료 후 최종 미친 변동성이 반영되었습니다.`),
      gameOver: false,
      statusMessage: `마지막 라운드 종료! 최종 미친 변동성 ${formatSignedPercent(finalShockPercent)} 적용. 5초 뒤 결과 화면으로 이동합니다.`,
    };
  }

  return nextState;
};

const startNextTurn = (state, nextPlayerIndex, baseMessage) => {
  const resolvedNextPlayerIndex = state.players[nextPlayerIndex]?.isEliminated
    ? findNextTurnOrderPlayerIndex(state, nextPlayerIndex)
    : nextPlayerIndex;

  if (resolvedNextPlayerIndex === -1) {
    return {
      ...state,
      gameOver: true,
      result: createGameResult(state, '모든 플레이어가 탈락했습니다.', []),
      statusMessage: '게임이 종료되었습니다.',
    };
  }

  const currentTurnOrderPosition = getTurnOrderPosition(state, state.currentPlayerIndex);
  const nextTurnOrderPosition = getTurnOrderPosition(state, resolvedNextPlayerIndex);
  const nextRoundNumber = currentTurnOrderPosition !== -1 && nextTurnOrderPosition !== -1 && nextTurnOrderPosition <= currentTurnOrderPosition
    ? state.roundNumber + 1
    : state.roundNumber;
  const nextTargetPlayerIndex = findNextTurnOrderPlayerIndex(state, resolvedNextPlayerIndex, [resolvedNextPlayerIndex]);

  let nextState = {
    ...state,
    currentPlayerIndex: resolvedNextPlayerIndex,
    turnPhase: TURN_PHASES.CARD,
    pendingCardAction: null,
    counterPlayerIndex: null,
    cardActionState: { freeCardUsed: false, nonFreeCardUsed: false },
    turnPlayedCards: [],
    lastCounterCard: null,
    selectedTargetPlayerId: state.players[nextTargetPlayerIndex]?.id ?? state.players[resolvedNextPlayerIndex].id,
    statusMessage: baseMessage,
    momentumSelection: null,
    globalEffects: state.globalEffects.filter((effect) => effect.playedByIndex !== resolvedNextPlayerIndex),
    roundNumber: nextRoundNumber,
    finalVolatilityPending: false,
  };

  if (nextRoundNumber > state.roundNumber) {
    const roundShockPercent = getRandomPercentBetween(-10, 10);
    const direction = roundShockPercent > 0 ? 'up' : 'down';
    const multiplier = direction === 'up' ? nextState.riseMultiplier : nextState.fallMultiplier;
    const effectivePercent = roundShockPercent * multiplier;
    nextState = applyMarketMoveToState(
      nextState,
      nextState.price * (1 + effectivePercent / 100),
      '라운드 변동성',
      { phase: 'round_cycle', percent: effectivePercent, roundNumber: nextRoundNumber }
    );
    nextState = {
      ...nextState,
      statusMessage: `${nextRoundNumber}라운드 시작! 주가가 ${formatSignedPercent(effectivePercent)} 변동되었으며 ${nextState.players[resolvedNextPlayerIndex].name} 차례입니다.`,
    };
  }

  nextState.globalEffects.forEach((effect) => {
    const changePercent = effect.perTurnPercent / 100;
    const direction = changePercent > 0 ? 'up' : 'down';
    const multiplier = direction === 'up' ? nextState.riseMultiplier : nextState.fallMultiplier;
    nextState = applyMarketMoveToState(nextState, nextState.price * (1 + changePercent * multiplier), `${effect.label} 지속`);
  });

  const buffsToRemove = [];
  nextState.players.forEach((player, index) => {
    player.activeEffects.forEach((effect) => {
      if (effect.playedByIndex === resolvedNextPlayerIndex && effect.type === 'buff_multipliers') {
        buffsToRemove.push({ playerIndex: index, effect });
      }
    });
  });

  nextState = {
    ...nextState,
    riseMultiplier: nextState.riseMultiplier,
    fallMultiplier: nextState.fallMultiplier,
    players: nextState.players.map((player, index) => {
      if (index !== resolvedNextPlayerIndex) {
        const effectsToRemove = buffsToRemove.filter((b) => b.playerIndex === index);
        if (effectsToRemove.length > 0) {
          let updatedPlayer = { ...player };
          effectsToRemove.forEach((b) => {
            updatedPlayer = {
              ...updatedPlayer,
              activeEffects: updatedPlayer.activeEffects.filter((e) => e !== b.effect),
            };
          });
          return updatedPlayer;
        }
        return player;
      }
      const leverageEffect = player.activeEffects.find((effect) => effect.type === 'leverage_until_own_turn_start');
      let nextPlayer = { ...player };
      if (leverageEffect?.extraBoughtShares > 0) {
        nextPlayer = applySellTransaction(nextPlayer, nextState.price, leverageEffect.extraBoughtShares);
      }
      
      const callOption = player.activeEffects.find((effect) => effect.type === 'call_option');
      if (callOption && nextState.price > callOption.strikePrice) {
        const priceDiff = (nextState.price - callOption.strikePrice);
        const payout = priceDiff * callOption.payoutPerDollar;
        nextPlayer = { ...nextPlayer, cash: nextPlayer.cash + payout };
      }
      
      const putOption = player.activeEffects.find((effect) => effect.type === 'put_option');
      if (putOption && nextState.price < putOption.strikePrice) {
        const priceDiff = (putOption.strikePrice - nextState.price);
        const payout = priceDiff * putOption.payoutPerDollar;
        nextPlayer = { ...nextPlayer, cash: (nextPlayer.cash + payout) };
      }
      
      return {
        ...nextPlayer,
        pendingHedgeCompensation: 0,
        activeEffects: nextPlayer.activeEffects.filter(
          (effect) => effect.type !== 'leverage_until_own_turn_start' && effect.type !== 'hedge_until_trade_phase' && effect.type !== 'call_option' && effect.type !== 'put_option'
        ),
      };
    }),
  };

  const uniqueBuffsByPlayer = new Map();
  buffsToRemove.forEach((b) => {
    if (!uniqueBuffsByPlayer.has(b.effect.playedByIndex)) {
      uniqueBuffsByPlayer.set(b.effect.playedByIndex, b.effect);
    }
  });
  uniqueBuffsByPlayer.forEach((effect) => {
    if (effect.riseMultiplierDelta) {
      nextState.riseMultiplier = Math.max(0.1, nextState.riseMultiplier - effect.riseMultiplierDelta);
    }
    if (effect.fallMultiplierDelta) {
      nextState.fallMultiplier = Math.max(0.1, nextState.fallMultiplier - effect.fallMultiplierDelta);
    }
  });

  return nextState;
};

export const handlePlayerDisconnect = (state, disconnectedIndex) => {
  if (!state || state.gameOver) return state;
  const player = state.players[disconnectedIndex];
  if (!player || player.isEliminated) return state;

  let nextState = {
    ...state,
    players: state.players.map((p, i) =>
      i === disconnectedIndex ? { ...p, isEliminated: true, hand: [] } : p
    ),
    globalEffects: state.globalEffects.filter((e) => e.playedByIndex !== disconnectedIndex),
    statusMessage: `${player.name}님이 연결이 끊겨 탈락했습니다.`,
  };

  const activeIndexes = getActivePlayerIndexes(nextState);
  if (activeIndexes.length <= 1) {
    return {
      ...nextState,
      gameOver: true,
      result: createGameResult(nextState, activeIndexes.length === 1
        ? `${nextState.players[activeIndexes[0]].name}님만 생존했습니다.`
        : '모든 플레이어가 탈락했습니다.', activeIndexes),
      statusMessage: activeIndexes.length === 1
        ? `${nextState.players[activeIndexes[0]].name}님이 승리했습니다.`
        : '게임이 종료되었습니다.',
    };
  }

  const isCounterPhase = nextState.turnPhase === TURN_PHASES.COUNTER;
  const isCounterPlayer = isCounterPhase && nextState.counterPlayerIndex === disconnectedIndex;
  const isCurrentPlayer = nextState.currentPlayerIndex === disconnectedIndex;

  if (isCounterPhase && nextState.pendingCardAction) {
    const targetIndex = nextState.pendingCardAction.targetPlayerIndex;
    if (targetIndex === disconnectedIndex) {
      nextState = {
        ...nextState,
        pendingCardAction: null,
        counterPlayerIndex: null,
        turnPhase: TURN_PHASES.TRADE,
        momentumSelection: null,
        statusMessage: `대상 플레이어 ${player.name}님이 나가서 카드 사용이 취소되었습니다.`,
      };

      if (isCurrentPlayer) {
        const nextIdx = findNextTurnOrderPlayerIndex(nextState, disconnectedIndex);
        if (nextIdx !== -1) {
          nextState = startNextTurn(nextState, nextIdx, `${nextState.players[nextIdx].name} 차례입니다.`);
        }
      }
      return finalizeGameState(nextState);
    }

    if (isCounterPlayer) {
      nextState = { ...nextState, momentumSelection: null };
      nextState = advanceCounterTurnOrResolve(nextState);
    }
  }

  if (isCurrentPlayer && !isCounterPhase) {
    const nextIdx = findNextTurnOrderPlayerIndex(nextState, disconnectedIndex);
    if (nextIdx !== -1) {
      nextState = startNextTurn(nextState, nextIdx, `${nextState.players[nextIdx].name} 차례입니다.`);
    }
  }

  if (isCurrentPlayer && isCounterPhase && !isCounterPlayer) {
    if (nextState.pendingCardAction) {
      nextState = {
        ...nextState,
        pendingCardAction: null,
        counterPlayerIndex: null,
        turnPhase: TURN_PHASES.CARD,
        momentumSelection: null,
      };
      const nextIdx = findNextTurnOrderPlayerIndex(nextState, disconnectedIndex);
      if (nextIdx !== -1) {
        nextState = startNextTurn(nextState, nextIdx, `${nextState.players[nextIdx].name} 차례입니다.`);
      }
    }
  }

  return finalizeGameState(nextState);
};

export const actions = {
  selectTarget: (game, playerId) => {
    if (!game.pendingTargetSelection) return game;
    const cardId = game.pendingTargetSelection.cardId;
    const card = CARD_MAP[cardId];
    if (!card) return game;
    
    const targetPlayerIndex = game.players.findIndex((p) => p.id === playerId);
    const isHostileMa = card.effect?.special === 'hostile_ma';
    const counterPlayerIndex = isHostileMa ? targetPlayerIndex : findNextTurnOrderPlayerIndex(game, game.currentPlayerIndex, [game.currentPlayerIndex]);
    const statusMsg = isHostileMa 
      ? `${card.name} 카드가 ${game.players[targetPlayerIndex].name}님에게 사용되었습니다.`
      : `${card.name} 카드가 사용되었습니다. 다른 플레이어들이 카운터를 사용할 수 있습니다.`;
    
    return {
      ...game,
      players: removeCardFromHand(game.players, game.currentPlayerIndex, cardId),
      discardPile: [...game.discardPile, cardId],
      pendingCardAction: {
        cardId,
        playedByIndex: game.currentPlayerIndex,
        targetPlayerIndex,
        reversedDirection: false,
        cancelled: false,
        premarketTrades: [],
        marginCallBlockedPlayerIndexes: [],
        extraMarketRepeats: 0,
        momentumTrade: null,
        onlyTargetCanCounter: isHostileMa,
      },
      counterPlayerIndex,
      turnPhase: TURN_PHASES.COUNTER,
      cardActionState: { ...game.cardActionState, nonFreeCardUsed: true },
      turnPlayedCards: [...game.turnPlayedCards, cardId],
      statusMessage: statusMsg,
      selectedCardDetailId: cardId,
      pendingTargetSelection: null,
    };
  },
  selectCardDetail: (game, cardId) => ({ ...game, selectedCardDetailId: game.selectedCardDetailId === cardId ? null : cardId }),
  setMomentumSelection: (game, selection) => ({ ...game, momentumSelection: { ...game.momentumSelection, ...selection } }),
  confirmMomentumCounter: (game) => applyMomentumCounter(game),
  cancelMomentumCounter: (game) => ({
    ...game,
    momentumSelection: null,
    statusMessage: '모멘텀 전략 수량 입력을 취소했습니다.',
  }),
  playCard: (game, cardId, discardCardId = null) => {
    if (game.turnPhase !== TURN_PHASES.CARD) return game;

    const card = CARD_MAP[cardId];
    if (!card) return game;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer.hand.includes(cardId)) return game;

    if (card.type === 'COUNTER') {
      return { ...game, statusMessage: '카운터 카드는 카운터 단계에서만 사용할 수 있습니다.' };
    }

    if (card.type === 'FREE') {
      if (game.cardActionState.freeCardUsed || game.cardActionState.nonFreeCardUsed) {
        return { ...game, statusMessage: '프리 카드는 공격/블랙스완 전에 1장만 사용할 수 있습니다.' };
      }

      if (card.effect.special === 'bailout' && currentPlayer.cash >= 0) {
        return { ...game, statusMessage: '구제금융은 보유 현금이 음수일 때만 사용할 수 있습니다.' };
      }

      if (card.effect.special === 'blind_fund' && !discardCardId) {
        const playerName = currentPlayer.name;
        return { ...game, statusMessage: `${playerName}님이 버릴 카드를 선택중입니다..`, pendingBlindFundCardId: cardId };
      }

      let nextState = {
        ...game,
        players: removeCardFromHand(game.players, game.currentPlayerIndex, cardId),
        discardPile: [...game.discardPile, cardId],
        cardActionState: { ...game.cardActionState, freeCardUsed: true },
        turnPlayedCards: [...game.turnPlayedCards, cardId],
        selectedCardDetailId: cardId,
        pendingBlindFundCardId: null,
      };
      nextState = resolveCardEffect(nextState, card, { playedByIndex: game.currentPlayerIndex, discardCardId });
      return nextState;
    }

    if (game.cardActionState.nonFreeCardUsed) {
      return { ...game, statusMessage: '이번 턴에는 이미 공격 또는 블랙스완 카드를 사용했습니다.' };
    }

    if (card.effect.targeted) {
      const playerName = currentPlayer.name;
      return {
        ...game,
        pendingTargetSelection: { cardId },
        statusMessage: `${playerName}님이 ${card.name} 카드의 대상을 선택중입니다..`,
        selectedCardDetailId: cardId,
      };
    }

    if (card.type === 'BLACK_SWAN') {
      const stateWithCard = {
        ...game,
        players: removeCardFromHand(game.players, game.currentPlayerIndex, cardId),
        discardPile: [...game.discardPile, cardId],
        pendingCardAction: {
          cardId,
          playedByIndex: game.currentPlayerIndex,
          targetPlayerIndex: null,
          reversedDirection: false,
          cancelled: false,
          premarketTrades: [],
          marginCallBlockedPlayerIndexes: [],
          extraMarketRepeats: 0,
          momentumTrade: null,
        },
        cardActionState: { ...game.cardActionState, nonFreeCardUsed: true },
        turnPlayedCards: [...game.turnPlayedCards, cardId],
        selectedCardDetailId: cardId,
      };
      return resolvePendingCardAction(stateWithCard);
    }

    return {
      ...game,
      players: removeCardFromHand(game.players, game.currentPlayerIndex, cardId),
      discardPile: [...game.discardPile, cardId],
      pendingCardAction: {
        cardId,
        playedByIndex: game.currentPlayerIndex,
        targetPlayerIndex: null,
        reversedDirection: false,
        cancelled: false,
        premarketTrades: [],
        marginCallBlockedPlayerIndexes: [],
        extraMarketRepeats: 0,
        momentumTrade: null,
      },
      counterPlayerIndex: findNextTurnOrderPlayerIndex(game, game.currentPlayerIndex, [game.currentPlayerIndex]),
      turnPhase: TURN_PHASES.COUNTER,
      cardActionState: { ...game.cardActionState, nonFreeCardUsed: true },
      turnPlayedCards: [...game.turnPlayedCards, cardId],
      statusMessage: `${card.name}가 사용되었습니다. 다른 플레이어들이 카운터를 사용할 수 있습니다.`,
      selectedCardDetailId: cardId,
    };
  },
  useCounterCard: (game, cardId) => {
    if (game.turnPhase !== TURN_PHASES.COUNTER || game.counterPlayerIndex === null || !game.pendingCardAction) return game;
    const card = CARD_MAP[cardId];
    if (!card || card.type !== 'COUNTER') return game;

    if (card.effect.counterType === COUNTER_CARD_EFFECTS.MOMENTUM) {
      const attackCard = CARD_MAP[game.pendingCardAction.cardId];
      const baseDirection = attackCard?.effect?.market?.direction;
      const effectiveDirection = game.pendingCardAction.reversedDirection
        ? (baseDirection === 'up' ? 'down' : 'up')
        : baseDirection;
      const autoMode = effectiveDirection === 'up' ? MOMENTUM_MODES.BUY : MOMENTUM_MODES.SELL;
      const modeLabel = autoMode === MOMENTUM_MODES.BUY ? '매수' : '매도';
      return {
        ...game,
        selectedCardDetailId: cardId,
        momentumSelection: {
          cardId,
          quantity: Math.max(1, Math.floor(Number(game.momentumSelection?.quantity) || 1)),
        },
        statusMessage: `모멘텀 전략 선택됨: ${modeLabel} 수량을 입력한 뒤 확정하세요.`,
      };
    }

    const counterPlayerState = game.players[game.counterPlayerIndex];
    if (!counterPlayerState.hand.includes(cardId)) return game;

    let nextState = {
      ...game,
      players: removeCardFromHand(game.players, game.counterPlayerIndex, cardId),
      discardPile: [...game.discardPile, cardId],
      selectedCardDetailId: cardId,
      lastCounterCard: { cardId, playerIndex: game.counterPlayerIndex, playerName: counterPlayerState.name },
    };

    const counterType = card.effect.counterType;

    const attackCard = CARD_MAP[nextState.pendingCardAction.cardId];
    const attackCardName = attackCard?.name ?? '알 수 없는 카드';
    const attackerName = nextState.players[nextState.pendingCardAction.playedByIndex]?.name ?? '공격자';
    const counterName = counterPlayerState.name;
    const fmtCounter = (counterCardName, result) => `${counterName}님이 ${attackCardName} 카드를 ${counterCardName} 카드로 카운터쳤습니다!\n(${result})`;

    if (counterType === COUNTER_CARD_EFFECTS.CIRCUIT_BREAKER) {
      nextState = {
        ...nextState,
        pendingCardAction: { ...nextState.pendingCardAction, cancelled: true },
        statusMessage: fmtCounter('서킷 브레이커', '주가 변동 없음'),
      };
    }

    if (counterType === COUNTER_CARD_EFFECTS.PREMARKET_SELL) {
      const sellQty = counterPlayerState.stocks;
      nextState = {
        ...nextState,
        pendingCardAction: {
          ...nextState.pendingCardAction,
          premarketTrades: [
            ...nextState.pendingCardAction.premarketTrades.filter((trade) => trade.playerIndex !== nextState.counterPlayerIndex),
            { playerIndex: nextState.counterPlayerIndex, mode: 'sell_all' },
          ],
        },
        statusMessage: fmtCounter('프리마켓 매도', `${counterName}님 프리마켓에서 주식 ${sellQty}주 매도`),
      };
    }

    if (counterType === COUNTER_CARD_EFFECTS.PREMARKET_BUY) {
      const buyQty = game.price > 0 ? Math.floor(counterPlayerState.cash / game.price) : 0;
      nextState = {
        ...nextState,
        pendingCardAction: {
          ...nextState.pendingCardAction,
          premarketTrades: [
            ...nextState.pendingCardAction.premarketTrades.filter((trade) => trade.playerIndex !== nextState.counterPlayerIndex),
            { playerIndex: nextState.counterPlayerIndex, mode: 'buy_all' },
          ],
        },
        statusMessage: fmtCounter('프리마켓 매수', `${counterName}님 프리마켓에서 주식 ${buyQty}주 매수`),
      };
    }

    if (counterType === COUNTER_CARD_EFFECTS.HOSTILE_FORCE) {
      const baseDir = attackCard?.effect?.market?.direction;
      const wasReversed = nextState.pendingCardAction.reversedDirection;
      const effectiveDir = wasReversed ? baseDir : (baseDir === 'up' ? 'down' : 'up');
      const dirLabel = effectiveDir === 'up' ? '상승' : '하락';
      nextState = {
        ...nextState,
        pendingCardAction: {
          ...nextState.pendingCardAction,
          reversedDirection: !nextState.pendingCardAction.reversedDirection,
        },
        statusMessage: fmtCounter('적대 세력', `주가 방향 반전 → ${dirLabel}`),
      };
    }

    if (counterType === COUNTER_CARD_EFFECTS.MARGIN_DEPOSIT) {
      nextState = {
        ...nextState,
        pendingCardAction: {
          ...nextState.pendingCardAction,
          marginCallBlockedPlayerIndexes: [...new Set([...nextState.pendingCardAction.marginCallBlockedPlayerIndexes, nextState.counterPlayerIndex])],
        },
        statusMessage: fmtCounter('증거금 납입', `${counterName}님 강제 매도 방어`),
      };
    }

    if (counterType === COUNTER_CARD_EFFECTS.AUDIT) {
      const canAudit = attackCard?.type === 'ATTACK';
      nextState = canAudit
        ? {
            ...nextState,
            players: nextState.players.map((player, index) =>
              index === nextState.pendingCardAction.playedByIndex ? { ...player, cash: player.cash - 500 } : player
            ),
            pendingCardAction: { ...nextState.pendingCardAction, cancelled: true },
            statusMessage: fmtCounter('회계 감사', `${attackerName}님 $500 벌금 부과`),
          }
        : { ...nextState, statusMessage: '회계 감사는 공격 카드에만 유효합니다.' };
    }

    return advanceCounterTurnOrResolve(nextState, true);
  },
  skipCounter: (game) => {
    if (game.turnPhase !== TURN_PHASES.COUNTER || game.counterPlayerIndex === null) return game;
    const skippedPlayerName = game.players[game.counterPlayerIndex].name;
    return advanceCounterTurnOrResolve({ ...game, momentumSelection: null, statusMessage: `${skippedPlayerName}가 카운터를 넘겼습니다.` });
  },
  buyStocks: (game, quantity) => {
    if (game.turnPhase !== TURN_PHASES.TRADE) return game;
    if (!Number.isFinite(quantity) || quantity <= 0) return { ...game, statusMessage: '매수 수량은 1주 이상이어야 합니다.' };

    const player = game.players[game.currentPlayerIndex];
    const leverageEffect = player.activeEffects.find((effect) => effect.type === 'leverage_until_own_turn_start');
    const extraShares = leverageEffect ? (player.stocks + quantity) * (leverageEffect.multiplier - 1) : 0;
    const totalQuantity = quantity + extraShares;
    const baseCost = quantity * game.price;
    const skipTradeEffect = player.activeEffects.some((effect) => effect.type === 'skip_trade_this_turn');

    if (skipTradeEffect) return { ...game, statusMessage: '이번 턴은 매매를 건너뛰어야 합니다.' };
    if (player.cash < baseCost) return { ...game, statusMessage: '현금이 부족합니다.' };

    const boughtPlayer = applyBuyTransaction(player, game.price, totalQuantity);
    const afterTrade = {
      ...game,
      players: game.players.map((targetPlayer, index) =>
        index === game.currentPlayerIndex
          ? {
              ...boughtPlayer,
              activeEffects: boughtPlayer.activeEffects.map((effect) =>
                effect.type === 'leverage_until_own_turn_start'
                  ? { ...effect, extraBoughtShares: (effect.extraBoughtShares || 0) + extraShares }
                  : effect
              ).filter((effect) => effect.type !== 'skip_trade_this_turn'),
              cash: player.cash - totalQuantity * game.price,
            }
          : targetPlayer
      ),
      statusMessage: `${player.name}이(가) ${quantity}주를 매수했습니다.${extraShares > 0 ? ` 레버리지로 ${extraShares}주가 추가 매수되었습니다. (총 ${player.stocks + totalQuantity}주)` : ''}`,
    };
    const drawn = drawCardsForPlayer(afterTrade.players, afterTrade.deck, afterTrade.discardPile, afterTrade.currentPlayerIndex, 1);
    const nextPlayerIndex = findNextTurnOrderPlayerIndex(afterTrade, afterTrade.currentPlayerIndex);
    const nextPlayerName = drawn.players[nextPlayerIndex]?.name ?? '다음 플레이어';
    return startNextTurn({ ...afterTrade, players: drawn.players, deck: drawn.deck, discardPile: drawn.discardPile }, nextPlayerIndex, `${nextPlayerName} 차례입니다.`);
  },
  sellStocks: (game, quantity) => {
    if (game.turnPhase !== TURN_PHASES.TRADE) return game;
    if (!Number.isFinite(quantity) || quantity <= 0) return { ...game, statusMessage: '매도 수량은 1주 이상이어야 합니다.' };

    const player = game.players[game.currentPlayerIndex];
    const skipTradeEffect = player.activeEffects.some((effect) => effect.type === 'skip_trade_this_turn');
    if (skipTradeEffect) return { ...game, statusMessage: '이번 턴은 매매를 건너뛰어야 합니다.' };
    if (player.stocks < quantity) return { ...game, statusMessage: '보유 수량보다 많이 매도할 수 없습니다.' };

    const afterTrade = {
      ...game,
      players: game.players.map((targetPlayer, index) =>
        index === game.currentPlayerIndex
          ? {
              ...player,
              activeEffects: player.activeEffects.filter((effect) => effect.type !== 'skip_trade_this_turn'),
              cash: player.cash + quantity * game.price,
              stocks: player.stocks - quantity,
            }
          : targetPlayer
      ),
      statusMessage: `${player.name}이(가) ${quantity}주를 매도했습니다.`,
    };
    const drawn = drawCardsForPlayer(afterTrade.players, afterTrade.deck, afterTrade.discardPile, afterTrade.currentPlayerIndex, 1);
    const nextPlayerIndex = findNextTurnOrderPlayerIndex(afterTrade, afterTrade.currentPlayerIndex);
    const nextPlayerName = drawn.players[nextPlayerIndex]?.name ?? '다음 플레이어';
    return startNextTurn({ ...afterTrade, players: drawn.players, deck: drawn.deck, discardPile: drawn.discardPile }, nextPlayerIndex, `${nextPlayerName} 차례입니다.`);
  },
  skipTrade: (game) => {
    if (game.turnPhase !== TURN_PHASES.TRADE) return game;
    const afterSkip = {
      ...game,
      players: game.players.map((player, index) =>
        index === game.currentPlayerIndex
          ? { ...player, activeEffects: player.activeEffects.filter((effect) => effect.type !== 'skip_trade_this_turn') }
          : player
      ),
      statusMessage: '매매를 건너뛰었습니다.',
    };
    const drawn = drawCardsForPlayer(afterSkip.players, afterSkip.deck, afterSkip.discardPile, afterSkip.currentPlayerIndex, 1);
    const nextPlayerIndex = findNextTurnOrderPlayerIndex(afterSkip, afterSkip.currentPlayerIndex);
    const nextPlayerName = drawn.players[nextPlayerIndex]?.name ?? '다음 플레이어';
    return startNextTurn({ ...afterSkip, players: drawn.players, deck: drawn.deck, discardPile: drawn.discardPile }, nextPlayerIndex, `${nextPlayerName} 차례입니다.`);
  },
  drawAndPass: (game) => {
    if (game.turnPhase !== TURN_PHASES.CARD) return game;
    const drawn = drawCardsForPlayer(game.players, game.deck, game.discardPile, game.currentPlayerIndex, 1);
    return {
      ...game,
      players: drawn.players,
      deck: drawn.deck,
      discardPile: drawn.discardPile,
      turnPhase: TURN_PHASES.TRADE,
      statusMessage: '카드를 사용하지 않고 매매 턴으로 넘어갑니다.',
    };
  },
  drawAndEndTurn: (game) => {
    if (game.turnPhase !== TURN_PHASES.DRAW) return game;
    const drawn = drawCardsForPlayer(game.players, game.deck, game.discardPile, game.currentPlayerIndex, 1);
    const nextPlayerIndex = findNextTurnOrderPlayerIndex(game, game.currentPlayerIndex);
    return startNextTurn({ ...game, players: drawn.players, deck: drawn.deck, discardPile: drawn.discardPile }, nextPlayerIndex, `${game.players[game.currentPlayerIndex].name}님이 카드를 1장 뽑고 턴을 종료했습니다.`);
  },
};
