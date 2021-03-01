/* globals alert */
/**
 MineSweeper.js
 Author: Michael C. Butler
 Url: https://github.com/michaelbutler/minesweeper

 Dependencies: jQuery, jQuery UI CSS (for icons)

 This file is part of MineSweeper.js.

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
  let levels = {
    beginner: {
      boardSize: [9, 9],
      numMines: 10,
    },
    intermediate: {
      boardSize: [16, 16],
      numMines: 40,
    },
    expert: {
      boardSize: [30, 16],
      numMines: 99,
    },
  };

  // "Static Constants"
  let STATE_UNKNOWN = 'unknown',
    STATE_OPEN = 'open',
    STATE_NUMBER = 'number',
    STATE_FLAGGED = 'flagged',
    STATE_EXPLODE = 'explode',
    STATE_QUESTION = 'question';
  let LEFT_MOUSE_BUTTON = 1,
    RIGHT_MOUSE_BUTTON = 3;
  let MAX_X = 30,
    MAX_Y = 30;

  MineSweeper = function () {
    // prevent namespace pollution
    if (!(this instanceof MineSweeper)) {
      throw 'Invalid use of Minesweeper';
    }
    let msObj = this;
    this.options = {};
    this.grid = [];
    this.running = true;
    // Controls whether mines were assigned to cells yet. First click should always be safe.
    this.minesDealt = false;
    this.defaults = {
      selector: '#minesweeper',
      boardSize: levels.beginner.boardSize,
      numMines: levels.beginner.numMines,
      pathToCellToucher: 'js/cell_toucher.js',
    };

    this.init = function (options) {
      msObj.options = $.extend({}, msObj.defaults, options || {});
      var msUI = $(msObj.options.selector);
      if (!msUI.length) {
        throw 'MineSweeper element not found';
      }
      if (!window.JSON) {
        throw 'This application requires a JSON parser.';
      }
      // insert progress animation before the grid
      if ($('.ajax-loading').length < 1) {
        msUI.before('<div class="invisible ajax-loading"></div>');
      }
      msObj.initWorkers(msObj.options.pathToCellToucher);
      msObj.clearBoard();
      msObj.redrawBoard();
      msObj.resetDisplays();
      msObj.initHandlers(msUI);
      msObj.initCleanUpTimer();
      return msObj;
    };

    /**
     *
     * @param taskType get_adjacent, touch_adjacent, or calc_win
     * @param payload number or object with {x: ?, y: ?}
     */
    this.callWorker = function (taskType, payload) {
      $('.ajax-loading').removeClass('invisible');
      let job = {
        type: taskType, // message type
        grid: msObj.grid,
      };
      if (typeof payload === 'number') {
        job.mines = payload;
      } else if (typeof payload === 'object') {
        job.x = payload.x;
        job.y = payload.y;
      }
      msObj.worker.postMessage(JSON.stringify(job));
    };

    this.initWorkers = function (wPath) {
      if (window.Worker) {
        // Create a background web worker to process the grid "painting" with a stack
        msObj.worker = new Worker(wPath);
        msObj.worker.onmessage = function (e) {
          let data = JSON.parse(e.data);
          msObj.handleWorkerMessage(data);
        };
      } else {
        alert(
          'Minesweeper requires Web Worker support. ' +
            'See https://browser-update.org/update.html'
        );
      }
    };

    this.initCleanUpTimer = function () {
      setInterval(function () {
        if (
          !msObj.LEFT_MOUSE_DOWN &&
          !msObj.RIGHT_MOUSE_DOWN &&
          msObj.board.find('.cell.test').length > 0
        ) {
          // Reset cell push down states periodically if mouse buttons are up
          msObj.board.find('.cell').removeClass('test');
        }
      }, 150);
    };

    this.initHandlers = function (msUI) {
      msUI.on('contextmenu', '.cell', function (ev) {
        ev.preventDefault();
      });

      msUI.on('mousemove', function (ev) {
        let button = ev.button || 0;
        let buttons = ev.buttons || 0;
        if (button === 0 && buttons === 0) {
          msObj.RIGHT_MOUSE_DOWN = false;
          msObj.LEFT_MOUSE_DOWN = false;
        }
      });

      msUI.on('mousedown', function (ev) {
        if (ev.which === RIGHT_MOUSE_BUTTON) {
          clearTimeout(msObj.RIGHT_BUTTON_TIMEOUT);
          msObj.RIGHT_MOUSE_DOWN = true;
        } else if (ev.which === LEFT_MOUSE_BUTTON) {
          clearTimeout(msObj.LEFT_BUTTON_TIMEOUT);
          msObj.LEFT_MOUSE_DOWN = true;
        }
      });

      msUI.on('mouseup', function (ev) {
        if (ev.which === RIGHT_MOUSE_BUTTON) {
          msObj.RIGHT_BUTTON_TIMEOUT = setTimeout(function () {
            msObj.RIGHT_MOUSE_DOWN = false;
          }, 50);
        } else if (ev.which === LEFT_MOUSE_BUTTON) {
          msObj.LEFT_BUTTON_TIMEOUT = setTimeout(function () {
            msObj.LEFT_MOUSE_DOWN = false;
          }, 50);
        }
      });

      msUI.on('mousedown', '.cell', function (ev) {
        let targ = $(ev.target);
        if (
          (ev.which === LEFT_MOUSE_BUTTON && msObj.RIGHT_MOUSE_DOWN) ||
          (ev.which === RIGHT_MOUSE_BUTTON && msObj.LEFT_MOUSE_DOWN)
        ) {
          // This occurs when player is holding BOTH the left and right mouse buttons down simultaneously
          let x = targ.attr('data-x') - 1;
          let ud = targ.parent().prev();
          let i;

          for (i = x; i < x + 3; i++) {
            ud.children('.unknown.[data-x=' + i + ']').addClass('test');
          }
          targ.prev('.unknown').addClass('test');
          targ.next('.unknown').addClass('test');
          ud = targ.parent().next();
          for (i = x; i < x + 3; i++) {
            ud.children('.unknown.[data-x=' + i + ']').addClass('test');
          }
        }
      });

      msUI.on('mouseup', '.cell', function (ev) {
        let targ = $(ev.target);
        if (ev.which === LEFT_MOUSE_BUTTON) {
          if (ev.shiftKey || ev.ctrlKey) {
            msObj.MODIFIER_KEY_DOWN = true;
            setTimeout(function () {
              msObj.MODIFIER_KEY_DOWN = false;
            }, 50);
            msObj.handleRightClick(targ);
          } else {
            msObj.handleLeftClick(targ);
          }
        } else if (ev.which === RIGHT_MOUSE_BUTTON) {
          msObj.handleRightClick(targ);
        }
      });

      $('.new-game').on('click', function (ev) {
        ev.preventDefault();
        msObj.stopTimer();
        msObj.timer = '';
        msObj.running = true;
        msObj.paused = false;
        msObj.board.removeClass('paused');
        msObj.setBoardOptions();
        msObj.clearBoard();
        msObj.redrawBoard();
        msObj.resetDisplays();
      });

      $('#level').on('change', function () {
        let input = $('.game_settings input');
        if ($('#level option:selected').val() === 'custom') {
          input.prop('disabled', false);
        } else {
          input.prop('disabled', true);
        }
        $('.new-game').trigger('click');
      });

      $('#bestTimes').on('click', function () {
        let beginnerTime = localStorage.getItem('best_time_beginner') || 'None';
        let intermediateTime =
          localStorage.getItem('best_time_intermediate') || 'None';
        let expertTime = localStorage.getItem('best_time_expert') || 'None';
        let beginnerName =
          localStorage.getItem('beginner_record_holder') || 'None';
        let intermediateName =
          localStorage.getItem('intermediate_record_holder') || 'None';
        let expertName = localStorage.getItem('expert_record_holder') || 'None';
        alert(
          'Best times:\nBeginner:     ' +
            beginnerName +
            ' : ' +
            beginnerTime +
            '\n' +
            'Intermediate: ' +
            intermediateName +
            ' : ' +
            intermediateTime +
            '\n' +
            'Expert:       ' +
            expertName +
            ' : ' +
            expertTime
        );
      });

      $('.msPause').on('click', function (ev) {
        ev.preventDefault();
        if (msObj.paused) {
          msObj.resumeGame();
        } else if (msObj.timer) {
          msObj.pauseGame();
        }
      });
    };

    /**
     * @return void
     * @param cell jQuery representation of cell
     */
    this.handleRightClick = function (cell) {
      if (!(cell instanceof jQuery)) {
        throw 'Parameter must be jQuery instance';
      }
      if (!msObj.running) {
        return;
      }
      let obj = msObj.getCellObj(cell);

      if (obj.state === STATE_NUMBER) {
        // auto clear neighbor cells
        if (msObj.LEFT_MOUSE_DOWN || msObj.MODIFIER_KEY_DOWN) {
          msObj.callWorker('get_adjacent', obj);
        }
        return;
      }

      if (obj.state === STATE_NUMBER) {
        return;
      }
      if (obj.state === STATE_QUESTION) {
        obj.state = STATE_UNKNOWN;
      } else {
        let flagDisplay = $('#mine_flag_display'),
          curr = parseInt(flagDisplay.val(), 10);
        if (obj.state === STATE_UNKNOWN) {
          obj.state = STATE_FLAGGED;
          flagDisplay.val(curr - 1);
        } else if (obj.state === STATE_FLAGGED) {
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
      // cell = jQuery object
      // obj = memory state
      if (!(cell instanceof jQuery)) {
        throw 'Parameter must be jQuery instance';
      }
      if (!msObj.running) {
        return;
      }
      if (!msObj.timer) {
        msObj.startTimer();
      }
      if (!msObj.minesDealt) {
        let x = parseInt(cell.attr('data-x'), 10);
        let y = parseInt(cell.attr('data-y'), 10);
        msObj.assignMines(x, y);
      }

      let obj = msObj.getCellObj(cell);
      if (obj.state === STATE_OPEN || obj.state === STATE_FLAGGED) {
        // ignore clicks on these
        return;
      }
      if (obj.state === STATE_NUMBER) {
        // auto clear neighbor cells
        if (msObj.RIGHT_MOUSE_DOWN) {
          msObj.callWorker('get_adjacent', obj);
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
        msObj.callWorker('touch_adjacent', obj);
      } else {
        // Synchronously
        if (!window.touchAdjacent) {
          throw 'Could not load ' + msObj.options.pathToCellToucher;
        }
        msObj.grid = window.touchAdjacent(obj, msObj.grid);
        // redraw board from memory representation
        msObj.redrawBoard();
      }
    };

    this.pauseGame = function () {
      // hide board so they can't cheat
      msObj.board.addClass('paused');
      // pause stopwatch
      msObj.stopTimer();
      // toggle button
      $('.msPause').html('Resume');
      msObj.paused = true;
    };

    this.resumeGame = function () {
      // show board
      msObj.board.removeClass('paused');
      // resume stopwatch
      msObj.resumeTimer();
      // toggle button
      msObj.paused = false;
    };

    this.handleWorkerMessage = function (data) {
      if (data.type === 'touch_adjacent' || data.type === 'get_adjacent') {
        msObj.grid = data.grid;
        msObj.redrawBoard();
      } else if (data.type === 'calc_win') {
        if (data.win) {
          msObj.winGame();
        }
      } else if (data.type === 'explode') {
        let cell = msObj.getJqueryObject(data.cell.x, data.cell.y);
        msObj.gameOver(cell);
      } else if (data.type === 'log') {
        if (console && console.log) {
          console.log(data.obj);
        }
      }
      $('.ajax-loading').addClass('invisible');
    };

    // return memory representation for jQuery instance
    this.getCellObj = function (domObj) {
      let gridobj, x, y;
      try {
        x = parseInt(domObj.attr('data-x'), 10);
        y = parseInt(domObj.attr('data-y'), 10);
        gridobj = msObj.grid[y][x];
      } catch (e) {
        console.warn('Could not find memory representation for:');
        console.log(domObj);
        throw 'Stopped.';
      }

      return gridobj;
    };

    this.getJqueryObject = function (x, y) {
      return msObj.board.find('.cell[data-coord="' + [x, y].join(',') + '"]');
    };

    this.getRandomMineArray = function (safeX, safeY) {
      let width = msObj.options.boardSize[0],
        height = msObj.options.boardSize[1],
        // Total Mines is a percentage of the total number of cells
        totalMines = msObj.options.numMines,
        array = [],
        x,
        max,
        infiniteLoop = 0;

      // Put all mines in the beginning
      for (x = 0, max = width * height; x < max; x++) {
        if (x < totalMines) {
          array[x] = 1;
        } else {
          array[x] = 0;
        }
      }

      // shuffle array so it's like pulling out of a 'hat'
      // credit: http://sedition.com/perl/javascript-fy.html
      function fisherYates(myArray) {
        let i = myArray.length,
          j,
          tempi,
          tempj;
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

      let safeIndex = safeX + safeY * width;
      do {
        fisherYates(array);
        infiniteLoop += 1;
        if (infiniteLoop > 999) {
          console.warn(
            'Giving up trying to prevent initial space from blowing up'
          );
          break;
        }
      } while (array[safeIndex] === 1);

      return array;
    };

    // set the board size and mine density
    this.setBoardOptions = function () {
      let level = $('#level').val();

      if (level === 'custom') {
        let dimX = parseInt($('#dim_x').val(), 10);
        let dimY = parseInt($('#dim_y').val(), 10);
        let numMines = parseInt($('#numMines').val(), 10);

        // rationalise options JIC
        if (isNaN(dimX) || dimX === 0) {
          dimX = 1;
        } else if (dimX > MAX_X) {
          dimX = MAX_X;
        }
        if (isNaN(dimY) || dimY === 0) {
          dimY = 1;
        } else if (dimY > MAX_Y) {
          dimY = MAX_Y;
        }
        if (isNaN(numMines) || numMines === 0) {
          numMines = 1;
        } else if (numMines >= dimX * dimY) {
          numMines = dimX * dimY - 1;
        }
        // refresh display with updated values
        $('#dim_x').val(dimX);
        $('#dim_y').val(dimY);
        $('#num_mines').val(numMines);

        msObj.options.boardSize = [dimX, dimY];
        msObj.options.numMines = numMines;
      } else {
        msObj.options.boardSize = levels[level].boardSize;
        msObj.options.numMines = levels[level].numMines;
      }
    };

    this.startTimer = function () {
      let timerElement = $('#timer');
      timerElement.val(0);
      $('.msPause').show();
      msObj.resumeTimer();
      /*msObj.timer = window.setInterval(function () {
        let curr = parseInt(timerElement.val(), 10);
        timerElement.val(curr + 1);
      }, 1000);*/
    };

    this.stopTimer = function () {
      if (msObj.timer) {
        window.clearInterval(msObj.timer);
      }
    };

    this.resumeTimer = function () {
      $('.msPause').html('Pause');
      let timerElement = $('#timer');
      console.log('resuming timer');
      msObj.timer = window.setInterval(function () {
        let curr = parseInt(timerElement.val(), 10);
        timerElement.val(curr + 1);
      }, 1000);
    };

    this.resetDisplays = function () {
      let level = $('#level option:selected').val();
      let numMines;

      if (level === 'custom') {
        numMines = $('#numMines').val();
      } else {
        numMines = levels[level].numMines;
      }

      $('#mine_flag_display').val(numMines);
      $('#timer').val(0);
      $('.msPause').hide();
    };

    /**
     * Distribute the mines randomly, being careful to avoid the safeX and safeY coord, which is where the player
     * first clicked.
     * @param safeX
     * @param safeY
     */
    this.assignMines = function (safeX, safeY) {
      if (msObj.minesDealt) {
        return;
      }
      let width = msObj.options.boardSize[0],
        height = msObj.options.boardSize[1],
        mineHat = msObj.getRandomMineArray(safeX, safeY),
        x,
        y,
        z = 0;

      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          msObj.grid[y][x].mine = mineHat[z++];
        }
      }

      msObj.minesDealt = true;
    };

    // clear & initialize the internal cell memory grid
    this.clearBoard = function () {
      let width = msObj.options.boardSize[0],
        height = msObj.options.boardSize[1],
        x,
        y;

      msObj.minesDealt = false;
      msObj.grid = [];
      for (y = 0; y < height; y++) {
        msObj.grid[y] = [];
        for (x = 0; x < width; x++) {
          msObj.grid[y][x] = {
            state: STATE_UNKNOWN,
            number: 0,
            mine: 0,
            x: x,
            y: y,
          };
        }
      }

      // Insert the board cells in DOM
      if (!msObj.board) {
        $(msObj.options.selector)
          .html('')
          .append(msObj.getTemplate('settings'))
          .append(msObj.getTemplate('actions'))
          .append(msObj.getTemplate('status'))
          .append('<div class="board-wrap"></div>');
        msObj.board = $('.board-wrap');
        msObj.board
          .attr('unselectable', 'on')
          .css('UserSelect', 'none')
          .css('MozUserSelect', 'none');
      } else {
        msObj.board.html('');
      }
      for (y = 0; y < height; y++) {
        var row = $('<ul class="row" data-index=' + y + '></ul>');
        for (x = 0; x < width; x++) {
          var cell;
          row.append(
            '<li class="cell" data-coord="' +
              [x, y].join(',') +
              '" data-x=' +
              x +
              ' data-y=' +
              y +
              '>x</li>'
          );
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
        msObj.callWorker('calc_win', msObj.options.numMines);
      } else {
        if (!window.touchAdjacent) {
          throw 'Could not load ' + msObj.options.pathToCellToucher;
        }

        let win = window.minesweeperCalculateWin(msObj.grid);
        if (win) {
          msObj.winGame();
        }
      }
    };

    this.drawCell = function (x, y) {
      let cell = null,
        gridobj;
      if (x instanceof jQuery) {
        cell = x;
        x = parseInt(cell.attr('data-x'), 10);
        y = parseInt(cell.attr('data-y'), 10);
      } else if (typeof x === 'number' && typeof y === 'number') {
        cell = msObj.getJqueryObject(x, y);
      }

      cell.removeClass().addClass('cell');

      try {
        gridobj = msObj.grid[y][x];
      } catch (e) {
        console.warn('Invalid grid coord: x,y = ' + [x, y].join(','));
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
        /* falls through */
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
          throw 'Invalid gridobj state: ' + gridobj.state;
      }
    };

    /**
     * @param cellParam
     * @return void
     */
    this.gameOver = function (cellParam) {
      msObj.stopTimer();
      $('.msPause').hide();

      let width = msObj.options.boardSize[0],
        height = msObj.options.boardSize[1],
        x,
        y;

      if (cellParam) {
        cellParam.removeClass();
        cellParam.addClass('cell ' + STATE_EXPLODE);
      }
      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          var obj = msObj.grid[y][x],
            cell = msObj.getJqueryObject(x, y);
          if (obj.mine) {
            cell
              .removeClass('ui-icon-help')
              .addClass('ui-icon ui-icon-close blown');
          } else {
            cell.addClass('unblown');
          }
        }
      }
      msObj.running = false;
    };

    this.winGame = function () {
      msObj.stopTimer();
      $('.msPause').hide();
      msObj.running = false;
      let time = $('#timer').val();
      alert('You win!\nYour time: ' + time);
      msObj.checkBestTime(time);
    };

    this.checkBestTime = function (time) {
      let level = $('#level').val();
      if (level === 'custom') {
        return;
      }
      let bestTime = localStorage.getItem('best_time_' + level);
      if (!bestTime || parseInt(time, 10) < parseInt(bestTime, 10)) {
        let displayName = localStorage.getItem(level + '_record_holder');
        if (!displayName) {
          displayName = localStorage.getItem('beginner_record_holder');
        }
        if (!displayName) {
          displayName = localStorage.getItem('intermediate_record_holder');
        }
        if (!displayName) {
          displayName = localStorage.getItem('expert_record_holder');
        }
        if (!displayName) {
          displayName = 'Your name';
        }
        let name = window.prompt(
          'Congrats! You beat the best ' + level + ' time!',
          displayName
        );

        localStorage.setItem('best_time_' + level, time);
        localStorage.setItem(level + '_record_holder', name);
      }
    };

    this.getTemplate = function (template) {
      let templates = {
        settings:
          '<div class="game_settings"><select id="level" class="msLevel"><option value="beginner">Beginner</option>' +
          '<option value="intermediate">Intermediate</option><option value="expert">Expert</option>' +
          '<option value="custom">Custom</option></select>' +
          '<input type="text" id="dim_x" class="msDimX" placeholder="x" size="5" disabled value="20" />' +
          '<input type="text" id="dim_y" class="msDimY" placeholder="y" size="5" disabled value="20" />' +
          '<input type="text" id="numMines" class="msNumMines" placeholder="mines" size="5" disabled />' +
          '</div>',
        actions:
          '<div class="game_actions"><button class="new-game">New Game</button>' +
          '<button id="bestTimes">Best times</button></div>' +
          '<button id="pause" class="msPause">Pause</button></div>',
        status:
          '<div class="game_status"><label>Time:</label>' +
          '<input type="text" id="timer" class="msTimer" size="6" value="0" readonly />' +
          '<label>Mines:</label>' +
          '<input type="text" id="mine_flag_display" class="msMineFlagDisplay" size="6" value="10" disabled />',
      };

      return templates[template];
    };
  };
});
