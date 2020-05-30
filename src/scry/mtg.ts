// mtg.ts file, containing all stuff to represent cards ands decks

// Imports
import { Cards as ScryCards, CardIdentifier } from "scryfall-sdk";

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
    this.edition = fixSet(edition).toLowerCase();
    this.id = id;
    this.times = times;
  }

  // Methods (public)
  // Getter for name
  public getName(): string {
    return this.name;
  }

  // Setter for name (used for translation purpose)
  public setName(name: string) {
    this.name = name;
  }

  // Getter for id
  public getID(): string {
    return this.id;
  }

  // Get only the first part of a double card name
  public getFirstPartName(): string {
    return this.name.split("//")[0].trim();
  }

  // Getter for times
  public getTimes(): string {
    return this.times;
  }

  // Get edition
  public getEdition(): string {
    return this.edition.toUpperCase();
  }

  // Export card to string
  public export(): string {
    return `${this.getTimes()} ${this.getFirstPartName()} (${this.getEdition()})`;
  }

  // Try to get a translation for card from scryfall
  public async translate() {
    try {
      let translate: any = await ScryCards.bySet(
        this.edition,
        parseInt(this.id)
      );

      // https://scryfall.com/docs/api, see Rate Limits and Good Citizenship section
      setTimeout(() => {}, 60);

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

  // Companion card
  protected companion: Card = null;
  // Commander card
  protected commander: Card = null;

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

    // Commander is in the main deck
    if (this.commander) {
      decklist = `${this.commander.export()}\n`;
    }

    if (this.main.length > 0) {
      this.main.forEach((card) => {
        decklist += `${card.export()}\n`;
      });
    }

    if (this.side.length > 0 || this.companion) {
      decklist += "Sideboard: \n";
      // companion goes in sideboard
      if (this.companion) {
        decklist += `${this.companion.export()}\n`;
      }
      this.side.forEach((card) => {
        decklist += `${card.export()}\n`;
      });
    }

    // Return decklist
    return decklist;
  }

  // Callback used to reduce a deck part to it's sum of cards
  protected sumer(acc: number, card: Card) {
    return acc + parseInt(card.getTimes());
  }

  // Parse all parts of deck
  public async parseDeck(list: string, translate: boolean = false) {
    // split decklist into parts, ensure all possible line returns are handled
    const parts = list
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\n{2,}/g);

    // check length
    if (parts.length < 1) {
      throw new DeckBuildingError(
        "Error when building the deck, can't find any parts (main, sideboard, commander or companion) in this decklist"
      );
    }

    // For each part fill the deck object
    for (const subpart of parts) {
      const lines = subpart.split("\n").filter((l) => l != "");
      if (lines.length < 2) {
        throw new DeckBuildingError(
          `Error when building the deck, subpart named ${lines[0]} is empty`
        );
      }
      // Deck part
      if (Translations["deck"].includes(lines[0].toLowerCase())) {
        // parse all cards in deck part (slice first line containing part name)
        this.main = lines.slice(1).map((line) => this.parseCard(line));
      } // Sideboard part
      else if (Translations["sideboard"].includes(lines[0].toLowerCase())) {
        // parse all cards in sideboard part (slice first line containing "Sideboard")
        this.side = lines.slice(1).map((line) => this.parseCard(line));
      } // Commander part
      else if (Translations["commander"].includes(lines[0].toLowerCase())) {
        // parse commander card
        if (lines.length > 2) {
          throw new DeckBuildingError(
            "Error when building the deck, Commander part contains too much cards"
          );
        }
        this.commander = this.parseCard(lines[1]);
        // set format to brawl since it's the only one with a commander supported by MTGA
        this.metadata.format = Formats["brawl"];
      } // Companion part
      else if (Translations["companion"].includes(lines[0].toLowerCase())) {
        // parse companion card
        if (lines.length > 2) {
          throw new DeckBuildingError(
            "Error when building the deck, Companion part contains too much cards"
          );
        }
        this.companion = this.parseCard(lines[1]);
      } else {
        console.warn(`Part of kind ${lines[0]} is not supported`);
      }
    }
  }

  // Verify basic constraints
  private constraints() {
    // companion constraints
    if (this.companion) {
      if (parseInt(this.companion.getTimes()) != 1) {
        throw new DeckBuildingError(`A deck can only contains one companion`);
      }
    }

    // commander constraints
    if (this.commander) {
      if (parseInt(this.commander.getTimes()) != 1) {
        throw new DeckBuildingError(`A deck can only contains one commander`);
      }
    }

    // main deck constraints
    if (this.main.reduce<number>(this.sumer, 0) < 40) {
      throw new DeckBuildingError(`Main deck is at least 40 cards`);
    }

    // side deck constaints
    if (this.side.reduce<number>(this.sumer, 0) > 30) {
      throw new DeckBuildingError(`Side deck is limited to 30 cards`);
    }
  }

  // Translate an entire deck
  protected async translateDeck() {
    // translate companion
    if (this.companion != null) {
      await this.companion.translate();
    }

    // translate commander
    if (this.commander != null) {
      await this.commander.translate();
    }

    // translate deck
    await this.translator(...this.main);
    // translate sideboard
    await this.translator(...this.side);
  }

  // Build a deck
  public async buildDeck(list: string, translate: boolean = false) {
    // parse deck
    await this.parseDeck(list);

    // ensure constraints
    this.constraints();

    // translate deck if requested
    if (translate) {
      await this.translateDeck();
    }
  }

  // Take an entire deck part and translate it
  protected async translator(...parts: Card[]) {
    // prepare collection
    const collection = parts.map((c) =>
      CardIdentifier.bySet(c.getEdition(), c.getID())
    );

    // get translated data collection
    const translated = await ScryCards.collection(...collection).waitForAll();

    // for each card replace original name with it's en translation
    for (let i = 0; i < parts.length; i++) {
      parts[i].setName(translated[i].name);
    }
  }

  // Parse a card
  protected parseCard(c: string): Card {
    // Data example : 4 Nissa, celle qui fait trembler le monde (WAR) 169
    // Captured groups :
    // - 4
    // - Nissa, celle qui fait trembler le monde
    // - WAR
    // - 169
    const reg = new RegExp("(\\d+) (.*) \\(([A-Z,0-9]{3})\\) ([A-Z,0-9]+)");

    // Match cardline with regex
    let res = c.match(reg);

    // If it's ok
    if (res != null) {
      // return Card object
      return new Card(res[2], res[3], res[4], res[1]);
    } else {
      // Create a new error and throw it if no match is found
      throw new ParsingError(
        `Error when parsing line ${c} in decklist, please verify decklist`
      );
    }
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
  brawl: 10,
};

// Translations of all deck parts
let Translations: { [f: string]: string[] } = {
  // en, fr, pt, it, de, es
  deck: ["deck", "mazzo", "mazo"],
  sideboard: ["sideboard", "réserve", "reserva", "sideboard"],
  commander: ["commander", "commandant", "comandante", "kommandeur"],
  companion: [
    "companion",
    "compagnon",
    "companheiro",
    "compagno",
    "gefährte",
    "compañero",
  ],
};

// fixSet is used to fix differences between MTGA set names and real world
function fixSet(set: string): string {
  switch (set) {
    case "DAR":
      return "DOM";

    default:
      return set;
  }
}

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
