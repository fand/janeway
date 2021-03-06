var Blast = require('protoblast')(false), // Protoblast without native mods
    util  = require('util'),
    JanewayClass,
    Janeway,
    started = false,
    consoleWidth  = process.stdout.columns,
    consoleHeight = process.stdout.rows,
    stripEsc,
    outputs,
    esc;

/**
 * The Janeway class
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.0
 * @version  0.1.5
 */
JanewayClass = Blast.Collection.Function.inherits('Informer', function Janeway() {

	// Open popup boxes
	this.open_popups = {};

	// CLI history
	this.cli_history = [];

	// Current cli history index
	this.cli_history_index = -1;

	// The stashed cli input
	this.cli_stash = '';
});

/**
 * Scrolldown on new data (true by default)
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('scrollDown', true);

/**
 * Has the user scrolled manually?
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('scrolledManually', false);

/**
 * Verbosity levels
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.4
 * @version  0.1.4
 */
JanewayClass.setProperty('LEVELS', {
	'FATAL':     0,
	'SEVERE':    1,
	'ERROR':     2,
	'WARNING':   3,
	'TODO':      4,
	'INFO':      5,
	'DEBUG':     6,
	'HIDEBUG':   7
});

/**
 * Simple function to enter terminal colour codes
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Number|String}  code  The code(s) to escape
 * @param    {String}         str   If given: Add string and reset code
 *
 * @return   {String}
 */
JanewayClass.setMethod(function esc(code, str, endcode) {

	var result = '\u001b[' + code + 'm';

	if (typeof str !== 'undefined') {

		if (typeof endcode === 'undefined') {
			endcode = 0;
		}

		result += str + esc(endcode);
	}

	return result;
});

esc = JanewayClass.prototype.esc;

/**
 * Strip terminal colour escape sequences from a string
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.0
 * @version  0.1.1
 *
 * @param    {String}  str       The string containing escape sequences
 * @param    {Boolean} literal   Remove literal representations in strings
 *
 * @return   {String}
 */
