/*
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

var self = this;

function postDebug(obj) {
    var data = {
        'type': 'log',
        'obj': obj
    };
    if (self && self.postMessage) {
        self.postMessage(JSON.stringify(data));
    }
}

/**
 * @param obj
 * @param grid
 * @returns {Array}
 */
function get8AdjacentSquares(obj, grid) {
    var array = [],
        x = obj.x,
        y = obj.y;

    //  0  1  2
    //  3  .  4
    //  5  6  7

    try {
        array[0] = grid[y - 1][x - 1];
    } catch (e) {
    }
    try {
        array[1] = grid[y - 1][x];
    } catch (e) {
    }
    try {
        array[2] = grid[y - 1][x + 1];
    } catch (e) {
    }
    try {
        array[3] = grid[y][x - 1];
    } catch (e) {
    }
    try {
        array[4] = grid[y][x + 1];
    } catch (e) {
    }
    try {
        array[5] = grid[y + 1][x - 1];
    } catch (e) {
    }
    try {
        array[6] = grid[y + 1][x];
    } catch (e) {
    }
    try {
        array[7] = grid[y + 1][x + 1];
    } catch (e) {
    }

    var results = [];
    for (var i = 0; i < 8; i++) {
        if (array[i]) {
            results.push(array[i]);
        }
    }

    return results;
}



/**
 * Touch all adjacent squares (there are 8)
 * Setting to either a number OR open state
 * If adjacent square results in OPEN state: TOUCH it also
 * @param obj
 * @param grid
 * @returns {*}
 */
function touchAdjacent(obj, grid) {
    var squares = null, //self.get8AdjacentSquares(obj),
        x,
        max,
        num_mines = 0,
        stack = [],
        n = null,
        sq;

    stack.push(obj);

    if (obj.mine) {
        // console.log(obj);
        throw "error: 'touched' a mine automatically";
    }

    while (stack.length > 0) {
        num_mines = 0;
        n = stack.pop();

        squares = get8AdjacentSquares(n, grid);

        // calc # of mines
        for (x = 0, max = squares.length; x < max; x++) {
            sq = squares[x];
            if (sq.mine) {
                num_mines++;
            }
        }

        if (num_mines > 0) {
            n.state = 'number';
            n.number = num_mines;
        }
        else {
            n.state = 'open';
            n.number = 0;
        }

        for (x = 0, max = squares.length; x < max; x++) {
            sq = squares[x];
            if (sq.state === 'open' || sq.state === 'number') {
                // ignore because already processed
            }
            else if (!sq.mine && num_mines === 0) {
                stack.push(sq);
            }
        }
    }

    return grid;
}

function minesweeperCalculateWin(grid) {
    var win = false,
        mines = 0,
        closed_cells = 0,
        y,
        x,
        max,
        max2,
        obj;

    for (y = 0, max = grid.length; y < max; y++) {
        for (x = 0, max2 = grid[0].length; x < max2; x++) {
            obj = grid[y][x];
            if (obj.mine) {
                mines += 1;
            }
            if (!(obj.state === 'open' || obj.state === 'number')) {
                closed_cells += 1;
            }
        }
    }

    return (mines === closed_cells);
}

if (self.document === undefined) {
    self.addEventListener('message', function (e) {
        var data = e.data,
            resp = {},
            cell = {},
            grid = {},
            squares;
        data = JSON.parse(data);
        grid = data.grid;

        if (data.type === 'touch_adjacent') {
            cell = grid[data.y][data.x];
            // This takes 1-2 seconds
            grid = touchAdjacent(cell, grid);
            // After work is finished pass the grid state back to main
            resp = {
                'type': data.type,
                'grid': grid
            };
        }
        else if (data.type === 'calc_win') {
            resp = {
                'type': data.type,
                'win': minesweeperCalculateWin(grid)
            };
        }
        else if (data.type === 'get_adjacent') {
            cell = grid[data.y][data.x];
            squares = get8AdjacentSquares(cell, grid);
            try {
                for (var i = 0, max = squares.length; i < max; i++) {
                    grid = touchAdjacent(squares[i], grid);
                }
                resp = {
                    'type': 'touch_adjacent',
                    'grid': grid
                }
            }
            catch (e) {
                resp = {
                    'type': 'explode',
                    'grid': grid
                }
            }
        }
        self.postMessage(JSON.stringify(resp));
    }, false);
}
