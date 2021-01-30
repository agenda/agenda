import createDebugger from "debug";
import { Agenda } from ".";
import { Job } from "../job";

const debug = createDebugger("agenda:schedule");

/**
 * Schedule a job or jobs at a specific time
 * @name Agenda#schedule
 * @function
 * @param when when the job gets run
 * @param names array of job names to run
 * @param data data to send to job
 * @returns job or jobs created
 */
export const schedule = function (
  this: Agenda,
  when: string,
  names: string[],
  data: any
) {
  /**
   * Internal method that creates a job with given date
   * @param when when the job gets run
   * @param name of job to run
   * @param data data to send to job
   * @returns instance of new job
   */
  const createJob = async (
    when: string,
    name: string,
    data: any
  ): Promise<Job> => {
    const job = this.create(name, data);

    await job.schedule(when).save();

    return job;
  };

  /**
   * Internal helper method that calls createJob on a names array
   * @param when when the job gets run
   * @param of jobs to run
   * @param data data to send to job
   * @returns jobs that were created
   */
  const createJobs = async (
    when: string,
    names: string[],
    data: any
  ): Promise<Job[]> => {
    try {
      const createJobList: Array<Promise<Job>> = [];
      names.map((name) => createJobList.push(createJob(when, name, data)));
      debug("Agenda.schedule()::createJobs() -> all jobs created successfully");
      return Promise.all(createJobList);
    } catch (error: unknown) {
      debug(
        "Agenda.schedule()::createJobs() -> error creating one or more of the jobs"
      );
      throw error;
    }
  };

  if (typeof names === "string") {
    debug("Agenda.schedule(%s, %O, [%O], cb)", when, names);
    return createJob(when, names, data);
  }

  if (Array.isArray(names)) {
    debug("Agenda.schedule(%s, %O, [%O])", when, names);
    return createJobs(when, names, data);
  }
};
