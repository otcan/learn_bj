(function () {
  "use strict";

  const STORAGE_KEY = "otcanclaw-blackjack-learner-v1";
  const DEALERS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
  const ACTION_ORDER = ["H", "S", "D", "P"];
  const ACTIONS = {
    H: {
      label: "Hit",
      short: "H",
      className: "action-hit",
      verb: "take another card"
    },
    S: {
      label: "Stand",
      short: "S",
      className: "action-stand",
      verb: "keep the hand"
    },
    D: {
      label: "Double",
      short: "D",
      className: "action-double",
      verb: "double and take one card"
    },
    P: {
      label: "Split",
      short: "P",
      className: "action-split",
      verb: "split into two hands"
    }
  };
  const CARD_DRAWS = [
    { rank: "A", value: 11, probability: 1 / 13 },
    { rank: "2", value: 2, probability: 1 / 13 },
    { rank: "3", value: 3, probability: 1 / 13 },
    { rank: "4", value: 4, probability: 1 / 13 },
    { rank: "5", value: 5, probability: 1 / 13 },
    { rank: "6", value: 6, probability: 1 / 13 },
    { rank: "7", value: 7, probability: 1 / 13 },
    { rank: "8", value: 8, probability: 1 / 13 },
    { rank: "9", value: 9, probability: 1 / 13 },
    { rank: "10", value: 10, probability: 4 / 13 }
  ];
  const COUNT_CHOICES = [1, 0, -1];
  const DEALER_DISTRIBUTION_CACHE = {};

  const DEALER_NOTES = {
    "2": {
      headline: "Dealer shows 2",
      summary: "A 2 is the least scary of the small dealer cards. Stand on many stiff hard totals, double clear value hands, and do not force marginal soft doubles.",
      pressure: "Dealer 2 can still build a good hand, so weak totals often need help."
    },
    "3": {
      headline: "Dealer shows 3",
      summary: "A 3 is a weak upcard. Basic strategy starts adding more doubles while still protecting against stiff totals that are too low.",
      pressure: "Dealer 3 is weak enough that stronger starting hands can press the edge."
    },
    "4": {
      headline: "Dealer shows 4",
      summary: "A 4 is a strong bust card for the dealer. Many hard totals should stand, and more soft totals become doubles.",
      pressure: "Dealer 4 gives the player enough pressure to stand and let the dealer draw into trouble."
    },
    "5": {
      headline: "Dealer shows 5",
      summary: "A 5 is one of the dealer's worst upcards. This is where doubling and standing become especially important.",
      pressure: "Dealer 5 is a high-pressure bust card, so value hands should collect more money."
    },
    "6": {
      headline: "Dealer shows 6",
      summary: "A 6 is the dealer's weakest upcard in this ruleset. Stand with stiffs and double many soft starts.",
      pressure: "Dealer 6 creates the most bust pressure, so the player should avoid unnecessary hits."
    },
    "7": {
      headline: "Dealer shows 7",
      summary: "A 7 is no longer a weak dealer card. Made hands can stand, but stiff totals need to improve.",
      pressure: "Dealer 7 can easily reach 17, so weak totals usually need another card."
    },
    "8": {
      headline: "Dealer shows 8",
      summary: "An 8 is a solid dealer start. The player keeps strong totals and hits most weak or stiff hands.",
      pressure: "Dealer 8 is strong enough that standing on weak totals loses too often."
    },
    "9": {
      headline: "Dealer shows 9",
      summary: "A 9 is a strong dealer card. The player doubles only premium starts and hits many hands that would stand against 2 through 6.",
      pressure: "Dealer 9 threatens a strong final total, so the player needs more strength."
    },
    "10": {
      headline: "Dealer shows 10",
      summary: "A 10 is very strong. Avoid weak doubles, hit stiffs, and split only pairs with clear long-run value.",
      pressure: "Dealer 10 is likely to make a made hand, so passive weak totals are expensive."
    },
    "A": {
      headline: "Dealer shows Ace",
      summary: "An Ace is the dealer's strongest upcard. This S17 chart is conservative with doubles into an Ace.",
      pressure: "Dealer Ace threatens blackjack and strong totals, so the player needs disciplined improvement."
    }
  };

  function table(defaultAction, overrides) {
    const row = {};
    DEALERS.forEach(function (dealer) {
      row[dealer] = defaultAction;
    });
    Object.keys(overrides || {}).forEach(function (action) {
      overrides[action].forEach(function (dealer) {
        row[dealer] = action;
      });
    });
    return row;
  }

  const HARD_ROWS = [
    {
      id: "hard-5-8",
      label: "Hard 5-8",
      cards: ["5", "3"],
      actions: table("H"),
      why: "Small hard totals cannot win often enough by standing."
    },
    {
      id: "hard-9",
      label: "Hard 9",
      cards: ["4", "5"],
      actions: table("H", { D: ["3", "4", "5", "6"] }),
      why: "Hard 9 doubles only when the dealer is weak enough."
    },
    {
      id: "hard-10",
      label: "Hard 10",
      cards: ["6", "4"],
      actions: table("H", { D: ["2", "3", "4", "5", "6", "7", "8", "9"] }),
      why: "Hard 10 has strong one-card upside unless the dealer starts with 10 or Ace."
    },
    {
      id: "hard-11",
      label: "Hard 11",
      cards: ["6", "5"],
      actions: table("D", { H: ["A"] }),
      why: "Hard 11 is the best doubling total, but S17 multi-deck strategy does not double it into Ace."
    },
    {
      id: "hard-12",
      label: "Hard 12",
      cards: ["10", "2"],
      actions: table("H", { S: ["4", "5", "6"] }),
      why: "Hard 12 is weak, but hitting is usually safer than waiting. Stand only against dealer 4-6, where dealer bust pressure is high."
    },
    {
      id: "hard-13-16",
      label: "Hard 13-16",
      cards: ["10", "6"],
      actions: table("H", { S: ["2", "3", "4", "5", "6"] }),
      why: "Stiff totals stand against small dealer cards and hit against stronger ones."
    },
    {
      id: "hard-17-plus",
      label: "Hard 17+",
      cards: ["10", "7"],
      actions: table("S"),
      why: "Seventeen or better is already a made hand."
    }
  ];

  const SOFT_ROWS = [
    {
      id: "soft-13-14",
      label: "Soft 13-14",
      cards: ["A", "3"],
      actions: table("H", { D: ["5", "6"] }),
      why: "Small soft totals can improve safely, but only double against the weakest upcards."
    },
    {
      id: "soft-15-16",
      label: "Soft 15-16",
      cards: ["A", "5"],
      actions: table("H", { D: ["4", "5", "6"] }),
      why: "Soft 15 and 16 add doubles as dealer bust pressure improves."
    },
    {
      id: "soft-17",
      label: "Soft 17",
      cards: ["A", "6"],
      actions: table("H", { D: ["3", "4", "5", "6"] }),
      why: "Soft 17 is not strong enough to stand, so it either improves or doubles into weakness."
    },
    {
      id: "soft-18",
      label: "Soft 18",
      cards: ["A", "7"],
      actions: table("H", { S: ["2", "7", "8"], D: ["3", "4", "5", "6"] }),
      why: "Soft 18 changes shape by dealer card: stand against middling cards, double into weakness, hit into strength."
    },
    {
      id: "soft-19-plus",
      label: "Soft 19+",
      cards: ["A", "8"],
      actions: table("S"),
      why: "Soft 19 or better is strong enough to keep in this S17 ruleset."
    }
  ];

  const PAIR_ROWS = [
    {
      id: "pair-aa",
      label: "A,A",
      cards: ["A", "A"],
      actions: table("P"),
      why: "Two aces are far stronger as two starting hands than as soft 12."
    },
    {
      id: "pair-10",
      label: "10,10",
      cards: ["10", "K"],
      actions: table("S"),
      why: "Twenty is already too strong to break apart."
    },
    {
      id: "pair-9",
      label: "9,9",
      cards: ["9", "9"],
      actions: table("S", { P: ["2", "3", "4", "5", "6", "8", "9"] }),
      why: "Nines split into weak and middling dealer cards, but keep 18 against 7, 10, or Ace."
    },
    {
      id: "pair-8",
      label: "8,8",
      cards: ["8", "8"],
      actions: table("P"),
      why: "Splitting escapes hard 16 and gives each 8 a better chance to improve."
    },
    {
      id: "pair-7",
      label: "7,7",
      cards: ["7", "7"],
      actions: table("H", { P: ["2", "3", "4", "5", "6", "7"] }),
      why: "Sevens split while the dealer is not too strong; otherwise hard 14 needs help."
    },
    {
      id: "pair-6",
      label: "6,6",
      cards: ["6", "6"],
      actions: table("H", { P: ["2", "3", "4", "5", "6"] }),
      why: "Sixes split into small dealer cards when double after split is available."
    },
    {
      id: "pair-5",
      label: "5,5",
      cards: ["5", "5"],
      actions: table("H", { D: ["2", "3", "4", "5", "6", "7", "8", "9"] }),
      why: "A pair of fives is played as hard 10; splitting would create two weak starts."
    },
    {
      id: "pair-4",
      label: "4,4",
      cards: ["4", "4"],
      actions: table("H", { P: ["5", "6"] }),
      why: "Fours split only into the dealer's weakest cards with double after split available."
    },
    {
      id: "pair-2-3",
      label: "2,2 or 3,3",
      cards: ["3", "3"],
      actions: table("H", { P: ["2", "3", "4", "5", "6", "7"] }),
      why: "Small pairs split while the dealer is weak enough for the new hands to develop."
    }
  ];

  const ROW_GROUPS = {
    hard: HARD_ROWS,
    soft: SOFT_ROWS,
    pair: PAIR_ROWS
  };
  const LESSON_ROWS = HARD_ROWS.concat(SOFT_ROWS, PAIR_ROWS);
  const CHART_SECTIONS = [
    {
      key: "hard",
      title: "Hard Totals",
      subtitle: "Hands without a flexible ace."
    },
    {
      key: "soft",
      title: "Soft Totals",
      subtitle: "Hands where an ace can count as 11."
    },
    {
      key: "pair",
      title: "Pairs",
      subtitle: "Two equal ranks before any hit."
    }
  ];

  const QUIZ_ROWS = [
    { type: "hard", id: "hard-12" },
    { type: "hard", id: "hard-13-16" },
    { type: "soft", id: "soft-18" },
    { type: "pair", id: "pair-8" }
  ];
  const PRACTICE_CARD_OPTIONS = {
    "hard-5-8": [["3", "2"], ["4", "2"], ["5", "2"], ["5", "3"]],
    "hard-13-16": [["10", "3"], ["10", "4"], ["10", "5"], ["10", "6"]],
    "hard-17-plus": [["10", "7"], ["10", "8"], ["10", "9"], ["10", "10"]],
    "soft-13-14": [["A", "2"], ["A", "3"]],
    "soft-15-16": [["A", "4"], ["A", "5"]],
    "soft-19-plus": [["A", "8"], ["A", "9"]],
    "pair-10": [["10", "10"], ["J", "J"], ["Q", "Q"], ["K", "K"]],
    "pair-2-3": [["2", "2"], ["3", "3"]]
  };

  const SUITS = ["S", "H", "D", "C"];
  const COUNT_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const app = document.getElementById("app");
  const tabButtons = Array.from(document.querySelectorAll(".tab"));

  const state = {
    activeTab: "learn",
    selectedDealer: "2",
    quizAnswers: {},
    quizSubmitted: false,
    practiceScenario: null,
    practiceFeedback: null,
    countingMode: "value",
    countingValueCard: null,
    countingValueFeedback: null,
    countingSequence: null,
    countingSequenceAnswer: "",
    countingSequenceFeedback: null,
    countingDeck: null,
    countingDeckIndex: 0,
    countingDeckUserCount: 0,
    countingDeckExpectedCount: 0,
    countingDeckLast: null,
    progress: loadProgress()
  };

  state.selectedDealer = state.progress.currentDealer || "2";

  function applyRouteFromHash() {
    const route = window.location.hash.replace(/^#\/?/, "");
    const parts = route.split("/").filter(Boolean);
    const first = parts[0];

    if (!first) {
      return false;
    }

    if (first === "learn") {
      state.activeTab = "learn";
      if (DEALERS.includes(parts[1])) {
        state.selectedDealer = parts[1];
      }
      return true;
    }

    if (first === "practice") {
      state.activeTab = "practice";
      state.practiceScenario = makePracticeScenario();
      return true;
    }

    if (first === "counting") {
      state.activeTab = "counting";
      return true;
    }

    if (first === "chart") {
      state.activeTab = "chart";
      return true;
    }

    return false;
  }

  function routeForState() {
    if (state.activeTab === "learn") {
      return "#/learn/" + state.selectedDealer;
    }
    if (state.activeTab === "chart") {
      return "#/chart";
    }
    if (state.activeTab === "counting") {
      return "#/counting";
    }
    return "#/practice";
  }

  function syncUrl(replace) {
    const route = routeForState();
    if (window.location.hash === route) {
      return;
    }
    if (replace) {
      window.history.replaceState(null, "", route);
      return;
    }
    window.history.pushState(null, "", route);
  }

  function loadProgress() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultProgress();
      }
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      return Object.assign(defaultProgress(), parsed, {
        stats: Object.assign(base.stats, parsed.stats || {}),
        counting: Object.assign(base.counting, parsed.counting || {}),
        quizScores: Object.assign({}, parsed.quizScores || {})
      });
    } catch (error) {
      return defaultProgress();
    }
  }

  function defaultProgress() {
    return {
      currentDealer: "2",
      completedDealers: [],
      quizScores: {},
      stats: {
        attempts: 0,
        correct: 0
      },
      counting: {
        attempts: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
        decksCompleted: 0
      }
    };
  }

  function saveProgress() {
    state.progress.currentDealer = state.selectedDealer;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function dealerIndex(dealer) {
    return DEALERS.indexOf(dealer);
  }

  function isComplete(dealer) {
    return state.progress.completedDealers.includes(dealer);
  }

  function isUnlocked(dealer) {
    return DEALERS.includes(dealer);
  }

  function nextDealer(dealer) {
    const next = DEALERS[dealerIndex(dealer) + 1];
    return next || null;
  }

  function findRow(type, id) {
    return ROW_GROUPS[type].find(function (row) {
      return row.id === id;
    });
  }

  function actionFor(row, dealer) {
    return row.actions[dealer];
  }

  function describeAction(action) {
    return ACTIONS[action].label;
  }

  function randomPracticeCards(row) {
    const options = PRACTICE_CARD_OPTIONS[row.id] || [row.cards];
    const cards = options[Math.floor(Math.random() * options.length)];
    return cards.slice();
  }

  function exactHandLabel(cards, type) {
    if (type === "pair") {
      return cards[0] + "," + cards[1];
    }

    const hand = handState(cards);
    const labelType = hand.softAces > 0 ? "Soft" : "Hard";
    return labelType + " " + hand.total;
  }

  function explain(row, dealer) {
    const action = actionFor(row, dealer);
    return row.why + " " + DEALER_NOTES[dealer].pressure + " Basic strategy says to " + ACTIONS[action].verb + ".";
  }

  function cardValue(rank) {
    return rank === "A" ? 11 : Math.min(parseInt(rank, 10) || 10, 10);
  }

  function handState(cards) {
    const state = cards.reduce(function (nextState, rank) {
      const isAce = rank === "A";
      nextState.total += isAce ? 11 : cardValue(rank);
      nextState.softAces += isAce ? 1 : 0;
      return normalizeHand(nextState);
    }, { total: 0, softAces: 0 });
    return state;
  }

  function normalizeHand(state) {
    while (state.total > 21 && state.softAces > 0) {
      state.total -= 10;
      state.softAces -= 1;
    }
    return state;
  }

  function addToDistribution(target, source, weight) {
    Object.keys(source).forEach(function (key) {
      target[key] = (target[key] || 0) + source[key] * weight;
    });
  }

  function dealerDistribution(dealer) {
    if (DEALER_DISTRIBUTION_CACHE[dealer]) {
      return DEALER_DISTRIBUTION_CACHE[dealer];
    }
    const state = handState([dealer]);
    const distribution = dealerDrawDistribution(state.total, state.softAces);
    DEALER_DISTRIBUTION_CACHE[dealer] = distribution;
    return distribution;
  }

  function dealerDrawDistribution(total, softAces) {
    const cacheKey = total + ":" + softAces;
    if (DEALER_DISTRIBUTION_CACHE[cacheKey]) {
      return DEALER_DISTRIBUTION_CACHE[cacheKey];
    }
    if (total > 21) {
      return { bust: 1 };
    }
    if (total >= 17) {
      const stood = {};
      stood[total] = 1;
      return stood;
    }

    const distribution = {};
    CARD_DRAWS.forEach(function (draw) {
      const next = normalizeHand({
        total: total + draw.value,
        softAces: softAces + (draw.rank === "A" ? 1 : 0)
      });
      addToDistribution(distribution, dealerDrawDistribution(next.total, next.softAces), draw.probability);
    });
    DEALER_DISTRIBUTION_CACHE[cacheKey] = distribution;
    return distribution;
  }

  function dealerStats(dealer) {
    const distribution = dealerDistribution(dealer);
    const bust = distribution.bust || 0;
    let expectedScore = 0;
    let madeWeightedScore = 0;
    [17, 18, 19, 20, 21].forEach(function (total) {
      const probability = distribution[total] || 0;
      expectedScore += total * probability;
      madeWeightedScore += total * probability;
    });
    return {
      bust: bust,
      expectedScore: expectedScore,
      madeAverage: (1 - bust) > 0 ? madeWeightedScore / (1 - bust) : 0
    };
  }

  function standOutcome(row, dealer) {
    return standOutcomeForState(handState(row.cards), dealer);
  }

  function standOutcomeForState(player, dealer) {
    const distribution = dealerDistribution(dealer);
    const outcome = {
      total: player.total,
      soft: player.softAces > 0,
      win: 0,
      push: 0,
      lose: 0
    };

    if (player.total > 21) {
      outcome.lose = 1;
      return outcome;
    }

    outcome.win += distribution.bust || 0;
    [17, 18, 19, 20, 21].forEach(function (dealerTotal) {
      const probability = distribution[dealerTotal] || 0;
      if (player.total > dealerTotal) {
        outcome.win += probability;
      } else if (player.total === dealerTotal) {
        outcome.push += probability;
      } else {
        outcome.lose += probability;
      }
    });
    return outcome;
  }

  function hitOnceOutcome(row, dealer) {
    const player = handState(row.cards);
    const outcome = {
      win: 0,
      push: 0,
      lose: 0
    };

    CARD_DRAWS.forEach(function (draw) {
      const next = normalizeHand({
        total: player.total + draw.value,
        softAces: player.softAces + (draw.rank === "A" ? 1 : 0)
      });
      const nextOutcome = next.total > 21 ? { win: 0, push: 0, lose: 1 } : standOutcomeForState(next, dealer);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function optimalHitStandOutcome(row, dealer) {
    return bestHitStandOutcome(handState(row.cards), dealer, {});
  }

  function overallOptimalOutcome(dealer) {
    const total = LESSON_ROWS.reduce(function (summary, row) {
      const outcome = optimalHitStandOutcome(row, dealer);
      summary.win += outcome.win;
      summary.push += outcome.push;
      summary.lose += outcome.lose;
      return summary;
    }, { win: 0, push: 0, lose: 0 });

    return {
      win: total.win / LESSON_ROWS.length,
      push: total.push / LESSON_ROWS.length,
      lose: total.lose / LESSON_ROWS.length
    };
  }

  function bestHitStandOutcome(player, dealer, memo) {
    if (player.total > 21) {
      return { win: 0, push: 0, lose: 1 };
    }

    const key = dealer + ":" + player.total + ":" + player.softAces;
    if (memo[key]) {
      return memo[key];
    }

    const stand = standOutcomeForState(player, dealer);
    const hit = hitBestOutcomeForState(player, dealer, memo);
    const best = outcomeScore(hit) > outcomeScore(stand) ? hit : stand;
    memo[key] = best;
    return best;
  }

  function hitBestOutcomeForState(player, dealer, memo) {
    const outcome = {
      win: 0,
      push: 0,
      lose: 0
    };

    CARD_DRAWS.forEach(function (draw) {
      const next = normalizeHand({
        total: player.total + draw.value,
        softAces: player.softAces + (draw.rank === "A" ? 1 : 0)
      });
      const nextOutcome = bestHitStandOutcome(next, dealer, memo);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function outcomeScore(outcome) {
    return outcome.win - outcome.lose;
  }

  function formatPercent(value) {
    return Math.round(value * 1000) / 10 + "%";
  }

  function formatScore(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function hiLoValue(rank) {
    if (["2", "3", "4", "5", "6"].includes(rank)) {
      return 1;
    }
    if (["7", "8", "9"].includes(rank)) {
      return 0;
    }
    return -1;
  }

  function formatCount(value) {
    if (value > 0) {
      return "+" + value;
    }
    return String(value);
  }

  function randomSuit() {
    return SUITS[Math.floor(Math.random() * SUITS.length)];
  }

  function randomCountCard() {
    const rank = COUNT_RANKS[Math.floor(Math.random() * COUNT_RANKS.length)];
    return { rank: rank, suit: randomSuit() };
  }

  function makeCountSequence(length) {
    const sequence = [];
    for (let index = 0; index < length; index += 1) {
      sequence.push(randomCountCard());
    }
    return sequence;
  }

  function countSequenceTotal(sequence) {
    return sequence.reduce(function (total, card) {
      return total + hiLoValue(card.rank);
    }, 0);
  }

  function makeCountDeck() {
    const deck = [];
    COUNT_RANKS.forEach(function (rank) {
      SUITS.forEach(function (suit) {
        deck.push({ rank: rank, suit: suit });
      });
    });
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const card = deck[index];
      deck[index] = deck[swapIndex];
      deck[swapIndex] = card;
    }
    return deck;
  }

  function resetCountingValueCard() {
    state.countingValueCard = randomCountCard();
    state.countingValueFeedback = null;
  }

  function resetCountingSequence() {
    state.countingSequence = makeCountSequence(8);
    state.countingSequenceAnswer = "";
    state.countingSequenceFeedback = null;
  }

  function resetCountingDeck() {
    state.countingDeck = makeCountDeck();
    state.countingDeckIndex = 0;
    state.countingDeckUserCount = 0;
    state.countingDeckExpectedCount = 0;
    state.countingDeckLast = null;
  }

  function ensureCountingState() {
    if (!state.countingValueCard) {
      resetCountingValueCard();
    }
    if (!state.countingSequence) {
      resetCountingSequence();
    }
    if (!state.countingDeck) {
      resetCountingDeck();
    }
  }

  function recordCountingResult(isCorrect) {
    const counting = state.progress.counting;
    counting.attempts += 1;
    if (isCorrect) {
      counting.correct += 1;
      counting.streak += 1;
      counting.bestStreak = Math.max(counting.bestStreak, counting.streak);
    } else {
      counting.streak = 0;
    }
    saveProgress();
  }

  function render() {
    tabButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.tab === state.activeTab);
    });

    if (state.activeTab === "learn") {
      renderLearn();
      return;
    }
    if (state.activeTab === "practice") {
      renderPractice();
      return;
    }
    if (state.activeTab === "counting") {
      renderCounting();
      return;
    }
    renderChart();
  }

  function renderShell(content) {
    app.innerHTML = [
      '<div class="dashboard-grid">',
      renderSidePanel(),
      '<div>',
      content,
      '</div>',
      '</div>'
    ].join("");
  }

  function renderSidePanel() {
    const completed = state.progress.completedDealers.length;
    const attempts = state.progress.stats.attempts;
    const accuracy = attempts ? Math.round((state.progress.stats.correct / attempts) * 100) : 0;

    return [
      '<aside class="side-panel">',
      '<div class="panel-header">',
      '<div><h2>Dealer Upcards</h2><p class="muted">Study any dealer card from 2 through Ace.</p></div>',
      '</div>',
      '<div class="dealer-list">',
      DEALERS.map(renderDealerButton).join(""),
      '</div>',
      '<div class="stat-grid">',
      '<div class="stat"><strong>' + completed + '/' + DEALERS.length + '</strong><span>Lessons reviewed</span></div>',
      '<div class="stat"><strong>' + accuracy + '%</strong><span>Practice accuracy</span></div>',
      '</div>',
      '<div class="controls-row">',
      '<button class="danger-button" type="button" data-action="reset-progress">Reset progress</button>',
      '</div>',
      '</aside>'
    ].join("");
  }

  function renderDealerButton(dealer) {
    const locked = !isUnlocked(dealer);
    const classes = ["dealer-button"];
    if (dealer === state.selectedDealer) {
      classes.push("active");
    }
    if (isComplete(dealer)) {
      classes.push("complete");
    }
    if (locked) {
      classes.push("locked");
    }
    return [
      '<button class="' + classes.join(" ") + '" type="button" data-dealer="' + dealer + '" ' + (locked ? "disabled" : "") + '>',
      dealer,
      '</button>'
    ].join("");
  }

  function renderLearn() {
    const dealer = state.selectedDealer;
    const note = DEALER_NOTES[dealer];
    const score = state.progress.quizScores[dealer];
    const next = nextDealer(dealer);

    renderShell([
      '<section class="content-panel">',
      '<div class="hero-band">',
      '<div class="hero-copy">',
      '<h2>' + note.headline + '</h2>',
      '<p>' + note.summary + '</p>',
      score ? '<p class="muted">Best quiz score: ' + score + '/4</p>' : "",
      renderDealerMathStrip(dealer),
      '</div>',
      '<div class="felt-table" aria-hidden="true">',
      '<div class="dealer-card">' + dealer + '</div>',
      '</div>',
      '</div>',
      renderBasicsSection(),
      renderLessonSection("Hard Totals", "Hands without a flexible ace.", HARD_ROWS, dealer),
      renderLessonSection("Soft Totals", "Hands where an ace can count as 11.", SOFT_ROWS, dealer),
      renderLessonSection("Pairs", "Two equal ranks before any hit.", PAIR_ROWS, dealer),
      renderQuiz(dealer),
      '<div class="section">',
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="complete-lesson" ' + (!state.quizSubmitted ? "disabled" : "") + '>Mark dealer ' + dealer + ' reviewed</button>',
      next ? '<button class="secondary-button" type="button" data-action="next-dealer">Next dealer: ' + next + '</button>' : "",
      '</div>',
      !state.quizSubmitted ? '<p class="muted">Finish the quick check to mark this dealer lesson as reviewed.</p>' : "",
      '</div>',
      '</section>'
    ].join(""));
  }

  function renderDealerMathStrip(dealer) {
    const dealerMath = dealerStats(dealer);
    const overall = overallOptimalOutcome(dealer);
    return [
      '<div class="dealer-math-strip">',
      renderHeaderMetric("Dealer goes over 21", formatPercent(dealerMath.bust)),
      renderHeaderMetric("Dealer average final total", formatScore(dealerMath.expectedScore)),
      renderHeaderMetric("Dealer average when not bust", formatScore(dealerMath.madeAverage)),
      '</div>',
      '<div class="overall-chance">',
      '<div class="overall-copy">',
      '<span>Overall chance</span>',
      '<strong>Using optimal strategy</strong>',
      '<p>Average result across the lesson hands shown below.</p>',
      '</div>',
      '<div class="overall-metrics">',
      renderHeaderMetric("Win", formatPercent(overall.win)),
      renderHeaderMetric("Tie", formatPercent(overall.push)),
      renderHeaderMetric("Lose", formatPercent(overall.lose)),
      '</div>',
      '</div>',
      '<p class="math-note">A bust counts as 0 in the average final total. The not-bust average only looks at dealer hands from 17 to 21.</p>'
    ].join("");
  }

  function renderHeaderMetric(label, value) {
    return [
      '<div class="header-metric">',
      '<span>' + label + '</span>',
      '<strong>' + value + '</strong>',
      '</div>'
    ].join("");
  }

  function renderBasicsSection() {
    return [
      '<section class="section basics-section">',
      '<div class="section-heading">',
      '<h3>Game Basics</h3>',
      '<p class="section-subtitle">The minimum rules behind every strategy choice.</p>',
      '</div>',
      '<div class="basics-grid">',
      renderBasicItem("Goal", "Get closer to 21 than the dealer without going over. Going over 21 busts immediately."),
      renderBasicItem("Card values", "Number cards keep their value, face cards count as 10, and an ace counts as 11 or 1."),
      renderBasicItem("Turn order", "The player acts first. The dealer then draws until 17 and stands on soft 17 in this trainer."),
      renderBasicItem("Main actions", "Hit takes a card, stand keeps the total, double adds one final card, and split separates a pair."),
      renderBasicItem("Tie", "A tie means your total equals the dealer total. You keep your bet; it is not a win or a loss. Casino players often call this a push."),
      '</div>',
      '</section>'
    ].join("");
  }

  function renderBasicItem(title, copy) {
    return [
      '<article class="basic-item">',
      '<strong>' + title + '</strong>',
      '<p>' + copy + '</p>',
      '</article>'
    ].join("");
  }

  function renderLessonSection(title, subtitle, rows, dealer) {
    return [
      '<section class="section">',
      '<div class="section-heading">',
      '<h3>' + title + '</h3>',
      '<p class="section-subtitle">' + subtitle + '</p>',
      '</div>',
      '<div class="lesson-grid">',
      rows.map(function (row) {
        return renderLessonCard(row, dealer);
      }).join(""),
      '</div>',
      '</section>'
    ].join("");
  }

  function renderLessonCard(row, dealer) {
    const action = actionFor(row, dealer);
    return [
      '<article class="lesson-card">',
      '<div class="lesson-title">',
      '<strong>' + row.label + '</strong>',
      renderActionPill(action),
      '</div>',
      '<p>' + explain(row, dealer) + '</p>',
      renderMathPanel(row, dealer),
      '</article>'
    ].join("");
  }

  function renderMathPanel(row, dealer) {
    const stand = standOutcome(row, dealer);
    const hit = hitOnceOutcome(row, dealer);
    const optimal = optimalHitStandOutcome(row, dealer);
    return [
      '<div class="math-panel">',
      renderOutcomeTable(stand, hit, optimal),
      '<p class="math-note">Hit once stops after one card. Optimal strategy keeps choosing the better hit-or-stand path after each card. All values are percentages.</p>',
      '</div>'
    ].join("");
  }

  function renderOutcomeTable(stand, hit, optimal) {
    return [
      '<div class="outcome-table" aria-label="Outcome comparison">',
      '<div class="outcome-head">Choice</div>',
      '<div class="outcome-head">Win</div>',
      '<div class="outcome-head">Tie</div>',
      '<div class="outcome-head">Lose</div>',
      renderOutcomeRow("Stand", stand),
      renderOutcomeRow("Hit once", hit),
      renderOutcomeRow("Optimal strategy", optimal),
      '</div>'
    ].join("");
  }

  function renderOutcomeRow(label, outcome) {
    return [
      '<div class="outcome-label">' + label + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.win) + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.push) + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.lose) + '</div>'
    ].join("");
  }

  function renderActionPill(action) {
    return '<span class="action-pill ' + ACTIONS[action].className + '">' + ACTIONS[action].label + '</span>';
  }

  function renderQuiz(dealer) {
    const score = quizScore(dealer);
    const submitted = state.quizSubmitted;
    return [
      '<section class="section">',
      '<div class="section-heading">',
      '<h3>Quick Check</h3>',
      '<p class="section-subtitle">' + (submitted ? "Score: " + score + "/4" : "Four decisions for dealer " + dealer + ".") + '</p>',
      '</div>',
      '<div class="quiz-grid">',
      QUIZ_ROWS.map(function (item, index) {
        return renderQuizItem(item, index, dealer);
      }).join(""),
      '</div>',
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="grade-quiz">Grade quick check</button>',
      '<button class="secondary-button" type="button" data-action="clear-quiz">Clear answers</button>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderQuizItem(item, index, dealer) {
    const row = findRow(item.type, item.id);
    const selected = state.quizAnswers[index];
    const correct = actionFor(row, dealer);
    const submitted = state.quizSubmitted;

    return [
      '<article class="quiz-item">',
      '<strong>' + exactHandLabel(row.cards, item.type) + ' vs dealer ' + dealer + '</strong>',
      '<div class="hand-line">',
      renderCardRow(row.cards),
      '<span class="muted">Dealer ' + dealer + '</span>',
      '</div>',
      '<div class="action-row">',
      ACTION_ORDER.map(function (action) {
        const classes = ["action-button"];
        if (selected === action) {
          classes.push("selected");
        }
        if (submitted && action === correct) {
          classes.push("correct");
        }
        if (submitted && selected === action && selected !== correct) {
          classes.push("incorrect");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-quiz-index="' + index + '" data-answer="' + action + '">' + ACTIONS[action].label + '</button>';
      }).join(""),
      '</div>',
      submitted ? '<p class="muted">Correct: ' + describeAction(correct) + '. ' + explain(row, dealer) + '</p>' : "",
      '</article>'
    ].join("");
  }

  function quizScore(dealer) {
    return QUIZ_ROWS.reduce(function (score, item, index) {
      const row = findRow(item.type, item.id);
      return score + (state.quizAnswers[index] === actionFor(row, dealer) ? 1 : 0);
    }, 0);
  }

  function renderPractice() {
    if (!state.practiceScenario) {
      state.practiceScenario = makePracticeScenario();
    }

    const scenario = state.practiceScenario;
    const attempts = state.progress.stats.attempts;
    const correct = state.progress.stats.correct;
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

    app.innerHTML = [
      '<div class="practice-layout">',
      '<section class="practice-panel">',
      '<div class="panel-header">',
      '<div><h2>Practice</h2><p class="muted">Current dealer set: ' + practiceDealers().join(", ") + '</p></div>',
      '<button class="secondary-button" type="button" data-action="new-hand">New hand</button>',
      '</div>',
      '<div class="practice-card">',
      '<p class="muted">' + scenario.kindLabel + '</p>',
      '<h2>' + scenario.handLabel + ' vs dealer ' + scenario.dealer + '</h2>',
      renderPracticeHands(scenario),
      '<div class="action-row">',
      ACTION_ORDER.map(function (action) {
        return '<button class="action-button" type="button" data-practice-answer="' + action + '">' + ACTIONS[action].label + '</button>';
      }).join(""),
      '</div>',
      renderPracticeFeedback(),
      '</div>',
      '</section>',
      '<aside class="summary-strip">',
      '<div class="stat"><strong>' + attempts + '</strong><span>Practice hands</span></div>',
      '<div class="stat"><strong>' + correct + '</strong><span>Correct answers</span></div>',
      '<div class="stat"><strong>' + accuracy + '%</strong><span>Accuracy</span></div>',
      '<button class="secondary-button" type="button" data-tab-jump="learn">Back to lessons</button>',
      '</aside>',
      '</div>'
    ].join("");
  }

  function renderPracticeHands(scenario) {
    return [
      '<div class="practice-hands">',
      '<div class="practice-hand-row">',
      '<span class="hand-label">Your hand</span>',
      renderCardRow(scenario.cards),
      '</div>',
      '<div class="practice-hand-row">',
      '<span class="hand-label">Dealer hand</span>',
      '<div class="card-row">',
      renderPlayingCard(scenario.dealer, "H"),
      renderHiddenCard(),
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function renderPracticeFeedback() {
    const feedback = state.practiceFeedback;
    if (!feedback) {
      return "";
    }
    const tone = feedback.correct ? "good" : "bad";
    return [
      '<div class="feedback ' + tone + '">',
      '<strong>' + (feedback.correct ? "Correct" : "Not this time") + '</strong>',
      '<p>The play is ' + describeAction(feedback.action) + '. ' + feedback.explanation + '</p>',
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="new-hand">Next hand</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function practiceDealers() {
    return DEALERS.slice();
  }

  function makePracticeScenario() {
    const dealers = practiceDealers();
    const dealer = dealers[Math.floor(Math.random() * dealers.length)];
    const typeNames = ["hard", "soft", "pair"];
    const type = typeNames[Math.floor(Math.random() * typeNames.length)];
    const rows = ROW_GROUPS[type];
    const row = rows[Math.floor(Math.random() * rows.length)];
    const cards = randomPracticeCards(row);
    return {
      dealer: dealer,
      type: type,
      kindLabel: type === "pair" ? "Pair decision" : type.charAt(0).toUpperCase() + type.slice(1) + " total",
      cards: cards,
      handLabel: exactHandLabel(cards, type),
      row: row
    };
  }

  function renderCounting() {
    ensureCountingState();

    const counting = state.progress.counting;
    const accuracy = counting.attempts ? Math.round((counting.correct / counting.attempts) * 100) : 0;

    app.innerHTML = [
      '<section class="counting-panel">',
      '<div class="panel-header counting-header">',
      '<div>',
      '<h2>Card Counting</h2>',
      '<p class="muted">Hi-Lo drills for card values, running count, and full-deck countdown practice.</p>',
      '</div>',
      '<div class="counting-stats">',
      '<div class="stat"><strong>' + counting.attempts + '</strong><span>Counting answers</span></div>',
      '<div class="stat"><strong>' + accuracy + '%</strong><span>Accuracy</span></div>',
      '<div class="stat"><strong>' + counting.bestStreak + '</strong><span>Best streak</span></div>',
      '</div>',
      '</div>',
      renderCountingLesson(),
      renderCountingModeTabs(),
      renderCountingDrill(),
      '</section>'
    ].join("");
  }

  function renderCountingLesson() {
    return [
      '<section class="section counting-lesson">',
      '<div class="section-heading">',
      '<h3>Hi-Lo Count</h3>',
      '<p class="section-subtitle">Every exposed card changes the running count by +1, 0, or -1.</p>',
      '</div>',
      '<div class="count-rule-grid">',
      renderCountRule("+1", "2 3 4 5 6", "Low cards removed are good for the player because more high cards remain."),
      renderCountRule("0", "7 8 9", "Middle cards are neutral in the Hi-Lo system."),
      renderCountRule("-1", "10 J Q K A", "High cards removed are bad for the player because fewer strong cards remain."),
      '</div>',
      '<div class="counting-note">',
      '<strong>Core idea:</strong> Keep a running count as cards leave the shoe. A positive count means the remaining cards are richer in tens and aces. True count comes later; this first drill is about never losing the running count.',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderCountRule(value, cards, copy) {
    return [
      '<article class="count-rule">',
      '<strong>' + value + '</strong>',
      '<span>' + cards + '</span>',
      '<p>' + copy + '</p>',
      '</article>'
    ].join("");
  }

  function renderCountingModeTabs() {
    const modes = [
      { key: "value", label: "Card Value" },
      { key: "running", label: "Running Count" },
      { key: "deck", label: "Deck Countdown" }
    ];
    return [
      '<div class="counting-mode-tabs" aria-label="Counting drill modes">',
      modes.map(function (mode) {
        const classes = ["mode-button"];
        if (state.countingMode === mode.key) {
          classes.push("active");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-counting-mode="' + mode.key + '">' + mode.label + '</button>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function renderCountingDrill() {
    if (state.countingMode === "running") {
      return renderRunningCountDrill();
    }
    if (state.countingMode === "deck") {
      return renderDeckCountdownDrill();
    }
    return renderCardValueDrill();
  }

  function renderCardValueDrill() {
    const card = state.countingValueCard;
    const feedback = state.countingValueFeedback;
    return [
      '<section class="counting-drill">',
      '<div class="drill-copy">',
      '<h3>Card Value Drill</h3>',
      '<p class="muted">Look at the card and choose its Hi-Lo value.</p>',
      '</div>',
      '<div class="count-card-stage">',
      renderLargeCountingCard(card),
      '</div>',
      renderCountChoiceButtons("data-counting-value-answer", Boolean(feedback)),
      feedback ? renderCountingFeedback(feedback.correct, feedback.message) : "",
      '<div class="controls-row">',
      '<button class="secondary-button" type="button" data-action="new-count-card">New card</button>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderRunningCountDrill() {
    const sequence = state.countingSequence;
    const feedback = state.countingSequenceFeedback;
    return [
      '<section class="counting-drill">',
      '<div class="drill-copy">',
      '<h3>Running Count Drill</h3>',
      '<p class="muted">Add the Hi-Lo values for the whole row, then enter the final running count.</p>',
      '</div>',
      '<div class="count-sequence">',
      sequence.map(function (card) {
        return renderPlayingCard(card.rank, card.suit);
      }).join(""),
      '</div>',
      '<label class="count-input-row">',
      '<span>Final running count</span>',
      '<input class="count-input" type="number" inputmode="numeric" data-counting-sequence-answer value="' + state.countingSequenceAnswer + '">',
      '</label>',
      feedback ? renderCountingFeedback(feedback.correct, feedback.message) : "",
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="check-count-sequence">Check count</button>',
      '<button class="secondary-button" type="button" data-action="new-count-sequence">New sequence</button>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderDeckCountdownDrill() {
    const deck = state.countingDeck;
    const index = state.countingDeckIndex;
    const done = index >= deck.length;
    const card = done ? null : deck[index];
    const finalCorrect = done && state.countingDeckUserCount === 0;
    return [
      '<section class="counting-drill">',
      '<div class="drill-copy">',
      '<h3>Deck Countdown Drill</h3>',
      '<p class="muted">Count through one shuffled deck. If every card is counted correctly, the final running count is 0.</p>',
      '</div>',
      '<div class="deck-progress">',
      '<div class="stat"><strong>' + Math.min(index + 1, deck.length) + '/' + deck.length + '</strong><span>Card position</span></div>',
      '<div class="stat"><strong>' + formatCount(state.countingDeckUserCount) + '</strong><span>Your running count</span></div>',
      '<div class="stat"><strong>' + state.progress.counting.decksCompleted + '</strong><span>Decks completed</span></div>',
      '</div>',
      done ? renderDeckComplete(finalCorrect) : renderDeckCardPrompt(card),
      state.countingDeckLast ? renderDeckLastResult() : "",
      '<div class="controls-row">',
      '<button class="secondary-button" type="button" data-action="new-count-deck">Shuffle new deck</button>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderDeckCardPrompt(card) {
    return [
      '<div class="count-card-stage">',
      renderLargeCountingCard(card),
      '</div>',
      renderCountChoiceButtons("data-counting-deck-answer", false)
    ].join("");
  }

  function renderDeckComplete(finalCorrect) {
    return renderCountingFeedback(
      finalCorrect,
      finalCorrect ?
        "Deck complete. Your final running count is 0." :
        "Deck complete. Your final running count is " + formatCount(state.countingDeckUserCount) + ". A full deck should finish at 0."
    );
  }

  function renderDeckLastResult() {
    const last = state.countingDeckLast;
    return renderCountingFeedback(
      last.correct,
      "Last card: " + last.rank + " is " + formatCount(last.expected) + ". Your running count is " + formatCount(state.countingDeckUserCount) + "."
    );
  }

  function renderCountChoiceButtons(attributeName, disabled) {
    return [
      '<div class="count-choice-row">',
      COUNT_CHOICES.map(function (value) {
        return '<button class="count-choice" type="button" ' + attributeName + '="' + value + '" ' + (disabled ? "disabled" : "") + '>' + formatCount(value) + '</button>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function renderLargeCountingCard(card) {
    return [
      '<div class="large-count-card">',
      renderPlayingCard(card.rank, card.suit),
      '</div>'
    ].join("");
  }

  function renderCountingFeedback(correct, message) {
    return [
      '<div class="feedback ' + (correct ? "good" : "bad") + '">',
      '<strong>' + (correct ? "Correct" : "Check this") + '</strong>',
      '<p>' + message + '</p>',
      '</div>'
    ].join("");
  }

  function renderChart() {
    app.innerHTML = [
      '<section class="chart-panel">',
      '<div class="panel-header">',
      '<div><h2>Basic Strategy Chart</h2><p class="muted">S17, multi-deck, double after split, no surrender.</p></div>',
      '</div>',
      CHART_SECTIONS.map(renderChartSection).join(""),
      '<div class="chart-note">',
      '<strong>Legend:</strong> H = Hit, S = Stand, D = Double, P = Split. When doubling is unavailable, play the hand as a hit unless local rules say otherwise.',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderChartSection(section) {
    const rows = ROW_GROUPS[section.key];
    return [
      '<section class="chart-section" id="chart-' + section.key + '">',
      '<div class="section-heading chart-section-heading">',
      '<h3>' + section.title + '</h3>',
      '<p class="section-subtitle">' + section.subtitle + '</p>',
      '</div>',
      '<div class="table-wrap">',
      '<table>',
      '<thead><tr><th>Your hand</th>' + DEALERS.map(function (dealer) {
        return '<th>' + dealer + '</th>';
      }).join("") + '</tr></thead>',
      '<tbody>',
      rows.map(function (row) {
        return renderChartRow(row);
      }).join(""),
      '</tbody>',
      '</table>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderChartRow(row) {
    return [
      '<tr>',
      '<td>' + row.label + '</td>',
      DEALERS.map(function (dealer) {
        const action = actionFor(row, dealer);
        return '<td><span title="' + ACTIONS[action].label + '" class="chart-action ' + ACTIONS[action].className + '">' + ACTIONS[action].short + '</span></td>';
      }).join(""),
      '</tr>'
    ].join("");
  }

  function renderCardRow(cards) {
    return '<div class="card-row">' + cards.map(function (rank, index) {
      return renderPlayingCard(rank, SUITS[index % SUITS.length]);
    }).join("") + '</div>';
  }

  function renderPlayingCard(rank, suit) {
    const red = suit === "H" || suit === "D";
    return [
      '<div class="playing-card ' + (red ? "red" : "black") + '">',
      '<span>' + rank + '</span>',
      '<span>' + suit + '</span>',
      '</div>'
    ].join("");
  }

  function renderHiddenCard() {
    return [
      '<div class="playing-card card-back" aria-label="Hidden dealer card">',
      '<span>?</span>',
      '</div>'
    ].join("");
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    state.practiceFeedback = null;
    if (tab === "practice") {
      state.practiceScenario = makePracticeScenario();
    }
    if (tab === "counting") {
      ensureCountingState();
    }
    syncUrl(false);
    render();
  }

  function completeCurrentLesson() {
    const dealer = state.selectedDealer;
    if (!state.progress.completedDealers.includes(dealer)) {
      state.progress.completedDealers.push(dealer);
    }
    state.progress.completedDealers.sort(function (a, b) {
      return dealerIndex(a) - dealerIndex(b);
    });
    saveProgress();
    render();
  }

  function resetProgress() {
    state.progress = defaultProgress();
    state.selectedDealer = "2";
    state.quizAnswers = {};
    state.quizSubmitted = false;
    state.practiceScenario = null;
    state.practiceFeedback = null;
    saveProgress();
    syncUrl(false);
    render();
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target) {
      return;
    }

    if (target.dataset.tab) {
      setActiveTab(target.dataset.tab);
      return;
    }

    if (target.dataset.tabJump) {
      setActiveTab(target.dataset.tabJump);
      return;
    }

    if (target.dataset.countingMode) {
      state.countingMode = target.dataset.countingMode;
      ensureCountingState();
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.dealer) {
      const dealer = target.dataset.dealer;
      if (!isUnlocked(dealer)) {
        return;
      }
      state.selectedDealer = dealer;
      state.quizAnswers = {};
      state.quizSubmitted = false;
      saveProgress();
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.answer) {
      state.quizAnswers[target.dataset.quizIndex] = target.dataset.answer;
      state.quizSubmitted = false;
      render();
      return;
    }

    if (target.dataset.countingValueAnswer) {
      if (state.countingValueFeedback) {
        return;
      }
      const selected = parseInt(target.dataset.countingValueAnswer, 10);
      const expected = hiLoValue(state.countingValueCard.rank);
      const isCorrect = selected === expected;
      state.countingValueFeedback = {
        correct: isCorrect,
        message: state.countingValueCard.rank + " is " + formatCount(expected) + "."
      };
      recordCountingResult(isCorrect);
      render();
      return;
    }

    if (target.dataset.countingDeckAnswer) {
      const deck = state.countingDeck;
      if (!deck || state.countingDeckIndex >= deck.length) {
        return;
      }
      const card = deck[state.countingDeckIndex];
      const selected = parseInt(target.dataset.countingDeckAnswer, 10);
      const expected = hiLoValue(card.rank);
      const isCorrect = selected === expected;
      state.countingDeckUserCount += selected;
      state.countingDeckExpectedCount += expected;
      state.countingDeckLast = {
        rank: card.rank,
        expected: expected,
        selected: selected,
        correct: isCorrect
      };
      state.countingDeckIndex += 1;
      if (state.countingDeckIndex >= deck.length) {
        state.progress.counting.decksCompleted += 1;
      }
      recordCountingResult(isCorrect);
      render();
      return;
    }

    if (target.dataset.practiceAnswer) {
      const scenario = state.practiceScenario;
      const correctAction = actionFor(scenario.row, scenario.dealer);
      const isCorrect = target.dataset.practiceAnswer === correctAction;
      state.progress.stats.attempts += 1;
      if (isCorrect) {
        state.progress.stats.correct += 1;
      }
      state.practiceFeedback = {
        correct: isCorrect,
        action: correctAction,
        explanation: explain(scenario.row, scenario.dealer)
      };
      saveProgress();
      render();
      return;
    }

    if (target.dataset.action === "new-count-card") {
      resetCountingValueCard();
      render();
      return;
    }

    if (target.dataset.action === "check-count-sequence") {
      if (state.countingSequenceFeedback) {
        return;
      }
      const expected = countSequenceTotal(state.countingSequence);
      const selected = parseInt(state.countingSequenceAnswer, 10);
      const isNumber = !Number.isNaN(selected);
      const isCorrect = isNumber && selected === expected;
      state.countingSequenceFeedback = {
        correct: isCorrect,
        message: isNumber ?
          "The final running count is " + formatCount(expected) + "." :
          "Enter a final running count before checking."
      };
      if (!isNumber) {
        render();
        return;
      }
      recordCountingResult(isCorrect);
      render();
      return;
    }

    if (target.dataset.action === "new-count-sequence") {
      resetCountingSequence();
      render();
      return;
    }

    if (target.dataset.action === "new-count-deck") {
      resetCountingDeck();
      render();
      return;
    }

    if (target.dataset.action === "new-hand") {
      state.practiceScenario = makePracticeScenario();
      state.practiceFeedback = null;
      render();
      return;
    }

    if (target.dataset.action === "grade-quiz") {
      state.quizSubmitted = true;
      const score = quizScore(state.selectedDealer);
      state.progress.quizScores[state.selectedDealer] = Math.max(state.progress.quizScores[state.selectedDealer] || 0, score);
      saveProgress();
      render();
      return;
    }

    if (target.dataset.action === "clear-quiz") {
      state.quizAnswers = {};
      state.quizSubmitted = false;
      render();
      return;
    }

    if (target.dataset.action === "complete-lesson") {
      completeCurrentLesson();
      return;
    }

    if (target.dataset.action === "next-dealer") {
      const next = nextDealer(state.selectedDealer);
      if (next && isUnlocked(next)) {
        state.selectedDealer = next;
        state.quizAnswers = {};
        state.quizSubmitted = false;
        saveProgress();
        syncUrl(false);
        render();
      }
      return;
    }

    if (target.dataset.action === "reset-progress") {
      resetProgress();
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!target || !target.dataset || target.dataset.countingSequenceAnswer === undefined) {
      return;
    }
    state.countingSequenceAnswer = target.value;
    state.countingSequenceFeedback = null;
  });

  window.addEventListener("hashchange", function () {
    if (applyRouteFromHash()) {
      render();
    }
  });

  if (!applyRouteFromHash()) {
    syncUrl(true);
  }

  render();
})();
