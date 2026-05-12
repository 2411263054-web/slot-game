const SYMBOLS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ITEM_HEIGHT = () => document.querySelector(".reel-viewport").clientHeight;
const REPEAT_CYCLES = 18;
const INITIAL_BALANCE = 50;
const DEFAULT_BET = 10;

const state = {
  balance: INITIAL_BALANCE,
  currentBet: DEFAULT_BET,
  spins: 0,
  wins: 0,
  isSpinning: false,
  finalSymbols: ["a", "b", "c"]
};

const balanceEl = document.getElementById("balance");
const currentBetEl = document.getElementById("current-bet");
const spinCountEl = document.getElementById("spin-count");
const winCountEl = document.getElementById("win-count");
const statusMessageEl = document.getElementById("status-message");
const spinButton = document.getElementById("spin-button");
const resetButton = document.getElementById("reset-button");
const betInput = document.getElementById("bet-input");
const bgmPlayer = document.getElementById("bgm-player");
const fireworksCanvas = document.getElementById("fireworks-canvas");
const fireworksContext = fireworksCanvas ? fireworksCanvas.getContext("2d") : null;
const reelStrips = [0, 1, 2].map((index) => document.getElementById(`reel-${index}`));
const reelWindows = Array.from(document.querySelectorAll(".reel-window"));
let fireworksParticles = [];
let fireworksAnimationFrame = null;

function startBackgroundMusic() {
  if (!bgmPlayer) {
    return;
  }

  bgmPlayer.volume = 0.5;
  const playAttempt = bgmPlayer.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      const resumePlayback = () => {
        bgmPlayer.play().catch(() => {});
        document.removeEventListener("pointerdown", resumePlayback);
        document.removeEventListener("touchstart", resumePlayback);
        document.removeEventListener("keydown", resumePlayback);
      };

      document.addEventListener("pointerdown", resumePlayback, { once: true });
      document.addEventListener("touchstart", resumePlayback, { once: true });
      document.addEventListener("keydown", resumePlayback, { once: true });
    });
  }
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function createSymbolElement(symbol) {
  const item = document.createElement("div");
  item.className = "symbol";

  const img = document.createElement("img");
  img.src = `./image/${symbol}.png`;
  img.alt = `${symbol.toUpperCase()} 图标`;
  img.draggable = false;

  item.appendChild(img);
  return item;
}

function populateStrip(strip) {
  const fragment = document.createDocumentFragment();

  for (let cycle = 0; cycle < REPEAT_CYCLES; cycle += 1) {
    SYMBOLS.forEach((symbol) => {
      fragment.appendChild(createSymbolElement(symbol));
    });
  }

  strip.innerHTML = "";
  strip.appendChild(fragment);
  strip.style.transition = "none";
  strip.style.transform = "translateY(0)";
}

function setStatus(message, tone = "neutral") {
  statusMessageEl.textContent = message;
  statusMessageEl.classList.remove("is-win", "is-alert");

  if (tone === "win") {
    statusMessageEl.classList.add("is-win");
  }

  if (tone === "alert") {
    statusMessageEl.classList.add("is-alert");
  }
}

function updateStats() {
  balanceEl.textContent = String(state.balance);
  currentBetEl.textContent = String(state.currentBet);
  spinCountEl.textContent = String(state.spins);
  winCountEl.textContent = String(state.wins);
}

function parseBetInput(rawValue) {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return null;
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const wholeValue = Math.floor(numericValue);
  if (wholeValue < 1) {
    return null;
  }

  return wholeValue;
}

function updateActionButtons() {
  spinButton.disabled =
    state.isSpinning ||
    state.balance < 1 ||
    state.currentBet < 1 ||
    state.currentBet > state.balance;
  resetButton.disabled = state.isSpinning;
  betInput.disabled = state.isSpinning;
}

function refreshUI(syncBetInput = false) {
  updateStats();
  betInput.max = String(Math.max(state.balance, 1));
  if (syncBetInput) {
    betInput.value = state.currentBet > 0 ? String(state.currentBet) : "";
  }
  updateActionButtons();
}

function highlightReels(isWinning) {
  reelWindows.forEach((windowEl) => {
    windowEl.classList.toggle("is-winning", isWinning);
  });
}

function syncReelsToCurrentSymbols() {
  reelStrips.forEach((strip, index) => {
    populateStrip(strip);
    const symbolIndex = SYMBOLS.indexOf(state.finalSymbols[index]);
    strip.style.transform = `translateY(-${symbolIndex * ITEM_HEIGHT()}px)`;
  });
}

function evaluateSpin(symbols, bet) {
  const counts = symbols.reduce((map, symbol) => {
    map[symbol] = (map[symbol] || 0) + 1;
    return map;
  }, {});

  const [first, second, third] = symbols;
  const isTriple = first === second && second === third;

  if (isTriple) {
    const triplePayouts = {
      h: 2500,
      g: 1000,
      a: 500,
      f: 200,
      e: 120,
      d: 80,
      c: 30,
      b: 5
    };
    const multiplier = triplePayouts[first];

    if (multiplier) {
      return {
        label: `3 个 ${first.toUpperCase()}`,
        multiplier,
        amount: bet * multiplier
      };
    }
  }

  if (counts.a === 2) {
    return {
      label: "恰好 2 个 A",
      multiplier: 3,
      amount: bet * 3
    };
  }

  if (counts.a === 1) {
    return {
      label: "恰好 1 个 A",
      multiplier: 2,
      amount: bet * 2
    };
  }

  return null;
}

function getSpinTargets(finalSymbols) {
  return finalSymbols.map((symbol, reelIndex) => {
    const extraCycles = 9 + reelIndex * 2 + Math.floor(Math.random() * 2);
    const symbolIndex = SYMBOLS.indexOf(symbol);
    return extraCycles * SYMBOLS.length + symbolIndex;
  });
}

