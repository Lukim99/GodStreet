export const TURN_PHASES = {
  CARD: 'CARD',
  COUNTER: 'COUNTER',
  TRADE: 'TRADE',
  DRAW: 'DRAW',
};

export const CARD_TYPES = {
  ATTACK: 'ATTACK',
  COUNTER: 'COUNTER',
  FREE: 'FREE',
  BLACK_SWAN: 'BLACK_SWAN',
};

export const COUNTER_CARD_EFFECTS = {
  CIRCUIT_BREAKER: 'circuit_breaker',
  PREMARKET_SELL: 'premarket_sell',
  PREMARKET_BUY: 'premarket_buy',
  HOSTILE_FORCE: 'hostile_force',
  MARGIN_DEPOSIT: 'margin_deposit',
  AUDIT: 'audit',
  MOMENTUM: 'momentum',
};

export const CATEGORY_LABELS = {
  basic_percent: '기본 조작',
  fixed_amount: '고정 조작',
  special_attack: '특수 공격',
  counter: '카운터',
  free: '프리',
  black_swan: '블랙스완',
};

export const CARD_TYPE_LABELS = {
  [CARD_TYPES.ATTACK]: '행동',
  [CARD_TYPES.COUNTER]: '카운터',
  [CARD_TYPES.FREE]: '프리',
  [CARD_TYPES.BLACK_SWAN]: '블랙스완',
};
