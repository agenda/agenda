const assert = require("assert");

const Agenda1 = require("../../es").default;
const { Agenda: Agenda2 } = require("../../es");
assert.strictEqual(Agenda1, Agenda2);
