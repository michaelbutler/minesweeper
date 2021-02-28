# Minesweeper.js

[![Build Status](https://api.travis-ci.com/michaelbutler/minesweeper.svg?branch=master)](https://travis-ci.org/michaelbutler/minesweeper)

By Michael Butler

A WebWorker powered Minesweeper game written in JavaScript, HTML and CSS.

Demo: http://michaelbutler.github.io/minesweeper/

## Features:

- User can choose difficulty level
- Custom option with configurable grid size (X, Y) and number of mines
- Stopwatch with score keeping (LocalStorage)
- Stack based grid traversal algorithm for memory efficiency
- HTML5 web worker (if supported) will be used to perform the stack algorithm outside of the UI thread

## How to use:

Download all the files and open `index.html` in a modern web browser.

## Example HTML usage:

```
<!-- requires jQuery -->
<h1 class="logo">JavaScript MineSweeper
    <div class="invisible ajax-loading"><img src="load.gif" alt="Processing..."/></div>
</h1>
<div id="minesweeper"></div>

<script src="js/MineSweeper.js" type="text/javascript"></script>
<script>
    // set a global instance of Minesweeper
    minesweeper = new MineSweeper();
    minesweeper.init();
</script>
```

## To Do:

- Add animation and better graphics
- Enhance UI for a sleek new look

## Contributing:

See [CONTRIBUTE.md](https://github.com/michaelbutler/minesweeper/blob/master/CONTRIBUTE.md) for how to contribute.

## License:

    Minesweeper.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Minesweeper.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Minesweeper.js.  If not, see <http://www.gnu.org/licenses/>.
