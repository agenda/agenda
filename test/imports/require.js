const assert = require("assert");

const Agenda1 = require("../..");
const { Agenda: Agenda2 } = require("../..");
assert.strictEqual(Agenda1, Agenda2);
