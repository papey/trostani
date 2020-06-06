// ms.ts testing file

// Imports
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

  @test
  async "[getDecks]: Sould get the entire decklist"() {
    // Create deck
    const deck = new Deck(["La Simplexité", "casual", "This is a test"]);
    // Wait for login and parsing to complete
    await Promise.all([this.login(), deck.parseDeck(base)]);
    // Push deck
    const bdm = await this.pushDeck(deck);

    // Check if pushed deck is in list
    const decks = await this.getDecks();

    assert(decks.length > 0, "No deck found");
    assert(
      decks.find((d) => d.title == "La Simplexité"),
      "No deck named `Le Simplexité` found"
    );

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await this.deleteDeck(bdm.id);
  }

  @test
  async "[search]: Sould search for a deck"() {
    // Create deck
    const deck = new Deck([
      "Choose Bandit For Mayor",
      "casual",
      "This is a test",
    ]);
    // Wait for login and parsing to complete
    await Promise.all([this.login(), deck.parseDeck(base)]);
    // Push deck
    const bdm = await this.pushDeck(deck);

    // Check if pushed deck is in list
    const res = await this.search(["Bandit", "Mayor"]);

    assert(res.length == 1, "Found multiple or no deck(s)");

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await this.deleteDeck(bdm.id);
  }
}
