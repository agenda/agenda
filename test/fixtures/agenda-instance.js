const { Agenda } = require('../../dist');
const addTests = require('./add-tests');

const connStr = process.argv[2];
const tests = process.argv.slice(3);

const agenda = new Agenda({
  db: {
    address: connStr
  }
}, async() => {
  tests.forEach(test => {
    addTests[test](agenda);
  });

  await agenda.start();

  // Ensure we can shut down the process from tests
  process.on('message', msg => {
    if (msg === 'exit') {
      process.exit(0);
    }
  });

  // Send default message of "notRan" after 400ms
  setTimeout(() => {
    process.send('notRan');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  }, 400);
});
