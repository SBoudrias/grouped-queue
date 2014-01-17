var _ = require('lodash');

module.exports = SubQueue;

function SubQueue() {
  this.__queue__ = [];
}

/**
 * Add a task to this queue
 * @param  {Function} task
 */

SubQueue.prototype.push = function( task, opt ) {
  // Don't register named task if they're already planned
  if ( opt && opt.once && _.findWhere(this.__queue__, { name: opt.once }) ) {
    return;
  }
  this.__queue__.push({
    task: task,
    name: opt ? opt.once : null
  });
};

/**
 * Return the first entry of this queue
 * @return {Function} The first task
 */

SubQueue.prototype.shift = function() {
  return this.__queue__.shift();
};

/**
 * Run task
 * @param  {Function} skip  Callback if no task is available
 * @param  {Function} done  Callback once the task is completed
 */
SubQueue.prototype.run = function( skip, done ) {
  if ( this.__queue__.length === 0 ) return skip();
  setImmediate(function () {
    this.__queue__.shift().task.call( null, done );
  }.bind(this));
};
