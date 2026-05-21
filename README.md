# Blackjack Learner

A static, dealer-first blackjack basic strategy trainer.

Open `index.html` in a browser, or serve the folder with any static file server.

Ruleset used by the MVP:

- Multi-deck blackjack
- Dealer stands on soft 17
- Double after split allowed
- No surrender

Progress, quiz scores, and practice stats are stored in browser local storage.

Lesson cards include an infinite-deck estimate of the dealer outcome distribution, dealer chance of going over 21, dealer average final total, and a percentage-only Stand vs Hit once vs Optimal play outcome comparison.

Shareable app URLs use hash routes:

- `#/learn/2`
- `#/practice`
- `#/chart/hard`
- `#/chart/soft`
- `#/chart/pair`
