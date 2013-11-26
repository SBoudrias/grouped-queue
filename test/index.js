var assert = require('assert');
var sinon = require('sinon');

var Queue = require('../lib/queue');
var SubQueue = require('../lib/subqueue');

describe('Queue', function() {

  beforeEach(function() {
    var runOrder = this.runOrder = [];
    this.q = new Queue([ 'before', 'run', 'after' ]);
    this.task1 = function( cb ) { runOrder.push('task1'); cb(); };
    this.task2 = function( cb ) { runOrder.push('task2'); cb(); };
  });

  describe('Constructor', function() {
    it('create sub-queues', function() {
      assert( this.q.__queues__.before instanceof SubQueue );
      assert( this.q.__queues__.run instanceof SubQueue );
      assert( this.q.__queues__.after instanceof SubQueue );
    });

    it('create a default queue', function() {
      assert( this.q.__queues__.default instanceof SubQueue );
    });
  });

  describe('#add', function() {
    beforeEach(function() {
      this.runStub = sinon.stub( this.q, 'run' );
    });

    it('add task to a queue', function() {
      this.q.add( 'before', this.task1 );
      this.q.add( 'after', this.task2 );
      assert.equal( this.q.__queues__.before.shift(), this.task1 );
      assert.equal( this.q.__queues__.after.shift(), this.task2 );
    });

    it('default task in the default queue', function() {
      this.q.add( this.task1 );
      assert.equal( this.q.__queues__.default.shift(), this.task1 );
    });

    it('calls run', function() {
      this.q.add( this.task1 );
      this.q.add( this.task2 );
      assert( this.runStub.called );
    });
  });

  describe('#run', function() {

    it('run task in "First-in First-out" order', function() {
      this.q.add( this.task2 );
      this.q.add( this.task1 );
      assert.equal( this.runOrder[0], 'task2' );
      assert.equal( this.runOrder[1], 'task1' );
    });

    it('run async tasks', function( done ) {
      var counter = 0;
      this.q.add(function( cb ) {
        assert.equal( counter += 1, 1 );
        cb();
      });
      this.q.add(function( cb ) {
        assert.equal( counter += 1, 2 );
        done();
      });
    });

    it('run prioritized tasks first', function() {
      var stub = sinon.stub( this.q, 'run' );
      this.q.add( 'after', this.task2 );
      this.q.add( 'before', this.task1 );
      stub.restore();
      this.q.run();
      assert.equal( this.runOrder[0], 'task1' );
      assert.equal( this.runOrder[1], 'task2' );
    });

    it('always re-exec from the first queue down', function( done ) {
      this.q.add(function( cb ) {
        this.q.add( 'after', this.task1 );
        this.q.add( 'before', this.task2 );
        cb();
        assert.equal( this.runOrder[0], 'task2' );
        assert.equal( this.runOrder[1], 'task1' );
        done();
      }.bind(this));
    });
  });

});