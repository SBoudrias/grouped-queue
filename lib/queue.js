var SubQueue = require('./subqueue');

module.exports = Queue;

/**
 * Queue constructor
 * @param {Array} [subQueue] The order of the sub-queues. First one will be runned first.
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
