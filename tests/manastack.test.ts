// bot.ts testing file

// Imports
import { Cookie } from "../src/builders/manastack";
import { suite, test } from "mocha-typescript";
import { assert } from "chai";

// Trostani class testing suite
@suite("ManaStack, Cookie Test Suite")
class ManaStackCookieTestSuite extends Cookie {
  constructor() {
    super("TOKEN", "Mon, 21-Oct-2018 13:06:45 GMT");
  }

  @test "[isValid]: Should return false since cookie is not valid"() {
    let res = this.valid();

    assert.equal(res, false);
  }
}
