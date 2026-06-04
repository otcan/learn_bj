# Blackjack Learner

Blackjack Learner is a free static blackjack trainer for S17, multi-deck, DAS, no-surrender games. It teaches basic strategy by dealer upcard, then drills practice hands, Hi-Lo values, running count, count deviations, and a short assessment.

Live app: https://otcan.github.io/learn_bj/

Source: https://github.com/otcan/learn_bj

Posting notes and Reddit draft copy: [POSTING.md](POSTING.md)

## Features

- Dealer-first lessons for every dealer upcard from 2 through Ace
- Hard total, soft total, and pair strategy explanations
- Practice hands with immediate feedback
- Win/tie/lose estimates and average result in betting units
- Hi-Lo card value drill with speed feedback
- Running count drills for short runs, one-color half-decks, full decks, and multiple decks
- Count-change examples for common Hi-Lo deviations
- Short assessment mode with shareable client-side results
- Full strategy chart with count-sensitive cells marked
- Local progress stored in browser local storage
- Static deployment with hash routes, no account required

## Ruleset And Limitations

This trainer is built around one ruleset:

- Multi-deck blackjack
- Dealer stands on soft 17
- Double after split allowed
- No surrender

Important limitations:

- Educational trainer only; this is not betting advice.
- Real casino rules vary, and rule changes can change correct strategy.
- Lesson percentages use an infinite-shoe estimate to keep examples consistent.
- Count-adjusted rows are training approximations, not exact composition-dependent table math.
- Split win/tie/lose chances are shown per new hand; average result combines both split hands because splitting creates a second bet.

## Strategy Validation

The encoded basic strategy table targets S17, multi-deck, DAS, no-surrender play. The next serious trust step is a public validation pass against a known S17 reference chart, then automated checks that protect the table from accidental regressions.

Reference candidate: [Blackjack Apprenticeship S17 Basic Strategy PDF](https://www.blackjackapprenticeship.com/wp-content/uploads/2024/09/S17-Basic-Strategy.pdf).

Current status:

- Basic strategy has been manually encoded for the stated ruleset.
- The app now shows the assumptions behind its probability estimates.
- The chart still needs a public, issue-tracked validation pass.
- The odds engine still needs focused automated tests.

## What Changed Since The First Reddit Post

Since the early feedback post, the project now includes:

- All dealer upcards, 2 through Ace
- Practice hands
- Hi-Lo card value drills
- Running count drills
- Count-change/deviation examples
- Assessment mode
- Full strategy chart
- Shareable assessment results
- Clearer split handling and average-result odds

## Help Wanted

These are the best contribution/review targets before treating the trainer as authoritative:

- [Validate the S17 basic strategy table against trusted references](https://github.com/otcan/learn_bj/issues/3)
- [Review the Hi-Lo deviation list and count-adjusted examples](https://github.com/otcan/learn_bj/issues/4)
- [Improve the mobile strategy chart for faster scanning](https://github.com/otcan/learn_bj/issues/2)
- [Add an H17 rules toggle](https://github.com/otcan/learn_bj/issues/1)
- [Add automated strategy and odds validation tests](https://github.com/otcan/learn_bj/issues/5)

## Screenshots

### Dealer Lesson

![Dealer lesson for dealer 2](screenshots/learn-dealer-2.png)

### Practice

![Practice screen](screenshots/practice.png)

### Strategy Chart

![Combined strategy chart](screenshots/strategy-chart.png)

## Routes

Shareable app URLs use hash routes:

- `#/learn/2`
- `#/learn/A`
- `#/practice`
- `#/counting`
- `#/assessment`
- `#/assessment/result/<encoded-result>`
- `#/chart`

## Local Use

Open `index.html` in a browser, or serve the folder with any static file server:

```bash
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173/`.

## License

MIT
