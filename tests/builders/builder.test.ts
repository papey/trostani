// builder.ts testing file

// Imports
import { Cookie } from "../../src/builders/builder";
import { suite, test } from "mocha-typescript";
import { assert } from "chai";

// Trostani class testing suite
@suite("Builder, Cookie Test Suite")
class BuilderCookieTestSuite extends Cookie {
  constructor() {
    super("TOKEN", "Mon, 21-Oct-2018 13:06:45 GMT");
  }

  @test "[valid]: Should return false since cookie is not valid"() {
    let res = this.valid();
    assert.equal(res, false);
  }
}
