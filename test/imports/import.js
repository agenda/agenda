import assert from "assert";

import Agenda1 from "../..";
import { Agenda as Agenda2 } from "../..";
assert.strictEqual(Agenda1.constructor, Agenda2.constructor); // comparing ctors, as Agenda1 is a JS Proxy in `esm`
