// mtg.ts file, containing all stuff to represent cards ands decks

// Imports
import {
  ParsingError,
  DeckBuildingError,
  DontMessWithMeError,
  TranslateError
} from "./errors";
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
      setTimeout(() => {}, 100);

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
  public format: number;
  // BO1 or BO3 ?
  public bo: string;
  // Description of the deck
  public description: string;

  // Constructor
  constructor(message: string, prefix: string) {
    // get all metadatas
    var meta = this.parseDeckMetadata(message, prefix);
    if (meta.length < 1) {
      throw new DeckBuildingError("Deck name is missing from metadata");
    }

    // meta[0] == Name,
    this.name = meta[0];

    // meta[1] == Format
    // If defined
    if (Formats[meta[1]] != undefined) {
      // Go for it
      this.format = Formats[meta[1]];
    } else {
      // If not defined, just use casual as default
      this.format = Formats["casual"];
    }

    // meta[2] == BO1 or BO3
    // Use it if defined, if not leave empty
    this.bo = meta[2] ? meta[2] : "";
    // meta[3] == small text description
    // Use it if defined, if not leavy empty
    this.description = meta[3] ? meta[3] : "";
  }

  // Methods (protected)
  // From command passed in Discord message, get metadata
  protected parseDeckMetadata(m: string, p: string): string[] {
    // Remove command
    let list = m.replace(`${p}push`, "");

    // Get metadata from the first line
    let metas = list
      .split("\n")[0]
      .replace(":", "")
      .trim();

    // Metadata fields are separated using //
    let data = metas.split("//");

    for (let i = 0; i < data.length; i++) {
      data[i] = data[i].trimLeft().trimRight();
    }

    // Return it
    return data;
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
  constructor(message: string, prefix: string) {
    this.metadata = new Metadata(message, prefix);
  }

  // Methods (public)
  // Export to ManaStack format
  public exportToManaStack(): string {
    // Init a decklist containing nothing
    let decklist: string = "";

    // Check main length, needs to be a least > 0
    if (this.main.length > 0) {
      if (this.checkCardsSum(60, this.main, ">=")) {
        this.main.forEach(card => {
          let line: string = `${card.getTimes()} ${card.getFirstPartName()}\n`;
          decklist += line;
        });
      } else {
        throw new DeckBuildingError(
          "Error building deck, main part needs 60 cards, at least"
        );
      }
    }

    // Check side board, add something only is something was found in sideboard
    if (this.side.length > 0) {
      if (this.checkCardsSum(15, this.side, "<=")) {
        decklist += "Sideboard: \n";
        this.side.forEach(card => {
          let line: string = `${card.getTimes()} ${card.getFirstPartName()}\n`;
          decklist += line;
        });
      } else {
        throw new DeckBuildingError(
          "Error building deck, side part is limited to a maximum of 15 cards"
        );
      }
    }

    // Return decklist
    return decklist;
  }

  // Methods (protected)
  // Parse main deck cards
  protected async parseMainDeck(m: string, translate: boolean = false) {
    // Array of cards in main deck
    this.main = [];

    // Split on carriage return
    let list = m.split("\n");

    // Sumup, just to be sure
    let sum = 0;

    // Start on the second line, skipping command and deck name
    for (let i = 1; i < list.length; i++) {
      // If an empty line is found, main deck is over
      if (list[i] == "") {
        break;
      }
      // Try to parse card line
      let card = this.parseCard(list[i]);
      // If ok, add to main deck
      if (card != null) {
        if (translate) {
          await card.translate();
        }
        this.main.push(card);
        try {
          sum += parseInt(card.getTimes());
        } catch (error) {
          throw new DontMessWithMeError(
            "Dont mess with we and verify your list"
          );
        }
      }
    }

    if (sum < 60) {
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

    // Sumup, just to be sure
    let sum = 0;

    // Start on the second line, skipping command and deck name
    for (let i = 1; i < list.length; i++) {
      // If an empty line is found, main deck is over
      if (list[i] == "" && !isSide) {
        isSide = true;
      }

      // If where in she side and the line is not empty
      if (isSide && list[i] != "") {
        // Try to parse card line
        let card = this.parseCard(list[i]);
        if (card != null) {
          if (translate) {
            await card.translate();
          }
          try {
            sum += parseInt(card.getTimes());
          } catch (error) {
            throw new DontMessWithMeError(
              "Dont mess with we and verify your list"
            );
          }
          this.side.push(card);
        }
      }
    }

    if (sum > 15) {
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
    const reg = new RegExp("(\\d) (.*) \\(([A-Z,0-9]{3})\\) (\\d+)");

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

  // Check is a number of card is valid in a set of caards (main and side checks)
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
