/* MineSweeper_recursion.js */
/* included for historical purposes, this is an early version that uses recursion */

jQuery(function($) {

	// "Static Constants"
	var STATE_UNKNOWN = 'unknown',
		STATE_OPEN    = 'open',
		STATE_NUMBER  = 'number',
		STATE_FLAGGED = 'flagged',
		STATE_EXPLODE = 'explode',
		STATE_QUESTION = 'question';

	var recursive_calls = 0;


MineSweeper = function () {
	// prevent namespace pollution
	if (!(this instanceof MineSweeper)) {
		return new MineSweeper();
	}
	var self = this;
	this.options = {};
	this.grid = [];
	this.running = true;

	this.init = function (options) {
		self.options = options || {};
		self.element = $(self.options.selector);
		if (!self.element.length) {
			throw "MineSweeper element not found";
		}
		self.clearBoard();
		self.redrawBoard();
		self.initHandlers();

		return self;
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
		self.redrawBoard();
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
		if (obj.state === STATE_OPEN) {
			// ignore clicks on these
			return false;
		}
		if (obj.mine) {
			// game over
			return self.gameOver(cell);
		}

		recursive_calls = 0;

		// Recursive Function:
		self.touchAdjacent(obj);

		console.log(recursive_calls + ' recursive_calls');

		// redraw board from memory representation
		self.redrawBoard();
	};

	// Touch all adjacent squares (there are 8)
	// Setting to either a number OR open state
	// If adjacent square results in OPEN state: TOUCH it also
	// obj = memory representation
	this.touchAdjacent = function (obj) {
		var squares = self.get8AdjacentSquares(obj),
			x,
			max,
			num_mines = 0;

		recursive_calls++;

		// calc # of mines
		for (x = 0, max = squares.length; x < max; x++) {
			var sq = squares[x];
			if (sq.mine) {
				num_mines++;
			}
		}

		if (obj.mine) {
			console.log(obj);
			throw "error: 'touched' a mine automatically";
		}

		if (num_mines > 0) {
			obj.state  = STATE_NUMBER;
			obj.number = num_mines;
		}
		else {
			obj.state  = STATE_OPEN;
			obj.number = 0;
		}

		for (x = 0, max = squares.length; x < max; x++) {
			var sq = squares[x];
			if (sq.state === STATE_OPEN || sq.state === STATE_NUMBER) {
				// ignore because already processed
			}
			else if (!sq.mine && num_mines === 0) {
				self.touchAdjacent(sq);
			}
			else {

			}
		}
	};

	this.get8AdjacentSquares = function (obj) {
		var array = [],
			grid = self.grid,
			x = obj.x,
			y = obj.y;

		//  0  1  2
		//  3  .  4
		//  5  6  7

		try {
			array[0] = self.grid[y-1][x-1];
		} catch(e) {};
		try {
			array[1] = self.grid[y-1][x];
		} catch(e) {};
		try {
			array[2] = self.grid[y-1][x+1];
		} catch(e) {};
		try {
			array[3] = self.grid[y][x-1];
		} catch(e) {};
		try {
			array[4] = self.grid[y][x+1];
		} catch(e) {};
		try {
			array[5] = self.grid[y+1][x-1];
		} catch(e) {};
		try {
			array[6] = self.grid[y+1][x];
		} catch(e) {};
		try {
			array[7] = self.grid[y+1][x+1];
		} catch(e) {};

		var results = [];
		for (var i = 0; i < 8; i++) {
			if (array[i]) {
				results.push(array[i]);
			}
		}

		return results;
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
		console.log(total_mines);

		// Put all mines in the beginning
		for (x = 0, max = width * height; x < max; x++) {
			if (x < total_mines) {
				array[x] = 1;
			}
			else {
				array[x] = 0;
			}
		}

		console.log(array);

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
		console.log(array);

		return array;
	};

	this.redrawBoard = function () {
		var width = self.options.board_size[0],
			height = self.options.board_size[1],
			x,
			y;

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

		try {
			gridobj = self.grid[y][x];
		}
		catch (e) {
			console.warn("Invalid grid coord: x,y = " + [x,y].join(','));
			return;
		}
		cell.html('');
		switch (gridobj.state) {
			case STATE_UNKNOWN:
			case STATE_OPEN:
			case STATE_FLAGGED:
			case STATE_EXPLODE:
			case STATE_QUESTION:
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
					cell.html('x');
				}
			}
		}
		self.running = false;
		alert("game over!");
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
	board_size: [20, 20],
	mines: 25
});

});
