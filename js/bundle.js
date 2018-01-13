(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
  /* globals require, module */

  'use strict';

  /**
   * Module dependencies.
   */

  var pathtoRegexp = require('path-to-regexp');

  /**
   * Module exports.
   */

  module.exports = page;

  /**
   * Detect click event
   */
  var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */

  var location = ('undefined' !== typeof window) && (window.history.location || window.location);

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;


  /**
   * Decode URL components (query string, pathname, hash).
   * Accommodates both regular percent encoding and x-www-form-urlencoded format.
   */
  var decodeURLComponents = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
   * HashBang option
   */

  var hashbang = false;

  /**
   * Previous context, for capturing
   * page exit events.
   */

  var prevContext;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or redirection,
   * or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page('/from', '/to')
   *   page();
   *
   * @param {string|!Function|!Object} path
   * @param {Function=} fn
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' === typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' === typeof fn) {
      var route = new Route(/** @type {string} */ (path));
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
      // show <path> with [state]
    } else if ('string' === typeof path) {
      page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
      // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];
  page.exits = [];

  /**
   * Current path being processed
   * @type {string}
   */
  page.current = '';

  /**
   * Number of pages navigated to.
   * @type {number}
   *
   *     page.len == 0;
   *     page('/login');
   *     page.len == 1;
   */

  page.len = 0;

  /**
   * Get or set basepath to `path`.
   *
   * @param {string} path
   * @api public
   */

  page.base = function(path) {
    if (0 === arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options) {
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false === options.decodeURLComponents) decodeURLComponents = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) {
      document.addEventListener(clickEvent, onclick, false);
    }
    if (true === options.hashbang) hashbang = true;
    if (!dispatch) return;
    var url = (hashbang && ~location.hash.indexOf('#!')) ? location.hash.substr(2) + location.search : location.pathname + location.search + location.hash;
    page.replace(url, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function() {
    if (!running) return;
    page.current = '';
    page.len = 0;
    running = false;
    document.removeEventListener(clickEvent, onclick, false);
    window.removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {string} path
   * @param {Object=} state
   * @param {boolean=} dispatch
   * @param {boolean=} push
   * @return {!Context}
   * @api public
   */

  page.show = function(path, state, dispatch, push) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    if (false !== dispatch) page.dispatch(ctx);
    if (false !== ctx.handled && false !== push) ctx.pushState();
    return ctx;
  };

  /**
   * Goes back in the history
   * Back should always let the current route push state and then go back.
   *
   * @param {string} path - fallback path to go back if no more history exists, if undefined defaults to page.base
   * @param {Object=} state
   * @api public
   */

  page.back = function(path, state) {
    if (page.len > 0) {
      // this may need more testing to see if all browsers
      // wait for the next tick to go back in history
      history.back();
      page.len--;
    } else if (path) {
      setTimeout(function() {
        page.show(path, state);
      });
    }else{
      setTimeout(function() {
        page.show(base, state);
      });
    }
  };


  /**
   * Register route to redirect from one path to other
   * or just redirect to another route
   *
   * @param {string} from - if param 'to' is undefined redirects to 'from'
   * @param {string=} to
   * @api public
   */
  page.redirect = function(from, to) {
    // Define route from a path to another
    if ('string' === typeof from && 'string' === typeof to) {
      page(from, function(e) {
        setTimeout(function() {
          page.replace(/** @type {!string} */ (to));
        }, 0);
      });
    }

    // Wait for the push state and replace it with another
    if ('string' === typeof from && 'undefined' === typeof to) {
      setTimeout(function() {
        page.replace(from);
      }, 0);
    }
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {string} path
   * @param {Object=} state
   * @param {boolean=} init
   * @param {boolean=} dispatch
   * @return {!Context}
   * @api public
   */


  page.replace = function(path, state, init, dispatch) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    ctx.init = init;
    ctx.save(); // save before dispatching, which may redirect
    if (false !== dispatch) page.dispatch(ctx);
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Context} ctx
   * @api private
   */
  page.dispatch = function(ctx) {
    var prev = prevContext,
      i = 0,
      j = 0;

    prevContext = ctx;

    function nextExit() {
      var fn = page.exits[j++];
      if (!fn) return nextEnter();
      fn(prev, nextExit);
    }

    function nextEnter() {
      var fn = page.callbacks[i++];

      if (ctx.path !== page.current) {
        ctx.handled = false;
        return;
      }
      if (!fn) return unhandled(ctx);
      fn(ctx, nextEnter);
    }

    if (prev) {
      nextExit();
    } else {
      nextEnter();
    }
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */
  function unhandled(ctx) {
    if (ctx.handled) return;
    var current;

    if (hashbang) {
      current = base + location.hash.replace('#!', '');
    } else {
      current = location.pathname + location.search;
    }

    if (current === ctx.canonicalPath) return;
    page.stop();
    ctx.handled = false;
    location.href = ctx.canonicalPath;
  }

  /**
   * Register an exit route on `path` with
   * callback `fn()`, which will be called
   * on the previous context when a new
   * page is visited.
   */
  page.exit = function(path, fn) {
    if (typeof path === 'function') {
      return page.exit('*', path);
    }

    var route = new Route(path);
    for (var i = 1; i < arguments.length; ++i) {
      page.exits.push(route.middleware(arguments[i]));
    }
  };

  /**
   * Remove URL encoding from the given `str`.
   * Accommodates whitespace in both x-www-form-urlencoded
   * and regular percent-encoded form.
   *
   * @param {string} val - URL component to decode
   */
  function decodeURLEncodedURIComponent(val) {
    if (typeof val !== 'string') { return val; }
    return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @constructor
   * @param {string} path
   * @param {Object=} state
   * @api public
   */

  function Context(path, state) {
    if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + (hashbang ? '#!' : '') + path;
    var i = path.indexOf('?');

    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';
    if (hashbang) this.path = this.path.replace('#!', '') || '/';

    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
    this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
    this.params = {};

    // fragment
    this.hash = '';
    if (!hashbang) {
      if (!~this.path.indexOf('#')) return;
      var parts = this.path.split('#');
      this.path = parts[0];
      this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
      this.querystring = this.querystring.split('#')[0];
    }
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function() {
    page.len++;
    history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function() {
    history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @constructor
   * @param {string} path
   * @param {Object=} options
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = (path === '*') ? '(.*)' : path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(this.path,
      this.keys = [],
      options);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn) {
    var self = this;
    return function(ctx, next) {
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    };
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {string} path
   * @param {Object} params
   * @return {boolean}
   * @api private
   */

  Route.prototype.match = function(path, params) {
    var keys = this.keys,
      qsIndex = path.indexOf('?'),
      pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
      m = this.regexp.exec(decodeURIComponent(pathname));

    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];
      var val = decodeURLEncodedURIComponent(m[i]);
      if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
        params[key.name] = val;
      }
    }

    return true;
  };


  /**
   * Handle "populate" events.
   */

  var onpopstate = (function () {
    var loaded = false;
    if ('undefined' === typeof window) {
      return;
    }
    if (document.readyState === 'complete') {
      loaded = true;
    } else {
      window.addEventListener('load', function() {
        setTimeout(function() {
          loaded = true;
        }, 0);
      });
    }
    return function onpopstate(e) {
      if (!loaded) return;
      if (e.state) {
        var path = e.state.path;
        page.replace(path, e.state);
      } else {
        page.show(location.pathname + location.hash, undefined, undefined, false);
      }
    };
  })();
  /**
   * Handle "click" events.
   */

  function onclick(e) {

    if (1 !== which(e)) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;



    // ensure link
    // use shadow dom when available
    var el = e.path ? e.path[0] : e.target;
    while (el && 'A' !== el.nodeName) el = el.parentNode;
    if (!el || 'A' !== el.nodeName) return;



    // Ignore if tag has
    // 1. "download" attribute
    // 2. rel="external" attribute
    if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    if (!hashbang && el.pathname === location.pathname && (el.hash || '#' === link)) return;



    // Check for mailto: in the href
    if (link && link.indexOf('mailto:') > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;



    // rebuild path
    var path = el.pathname + el.search + (el.hash || '');

    // strip leading "/[drive letter]:" on NW.js on Windows
    if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
      path = path.replace(/^\/[a-zA-Z]:\//, '/');
    }

    // same page
    var orig = path;

    if (path.indexOf(base) === 0) {
      path = path.substr(base.length);
    }

    if (hashbang) path = path.replace('#!', '');

    if (base && orig === path) return;

    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null === e.which ? e.button : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  page.sameOrigin = sameOrigin;

}).call(this,require('_process'))

},{"_process":4,"path-to-regexp":2}],2:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":3}],3:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
'use strict';

var _routes = require('./routes');

var _routes2 = _interopRequireDefault(_routes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var App = function App() {
    _classCallCheck(this, App);

    this.router = new _routes2.default();
};

;
new App();

},{"./routes":12}],6:[function(require,module,exports){
'use strict';

/*
 * blueimp Gallery Fullscreen JS
 * https://github.com/blueimp/Gallery
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 */

/* global define, window, document */

;(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		// Register as an anonymous AMD module:
		define(['./blueimp-helper', './blueimp-gallery'], factory);
	} else {
		// Browser globals:
		factory(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
	}
})(function ($, Gallery) {
	'use strict';

	$.extend(Gallery.prototype.options, {
		// Defines if the gallery should open in fullscreen mode:
		fullScreen: false
	});

	var _initialize = Gallery.prototype.initialize;
	var _close = Gallery.prototype.close;

	$.extend(Gallery.prototype, {
		getFullScreenElement: function getFullScreenElement() {
			return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
		},

		requestFullScreen: function requestFullScreen(element) {
			if (element.requestFullscreen) {
				element.requestFullscreen();
			} else if (element.webkitRequestFullscreen) {
				element.webkitRequestFullscreen();
			} else if (element.mozRequestFullScreen) {
				element.mozRequestFullScreen();
			} else if (element.msRequestFullscreen) {
				element.msRequestFullscreen();
			}
		},

		exitFullScreen: function exitFullScreen() {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitCancelFullScreen) {
				document.webkitCancelFullScreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			}
		},

		initialize: function initialize() {
			_initialize.call(this);
			if (this.options.fullScreen && !this.getFullScreenElement()) {
				this.requestFullScreen(this.container[0]);
			}
		},

		close: function close() {
			if (this.getFullScreenElement() === this.container[0]) {
				this.exitFullScreen();
			}
			_close.call(this);
		}
	});

	return Gallery;
});

},{}],7:[function(require,module,exports){
"use strict";

!function () {
  "use strict";
  function t(t, e) {
    var i;for (i in e) {
      e.hasOwnProperty(i) && (t[i] = e[i]);
    }return t;
  }function e(t) {
    if (!this || this.find !== e.prototype.find) return new e(t);if (this.length = 0, t) if ("string" == typeof t && (t = this.find(t)), t.nodeType || t === t.window) this.length = 1, this[0] = t;else {
      var i = t.length;for (this.length = i; i;) {
        this[i -= 1] = t[i];
      }
    }
  }e.extend = t, e.contains = function (t, e) {
    do {
      if ((e = e.parentNode) === t) return !0;
    } while (e);return !1;
  }, e.parseJSON = function (t) {
    return window.JSON && JSON.parse(t);
  }, t(e.prototype, { find: function find(t) {
      var i = this[0] || document;return "string" == typeof t && (t = i.querySelectorAll ? i.querySelectorAll(t) : "#" === t.charAt(0) ? i.getElementById(t.slice(1)) : i.getElementsByTagName(t)), new e(t);
    }, hasClass: function hasClass(t) {
      return !!this[0] && new RegExp("(^|\\s+)" + t + "(\\s+|$)").test(this[0].className);
    }, addClass: function addClass(t) {
      for (var e, i = this.length; i;) {
        if (i -= 1, !(e = this[i]).className) return e.className = t, this;if (this.hasClass(t)) return this;e.className += " " + t;
      }return this;
    }, removeClass: function removeClass(t) {
      for (var e, i = new RegExp("(^|\\s+)" + t + "(\\s+|$)"), s = this.length; s;) {
        (e = this[s -= 1]).className = e.className.replace(i, " ");
      }return this;
    }, on: function on(t, e) {
      for (var i, s, n = t.split(/\s+/); n.length;) {
        for (t = n.shift(), i = this.length; i;) {
          (s = this[i -= 1]).addEventListener ? s.addEventListener(t, e, !1) : s.attachEvent && s.attachEvent("on" + t, e);
        }
      }return this;
    }, off: function off(t, e) {
      for (var i, s, n = t.split(/\s+/); n.length;) {
        for (t = n.shift(), i = this.length; i;) {
          (s = this[i -= 1]).removeEventListener ? s.removeEventListener(t, e, !1) : s.detachEvent && s.detachEvent("on" + t, e);
        }
      }return this;
    }, empty: function empty() {
      for (var t, e = this.length; e;) {
        for (t = this[e -= 1]; t.hasChildNodes();) {
          t.removeChild(t.lastChild);
        }
      }return this;
    }, first: function first() {
      return new e(this[0]);
    } }), "function" == typeof define && define.amd ? define(function () {
    return e;
  }) : (window.blueimp = window.blueimp || {}, window.blueimp.helper = e);
}(), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper"], t) : (window.blueimp = window.blueimp || {}, window.blueimp.Gallery = t(window.blueimp.helper || window.jQuery));
}(function (t) {
  "use strict";
  function e(t, i) {
    return void 0 === document.body.style.maxHeight ? null : this && this.options === e.prototype.options ? void (t && t.length ? (this.list = t, this.num = t.length, this.initOptions(i), this.initialize()) : this.console.log("blueimp Gallery: No or empty list provided as first argument.", t)) : new e(t, i);
  }return t.extend(e.prototype, { options: { container: "#blueimp-gallery", slidesContainer: "div", titleElement: "h3", displayClass: "blueimp-gallery-display", controlsClass: "blueimp-gallery-controls", singleClass: "blueimp-gallery-single", leftEdgeClass: "blueimp-gallery-left", rightEdgeClass: "blueimp-gallery-right", playingClass: "blueimp-gallery-playing", slideClass: "slide", slideLoadingClass: "slide-loading", slideErrorClass: "slide-error", slideContentClass: "slide-content", toggleClass: "toggle", prevClass: "prev", nextClass: "next", closeClass: "close", playPauseClass: "play-pause", typeProperty: "type", titleProperty: "title", urlProperty: "href", srcsetProperty: "urlset", displayTransition: !0, clearSlides: !0, stretchImages: !1, toggleControlsOnReturn: !0, toggleControlsOnSlideClick: !0, toggleSlideshowOnSpace: !0, enableKeyboardNavigation: !0, closeOnEscape: !0, closeOnSlideClick: !0, closeOnSwipeUpOrDown: !0, emulateTouchEvents: !0, stopTouchEventsPropagation: !1, hidePageScrollbars: !0, disableScroll: !0, carousel: !1, continuous: !0, unloadElements: !0, startSlideshow: !1, slideshowInterval: 5e3, index: 0, preloadRange: 2, transitionSpeed: 400, slideshowTransitionSpeed: void 0, event: void 0, onopen: void 0, onopened: void 0, onslide: void 0, onslideend: void 0, onslidecomplete: void 0, onclose: void 0, onclosed: void 0 }, carouselOptions: { hidePageScrollbars: !1, toggleControlsOnReturn: !1, toggleSlideshowOnSpace: !1, enableKeyboardNavigation: !1, closeOnEscape: !1, closeOnSlideClick: !1, closeOnSwipeUpOrDown: !1, disableScroll: !1, startSlideshow: !0 }, console: window.console && "function" == typeof window.console.log ? window.console : { log: function log() {} }, support: function (e) {
      function i() {
        var t,
            i,
            s = n.transition;document.body.appendChild(e), s && (t = s.name.slice(0, -9) + "ransform", void 0 !== e.style[t] && (e.style[t] = "translateZ(0)", i = window.getComputedStyle(e).getPropertyValue(s.prefix + "transform"), n.transform = { prefix: s.prefix, name: t, translate: !0, translateZ: !!i && "none" !== i })), void 0 !== e.style.backgroundSize && (n.backgroundSize = {}, e.style.backgroundSize = "contain", n.backgroundSize.contain = "contain" === window.getComputedStyle(e).getPropertyValue("background-size"), e.style.backgroundSize = "cover", n.backgroundSize.cover = "cover" === window.getComputedStyle(e).getPropertyValue("background-size")), document.body.removeChild(e);
      }var s,
          n = { touch: void 0 !== window.ontouchstart || window.DocumentTouch && document instanceof DocumentTouch },
          o = { webkitTransition: { end: "webkitTransitionEnd", prefix: "-webkit-" }, MozTransition: { end: "transitionend", prefix: "-moz-" }, OTransition: { end: "otransitionend", prefix: "-o-" }, transition: { end: "transitionend", prefix: "" } };for (s in o) {
        if (o.hasOwnProperty(s) && void 0 !== e.style[s]) {
          n.transition = o[s], n.transition.name = s;break;
        }
      }return document.body ? i() : t(document).on("DOMContentLoaded", i), n;
    }(document.createElement("div")), requestAnimationFrame: window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame, initialize: function initialize() {
      if (this.initStartIndex(), !1 === this.initWidget()) return !1;this.initEventListeners(), this.onslide(this.index), this.ontransitionend(), this.options.startSlideshow && this.play();
    }, slide: function slide(t, e) {
      window.clearTimeout(this.timeout);var i,
          s,
          n,
          o = this.index;if (o !== t && 1 !== this.num) {
        if (e || (e = this.options.transitionSpeed), this.support.transform) {
          for (this.options.continuous || (t = this.circle(t)), i = Math.abs(o - t) / (o - t), this.options.continuous && (s = i, (i = -this.positions[this.circle(t)] / this.slideWidth) !== s && (t = -i * this.num + t)), n = Math.abs(o - t) - 1; n;) {
            n -= 1, this.move(this.circle((t > o ? t : o) - n - 1), this.slideWidth * i, 0);
          }t = this.circle(t), this.move(o, this.slideWidth * i, e), this.move(t, 0, e), this.options.continuous && this.move(this.circle(t - i), -this.slideWidth * i, 0);
        } else t = this.circle(t), this.animate(o * -this.slideWidth, t * -this.slideWidth, e);this.onslide(t);
      }
    }, getIndex: function getIndex() {
      return this.index;
    }, getNumber: function getNumber() {
      return this.num;
    }, prev: function prev() {
      (this.options.continuous || this.index) && this.slide(this.index - 1);
    }, next: function next() {
      (this.options.continuous || this.index < this.num - 1) && this.slide(this.index + 1);
    }, play: function play(t) {
      var e = this;window.clearTimeout(this.timeout), this.interval = t || this.options.slideshowInterval, this.elements[this.index] > 1 && (this.timeout = this.setTimeout(!this.requestAnimationFrame && this.slide || function (t, i) {
        e.animationFrameId = e.requestAnimationFrame.call(window, function () {
          e.slide(t, i);
        });
      }, [this.index + 1, this.options.slideshowTransitionSpeed], this.interval)), this.container.addClass(this.options.playingClass);
    }, pause: function pause() {
      window.clearTimeout(this.timeout), this.interval = null, this.container.removeClass(this.options.playingClass);
    }, add: function add(t) {
      var e;for (t.concat || (t = Array.prototype.slice.call(t)), this.list.concat || (this.list = Array.prototype.slice.call(this.list)), this.list = this.list.concat(t), this.num = this.list.length, this.num > 2 && null === this.options.continuous && (this.options.continuous = !0, this.container.removeClass(this.options.leftEdgeClass)), this.container.removeClass(this.options.rightEdgeClass).removeClass(this.options.singleClass), e = this.num - t.length; e < this.num; e += 1) {
        this.addSlide(e), this.positionSlide(e);
      }this.positions.length = this.num, this.initSlides(!0);
    }, resetSlides: function resetSlides() {
      this.slidesContainer.empty(), this.unloadAllSlides(), this.slides = [];
    }, handleClose: function handleClose() {
      var t = this.options;this.destroyEventListeners(), this.pause(), this.container[0].style.display = "none", this.container.removeClass(t.displayClass).removeClass(t.singleClass).removeClass(t.leftEdgeClass).removeClass(t.rightEdgeClass), t.hidePageScrollbars && (document.body.style.overflow = this.bodyOverflowStyle), this.options.clearSlides && this.resetSlides(), this.options.onclosed && this.options.onclosed.call(this);
    }, close: function close() {
      function t(i) {
        i.target === e.container[0] && (e.container.off(e.support.transition.end, t), e.handleClose());
      }var e = this;this.options.onclose && this.options.onclose.call(this), this.support.transition && this.options.displayTransition ? (this.container.on(this.support.transition.end, t), this.container.removeClass(this.options.displayClass)) : this.handleClose();
    }, circle: function circle(t) {
      return (this.num + t % this.num) % this.num;
    }, move: function move(t, e, i) {
      this.translateX(t, e, i), this.positions[t] = e;
    }, translate: function translate(t, e, i, s) {
      var n = this.slides[t].style,
          o = this.support.transition,
          r = this.support.transform;n[o.name + "Duration"] = s + "ms", n[r.name] = "translate(" + e + "px, " + i + "px)" + (r.translateZ ? " translateZ(0)" : "");
    }, translateX: function translateX(t, e, i) {
      this.translate(t, e, 0, i);
    }, translateY: function translateY(t, e, i) {
      this.translate(t, 0, e, i);
    }, animate: function animate(t, e, i) {
      if (i) var s = this,
          n = new Date().getTime(),
          o = window.setInterval(function () {
        var r = new Date().getTime() - n;if (r > i) return s.slidesContainer[0].style.left = e + "px", s.ontransitionend(), void window.clearInterval(o);s.slidesContainer[0].style.left = (e - t) * (Math.floor(r / i * 100) / 100) + t + "px";
      }, 4);else this.slidesContainer[0].style.left = e + "px";
    }, preventDefault: function preventDefault(t) {
      t.preventDefault ? t.preventDefault() : t.returnValue = !1;
    }, stopPropagation: function stopPropagation(t) {
      t.stopPropagation ? t.stopPropagation() : t.cancelBubble = !0;
    }, onresize: function onresize() {
      this.initSlides(!0);
    }, onmousedown: function onmousedown(t) {
      t.which && 1 === t.which && "VIDEO" !== t.target.nodeName && (t.preventDefault(), (t.originalEvent || t).touches = [{ pageX: t.pageX, pageY: t.pageY }], this.ontouchstart(t));
    }, onmousemove: function onmousemove(t) {
      this.touchStart && ((t.originalEvent || t).touches = [{ pageX: t.pageX, pageY: t.pageY }], this.ontouchmove(t));
    }, onmouseup: function onmouseup(t) {
      this.touchStart && (this.ontouchend(t), delete this.touchStart);
    }, onmouseout: function onmouseout(e) {
      if (this.touchStart) {
        var i = e.target,
            s = e.relatedTarget;s && (s === i || t.contains(i, s)) || this.onmouseup(e);
      }
    }, ontouchstart: function ontouchstart(t) {
      this.options.stopTouchEventsPropagation && this.stopPropagation(t);var e = (t.originalEvent || t).touches[0];this.touchStart = { x: e.pageX, y: e.pageY, time: Date.now() }, this.isScrolling = void 0, this.touchDelta = {};
    }, ontouchmove: function ontouchmove(t) {
      this.options.stopTouchEventsPropagation && this.stopPropagation(t);var e,
          i,
          s = (t.originalEvent || t).touches[0],
          n = (t.originalEvent || t).scale,
          o = this.index;if (!(s.length > 1 || n && 1 !== n)) if (this.options.disableScroll && t.preventDefault(), this.touchDelta = { x: s.pageX - this.touchStart.x, y: s.pageY - this.touchStart.y }, e = this.touchDelta.x, void 0 === this.isScrolling && (this.isScrolling = this.isScrolling || Math.abs(e) < Math.abs(this.touchDelta.y)), this.isScrolling) this.translateY(o, this.touchDelta.y + this.positions[o], 0);else for (t.preventDefault(), window.clearTimeout(this.timeout), this.options.continuous ? i = [this.circle(o + 1), o, this.circle(o - 1)] : (this.touchDelta.x = e /= !o && e > 0 || o === this.num - 1 && e < 0 ? Math.abs(e) / this.slideWidth + 1 : 1, i = [o], o && i.push(o - 1), o < this.num - 1 && i.unshift(o + 1)); i.length;) {
        o = i.pop(), this.translateX(o, e + this.positions[o], 0);
      }
    }, ontouchend: function ontouchend(t) {
      this.options.stopTouchEventsPropagation && this.stopPropagation(t);var e,
          i,
          s,
          n,
          o,
          r = this.index,
          a = this.options.transitionSpeed,
          l = this.slideWidth,
          h = Number(Date.now() - this.touchStart.time) < 250,
          d = h && Math.abs(this.touchDelta.x) > 20 || Math.abs(this.touchDelta.x) > l / 2,
          c = !r && this.touchDelta.x > 0 || r === this.num - 1 && this.touchDelta.x < 0,
          u = !d && this.options.closeOnSwipeUpOrDown && (h && Math.abs(this.touchDelta.y) > 20 || Math.abs(this.touchDelta.y) > this.slideHeight / 2);this.options.continuous && (c = !1), e = this.touchDelta.x < 0 ? -1 : 1, this.isScrolling ? u ? this.close() : this.translateY(r, 0, a) : d && !c ? (i = r + e, s = r - e, n = l * e, o = -l * e, this.options.continuous ? (this.move(this.circle(i), n, 0), this.move(this.circle(r - 2 * e), o, 0)) : i >= 0 && i < this.num && this.move(i, n, 0), this.move(r, this.positions[r] + n, a), this.move(this.circle(s), this.positions[this.circle(s)] + n, a), r = this.circle(s), this.onslide(r)) : this.options.continuous ? (this.move(this.circle(r - 1), -l, a), this.move(r, 0, a), this.move(this.circle(r + 1), l, a)) : (r && this.move(r - 1, -l, a), this.move(r, 0, a), r < this.num - 1 && this.move(r + 1, l, a));
    }, ontouchcancel: function ontouchcancel(t) {
      this.touchStart && (this.ontouchend(t), delete this.touchStart);
    }, ontransitionend: function ontransitionend(t) {
      var e = this.slides[this.index];t && e !== t.target || (this.interval && this.play(), this.setTimeout(this.options.onslideend, [this.index, e]));
    }, oncomplete: function oncomplete(e) {
      var i,
          s = e.target || e.srcElement,
          n = s && s.parentNode;s && n && (i = this.getNodeIndex(n), t(n).removeClass(this.options.slideLoadingClass), "error" === e.type ? (t(n).addClass(this.options.slideErrorClass), this.elements[i] = 3) : this.elements[i] = 2, s.clientHeight > this.container[0].clientHeight && (s.style.maxHeight = this.container[0].clientHeight), this.interval && this.slides[this.index] === n && this.play(), this.setTimeout(this.options.onslidecomplete, [i, n]));
    }, onload: function onload(t) {
      this.oncomplete(t);
    }, onerror: function onerror(t) {
      this.oncomplete(t);
    }, onkeydown: function onkeydown(t) {
      switch (t.which || t.keyCode) {case 13:
          this.options.toggleControlsOnReturn && (this.preventDefault(t), this.toggleControls());break;case 27:
          this.options.closeOnEscape && (this.close(), t.stopImmediatePropagation());break;case 32:
          this.options.toggleSlideshowOnSpace && (this.preventDefault(t), this.toggleSlideshow());break;case 37:
          this.options.enableKeyboardNavigation && (this.preventDefault(t), this.prev());break;case 39:
          this.options.enableKeyboardNavigation && (this.preventDefault(t), this.next());}
    }, handleClick: function handleClick(e) {
      function i(e) {
        return t(n).hasClass(e) || t(o).hasClass(e);
      }var s = this.options,
          n = e.target || e.srcElement,
          o = n.parentNode;i(s.toggleClass) ? (this.preventDefault(e), this.toggleControls()) : i(s.prevClass) ? (this.preventDefault(e), this.prev()) : i(s.nextClass) ? (this.preventDefault(e), this.next()) : i(s.closeClass) ? (this.preventDefault(e), this.close()) : i(s.playPauseClass) ? (this.preventDefault(e), this.toggleSlideshow()) : o === this.slidesContainer[0] ? s.closeOnSlideClick ? (this.preventDefault(e), this.close()) : s.toggleControlsOnSlideClick && (this.preventDefault(e), this.toggleControls()) : o.parentNode && o.parentNode === this.slidesContainer[0] && s.toggleControlsOnSlideClick && (this.preventDefault(e), this.toggleControls());
    }, onclick: function onclick(t) {
      if (!(this.options.emulateTouchEvents && this.touchDelta && (Math.abs(this.touchDelta.x) > 20 || Math.abs(this.touchDelta.y) > 20))) return this.handleClick(t);delete this.touchDelta;
    }, updateEdgeClasses: function updateEdgeClasses(t) {
      t ? this.container.removeClass(this.options.leftEdgeClass) : this.container.addClass(this.options.leftEdgeClass), t === this.num - 1 ? this.container.addClass(this.options.rightEdgeClass) : this.container.removeClass(this.options.rightEdgeClass);
    }, handleSlide: function handleSlide(t) {
      this.options.continuous || this.updateEdgeClasses(t), this.loadElements(t), this.options.unloadElements && this.unloadElements(t), this.setTitle(t);
    }, onslide: function onslide(t) {
      this.index = t, this.handleSlide(t), this.setTimeout(this.options.onslide, [t, this.slides[t]]);
    }, setTitle: function setTitle(t) {
      var e = this.slides[t].firstChild.title,
          i = this.titleElement;i.length && (this.titleElement.empty(), e && i[0].appendChild(document.createTextNode(e)));
    }, setTimeout: function setTimeout(t, e, i) {
      var s = this;return t && window.setTimeout(function () {
        t.apply(s, e || []);
      }, i || 0);
    }, imageFactory: function imageFactory(e, i) {
      function s(e) {
        if (!n) {
          if (e = { type: e.type, target: o }, !o.parentNode) return a.setTimeout(s, [e]);n = !0, t(l).off("load error", s), d && "load" === e.type && (o.style.background = 'url("' + h + '") center no-repeat', o.style.backgroundSize = d), i(e);
        }
      }var n,
          o,
          r,
          a = this,
          l = this.imagePrototype.cloneNode(!1),
          h = e,
          d = this.options.stretchImages;return "string" != typeof h && (h = this.getItemProperty(e, this.options.urlProperty), r = this.getItemProperty(e, this.options.titleProperty)), !0 === d && (d = "contain"), (d = this.support.backgroundSize && this.support.backgroundSize[d] && d) ? o = this.elementPrototype.cloneNode(!1) : (o = l, l.draggable = !1), r && (o.title = r), t(l).on("load error", s), l.src = h, o;
    }, createElement: function createElement(e, i) {
      var s = e && this.getItemProperty(e, this.options.typeProperty),
          n = s && this[s.split("/")[0] + "Factory"] || this.imageFactory,
          o = e && n.call(this, e, i),
          r = this.getItemProperty(e, this.options.srcsetProperty);return o || (o = this.elementPrototype.cloneNode(!1), this.setTimeout(i, [{ type: "error", target: o }])), r && o.setAttribute("srcset", r), t(o).addClass(this.options.slideContentClass), o;
    }, loadElement: function loadElement(e) {
      this.elements[e] || (this.slides[e].firstChild ? this.elements[e] = t(this.slides[e]).hasClass(this.options.slideErrorClass) ? 3 : 2 : (this.elements[e] = 1, t(this.slides[e]).addClass(this.options.slideLoadingClass), this.slides[e].appendChild(this.createElement(this.list[e], this.proxyListener))));
    }, loadElements: function loadElements(t) {
      var e,
          i = Math.min(this.num, 2 * this.options.preloadRange + 1),
          s = t;for (e = 0; e < i; e += 1) {
        s += e * (e % 2 == 0 ? -1 : 1), s = this.circle(s), this.loadElement(s);
      }
    }, unloadElements: function unloadElements(t) {
      var e, i;for (e in this.elements) {
        this.elements.hasOwnProperty(e) && (i = Math.abs(t - e)) > this.options.preloadRange && i + this.options.preloadRange < this.num && (this.unloadSlide(e), delete this.elements[e]);
      }
    }, addSlide: function addSlide(t) {
      var e = this.slidePrototype.cloneNode(!1);e.setAttribute("data-index", t), this.slidesContainer[0].appendChild(e), this.slides.push(e);
    }, positionSlide: function positionSlide(t) {
      var e = this.slides[t];e.style.width = this.slideWidth + "px", this.support.transform && (e.style.left = t * -this.slideWidth + "px", this.move(t, this.index > t ? -this.slideWidth : this.index < t ? this.slideWidth : 0, 0));
    }, initSlides: function initSlides(e) {
      var i, s;for (e || (this.positions = [], this.positions.length = this.num, this.elements = {}, this.imagePrototype = document.createElement("img"), this.elementPrototype = document.createElement("div"), this.slidePrototype = document.createElement("div"), t(this.slidePrototype).addClass(this.options.slideClass), this.slides = this.slidesContainer[0].children, i = this.options.clearSlides || this.slides.length !== this.num), this.slideWidth = this.container[0].offsetWidth, this.slideHeight = this.container[0].offsetHeight, this.slidesContainer[0].style.width = this.num * this.slideWidth + "px", i && this.resetSlides(), s = 0; s < this.num; s += 1) {
        i && this.addSlide(s), this.positionSlide(s);
      }this.options.continuous && this.support.transform && (this.move(this.circle(this.index - 1), -this.slideWidth, 0), this.move(this.circle(this.index + 1), this.slideWidth, 0)), this.support.transform || (this.slidesContainer[0].style.left = this.index * -this.slideWidth + "px");
    }, unloadSlide: function unloadSlide(t) {
      var e, i;null !== (i = (e = this.slides[t]).firstChild) && e.removeChild(i);
    }, unloadAllSlides: function unloadAllSlides() {
      var t, e;for (t = 0, e = this.slides.length; t < e; t++) {
        this.unloadSlide(t);
      }
    }, toggleControls: function toggleControls() {
      var t = this.options.controlsClass;this.container.hasClass(t) ? this.container.removeClass(t) : this.container.addClass(t);
    }, toggleSlideshow: function toggleSlideshow() {
      this.interval ? this.pause() : this.play();
    }, getNodeIndex: function getNodeIndex(t) {
      return parseInt(t.getAttribute("data-index"), 10);
    }, getNestedProperty: function getNestedProperty(t, e) {
      return e.replace(/\[(?:'([^']+)'|"([^"]+)"|(\d+))\]|(?:(?:^|\.)([^\.\[]+))/g, function (e, i, s, n, o) {
        var r = o || i || s || n && parseInt(n, 10);e && t && (t = t[r]);
      }), t;
    }, getDataProperty: function getDataProperty(e, i) {
      var s, n;if (e.dataset ? (s = i.replace(/-([a-z])/g, function (t, e) {
        return e.toUpperCase();
      }), n = e.dataset[s]) : e.getAttribute && (n = e.getAttribute("data-" + i.replace(/([A-Z])/g, "-$1").toLowerCase())), "string" == typeof n) {
        if (/^(true|false|null|-?\d+(\.\d+)?|\{[\s\S]*\}|\[[\s\S]*\])$/.test(n)) try {
          return t.parseJSON(n);
        } catch (t) {}return n;
      }
    }, getItemProperty: function getItemProperty(t, e) {
      var i = this.getDataProperty(t, e);return void 0 === i && (i = t[e]), void 0 === i && (i = this.getNestedProperty(t, e)), i;
    }, initStartIndex: function initStartIndex() {
      var t,
          e = this.options.index,
          i = this.options.urlProperty;if (e && "number" != typeof e) for (t = 0; t < this.num; t += 1) {
        if (this.list[t] === e || this.getItemProperty(this.list[t], i) === this.getItemProperty(e, i)) {
          e = t;break;
        }
      }this.index = this.circle(parseInt(e, 10) || 0);
    }, initEventListeners: function initEventListeners() {
      function e(t) {
        var e = i.support.transition && i.support.transition.end === t.type ? "transitionend" : t.type;i["on" + e](t);
      }var i = this,
          s = this.slidesContainer;t(window).on("resize", e), t(document.body).on("keydown", e), this.container.on("click", e), this.support.touch ? s.on("touchstart touchmove touchend touchcancel", e) : this.options.emulateTouchEvents && this.support.transition && s.on("mousedown mousemove mouseup mouseout", e), this.support.transition && s.on(this.support.transition.end, e), this.proxyListener = e;
    }, destroyEventListeners: function destroyEventListeners() {
      var e = this.slidesContainer,
          i = this.proxyListener;t(window).off("resize", i), t(document.body).off("keydown", i), this.container.off("click", i), this.support.touch ? e.off("touchstart touchmove touchend touchcancel", i) : this.options.emulateTouchEvents && this.support.transition && e.off("mousedown mousemove mouseup mouseout", i), this.support.transition && e.off(this.support.transition.end, i);
    }, handleOpen: function handleOpen() {
      this.options.onopened && this.options.onopened.call(this);
    }, initWidget: function initWidget() {
      function e(t) {
        t.target === i.container[0] && (i.container.off(i.support.transition.end, e), i.handleOpen());
      }var i = this;return this.container = t(this.options.container), this.container.length ? (this.slidesContainer = this.container.find(this.options.slidesContainer).first(), this.slidesContainer.length ? (this.titleElement = this.container.find(this.options.titleElement).first(), 1 === this.num && this.container.addClass(this.options.singleClass), this.options.onopen && this.options.onopen.call(this), this.support.transition && this.options.displayTransition ? this.container.on(this.support.transition.end, e) : this.handleOpen(), this.options.hidePageScrollbars && (this.bodyOverflowStyle = document.body.style.overflow, document.body.style.overflow = "hidden"), this.container[0].style.display = "block", this.initSlides(), void this.container.addClass(this.options.displayClass)) : (this.console.log("blueimp Gallery: Slides container not found.", this.options.slidesContainer), !1)) : (this.console.log("blueimp Gallery: Widget container not found.", this.options.container), !1);
    }, initOptions: function initOptions(e) {
      this.options = t.extend({}, this.options), (e && e.carousel || this.options.carousel && (!e || !1 !== e.carousel)) && t.extend(this.options, this.carouselOptions), t.extend(this.options, e), this.num < 3 && (this.options.continuous = !!this.options.continuous && null), this.support.transition || (this.options.emulateTouchEvents = !1), this.options.event && this.preventDefault(this.options.event);
    } }), e;
}), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper", "./blueimp-gallery"], t) : t(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
}(function (t, e) {
  "use strict";
  t.extend(e.prototype.options, { fullScreen: !1 });var i = e.prototype.initialize,
      s = e.prototype.close;return t.extend(e.prototype, { getFullScreenElement: function getFullScreenElement() {
      return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }, requestFullScreen: function requestFullScreen(t) {
      t.requestFullscreen ? t.requestFullscreen() : t.webkitRequestFullscreen ? t.webkitRequestFullscreen() : t.mozRequestFullScreen ? t.mozRequestFullScreen() : t.msRequestFullscreen && t.msRequestFullscreen();
    }, exitFullScreen: function exitFullScreen() {
      document.exitFullscreen ? document.exitFullscreen() : document.webkitCancelFullScreen ? document.webkitCancelFullScreen() : document.mozCancelFullScreen ? document.mozCancelFullScreen() : document.msExitFullscreen && document.msExitFullscreen();
    }, initialize: function initialize() {
      i.call(this), this.options.fullScreen && !this.getFullScreenElement() && this.requestFullScreen(this.container[0]);
    }, close: function close() {
      this.getFullScreenElement() === this.container[0] && this.exitFullScreen(), s.call(this);
    } }), e;
}), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper", "./blueimp-gallery"], t) : t(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
}(function (t, e) {
  "use strict";
  t.extend(e.prototype.options, { indicatorContainer: "ol", activeIndicatorClass: "active", thumbnailProperty: "thumbnail", thumbnailIndicators: !0 });var i = e.prototype.initSlides,
      s = e.prototype.addSlide,
      n = e.prototype.resetSlides,
      o = e.prototype.handleClick,
      r = e.prototype.handleSlide,
      a = e.prototype.handleClose;return t.extend(e.prototype, { createIndicator: function createIndicator(e) {
      var i,
          s,
          n = this.indicatorPrototype.cloneNode(!1),
          o = this.getItemProperty(e, this.options.titleProperty),
          r = this.options.thumbnailProperty;return this.options.thumbnailIndicators && (r && (i = this.getItemProperty(e, r)), void 0 === i && (s = e.getElementsByTagName && t(e).find("img")[0]) && (i = s.src), i && (n.style.backgroundImage = 'url("' + i + '")')), o && (n.title = o), n;
    }, addIndicator: function addIndicator(t) {
      if (this.indicatorContainer.length) {
        var e = this.createIndicator(this.list[t]);e.setAttribute("data-index", t), this.indicatorContainer[0].appendChild(e), this.indicators.push(e);
      }
    }, setActiveIndicator: function setActiveIndicator(e) {
      this.indicators && (this.activeIndicator && this.activeIndicator.removeClass(this.options.activeIndicatorClass), this.activeIndicator = t(this.indicators[e]), this.activeIndicator.addClass(this.options.activeIndicatorClass));
    }, initSlides: function initSlides(t) {
      t || (this.indicatorContainer = this.container.find(this.options.indicatorContainer), this.indicatorContainer.length && (this.indicatorPrototype = document.createElement("li"), this.indicators = this.indicatorContainer[0].children)), i.call(this, t);
    }, addSlide: function addSlide(t) {
      s.call(this, t), this.addIndicator(t);
    }, resetSlides: function resetSlides() {
      n.call(this), this.indicatorContainer.empty(), this.indicators = [];
    }, handleClick: function handleClick(t) {
      var e = t.target || t.srcElement,
          i = e.parentNode;if (i === this.indicatorContainer[0]) this.preventDefault(t), this.slide(this.getNodeIndex(e));else {
        if (i.parentNode !== this.indicatorContainer[0]) return o.call(this, t);this.preventDefault(t), this.slide(this.getNodeIndex(i));
      }
    }, handleSlide: function handleSlide(t) {
      r.call(this, t), this.setActiveIndicator(t);
    }, handleClose: function handleClose() {
      this.activeIndicator && this.activeIndicator.removeClass(this.options.activeIndicatorClass), a.call(this);
    } }), e;
}), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper", "./blueimp-gallery"], t) : t(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
}(function (t, e) {
  "use strict";
  t.extend(e.prototype.options, { videoContentClass: "video-content", videoLoadingClass: "video-loading", videoPlayingClass: "video-playing", videoPosterProperty: "poster", videoSourcesProperty: "sources" });var i = e.prototype.handleSlide;return t.extend(e.prototype, { handleSlide: function handleSlide(t) {
      i.call(this, t), this.playingVideo && this.playingVideo.pause();
    }, videoFactory: function videoFactory(e, i, s) {
      var n,
          o,
          r,
          a,
          l,
          h = this,
          d = this.options,
          c = this.elementPrototype.cloneNode(!1),
          u = t(c),
          p = [{ type: "error", target: c }],
          m = s || document.createElement("video"),
          y = this.getItemProperty(e, d.urlProperty),
          f = this.getItemProperty(e, d.typeProperty),
          g = this.getItemProperty(e, d.titleProperty),
          v = this.getItemProperty(e, d.videoPosterProperty),
          C = this.getItemProperty(e, d.videoSourcesProperty);if (u.addClass(d.videoContentClass), g && (c.title = g), m.canPlayType) if (y && f && m.canPlayType(f)) m.src = y;else if (C) for (; C.length;) {
        if (o = C.shift(), y = this.getItemProperty(o, d.urlProperty), f = this.getItemProperty(o, d.typeProperty), y && f && m.canPlayType(f)) {
          m.src = y;break;
        }
      }return v && (m.poster = v, n = this.imagePrototype.cloneNode(!1), t(n).addClass(d.toggleClass), n.src = v, n.draggable = !1, c.appendChild(n)), (r = document.createElement("a")).setAttribute("target", "_blank"), s || r.setAttribute("download", g), r.href = y, m.src && (m.controls = !0, (s || t(m)).on("error", function () {
        h.setTimeout(i, p);
      }).on("pause", function () {
        m.seeking || (a = !1, u.removeClass(h.options.videoLoadingClass).removeClass(h.options.videoPlayingClass), l && h.container.addClass(h.options.controlsClass), delete h.playingVideo, h.interval && h.play());
      }).on("playing", function () {
        a = !1, u.removeClass(h.options.videoLoadingClass).addClass(h.options.videoPlayingClass), h.container.hasClass(h.options.controlsClass) ? (l = !0, h.container.removeClass(h.options.controlsClass)) : l = !1;
      }).on("play", function () {
        window.clearTimeout(h.timeout), a = !0, u.addClass(h.options.videoLoadingClass), h.playingVideo = m;
      }), t(r).on("click", function (t) {
        h.preventDefault(t), a ? m.pause() : m.play();
      }), c.appendChild(s && s.element || m)), c.appendChild(r), this.setTimeout(i, [{ type: "load", target: c }]), c;
    } }), e;
}), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper", "./blueimp-gallery-video"], t) : t(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
}(function (t, e) {
  "use strict";
  if (!window.postMessage) return e;t.extend(e.prototype.options, { vimeoVideoIdProperty: "vimeo", vimeoPlayerUrl: "//player.vimeo.com/video/VIDEO_ID?api=1&player_id=PLAYER_ID", vimeoPlayerIdPrefix: "vimeo-player-", vimeoClickToPlay: !0 });var i = e.prototype.textFactory || e.prototype.imageFactory,
      s = function s(t, e, i, _s) {
    this.url = t, this.videoId = e, this.playerId = i, this.clickToPlay = _s, this.element = document.createElement("div"), this.listeners = {};
  },
      n = 0;return t.extend(s.prototype, { canPlayType: function canPlayType() {
      return !0;
    }, on: function on(t, e) {
      return this.listeners[t] = e, this;
    }, loadAPI: function loadAPI() {
      function e() {
        !s && n.playOnReady && n.play(), s = !0;
      }for (var i, s, n = this, o = "//f.vimeocdn.com/js/froogaloop2.min.js", r = document.getElementsByTagName("script"), a = r.length; a;) {
        if (a -= 1, r[a].src === o) {
          i = r[a];break;
        }
      }i || ((i = document.createElement("script")).src = o), t(i).on("load", e), r[0].parentNode.insertBefore(i, r[0]), /loaded|complete/.test(i.readyState) && e();
    }, onReady: function onReady() {
      var t = this;this.ready = !0, this.player.addEvent("play", function () {
        t.hasPlayed = !0, t.onPlaying();
      }), this.player.addEvent("pause", function () {
        t.onPause();
      }), this.player.addEvent("finish", function () {
        t.onPause();
      }), this.playOnReady && this.play();
    }, onPlaying: function onPlaying() {
      this.playStatus < 2 && (this.listeners.playing(), this.playStatus = 2);
    }, onPause: function onPause() {
      this.listeners.pause(), delete this.playStatus;
    }, insertIframe: function insertIframe() {
      var t = document.createElement("iframe");t.src = this.url.replace("VIDEO_ID", this.videoId).replace("PLAYER_ID", this.playerId), t.id = this.playerId, this.element.parentNode.replaceChild(t, this.element), this.element = t;
    }, play: function play() {
      var t = this;this.playStatus || (this.listeners.play(), this.playStatus = 1), this.ready ? !this.hasPlayed && (this.clickToPlay || window.navigator && /iP(hone|od|ad)/.test(window.navigator.platform)) ? this.onPlaying() : this.player.api("play") : (this.playOnReady = !0, window.$f ? this.player || (this.insertIframe(), this.player = $f(this.element), this.player.addEvent("ready", function () {
        t.onReady();
      })) : this.loadAPI());
    }, pause: function pause() {
      this.ready ? this.player.api("pause") : this.playStatus && (delete this.playOnReady, this.listeners.pause(), delete this.playStatus);
    } }), t.extend(e.prototype, { VimeoPlayer: s, textFactory: function textFactory(t, e) {
      var o = this.options,
          r = this.getItemProperty(t, o.vimeoVideoIdProperty);return r ? (void 0 === this.getItemProperty(t, o.urlProperty) && (t[o.urlProperty] = "//vimeo.com/" + r), n += 1, this.videoFactory(t, e, new s(o.vimeoPlayerUrl, r, o.vimeoPlayerIdPrefix + n, o.vimeoClickToPlay))) : i.call(this, t, e);
    } }), e;
}), function (t) {
  "use strict";
  "function" == typeof define && define.amd ? define(["./blueimp-helper", "./blueimp-gallery-video"], t) : t(window.blueimp.helper || window.jQuery, window.blueimp.Gallery);
}(function (t, e) {
  "use strict";
  if (!window.postMessage) return e;t.extend(e.prototype.options, { youTubeVideoIdProperty: "youtube", youTubePlayerVars: { wmode: "transparent" }, youTubeClickToPlay: !0 });var i = e.prototype.textFactory || e.prototype.imageFactory,
      s = function s(t, e, i) {
    this.videoId = t, this.playerVars = e, this.clickToPlay = i, this.element = document.createElement("div"), this.listeners = {};
  };return t.extend(s.prototype, { canPlayType: function canPlayType() {
      return !0;
    }, on: function on(t, e) {
      return this.listeners[t] = e, this;
    }, loadAPI: function loadAPI() {
      var t,
          e = this,
          i = window.onYouTubeIframeAPIReady,
          s = "//www.youtube.com/iframe_api",
          n = document.getElementsByTagName("script"),
          o = n.length;for (window.onYouTubeIframeAPIReady = function () {
        i && i.apply(this), e.playOnReady && e.play();
      }; o;) {
        if (o -= 1, n[o].src === s) return;
      }(t = document.createElement("script")).src = s, n[0].parentNode.insertBefore(t, n[0]);
    }, onReady: function onReady() {
      this.ready = !0, this.playOnReady && this.play();
    }, onPlaying: function onPlaying() {
      this.playStatus < 2 && (this.listeners.playing(), this.playStatus = 2);
    }, onPause: function onPause() {
      e.prototype.setTimeout.call(this, this.checkSeek, null, 2e3);
    }, checkSeek: function checkSeek() {
      this.stateChange !== YT.PlayerState.PAUSED && this.stateChange !== YT.PlayerState.ENDED || (this.listeners.pause(), delete this.playStatus);
    }, onStateChange: function onStateChange(t) {
      switch (t.data) {case YT.PlayerState.PLAYING:
          this.hasPlayed = !0, this.onPlaying();break;case YT.PlayerState.PAUSED:case YT.PlayerState.ENDED:
          this.onPause();}this.stateChange = t.data;
    }, onError: function onError(t) {
      this.listeners.error(t);
    }, play: function play() {
      var t = this;this.playStatus || (this.listeners.play(), this.playStatus = 1), this.ready ? !this.hasPlayed && (this.clickToPlay || window.navigator && /iP(hone|od|ad)/.test(window.navigator.platform)) ? this.onPlaying() : this.player.playVideo() : (this.playOnReady = !0, window.YT && YT.Player ? this.player || (this.player = new YT.Player(this.element, { videoId: this.videoId, playerVars: this.playerVars, events: { onReady: function onReady() {
            t.onReady();
          }, onStateChange: function onStateChange(e) {
            t.onStateChange(e);
          }, onError: function onError(e) {
            t.onError(e);
          } } })) : this.loadAPI());
    }, pause: function pause() {
      this.ready ? this.player.pauseVideo() : this.playStatus && (delete this.playOnReady, this.listeners.pause(), delete this.playStatus);
    } }), t.extend(e.prototype, { YouTubePlayer: s, textFactory: function textFactory(t, e) {
      var n = this.options,
          o = this.getItemProperty(t, n.youTubeVideoIdProperty);return o ? (void 0 === this.getItemProperty(t, n.urlProperty) && (t[n.urlProperty] = "//www.youtube.com/watch?v=" + o), void 0 === this.getItemProperty(t, n.videoPosterProperty) && (t[n.videoPosterProperty] = "//img.youtube.com/vi/" + o + "/maxresdefault.jpg"), this.videoFactory(t, e, new s(o, n.youTubePlayerVars, n.youTubeClickToPlay))) : i.call(this, t, e);
    } }), e;
});


},{}],8:[function(require,module,exports){
'use strict';

/*
 * blueimp helper JS
 * https://github.com/blueimp/Gallery
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 */

/* global define, window, document */

;(function () {
	'use strict';

	function extend(obj1, obj2) {
		var prop;
		for (prop in obj2) {
			if (obj2.hasOwnProperty(prop)) {
				obj1[prop] = obj2[prop];
			}
		}
		return obj1;
	}

	function Helper(query) {
		if (!this || this.find !== Helper.prototype.find) {
			// Called as function instead of as constructor,
			// so we simply return a new instance:
			return new Helper(query);
		}
		this.length = 0;
		if (query) {
			if (typeof query === 'string') {
				query = this.find(query);
			}
			if (query.nodeType || query === query.window) {
				// Single HTML element
				this.length = 1;
				this[0] = query;
			} else {
				// HTML element collection
				var i = query.length;
				this.length = i;
				while (i) {
					i -= 1;
					this[i] = query[i];
				}
			}
		}
	}

	Helper.extend = extend;

	Helper.contains = function (container, element) {
		do {
			element = element.parentNode;
			if (element === container) {
				return true;
			}
		} while (element);
		return false;
	};

	Helper.parseJSON = function (string) {
		return window.JSON && JSON.parse(string);
	};

	extend(Helper.prototype, {
		find: function find(query) {
			var container = this[0] || document;
			if (typeof query === 'string') {
				if (container.querySelectorAll) {
					query = container.querySelectorAll(query);
				} else if (query.charAt(0) === '#') {
					query = container.getElementById(query.slice(1));
				} else {
					query = container.getElementsByTagName(query);
				}
			}
			return new Helper(query);
		},

		hasClass: function hasClass(className) {
			if (!this[0]) {
				return false;
			}
			return new RegExp('(^|\\s+)' + className + '(\\s+|$)').test(this[0].className);
		},

		addClass: function addClass(className) {
			var i = this.length;
			var element;
			while (i) {
				i -= 1;
				element = this[i];
				if (!element.className) {
					element.className = className;
					return this;
				}
				if (this.hasClass(className)) {
					return this;
				}
				element.className += ' ' + className;
			}
			return this;
		},

		removeClass: function removeClass(className) {
			var regexp = new RegExp('(^|\\s+)' + className + '(\\s+|$)');
			var i = this.length;
			var element;
			while (i) {
				i -= 1;
				element = this[i];
				element.className = element.className.replace(regexp, ' ');
			}
			return this;
		},

		on: function on(eventName, handler) {
			var eventNames = eventName.split(/\s+/);
			var i;
			var element;
			while (eventNames.length) {
				eventName = eventNames.shift();
				i = this.length;
				while (i) {
					i -= 1;
					element = this[i];
					if (element.addEventListener) {
						element.addEventListener(eventName, handler, false);
					} else if (element.attachEvent) {
						element.attachEvent('on' + eventName, handler);
					}
				}
			}
			return this;
		},

		off: function off(eventName, handler) {
			var eventNames = eventName.split(/\s+/);
			var i;
			var element;
			while (eventNames.length) {
				eventName = eventNames.shift();
				i = this.length;
				while (i) {
					i -= 1;
					element = this[i];
					if (element.removeEventListener) {
						element.removeEventListener(eventName, handler, false);
					} else if (element.detachEvent) {
						element.detachEvent('on' + eventName, handler);
					}
				}
			}
			return this;
		},

		empty: function empty() {
			var i = this.length;
			var element;
			while (i) {
				i -= 1;
				element = this[i];
				while (element.hasChildNodes()) {
					element.removeChild(element.lastChild);
				}
			}
			return this;
		},

		first: function first() {
			return new Helper(this[0]);
		}
	});

	if (typeof define === 'function' && define.amd) {
		define(function () {
			return Helper;
		});
	} else {
		window.blueimp = window.blueimp || {};
		window.blueimp.helper = Helper;
	}
})();

},{}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var KenBurnsController = function () {
	function KenBurnsController() {
		_classCallCheck(this, KenBurnsController);

		this.process();
	}

	_createClass(KenBurnsController, [{
		key: "process",
		value: function process() {
			console.log("Hello from Ken Burn Controller!");
			/*
   JavaScript For Responsive Bootstrap Carousel
      Author: Razboynik
     Author URI: http://filwebs.ru
     Description: Bootstrap Carousel Effect Ken Burns
   */

			/*-----------------------------------------------------------------*/
			/* ANIMATE SLIDER CAPTION
   /* Demo Scripts for Bootstrap Carousel and Animate.css article on SitePoint by Maria Antonietta Perna
   /*-----------------------------------------------------------------*/
			"use strict";
			function doAnimations(elems) {
				//Cache the animationend event in a variable
				var animEndEv = 'webkitAnimationEnd animationend';
				elems.each(function () {
					var $this = $(this),
					    $animationType = $this.data('animation');
					$this.addClass($animationType).one(animEndEv, function () {
						$this.removeClass($animationType);
					});
				});
			}
			//Variables on page load
			var $immortalCarousel = $('.animate_text'),
			    $firstAnimatingElems = $immortalCarousel.find('.item:first').find("[data-animation ^= 'animated']");
			//Initialize carousel
			$immortalCarousel.carousel();
			//Animate captions in first slide on page load
			doAnimations($firstAnimatingElems);
			//Other slides to be animated on carousel slide event
			$immortalCarousel.on('slide.bs.carousel', function (e) {
				var $animatingElems = $(e.relatedTarget).find("[data-animation ^= 'animated']");
				doAnimations($animatingElems);
			});
		}
	}]);

	return KenBurnsController;
}();

exports.default = KenBurnsController;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//This import order matters, don't change it or app could break.


var _blueimpHelper = require('./dependencies/blueimp-helper');

var _blueimpHelper2 = _interopRequireDefault(_blueimpHelper);

var _blueimpGallery = require('./dependencies/blueimp-gallery');

var _blueimpGallery2 = _interopRequireDefault(_blueimpGallery);

var _blueimpGalleryFullscreen = require('./dependencies/blueimp-gallery-fullscreen');

var _blueimpGalleryFullscreen2 = _interopRequireDefault(_blueimpGalleryFullscreen);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PhotoGalleryController = function () {
	function PhotoGalleryController() {
		_classCallCheck(this, PhotoGalleryController);

		this.process();
	}

	//documentation for api methods used in process
	//https://www.flickr.com/services/api/explore/flickr.photosets.getPhotos

	//To get album list
	//https://www.flickr.com/services/api/explore/flickr.photosets.getList


	_createClass(PhotoGalleryController, [{
		key: 'process',
		value: function process() {
			var galleryController = this;
			$(document).ready(function () {
				// Load demo images from flickr:
				$.ajax({
					url: 'https://api.flickr.com/services/rest/',
					data: {
						format: 'json',
						user_id: '151536734@N03',
						method: 'flickr.photosets.getList',
						api_key: '0de69094c4a08c0ec198f6e200681d2e'
					},
					dataType: 'jsonp',
					jsonp: 'jsoncallback'
				}).done(function (result) {
					//checking to make sure request with api was successful....
					if (result.stat === "fail") {
						console.log("Error occured!");
						console.log(result);
						galleryController.handleError("An Error occurred, Please try refreshing the browser.");
						//handle error here.....
						$('.loader').hide();
					} else {
						var albumContainer = $('#albumContainer');
						var albumElem = void 0;
						var baseUrl = void 0;
						var selectYearArray = [];
						var addToTagArray = true;
						$.each(result.photosets.photoset, function (index, photo) {
							baseUrl = 'https://c1.staticflickr.com/' + photo.farm + '/' + photo.server + '/' + photo.primary + '_' + photo.secret;
							//Building the album image containers dynamically through ajax call.
							albumElem = '<li><div class="photoAlbum view photo-list-album-view awake" id="' + photo.id + '" style="transform: translate(0px, 8px);width: 240px;height: 240px;background-image:url(' + baseUrl + '_n.jpg)">';
							albumElem += '<a class="interaction-view avatar photo-list-album album ginormous" href="#" title="' + photo.title._content + '" data-rapid_p="65">';
							albumElem += '<div class="photo-list-album-interaction dark has-actions" data-albumid="' + photo.id + '" >';
							albumElem += '<a class="overlay" href="#" data-rapid_p="87"></a>';
							albumElem += '<div class="interaction-bar">';
							albumElem += '<div class="metadata">';
							albumElem += '<h4 class="albumTitle">' + photo.title._content + '</h4>';
							var albumTags = photo.description._content;
							var albumTagArray = albumTags.split(',');

							for (var i = 0; i < albumTagArray.length; i++) {
								if (albumTagArray[i].includes("year:")) {
									var subAlbumArray = albumTagArray[i].split(":");
									albumElem += '<h4 class="albumYear">' + subAlbumArray[1].trim() + '</h4>';
									for (var j = 0; j < selectYearArray.length; j++) {
										if (subAlbumArray[1].trim().toUpperCase() === selectYearArray[j].toUpperCase()) {
											addToTagArray = false;
											break;
										}
										addToTagArray = true;
									}
									if (addToTagArray) {
										selectYearArray.push(subAlbumArray[1].trim());
									}
								} else if (albumTagArray[i].includes("school:")) {
									var _subAlbumArray = albumTagArray[i].split(":");
									albumElem += '<h4 class="albumSchool">' + _subAlbumArray[1].trim() + '</h4>';
								} else if (albumTagArray[i].includes("event:")) {
									var _subAlbumArray2 = albumTagArray[i].split(":");
									albumElem += '<h4 class="albumEvent">' + _subAlbumArray2[1].trim() + '</h4>';
								} else {
									albumElem += '<h4 class="albumTag" style="display:none;">' + albumTagArray[i].trim() + '</h4>';
								}
							}
							var photoString = void 0;
							if (photo.photos > 1) {
								photoString = "photos";
							} else {
								photoString = "photo";
							}
							albumElem += '<span class="album-photo-count secondary">' + photo.photos + ' ' + photoString + '</span>';
							albumElem += '</div></div></div></a></div></li>';
							$('#list').append(albumElem);
							albumElem = "";
						}); //end Each
						//Sorting years into order from least to greatest.
						selectYearArray = galleryController.bubbleSortArray(selectYearArray);
						//Add bubble sort method here.
						for (var i = 0; i < selectYearArray.length; i++) {
							var optionElem = '<option value ="' + selectYearArray[i] + '">' + selectYearArray[i] + '</option>';
							$('#filter-tags').append(optionElem);
						}

						$('.photoAlbum').click(function (event) {
							event.preventDefault();
							$('#closeButton').show("slow");
							$('#albumContainer').hide("slow");
							$('.loader').show("fast");
							$.ajax({
								url: 'https://api.flickr.com/services/rest/',
								data: {
									format: 'json',
									photoset_id: this.id,
									user_id: '151536734@N03',
									method: 'flickr.photosets.getPhotos',
									api_key: '0de69094c4a08c0ec198f6e200681d2e'
								},
								dataType: 'jsonp',
								jsonp: 'jsoncallback'
							}).done(function (result) {
								if (result.stat === "fail") {
									console.log("Error occured while grabbing photo album!");
									console.log(result);
									galleryController.handleError("An Error occurred, Please try refreshing the browser.");
								} else {
									//console.log(result);
									var carouselLinks = [],
									    linksContainer = $('#links').empty(),
									    _baseUrl = void 0;
									// Add the demo images as links with thumbnails to the page:
									$.each(result.photoset.photo, function (index, photo) {
										//$.each(result.photos.photo, function (index, photo) {
										_baseUrl = 'https://farm' + photo.farm + '.static.flickr.com/' + photo.server + '/' + photo.id + '_' + photo.secret;
										$('<a/>').append($('<img>').prop('src', _baseUrl + '_s.jpg')).prop('href', _baseUrl + '_b.jpg').prop('title', photo.title).attr('data-gallery', '').appendTo(linksContainer);
										carouselLinks.push({
											href: _baseUrl + '_c.jpg',
											title: photo.title
										});
									});
									// Initialize the Gallery as image carousel:
									blueimp.Gallery(carouselLinks, {
										container: '#blueimp-image-carousel',
										carousel: true
									});
									$('.loader').hide("fast");
									$('#blueimp-image-carousel').show("slow");
									$('#links').show("slow");
								}
							}).fail(function (error) {
								console.log("The inner request failed with");
								console.log(error);
								galleryController.handleError("An Error occurred, Please try refreshing the browser.");
							}); //End ajax call.
							//Hooking up lightBox links to onclick function
							document.getElementById('links').onclick = function (event) {
								event = event || window.event;
								var target = event.target || event.srcElement,
								    link = target.src ? target.parentNode : target,
								    options = { index: link, event: event },
								    links = this.getElementsByTagName('a');
								blueimp.Gallery(links, options);
							}; //end hooking up lightbox onclick.
						}); //End onClick.
						//Add search etc here?
						//Grabbing the list.js script dynamically after sucessfully hit flickr api.
						$.getScript("//cdnjs.cloudflare.com/ajax/libs/list.js/1.5.0/list.min.js").done(function () {
							//This instantiates our pagination and search functionality 
							var monkeyList = new List('albumContainer', {
								valueNames: ['albumTitle', 'albumYear', 'albumSchool', 'albumTag', 'albumEvent'],
								page: 6,
								pagination: true
							});
							$('#filter-tags').change(function () {
								console.log($('#filter-tags').val());
								var selectedOption = $('#filter-tags').val();
								monkeyList.filter(function (item) {
									if (selectedOption === "Select Year") {
										return true;
									} else if (item.values().albumYear.trim() == selectedOption) {
										return true;
									} else {
										return false;
									}
								});
								return false;
							});
						});
						$('.loader').hide();
					} //End else (if no error)
				}).fail(function (error) {
					console.log("the request failed and threw an error");
					console.log(error);
					galleryController.handleError("An Error occurred, Please try refreshing the browser.");
				}); //End get photo Albums ajax call

				$('#closeButton').click(function (event) {
					event.preventDefault();
					$('#closeButton').hide("slow");
					$('#albumContainer').show("slow");
					$('#blueimp-image-carousel').hide("slow");
					$('#links').hide("slow");
				});
			}); //End document.ready
		} //end process

	}, {
		key: 'bubbleSortArray',
		value: function bubbleSortArray(array) {
			var length = array.length;
			for (var i = 0; i < length; i++) {
				for (var j = 0; j < length - i - 1; j++) {
					if (array[j] > array[j + 1]) {
						var temp = array[j];
						array[j] = array[j + 1];
						array[j + 1] = temp;
					}
				}
			}
			return array;
		}
	}, {
		key: 'handleError',
		value: function handleError(errorMsg) {
			$('#albumContainer').hide();
			$('#errorMessage').text(errorMsg);
			$('#errorMessage').show();
		}
	}]);

	return PhotoGalleryController;
}();

exports.default = PhotoGalleryController;

},{"./dependencies/blueimp-gallery":7,"./dependencies/blueimp-gallery-fullscreen":6,"./dependencies/blueimp-helper":8}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

