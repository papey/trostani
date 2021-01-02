// ms.ts testing file

// Imports
import { Archidekt } from "../../src/builders/archidekt";
import { Metadata } from "../../src/scry/mtg";
import { suite, test } from "@testdeck/mocha";
import { assert } from "chai";
import { base } from "../mtg.test";
import { Deck } from "../../src/scry/mtg";

// MS testing suite
@suite("Archidekt, Builder Implementation Test Suite")
class ArchidektTestSuite extends Archidekt {
  constructor() {
    const u = process.env.AD_USER;
    const p = process.env.AD_PASSWORD;
    if (u == undefined || p == undefined) {
      throw new Error("Missing Archidekt environment variables");
    }

    super(u, p);
  }

  @test async "[login]: Get a fresh JWT token and extra info"() {
    await this.login();
    assert.isNotNull(this.jwt.getValue());
    assert.isNotNull(this.jwt.getRefresh());
    assert.equal(this.rootFolder, 104592);
  }

  @test async "[mkdir]: Create a directory"() {
    await this.login();
    await this.mkdir("Unit Test Directory");
  }

  @test async "[ls]: List directories"() {
    await this.login();
    const folders = await this.ls();
    assert.isTrue(
      folders.filter((value) => value.name == "Unit Test Directory").length == 1
    );
  }

  @test async "[rmdir]: Remove a directory"() {
    await this.login();
    const folder = await this.find("Unit Test Directory");
    await this.rm(folder.id.toString(), "folder");
  }

  @test async "[newDeck]: Should create a new empty deck"() {
    const deck = new Metadata([
      "Unit Test Deck (new deck)",
      "casual",
      "This is a test",
    ]);
    await this.login();
    const fromBuilder = await this.newDeck(deck);
    assert.isNotNull(fromBuilder.id);
    if (process.env.AD_PURGE) await this.deleteDeck(fromBuilder.id);
  }

  @test async "[pushDeck]: Should create and push a new deck"() {
    const deck = new Deck([
      "Unit Test Deck (push deck)",
      "casual",
      "This is a test",
    ]);
    await Promise.all([this.login(), deck.parseDeck(base)]);

    const fromBuilder = await this.pushDeck(deck);
    assert.isNotNull(fromBuilder.id);

    if (process.env.AD_PURGE) await this.deleteDeck(fromBuilder.id);
  }

  @test async "[getDecks]: Should get the current list of decks"() {
    const deck = new Deck(["La Simplexité", "casual", "This is a test"]);
    await Promise.all([this.login(), deck.parseDeck(base)]);
    const fromBuilder = await this.pushDeck(deck);

    const decks = await this.getDecks();

    assert(decks.length > 0, "No deck found");
    assert(
      decks.find((d) => d.title == "La Simplexité"),
      "No deck named `Le Simplexité` found"
    );

    if (process.env.AD_PURGE) await this.deleteDeck(fromBuilder.id);
  }

  @test async "[search]: Should search for a deck"() {
    const deck = new Deck([
      "Choose Bandit For Mayor",
      "casual",
      "This is a test",
    ]);
    await Promise.all([this.login(), deck.parseDeck(base)]);
    const fromBuilder = await this.pushDeck(deck);

    const res = await this.search(["Bandit", "Mayor"]);

    assert(res.length >= 1, "Found multiple or no deck(s)");

    if (process.env.MS_PURGE) await this.deleteDeck(fromBuilder.id);
  }
}
