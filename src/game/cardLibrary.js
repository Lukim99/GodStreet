import { CARD_TYPES, CATEGORY_LABELS, COUNTER_CARD_EFFECTS } from './constants.js';

const createCardCopies = (count, factory) => Array.from({ length: count }, (_, index) => factory(index + 1));

const describeEffect = (card) => {
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.CIRCUIT_BREAKER) return '주가 조작을 무효화합니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.PREMARKET_SELL) return '주가 조작 효과가 적용되기 직전, 자신의 주식을 전량 매도합니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.PREMARKET_BUY) return '주가 조작 효과가 적용되기 직전, 자신의 현금을 전부 사용해 주식을 매수합니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.HOSTILE_FORCE) return '행동 카드의 주가 조작 방향을 반대로 뒤집습니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.MARGIN_DEPOSIT) return '반대매매 카드의 강제 매도 효과를 방어합니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.AUDIT) return '행동 카드를 무효화하고, 당사자에게 벌금 $500을 부과합니다.';
  if (card.effect.counterType === COUNTER_CARD_EFFECTS.MOMENTUM) return '행동 카드의 방향을 따라 자신도 매매를 진행한 뒤, 해당 수치만큼 주가를 한 번 더 변동시킵니다.\n공격 카드의 방향이 하락인 경우 매도, 상승인 경우 매수합니다.\n매매가 불가능한 경우 건너뛰기합니다.';
  if (card.effect.special === 'margin_call') return '모든 플레이어의 주식을 강제로 전량 매도합니다.';
  if (card.effect.special === 'hostile_ma') return '대상 1명의 보유 주식 10%를 현재가보다 5% 낮은 가격으로, 현금 보유량과 무관하게 강제 매수합니다.';
  if (card.effect.special === 'leverage') return `이번 턴 매수한 수량의 ${card.effect.leverageMultiplier}배만큼 매수합니다. 다음 내 턴 시작 시 레버리지 수량만큼 강제 자동 매도됩니다.`;
  if (card.effect.special === 'dividend') return '즉시 자신이 보유한 주식 1주당 $5의 현금을 획득합니다.';
  if (card.effect.special === 'hedge') return '이번 턴 주가 하락 시, 하락으로 인해 발생한 내 주식 가치 손실분의 50%를 현금으로 보상받습니다.';
  if (card.effect.special === 'blind_fund') return '내 손패에서 1장을 버리고, 덱에서 1장을 새로 뽑습니다.';
  if (card.effect.special === 'inflation') return '즉시 주가가 +5% 변동합니다.\n자신을 제외한 모든 플레이어의 보유 현금을 5% 차감합니다.';
  if (card.effect.market) {
    const market = card.effect.market;
    const symbol = market.direction === 'up' ? '+' : '-';
    if (market.mode === 'fixed') {
      return `주가를 ${symbol}$${market.value} 변동시킵니다.`;
    }
    if (card.effect.globalEffect) {
      const ge = card.effect.globalEffect;
      if (ge.type === 'rate_hike') return `즉시 주가가 -${market.value}% 변동합니다. 다음 자신의 턴까지 매 턴 시작 시 주가가 -1% 변동합니다.`;
      if (ge.type === 'rate_cut') return `즉시 주가가 +${market.value}% 변동합니다. 다음 자신의 턴까지 매 턴 시작 시 주가가 +1% 변동합니다.`;
    }
    if (card.type === CARD_TYPES.BLACK_SWAN && card.effect.buffs && card.effect.buffs.length >= 2) {
      const rBuff = card.effect.buffs.find((b) => b.target === 'riseMultiplier');
      const fBuff = card.effect.buffs.find((b) => b.target === 'fallMultiplier');
      const parts = [];
      if (fBuff) parts.push(`하락 효과 ${(1.0 + fBuff.value).toFixed(1)}배`);
      if (rBuff) parts.push(`상승 효과 ${(1.0 + rBuff.value).toFixed(1)}배`);
      return `즉시 주가가 ${symbol}${market.value}% 변동합니다. 다음 자신의 턴까지 모든 ${parts.join(', ')}가 적용됩니다.`;
    }
    if (card.effect.skipTrade) {
      return `주가가 ${symbol}${market.value}% 변동합니다. 대신 이번 턴 매매를 강제로 건너뜁니다.`;
    }
    if (card.effect.buffs) {
      const buff = card.effect.buffs[0];
      const buffLabel = buff.target === 'riseMultiplier' ? '상승' : '하락';
      return `주가가 ${symbol}${market.value}% 변동합니다. 다음 자신의 턴까지 발생하는 주가 ${buffLabel} 효과가 +0.5배 증가합니다.`;
    }
    return `주가를 ${symbol}${market.value}% 변동시킵니다.`;
  }
  if (card.type === CARD_TYPES.BLACK_SWAN && card.effect.buffs) {
    const rBuff = card.effect.buffs.find((b) => b.target === 'riseMultiplier');
    const fBuff = card.effect.buffs.find((b) => b.target === 'fallMultiplier');
    const parts = [];
    if (fBuff && fBuff.value > 0) parts.push(`하락 효과 ${1.0 + fBuff.value}배`);
    if (fBuff && fBuff.value < 0) parts.push(`하락 효과 ${1.0 + fBuff.value}배`);
    if (rBuff && rBuff.value > 0) parts.push(`상승 효과 ${1.0 + rBuff.value}배`);
    if (rBuff && rBuff.value < 0) parts.push(`상승 효과 ${1.0 + rBuff.value}배`);
    return `다음 자신의 턴까지 ${parts.join(', ')}가 적용됩니다.`;
  }
  return '특수 효과 카드입니다.';
};

