# Blackjack Learner

A static, dealer-first blackjack basic strategy trainer covering dealer upcards 2 through Ace, plus Hi-Lo card counting drills.

Visit the live site:

https://otcan.github.io/learn_bj/

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

All dealer upcard lessons are available from the start. Progress, quiz scores, practice stats, and counting drill stats are stored in browser local storage.

Lesson cards include an infinite-deck estimate of the dealer outcome distribution, dealer chance of going over 21, dealer average final total, an overall optimal-strategy summary for the selected dealer upcard, and a Stand vs Hit once vs Basic strategy vs Best hit/stand comparison with win/tie/lose percentages plus average result in betting units.

Practice hands use a table-style layout and show neutral count-0 winning chances after each answer, plus estimated outcome changes for negative, neutral, and positive Hi-Lo true counts. Split feedback shows the two new hands separately; split win/tie/lose chances are per new hand, while average result combines both split hands.

The Card Counting tab teaches the Hi-Lo values and includes a card value drill with response-speed feedback plus sequential running count drills for short runs, one-color half-decks, full decks, and multiple decks. Running count drills show pace feedback and use selectable boxes for the final count.

The Assessment tab gives a short general exam across basic strategy, card-value recognition, running count, and count-changing strategy plays. It shows live scoring, stores the latest skill-level result locally, and can generate a shareable client-side result URL.

Shareable app URLs use hash routes:

- `#/learn/2`
- `#/learn/A`
- `#/practice`
- `#/counting`
- `#/assessment`
- `#/assessment/result/<encoded-result>`
- `#/chart`

## License

MIT
