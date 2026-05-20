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

  const DEALER_NOTES = {
    "2": {
      headline: "Dealer shows 2",
      summary: "A 2 is weak, but it is the least scary of the small dealer cards. Stand on many stiff hard totals, double clear value hands, and do not force marginal soft doubles.",
      pressure: "Dealer 2 creates some bust pressure, but not enough to overplay every borderline hand."
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
      why: "Hard 12 is fragile; it stands only into the dealer's strongest bust cards."
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

  const QUIZ_ROWS = [
    { type: "hard", id: "hard-12" },
    { type: "hard", id: "hard-13-16" },
    { type: "soft", id: "soft-18" },
    { type: "pair", id: "pair-8" }
  ];

  const SUITS = ["S", "H", "D", "C"];
  const app = document.getElementById("app");
  const tabButtons = Array.from(document.querySelectorAll(".tab"));

  const state = {
    activeTab: "learn",
    selectedDealer: "2",
    chartMode: "hard",
    quizAnswers: {},
    quizSubmitted: false,
    practiceScenario: null,
    practiceFeedback: null,
    progress: loadProgress()
  };

  state.selectedDealer = state.progress.currentDealer || "2";

  function loadProgress() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultProgress();
      }
      const parsed = JSON.parse(raw);
      return Object.assign(defaultProgress(), parsed, {
        stats: Object.assign(defaultProgress().stats, parsed.stats || {}),
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
    const index = dealerIndex(dealer);
    if (index === 0) {
      return true;
    }
    return isComplete(dealer) || isComplete(DEALERS[index - 1]);
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

  function explain(row, dealer) {
    const action = actionFor(row, dealer);
    return row.why + " Against dealer " + dealer + ", " + DEALER_NOTES[dealer].pressure + " Basic strategy says to " + ACTIONS[action].verb + ".";
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
      '<div><h2>Dealer Path</h2><p class="muted">Unlock one upcard at a time.</p></div>',
      '</div>',
      '<div class="dealer-list">',
      DEALERS.map(renderDealerButton).join(""),
      '</div>',
      '<div class="stat-grid">',
      '<div class="stat"><strong>' + completed + '</strong><span>Lessons done</span></div>',
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
    const canMoveNext = next && isUnlocked(next);

    renderShell([
      '<section class="content-panel">',
      '<div class="hero-band">',
      '<div class="hero-copy">',
      '<h2>' + note.headline + '</h2>',
      '<p>' + note.summary + '</p>',
      score ? '<p class="muted">Best quiz score: ' + score + '/4</p>' : "",
      '</div>',
      '<div class="felt-table" aria-hidden="true">',
      '<div class="dealer-card">' + dealer + '</div>',
      '</div>',
      '</div>',
      renderLessonSection("Hard Totals", "Hands without a flexible ace.", HARD_ROWS, dealer),
      renderLessonSection("Soft Totals", "Hands where an ace can count as 11.", SOFT_ROWS, dealer),
      renderLessonSection("Pairs", "Two equal ranks before any hit.", PAIR_ROWS, dealer),
      renderQuiz(dealer),
      '<div class="section">',
      '<div class="controls-row">',
      '<button class="primary-button" type="button" data-action="complete-lesson" ' + (!state.quizSubmitted ? "disabled" : "") + '>Mark dealer ' + dealer + ' complete</button>',
      canMoveNext ? '<button class="secondary-button" type="button" data-action="next-dealer">Next dealer: ' + next + '</button>' : "",
      '</div>',
      !state.quizSubmitted ? '<p class="muted">Finish the quick check to complete this dealer lesson.</p>' : "",
      '</div>',
      '</section>'
    ].join(""));
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
      '</article>'
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
      '<strong>' + row.label + ' vs dealer ' + dealer + '</strong>',
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
      '<h2>' + scenario.row.label + ' vs dealer ' + scenario.dealer + '</h2>',
      '<div class="large-hand">',
      renderCardRow(scenario.row.cards),
      '<div class="dealer-card">' + scenario.dealer + '</div>',
      '</div>',
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
      '</div>'
    ].join("");
  }

  function practiceDealers() {
    const dealers = state.progress.completedDealers.slice();
    if (!dealers.includes(state.selectedDealer) && isUnlocked(state.selectedDealer)) {
      dealers.push(state.selectedDealer);
    }
    if (!dealers.length) {
      dealers.push("2");
    }
    return DEALERS.filter(function (dealer) {
      return dealers.includes(dealer);
    });
  }

  function makePracticeScenario() {
    const dealers = practiceDealers();
    const dealer = dealers[Math.floor(Math.random() * dealers.length)];
    const typeNames = ["hard", "soft", "pair"];
    const type = typeNames[Math.floor(Math.random() * typeNames.length)];
    const rows = ROW_GROUPS[type];
    const row = rows[Math.floor(Math.random() * rows.length)];
    return {
      dealer: dealer,
      type: type,
      kindLabel: type === "pair" ? "Pair decision" : type.charAt(0).toUpperCase() + type.slice(1) + " total",
      row: row
    };
  }

  function renderChart() {
    const rows = ROW_GROUPS[state.chartMode];
    app.innerHTML = [
      '<section class="chart-panel">',
      '<div class="panel-header">',
      '<div><h2>Basic Strategy Chart</h2><p class="muted">S17, multi-deck, double after split, no surrender.</p></div>',
      '</div>',
      '<div class="mode-row">',
      renderModeButton("hard", "Hard Totals"),
      renderModeButton("soft", "Soft Totals"),
      renderModeButton("pair", "Pairs"),
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
      '<div class="chart-note">',
      '<strong>Legend:</strong> H = Hit, S = Stand, D = Double, P = Split. When doubling is unavailable, play the hand as a hit unless local rules say otherwise.',
      '</div>',
      '</section>'
    ].join("");
  }

  function renderModeButton(mode, label) {
    return '<button class="mode-button ' + (state.chartMode === mode ? "active" : "") + '" type="button" data-chart-mode="' + mode + '">' + label + '</button>';
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

  function setActiveTab(tab) {
    state.activeTab = tab;
    state.practiceFeedback = null;
    if (tab === "practice") {
      state.practiceScenario = makePracticeScenario();
    }
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

    if (target.dataset.dealer) {
      const dealer = target.dataset.dealer;
      if (!isUnlocked(dealer)) {
        return;
      }
      state.selectedDealer = dealer;
      state.quizAnswers = {};
      state.quizSubmitted = false;
      saveProgress();
      render();
      return;
    }

    if (target.dataset.chartMode) {
      state.chartMode = target.dataset.chartMode;
      render();
      return;
    }

    if (target.dataset.answer) {
      state.quizAnswers[target.dataset.quizIndex] = target.dataset.answer;
      state.quizSubmitted = false;
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
        render();
      }
      return;
    }

    if (target.dataset.action === "reset-progress") {
      resetProgress();
    }
  });

  render();
})();
