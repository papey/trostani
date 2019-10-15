// mtg.ts testing file

// Imports
import { Deck, Metadata, Card } from "../src/mtg";
import { suite, test } from "mocha-typescript";
import { assert } from "chai";

// MTG, Card class test suite
@suite("MTG, Card Test Suite")
class MTGCardTestSuite extends Card {
  constructor() {
    super("Géant craque-os // Piétineur", "eld", "115", "1");
  }

  @test async "[translate]: Sould translate a card"() {
    var card = new MTGCardTestSuite();

    await card.translate();

    assert.equal(card.getName(), "Bonecrusher Giant // Stomp");
    assert.equal(card.getFirstPartName(), "Bonecrusher Giant");
  }
}

// MTG, Metadata class test suite
@suite("MTG, Metadata Test Suite")
class MTGMetadataTestSuite extends Metadata {
  constructor() {
    super("!push Temur Elementals // standard // BO1 // Temur FTW !", "!");
  }

  @test "[parseDeckMetadata]: Should return full deck metadata"() {
    let res = this.parseDeckMetadata(
      "!push Temur Elementals // standard // BO1 // Temur FTW !",
      "!"
    );

    assert.equal(res[0], "Temur Elementals");
    assert.equal(res[1], "standard");
    assert.equal(res[2], "BO1");
    assert.equal(res[3], "Temur FTW !");
  }

  @test "[parseDeckMetadata]: Should return partial deck metadata"() {
    let res = this.parseDeckMetadata("!push Temur Elementals // standard", "!");

    assert.equal(res[0], "Temur Elementals");
    assert.equal(res[1], "standard");
    assert.equal(res[2], undefined);
  }
}

// MTG, Deck test suite
@suite("MTG, Deck Test Suite")
class MTGDeckTestSuite extends Deck {
  constructor(data: string = pushData) {
    super(data, "!");
  }

  @test
  async "[exportToManastack]: Should return a list formatted for ManaStack"() {
    await this.parseDeck(pushData);
    let list = this.exportToManaStack();

    let splited = list.split("\n");

    assert.equal(splited[0], "4 Steam Vents");
    assert.equal(splited[23], "3 Fabled Passage");
    assert.equal(splited[24], "Sideboard: ");
    assert.equal(splited[25], "1 Jace, Wielder of Mysteries");
    assert.equal(splited[27], "1 Tamiyo, Collector of Tales");
    assert.equal(splited[29], "");
    assert.equal(splited.length, 30);
  }

  @test
  async "[parseMainDeck]: Should fill a list of cards for maindeck part inside the deck object"() {
    await this.parseMainDeck(pushData);

    assert.equal(this.main.length, 24);
    assert.equal(this.main[0].getName(), "Steam Vents");
    assert.equal(this.main[23].getName(), "Fabled Passage");
    assert.equal(this.main[23].getTimes(), "3");
  }

  @test
  async "[parseSideboard]: Sould fill a list of cards for sideboard part inside the deck object"() {
    await this.parseSideboard(pushData);

    assert.equal(this.side[0].getName(), "Jace, Wielder of Mysteries");
    assert.equal(this.side[2].getTimes(), "1");
  }

  @test "[parseCard]: Should return a card object based on an exported line"() {
    let card = this.parseCard("2 Cavalier of Thorns (M20) 162");

    if (card != null) {
      assert.equal(card.getName(), "Cavalier of Thorns");
      assert.equal(card.getTimes(), "2");
    } else {
      throw Error("Outch, card is null");
    }
  }

  @test async "[checkCardSum]: Should return true or false if valid or not"() {
    await this.parseDeck(pushData);

    assert.equal(this.checkCardsSum(60, this.main, ">="), true);
    assert.equal(this.checkCardsSum(15, this.side, "<="), true);
  }

  @test async "[parseDeck+translate]: Sould parse a deck, with translation"() {
    let deck = new MTGDeckTestSuite();

    await deck.parseDeck(pushTranslateData, true);

    assert.equal(deck.main[0].getName(), "Island");
  }
}

let pushData = `!push Temur Elementals // standard // BO3 // Temur FTW ! :
4 Steam Vents (GRN) 257
4 Breeding Pool (RNA) 246
4 Stomping Ground (RNA) 259
1 Jace, Wielder of Mysteries (WAR) 54
2 Paradise Druid (WAR) 171
4 Neoform (WAR) 206
2 Cloudkin Seer (M20) 54
3 Scampering Scorcher (M20) 158
4 Shock (M20) 160
2 Thunderkin Awakener (M20) 162
2 Cavalier of Thorns (M20) 167
4 Leafkin Druid (M20) 178
1 Overgrowth Elemental (M20) 187
4 Omnath, Locus of the Roil (M20) 216
4 Risen Reef (M20) 217
1 Temple of Mystery (M20) 255
2 Island (ANA) 57
1 Mountain (ANA) 59
2 Forest (ANA) 60
3 The Great Henge (ELD) 161
1 Castle Embereth (ELD) 239
1 Castle Garenbrig (ELD) 240
1 Castle Vantress (ELD) 242
3 Fabled Passage (ELD) 244

1 Jace, Wielder of Mysteries (WAR) 54
3 Nissa, Who Shakes the World (WAR) 169
1 Tamiyo, Collector of Tales (WAR) 220
3 Chandra, Awakened Inferno (M20) 127`;

let pushTranslateData = `!push Bant V6 // standard // BO3 // Bant ! :
3 Île (ELD) 257
2 Téfeiri, effileur de temps (WAR) 221
1 Plaine (ELD) 253
2 Passage merveilleux (ELD) 244
4 Oko, voleur de couronnes (ELD) 197
4 Oie d'or (ELD) 160
4 Nissa, celle qui fait trembler le monde (WAR) 169
4 Krasis hydroïde (RNA) 183
4 Jardin du temple (GRN) 258
3 Il était une fois... (ELD) 169
6 Forêt (ELD) 269
4 Fontaine sacrée (RNA) 251
4 Druidesse de paradis (WAR) 171
4 Bête de Quête (ELD) 171
4 Bassin d'élevage (RNA) 246
3 Adjointe aux détentions (RNA) 165
3 Méchant loup (ELD) 181
1 Pixie de Marafeuille (ELD) 196

1 Cératops changeant (M20) 194
2 Tolsimir, ami des loups (WAR) 224
2 Décret fervent (M20) 13
1 Ashiok, broyeur de rêves (WAR) 228
1 Cercueil de verre (ELD) 15
3 Botte dédaigneuse (GRN) 37
2 Rafale d'Éther (M20) 42
1 Adjointe aux détentions (RNA) 165
1 Téfeiri, effileur de temps (WAR) 221
1 Emprunteur intrépide (ELD) 39`;
