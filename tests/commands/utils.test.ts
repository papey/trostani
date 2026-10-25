// commands/utils.ts test file

// Imports
import { Command } from "../../src/commands/utils";
import { assert } from "chai";

// Command class test suite
describe("Commands, Utils Test Suite", function() {
  it("[constructor]: Command constructor, should parse a command message", function() {
    let command = new Command("!profile", "!");
    assert.equal(command.main, "profile");

    // try other commands
    // help command
    let help = new Command("!help", "!");
    assert.equal(help.main, "help");

    // search command
    let search = new Command("!sync search keyword", "!");
    assert.equal(search.main, "sync");
    assert.equal(search.sub, "search");
    assert.equal(search.args, "keyword");

    // with extras
    let cmd = `!push Thassa Elementals // standard // BO1 // Thassa FTW !
    ...`;
    let extra = new Command(cmd, "!");
    assert(extra.extra, "...");
  });
});
