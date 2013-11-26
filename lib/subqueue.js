module.exports = SubQueue;

function SubQueue() {
  this.__queue__ = [];
}

/**
 * Add a task to this queue
 * @param  {Function} task
 */

SubQueue.prototype.push = function( task ) {
  this.__queue__.push( task );
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
  this.__queue__.shift().call( null, done );
};
