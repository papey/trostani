// mtg.ts file, containing all stuff to represent cards ands decks

// Imports
import { Cards as ScryCards } from "scryfall-sdk";

// Classes
// Class used to represent a card
export class Card {
  private name!: string;
  private edition: string;
  private id: string;
  private times: string;

  // Constructor
  constructor(name: string, edition: string, id: string, times: string) {
    this.name = name;
    this.edition = edition.toLowerCase();
    this.id = id;
    this.times = times;
  }

  // Methods (public)
  // Getter for name
  public getName(): string {
    return this.name;
  }

  // Gett only the first part of a double card name
  public getFirstPartName(): string {
    return this.name.split("//")[0].trim();
  }

  // Getter for times
  public getTimes(): string {
    return this.times;
  }

  // Try to get a translation for card from scryfall
  public async translate() {
    try {
      let translate: any = await ScryCards.bySet(
        this.edition,
        parseInt(this.id)
      );

      // https://scryfall.com/docs/api, see Rate Limits and Good Citizenship section
      setTimeout(() => { }, 60);

      if (translate.name == null) {
        throw new TranslateError(
          `Error translating the following card ${
            this.name
          } (${this.edition.toUpperCase()}) ${this.id}`
        );
      }
      this.name = translate.name;
    } catch (error) {
      throw new TranslateError(error);
    }
  }
}

// Class metadada used to represent deck metada informations
export class Metadata {
  // Name of the deck
  public name: string;
  // Format (standard, modern, casual)
  public format: number = Formats["casual"];
  // Description of the deck
  public description: string = "";

  // Constructor
  constructor(metadatas: string[]) {
    // get all metadatas
    if (metadatas.length < 1) {
      throw new DeckBuildingError("Deck name is missing from metadata");
    }

    // meta[0] == Name,
    this.name = metadatas[0];

    // meta[1] == Format
    // If defined
    if (Formats[metadatas[1]] != undefined) {
      // Go for it
      this.format = Formats[metadatas[1]];
    }

    // meta[3] == small text description
    // Use it if defined, if not leavy empty
    this.description = metadatas[2] ? metadatas[2] : "";
  }
}

// Class used to represent a decklist
export class Deck {
  // Meta informations about the deck
  public metadata: Metadata;

  // Main cards
  protected main: Card[] = [];
  // Sideboard cards
  protected side: Card[] = [];

  // Construction of a deck from a Discord message
  constructor(metadata: string[]) {
    this.metadata = new Metadata(metadata);
  }

  // Methods (public)
  // Export to ManaStack format
  public exportToManaStack(): string {
    // Init a decklist containing nothing
    let decklist: string = "";

    // Check main length, needs to be a least > 0
    if (this.main.length > 0) {
      this.main.forEach(card => {
        let line: string = `${card.getTimes()} ${card.getFirstPartName()}\n`;
        decklist += line;
      });
    }

    // Check side board, add something only is something was found in sideboard
    if (this.side.length > 0) {
      decklist += "Sideboard: \n";
      this.side.forEach(card => {
        let line: string = `${card.getTimes()} ${card.getFirstPartName()}\n`;
        decklist += line;
      });
    }

    // Return decklist
    return decklist;
  }

  // Methods (protected)
  // Parse and add card to array
  protected async parseAddCardTo(
    line: string,
    part: Array<Card>,
    translate: boolean = false
  ) {
    // Try to parse card line
    let card = this.parseCard(line);
    // If ok, add to main deck
    if (card != null) {
      if (translate) {
        await card.translate();
      }
      part.push(card);
    }
  }

