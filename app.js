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
  CARD_DRAWS.cacheKey = "tc0";
  const COUNT_CHOICES = [1, 0, -1];
  const COUNT_EXAMPLES = [-3, 0, 3];
  const COUNT_RUN_TYPES = {
    short: {
      label: "12 cards",
      detail: "Fast warm-up",
      description: "A short random stream for quick mental practice."
    },
    color: {
      label: "One color",
      detail: "26 cards",
      description: "Only red cards: hearts and diamonds. The final count should be 0."
    },
    deck: {
      label: "Full deck",
      detail: "52 cards",
      description: "One shuffled deck. The final count should be 0."
    },
    multi: {
      label: "Multiple decks",
      detail: "2 decks",
      description: "Two shuffled decks mixed together. The final count should be 0."
    }
  };
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
  const COUNT_DEVIATIONS = [
    { rowId: "hard-13-16", dealer: "10", total: 16, hand: "Hard 16", base: "H", action: "S", compare: "gte", index: 0, rule: "Stand at TC 0 or higher." },
    { rowId: "hard-13-16", dealer: "10", total: 15, hand: "Hard 15", base: "H", action: "S", compare: "gte", index: 4, rule: "Stand at TC +4 or higher." },
    { rowId: "pair-10", dealer: "5", hand: "10,10", base: "S", action: "P", compare: "gte", index: 5, rule: "Split at TC +5 or higher." },
    { rowId: "pair-10", dealer: "6", hand: "10,10", base: "S", action: "P", compare: "gte", index: 4, rule: "Split at TC +4 or higher." },
    { rowId: "hard-10", dealer: "10", total: 10, hand: "Hard 10", base: "H", action: "D", compare: "gte", index: 4, rule: "Double at TC +4 or higher." },
    { rowId: "hard-12", dealer: "3", total: 12, hand: "Hard 12", base: "H", action: "S", compare: "gte", index: 2, rule: "Stand at TC +2 or higher." },
    { rowId: "hard-12", dealer: "2", total: 12, hand: "Hard 12", base: "H", action: "S", compare: "gte", index: 3, rule: "Stand at TC +3 or higher." },
    { rowId: "hard-11", dealer: "A", total: 11, hand: "Hard 11", base: "H", action: "D", compare: "gte", index: 1, rule: "Double at TC +1 or higher." },
    { rowId: "hard-9", dealer: "2", total: 9, hand: "Hard 9", base: "H", action: "D", compare: "gte", index: 1, rule: "Double at TC +1 or higher." },
    { rowId: "hard-10", dealer: "A", total: 10, hand: "Hard 10", base: "H", action: "D", compare: "gte", index: 4, rule: "Double at TC +4 or higher." },
    { rowId: "hard-9", dealer: "7", total: 9, hand: "Hard 9", base: "H", action: "D", compare: "gte", index: 3, rule: "Double at TC +3 or higher." },
    { rowId: "hard-13-16", dealer: "9", total: 16, hand: "Hard 16", base: "H", action: "S", compare: "gte", index: 5, rule: "Stand at TC +5 or higher." },
    { rowId: "hard-13-16", dealer: "2", total: 13, hand: "Hard 13", base: "S", action: "H", compare: "lt", index: -1, rule: "Hit below TC -1." },
    { rowId: "hard-12", dealer: "4", total: 12, hand: "Hard 12", base: "S", action: "H", compare: "lt", index: 0, rule: "Hit below TC 0." },
    { rowId: "hard-12", dealer: "5", total: 12, hand: "Hard 12", base: "S", action: "H", compare: "lt", index: -2, rule: "Hit below TC -2." },
    { rowId: "hard-12", dealer: "6", total: 12, hand: "Hard 12", base: "S", action: "H", compare: "lt", index: -1, rule: "Hit below TC -1." },
    { rowId: "hard-13-16", dealer: "3", total: 13, hand: "Hard 13", base: "S", action: "H", compare: "lt", index: -2, rule: "Hit below TC -2." }
  ];
  const INSURANCE_DEVIATION = {
    hand: "Insurance",
    dealer: "A",
    action: "Take insurance",
    rule: "Take insurance at TC +3 or higher."
  };
  const ASSESSMENT_SECTIONS = {
    strategy: "Basic strategy",
    value: "Card values",
    running: "Running count",
    deviation: "Count changes"
  };
  const ASSESSMENT_COUNTS = {
    strategy: 8,
    value: 4,
    running: 1,
    deviation: 3
  };
  const ASSESSMENT_RUN_LENGTH = 8;
  const DEVIATION_EXAM_BANK = [
    { type: "hard", rowId: "hard-13-16", dealer: "10", cards: ["10", "6"], trueCount: 1 },
    { type: "hard", rowId: "hard-12", dealer: "4", cards: ["10", "2"], trueCount: -1 },
    { type: "hard", rowId: "hard-11", dealer: "A", cards: ["6", "5"], trueCount: 2 },
    { type: "hard", rowId: "hard-10", dealer: "10", cards: ["6", "4"], trueCount: 5 },
    { type: "hard", rowId: "hard-13-16", dealer: "2", cards: ["10", "3"], trueCount: -2 },
    { type: "hard", rowId: "hard-9", dealer: "2", cards: ["4", "5"], trueCount: 2 },
    { type: "hard", rowId: "hard-12", dealer: "3", cards: ["10", "2"], trueCount: 3 },
    { type: "pair", rowId: "pair-10", dealer: "6", cards: ["10", "10"], trueCount: 5 }
  ];

  const SUITS = ["S", "H", "D", "C"];
  const COUNT_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const app = document.getElementById("app");
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  let countingTimerId = null;

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
    countingValueStartedAt: 0,
    countingValueLastMs: null,
    countingValueLastWasCorrect: null,
    countingValueSpeeds: [],
    countingRunType: "short",
    countingRunCards: null,
    countingRunIndex: 0,
    countingRunAnswer: "",
    countingRunFeedback: null,
    countingRunShowCount: false,
    countingRunStartedAt: 0,
    countingRunLastAdvancedAt: 0,
    countingRunFinishedAt: 0,
    countingRunTransition: 0,
    assessmentSession: null,
    assessmentShareCopied: false,
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

    if (first === "assessment") {
      state.activeTab = "assessment";
      if (parts[1] === "result" && parts[2]) {
        state.assessmentSession = {
          status: "shared",
          result: decodeAssessmentShare(parts[2]),
          questions: [],
          answers: [],
          index: 0
        };
      } else if (state.assessmentSession && state.assessmentSession.status === "shared") {
        state.assessmentSession = null;
      }
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
    if (state.activeTab === "assessment") {
      if (state.assessmentSession && state.assessmentSession.status === "shared" && state.assessmentSession.result) {
        return "#/assessment/result/" + encodeAssessmentShare(state.assessmentSession.result);
      }
      return "#/assessment";
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
        assessment: Object.assign(base.assessment, parsed.assessment || {}),
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
      },
      assessment: {
        latest: null
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

  function rankKey(rank) {
    return ["10", "J", "Q", "K"].includes(rank) ? "10" : rank;
  }

  function isSplittableCards(cards) {
    return cards.length === 2 && rankKey(cards[0]) === rankKey(cards[1]);
  }

  function normalizeHand(state) {
    while (state.total > 21 && state.softAces > 0) {
      state.total -= 10;
      state.softAces -= 1;
    }
    return state;
  }

  function drawCacheKey(draws) {
    return (draws || CARD_DRAWS).cacheKey || "tc0";
  }

  function countAdjustedDraws(trueCount) {
    if (trueCount === 0) {
      return CARD_DRAWS;
    }

    const cacheKey = "tc" + trueCount;
    if (countAdjustedDraws.cache[cacheKey]) {
      return countAdjustedDraws.cache[cacheKey];
    }

    const clamped = Math.max(-5, Math.min(5, trueCount));
    const shift = clamped * 0.018;
    const lowMass = (5 / 13) - shift;
    const neutralMass = 3 / 13;
    const highMass = 1 - lowMass - neutralMass;
    const draws = [
      { rank: "A", value: 11, probability: highMass / 5 },
      { rank: "2", value: 2, probability: lowMass / 5 },
      { rank: "3", value: 3, probability: lowMass / 5 },
      { rank: "4", value: 4, probability: lowMass / 5 },
      { rank: "5", value: 5, probability: lowMass / 5 },
      { rank: "6", value: 6, probability: lowMass / 5 },
      { rank: "7", value: 7, probability: neutralMass / 3 },
      { rank: "8", value: 8, probability: neutralMass / 3 },
      { rank: "9", value: 9, probability: neutralMass / 3 },
      { rank: "10", value: 10, probability: highMass * 4 / 5 }
    ];
    draws.cacheKey = cacheKey;
    countAdjustedDraws.cache[cacheKey] = draws;
    return draws;
  }
  countAdjustedDraws.cache = {};

  function addToDistribution(target, source, weight) {
    Object.keys(source).forEach(function (key) {
      target[key] = (target[key] || 0) + source[key] * weight;
    });
  }

  function dealerDistribution(dealer, draws) {
    const drawSet = draws || CARD_DRAWS;
    const cacheKey = drawCacheKey(drawSet) + ":dealer:" + dealer;
    if (DEALER_DISTRIBUTION_CACHE[cacheKey]) {
      return DEALER_DISTRIBUTION_CACHE[cacheKey];
    }
    const state = handState([dealer]);
    const distribution = dealerDrawDistribution(state.total, state.softAces, drawSet);
    DEALER_DISTRIBUTION_CACHE[cacheKey] = distribution;
    return distribution;
  }

  function dealerDrawDistribution(total, softAces, draws) {
    const drawSet = draws || CARD_DRAWS;
    const cacheKey = drawCacheKey(drawSet) + ":draw:" + total + ":" + softAces;
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
    drawSet.forEach(function (draw) {
      const next = normalizeHand({
        total: total + draw.value,
        softAces: softAces + (draw.rank === "A" ? 1 : 0)
      });
      addToDistribution(distribution, dealerDrawDistribution(next.total, next.softAces, drawSet), draw.probability);
    });
    DEALER_DISTRIBUTION_CACHE[cacheKey] = distribution;
    return distribution;
  }

  function dealerStats(dealer, draws) {
    const distribution = dealerDistribution(dealer, draws);
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

  function standOutcome(row, dealer, draws) {
    return standOutcomeForCards(row.cards, dealer, draws);
  }

  function standOutcomeForCards(cards, dealer, draws) {
    return standOutcomeForState(handState(cards), dealer, draws);
  }

  function standOutcomeForState(player, dealer, draws) {
    const distribution = dealerDistribution(dealer, draws);
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

  function hitOnceOutcome(row, dealer, draws) {
    return hitOnceOutcomeForCards(row.cards, dealer, draws);
  }

  function hitOnceOutcomeForCards(cards, dealer, draws) {
    const drawSet = draws || CARD_DRAWS;
    const player = handState(cards);
    const outcome = {
      win: 0,
      push: 0,
      lose: 0
    };

    drawSet.forEach(function (draw) {
      const next = normalizeHand({
        total: player.total + draw.value,
        softAces: player.softAces + (draw.rank === "A" ? 1 : 0)
      });
      const nextOutcome = next.total > 21 ? { win: 0, push: 0, lose: 1 } : standOutcomeForState(next, dealer, drawSet);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function hitOptimalOutcomeForCards(cards, dealer, draws) {
    const drawSet = draws || CARD_DRAWS;
    const player = handState(cards);
    const outcome = {
      win: 0,
      push: 0,
      lose: 0
    };

    drawSet.forEach(function (draw) {
      const next = normalizeHand({
        total: player.total + draw.value,
        softAces: player.softAces + (draw.rank === "A" ? 1 : 0)
      });
      const nextOutcome = bestHitStandOutcome(next, dealer, {}, drawSet);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function splitOutcomeForCards(cards, dealer, draws) {
    const drawSet = draws || CARD_DRAWS;
    const firstRank = cards[0];
    const outcome = {
      win: 0,
      push: 0,
      lose: 0,
      perSplitHand: true,
      averageUnitsScope: "both split hands"
    };

    drawSet.forEach(function (draw) {
      const next = handState([firstRank, draw.rank]);
      const nextOutcome = bestHitStandOutcome(next, dealer, {}, drawSet);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function averageResultUnits(outcome, action) {
    const score = outcomeScore(outcome);
    if (action === "D") {
      return score * 2;
    }
    if (action === "P" && outcome.perSplitHand) {
      return score * 2;
    }
    return score;
  }

  function formatAverageResult(value) {
    const rounded = Math.round(value * 100) / 100;
    return (rounded > 0 ? "+" : "") + rounded.toFixed(2);
  }

  function outcomeAverageResult(outcome, action) {
    if (typeof outcome.averageUnits === "number") {
      return outcome.averageUnits;
    }
    return averageResultUnits(outcome, action);
  }

  function withActionResult(outcome, action) {
    const next = Object.assign({}, outcome);
    next.averageUnits = averageResultUnits(next, action);
    return next;
  }

  function outcomeForAction(cards, dealer, action, draws) {
    if (action === "S") {
      return withActionResult(standOutcomeForCards(cards, dealer, draws), action);
    }
    if (action === "D") {
      return withActionResult(hitOnceOutcomeForCards(cards, dealer, draws), action);
    }
    if (action === "P") {
      if (!isSplittableCards(cards)) {
        return withActionResult({ win: 0, push: 0, lose: 1, invalid: true }, action);
      }
      return withActionResult(splitOutcomeForCards(cards, dealer, draws), action);
    }
    return withActionResult(hitOptimalOutcomeForCards(cards, dealer, draws), action);
  }

  function optimalHitStandOutcome(row, dealer, draws) {
    return bestHitStandOutcome(handState(row.cards), dealer, {}, draws);
  }

  function overallOptimalOutcome(dealer, draws) {
    const total = LESSON_ROWS.reduce(function (summary, row) {
      const outcome = optimalHitStandOutcome(row, dealer, draws);
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

  function bestHitStandOutcome(player, dealer, memo, draws) {
    const drawSet = draws || CARD_DRAWS;
    if (player.total > 21) {
      return { win: 0, push: 0, lose: 1 };
    }

    const key = dealer + ":" + player.total + ":" + player.softAces;
    if (memo[key]) {
      return memo[key];
    }

    const stand = standOutcomeForState(player, dealer, drawSet);
    const hit = hitBestOutcomeForState(player, dealer, memo, drawSet);
    const best = outcomeScore(hit) > outcomeScore(stand) ? hit : stand;
    memo[key] = best;
    return best;
  }

  function hitBestOutcomeForState(player, dealer, memo, draws) {
    const drawSet = draws || CARD_DRAWS;
    const outcome = {
      win: 0,
      push: 0,
      lose: 0
    };

    drawSet.forEach(function (draw) {
      const next = normalizeHand({
        total: player.total + draw.value,
        softAces: player.softAces + (draw.rank === "A" ? 1 : 0)
      });
      const nextOutcome = bestHitStandOutcome(next, dealer, memo, drawSet);
      outcome.win += nextOutcome.win * draw.probability;
      outcome.push += nextOutcome.push * draw.probability;
      outcome.lose += nextOutcome.lose * draw.probability;
    });

    return outcome;
  }

  function outcomeScore(outcome) {
    return outcome.win - outcome.lose;
  }

  function deviationMatchesScenario(deviation, scenario) {
    if (deviation.rowId !== scenario.row.id || deviation.dealer !== scenario.dealer) {
      return false;
    }
    if (deviation.total === undefined) {
      return true;
    }
    return handState(scenario.cards).total === deviation.total;
  }

  function countDeviationsForScenario(scenario) {
    return COUNT_DEVIATIONS.filter(function (deviation) {
      return deviationMatchesScenario(deviation, scenario);
    });
  }

  function countDeviationsForChartCell(row, dealer) {
    return COUNT_DEVIATIONS.filter(function (deviation) {
      return deviation.rowId === row.id && deviation.dealer === dealer;
    });
  }

  function deviationApplies(deviation, trueCount) {
    if (deviation.compare === "lt") {
      return trueCount < deviation.index;
    }
    return trueCount >= deviation.index;
  }

  function countAwareAction(scenario, trueCount) {
    const base = actionFor(scenario.row, scenario.dealer);
    const deviations = countDeviationsForScenario(scenario);
    const active = deviations.find(function (deviation) {
      return deviationApplies(deviation, trueCount);
    });
    return active ? active.action : base;
  }

  function countActionNote(scenario) {
    const deviations = countDeviationsForScenario(scenario);
    if (!deviations.length) {
      return "No common Hi-Lo index change for this exact hand.";
    }
    return deviations.map(function (deviation) {
      return deviation.hand + " vs " + deviation.dealer + ": " + deviation.rule;
    }).join(" ");
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

  function formatSeconds(ms) {
    return (Math.round(ms / 100) / 10).toFixed(1) + "s";
  }

  function average(values) {
    if (!values.length) {
      return 0;
    }
    return values.reduce(function (total, value) {
      return total + value;
    }, 0) / values.length;
  }

  function valueSpeedRating(ms) {
    if (!ms) {
      return {
        label: "Start steady",
        copy: "Aim for correct answers before speed."
      };
    }
    if (ms <= 800) {
      return {
        label: "Fast",
        copy: "This is casino-ready recognition speed."
      };
    }
    if (ms <= 1400) {
      return {
        label: "Good",
        copy: "You are recognizing values quickly."
      };
    }
    if (ms <= 2400) {
      return {
        label: "Getting there",
        copy: "Keep going until the value feels automatic."
      };
    }
    return {
      label: "Slow",
      copy: "Pause and drill accuracy, then speed up."
    };
  }

  function runPaceRating(msPerCard) {
    if (!msPerCard) {
      return {
        label: "Ready",
        copy: "Start the run and keep the count in your head."
      };
    }
    if (msPerCard <= 900) {
      return {
        label: "Fast pace",
        copy: "Good if the count is still accurate."
      };
    }
    if (msPerCard <= 1700) {
      return {
        label: "Good pace",
        copy: "This is a useful practice rhythm."
      };
    }
    if (msPerCard <= 2800) {
      return {
        label: "Steady pace",
        copy: "Try to reduce hesitation between cards."
      };
    }
    return {
      label: "Slow pace",
      copy: "Accuracy first, then shorten the gap."
    };
  }

  function currentRunElapsed() {
    if (!state.countingRunStartedAt) {
      return 0;
    }
    const endTime = state.countingRunFinishedAt || Date.now();
    return Math.max(0, endTime - state.countingRunStartedAt);
  }

  function currentRunCardsSeenCount() {
    if (!state.countingRunCards) {
      return 0;
    }
    return Math.min(state.countingRunIndex + 1, state.countingRunCards.length);
  }

  function currentRunPace() {
    const cardsSeen = currentRunCardsSeenCount();
    return runPaceRating(cardsSeen ? currentRunElapsed() / cardsSeen : 0);
  }

  function updateCountingTimerDisplay() {
    const elapsedNode = document.querySelector("[data-run-elapsed]");
    if (!elapsedNode) {
      return;
    }

    const cardsSeenNode = document.querySelector("[data-run-cards-seen]");
    const paceLabelNode = document.querySelector("[data-run-pace-label]");
    const paceCopyNode = document.querySelector("[data-run-pace-copy]");
    const pace = currentRunPace();

    elapsedNode.textContent = formatSeconds(currentRunElapsed());
    if (cardsSeenNode) {
      cardsSeenNode.textContent = String(currentRunCardsSeenCount());
    }
    if (paceLabelNode) {
      paceLabelNode.textContent = pace.label;
    }
    if (paceCopyNode) {
      paceCopyNode.textContent = pace.copy;
    }
  }

  function syncCountingTimer() {
    if (state.activeTab !== "counting" || state.countingMode !== "running") {
      stopCountingTimer();
      return;
    }
    updateCountingTimerDisplay();
    if (countingTimerId) {
      return;
    }
    countingTimerId = window.setInterval(updateCountingTimerDisplay, 250);
  }

  function stopCountingTimer() {
    if (!countingTimerId) {
      return;
    }
    window.clearInterval(countingTimerId);
    countingTimerId = null;
  }

  function randomSuit() {
    return SUITS[Math.floor(Math.random() * SUITS.length)];
  }

  function randomCountCard() {
    const rank = COUNT_RANKS[Math.floor(Math.random() * COUNT_RANKS.length)];
    return { rank: rank, suit: randomSuit() };
  }

  function shuffleCards(cards) {
    const deck = cards.slice();
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const card = deck[index];
      deck[index] = deck[swapIndex];
      deck[swapIndex] = card;
    }
    return deck;
  }

  function makeRandomCountSequence(length) {
    const sequence = [];
    for (let index = 0; index < length; index += 1) {
      sequence.push(randomCountCard());
    }
    return sequence;
  }

  function shuffled(items) {
    return shuffleCards(items);
  }

  function countSequenceTotal(sequence) {
    return sequence.reduce(function (total, card) {
      return total + hiLoValue(card.rank);
    }, 0);
  }

  function makeCountDecks(deckCount, suits) {
    const deck = [];
    for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
      COUNT_RANKS.forEach(function (rank) {
        suits.forEach(function (suit) {
          deck.push({ rank: rank, suit: suit });
        });
      });
    }
    return shuffleCards(deck);
  }

  function makeCountingRunCards(type) {
    if (type === "color") {
      return makeCountDecks(1, ["H", "D"]);
    }
    if (type === "deck") {
      return makeCountDecks(1, SUITS);
    }
    if (type === "multi") {
      return makeCountDecks(2, SUITS);
    }
    return makeRandomCountSequence(12);
  }

  function currentRunSeenCards() {
    if (!state.countingRunCards) {
      return [];
    }
    return state.countingRunCards.slice(0, Math.min(state.countingRunIndex + 1, state.countingRunCards.length));
  }

  function currentRunCount() {
    return countSequenceTotal(currentRunSeenCards());
  }

  function resetCountingValueCard() {
    state.countingValueCard = randomCountCard();
    state.countingValueFeedback = null;
    state.countingValueStartedAt = Date.now();
  }

  function resetCountingRun() {
    state.countingRunCards = makeCountingRunCards(state.countingRunType);
    state.countingRunIndex = 0;
    state.countingRunAnswer = "";
    state.countingRunFeedback = null;
    state.countingRunShowCount = false;
    state.countingRunStartedAt = Date.now();
    state.countingRunLastAdvancedAt = state.countingRunStartedAt;
    state.countingRunFinishedAt = 0;
    state.countingRunTransition += 1;
  }

  function ensureCountingState() {
    if (!["value", "running"].includes(state.countingMode)) {
      state.countingMode = "running";
    }
    if (!COUNT_RUN_TYPES[state.countingRunType]) {
      state.countingRunType = "short";
    }
    if (!state.countingValueCard) {
      resetCountingValueCard();
    }
    if (!state.countingRunCards) {
      resetCountingRun();
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
      stopCountingTimer();
      renderLearn();
      return;
    }
    if (state.activeTab === "practice") {
      stopCountingTimer();
      renderPractice();
      return;
    }
    if (state.activeTab === "counting") {
      renderCounting();
      syncCountingTimer();
      return;
    }
    if (state.activeTab === "assessment") {
      stopCountingTimer();
      renderAssessment();
      return;
    }
    stopCountingTimer();
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
      renderMathAssumptionsSection(),
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
      renderHeaderMetric("Avg result", formatAverageResult(outcomeScore(overall)) + " units"),
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

  function renderMathAssumptionsSection() {
    return [
      '<section class="section assumptions-section">',
      '<div class="section-heading">',
      '<h3>How the Chances Are Estimated</h3>',
      '<p class="section-subtitle">The model used by the tables on this page.</p>',
      '</div>',
      '<div class="basics-grid">',
      renderBasicItem("Rules", "Multi-deck game, dealer stands on soft 17, double after split allowed, and no surrender."),
      renderBasicItem("Card mix", "Lesson percentages use an infinite-shoe estimate. That keeps the examples simple and consistent."),
      renderBasicItem("Count rows", "Practice count rows adjust the card mix as a Hi-Lo true-count estimate. Treat them as training guidance, not exact table math."),
      renderBasicItem("Splits", "Split win/tie/lose chances are shown per new hand. Avg result combines the two split hands because splitting creates a second bet."),
      '</div>',
      '</section>'
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
    const recommendedAction = actionFor(row, dealer);
    const stand = standOutcome(row, dealer);
    const hit = hitOnceOutcome(row, dealer);
    const recommended = outcomeForAction(row.cards, dealer, recommendedAction);
    const optimal = optimalHitStandOutcome(row, dealer);
    return [
      '<div class="math-panel">',
      renderOutcomeTable(stand, hit, recommended, optimal, recommendedAction),
      renderOddsExplainer(recommendedAction === "P"),
      '<p class="math-note">Hit once stops after one card. Basic strategy shows the recommended action, including Double or Split. Best hit/stand path keeps choosing between hit and stand after each card.</p>',
      '</div>'
    ].join("");
  }

  function renderOutcomeTable(stand, hit, recommended, optimal, recommendedAction) {
    return [
      '<div class="outcome-table" aria-label="Outcome comparison">',
      '<div class="outcome-head">Choice</div>',
      '<div class="outcome-head">Win</div>',
      '<div class="outcome-head">Tie</div>',
      '<div class="outcome-head">Lose</div>',
      '<div class="outcome-head">Avg result</div>',
      renderOutcomeRow("Stand", stand, "S"),
      renderOutcomeRow("Hit once", hit, "H"),
      renderOutcomeRow("Basic strategy: " + ACTIONS[recommendedAction].label, recommended, recommendedAction),
      renderOutcomeRow("Best hit/stand path", optimal, "H"),
      '</div>'
    ].join("");
  }

  function renderOutcomeRow(label, outcome, action) {
    return [
      '<div class="outcome-label">' + label + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.win) + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.push) + '</div>',
      '<div class="outcome-value">' + formatPercent(outcome.lose) + '</div>',
      '<div class="outcome-value">' + formatAverageResult(outcomeAverageResult(outcome, action)) + '</div>'
    ].join("");
  }

  function renderOddsExplainer(includeSplit) {
    return [
      '<p class="odds-explainer">',
      '<strong>How to read this:</strong> Win, tie, and lose are chances. Avg result is the average profit in betting units from the original hand. +0.10 means gaining 0.10 units per repeat; -0.10 means losing 0.10 units. Double uses two units.',
      includeSplit ? ' For splits, win/tie/lose is for one new hand; Avg result combines the two split hands.' : "",
      '</p>'
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
      renderPracticeTable(scenario),
      renderPracticeActionButtons(scenario),
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

  function renderPracticeTable(scenario) {
    return [
      '<div class="practice-table" aria-label="Blackjack table">',
      '<div class="practice-table-row dealer-seat">',
      '<span class="hand-label">Dealer</span>',
      '<div class="card-row dealer-card-row">',
      renderPlayingCard(scenario.dealer, "H"),
      renderHiddenCard(),
      '</div>',
      '</div>',
      '<div class="table-rail" aria-hidden="true"></div>',
      '<div class="practice-table-row player-seat">',
      '<span class="hand-label">Your hand</span>',
      '<div>',
      renderCardRow(scenario.cards),
      '<strong class="table-hand-name">' + scenario.handLabel + '</strong>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function renderPracticeActionButtons(scenario) {
    const feedback = state.practiceFeedback;
    const correct = actionFor(scenario.row, scenario.dealer);
    return [
      '<div class="action-row">',
      practiceActionsForScenario(scenario).map(function (action) {
        const classes = ["action-button"];
        if (feedback && feedback.selected === action) {
          classes.push("selected");
        }
        if (feedback && action === correct) {
          classes.push("correct");
        }
        if (feedback && feedback.selected === action && action !== correct) {
          classes.push("incorrect");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-practice-answer="' + action + '">' + ACTIONS[action].label + '</button>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function practiceActionsForScenario(scenario) {
    if (scenario.type === "pair") {
      return ACTION_ORDER;
    }
    return ACTION_ORDER.filter(function (action) {
      return action !== "P";
    });
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
      renderSplitPreviewForActions(feedback.scenario, feedback.selected, feedback.action),
      renderPracticeOdds(feedback.scenario, feedback.selected),
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="new-hand">Next hand</button>',
      '</div>',
      '</div>'
    ].join("");
  }

  function renderSplitPreviewForActions(scenario, selectedAction, correctAction) {
    if (!isSplittableCards(scenario.cards) || (selectedAction !== "P" && correctAction !== "P")) {
      return "";
    }
    return renderSplitPreview(scenario);
  }

  function renderSplitPreview(scenario) {
    const first = scenario.cards[0];
    const second = scenario.cards[1];
    return [
      '<div class="split-preview" aria-label="Split hand preview">',
      '<div class="split-preview-heading">',
      '<strong>After a split</strong>',
      '<span>The pair becomes two separate hands. Each gets one new card before you continue.</span>',
      '</div>',
      '<div class="split-preview-hands">',
      renderSplitPreviewHand("Split hand 1", first, "H"),
      renderSplitPreviewHand("Split hand 2", second, "S"),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderSplitPreviewHand(label, rank, suit) {
    return [
      '<div class="split-preview-hand">',
      '<span>' + label + '</span>',
      '<div class="card-row">',
      renderPlayingCard(rank, suit),
      renderHiddenCard("Next card for " + label.toLowerCase()),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderPracticeOdds(scenario, selectedAction) {
    const neutralOutcome = outcomeForAction(scenario.cards, scenario.dealer, selectedAction, countAdjustedDraws(0));
    const splitNote = selectedAction === "P" || countDeviationsForScenario(scenario).some(function (deviation) {
      return deviation.action === "P";
    }) ? " Split win/tie/lose chances are per new hand; Avg result combines the two split hands." : "";
    return [
      '<div class="practice-odds">',
      '<div class="practice-odds-heading">',
      '<strong>Winning chances</strong>',
      '<span>Count 0 uses a neutral shoe. Count rows are Hi-Lo estimates.</span>',
      '</div>',
      '<div class="neutral-odds">',
      '<span>Your selected play at count 0</span>',
      '<strong>' + ACTIONS[selectedAction].label + ': ' + formatPercent(neutralOutcome.win) + ' win</strong>',
      '<small>Tie ' + formatPercent(neutralOutcome.push) + ' | Lose ' + formatPercent(neutralOutcome.lose) + ' | Avg result ' + formatAverageResult(outcomeAverageResult(neutralOutcome, selectedAction)) + ' units</small>',
      '</div>',
      renderCountOddsTable(scenario),
      renderOddsExplainer(selectedAction === "P" || isSplittableCards(scenario.cards)),
      '<p class="math-note">' + countActionNote(scenario) + ' High counts mean more tens and aces remain; low counts mean more small cards remain.' + splitNote + '</p>',
      '</div>'
    ].join("");
  }

  function renderCountOddsTable(scenario) {
    return [
      '<div class="count-odds-table" aria-label="Count adjusted outcomes">',
      '<div class="count-odds-head">Count</div>',
      '<div class="count-odds-head">Suggested play</div>',
      '<div class="count-odds-head">Win</div>',
      '<div class="count-odds-head">Tie</div>',
      '<div class="count-odds-head">Lose</div>',
      '<div class="count-odds-head">Avg result</div>',
      COUNT_EXAMPLES.map(function (trueCount) {
        const action = countAwareAction(scenario, trueCount);
        const outcome = outcomeForAction(scenario.cards, scenario.dealer, action, countAdjustedDraws(trueCount));
        return [
          '<div class="count-odds-cell">' + (trueCount === 0 ? "TC 0" : "TC " + formatCount(trueCount)) + '</div>',
          '<div class="count-odds-cell"><strong>' + ACTIONS[action].label + '</strong></div>',
          '<div class="count-odds-cell">' + formatPercent(outcome.win) + '</div>',
          '<div class="count-odds-cell">' + formatPercent(outcome.push) + '</div>',
          '<div class="count-odds-cell">' + formatPercent(outcome.lose) + '</div>',
          '<div class="count-odds-cell">' + formatAverageResult(outcomeAverageResult(outcome, action)) + '</div>'
        ].join("");
      }).join(""),
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

  function makeAssessmentSession() {
    const questions = []
      .concat(makeStrategyAssessmentQuestions(ASSESSMENT_COUNTS.strategy))
      .concat(makeCardValueAssessmentQuestions(ASSESSMENT_COUNTS.value))
      .concat(makeRunningCountAssessmentQuestions(ASSESSMENT_COUNTS.running))
      .concat(makeDeviationAssessmentQuestions(ASSESSMENT_COUNTS.deviation));
    return {
      questions: questions,
      answers: [],
      index: 0,
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      status: "active",
      result: null
    };
  }

  function makeStrategyAssessmentQuestions(count) {
    const typeCycle = ["hard", "soft", "pair"];
    const questions = [];
    const used = {};
    let attempts = 0;

    while (questions.length < count && attempts < count * 10) {
      const type = typeCycle[questions.length % typeCycle.length];
      const rows = ROW_GROUPS[type];
      const row = rows[Math.floor(Math.random() * rows.length)];
      const dealer = DEALERS[Math.floor(Math.random() * DEALERS.length)];
      const cards = randomPracticeCards(row);
      const key = type + ":" + row.id + ":" + dealer + ":" + cards.join("-");
      attempts += 1;
      if (used[key]) {
        continue;
      }
      used[key] = true;
      questions.push(makeHandQuestion("strategy", type, row, dealer, cards, null));
    }

    while (questions.length < count) {
      const scenario = makePracticeScenario();
      questions.push(makeHandQuestion("strategy", scenario.type, scenario.row, scenario.dealer, scenario.cards, null));
    }

    return questions;
  }

  function makeCardValueAssessmentQuestions(count) {
    const questions = [];
    for (let index = 0; index < count; index += 1) {
      const card = randomCountCard();
      questions.push({
        kind: "value",
        section: ASSESSMENT_SECTIONS.value,
        prompt: "Choose this card's Hi-Lo value.",
        card: card,
        correct: String(hiLoValue(card.rank))
      });
    }
    return questions;
  }

  function makeRunningCountAssessmentQuestions(count) {
    const questions = [];
    for (let index = 0; index < count; index += 1) {
      const cards = makeRandomCountSequence(ASSESSMENT_RUN_LENGTH);
      questions.push({
        kind: "running",
        section: ASSESSMENT_SECTIONS.running,
        prompt: "Keep the running count through this " + ASSESSMENT_RUN_LENGTH + "-card stream.",
        cards: cards,
        cardIndex: 0,
        correct: String(countSequenceTotal(cards))
      });
    }
    return questions;
  }

  function makeDeviationAssessmentQuestions(count) {
    return shuffled(DEVIATION_EXAM_BANK).slice(0, count).map(function (item) {
      const row = findRow(item.type, item.rowId);
      return makeHandQuestion("deviation", item.type, row, item.dealer, item.cards, item.trueCount);
    });
  }

  function makeHandQuestion(kind, type, row, dealer, cards, trueCount) {
    const scenario = {
      dealer: dealer,
      type: type,
      kindLabel: type === "pair" ? "Pair decision" : type.charAt(0).toUpperCase() + type.slice(1) + " total",
      cards: cards.slice(),
      handLabel: exactHandLabel(cards, type),
      row: row
    };
    const correct = kind === "deviation" ? countAwareAction(scenario, trueCount) : actionFor(row, dealer);
    return {
      kind: kind,
      section: kind === "deviation" ? ASSESSMENT_SECTIONS.deviation : ASSESSMENT_SECTIONS.strategy,
      prompt: kind === "deviation" ? "Choose the count-adjusted play." : "Choose the basic strategy play.",
      scenario: scenario,
      trueCount: trueCount,
      correct: correct
    };
  }

  function currentAssessmentQuestion() {
    const session = state.assessmentSession;
    if (!session || session.status !== "active") {
      return null;
    }
    return session.questions[session.index] || null;
  }

  function currentAssessmentAnswer() {
    const session = state.assessmentSession;
    if (!session) {
      return null;
    }
    return session.answers[session.index] || null;
  }

  function recordAssessmentAnswer(value) {
    const session = state.assessmentSession;
    const question = currentAssessmentQuestion();
    if (!session || !question) {
      return;
    }
    const answer = {
      selected: String(value),
      correct: String(value) === String(question.correct)
    };
    if (question.kind === "value") {
      answer.elapsedMs = Math.max(0, Date.now() - session.questionStartedAt);
    }
    session.answers[session.index] = answer;
  }

  function canAdvanceAssessment() {
    const question = currentAssessmentQuestion();
    const answer = currentAssessmentAnswer();
    if (!question) {
      return false;
    }
    if (question.kind === "running") {
      return question.cardIndex >= question.cards.length && Boolean(answer);
    }
    return Boolean(answer);
  }

  function liveAssessmentStats(session) {
    const sections = {};
    Object.keys(ASSESSMENT_SECTIONS).forEach(function (key) {
      sections[key] = {
        label: ASSESSMENT_SECTIONS[key],
        correct: 0,
        answered: 0
      };
    });

    let answered = 0;
    let correct = 0;
    session.answers.forEach(function (answer, index) {
      const question = session.questions[index];
      if (!answer || !question) {
        return;
      }
      answered += 1;
      sections[question.kind].answered += 1;
      if (answer.correct) {
        correct += 1;
        sections[question.kind].correct += 1;
      }
    });

    return {
      answered: answered,
      correct: correct,
      total: session.questions.length,
      percent: answered ? Math.round((correct / answered) * 100) : 0,
      sections: sections
    };
  }

  function advanceAssessment() {
    const session = state.assessmentSession;
    if (!session || !canAdvanceAssessment()) {
      return;
    }
    if (session.index >= session.questions.length - 1) {
      finishAssessment();
      return;
    }
    session.index += 1;
    session.questionStartedAt = Date.now();
  }

  function finishAssessment() {
    const session = state.assessmentSession;
    const result = scoreAssessment(session);
    session.status = "complete";
    session.result = result;
    state.progress.assessment.latest = result;
    saveProgress();
  }

  function scoreAssessment(session) {
    const sections = {};
    Object.keys(ASSESSMENT_SECTIONS).forEach(function (key) {
      sections[key] = {
        label: ASSESSMENT_SECTIONS[key],
        correct: 0,
        total: 0,
        percent: 0
      };
    });

    const missed = [];
    let totalCorrect = 0;
    let totalQuestions = 0;
    const valueTimes = [];

    session.questions.forEach(function (question, index) {
      const answer = session.answers[index];
      const section = sections[question.kind];
      section.total += 1;
      totalQuestions += 1;
      if (answer && answer.correct) {
        section.correct += 1;
        totalCorrect += 1;
      } else {
        missed.push(assessmentMissLabel(question));
      }
      if (question.kind === "value" && answer && answer.elapsedMs !== undefined) {
        valueTimes.push(answer.elapsedMs);
      }
    });

    Object.keys(sections).forEach(function (key) {
      const section = sections[key];
      section.percent = section.total ? Math.round((section.correct / section.total) * 100) : 0;
    });

    const totalPercent = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return {
      completedAt: new Date().toISOString(),
      totalCorrect: totalCorrect,
      totalQuestions: totalQuestions,
      totalPercent: totalPercent,
      level: assessmentLevel(totalPercent, sections),
      sections: sections,
      averageValueMs: Math.round(average(valueTimes)),
      recommendation: assessmentRecommendation(sections),
      missed: missed.slice(0, 8)
    };
  }

  function assessmentLevel(totalPercent, sections) {
    if (totalPercent < 60) {
      return "Beginner";
    }
    if (totalPercent < 75) {
      return "Developing";
    }
    if (sections.strategy.percent >= 90 && sections.value.percent >= 90 && sections.running.percent >= 90 && sections.deviation.percent >= 80) {
      return "Advanced";
    }
    if (sections.strategy.percent >= 90 && sections.value.percent >= 80 && sections.running.percent >= 50) {
      return "Counting Ready";
    }
    return "Solid Basic Strategy";
  }

  function assessmentRecommendation(sections) {
    const ordered = Object.keys(sections).sort(function (a, b) {
      return sections[a].percent - sections[b].percent;
    });
    const weakest = ordered[0];
    if (weakest === "strategy") {
      return "Practice basic strategy hands before adding more count deviations.";
    }
    if (weakest === "value") {
      return "Use the Card Value Drill until +1, 0, and -1 are automatic.";
    }
    if (weakest === "running") {
      return "Use the Running Count Drill with 12-card runs, then move to full decks.";
    }
    return "Review the Count Changes section in the Strategy Chart.";
  }

  function assessmentMissLabel(question) {
    if (question.kind === "value") {
      return question.card.rank + " is " + formatCount(parseInt(question.correct, 10));
    }
    if (question.kind === "running") {
      return "Running count: " + formatCount(parseInt(question.correct, 10));
    }
    const scenario = question.scenario;
    const countLabel = question.kind === "deviation" ? " at TC " + formatCount(question.trueCount) : "";
    return scenario.handLabel + " vs dealer " + scenario.dealer + countLabel + ": " + ACTIONS[question.correct].label;
  }

  function assessmentCorrectLabel(question) {
    if (question.kind === "value" || question.kind === "running") {
      return formatCount(parseInt(question.correct, 10));
    }
    return ACTIONS[question.correct].label;
  }

  function compactAssessmentResult(result) {
    const clean = sanitizeAssessmentResult(result);
    return {
      completedAt: clean.completedAt,
      totalCorrect: clean.totalCorrect,
      totalQuestions: clean.totalQuestions,
      totalPercent: clean.totalPercent,
      level: clean.level,
      sections: clean.sections,
      averageValueMs: clean.averageValueMs,
      recommendation: clean.recommendation,
      missed: clean.missed
    };
  }

  function sanitizeNumber(value, fallback) {
    const number = parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
  }

  function sanitizeShareText(value, maxLength) {
    return String(value || "")
      .slice(0, maxLength)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeAssessmentResult(result) {
    if (!result) {
      return null;
    }
    const sections = {};
    Object.keys(ASSESSMENT_SECTIONS).forEach(function (key) {
      const source = result.sections && result.sections[key] ? result.sections[key] : {};
      sections[key] = {
        label: ASSESSMENT_SECTIONS[key],
        correct: sanitizeNumber(source.correct, 0),
        total: sanitizeNumber(source.total, 0),
        percent: sanitizeNumber(source.percent, 0)
      };
    });
    return {
      completedAt: sanitizeShareText(result.completedAt, 40),
      totalCorrect: sanitizeNumber(result.totalCorrect, 0),
      totalQuestions: sanitizeNumber(result.totalQuestions, 0),
      totalPercent: sanitizeNumber(result.totalPercent, 0),
      level: sanitizeShareText(result.level, 40),
      sections: sections,
      averageValueMs: sanitizeNumber(result.averageValueMs, 0),
      recommendation: sanitizeShareText(result.recommendation, 220),
      missed: Array.isArray(result.missed) ? result.missed.slice(0, 8).map(function (item) {
        return sanitizeShareText(item, 140);
      }) : []
    };
  }

  function encodeAssessmentShare(result) {
    try {
      return window.btoa(JSON.stringify(compactAssessmentResult(result)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    } catch (error) {
      return "";
    }
  }

  function decodeAssessmentShare(payload) {
    try {
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      return sanitizeAssessmentResult(JSON.parse(window.atob(padded)));
    } catch (error) {
      return null;
    }
  }

  function assessmentShareUrl(result) {
    return window.location.origin + window.location.pathname + "#/assessment/result/" + encodeAssessmentShare(result);
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
      '<p class="muted">Hi-Lo drills for card values and mental running count practice.</p>',
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
      { key: "running", label: "Running Count" }
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
    return renderCardValueDrill();
  }

  function renderCardValueDrill() {
    const card = state.countingValueCard;
    const feedback = state.countingValueFeedback;
    return [
      '<section class="counting-drill">',
      '<div class="drill-copy">',
      '<h3>Card Value Drill</h3>',
      '<p class="muted">Look at the card and choose its Hi-Lo value. Correct answers advance immediately.</p>',
      '</div>',
      '<div class="count-card-stage">',
      renderLargeCountingCard(card),
      '</div>',
      renderCountChoiceButtons("data-counting-value-answer", Boolean(feedback)),
      feedback ? renderCountingFeedback(feedback.correct, feedback.message) : "",
      '<div class="controls-row">',
      '<button class="secondary-button" type="button" data-action="new-count-card">New card</button>',
      '</div>',
      renderValueSpeedPanel(),
      '</section>'
    ].join("");
  }

  function renderValueSpeedPanel() {
    const last = state.countingValueLastMs;
    const averageMs = average(state.countingValueSpeeds);
    const rating = state.countingValueLastWasCorrect === false ? {
      label: "Accuracy first",
      copy: "That answer was wrong. Slow down until the values feel automatic."
    } : valueSpeedRating(averageMs || last);
    return [
      '<div class="speed-panel">',
      '<div class="speed-metric"><span>Last tap</span><strong>' + (last ? formatSeconds(last) : "-") + '</strong></div>',
      '<div class="speed-metric"><span>Correct avg</span><strong>' + (averageMs ? formatSeconds(averageMs) : "-") + '</strong></div>',
      '<div class="speed-message"><strong>' + rating.label + '</strong><span>' + rating.copy + '</span></div>',
      '</div>'
    ].join("");
  }

  function renderRunningCountDrill() {
    const cards = state.countingRunCards;
    const index = state.countingRunIndex;
    const done = index >= cards.length;
    const card = done ? null : cards[index];
    const feedback = state.countingRunFeedback;
    const runType = COUNT_RUN_TYPES[state.countingRunType];
    const currentCount = currentRunCount();
    const elapsed = currentRunElapsed();
    const cardsSeen = currentRunCardsSeenCount();
    const pace = currentRunPace();
    return [
      '<section class="counting-drill">',
      '<div class="drill-copy">',
      '<h3>Running Count Drill</h3>',
      '<p class="muted">Watch one card at a time and keep the running count in your head. Answer only at the end.</p>',
      '</div>',
      renderCountingRunOptions(),
      '<div class="deck-progress">',
      '<div class="stat"><strong>' + Math.min(index + 1, cards.length) + '/' + cards.length + '</strong><span>Card position</span></div>',
      '<div class="stat"><strong>' + runType.label + '</strong><span>' + runType.detail + '</span></div>',
      '<div class="stat"><strong>' + state.progress.counting.decksCompleted + '</strong><span>Runs completed</span></div>',
      '</div>',
      done ? renderRunningCountAnswer() : renderRunningCountCard(card),
      state.countingRunShowCount ? '<div class="count-reveal">Current count: <strong>' + formatCount(currentCount) + '</strong></div>' : "",
      feedback ? renderCountingFeedback(feedback.correct, feedback.message) : "",
      '<div class="controls-row">',
      done ? '<button class="primary-button" type="button" data-action="check-count-run">Check count</button>' : '<button class="primary-button" type="button" data-action="next-count-card">Next card</button>',
      '<button class="secondary-button" type="button" data-action="toggle-count-reveal">' + (state.countingRunShowCount ? "Hide count" : "Show count") + '</button>',
      '<button class="secondary-button" type="button" data-action="new-count-run">New run</button>',
      '</div>',
      renderRunTimerPanel(elapsed, cardsSeen, pace),
      '</section>'
    ].join("");
  }

  function renderRunTimerPanel(elapsed, cardsSeen, pace) {
    return [
      '<div class="speed-panel run-timer-panel">',
      '<div class="speed-metric"><span>Elapsed</span><strong data-run-elapsed>' + formatSeconds(elapsed) + '</strong></div>',
      '<div class="speed-metric"><span>Cards seen</span><strong data-run-cards-seen>' + cardsSeen + '</strong></div>',
      '<div class="speed-message"><strong data-run-pace-label>' + pace.label + '</strong><span data-run-pace-copy>' + pace.copy + '</span></div>',
      '</div>'
    ].join("");
  }

  function renderCountingRunOptions() {
    return [
      '<div class="run-options" aria-label="Running count drill size">',
      Object.keys(COUNT_RUN_TYPES).map(function (key) {
        const option = COUNT_RUN_TYPES[key];
        const classes = ["run-option"];
        if (state.countingRunType === key) {
          classes.push("active");
        }
        return [
          '<button class="' + classes.join(" ") + '" type="button" data-counting-run-type="' + key + '">',
          '<strong>' + option.label + '</strong>',
          '<span>' + option.description + '</span>',
          '</button>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");
  }

  function renderRunningCountCard(card) {
    return [
      '<div class="count-card-stage" data-card-transition="' + state.countingRunTransition + '">',
      renderLargeCountingCard(card),
      '</div>',
      '<p class="math-note">Include this card in your mental count before pressing Next card.</p>'
    ].join("");
  }

  function renderRunningCountAnswer() {
    const selected = state.countingRunAnswer;
    return [
      '<div class="final-count-picker">',
      '<strong>Final running count</strong>',
      '<div class="count-answer-grid">',
      countAnswerOptions().map(function (value) {
        const classes = ["count-answer-button"];
        if (String(value) === String(selected)) {
          classes.push("selected");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-counting-run-answer="' + value + '">' + formatCount(value) + '</button>';
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function countAnswerOptions() {
    const options = [];
    for (let value = -12; value <= 12; value += 1) {
      options.push(value);
    }
    return options;
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

  function renderAssessment() {
    const session = state.assessmentSession;
    if (session && session.status === "active") {
      renderAssessmentQuestion(session);
      return;
    }
    if (session && session.status === "complete") {
      renderAssessmentResults(session.result, false);
      return;
    }
    if (session && session.status === "shared") {
      renderAssessmentResults(session.result, true);
      return;
    }
    renderAssessmentIntro();
  }

  function renderAssessmentIntro() {
    const latest = state.progress.assessment.latest;
    app.innerHTML = [
      '<section class="assessment-panel">',
      '<div class="panel-header">',
      '<div><h2>Assessment</h2><p class="muted">A general exam for basic strategy, counting speed, running count, and count changes.</p></div>',
      '<button class="primary-button" type="button" data-action="start-assessment">Start assessment</button>',
      '</div>',
      '<div class="assessment-overview">',
      renderAssessmentOverviewItem("Basic strategy", ASSESSMENT_COUNTS.strategy, "Random hard totals, soft totals, pairs, and dealer upcards."),
      renderAssessmentOverviewItem("Card values", ASSESSMENT_COUNTS.value, "Quick Hi-Lo +1, 0, and -1 recognition."),
      renderAssessmentOverviewItem("Running count", ASSESSMENT_COUNTS.running, "One " + ASSESSMENT_RUN_LENGTH + "-card stream with a final count answer."),
      renderAssessmentOverviewItem("Count changes", ASSESSMENT_COUNTS.deviation, "Common Hi-Lo index decisions after basic strategy."),
      '</div>',
      latest ? renderLatestAssessment(latest) : "",
      '</section>'
    ].join("");
  }

  function renderAssessmentOverviewItem(label, count, copy) {
    return [
      '<article class="assessment-overview-item">',
      '<strong>' + count + '</strong>',
      '<span>' + label + '</span>',
      '<p>' + copy + '</p>',
      '</article>'
    ].join("");
  }

  function renderLatestAssessment(result) {
    return [
      '<div class="latest-assessment">',
      '<div>',
      '<strong>Latest result: ' + result.level + '</strong>',
      '<span>' + result.totalPercent + '% on ' + new Date(result.completedAt).toLocaleDateString() + '</span>',
      '</div>',
      '<button class="secondary-button" type="button" data-action="show-latest-assessment">View result</button>',
      '</div>'
    ].join("");
  }

  function renderAssessmentQuestion(session) {
    const question = session.questions[session.index];
    const progressText = "Question " + (session.index + 1) + " / " + session.questions.length;
    app.innerHTML = [
      '<section class="assessment-panel">',
      '<div class="panel-header">',
      '<div>',
      '<h2>Assessment</h2>',
      '<p class="muted">' + progressText + ' | ' + question.section + '</p>',
      '</div>',
      '<button class="secondary-button" type="button" data-action="cancel-assessment">Exit assessment</button>',
      '</div>',
      '<div class="assessment-progress"><span style="width: ' + Math.round((session.index / session.questions.length) * 100) + '%"></span></div>',
      renderAssessmentLiveSummary(session),
      renderAssessmentQuestionBody(question),
      '</section>'
    ].join("");
  }

  function renderAssessmentLiveSummary(session) {
    const stats = liveAssessmentStats(session);
    return [
      '<div class="assessment-live-summary">',
      '<div class="live-score-main">',
      '<span>Live score</span>',
      '<strong>' + stats.correct + '/' + stats.answered + '</strong>',
      '<small>' + (stats.answered ? stats.percent + "% correct" : "Answer to start scoring") + '</small>',
      '</div>',
      '<div class="live-score-sections">',
      Object.keys(stats.sections).map(function (key) {
        const section = stats.sections[key];
        return '<span>' + section.label + ': <strong>' + section.correct + '/' + section.answered + '</strong></span>';
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderAssessmentQuestionBody(question) {
    if (question.kind === "value") {
      return renderAssessmentValueQuestion(question);
    }
    if (question.kind === "running") {
      return renderAssessmentRunningQuestion(question);
    }
    return renderAssessmentHandQuestion(question);
  }

  function renderAssessmentHandQuestion(question) {
    const scenario = question.scenario;
    return [
      '<div class="assessment-card">',
      '<p class="muted">' + question.prompt + '</p>',
      '<h2>' + scenario.handLabel + ' vs dealer ' + scenario.dealer + '</h2>',
      question.kind === "deviation" ? '<div class="count-chip">True count ' + formatCount(question.trueCount) + '</div>' : "",
      renderPracticeTable(scenario),
      renderAssessmentActionChoices(question),
      renderAssessmentAnswerFeedback(question),
      renderAssessmentSplitPreview(question),
      renderAssessmentNextRow(),
      '</div>'
    ].join("");
  }

  function renderAssessmentActionChoices(question) {
    const answer = currentAssessmentAnswer();
    const scenario = question.scenario;
    return [
      '<div class="action-row">',
      practiceActionsForScenario(scenario).map(function (action) {
        const classes = ["action-button"];
        if (answer && answer.selected === action) {
          classes.push("selected");
        }
        if (answer && action === question.correct) {
          classes.push("correct");
        }
        if (answer && answer.selected === action && action !== question.correct) {
          classes.push("incorrect");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-assessment-answer="' + action + '">' + ACTIONS[action].label + '</button>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function renderAssessmentValueQuestion(question) {
    const answer = currentAssessmentAnswer();
    return [
      '<div class="assessment-card compact-assessment-card">',
      '<p class="muted">' + question.prompt + '</p>',
      '<div class="count-card-stage">',
      renderLargeCountingCard(question.card),
      '</div>',
      '<div class="count-choice-row">',
      COUNT_CHOICES.map(function (value) {
        const classes = ["count-choice"];
        if (answer && answer.selected === String(value)) {
          classes.push("selected-count");
        }
        if (answer && String(value) === String(question.correct)) {
          classes.push("answer-correct");
        }
        if (answer && answer.selected === String(value) && String(value) !== String(question.correct)) {
          classes.push("answer-incorrect");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-assessment-answer="' + value + '">' + formatCount(value) + '</button>';
      }).join(""),
      '</div>',
      renderAssessmentAnswerFeedback(question),
      renderAssessmentNextRow(),
      '</div>'
    ].join("");
  }

  function renderAssessmentRunningQuestion(question) {
    const answer = currentAssessmentAnswer();
    const done = question.cardIndex >= question.cards.length;
    const card = done ? null : question.cards[question.cardIndex];
    return [
      '<div class="assessment-card compact-assessment-card">',
      '<p class="muted">' + question.prompt + '</p>',
      '<h2>Running Count</h2>',
      done ? renderAssessmentRunningAnswer(question, answer) : [
        '<div class="deck-progress assessment-run-progress">',
        '<div class="stat"><strong>' + (question.cardIndex + 1) + '/' + question.cards.length + '</strong><span>Card position</span></div>',
        '<div class="stat"><strong>No hints</strong><span>Keep count mentally</span></div>',
        '</div>',
        '<div class="count-card-stage">',
        renderLargeCountingCard(card),
        '</div>',
        '<div class="controls-row">',
        '<button class="primary-button" type="button" data-action="assessment-next-run-card">Next card</button>',
        '</div>'
      ].join(""),
      done ? renderAssessmentAnswerFeedback(question) : "",
      done ? renderAssessmentNextRow() : "",
      '</div>'
    ].join("");
  }

  function renderAssessmentRunningAnswer(question, answer) {
    return [
      '<div class="final-count-picker">',
      '<strong>Final running count</strong>',
      '<div class="count-answer-grid">',
      countAnswerOptions().map(function (value) {
        const classes = ["count-answer-button"];
        if (answer && answer.selected === String(value)) {
          classes.push("selected");
        }
        if (answer && String(value) === String(question.correct)) {
          classes.push("answer-correct");
        }
        if (answer && answer.selected === String(value) && String(value) !== String(question.correct)) {
          classes.push("answer-incorrect");
        }
        return '<button class="' + classes.join(" ") + '" type="button" data-assessment-running-answer="' + value + '">' + formatCount(value) + '</button>';
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderAssessmentAnswerFeedback(question) {
    const answer = currentAssessmentAnswer();
    if (!answer) {
      return "";
    }
    return [
      '<div class="assessment-answer-feedback ' + (answer.correct ? "good" : "bad") + '">',
      '<strong>' + (answer.correct ? "Correct" : "Not this one") + '</strong>',
      '<span>Correct answer: ' + assessmentCorrectLabel(question) + '</span>',
      '</div>'
    ].join("");
  }

  function renderAssessmentSplitPreview(question) {
    const answer = currentAssessmentAnswer();
    if (!answer || !question.scenario) {
      return "";
    }
    return renderSplitPreviewForActions(question.scenario, answer.selected, question.correct);
  }

  function renderAssessmentNextRow() {
    const session = state.assessmentSession;
    const isLast = session && session.index >= session.questions.length - 1;
    return [
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="assessment-next" ' + (canAdvanceAssessment() ? "" : "disabled") + '>' + (isLast ? "Finish assessment" : "Next question") + '</button>',
      '</div>'
    ].join("");
  }

  function renderAssessmentResults(result, shared) {
    result = sanitizeAssessmentResult(result);
    if (!result) {
      app.innerHTML = [
        '<section class="assessment-panel">',
        '<div class="panel-header">',
        '<div><h2>Assessment Result</h2><p class="muted">This shared result link is invalid.</p></div>',
        '<button class="primary-button" type="button" data-action="start-assessment">Take assessment</button>',
        '</div>',
        '</section>'
      ].join("");
      return;
    }
    const shareUrl = assessmentShareUrl(result);
    app.innerHTML = [
      '<section class="assessment-panel">',
      '<div class="panel-header">',
      '<div><h2>' + (shared ? "Shared Assessment Result" : "Assessment Result") + '</h2><p class="muted">' + result.totalCorrect + ' of ' + result.totalQuestions + ' correct</p></div>',
      '<button class="primary-button" type="button" data-action="start-assessment">' + (shared ? "Take assessment" : "Retake assessment") + '</button>',
      '</div>',
      '<div class="result-hero">',
      '<span>Skill level</span>',
      '<strong>' + result.level + '</strong>',
      '<p>' + result.totalPercent + '% overall</p>',
      '</div>',
      renderAssessmentResultGrid(result),
      renderAssessmentShareList(result),
      '<div class="assessment-recommendation">',
      '<strong>Recommended next step</strong>',
      '<p>' + result.recommendation + '</p>',
      '</div>',
      result.missed.length ? renderAssessmentMisses(result.missed) : "",
      '<div class="share-result-box">',
      '<strong>Share result page</strong>',
      '<p>This link contains the result in the URL. No account or server is needed.</p>',
      '<a class="secondary-link-button" href="' + shareUrl + '">Open share page</a>',
      '<button class="secondary-button" type="button" data-action="copy-assessment-link" data-share-url="' + shareUrl + '">' + (state.assessmentShareCopied ? "Copied" : "Copy link") + '</button>',
      '</div>',
      '<div class="controls-row">',
      '<button class="secondary-button" type="button" data-action="close-assessment-result">Back to assessment</button>',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderAssessmentShareList(result) {
    return [
      '<div class="assessment-share-list">',
      '<strong>Share summary</strong>',
      '<ul>',
      '<li>Overall: ' + result.totalPercent + '% (' + result.level + ')</li>',
      Object.keys(result.sections).map(function (key) {
        const section = result.sections[key];
        return '<li>' + section.label + ': ' + section.correct + '/' + section.total + ' (' + section.percent + '%)</li>';
      }).join(""),
      '<li>Card speed: ' + (result.averageValueMs ? formatSeconds(result.averageValueMs) : "not recorded") + '</li>',
      '</ul>',
      '</div>'
    ].join("");
  }

  function renderAssessmentResultGrid(result) {
    return [
      '<div class="assessment-result-grid">',
      Object.keys(result.sections).map(function (key) {
        const section = result.sections[key];
        return [
          '<article class="assessment-result-item">',
          '<strong>' + section.percent + '%</strong>',
          '<span>' + section.label + '</span>',
          '<p>' + section.correct + ' / ' + section.total + ' correct</p>',
          '</article>'
        ].join("");
      }).join(""),
      '<article class="assessment-result-item">',
      '<strong>' + (result.averageValueMs ? formatSeconds(result.averageValueMs) : "-") + '</strong>',
      '<span>Card speed</span>',
      '<p>Average Hi-Lo value response</p>',
      '</article>',
      '</div>'
    ].join("");
  }

  function renderAssessmentMisses(missed) {
    return [
      '<div class="assessment-misses">',
      '<strong>Review these</strong>',
      '<ul>',
      missed.map(function (item) {
        return '<li>' + item + '</li>';
      }).join(""),
      '</ul>',
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
      renderCountDeviationGuide(),
      '<div class="chart-note">',
      '<strong>Legend:</strong> H = Hit, S = Stand, D = Double, P = Split. A star means a common Hi-Lo index can change the play. When doubling is unavailable, play the hand as a hit unless local rules say otherwise.',
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
        return renderChartCell(row, dealer);
      }).join(""),
      '</tr>'
    ].join("");
  }

  function renderChartCell(row, dealer) {
    const action = actionFor(row, dealer);
    const deviations = countDeviationsForChartCell(row, dealer);
    const classes = ["chart-action", ACTIONS[action].className];
    const title = [ACTIONS[action].label].concat(deviations.map(function (deviation) {
      return deviation.hand + ": " + deviation.rule;
    })).join(" | ");
    if (deviations.length) {
      classes.push("count-sensitive");
    }
    return [
      '<td>',
      '<span title="' + title + '" class="' + classes.join(" ") + '">',
      ACTIONS[action].short,
      deviations.length ? '<sup>*</sup>' : "",
      '</span>',
      '</td>'
    ].join("");
  }

  function renderCountDeviationGuide() {
    return [
      '<section class="count-deviation-guide">',
      '<div class="section-heading chart-section-heading">',
      '<h3>Count Changes</h3>',
      '<p class="section-subtitle">Common Hi-Lo index plays. Use them after basic strategy feels automatic.</p>',
      '</div>',
      '<div class="deviation-grid">',
      COUNT_DEVIATIONS.map(function (deviation) {
        return [
          '<article class="deviation-item">',
          '<strong>' + deviation.hand + ' vs dealer ' + deviation.dealer + '</strong>',
          '<span>' + ACTIONS[deviation.base].label + ' becomes ' + ACTIONS[deviation.action].label + '</span>',
          '<p>' + deviation.rule + '</p>',
          '</article>'
        ].join("");
      }).join(""),
      '<article class="deviation-item">',
      '<strong>' + INSURANCE_DEVIATION.hand + ' vs dealer ' + INSURANCE_DEVIATION.dealer + '</strong>',
      '<span>' + INSURANCE_DEVIATION.action + '</span>',
      '<p>' + INSURANCE_DEVIATION.rule + '</p>',
      '</article>',
      '</div>',
      '<p class="math-note">Cells with ranges, like Hard 13-16, are starred when at least one exact total in that range has a count change.</p>',
      '</section>'
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

  function renderHiddenCard(label) {
    return [
      '<div class="playing-card card-back" aria-label="' + (label || "Hidden dealer card") + '">',
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
    state.assessmentSession = null;
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

    if (target.dataset.assessmentAnswer !== undefined) {
      recordAssessmentAnswer(target.dataset.assessmentAnswer);
      render();
      return;
    }

    if (target.dataset.assessmentRunningAnswer !== undefined) {
      recordAssessmentAnswer(target.dataset.assessmentRunningAnswer);
      render();
      return;
    }

    if (target.dataset.countingMode) {
      state.countingMode = target.dataset.countingMode;
      ensureCountingState();
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.countingRunType) {
      state.countingRunType = target.dataset.countingRunType;
      resetCountingRun();
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
      const elapsed = Math.max(0, Date.now() - state.countingValueStartedAt);
      state.countingValueLastMs = elapsed;
      state.countingValueLastWasCorrect = isCorrect;
      if (isCorrect) {
        state.countingValueSpeeds.push(elapsed);
        state.countingValueSpeeds = state.countingValueSpeeds.slice(-12);
      }
      recordCountingResult(isCorrect);
      if (isCorrect) {
        resetCountingValueCard();
      } else {
        state.countingValueFeedback = {
          correct: false,
          message: state.countingValueCard.rank + " is " + formatCount(expected) + "."
        };
      }
      render();
      return;
    }

    if (target.dataset.countingRunAnswer !== undefined) {
      state.countingRunAnswer = target.dataset.countingRunAnswer;
      state.countingRunFeedback = null;
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
        selected: target.dataset.practiceAnswer,
        action: correctAction,
        scenario: scenario,
        explanation: explain(scenario.row, scenario.dealer)
      };
      saveProgress();
      render();
      return;
    }

    if (target.dataset.action === "start-assessment") {
      state.assessmentSession = makeAssessmentSession();
      state.assessmentShareCopied = false;
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.action === "show-latest-assessment") {
      state.assessmentSession = {
        status: "complete",
        result: state.progress.assessment.latest,
        questions: [],
        answers: [],
        index: 0
      };
      state.assessmentShareCopied = false;
      render();
      return;
    }

    if (target.dataset.action === "cancel-assessment") {
      state.assessmentSession = null;
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.action === "close-assessment-result") {
      state.assessmentSession = null;
      state.assessmentShareCopied = false;
      syncUrl(false);
      render();
      return;
    }

    if (target.dataset.action === "copy-assessment-link") {
      const shareUrl = target.dataset.shareUrl;
      if (shareUrl && window.navigator.clipboard) {
        window.navigator.clipboard.writeText(shareUrl).catch(function () {});
      }
      state.assessmentShareCopied = true;
      render();
      return;
    }

    if (target.dataset.action === "assessment-next-run-card") {
      const question = currentAssessmentQuestion();
      if (question && question.kind === "running" && question.cardIndex < question.cards.length) {
        question.cardIndex += 1;
        render();
      }
      return;
    }

    if (target.dataset.action === "assessment-next") {
      advanceAssessment();
      render();
      return;
    }

    if (target.dataset.action === "new-count-card") {
      resetCountingValueCard();
      render();
      return;
    }

    if (target.dataset.action === "next-count-card") {
      if (!state.countingRunCards || state.countingRunIndex >= state.countingRunCards.length) {
        return;
      }
      state.countingRunIndex += 1;
      state.countingRunLastAdvancedAt = Date.now();
      state.countingRunTransition += 1;
      if (state.countingRunIndex >= state.countingRunCards.length) {
        state.countingRunFinishedAt = state.countingRunLastAdvancedAt;
      }
      state.countingRunFeedback = null;
      state.countingRunShowCount = false;
      render();
      return;
    }

    if (target.dataset.action === "toggle-count-reveal") {
      state.countingRunShowCount = !state.countingRunShowCount;
      render();
      return;
    }

    if (target.dataset.action === "check-count-run") {
      if (state.countingRunFeedback) {
        return;
      }
      const expected = countSequenceTotal(state.countingRunCards);
      const selected = parseInt(state.countingRunAnswer, 10);
      const isNumber = !Number.isNaN(selected);
      const isCorrect = isNumber && selected === expected;
      state.countingRunFeedback = {
        correct: isCorrect,
        message: isNumber ?
          "The final running count is " + formatCount(expected) + "." :
          "Select a final running count before checking."
      };
      if (!isNumber) {
        render();
        return;
      }
      state.progress.counting.decksCompleted += 1;
      recordCountingResult(isCorrect);
      render();
      return;
    }

    if (target.dataset.action === "new-count-run") {
      resetCountingRun();
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