JanewayClass.setMethod(function stripEsc(str, literal) {
	var result = str.replace(/\u001b\[(\d\;?)+m/g, '');

	if (literal) {
		result = result.replace(/\\u001(?:b|B)\[(\d\;?)+m/, '');
	}

	return result;
});

stripEsc = JanewayClass.prototype.stripEsc;

/**
 * Create augmented versions of the `stdout` and `stderr` objects.
 * After that, we set the `write` functions on those augmented objects.
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.1
 * @version  0.1.1
 */
outputs = {
	stdin: process.stdin,
	stdout: Object.create(process.stdout),
	stderr: Object.create(process.stderr)
};

outputs.stdout.write = process.stdout.write;
outputs.stderr.write = process.stderr.write;

/**
 * Output debug messages to an external file
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.2
 * @version  0.1.2
 *
 * @param    {Mixed}  message
 */
JanewayClass.setMethod(function debug(message) {

	var str;

	if (message instanceof Error) {
		str = message.message + '\n' + message.stack;
	} else {
		str = require('util').inspect(message, {colors: true});
	}

	require('fs').appendFileSync('/tmp/janewaydebug.log', str + '\n');
});

/**
 * Extract info from a single stack line
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @param   {String}   caller_line   The string
 *
 * @return  {Object}   An object containing the info
 */
JanewayClass.setMethod(function extractLineInfo(caller_line) {

	var result,
	    index,
	    clean,
	    temp;

	// Get the index
	index = caller_line.indexOf('at ');

	// Get the error line, without the '  at ' part
	clean = caller_line.slice(index+2, caller_line.length);

	result = /^ (.*?) \((.*?):(\d*):(\d*)\)/.exec(clean);

	// If nothing was found, it's probably an anonymous function
	if (!result) {
		temp = /(.*?):(\d*):(\d*)/.exec(clean);

		if (!temp) {
			temp = ['unknown', 'unknown', 'unknown', 'unknown'];
		}

		result = ['', 'anonymous', temp[1], temp[2], temp[3]];
	}

	return {
		name: result[1],
		path: result[2],
		file: result[2].split('/').pop(),
		line: result[3],
		char: result[4]
	};
});

/**
 * Get info on the caller: what line this function was called from
 * This is done by creating an error object, which in its turn creates
 * a stack trace string we can manipulate
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @param   {Integer}   level   Skip x many callers
 *
 * @return  {Object}    An object contain caller info
 */
JanewayClass.setMethod(function getCallerInfo(level, err) {

	var caller_line,
	    stack,
	    copy,
	    key,
	    msg,
	    obj,
	    def,
	    ar,
	    i;

	if (err && err.type === 'callerInfo') {

		// Shallow clone the object
		err = Blast.Bound.Object.assign({}, err);

		if (typeof err.level !== 'undefined') {
			for (key in err.stack[err.level]) {
				err[key] = err.stack[err.level][key];
			}
		}

		return err;
	}

	if (typeof level === 'undefined') level = 0;

	level += 3;

	if (typeof err == 'string') {
		msg = err;
		err = undefined;
	}

	if (!err) {

		def = Error.stackTraceLimit;

		// Set the stacktracelimit, we don't need anything above the wanted level
		Error.stackTraceLimit = 1 + level;

		err = new Error(msg);

		// Now reset the stacktracelimit to its default
		Error.stackTraceLimit = def;
	}

	// Some errors don't have a stack
	stack = err.stack || '';

	// Turn the stack string into an array
	ar = stack.split('\n');

	// Get the caller line
	caller_line = ar[level];

	if (!caller_line) {
		caller_line = ar[ar.length-1];
	}

	obj = this.extractLineInfo(caller_line);
	obj.text = stack;

	obj.stack = [];

	copy = ar.splice(0);

	// Remove the first entry in the array
	copy.shift();

	for (i = 0; i < copy.length; i++) {
		obj.stack.push(this.extractLineInfo(copy[i]));
	}

	obj.err = err;
	obj.message = err.message;
	obj.name = err.name;
	obj.type = 'callerInfo';

	return obj;
});

/**
 * Indent text
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 *
 * @return  {String}
 */
JanewayClass.setMethod(function indent(text, skipText, skipFirstLine) {

	var lines        = text.split('\n'),
	    visibleCount = stripEsc(skipText).length,
	    hiddenCount  = skipText.length,
	    difference   = hiddenCount - visibleCount,
	    maxWidth,
	    uselength,
	    lineNr,
	    line,
	    length,
	    hiddenLength,
	    visibleLength,
	    result;

	if (typeof skipFirstLine === 'undefined') skipFirstLine = true;
	if (skipFirstLine) {
		skipFirstLine = 1;
	} else {
		skipFirstLine = 0;
	}

	for (i = 0; i < lines.length; i++) {
		
		if (i == 0 && skipFirstLine){
			maxWidth = consoleWidth + difference;
		} else {
			lines[i] = multiply(' ', visibleCount) + lines[i];
			maxWidth = consoleWidth;
		}

		line = lines[i];

		hiddenLength = line.length;
		visibleLength = stripEsc(line).length;

		if (visibleLength > consoleWidth) {
			lines[i] = line.substring(0, maxWidth) + '\n' + multiply(' ', visibleCount) + line.substring(maxWidth);
		}
	}

	return lines.join('\n');
});

/**
 * Output messages
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.5
 *
 * @param    {String}  type
 * @param    {Array}   args
 * @param    {Object}  options
 */
JanewayClass.setMethod(function print(type, args, options) {

	var i,
	    info,
	    level,
	    trace,
	    output;

	if (!options) {
		options = {};
	}

	if (typeof options.verbosity == 'undefined') {
		options.verbosity = this.LEVELS.INFO;
	}

	level = options.level || 0;

	if (options.err) {
		level -= 3;
	}

	info = this.getCallerInfo(options.level, options.err);
	options.info = info;
	info.time = new Date();

	if (this.logList) {
		this.logList.consoleLog(args, type, options);
	} else {
		trace = esc(90, '[') + type + esc(90, '] ') + esc(90, '[') + esc(1, info.file + ':' + info.line) + esc(90, '] ');
		output = trace;

		for (i = 0; i < args.length; i++) {

			if (args[i] && typeof args[i] != 'string') {
				args[i] = util.inspect(args[i], {colors: true});
			}

			if (typeof args[i] != 'string') {
				output += util.inspect(args[i], {colors: true});
			} else {
				output += args[i];
			}
		}

		// Remove colours when terminal doesn't support them
		if (!process.env.COLORTERM) {
			output = stripEsc(output);
		}

		try {
			output = this.indent(output, trace);
		} catch (err) {
			console.log(err);
		}

		console.log(output);
	}
});

/**
 * Scroll the main window
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.4
 * @version  0.1.4
 *
 * @param    {Number}  direction
 */
JanewayClass.setMethod(function scroll(direction) {

	var before,
	    after;

	if (direction == null) {
		direction = 1;
	}

	before = this.logList.box.getScrollPerc();
	this.logList.box.scroll(direction);
	after = this.logList.box.getScrollPerc();

	// Undo scroll if nothing changed
	if (before == 0 && after == 0) {
		this.logList.box.scroll(0 - direction);
	}
});

/**
 * Keep the newest line in screen, unless the user has scrolled away
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.4
 * @version  0.1.4
 *
 * @param    {Boolean}   or_render   If scrollDown is false, render the box at least (true)
 */
JanewayClass.setMethod(function scrollAlong(or_render) {
	if (this.scrollDown) {

		if (!this.scrolledManually) {
			this.scroll(1);
		}

		this.logList.render();
	} else if (or_render !== false) {
		this.logList.render();
	}
});

/**
 * Show a popup
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.5
 * @version  0.1.5
 *
 * @param    {String}   id       The unique id (only 1 can be open at a time)
 * @param    {Object}   options
 *
 * @return   {ListBox}
 */
JanewayClass.setMethod(function popup(id, options) {

	var list;

	if (!options) {
		if (this.open_popups[id]) {
			this.open_popups[id].destroy();
		}

		return;
	}

	if (!options.position) {
		options.position = {};
	}

	if (options.position.bottom == null) {
		options.position.bottom = 2;
	}

	if (options.position.height == null) {
		options.position.height = 6;
	}

	if (this.open_popups[id]) {
		this.open_popups[id].destroy();
	}

	// Create a new list
	list = this.blessed.list({
		//bottom: 2,
		position: options.position,
		width: '100%',
		items: options.items,
		mouse: true, // Allow selecting items with the mouse
		scrollbar: {
			bg: 'green'
		},
		border: {
			type: 'line'
		},
		shadow: true,
		style: {
			bg: 'blue',
			fg: 'white'
		}
	});

	// Store the popup under its unique id
	this.open_popups[id] = list;

	// Add it to the screen
	this.screen.append(list);

	// Make sure it's in the front
	list.setFront();

	// Render the screen
	this.screen.render();

	return list;
});

/**
 * Show the autocomplete
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.5
 * @version  0.1.5
 *
 * @param    {String}   cmd   The current content of the CLI
 * @param    {Object}   key   The last key pressed
 */
JanewayClass.setMethod(function autocomplete(cmd, key) {

	var pieces,
	    target,
	    hidden,
	    items,
	    item,
	    last,
	    left,
	    list,
	    keys,
	    key,
	    i;

	if (!cmd && !key) {
		return this.autocomplete_list = this.popup('autocomplete', false);
	}

	this.autocomplete_prefix = null;
	pieces = cmd.split('.');
	items = [];
	left = 1 + cmd.length;

	if (pieces.length == 1) {
		target = global;
		last = cmd;
	} else {
		last = pieces.pop();
		target = Blast.Bound.Object.path(global, pieces);

		this.autocomplete_prefix = pieces.join('.') + '.';
	}

	if (target) {

		// First: get its own keys
		keys = Object.keys(target);

		// Now get all the hidden ones
		hidden = Blast.Bound.Array.subtract(Object.getOwnPropertyNames(target), keys);

		for (i = 0; i < keys.length; i++) {
			item = keys[i];

			if (!last || Blast.Bound.String.startsWith(item, last)) {
				items.push(item);
			}
		}

		for (i = 0; i < hidden.length; i++) {
			item = hidden[i];

			if (!last || Blast.Bound.String.startsWith(item, last)) {
				items.push(item);
			}
		}
	}

	if (cmd.trim() && items.length) {
		list = this.popup('autocomplete', {position: {left: left, height: 6}, items: items});
	} else {
		list = this.popup('autocomplete', false);
	}

	this.autocomplete_list = list;
});

/**
 * Start Janeway
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.0
 * @version  0.1.5
 *
 * @param    {Function}   callback
 */
JanewayClass.setMethod(function start(callback) {

	var that = this,
	    scrolledUp = false,
	    logList,
	    bottom,
	    output,
	    screen,
	    form,
	    cli,
	    to;

	if (typeof callback != 'function') {
		callback = null;
	}

	if (started) {
		console.error('Can not start Janeway twice!');

		if (callback) {
			that.once('ready', callback);
		}

		return;
	}

	if (!process.stdout.isTTY) {

		if (callback) {
			callback(new Error('Could not start Janeway, not a valid TTY terminal'));
		}

		return console.error('Could not start Janeway, not a valid TTY terminal');
	}

	if (!Blast.isNW) {
		// As soon as this is required, it kicks in and takes over the screen
		blessed = require('blessed');
		screen  = blessed.screen({output: outputs.stdout, error: outputs.stderr, handleUncaughtExceptions: false});

		// Create the interface boxes
		bottom = blessed.box({
			bottom: '0',
			width: '100%',
			content: '▶',
			height: 2,
			style: {
				bg: 'white',
				fg: 'blue'
			}
		});

		form = blessed.form({
			width: '100%',
			left: 2,
			content: 'FORM',
			style: {
				bg: 'white',
				fg: 'blue'
			}
		});

		cli = blessed.textarea({
			width: '100%',
			left: 0,
			bottom: 0,
			content: 'ghost',
			style: {
				bg: 'white',
				fg: 'blue'
			},
			//inputOnFocus: true,
			mouse: true
		});

		output = blessed.box({
			bottom: 2,
			left: 0,
			width: '100%',
			height: screen.height-2,
			scrollable: true,
			alwaysScroll: true, // Don't turn this off, or it breaks
			content: 'Line 0',
			wrap: false,
			scrollbar: {
				bg: 'blue'
			},
			style: {
				fg: 'white',
				bg: 'transparent'
			}
		});

		// Store elements in the object
		this.blessed = blessed;
		this.screen = screen;
		this.output = output;
		this.bottom = bottom;
		this.form = form;
		this.cli = cli;

		// Create the LogList instance
		logList = new Janeway.LogList(this, screen, output);
		this.logList = logList;
	}

	/**
	 * Keep a reference to the original `console.log`
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console._log = console.log;

	/**
	 * Hijack console.log
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	console.log = function log() {
		that.print('info', arguments, {level: 1});
	};

	/**
	 * Hijack console.dir
	 * (Currently the same as log)
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.dir = function dir() {
		that.print('dir', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.info
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.info = function info() {
		that.print('info', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.warn
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.warn = function warn() {
		that.print('warn', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	/**
	 * Hijack console.error
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	console.error = function error() {
		that.print('error', Blast.Bound.Array.cast(arguments), {level: 1});
	};

	if (Blast.isNW) {

		if (callback) {
			callback(new Error('Janeway does not work under nw.js'));
		}

		return;
	}

	// Prepare to hijack stdout & stderr `write` functions
	to = {
		stdout: process.stdout.write,
		stderr: process.stderr.write
	};

	/**
	 * Hijack stderr output
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	process.stderr.write = function stderrWrite(string, encoding, fd) {
		that.print('error', [''+string]);
	};

	/**
	 * Hijack stdout output
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.1
	 */
	process.stdout.write = function stdoutWrite(string, encoding, fd) {
		that.print('info', [''+string]);
	};

	/**
	 * Handle mouse events (scrolling)
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.4
	 */
	output.on('mouse', function onMouse(e) {

		var scrolled = false;

		if (e.action == 'wheelup') {
			output.scroll(-5);
			scrolledUp = true;
			scrolled = true;
		} else if (e.action == 'wheeldown') {
			output.scroll(5);
			scrolledUp = false;
			scrolled = true;
		}

		if (scrolled) {
			that.scrolledManually = true;

			if (output.getScrollPerc() == 100) {
				that.scrolledManually = false;
			}

			logList.render();
		}
	});

	/**
	 * Handle mouse clicks
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.4
	 */
	output.on('click', function onClick(data) {

		var scrollHeight,
		    bottomIndex,
		    lineIndex,
		    topIndex,
		    gScroll,
		    scroll,
		    line,
		    str;

		// Scroll index of either top or bottom visible line
		gScroll = output.getScroll();

		// Get the current height of the scroll
		scrollHeight = that.logList.box.getScrollHeight();

		if (scrolledUp && scrollHeight > output.height) {
			lineIndex = gScroll + data.y;
		} else {
			bottomIndex = gScroll;

			if (scrollHeight > output.height) {
				topIndex = bottomIndex - output.height + 1;
			} else {
				topIndex = 0;
			}

			lineIndex = data.y - output.top + topIndex;
		}

		//console.log('Lid:', lineIndex, 'Gscroll', gScroll, 'Sup', scrolledUp, 'Data', data.y, 'Top', output.top, 'Height', output.height, 'Sheight', scrollHeight, 'Topindex', topIndex, 'Bottomindex', bottomIndex);

		logList.click(lineIndex, data.x, data.y);
	});

	/**
	 * Enter the currently selected value in the autocomplete list into the CLI
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.5
	 * @version  0.1.5
	 */
	function selectAutocomplete() {

		var temp,
		    path;

		// Get the selected item
		temp = that.autocomplete_list.getItem(that.autocomplete_list.selected);

		// Get the path before the last dot
		path = that.autocomplete_prefix || '';

		if (temp) {
			cli.setValue(path + temp.content);
			that.autocomplete();
		}
	}

	/**
	 * Handle input of the CLI
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.0
	 * @version  0.1.5
	 */
	cli.on('keypress', function onKeypress(e, key) {

		var result,
		    commandLine,
		    errorLine,
		    evalLine,
		    scope,
		    path,
		    temp,
		    dir,
		    cmd,
		    id;

		if (key.name == 'pagedown') {
			that.scroll(20);
		} else if (key.name == 'pageup') {
			that.scroll(-20);
		} else if (key.name == 'enter') {

			if (that.autocomplete_list) {
				return selectAutocomplete();
			}

			cmd = cli.getValue().trim();

			// Reset the index
			that.cli_history_index = -1;

			// Clear out the stash
			that.cli_stash = '';

			// Return if the cmd is empty
			if (cmd) {
				cli.clearValue();
			} else {
				return;
			}

			// If the new command differs from the last one, unshift it onto the array
			if (cmd != that.cli_history[0]) {
				that.cli_history.unshift(cmd);
			}

			if (cmd == 'cls') {
				logList.clearScreen();

				setImmediate(function() {
					cli.clearValue();
					cli.render();
				});
				return;
			} else if (cmd == 'exit') {
				process.exit();
			}

			// Create a line for the input command
			commandLine = new Janeway.CommandLogLine(logList);
			commandLine.set(esc('38;5;74', cmd));

			// Add it to the logList
			logList.pushLine(commandLine);

			try {

				// Run the command in the global scope
				result = (1, eval)(cmd);

				// Create a line for the output
				evalLine = new Janeway.EvalOutputLogLine(logList);
				evalLine.set([result]);

				logList.insertAfter(evalLine, commandLine.index);
			} catch (err) {
				errorLine = new Janeway.ErrorLogLine(logList);
				errorLine.set([err]);

				logList.insertAfter(errorLine, commandLine.index);
			}

			// Even though the input has been cleared,
			// the return gets added afterwards
			setImmediate(function() {
				cli.clearValue();
				cli.render();

				// Scroll along if needed
				that.scrollAlong();
			});
		} else {
			if (key.ch == '.' || key.name == 'tab') {
				if (that.autocomplete_list) {
					selectAutocomplete();
				}
			}

			cmd = cli.getValue();

			if (key.code || key.name == 'escape') {
				// Ignore keys with codes

				// If the autocomplete list is open, listen to the arrow keys
				if (that.autocomplete_list) {
					if (key.name == 'up') {
						that.autocomplete_list.up(1);
						that.autocomplete_list.render();
					} else if (key.name == 'down') {
						that.autocomplete_list.down(1);
					} else if (key.name == 'escape') {
						that.autocomplete();
					}

					screen.render();
				} else {

					// If the autocomplete popup is not open,
					// arrow keys should cycle through the CLI history
					if (key.name == 'up') {
						dir = 1;
					} else if (key.name == 'down') {
						dir = -1;
					}

					if (dir) {
						// If the current index is -1, stash the current input
						if (that.cli_history_index == -1 && cmd) {
							that.cli_stash = cmd;
						}

						id = that.cli_history_index + dir;

						if (id == -1) {
							that.cli_history_index = -1;
							cli.setValue(that.cli_stash);
						} else if (that.cli_history[id] != null) {

							// Get the history entry
							temp = that.cli_history[id];

							// Set the new index
							that.cli_history_index = id;

							// Set the value in the cli
							cli.setValue(temp);
						}

						screen.render();
					}
				}

				return;
			} else if (key.name === 'backspace') {
				cmd = cmd.slice(0, -1);
			} else {
				cmd += e;
			}

			that.autocomplete(cmd, key);
		}
	});

	// Prepare the screen contents and render
	screen.append(bottom);
	screen.append(output);
	bottom.append(form);
	form.append(cli);

	// Quit on Control-C.
	cli.key(['C-c'], function exitNow(ch, key) {
		return process.exit(0);
	});

	// The CLI is always in focus
	cli.readInput(function recurse(result) {
		cli.readInput(recurse);
	});

	/**
	 * Listen to the next screen render event,
	 * only then will things be visible on the screen
	 *
	 * @author   Jelle De Loecker   <jelle@kipdola.be>
	 * @since    0.1.1
	 * @version  0.1.5
	 */
	screen.once('render', function onRender() {
		that.emitOnce('ready');

		if (callback) {
			callback();
		}
	});

	screen.render();
});

Janeway = new JanewayClass();

// Require all the classes
require('./class/log_list.js')(Janeway, Blast, Blast.Bound);
require('./class/log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/args_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/property_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/string_log_line.js')(Janeway, Blast, Blast.Bound);
require('./class/other_log_line.js')(Janeway, Blast, Blast.Bound);

module.exports = Janeway;