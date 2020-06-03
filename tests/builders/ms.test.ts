// ms.ts testing file

import { MS } from "../../src/builders/ms";
import { suite, test } from "@testdeck/mocha";
import { assert } from "chai";

// MS testing suite
@suite("ManaStack, Builder Implementation Test Suite")
class MSTestSuite extends MS {
  constructor() {
    const u = process.env.MS_USER;
    const p = process.env.MS_PASSWORD;
    if (u == undefined || p == undefined) {
      throw new Error("Missing ManaStack environment variables");
    }

    super(u, p);
  }

  @test async "[valid]: Check if a fresh cookie is valid"() {
    await this.login();
    assert(this.cookie.valid(), "Cookie is not valid");
  }
}
