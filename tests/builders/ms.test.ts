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
    // Create deck
    const deck = new Deck(["Unit Test Deck", "casual", "This is a test"]);
    // Wait for login and parsing to complete
    await Promise.all([this.login(), deck.parseDeck(base)]);
    // push the deck
    const bdm = await this.pushDeck(deck);
    // created deck needs an id, ensure there is one
    assert(bdm.id != "", "Deck do not have any ID on the remote builder");

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await this.deleteDeck(bdm.id);
  }
}
