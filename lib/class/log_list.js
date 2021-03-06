module.exports = function defineLogList(Janeway, Blast, Bound) {

	var F = Bound.Function;

	/**
	 * The class that controls the `blessed` output box
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Janeway}  janeway
	 * @param    {Screen}   screen   The screen on which every node renders
	 * @param    {Box}      box      Box widget, with scrollable behaviour
	 */
	var LogList = F.inherits(function LogList(janeway, screen, box) {

		// Main janeway instance
		this.janeway = janeway;

		// The main screen
		this.screen = screen;

		// The output box
		this.box = box;

		// The list of lines, these map to the actual lines in the box
		this.list = [];

		// The line that is currently selected
		this.selectedLine = null;
	});

	/**
	 * Sanitize lines before outputting
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.2
	 * @version  0.1.2
	 *
	 * @param    {Number}   index
	 * @param    {String}   str
	 */
	LogList.setMethod(function sanitize(str) {

		// Get the string content of the line
		str = str.toString();

		// Don't print newlines
		// @todo: better newline handling
		str = str.replace(/\n/g, '\u23CE ');

		return str;
	});

	/**
	 * Actually output a string to the screen (insert)
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.2
	 *
	 * @param    {Number}   index
	 * @param    {String}   str
	 */
	LogList.setMethod(function _setLine(index, str) {
		this.box.setLine(index, this.sanitize(str));
	});

	/**
	 * Actually output a string to the screen
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.2
	 *
	 * @param    {Number}   index
	 * @param    {String}   str
	 */
	LogList.setMethod(function _insertLine(index, str) {
		this.box.insertLine(index, this.sanitize(str));
	});

	/**
	 * Push a line onto the output box.
	 * Does not render the screen.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {LogLine}  line    The line instance to add
	 * @param    {Boolean}  defer   If true, content will be set on next tick
	 */
	LogList.setMethod(function pushLine(line, defer) {

		var that = this,
		    length;

		// Store it in our list
		length = this.list.push(line);

		// Set the id in the list
		line.index = length-1;

		// Add it to the screen box (still need to call render)
		if (!defer) {
			this._setLine(line.index, line);

			if (this.janeway.scrollDown) {
				that.janeway.scrollAlong(false);
			}

			return;
		}

		setImmediate(function deferAndRenderLine() {
			that._setLine(line.index, line);

			// Scroll and/or render
			that.janeway.scrollAlong();
		});
	});

	/**
	 * Inject a line into the box, after the given index.
	 * Does not render the screen.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {LogLine}  line         The line instance to add
	 * @param    {Number}   afterIndex   The index the new line should go after
	 */
	LogList.setMethod(function insertAfter(line, afterIndex) {

		var that  = this,
		    index = afterIndex + 1;

		// Inject it into the list of lines
		Bound.Array.insert(this.list, index, line);

		// Set the id
		line.index = index;

		for (i = index+1; i < this.list.length; i++) {
			this.list[i].index += 1;
		}

		this._insertLine(index, line);
	});

	/**
	 * Reindex the internal list,
	 * re-assigns the id of every line.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Number}   start   Index to start with
	 */
	LogList.setMethod(function reIndex(start) {

		var i;

		if (typeof start !== 'number') {
			start = 0;
		}

		for (i = start; i < this.list.length; i++) {
			this.list[i].index = i;
		}
	});

	/**
	 * Remove a line (and all its children) from the visible `curses` screen.
	 * After this, the screen gets rendered.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Number}   indexToRemove
	 */
	LogList.setMethod(function removeLine(indexToRemove) {

		var indices,
		    line,
		    i;

		line = this.list[indexToRemove];

		if (line) {
			// Lines can have children, those also need to be removed
			indices = line.getAllIndices();
			this.clearLines(indices);

			this.render();
		}
	});

	/**
	 * Remove the given indices from the `list` and screen.
	 * Render still needs to be called.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Array}   indices   An array of indices
	 */
	LogList.setMethod(function clearLines(indices) {

		var index,
		    min,
		    i;

		// Sort the indices
		Blast.Bound.Array.flashsort(indices);

		// Get the minimum index
		min = indices[0];

		// Reverse them
		indices.reverse();

		for (i = 0; i < indices.length; i++) {

			index = indices[i];

			// Delete the line from the output box
			this.box.deleteLine(index);

			// Delete the line from the array
			this.list.splice(index, 1);
		}

		// Reindex the list
		this.reIndex(min);
	});

	/**
	 * Clear the entire screen
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Array}   indices   An array of indices
	 */
	LogList.setMethod(function clearScreen() {

		var index,
		    min,
		    i;

		if (this.list.selectedLine) {
			this.list.selectedLine.unselect();
		}

		// Remove all lines
		this.list.length = 0;

		// Clear the screen
		this.box.setContent('');
		this.render();
	});

	/**
	 * Handle a click on the given lineIndex,
	 * call the #select() method of the clicked line.
	 *
	 * Renders the screen.
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Number}   lineIndex   Absolute index of clicked line
	 * @param    {Number}   x           Absolute x position (`screen`)
	 * @param    {Number}   y           Absolute y position (`screen`)
	 */
	LogList.setMethod(function click(lineIndex, x, y) {

		var line = this.list[lineIndex];

		//console.log('Clicked on:', lineIndex, line, this.list);

		if (line) {
			line.select(x);
			this.render();
		}
	});

	/**
	 * Render the output box and parent screen.
	 * Will only render once every 50ms
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.4
	 */
	LogList.setMethod('render', F.throttle(function render() {
		this.box.render();
		this.screen.render();
	}, 70));

	/**
	 * `console.NAME` handler
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Array}   args   The arguments to print out
	 * @param    {String}  type   The type of message [log]
	 * @param    {Object}  options
	 */
	LogList.setMethod(function consoleLog(args, type, options) {

		var line;

		// Create a new LogLine instance to construct the string
		switch (type) {

			case 'info':
				line = new Janeway.InfoLogLine(this);
				break;

			case 'warn':
				line = new Janeway.WarningLogLine(this);
				break;

			case 'error':
				line = new Janeway.ErrorLogLine(this);
				break;

			default:
				line = new Janeway.ArgsLogLine(this);
				break;
		}

		if (options && options.info) {
			line.setFileinfo(options.info);
		}

		line.set(args);

		this.pushLine(line, true);
	});

	Janeway.LogList = LogList;
};