# Blackjack Learner

A static, dealer-first blackjack basic strategy trainer.

Visit the live site:

https://otcan.github.io/learn_bj/

Direct links:

- Dealer lesson: https://otcan.github.io/learn_bj/#/learn/2
- Practice: https://otcan.github.io/learn_bj/#/practice
- Strategy chart: https://otcan.github.io/learn_bj/#/chart

For local use, open `index.html` in a browser, or serve the folder with any static file server.

## Screenshots

### Dealer Lesson

![Dealer lesson for dealer 2](screenshots/learn-dealer-2.png)

### Practice

![Practice screen](screenshots/practice.png)

### Strategy Chart

![Combined strategy chart](screenshots/strategy-chart.png)

Ruleset used by the MVP:

- Multi-deck blackjack
- Dealer stands on soft 17
- Double after split allowed
- No surrender

Progress, quiz scores, and practice stats are stored in browser local storage.

Lesson cards include an infinite-deck estimate of the dealer outcome distribution, dealer chance of going over 21, dealer average final total, an overall optimal-strategy summary for the selected dealer upcard, and a percentage-only Stand vs Hit once vs Optimal play outcome comparison.

Shareable app URLs use hash routes:

- `#/learn/2`
- `#/practice`
- `#/chart`

## License

MIT
