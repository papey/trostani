import { forgeScoreCSV } from "../../src/commands/tnmt";
import { suite, test } from "mocha-typescript";
import { assert } from "chai";

@suite("Tournament, Test Suite")
class TournamentTestSuite {
  @test
  "[forgeScoreCSV]: verify and inverse if needed, a score passed as argument"() {
    let score = forgeScoreCSV("2-1", 0, 1);

    assert.equal(score, "2-1");

    let inverted = forgeScoreCSV("2-1", 1, 0);

    assert.equal(inverted, "1-2");
  }
}
