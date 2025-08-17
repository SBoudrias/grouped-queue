import type event from "node:events";

/**
 *
 */
declare class GroupedQueue extends event.EventEmitter {
  queueNames: string[];

  constructor(subQueueNames: string[], runOnAdd: boolean);

  /**
   * Adds a sub-queue.
   */
  addSubQueue(name: string, before?: string): void;

  /**
   * Stop running tasks.
   */
  pause(): void;

  /**
   * Add a task into a group queue
   *
   * @param subQueueName - The name of the sub-queue.
   * @param task - The task to add.
   * @param [options] - Options for the task.
   * @param [options.once] - If specified, the task will only be added if there is no other task with the same `once` value in the queue.
   * @param [options.run] - The queue will start running immediately. Defaults to runOnAdd.
   */
  add(
    subQueueName: string,
    task: (done: () => void, stop: (error: Error) => void) => Promise<void>,
    options?: { once?: string; run?: boolean },
  ): void;

  /**
   * Run tasks in the queue.
   */
  run(): void;

  /**
   * Schedule `run()`.
   */
  start(): void;
}

export = GroupedQueue;
