// ms.ts testing file

// Imports
import { MS } from "../../src/builders/ms";
import { Deck } from "../../src/scry/mtg";
import { assert } from "chai";
import { base } from "../mtg.test";

// MS testing suite
describe("ManaStack, Builder Implementation Test Suite", function() {
  let ms: MS;

  before(function() {
    const u = process.env.MS_USER;
    const p = process.env.MS_PASSWORD;
    if (u == undefined || p == undefined) {
      this.skip();
    }
    ms = new MS(u, p);
  });

  it("[valid]: Check if a fresh session is valid", async function() {
    await ms.login();
    assert(ms.session.valid(), "Session is not valid");
  });

  it("[pushDeck]: Sould push an entire deck to remote builder", async function() {
    // Create deck
    const deck = new Deck(["Unit Test Deck", "casual", "This is a test"]);
    // Wait for login and parsing to complete
    await Promise.all([ms.login(), deck.parseDeck(base)]);
    // push the deck
    const bdm = await ms.pushDeck(deck);
    // created deck needs an id, ensure there is one
    assert(bdm.id != "", "Deck do not have any ID on the remote builder");

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await ms.deleteDeck(bdm.id);
  });

  it("[getDecks]: Sould get the entire decklist", async function() {
    // Create deck
    const deck = new Deck(["La Simplexité", "casual", "This is a test"]);
    // Wait for login and parsing to complete
    await Promise.all([ms.login(), deck.parseDeck(base)]);
    // Push deck
    const bdm = await ms.pushDeck(deck);

    // Check if pushed deck is in list
    const decks = await ms.getDecks();

    assert(decks.length > 0, "No deck found");
    assert(
      decks.find((d) => d.title == "La Simplexité"),
      "No deck named `Le Simplexité` found",
    );

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await ms.deleteDeck(bdm.id);
  });

  it("[search]: Sould search for a deck", async function() {
    // Create deck
    const deck = new Deck([
      "Choose Bandit For Mayor",
      "casual",
      "This is a test",
    ]);
    // Wait for login and parsing to complete
    await Promise.all([ms.login(), deck.parseDeck(base)]);
    // Push deck
    const bdm = await ms.pushDeck(deck);

    // Check if pushed deck is in list
    const res = await ms.search(["Bandit", "Mayor"]);

    assert(res.length >= 1, "Found multiple or no deck(s)");

    // Purge created deck if requested (usefull for CI)
    if (process.env.MS_PURGE) await ms.deleteDeck(bdm.id);
  });
});