export const createCardLibrary = () => {
  const cards = [];

  for (let value = 1; value <= 10; value += 1) {
    cards.push(
      ...createCardCopies(2, (copy) => ({
        id: `attack_rise_percent_${value}_${copy}`,
        name: `주가 +${value}%`,
        type: CARD_TYPES.ATTACK,
        timing: 'card_phase',
        category: 'basic_percent',
        effect: {
          market: { mode: 'percent', direction: 'up', value, multiplierKey: 'riseMultiplier' },
        },
      })),
      ...createCardCopies(2, (copy) => ({
        id: `attack_fall_percent_${value}_${copy}`,
        name: `주가 -${value}%`,
        type: CARD_TYPES.ATTACK,
        timing: 'card_phase',
        category: 'basic_percent',
        effect: {
          market: { mode: 'percent', direction: 'down', value, multiplierKey: 'fallMultiplier' },
        },
      }))
    );
  }

  for (let value = 1; value <= 10; value += 1) {
    cards.push(
      {
        id: `attack_rise_fixed_${value}`,
        name: `주가 +$${value}`,
        type: CARD_TYPES.ATTACK,
        timing: 'card_phase',
        category: 'fixed_amount',
        effect: {
          market: { mode: 'fixed', direction: 'up', value, multiplierKey: 'riseMultiplier' },
        },
      },
      {
        id: `attack_fall_fixed_${value}`,
        name: `주가 -$${value}`,
        type: CARD_TYPES.ATTACK,
        timing: 'card_phase',
        category: 'fixed_amount',
        effect: {
          market: { mode: 'fixed', direction: 'down', value, multiplierKey: 'fallMultiplier' },
        },
      }
    );
  }

  cards.push(
    {
      id: 'attack_margin_call_1',
      name: '반대매매',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: { special: 'margin_call' },
    },
    {
      id: 'attack_short_report_1',
      name: '공매도 리포트',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: {
        market: { mode: 'percent', direction: 'down', value: 20, multiplierKey: 'fallMultiplier' },
        buffs: [{ target: 'riseMultiplier', value: 0.5 }],
      },
    },
    {
      id: 'attack_earning_surprise_1',
      name: '어닝 서프라이즈',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: {
        market: { mode: 'percent', direction: 'up', value: 20, multiplierKey: 'riseMultiplier' },
        buffs: [{ target: 'fallMultiplier', value: 0.5 }],
      },
    },
    ...createCardCopies(2, (copy) => ({
      id: `attack_rights_offering_${copy}`,
      name: '유상증자',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: {
        market: { mode: 'percent', direction: 'down', value: 15, multiplierKey: 'fallMultiplier' },
        skipTrade: true,
      },
    })),
    ...createCardCopies(2, (copy) => ({
      id: `attack_stock_split_${copy}`,
      name: '액면분할',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: {
        market: { mode: 'percent', direction: 'up', value: 15, multiplierKey: 'riseMultiplier' },
        skipTrade: true,
      },
    })),
    ...createCardCopies(2, (copy) => ({
      id: `attack_hostile_ma_${copy}`,
      name: '적대적 M&A',
      type: CARD_TYPES.ATTACK,
      timing: 'card_phase',
      category: 'special_attack',
      effect: { special: 'hostile_ma', targeted: true, sharePercent: 10 },
    }))
  );

  cards.push(
    ...createCardCopies(3, (copy) => ({
      id: `counter_circuit_breaker_${copy}`,
      name: '서킷 브레이커',
      type: CARD_TYPES.COUNTER,
      timing: 'counter_phase',
      category: 'counter',
      effect: { counterType: COUNTER_CARD_EFFECTS.CIRCUIT_BREAKER, onlyForMarketManipulation: true },
    })),
    ...createCardCopies(2, (copy) => ({
      id: `counter_premarket_sell_${copy}`,
      name: '프리마켓 매도',
      type: CARD_TYPES.COUNTER,
      timing: 'counter_phase',
      category: 'counter',
      effect: { counterType: COUNTER_CARD_EFFECTS.PREMARKET_SELL, onlyForMarketManipulation: true },
    })),
    ...createCardCopies(2, (copy) => ({
      id: `counter_premarket_buy_${copy}`,
      name: '프리마켓 매수',
      type: CARD_TYPES.COUNTER,
      timing: 'counter_phase',
      category: 'counter',
      effect: { counterType: COUNTER_CARD_EFFECTS.PREMARKET_BUY, onlyForMarketManipulation: true },
    })),
    { id: 'counter_hostile_force_1', name: '적대 세력', type: CARD_TYPES.COUNTER, timing: 'counter_phase', category: 'counter', effect: { counterType: COUNTER_CARD_EFFECTS.HOSTILE_FORCE, onlyForMarketManipulation: true } },
    { id: 'counter_margin_deposit_1', name: '증거금 납입', type: CARD_TYPES.COUNTER, timing: 'counter_phase', category: 'counter', effect: { counterType: COUNTER_CARD_EFFECTS.MARGIN_DEPOSIT } },
    { id: 'counter_audit_1', name: '회계 감사', type: CARD_TYPES.COUNTER, timing: 'counter_phase', category: 'counter', effect: { counterType: COUNTER_CARD_EFFECTS.AUDIT } },
    { id: 'counter_momentum_1', name: '모멘텀 전략', type: CARD_TYPES.COUNTER, timing: 'counter_phase', category: 'counter', effect: { counterType: COUNTER_CARD_EFFECTS.MOMENTUM, onlyForMarketManipulation: true } }
  );

  for (let multiplier = 2; multiplier <= 5; multiplier += 1) {
    cards.push(
      ...createCardCopies(2, (copy) => ({
        id: `free_leverage_x${multiplier}_${copy}`,
        name: `레버리지 x${multiplier}`,
        type: CARD_TYPES.FREE,
        timing: 'card_phase',
        category: 'free',
        effect: { special: 'leverage', leverageMultiplier: multiplier },
      }))
    );
  }

  cards.push(
    ...createCardCopies(3, (copy) => ({
      id: `free_dividend_${copy}`,
      name: '배당금 지급',
      type: CARD_TYPES.FREE,
      timing: 'card_phase',
      category: 'free',
      effect: { special: 'dividend' },
    })),
    { id: 'free_hedge_1', name: '헷징', type: CARD_TYPES.FREE, timing: 'card_phase', category: 'free', effect: { special: 'hedge' } },
    ...createCardCopies(8, (copy) => ({
      id: `free_blind_fund_${copy}`,
      name: '블라인드 펀드',
      type: CARD_TYPES.FREE,
      timing: 'card_phase',
      category: 'free',
      effect: { special: 'blind_fund' },
    }))
  );

  cards.push(
    { id: 'black_swan_rate_hike_1', name: '금리 인상', type: CARD_TYPES.BLACK_SWAN, timing: 'card_phase', category: 'black_swan', effect: { market: { mode: 'percent', direction: 'down', value: 10, multiplierKey: null }, globalEffect: { type: 'rate_hike', label: '금리 인상', perTurnPercent: -1 } } },
    { id: 'black_swan_rate_cut_1', name: '금리 인하', type: CARD_TYPES.BLACK_SWAN, timing: 'card_phase', category: 'black_swan', effect: { market: { mode: 'percent', direction: 'up', value: 10, multiplierKey: null }, globalEffect: { type: 'rate_cut', label: '금리 인하', perTurnPercent: 1 } } },
    { id: 'black_swan_war_issue_1', name: '전쟁 이슈', type: CARD_TYPES.BLACK_SWAN, timing: 'card_phase', category: 'black_swan', effect: { market: { mode: 'percent', direction: 'down', value: 25, multiplierKey: null }, buffs: [{ target: 'fallMultiplier', value: 0.5 }, { target: 'riseMultiplier', value: -0.5 }] } },
    { id: 'black_swan_quantitative_easing_1', name: '양적 완화', type: CARD_TYPES.BLACK_SWAN, timing: 'card_phase', category: 'black_swan', effect: { market: { mode: 'percent', direction: 'up', value: 25, multiplierKey: null }, buffs: [{ target: 'riseMultiplier', value: 0.5 }, { target: 'fallMultiplier', value: -0.5 }] } },
    { id: 'black_swan_inflation_1', name: '인플레이션', type: CARD_TYPES.BLACK_SWAN, timing: 'card_phase', category: 'black_swan', effect: { market: { mode: 'percent', direction: 'up', value: 5, multiplierKey: null }, special: 'inflation' } }
  );

  return cards.map((card) => ({
    ...card,
    description: describeEffect(card),
    categoryLabel: CATEGORY_LABELS[card.category],
  }));
};

export const CARD_LIBRARY = createCardLibrary();
export const CARD_MAP = Object.fromEntries(CARD_LIBRARY.map((card) => [card.id, card]));
export const CARD_CATEGORY_COUNTS = CARD_LIBRARY.reduce((acc, card) => {
  acc[card.category] = (acc[card.category] || 0) + 1;
  return acc;
}, {});
