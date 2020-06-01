// magicville.ts testing file

// Imports
import { MagicVille } from "../../src/builders/magicville";
import { suite, test } from "mocha-typescript";
import { assert, expect } from "chai";

// Trostani class testing suite
@suite("MagicVille, Test Suite")
class MagicVilleTestSuite extends MagicVille {
  constructor() {
    const user = process.env.MVUSER;
    const pass = process.env.MVPASS;

    if (user == undefined || pass == undefined) {
      throw Error("Missing MagicVille environment variables");
    }

    super(user, pass);
  }

  @test async "[login]: Should log a user"() {
    await this.login();
    assert(this.cookie != null);
  }

  @test async "[isLogged]: Should check is user is correctly logged in"() {
    await this.login();
    const res = await this.isLogged();
    assert(res);
  }
}
