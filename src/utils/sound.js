const sounds = {
  buttonClick: '/sounds/button-click.mp3',
  priceUp: '/sounds/price-up.mp3',
  priceDown: '/sounds/price-down.mp3',
  trade: '/sounds/trade.mp3',
};

const audioCache = {};

const loadSound = (key) => {
  if (!audioCache[key]) {
    audioCache[key] = new Audio(sounds[key]);
    audioCache[key].volume = 0.3;
  }
  return audioCache[key];
};

export const playSound = (key) => {
  try {
    const audio = loadSound(key);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Silent fail
  }
};

export const playSoundForPriceChange = (direction) => {
  playSound(direction === 'up' ? 'priceUp' : 'priceDown');
};