function resizeFireworksCanvas() {
  if (!fireworksCanvas) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  fireworksCanvas.width = Math.floor(window.innerWidth * ratio);
  fireworksCanvas.height = Math.floor(window.innerHeight * ratio);
  fireworksCanvas.style.width = `${window.innerWidth}px`;
  fireworksCanvas.style.height = `${window.innerHeight}px`;

  if (fireworksContext) {
    fireworksContext.setTransform(1, 0, 0, 1, 0, 0);
    fireworksContext.scale(ratio, ratio);
  }
}

function animateFireworks() {
  if (!fireworksContext || !fireworksCanvas) {
    return;
  }

  fireworksContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  fireworksParticles = fireworksParticles.filter((particle) => particle.life > 0);

  fireworksParticles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.05;
    particle.life -= 1;
    particle.alpha = particle.life / particle.maxLife;

    fireworksContext.beginPath();
    fireworksContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    fireworksContext.fillStyle = `hsla(${particle.hue}, 100%, 65%, ${particle.alpha})`;
    fireworksContext.fill();
  });

  if (fireworksParticles.length > 0) {
    fireworksAnimationFrame = window.requestAnimationFrame(animateFireworks);
  } else {
    fireworksAnimationFrame = null;
    fireworksContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

function launchFireworks() {
  if (!fireworksContext) {
    return;
  }

  const bursts = 3;

  for (let burstIndex = 0; burstIndex < bursts; burstIndex += 1) {
    const centerX = window.innerWidth * (0.2 + Math.random() * 0.6);
    const centerY = window.innerHeight * (0.2 + Math.random() * 0.35);
    const hue = 20 + Math.random() * 320;

    for (let index = 0; index < 30; index += 1) {
      const angle = (Math.PI * 2 * index) / 30;
      const speed = 1.8 + Math.random() * 3.2;

      fireworksParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 36 + Math.floor(Math.random() * 18),
        maxLife: 54,
        alpha: 1,
        hue
      });
    }
  }

  if (!fireworksAnimationFrame) {
    fireworksAnimationFrame = window.requestAnimationFrame(animateFireworks);
  }
}

function animateReel(strip, targetIndex, duration) {
  return new Promise((resolve) => {
    populateStrip(strip);
    void strip.offsetHeight;

    const distance = targetIndex * ITEM_HEIGHT();
    strip.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.86, 0.24, 1)`;
    strip.style.transform = `translateY(-${distance}px)`;

    const onTransitionEnd = (event) => {
      if (event.target !== strip) {
        return;
      }

      strip.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };

    strip.addEventListener("transitionend", onTransitionEnd);
  });
}

async function spin() {
  if (state.isSpinning) {
    return;
  }

  const requestedBet = parseBetInput(betInput.value);
  if (requestedBet === null) {
    state.currentBet = 0;
    setStatus("请输入大于 0 的下注积分。", "alert");
    refreshUI();
    return;
  }

  state.currentBet = requestedBet;

  if (state.balance < state.currentBet) {
    setStatus(`下注积分不能超过当前剩余积分 ${state.balance}。`, "alert");
    refreshUI();
    return;
  }

  state.isSpinning = true;
  highlightReels(false);
  state.balance -= state.currentBet;
  state.spins += 1;
  refreshUI();
  setStatus("转轮旋转中，请稍候...");

  const finalSymbols = [randomSymbol(), randomSymbol(), randomSymbol()];
  state.finalSymbols = finalSymbols;
  const targets = getSpinTargets(finalSymbols);
  const durations = [1400, 1850, 2300];

  await Promise.all(
    reelStrips.map((strip, index) => animateReel(strip, targets[index], durations[index]))
  );

  const reward = evaluateSpin(finalSymbols, state.currentBet);

  if (reward) {
    state.balance += reward.amount;
    if (reward.amount > 0) {
      state.wins += 1;
      highlightReels(true);
      setStatus(`恭喜你获得 ${reward.amount} 积分`, "win");
      launchFireworks();
    } else {
      setStatus("就差一点点");
    }
  } else {
    setStatus("就差一点点");
  }

  state.isSpinning = false;
  if (state.balance < 1) {
    setStatus("啊哦，积分用完了。", "alert");
  }
  refreshUI();
}

function resetGame() {
  state.balance = INITIAL_BALANCE;
  state.currentBet = DEFAULT_BET;
  state.spins = 0;
  state.wins = 0;
  state.isSpinning = false;
  state.finalSymbols = [randomSymbol(), randomSymbol(), randomSymbol()];

  syncReelsToCurrentSymbols();
  highlightReels(false);
  setStatus("输入下注积分后点击“开始旋转”开始游戏。");
  refreshUI(true);
}

betInput.addEventListener("input", () => {
  if (state.isSpinning) {
    return;
  }

  const requestedBet = parseBetInput(betInput.value);
  state.currentBet = requestedBet ?? 0;
  refreshUI();

  if (requestedBet === null) {
    setStatus("请输入大于 0 的下注积分。", "alert");
  } else if (requestedBet > state.balance) {
    setStatus(`下注积分不能超过当前剩余积分 ${state.balance}。`, "alert");
  } else {
    setStatus(`已设置本轮下注 ${state.currentBet} 积分。点击“开始旋转”开始游戏。`);
  }
});

spinButton.addEventListener("click", spin);
resetButton.addEventListener("click", resetGame);
window.addEventListener("resize", () => {
  resizeFireworksCanvas();
  if (!state.isSpinning) {
    syncReelsToCurrentSymbols();
  }
});

resizeFireworksCanvas();
startBackgroundMusic();
resetGame();
