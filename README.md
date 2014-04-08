Minesweeper.js
===========
By Michael Butler

A minesweeper game written in JavaScript and rendered with HTML and CSS.

Features:
-----------
+ Configurable grid size (X, Y)
+ Configurable mine density
+ Stack based grid traversal algorithm for memory efficiency
+ HTML5 web worker (if supported) will be used to perform the stack algorithm outside of the UI thread

How to use:
-----------
Include `minesweep.js` on your jQuery-enabled page and load in a modern web browser.

Example HTML usage:
-----------
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
    minesweeper.init({
        selector: '#minesweeper', // the unique element into which the game board will be rendered
        board_size: [10, 10],  // render a 10w x 10h grid (100 cells)
        mines: 0.04 // Mine density (4% mines)
    });
</script>
```

License:
-----------
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
