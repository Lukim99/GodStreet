const sounds = {
  buttonClick: '/sounds/button-click.mp3',
  priceUp: '/sounds/price-up.mp3',
  priceDown: '/sounds/price-down.mp3',
  trade: '/sounds/trade.mp3',
  pop: '/sounds/pop.mp3',
  start: '/sounds/start.mp3',
};

const audioCache = {};
let bgmAudio = null;

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

export const playStartSound = () => {
  try {
    const audio = new Audio('/sounds/start.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch {
    // Silent fail
  }
};

export const startBgm = () => {
  try {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio = null;
    }
    bgmAudio = new Audio('/sounds/bgm.mp3');
    bgmAudio.volume = 0.15;
    bgmAudio.loop = true;
    bgmAudio.play().catch(() => {});
  } catch {
    // Silent fail
  }
};

export const stopBgm = () => {
  try {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      bgmAudio = null;
    }
  } catch {
    // Silent fail
  }
};
