// manastack.ts, containing file to handle all stuff related to manastack.com

// Imports
import request = require("request-promise");
import { BuilderDeckMetadata } from "./utils";

// Classes
// Cookie class used in ManaStack
export class Cookie {
  // Token used to auth
  public token!: string;
  // Expiration date of the current session
  private expiration!: Date;

  // Constructor
  constructor(token: string, date: string) {
    this.token = token;
    this.expiration = new Date(date);
  }

  // Ensure cookie is valid
  public valid(): boolean {
    let d = new Date();
    if (d > this.expiration) {
      return false;
    }
    return true;
  }
}

// Deck Class containing all needed stuff for Manasatack
class Deck {
  // Deck ID, on ManaStack
  id: string;
  name: string;

  // Constructor
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

// Manastack main class
export class Manastack {
  // User and password for manahack
  private username: string;
  private password: string;
  // User profile name
  private profile: string;

  // Session token
  private Cookie!: Cookie;

  // Routes
  private routes: { [route: string]: string } = {
    login: "api/user/login",
    deck_create: "api/deck/create",
    deck_edit: "api/deck/save",
    deck_import: "api/deck/import",
    decks_list: "api/decks/my_decks",
    deck_get: "api/deck?slug=new-deck-",
    delete_deck: "api/deck/delete",
    preview: "deck/preview",
    profile: "user",
  };

  // Manastack url
  private url: string;

  // Constructor
  constructor(
    username: string,
    password: string,
    url: string,
    profile: string
  ) {
    this.username = username;
    this.password = password;
    this.url = url;
    this.profile = profile;
  }

  // Methods (public)
  // Get profile url
  public getProfile() {
    return `${this.url}/${this.routes["profile"]}/${this.profile}`;
  }

  // Delete a deck
  public async deleteDeck(id: string) {
    await this.initialize();

    let res = await request
      .delete({
        url: `${this.url}/${this.routes["delete_deck"]}/${id}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`,
        },
        resolveWithFullResponse: true,
      })
      .catch(() => {
        throw new ManastackError("Error deleting deck on Manastack");
      });
  }

  // Create a new deck on ManaStack
  public async newDeck(
    name: string,
    description: string,
    format: number,
    list: string
  ): Promise<BuilderDeckMetadata> {
    // pass error to caller is somethings goes wrong
    try {
      // Ensure a valid token
      await this.initialize();
      // Create an empty deck
      let deck = await this.createDeck(name);
      // Add metadata to new deck
      await this.editMetadata(deck.id, name, description, format);
      // Import list
      await this.importDeck(deck.id, list);

      // return deck url
      return new BuilderDeckMetadata(
        `${this.url}/${this.routes["preview"]}/${deck.id}`,
        deck.name,
        deck.id
      );
    } catch (error) {
      throw error;
    }
  }

  // Getter for token
  public getToken(): string {
    return this.Cookie.token;
  }

  // Get decks, filter with keywords
  public async formatSearch(keywords: string): Promise<string[]> {
    // Final message containing search result
    let results: string[] = [];

    // Init Manastack instance instance
    this.initialize();

    // Call to ManaStack API to get all the decks
    let parsed = await this.getDecks();

    // If decks found
    parsed.decks.forEach((e: any) => {
      // Check for keywords absence or presence
      if (
        keywords == "" ||
        e.name.toLowerCase().includes(keywords.toLowerCase()) ||
        e.description.toLowerCase().includes(keywords.toLowerCase())
      ) {
        // Append message if deck pass filters
        results.push(
          `**${e.name}** - _${e.owner.username}_ - ${this.url}/deck/${e.slug}`
        );
      }
    });

    // Log some info
    console.info(
      `A search for "${keywords}" (empty for no keywords) was requested, found ${results.length} deck(s)`
    );

    // Return all the results
    return results;
  }

  // Methods (private)
  // Refresh cookie
  private async refresh() {
    // Regex data example :
    // 'PHPSESSID=jhe7o5b5pi2d1dh211714sbrk6; expires=Mon, 14-Oct-2019 16:30:18 GMT; Max-Age=604800; path=/'
    let regex = new RegExp(
      "PHPSESSID=(\\w+); expires=(.*); Max-Age=(\\d+); path=(.*)"
    );

    await request
      .post({
        headers: { "content-type": "application/json" },
        url: `${this.url}/${this.routes["login"]}`,
        body: `{ "username": "${this.username}", "password": "${this.password}" }`,
        resolveWithFullResponse: true,
      })
      .then((response) => {
        if (response.headers["set-cookie"]) {
          // Get cookie and parse PHPSESSID
          let result = response.headers["set-cookie"][0].match(regex);
          // Ensure result is not null
          try {
            this.Cookie = new Cookie(result[1], result[2]);
          } catch (_) {
            // Throw an error if null
            throw new ManastackError(
              "No PHPSESSID found in set-cookie directive"
            );
          }
        } else {
          // Throw an error is a problem occurs when trying to retrive the token
          throw new ManastackError("Error getting set-cookie from login");
        }
      })
      .catch((error) => {
        console.log(error);
      });
  }

  // Init stuff using async
  private async initialize() {
    if (!this.Cookie) {
      // If no cookie, create it
      await this.refresh();
    } else if (this.Cookie.valid()) {
      // If Cookie is set but expiration is over, refresh
      await this.refresh();
    }
  }

  // Call to new deck creation on ManaStack
  private async createDeck(name: string): Promise<Deck> {
    var deck!: Deck;

    await request
      .post({
        url: `${this.url}/${this.routes["deck_create"]}`,
        headers: { Cookie: `PHPSESSID=${this.Cookie.token}` },
        resolveWithFullResponse: true,
      })
      .then((response) => {
        let obj = JSON.parse(response.body);
        deck = new Deck(obj["id"], name);
      })
      .catch((error) => {
        throw new ManastackError("Error creating deck on ManaStack");
      });

    if (deck === undefined) {
      throw new ManastackError(
        "Error creating deck on ManaStack, deck is undefined"
      );
    } else {
      return deck;
    }
  }

  // Edit deck metadata
  private async editMetadata(
    id: string,
    name: string,
    desc: string,
    format: number
  ) {
    await request
      .put({
        url: `${this.url}/${this.routes["deck_edit"]}/${id}}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`,
        },
        resolveWithFullResponse: true,
        body: JSON.stringify({
          name: `${name}`,
          description: desc,
          private: false,
          format: { id: format },
          cards: [],
          groups: [],
        }),
      })
      .catch(() => {
        throw new ManastackError("Error updating deck metadata on ManaStack");
      });
  }

  // Import Decklist from a string
  private async importDeck(id: string, list: string) {
    await request
      .put({
        url: `${this.url}/${this.routes["deck_import"]}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`,
        },
        resolveWithFullResponse: true,
        body: JSON.stringify({
          deck: `${id}`,
          list: list,
        }),
      })
      .catch(() => {
        throw new ManastackError("Error importing decklist on ManaStack");
      });
  }

  // Get all the decks
  private async getDecks() {
    await this.initialize();

    let res = await request
      .get({
        url: `${this.url}/${this.routes["decks_list"]}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`,
        },
        resolveWithFullResponse: true,
      })
      .catch(() => {
        throw new ManastackError("Error getting decklists on ManaStack");
      });

    return JSON.parse(res.body)[0];
  }
}

// ManaStack specific error
class ManastackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error when interacting with Manastack";
    this.message = message;
  }
}
