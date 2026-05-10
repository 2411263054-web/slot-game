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
const betButtons = Array.from(document.querySelectorAll(".bet-button"));
const reelStrips = [0, 1, 2].map((index) => document.getElementById(`reel-${index}`));
const reelWindows = Array.from(document.querySelectorAll(".reel-window"));

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

function updateBetButtons() {
  betButtons.forEach((button) => {
    const bet = Number(button.dataset.bet);
    button.classList.toggle("is-active", bet === state.currentBet);
    button.disabled = state.isSpinning;
  });
}

function updateActionButtons() {
  spinButton.disabled = state.isSpinning || state.balance < state.currentBet;
  resetButton.disabled = state.isSpinning;
}

function refreshUI() {
  updateStats();
  updateBetButtons();
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

  if (state.balance < state.currentBet) {
    setStatus(`当前积分不足，无法下注 ${state.currentBet} 积分。请重置或切换下注积分。`, "alert");
    updateActionButtons();
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
    state.wins += 1;
    highlightReels(true);
    setStatus(`恭喜你获得 ${reward.amount} 积分`, "win");
  } else {
    setStatus("就差一点点");
  }

  state.isSpinning = false;
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
  setStatus("游戏已重置，选择下注积分后点击“开始旋转”开始游戏。");
  refreshUI();
}

betButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isSpinning) {
      return;
    }

    state.currentBet = Number(button.dataset.bet);
    refreshUI();

    if (state.balance < state.currentBet) {
      setStatus(`当前积分不足以进行 ${state.currentBet} 积分的下注。`, "alert");
    } else {
      setStatus(`已切换到下注 ${state.currentBet} 积分。点击“开始旋转”开始游戏。`);
    }
  });
});

spinButton.addEventListener("click", spin);
resetButton.addEventListener("click", resetGame);
window.addEventListener("resize", () => {
  if (!state.isSpinning) {
    syncReelsToCurrentSymbols();
  }
});

resetGame();