  // Parse main deck cards
  protected async parseMainDeck(m: string, translate: boolean = false) {
    // Ensure we are in the deck part
    let isDeck = false;

    // Array of cards in main deck
    this.main = [];

    // Split on carriage return
    let list = m.split("\n");

    // Start on the third line, skipping command and deck name (line 0) and the `Deck` line (line 1)
    for (let i = 1; i < list.length; i++) {
      // If an empty line is found, main deck is over
      if (list[i] == "Deck" && !isDeck) {
        // This is the deck part
        isDeck = true;
        // Just and iterate over deck cards
        continue;
      }

      // Is this deck a brawl deck ?
      if ((list[i] == "Commandant" || list[i] == "Commander") && !isDeck) {
        this.metadata.format = Formats["brawl"];
        // Make index pointing to commander lne
        i += 1;
        // Try parse and adding commander card
        await this.parseAddCardTo(list[i], this.main, translate);
        continue;
      }

      if (isDeck) {
        // If empty line, deck part is over
        if (list[i] == "") {
          break;
        }
        // Try parsing and adding deck cards
        await this.parseAddCardTo(list[i], this.main, translate);
      }
    }

    if (!this.checkCardsSum(60, this.main, ">=")) {
      throw new DeckBuildingError(
        "Error building deck, main part needs 60 cards, at least"
      );
    }
  }

  // Parse main deck cards
  protected async parseSideboard(m: string, translate: boolean = false) {
    // Are we working on a sideboard ?
    let isSide = false;

    // Array of cards in main deck
    this.side = [];

    // Split on carriage return
    let list = m.split("\n");

    // Start on the second line, command line does not need to be checked
    for (let i = 1; i < list.length; i++) {
      // If keyword Sideboard or Réserve is found, this is the sideboard part
      if ((list[i] == "Réserve" || list[i] == "Sideboard") && !isSide) {
        // Activate side part
        isSide = true;
        // Just iterate over sideboard cards
        continue;
      }

      // If we are in she side and the line is not empty
      if (isSide && list[i] != "") {
        // Try to parse card line
        await this.parseAddCardTo(list[i], this.side, translate);
      }
    }

    if (!this.checkCardsSum(15, this.side, "<=")) {
      throw new DeckBuildingError(
        "Error building deck, side part is limited to a maximum of 15 cards"
      );
    }
  }

  // Parse all parts of deck
  public async parseDeck(list: string, translate: boolean = false) {
    await this.parseMainDeck(list, translate);
    await this.parseSideboard(list, translate);
  }

  // Parse a card
  protected parseCard(c: string): Card | null {
    // Data example : 4 Nissa, celle qui fait trembler le monde (WAR) 169
    // Captured groups :
    // - 4
    // - Nissa, celle qui fait trembler le monde
    // - WAR
    // - 169
    const reg = new RegExp("(\\d+) (.*) \\(([A-Z,0-9]{3})\\) ([A-Z,0-9]+)");

    // Match cardline with regex
    let res = c.match(reg);

    // If it ok
    if (res != null) {
      // return Card object
      return new Card(res[2], res[3], res[4], res[1]);
    } else {
      // Create a new error and throw it if no match is found
      throw new ParsingError(
        "Error when parsing a line in decklist, please verify decklist"
      );
    }
  }

  // Check if a number of card is valid in a set of cards (main and side checks)
  protected checkCardsSum(limit: Number, cards: Card[], cmp: string): boolean {
    // Sum counter
    let sum = 0;

    // Fill the sum
    cards.forEach(e => {
      sum += parseInt(e.getTimes());
    });

    // Compare and check
    switch (cmp) {
      case "<=":
        if (sum <= limit) {
          return true;
        }
        break;
      case ">=":
        if (sum >= limit) {
          return true;
        }
      default:
        return false;
    }

    // Ensure false return
    return false;
  }
}

// Supported formats
export let Formats: { [f: string]: number } = {
  standard: 1,
  modern: 2,
  legacy: 3,
  vintage: 4,
  commander: 5,
  sealed: 6,
  tiny: 7,
  pauper: 8,
  casual: 9,
  brawl: 10
};

// Parsing Error
class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Parsing Error";
    this.message = message;
  }
}

// Error building deck
class DeckBuildingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error building deck";
    this.message = message;
  }
}

// Error translating card
class TranslateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error translating card on Scryfall";
    this.message = message;
  }
}
