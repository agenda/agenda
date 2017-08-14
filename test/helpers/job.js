import {Job} from '../../lib';

const beforeEach = async t => {
  const job = new Job();

  // @NOTE: Anything that needs to be access via t.context
  //        should be added here and only here.
  Object.assign(t.context, {
    job
  });
};

const afterEach = () => {};

export {
  beforeEach,
  afterEach
};
