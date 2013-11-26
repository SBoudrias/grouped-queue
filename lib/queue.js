var SubQueue = require('./subqueue');

module.exports = Queue;

/**
 * Queue constructor
 * @param {String[]} [subQueue] The order of the sub-queues. First one will be runned first.
 */
function Queue( subQueue ) {
  if ( subQueue == null ) subQueue = [];
  subQueue.push('default');

  this.__queues__ = {};

  subQueue.forEach(function( name ) {
    this.__queues__[name] = new SubQueue();
  }.bind(this));
}

/**
 * Add a task to a queue.
 * @param {String}   [name='default']  The sub-queue to append the task
 * @param {Function} task
 */

Queue.prototype.add = function( name, task ) {
  if ( typeof name !== 'string' ) {
    task = name;
    name = 'default';
  }

  this.__queues__[name].push( task );
  this.run();
};

/**
 * Start emptying the queues
 * Tasks are always run from the higher priority queue down to the lowest. After each
 * task complete, the process is re-runned from the first queue until a task is found.
 *
 * Tasks are passed a `callback` method which should be called once the task is over.
 */

Queue.prototype.run = function() {
  if ( this.running ) return;

  this.running = true;
  this._exec(function() { this.running = false; }.bind(this));
};

Queue.prototype._exec = function( done ) {
  var pointer = -1;
  var names = Object.keys( this.__queues__ );

  var next = function next() {
    pointer++;
    if ( pointer >= names.length ) return done();
    this.__queues__[ names[pointer] ].run( next.bind(this), this._exec.bind(this, done) );
  }.bind(this);

  next();
};
