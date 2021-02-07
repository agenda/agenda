import { toJson } from "./to-json";
import { computeNextRunAt } from "./compute-next-run-at";
import { repeatEvery } from "./repeat-every";
import { repeatAt } from "./repeat-at";
import { disable } from "./disable";
import { enable } from "./enable";
import { unique } from "./unique";
import { schedule } from "./schedule";
import { priority } from "./priority";
import { fail } from "./fail";
import { run } from "./run";
import { isRunning } from "./is-running";
import { save } from "./save";
import { remove } from "./remove";
import { touch } from "./touch";
import { parsePriority } from "../utils";
import { Agenda } from "../agenda";
import { JobPriority } from "../agenda/define";
import * as mongodb from "mongodb";

export interface JobAttributes {
  _id?: mongodb.ObjectID;
  agenda: Agenda;
  type: string;
  name: string;
  disabled?: boolean;
  nextRunAt?: Date | null;
  lockedAt?: Date;
  priority: number | string;
  data?: any;
  unique?: any;
  uniqueOpts?: {
    insertOnly: boolean;
  };
  repeatInterval?: string;
  repeatTimezone?: string | null;
  repeatAt?: string;
  lastRunAt?: Date;
  lastFinishedAt?: Date;
  startDate?: Date | number | null;
  endDate?: Date | number | null;
  skipDays?: string | null;
  failReason?: string;
  failCount?: number;
  failedAt?: Date;
  lastModifiedBy?: string;
}

/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
class Job {
  agenda: Agenda;
  attrs: JobAttributes;
  toJSON!: typeof toJson;
  computeNextRunAt!: typeof computeNextRunAt;
  repeatEvery!: typeof repeatEvery;
  repeatAt!: typeof repeatAt;
  disable!: typeof disable;
  enable!: typeof enable;
  unique!: typeof unique;
  schedule!: typeof schedule;
  priority!: typeof priority;
  fail!: typeof fail;
  run!: typeof run;
  isRunning!: typeof isRunning;
  save!: typeof save;
  remove!: typeof remove;
  touch!: typeof touch;

  constructor(options: JobAttributes) {
    const { agenda, type, nextRunAt, ...args } = options ?? {};

    // Save Agenda instance
    this.agenda = agenda;

    // Set priority
    args.priority =
      args.priority === undefined
        ? JobPriority.normal
        : parsePriority(args.priority);

    // Set attrs to args
    const attrs: any = {};
    for (const key in args) {
      if ({}.hasOwnProperty.call(args, key)) {
        // @ts-expect-error
        attrs[key] = args[key];
      }
    }

    // Set defaults if undefined
    this.attrs = {
      ...attrs,
      // NOTE: What is the difference between 'once' here and 'single' in agenda/index.js?
      name: attrs.name || "",
      priority: attrs.priority,
      type: type || "once",
      nextRunAt: nextRunAt || new Date(),
    };
  }
}

Job.prototype.toJSON = toJson;
Job.prototype.computeNextRunAt = computeNextRunAt;
Job.prototype.repeatEvery = repeatEvery;
Job.prototype.repeatAt = repeatAt;
Job.prototype.disable = disable;
Job.prototype.enable = enable;
Job.prototype.unique = unique;
Job.prototype.schedule = schedule;
Job.prototype.priority = priority;
Job.prototype.fail = fail;
Job.prototype.run = run;
Job.prototype.isRunning = isRunning;
Job.prototype.save = save;
Job.prototype.remove = remove;
Job.prototype.touch = touch;

export { Job };
