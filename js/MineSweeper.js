/**
 MineSweeper.js
 Author: Michael C. Butler
 Url: https://github.com/michaelbutler/minesweeper

 Dependencies: jQuery, jQuery UI CSS (for icons)

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

var MineSweeper;


jQuery(function ($) {
    'use strict';

    // standard level configurations
    var levels = {
        'beginner': {
            'board_size': [9, 9],
            'num_mines': 10
        },
        'intermediate': {
            'board_size': [16, 16],
            'num_mines': 40
        },
        'expert': {
            'board_size': [30, 16],
            'num_mines': 99
        }
    };

    // "Static Constants"
    var STATE_UNKNOWN = 'unknown',
        STATE_OPEN = 'open',
        STATE_NUMBER = 'number',
        STATE_FLAGGED = 'flagged',
        STATE_EXPLODE = 'explode',
        STATE_QUESTION = 'question';

    MineSweeper = function () {
        // prevent namespace pollution
        if (!(this instanceof MineSweeper)) {
            throw "Invalid use of Minesweeper";
        }
        var self = this;
        self.options = {};
        self.grid = [];
        self.running = true;
        self.defaults = {
            selector: '#minesweeper',
            board_size: levels.beginner.board_size,
            num_mines: levels.beginner.num_mines,
            path_to_cell_toucher: 'js/cell_toucher.js'
        };
        self.RIGHT_MOUSE_CLICKED = false;

        this.init = function (options) {
            self.options = $.extend({}, self.defaults, options || {});
            self.element = $(self.options.selector);
            if (!self.element.length) {
                throw "MineSweeper element not found";
            }
            if (!window.JSON) {
                throw "This application requires a JSON parser.";
            }
            // insert progress animation before the grid
            if ($('.ajax-loading').length < 1) {
                $('<div class="invisible ajax-loading"></div>')
                    .prependTo(self.element.parent());
            }
            self.initWorkers();
            self.clearBoard();
            self.redrawBoard();
            self.resetDisplays();
            self.initHandlers();
            return self;
        };

        this.initWorkers = function () {
            if (window.Worker) {
                // Create a background web worker to process the grid "painting" with a stack
                self.worker = new Worker(self.options.path_to_cell_toucher);
                self.worker.addEventListener('message', function (e) {
                    var data = JSON.parse(e.data);
                    self.handleWorkerMessage(data);
                }, false);
            }
            else {
                self.worker = null;
                // for older browsers, load the web worker script in global space to access the functions
                $.getScript(self.options.path_to_cell_toucher);
            }
        };

        this.initHandlers = function () {
            self.element.on('click', '.cell', function (ev) {
                var targ = $(ev.target);
                ev.preventDefault();
                if (!self.running) {
                    return;
                }
                if (ev.which !== 3) {
                    self.handleLeftClick(targ);
                }
            });

            self.element.on('mousedown', function (ev) {
                if (ev.which === 3) {
                    clearTimeout(self.RIGHT_BUTTON_TIMEOUT);
                    self.RIGHT_MOUSE_CLICKED = true;
                }
            });

            self.element.on('mouseup', function (ev) {
                if (ev.which === 3) {
                    self.RIGHT_BUTTON_TIMEOUT = setTimeout(function () {
                        self.RIGHT_MOUSE_CLICKED = false;
                    }, 50);
                }
            });

            self.element.on("contextmenu", ".cell", function (ev) {
                var targ = $(ev.target);
                ev.preventDefault();
                self.handleRightClick(targ);
            });

            self.element.find('.new-game').click(function (ev) {
                ev.preventDefault();
                self.stopTimer();
                self.timer = '';
                self.running = true;
                self.setBoardOptions();
                self.clearBoard();
                self.redrawBoard();
                self.resetDisplays();
            });

            $('#level').change(function (ev) {
                if ($('#level option:selected').val() === 'custom') {
                    $('.game_settings input').prop('disabled', false);
                } else {
                    $('.game_settings input').prop('disabled', true);
                }
            });

            $('#best_times').click(function (ev) {
                var beginner_time = localStorage.getItem('best_time_beginner') || '***';
                var intermediate_time = localStorage.getItem('best_time_intermediate') || '***';
                var expert_time = localStorage.getItem('best_time_expert') || '***';
                var beginner_name = localStorage.getItem('beginner_record_holder') || '***';
                var intermediate_name = localStorage.getItem('intermediate_record_holder') || '***';
                var expert_name = localStorage.getItem('expert_record_holder') || '***';
                alert("Best times:\nBeginner:\t" + beginner_name + "\t" + beginner_time + "\nIntermediate:\t" + intermediate_name + "\t" + intermediate_time + "\nExpert:\t" + expert_name + "\t" + expert_time);
            });

        };

        /**
         * @return void
         * @param cell jQuery representation of cell
         */
        this.handleRightClick = function (cell) {
            if (!(cell instanceof jQuery)) {
                throw "Parameter must be jQuery instance";
            }
            if (!self.running) {
                return;
            }
            var obj = self.getCellObj(cell),
                flagDisplay = $('#mine_flag_display'),
                curr;
            if (obj.state === STATE_OPEN || obj.state === STATE_NUMBER) {
                return;
            }
            else if (obj.state === STATE_UNKNOWN) {
                obj.state = STATE_FLAGGED;
                curr = parseInt(flagDisplay.val(), 10);
                flagDisplay.val(curr - 1);
            }
            else if (obj.state === STATE_FLAGGED) {
                obj.state = STATE_QUESTION;
                curr = parseInt(flagDisplay.val(), 10);
                flagDisplay.val(curr + 1);
            }
            else {
                obj.state = STATE_UNKNOWN;
            }
            self.drawCell(cell);
        };

        /**
         * @return void
         * @param cell jQuery representation of cell
         */
        this.handleLeftClick = function (cell) {
            // cell  = jQuery object
            // obj   = memory state
            if (!(cell instanceof jQuery)) {
                throw "Parameter must be jQuery instance";
            }
            var obj = self.getCellObj(cell);
            if (!self.running) {
                return;
            }

            if (!self.timer) {
                self.startTimer();
            }

            if (obj.state === STATE_NUMBER) {
                // auto clear neighbor cells
                if (self.RIGHT_MOUSE_CLICKED) {
                    self.magicClearCells(obj);
                }
                return;
            }
            if (obj.state === STATE_OPEN || obj.state === STATE_FLAGGED) {
                // ignore clicks on these
                return;
            }
            if (obj.mine) {
                // game over
                self.gameOver(cell);
                return;
            }

            var state = {
                type: 'touch_adjacent', // message type
                grid: self.grid,
                x: obj.x,
                y: obj.y
            };

            if (self.worker) {
                // Asynchronously
                $('.ajax-loading').removeClass('invisible');
                self.worker.postMessage(JSON.stringify(state));
            }
            else {
                // Synchronously
                if (!window.touchAdjacent) {
                    throw ("Could not load " + self.options.path_to_cell_toucher);
                }
                self.grid = touchAdjacent(obj, self.grid);
                // redraw board from memory representation
                self.redrawBoard();
            }
        };

        this.handleWorkerMessage = function (data) {
            if (data.type === 'touch_adjacent') {
                self.grid = data.grid;
                self.redrawBoard();
            }
            else if (data.type === 'calc_win') {
                if (data.win) {
                    self.winGame();
                }
            }
            else if (data.type === 'log') {
                if (console && console.log) {
                    console.log(data.obj);
                }
            }
            $('.ajax-loading').addClass('invisible');
        };

        // return memory representation for jQuery instance
        this.getCellObj = function (dom_obj) {
            var gridobj,
                x,
                y;
            try {
                x = parseInt(dom_obj.attr('data-x'), 10);
                y = parseInt(dom_obj.attr('data-y'), 10);
                gridobj = self.grid[y][x];
            }
            catch (e) {
                console.warn("Could not find memory representation for:");
                console.log(dom_obj);
                throw "Stopped.";
            }

            return gridobj;
        };

        this.getJqueryObject = function (obj) {
            return self.board.find('.cell[data-coord="' + [obj.x, obj.y].join(',') + '"]');
        };

        this.getRandomMineArray = function () {
            var width = self.options.board_size[0],
                height = self.options.board_size[1],
            // Total Mines is a percentage of the total number of cells
                total_mines = self.options.num_mines,
                array = [],
                x,
                max;

            // Put all mines in the beginning
            for (x = 0, max = width * height; x < max; x++) {
                if (x < total_mines) {
                    array[x] = 1;
                }
                else {
                    array[x] = 0;
                }
            }

            // shuffle array so it's like pulling out of a 'hat'
            // credit: http://sedition.com/perl/javascript-fy.html
            function fisherYates (myArray) {
                var i = myArray.length, j, tempi, tempj;
                if (i === 0) {
                    return;
                }
                while (--i) {
                    j = Math.floor(Math.random() * (i + 1));
                    tempi = myArray[i];
                    tempj = myArray[j];
                    myArray[i] = tempj;
                    myArray[j] = tempi;
                }
            }

            fisherYates(array);

            return array;
        };

        // set the board size and mine density
        this.setBoardOptions = function () {
            var level = $('#level').val();

            if (level === 'custom') {
                var dim_x = parseInt($('#dim_x').val(), 10);
                var dim_y = parseInt($('#dim_y').val(), 10);
                var num_mines = parseInt($('#num_mines').val(), 10);

                self.options.board_size = [dim_x, dim_y];
                self.options.num_mines = num_mines;
            } else {
                self.options.board_size = levels[level].board_size;
                self.options.num_mines = levels[level].num_mines;
            }

        };

        this.startTimer = function () {
            var timerElement = $('#timer');
            timerElement.val(0);
            console.log('starting timer');
            self.timer = window.setInterval(function () {
                var curr = parseInt(timerElement.val(), 10);
                timerElement.val(curr + 1);
            }, 1000);
        };

        this.stopTimer = function () {
            if (self.timer) {
                window.clearInterval(self.timer);
            }
        };

        this.resetDisplays = function () {

            var level = $('#level option:selected').val();
            var num_mines;

            if (level === 'custom') {
                num_mines = $('#num_mines').val();
            } else {
                num_mines = levels[level].num_mines;
            }

            $('#mine_flag_display').val(num_mines);
            $('#timer').val(0);
        };

        // clear & initialize the internal cell memory grid
        this.clearBoard = function () {
            var width = self.options.board_size[0],
                height = self.options.board_size[1],
                x,
                y,
                z = 0,
                mine_hat = self.getRandomMineArray();

            self.grid = [];
            for (y = 0; y < height; y++) {
                self.grid[y] = [];
                for (x = 0; x < width; x++) {
                    self.grid[y][x] = {
                        'state': STATE_UNKNOWN,
                        'number': 0,
                        'mine': mine_hat[z++],
                        'x': x,
                        'y': y
                    };
                }
            }

            // Insert the board cells in DOM
            if (!self.board) {
                self.element.html('');
                self.element.append(self.get_template('settings'));
                self.element.append(self.get_template('actions'));
                self.element.append(self.get_template('status'));
                self.element.append('<div class="board-wrap"></div>');
                self.board = self.element.find('.board-wrap');
                self.board.attr('unselectable', 'on')
                    .css('UserSelect', 'none')
                    .css('MozUserSelect', 'none');
            }
            else {
                self.board.html('');
            }
            for (y = 0; y < height; y++) {
                var row = $('<ul class="row" data-index=' + y + '></ul>');
                for (x = 0; x < width; x++) {
                    var cell;
                    row.append('<li class="cell" data-coord="' + [x, y].join(',') + '" data-x=' + x + ' data-y=' + y + '>x</li>');
                    cell = row.find('.cell:last');
                    self.drawCell(cell);
                }
                self.board.append(row);
            }


        };

        this.redrawBoard = function () {
            self.board.find('li.cell').each(function (ind, cell) {
                self.drawCell($(cell));
            });

            if (self.worker) {
                var state = {
                    type: 'calc_win', // message type
                    grid: self.grid
                };
                self.worker.postMessage(JSON.stringify(state));
            }
            else {
                if (!window.touchAdjacent) {
                    throw ("Could not load " + self.options.path_to_cell_toucher);
                }
                var win = minesweeperCalculateWin(self.grid);
                if (win) {
                    self.winGame();
                }
            }
        };

        this.drawCell = function (x, y) {
            var cell = null,
                gridobj;
            if (x instanceof jQuery) {
                cell = x;
            }
            else if (typeof x === 'number' && typeof y === 'number') {
                cell = self.board.find('.cell[data-coord="' + [x, y].join(',') + '"]');
            }
            x = parseInt(cell.attr('data-x'), 10);
            y = parseInt(cell.attr('data-y'), 10);

            cell.removeClass().addClass('cell');

            try {
                gridobj = self.grid[y][x];
            }
            catch (e) {
                console.warn("Invalid grid coord: x,y = " + [x, y].join(','));
                return;
            }
            cell.html('');
            cell.attr('data-number', '');
            switch (gridobj.state) {
                case STATE_FLAGGED:
                    cell.addClass('ui-icon ui-icon-flag');
                    cell.addClass(gridobj.state);
                    break;
                case STATE_QUESTION:
                    cell.addClass('ui-icon ui-icon-help');
                    cell.addClass(gridobj.state);
                    break;
                case STATE_UNKNOWN:
                case STATE_OPEN:
                case STATE_EXPLODE:
                    cell.addClass(gridobj.state);
                    break;
                case STATE_NUMBER:
                    cell.addClass('number');
                    cell.html(gridobj.number);
                    cell.attr('data-number', gridobj.number);
                    break;
                default:
                    throw "Invalid gridobj state: " + gridobj.state;
            }

        };

        /**
         * @param cellParam
         * @return void
         */
        this.gameOver = function (cellParam) {

            self.stopTimer();

            var width = self.options.board_size[0],
                height = self.options.board_size[1],
                x,
                y;

            if (cellParam) {
                cellParam.removeClass();
                cellParam.addClass("cell " + STATE_EXPLODE);
            }
            for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                    var obj = self.grid[y][x],
                        cell;
                    cell = self.getJqueryObject(obj);
                    if (obj.mine) {
                        cell.removeClass('ui-icon-help')
                            .addClass('ui-icon ui-icon-close blown');
                    }
                    else {
                        cell.addClass('unblown');
                    }
                }
            }
            self.running = false;
        };

        this.winGame = function () {
            self.stopTimer();
            self.running = false;
            var time = $('#timer').val();
            alert('You win!\nYour time: ' + time);
            self.checkBestTime(time);
        };

        this.checkBestTime = function (time) {
            var level = $('#level').val();
            if (level !== 'custom') {
                var best_time = localStorage.getItem('best_time_' + level);

                if (!best_time || parseInt(time, 10) < parseInt(best_time, 10)) {
                    var display_name = localStorage.getItem(level + '_record_holder')
                    if (!display_name) {
                        display_name = 'Your name';
                    }
                    var name = window.prompt('Congrats! You beat the best ' + level + ' time!', display_name);

                    localStorage.setItem('best_time_' + level, time);
                    localStorage.setItem(level + '_record_holder', name);
                }
            }
        };

        this.magicClearCells = function (obj) {
            $('.ajax-loading').removeClass('invisible');
            var state = {
                type: 'get_adjacent', // message type
                grid: self.grid,
                x: obj.x,
                y: obj.y
            };
            self.worker.postMessage(JSON.stringify(state));
        };

        this.get_template = function (template) {
            var templates = {
                'actions': '<div class="game_actions"><button class="new-game">New Game</button><button id="best_times">Best times</button></div>',
                'settings': '<div class="game_settings"><select id="level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option><option value="custom">Custom</option></select>    <input type="text" id="dim_x" placeholder="x" size="5" disabled /><input type="text" id="dim_y" placeholder="y" size="5" disabled /><input type="text" id="num_mines" placeholder="mines" size="5" disabled /></div>',
                'status': '<div class="game_status"><label>Time:</label><input type="text" id="timer" size="6" value="0" readonly /><label>Mines:</label><input type="text" id="mine_flag_display" size="6" value="10" disabled />'
            };

            return templates[template];
        };

    };
});