//import NavigationMiddleware from './navigation';

var Middleware = function Middleware(page) {
    //page('*', NavigationMiddleware);

    _classCallCheck(this, Middleware);
};

exports.default = Middleware;

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _page = require('page');

var _page2 = _interopRequireDefault(_page);

var _middlewares = require('../middlewares');

var _middlewares2 = _interopRequireDefault(_middlewares);

var _kenBurnsEffect = require('./ken-burns-effect');

var _kenBurnsEffect2 = _interopRequireDefault(_kenBurnsEffect);

var _photoGallery = require('./photo-gallery');

var _photoGallery2 = _interopRequireDefault(_photoGallery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Router = function (_Middleware) {
	_inherits(Router, _Middleware);

	function Router() {
		_classCallCheck(this, Router);

		var _this = _possibleConstructorReturn(this, (Router.__proto__ || Object.getPrototypeOf(Router)).call(this, _page2.default));

		_this._bindRoutes();
		_page2.default.start({ click: false });
		return _this;
	}

	_createClass(Router, [{
		key: '_bindRoutes',
		value: function _bindRoutes() {
			(0, _page2.default)('/', _kenBurnsEffect2.default);
			(0, _page2.default)('/gallery/', _photoGallery2.default);
		}
	}, {
		key: 'refresh',
		value: function refresh() {
			(0, _page2.default)(window.location.pathname);
		}
	}]);

	return Router;
}(_middlewares2.default);

exports.default = Router;

},{"../middlewares":11,"./ken-burns-effect":13,"./photo-gallery":14,"page":1}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = KenBurnsEffect;

var _kenBurnsEffect = require('../controllers/ken-burns-effect');

var _kenBurnsEffect2 = _interopRequireDefault(_kenBurnsEffect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function KenBurnsEffect(ctx, next) {
	new _kenBurnsEffect2.default();
	next();
}

},{"../controllers/ken-burns-effect":9}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = PhotoGallery;

var _photoGallery = require('../controllers/photo-gallery');

var _photoGallery2 = _interopRequireDefault(_photoGallery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function PhotoGallery(ctx, next) {
	new _photoGallery2.default();

	next();
}

},{"../controllers/photo-gallery":10}]},{},[5])

//# sourceMappingURL=bundle.js.map
