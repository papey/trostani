// bot.ts testing file

// Imports
import { Trostani } from "../src/bot";
import { suite, test } from "mocha-typescript";
import { assert } from "chai";

// Trostani class testing suite
@suite("Bot, Trostani Test Suite")
class TrostaniTestSuite extends Trostani {
  constructor() {
    super("./tests/config/test.yml");
  }

  @test
  "[isPushAuthorized]: Should return true, since this an authorized channel"() {
    assert.equal(this.isPushAuthorized("628119686910967800"), true);
  }

  @test
  "[isPushAuthorized]: Should return false, since this not an authorized channel"() {
    assert.equal(this.isPushAuthorized("NOP"), false);
  }
}
