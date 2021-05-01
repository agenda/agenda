describe("Exports", () => {
  it("should export both default Agenda and { Agenda }", () => {
    require("./imports/require.js");
    require("./imports/require-es.js");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requireEsm = require("esm")(module /*, options*/);
    requireEsm("./imports/import.js");
    requireEsm("./imports/import-es.js");
  });
});
