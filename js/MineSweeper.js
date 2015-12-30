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
	var LEFT_MB=1,
		RIGHT_MB=3;

    MineSweeper = function () {
        // prevent namespace pollution
        if (!(this instanceof MineSweeper)) {
            throw "Invalid use of Minesweeper";
        }
        var msObj = this;
        this.options = {};
        this.grid = [];
        this.running = true;
        this.defaults = {
            selector: '#minesweeper',
            board_size: levels.beginner.board_size,
            num_mines: levels.beginner.num_mines,
            path_to_cell_toucher: 'js/cell_toucher.js'
        };
        this.LEFT_MOUSE_CLICKED = false;
        this.RIGHT_MOUSE_CLICKED = false;

        this.init = function (options) {
            msObj.options = $.extend({}, msObj.defaults, options || {});
            var msUI = $(msObj.options.selector);
            if (!msUI.length) {
                throw "MineSweeper element not found";
            }
            if (!window.JSON) {
                throw "This application requires a JSON parser.";
            }
            // insert progress animation before the grid
            if ($('.ajax-loading').length < 1) {
				msUI.before(
                '<div class="invisible ajax-loading"></div>'
				);
            }
            msObj.initWorkers(msObj.options.path_to_cell_toucher);
            msObj.clearBoard();
            msObj.redrawBoard();
            msObj.resetDisplays();
            msObj.initHandlers(msUI);
            return msObj;
        };

		this.callWorker = function(task,par) {
            $('.ajax-loading').removeClass('invisible');
            var job = {
                type: task, // message type
                grid: msObj.grid
            };
			if (typeof par === 'number') {
				job.mines=par;
			}
			else if (typeof par === 'object'){
				job.x=par.x;
				job.y=par.y;
			}
            msObj.worker.postMessage(JSON.stringify(job));
		};

        this.initWorkers = function (wPath) {
            if (window.Worker) {
                // Create a background web worker to process the grid "painting" with a stack
                msObj.worker = new Worker(wPath);
                msObj.worker.onmessage= function (e) {
                    var data = JSON.parse(e.data);
                    msObj.handleWorkerMessage(data);
                };
            }
            else {
                msObj.worker = null;
                // for older browsers, load the web worker script in global space to access the functions
                $.getScript(wPath);
            }
        };

        this.initHandlers = function (msUI) {

            msUI.on("contextmenu", ".cell", function (ev) {
                ev.preventDefault();
            });

            msUI.on('mousedown', function (ev) {
                if (ev.which === RIGHT_MB) {
                    clearTimeout(msObj.RIGHT_BUTTON_TIMEOUT);
                    msObj.RIGHT_MOUSE_DOWN = true;
                }
                else if (ev.which === LEFT_MB) {
                    clearTimeout(msObj.LEFT_BUTTON_TIMEOUT);
                    msObj.LEFT_MOUSE_DOWN = true;
                }
            });

            msUI.on('mouseup', function (ev) {
                if (ev.which === RIGHT_MB) {
                    msObj.RIGHT_BUTTON_TIMEOUT = setTimeout(function () {
                        msObj.RIGHT_MOUSE_DOWN = false;
                    }, 50);
				}
                else if (ev.which === LEFT_MB) {
                    msObj.LEFT_BUTTON_TIMEOUT = setTimeout(function () {
                        msObj.LEFT_MOUSE_DOWN = false;
                    }, 50);
                }
            });

            msUI.on('mousedown','.cell', function (ev) {
                var targ = $(ev.target);
                if ((ev.which === LEFT_MB&&msObj.RIGHT_MOUSE_DOWN)||
					(ev.which === RIGHT_MB&&msObj.LEFT_MOUSE_DOWN)) {
						var x = targ.attr('data-x')-1;
						var ud=targ.parent().prev();
						for(var i=x;i<x+3;i++)
							ud.children(".unknown.[data-x="+i+"]").addClass('test');
						targ.prev('.unknown').addClass('test');
						targ.next('.unknown').addClass('test');
						ud=targ.parent().next();
						for(var i=x;i<x+3;i++)
							ud.children(".unknown.[data-x="+i+"]").addClass('test');
				}
            });

            msUI.on('mouseup','.cell', function (ev) {
                var targ = $(ev.target);
                if (ev.which === LEFT_MB) {
                    msObj.handleLeftClick(targ);
				}
				else if (ev.which === RIGHT_MB) {
                    msObj.handleRightClick(targ);
				}
            });

            $('.new-game').on("click",function (ev) {
                ev.preventDefault();
                msObj.stopTimer();
                msObj.timer = '';
                msObj.running = true;
                msObj.setBoardOptions();
                msObj.clearBoard();
                msObj.redrawBoard();
                msObj.resetDisplays();
            });

            $('#level').on("change",function (ev) {
                if ($('#level option:selected').val() === 'custom') {
                    $('.game_settings input').prop('disabled', false);
                } else {
                    $('.game_settings input').prop('disabled', true);
                }
				$('.new-game').trigger('click');
            });

            $('#best_times').on("click",function (ev) {
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
            if (!msObj.running) {
                return;
            }
            var obj = msObj.getCellObj(cell);

            if (obj.state === STATE_NUMBER) {
                // auto clear neighbor cells
				if (msObj.LEFT_MOUSE_DOWN) {
					msObj.callWorker('get_adjacent',obj);
				}
                return;
            }

            if (obj.state === STATE_NUMBER) {
                return;
            }
            if (obj.state === STATE_QUESTION) {
                obj.state = STATE_UNKNOWN;
			}
			else {
				var flagDisplay = $('#mine_flag_display'),
					curr = parseInt(flagDisplay.val(), 10);
				if (obj.state === STATE_UNKNOWN) {
					obj.state = STATE_FLAGGED;
					flagDisplay.val(curr - 1);
				}
				else if (obj.state === STATE_FLAGGED) {
					obj.state = STATE_QUESTION;
					flagDisplay.val(curr + 1);
				}
            }
            msObj.drawCell(cell);
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
            if (!msObj.running) {
                return;
            }
            if (!msObj.timer) {
                msObj.startTimer();
            }

            var obj = msObj.getCellObj(cell);
            if (obj.state === STATE_OPEN || obj.state === STATE_FLAGGED) {
                // ignore clicks on these
                return;
            }
            if (obj.state === STATE_NUMBER) {
                // auto clear neighbor cells
				if (msObj.RIGHT_MOUSE_DOWN) {
					msObj.callWorker('get_adjacent',obj);
				}
                return;
            }

            if (obj.mine) {
                // game over
                msObj.gameOver(cell);
                return;
            }

            if (msObj.worker) {
                // Asynchronously
				msObj.callWorker('touch_adjacent',obj);
            }
            else {
                // Synchronously
                if (!window.touchAdjacent) {
                    throw ("Could not load " + msObj.options.path_to_cell_toucher);
                }
                msObj.grid = touchAdjacent(obj, msObj.grid);
                // redraw board from memory representation
                msObj.redrawBoard();
            }
        };

        this.handleWorkerMessage = function (data) {
			if (data.type === 'touch_adjacent'||data.type === 'get_adjacent') {
                msObj.grid = data.grid;
                msObj.redrawBoard();
            }
			else if (data.type === 'calc_win') {
                if (data.win) {
                    msObj.winGame();
                }
            }
			else if (data.type === 'explode') {
                var cell = msObj.getJqueryObject(data.cell.x,data.cell.y);
				msObj.gameOver(cell);
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
                gridobj = msObj.grid[y][x];
            }
            catch (e) {
                console.warn("Could not find memory representation for:");
                console.log(dom_obj);
                throw "Stopped.";
            }

            return gridobj;
        };

        this.getJqueryObject = function (x,y) {
            return msObj.board.find('.cell[data-coord="' + [x, y].join(',') + '"]');
        };

        this.getRandomMineArray = function () {
            var width = msObj.options.board_size[0],
                height = msObj.options.board_size[1],
            // Total Mines is a percentage of the total number of cells
                total_mines = msObj.options.num_mines,
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

                msObj.options.board_size = [dim_x, dim_y];
                msObj.options.num_mines = num_mines;
            } else {
                msObj.options.board_size = levels[level].board_size;
                msObj.options.num_mines = levels[level].num_mines;
            }

        };

        this.startTimer = function () {
            var timerElement = $('#timer');
            timerElement.val(0);
            console.log('starting timer');
            msObj.timer = window.setInterval(function () {
                var curr = parseInt(timerElement.val(), 10);
                timerElement.val(curr + 1);
            }, 1000);
        };

        this.stopTimer = function () {
            if (msObj.timer) {
                window.clearInterval(msObj.timer);
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
            var width = msObj.options.board_size[0],
                height = msObj.options.board_size[1],
                x,
                y,
                z = 0,
                mine_hat = msObj.getRandomMineArray();

            msObj.grid = [];
            for (y = 0; y < height; y++) {
                msObj.grid[y] = [];
                for (x = 0; x < width; x++) {
                    msObj.grid[y][x] = {
                        'state': STATE_UNKNOWN,
                        'number': 0,
                        'mine': mine_hat[z++],
                        'x': x,
                        'y': y
                    };
                }
            }

            // Insert the board cells in DOM
            if (!msObj.board) {
                $(msObj.options.selector)
					.html('')
					.append(msObj.get_template('settings'))
					.append(msObj.get_template('actions'))
					.append(msObj.get_template('status'))
					.append('<div class="board-wrap"></div>');
                msObj.board = $('.board-wrap');
                msObj.board.attr('unselectable', 'on')
                    .css('UserSelect', 'none')
                    .css('MozUserSelect', 'none');
            }
            else {
                msObj.board.html('');
            }
            for (y = 0; y < height; y++) {
                var row = $('<ul class="row" data-index=' + y + '></ul>');
                for (x = 0; x < width; x++) {
                    var cell;
                    row.append('<li class="cell" data-coord="' + [x, y].join(',') + '" data-x=' + x + ' data-y=' + y + '>x</li>');
                    cell = row.find('.cell:last');
                    msObj.drawCell(cell);
                }
                msObj.board.append(row);
            }


        };

        this.redrawBoard = function () {
            msObj.board.find('li.cell').each(function (ind, cell) {
                msObj.drawCell($(cell));
            });

            if (msObj.worker) {
				msObj.callWorker('calc_win',msObj.options.num_mines);
            }
            else {
                if (!window.touchAdjacent) {
                    throw ("Could not load " + msObj.options.path_to_cell_toucher);
                }
                var win = minesweeperCalculateWin(msObj.grid);
                if (win) {
                    msObj.winGame();
                }
            }
        };


        this.drawCell = function (x, y) {
            var cell = null,
                gridobj;
            if (x instanceof jQuery) {
                cell = x;
				x = parseInt(cell.attr('data-x'), 10);
				y = parseInt(cell.attr('data-y'), 10);
            }
            else if (typeof x === 'number' && typeof y === 'number') {
                cell = getJqueryObject(x,y);
            }

            cell.removeClass().addClass('cell');

            try {
                gridobj = msObj.grid[y][x];
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

            msObj.stopTimer();

            var width = msObj.options.board_size[0],
                height = msObj.options.board_size[1],
                x,
                y;

            if (cellParam) {
                cellParam.removeClass();
                cellParam.addClass("cell " + STATE_EXPLODE);
            }
            for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                    var obj = msObj.grid[y][x],
                        cell= msObj.getJqueryObject(x,y);
                    if (obj.mine) {
                        cell.removeClass('ui-icon-help')
                            .addClass('ui-icon ui-icon-close blown');
                    }
                    else {
                        cell.addClass('unblown');
                    }
                }
            }
            msObj.running = false;
        };

        this.winGame = function () {
            msObj.stopTimer();
            msObj.running = false;
            var time = $('#timer').val();
            alert('You win!\nYour time: ' + time);
            msObj.checkBestTime(time);
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

        this.get_template = function (template) {
            var templates = {
                'settings': '<div class="game_settings"><select id="level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option><option value="custom">Custom</option></select>    <input type="text" id="dim_x" placeholder="x" size="5" disabled /><input type="text" id="dim_y" placeholder="y" size="5" disabled /><input type="text" id="num_mines" placeholder="mines" size="5" disabled /></div>',
                'actions': '<div class="game_actions"><button class="new-game">New Game</button><button id="best_times">Best times</button></div>',
                'status': '<div class="game_status"><label>Time:</label><input type="text" id="timer" size="6" value="0" readonly /><label>Mines:</label><input type="text" id="mine_flag_display" size="6" value="10" disabled />'
            };

            return templates[template];
        };

    };
});
