"use strict";
var assert = require("assert");
var sinon = require("sinon");
var Queue = require("../lib/queue");
var SubQueue = require("../lib/subqueue");

describe("Queue", function () {
  beforeEach(function () {
    var runOrder = (this.runOrder = []);
    this.q = new Queue(["before", "run", "after"]);
    this.task1 = function (cb) {
      runOrder.push("task1");
      cb();
    };
    this.task2 = function (cb) {
      runOrder.push("task2");
      cb();
    };
    var callbackError = (this.callbackError = new Error());
    this.taskCallError = function (cb, stop) {
      runOrder.push("taskCallError");
      stop(callbackError);
    };
    var throwError = (this.throwError = new Error());
    this.taskThrowError = function () {
      runOrder.push("taskThrowError");
      throw throwError;
    };
    var rejectError = (this.rejectError = new Error());
    this.taskRejectError = function () {
      runOrder.push("taskRejectError");
      return Promise.reject(rejectError);
    };
  });

  describe("Constructor", function () {
    it("create sub-queues", function () {
      assert(this.q.__queues__.before instanceof SubQueue);
      assert(this.q.__queues__.run instanceof SubQueue);
      assert(this.q.__queues__.after instanceof SubQueue);
    });

    it("create a default queue", function () {
      assert(this.q.__queues__.default instanceof SubQueue);
      assert.equal(Object.keys(this.q.__queues__).pop(), "default");
    });

    it("allow redefining `default` queue position", function () {
      var queue = new Queue(["before", "default", "after"]);
      assert.deepEqual(Object.keys(queue.__queues__), [
        "before",
        "default",
        "after",
      ]);
    });

    it("does not mutate the arguments", function () {
      const defaultArr = ["before"];
      var queue = new Queue(defaultArr);
      assert.deepEqual(Object.keys(queue.__queues__), ["before", "default"]);
      assert.deepEqual(defaultArr, ["before"]);
    });
  });

  describe("#add", function () {
    beforeEach(function () {
      this.runStub = sinon.stub(this.q, "run");
    });

    it("add task to a queue", function () {
      this.q.add("before", this.task1);
      this.q.add("after", this.task2);
      assert.equal(this.q.__queues__.before.shift().task, this.task1);
      assert.equal(this.q.__queues__.after.shift().task, this.task2);
    });

    it("default task in the default queue", function () {
      this.q.add(this.task1);
      assert.equal(this.q.__queues__.default.shift().task, this.task1);
    });

    it("calls run", function (done) {
      this.q.add(this.task1);
      this.q.add(this.task2);
      setImmediate(
        function () {
          assert(this.runStub.called);
          done();
        }.bind(this),
      );
    });

    it("does not call run", function (done) {
      this.q.add("before", this.task1, { run: false });
      this.q.add("after", this.task2, { run: false });
      setImmediate(
        function () {
          assert.equal(this.runStub.called, false);
          done();
        }.bind(this),
      );
    });

    it("only run named task once", function () {
      this.q.add(this.task1, { once: "done" });
      this.q.add(this.task2, { once: "done" });
      assert.equal(this.q.__queues__.default.__queue__.length, 1);
    });

    it("runs priority in order", function (done) {
      this.runStub.restore();
      this.q.add("after", this.task1);
      this.q.add("before", this.task2);
      this.q.once(
        "end",
        function () {
          assert.deepEqual(this.runOrder, ["task2", "task1"]);
          done();
        }.bind(this),
      );
    });
  });

  describe("#run", function () {
    it("run the queue by default", function (done) {
      this.q.add(function () {
        done();
      });
    });

    it("run the queue with runOnAdd set to false and opt is undefined", function (done) {
      var q = new Queue(["before", "run", "after"], false);
      q.add(function () {
        done();
      });
      done();
    });

    it("run the queue with runOnAdd set to false and opt is defined", function (done) {
      var q = new Queue(["before", "run", "after"], false);
      q.add(function () {
        done();
      }, {});
      done();
    });

    it('run task in "First-in First-out" order', function (done) {
      this.q.add(this.task2);
      this.q.add(this.task1);
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task2");
          assert.equal(this.runOrder[1], "task1");
          done();
        }.bind(this),
      );
    });

    it("run async tasks", function (done) {
      var counter = 0;
      this.q.add(function (cb) {
        assert.equal((counter += 1), 1);
        cb();
      });
      this.q.add(function () {
        assert.equal((counter += 1), 2);
        done();
      });
    });

    it("emits error on rejected tasks", function (done) {
      var self = this;
      this.q.add(function () {
        return Promise.reject(new Error("errorTask"));
      });
      var onError = function () {
        assert(!self.q.running);
        self.q.removeListener("error", onError);
        done();
      };
      this.q.on("error", onError);
    });

    it("emits error on thrown tasks", function (done) {
      var self = this;
      this.q.add(function () {
        throw new Error("errorTask");
      });
      var onError = function () {
        assert(!self.q.running);
        self.q.removeListener("error", onError);
        done();
      };
      this.q.on("error", onError);
    });

    it("run prioritized tasks first", function (done) {
      var stub = sinon.stub(this.q, "run");
      this.q.add("after", this.task2);
      this.q.add("before", this.task1);
      stub.restore();
      this.q.run();
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task1");
          assert.equal(this.runOrder[1], "task2");
          done();
        }.bind(this),
      );
    });

    it("always re-exec from the first queue down", function (done) {
      this.q.add(
        function (cb) {
          this.q.add("after", this.task1);
          this.q.add("before", this.task2);
          cb();
          this.q.once(
            "end",
            function () {
              assert.equal(this.runOrder[0], "task2");
              assert.equal(this.runOrder[1], "task1");
              done();
            }.bind(this),
          );
        }.bind(this),
      );
    });

    it("run the queues explicitly after tasks are added", function (done) {
      this.q.add("before", this.task1, { run: false });
      this.q.add("after", this.task2, { run: false });
      this.q.run();
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task1");
          assert.equal(this.runOrder[1], "task2");
          done();
        }.bind(this),
      );
    });

    it("add new subqueue and run tasks", function (done) {
      this.q.add("before", this.task1, { run: false });
      this.q.add("after", this.task2, { run: false });

      var self = this;
      var task3 = function (cb) {
        self.runOrder.push("task3");
        cb();
      };
      var task4 = function (cb) {
        self.runOrder.push("task4");
        cb();
      };
      var task5 = function (cb) {
        self.runOrder.push("task5");
        cb();
      };
      var task6 = function (cb) {
        self.runOrder.push("task6");
        cb();
      };
      this.q.addSubQueue("between", "after");
      // Ignored
      this.q.addSubQueue("between");
      this.q.addSubQueue("init", "before");
      this.q.addSubQueue("after-end");
      this.q.add("init", task3, { run: false });
      this.q.add("before", task4, { run: false });
      this.q.add("between", task5, { run: false });
      this.q.add("after-end", task6, { run: false });

      this.q.run();
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task3");
          assert.equal(this.runOrder[1], "task1");
          assert.equal(this.runOrder[2], "task4");
          assert.equal(this.runOrder[3], "task5");
          assert.equal(this.runOrder[4], "task2");
          assert.equal(this.runOrder[5], "task6");
          assert.equal(this.runOrder[6], undefined);
          done();
        }.bind(this),
      );
    });

    it("run the queues from new subqueue inside task", function (done) {
      this.q.add("before", this.task1, { run: false });
      this.q.add("after", this.task2, { run: false });

      var self = this;
      var task4 = function (cb) {
        self.runOrder.push("task4");
        cb();
      };
      var task5 = function (cb) {
        self.runOrder.push("task5");
        cb();
      };
      var task6 = function (cb) {
        self.runOrder.push("task6");
        cb();
      };
      var task3 = function (cb) {
        self.q.addSubQueue("before", "after");
        self.q.addSubQueue("init", "before");
        self.q.add("init", task4, { run: false });
        self.q.add("before", task6, { run: false });
        self.runOrder.push("task3");
        cb();
      };
      this.q.add("before", task3, { run: false });
      this.q.add("before", task5, { run: false });

      this.q.run();
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task1");
          assert.equal(this.runOrder[1], "task3");
          assert.equal(this.runOrder[2], "task4");
          assert.equal(this.runOrder[3], "task5");
          assert.equal(this.runOrder[4], "task6");
          assert.equal(this.runOrder[5], "task2");
          assert.equal(this.runOrder[6], undefined);
          done();
        }.bind(this),
      );
    });

    it("emit `end` event once the queue is cleared.", function (done) {
      this.q.on("end", function () {
        done();
      });
      this.q.add("after", this.task1);
    });

    it("pauses the queue and continue", function (done) {
      var self = this;
      var pause = function (cb) {
        self.runOrder.push("pause");
        self.q.pause();
        cb();
      };

      this.q.add("before", this.task1, { run: false });
      this.q.add("run", pause, { run: false });
      this.q.add("after", this.task2.bind(this), { run: false });
      this.q.add("after", pause, { run: false });
      this.q.add("after", this.task2, { run: false });

      this.q.run();
      this.q.on("paused", function () {
        self.runOrder.push("paused");
        self.q.run();
      });
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task1");
          assert.equal(this.runOrder[1], "pause");
          assert.equal(this.runOrder[2], "paused");
          assert.equal(this.runOrder[3], "task2");
          assert.equal(this.runOrder[4], "pause");
          assert.equal(this.runOrder[5], "paused");
          assert.equal(this.runOrder[6], "task2");
          assert.equal(this.runOrder[7], undefined);
          done();
        }.bind(this),
      );
    });

    it("pauses the queue with pause callback", function (done) {
      var self = this;
      var pause = function (_, pause) {
        self.runOrder.push("pause");
        pause();
      };

      this.q.add("before", this.task1, { run: false });
      this.q.add("run", pause, { run: false });
      this.q.add("after", this.task2.bind(this), { run: false });
      this.q.add("after", pause, { run: false });
      this.q.add("after", this.task2.bind(this), { run: false });

      this.q.run();
      this.q.on("paused", function () {
        self.runOrder.push("paused");
        self.q.run();
      });
      this.q.once(
        "end",
        function () {
          assert.equal(this.runOrder[0], "task1");
          assert.equal(this.runOrder[1], "pause");
          assert.equal(this.runOrder[2], "paused");
          assert.equal(this.runOrder[3], "task2");
          assert.equal(this.runOrder[4], "pause");
          assert.equal(this.runOrder[5], "paused");
          assert.equal(this.runOrder[6], "task2");
          assert.equal(this.runOrder[7], undefined);
          done();
        }.bind(this),
      );
    });

    it("emit `error` event if the callback is called.", function (done) {
      this.q.on("error", (error) => {
        assert.equal(error, this.callbackError);
        done();
      });
      this.q.add("after", this.taskCallError);
    });

    it("emit `error` event if the task throws.", function (done) {
      this.q.on("error", (error) => {
        assert.equal(error, this.throwError);
        done();
      });
      this.q.add("after", this.taskThrowError);
    });

    it("emit `error` event if the task rejects.", function (done) {
      this.q.on("error", (error) => {
        assert.equal(error, this.rejectError);
        done();
      });
      this.q.add("after", this.taskRejectError);
    });
  });
});
