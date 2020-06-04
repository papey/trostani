// ms.ts testing file

import { MS } from "../../src/builders/ms";
import { Deck } from "../../src/scry/mtg";
import { suite, test } from "@testdeck/mocha";
import { assert } from "chai";
import { base } from "../mtg.test";

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

  @test async "[pushDeck]: Sould push an entire deck to remote builder"() {
    const deck = new Deck(["Unit Test Deck", "casual", "This is a test"]);
    await Promise.all([this.login(), deck.parseDeck(base)]);
    const bdm = await this.pushDeck(deck);
    assert(bdm.id != "", "Deck do not have any ID on the remote builder");
  }
}
