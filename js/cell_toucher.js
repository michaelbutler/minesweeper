/* jshint worker: true */
/**

 cell_toucher.js
 Author: Michael Butler
 Url: https://github.com/michaelbutler/minesweeper

 This file is part of Minesweeper.js.

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

 */

if (!this.onmessage) {
  this.onmessage = {};
}

/**
 * @param obj
 * @param grid
 * @returns {Array}
 */
function getAdjacentSquares(obj, grid) {
  'use strict';
  var cell,
    x = parseInt(obj.x, 10),
    y = parseInt(obj.y, 10),
    mY = grid.length - 1,
    mX = grid[0].length - 1;

  //  0  1  2
  //  3  .  4
  //  5  6  7
  var results = [];
  var i;
  var j;

  for (i = Math.max(0, y - 1); i <= Math.min(mY, y + 1); i++) {
    for (j = Math.max(0, x - 1); j <= Math.min(mX, x + 1); j++) {
      if (i !== y || j !== x) {
        cell = grid[i][j];
        if (cell) {
          results.push(cell);
        }
      }
    }
  }

  return results;
}

/**
 * Touch all adjacent squares (there are 8)
 * Setting to either a number OR open state
 * If adjacent square results in OPEN state: TOUCH it also
 * @param cell
 * @param grid
 * @returns {*}
 */
function touchAdjacent(cell, grid) {
  'use strict';
  var stack = [];

  stack.push(cell);

  while (stack.length > 0) {
    var squares,
      numMines = 0,
      curCell = stack.pop(),
      i,
      sq;

    squares = getAdjacentSquares(curCell, grid);

    // calc # of mines
    for (i = 0; i < squares.length; i++) {
      sq = squares[i];
      if (sq.mine) {
        numMines += 1;
      }
    }
    curCell.number = numMines;
    if (numMines > 0) {
      curCell.state = 'number';
    } else {
      curCell.state = 'open';
      for (i = 0; i < squares.length; i++) {
        sq = squares[i];
        if (sq.state !== 'open' && sq.state !== 'number') {
          stack.push(sq);
        }
      }
    }
  }
}

function minesweeperCalculateWin(grid, mines) {
  'use strict';
  var closedCells = 0,
    cell;

  for (var y = 0; y < grid.length; y++) {
    for (var x = 0; x < grid[0].length; x++) {
      cell = grid[y][x];
      if (!(cell.state === 'open' || cell.state === 'number')) {
        closedCells += 1;
      }
    }
  }

  return mines === closedCells;
}

if (this.document === undefined) {
  this.onmessage = function (p) {
    'use strict';
    var data = JSON.parse(p.data),
      grid = data.grid,
      resp = {};
    resp.type = data.type;
    if (data.type === 'calc_win') {
      resp.win = minesweeperCalculateWin(grid, data.mines);
    } else {
      var cell = grid[data.y][data.x];
      if (data.type === 'touch_adjacent') {
        // This takes 1-2 seconds
        // After work is finished pass the grid state back to main
        touchAdjacent(cell, grid);
      } else if (data.type === 'get_adjacent') {
        var squares = getAdjacentSquares(cell, grid);
        var nrFlag = 0;
        var i;
        var sq;
        for (i = 0; i < squares.length; i++) {
          sq = squares[i];
          if (sq.state === 'flagged') {
            nrFlag++;
          }
        }
        if (nrFlag === parseInt(cell.number, 10)) {
          for (i = 0; i < squares.length; i++) {
            sq = squares[i];
            if (sq.mine) {
              if (sq.state !== 'flagged') {
                resp.type = 'explode';
                resp.cell = sq;
                break;
              }
            } else {
              touchAdjacent(sq, grid);
            }
          }
        }
      }
      resp.grid = grid;
    }
    postMessage(JSON.stringify(resp));
  };
}
