/* MineSweeper.js */

var minesweeper;

jQuery(function($) {

	// "Static Constants"
	var STATE_UNKNOWN = 'unknown',
		STATE_OPEN    = 'open',
		STATE_NUMBER  = 'number',
		STATE_FLAGGED = 'flagged',
		STATE_EXPLODE = 'explode',
		STATE_QUESTION = 'question';


MineSweeper = function () {
	// prevent namespace pollution
	if (!(this instanceof MineSweeper)) {
		return new MineSweeper();
	}
	var self      = this;
	self.options  = {};
	self.grid     = [];
	self.running  = true;
	self.defaults = {
		selector: '#minesweeper',
		board_size: [20, 20],
		mines: 18,
		path_to_cell_toucher: 'js/cell_toucher.js'
	};

	this.init = function (options) {
		self.options = $.extend({}, self.defaults, options || {});
		self.element = $(self.options.selector);
		if (!self.element.length) {
			throw "MineSweeper element not found";
		}
		// insert progress animation before the grid
		if ($('.ajax-loading').length < 1) {
			$('<div class="invisible ajax-loading"><img src="load.gif" alt="Processing..." /></div>')
				.prependTo(self.element.parent());
		}
		self.clearBoard();
		self.redrawBoard();
		self.initHandlers();
		self.initWorkers();

		if (!window.JSON) {
			throw "This application requires a JSON parser.";
		}

		return self;
	};

	this.initWorkers = function () {
		if (window.Worker) {
			// Create a background web worker to process the grid "painting" with a stack
			self.worker = new Worker(self.options.path_to_cell_toucher);
			self.worker.addEventListener('message', function (e) {
				var data = JSON.parse(e.data);
				if (data.type === 'touch_adjacent') {
					self.grid = data.grid;
					self.redrawBoard();
				}
				else if (data.type === 'calc_win') {
					if (data.win) {
						self.winGame();
					}
				}
				$('.ajax-loading').addClass('invisible');
			}, false);
		}
		else {
			self.worker = null;
			// for older browsers, load the web worker script in global space to access the functions
			$.getScript(self.options.path_to_cell_toucher, function () {});
		}
	};

	this.initHandlers = function () {
		self.element.on('click', '.cell', function (ev) {
			var targ = $(ev.target);
			if (!self.running) {
				return false;
			}
			if (ev.which == 3) {
				// right mouse button
			}
			else {
				self.handleLeftClick(targ);
				return false;
			}
		});

		self.element.on("contextmenu", ".cell", function (ev) {
			var targ = $(ev.target);
			self.handleRightClick(targ);
			ev.preventDefault();
			return false;
		});
	};

	// cell = jQuery instance
	this.handleRightClick = function (cell) {
		if (!(cell instanceof jQuery)) {
			throw "Parameter must be jQuery instance";
		}
		if (!self.running) {
			return false;
		}
		var obj = self.getCellObj(cell);
		if (obj.state === STATE_OPEN || obj.state === STATE_NUMBER) {
			return false;
		}
		else if (obj.state === STATE_UNKNOWN) {
			obj.state = STATE_FLAGGED;
		}
		else if (obj.state === STATE_FLAGGED) {
			obj.state = STATE_QUESTION;
		}
		else {
			obj.state = STATE_UNKNOWN;
		}
		self.drawCell(cell);
	};

	// cell = jQuery instance
	this.handleLeftClick = function (cell) {
		// cell  = jQuery object
		// obj   = memory state
		if (!(cell instanceof jQuery)) {
			throw "Parameter must be jQuery instance";
		}
		var obj = self.getCellObj(cell);
		if (!self.running) {
			return false;
		}
		if (obj.state === STATE_OPEN || obj.state === STATE_NUMBER) {
			// ignore clicks on these
			return false;
		}
		if (obj.mine) {
			// game over
			return self.gameOver(cell);
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
		var cell = self.board.find('.cell[data-coord="' + [obj.x,obj.y].join(',') + '"]');
		return cell;
	};

	this.getRandomMineArray = function () {
		var width = self.options.board_size[0],
			height = self.options.board_size[1],
			total_mines = self.options.mines,
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
		function fisherYates ( myArray ) {
			var i = myArray.length, j, tempi, tempj;
			if ( i === 0 ) return false;
			while ( --i ) {
				j = Math.floor( Math.random() * ( i + 1 ) );
				tempi = myArray[i];
				tempj = myArray[j];
				myArray[i] = tempj;
				myArray[j] = tempi;
			}
		}

		fisherYates(array);

		return array;
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
		self.element.html('');
		self.element.append('<div class="board-wrap"></div>');
		self.board = self.element.find('.board-wrap');
		for (y = 0; y < height; y++) {
			var row = $('<ul class="row" data-index='+y+'></ul>');
			for (x = 0; x < width; x++) {
				var cell;
				row.append('<li class="cell" data-coord="'+[x, y].join(',')+'" data-x='+x+' data-y='+y+'>x</li>');
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
		// for (y = 0; y < height; y++) {
		// 	var row = $('<ul class="row" data-index='+y+'></ul>');
		// 	for (x = 0; x < width; x++) {
		// 		var cell;
		// 		row.append('<li class="cell" data-coord="'+[x, y].join(',')+'" data-x='+x+' data-y='+y+'>x</li>');
		// 		cell = row.find('.cell:last');
		// 		self.drawCell(cell);
		// 	}
		// 	self.board.append(row);
		// }
	};

	this.drawCell = function (x, y) {
		var cell = null,
			gridobj;
		if (x instanceof jQuery) {
			cell = x;
		}
		else if (typeof x === 'number' && typeof y === 'number') {
			cell = self.board.find('.cell[data-coord="' + [x,y].join(',') + '"]');
		}
		x = parseInt(cell.attr('data-x'), 10);
		y = parseInt(cell.attr('data-y'), 10);

		cell.removeClass().addClass('cell');

		try {
			gridobj = self.grid[y][x];
		}
		catch (e) {
			console.warn("Invalid grid coord: x,y = " + [x,y].join(','));
			return;
		}
		cell.html('');
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
				break;
			default:
				throw "Invalid gridobj state: " + gridobj.state;
		}
	};

	this.gameOver = function (cell) {
		// todo: handle gameover state
		var width = self.options.board_size[0],
			height = self.options.board_size[1],
			x,
			y;

		if (cell) {
			cell.removeClass();
			cell.addClass("cell " + STATE_EXPLODE);
		}
		for (y = 0; y < height; y++) {
			for (x = 0; x < width; x++) {
				var obj = self.grid[y][x],
					cell;
				if (obj.mine) {
					cell = self.getJqueryObject(obj);
					cell.removeClass('ui-icon-help')
						.addClass('ui-icon ui-icon-close');
				}
			}
		}
		self.running = false;
	};

	this.winGame = function () {

	};

	this.debugGrid = function () {
		for (var y = 0, max = self.grid.length; y < max; y++) {
			console.log(self.grid[y]);
		}
	};
};

// set a global instance
minesweeper = new MineSweeper();
minesweeper.init({
	selector: '#minesweeper',
	board_size: [30, 20],
	mines: 35
});

});
