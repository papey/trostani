// manastack.ts, containing file to handle all stuff related to manastack.com

// Imports
import request = require("request-promise");
import { NoSetCookie, RegexCookieError, ManaStackDeckError } from "./errors";

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

  // Constructor
  constructor(id: string) {
    this.id = id;
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
    deck_create: "api/decks/create",
    deck_edit: "api/deck/save",
    deck_import: "api/deck/import",
    decks_list: "api/decks/my_decks",
    deck_get: "api/deck?slug=new-deck-",
    profile: "user"
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

  // Create a new deck on ManaStack
  public async newDeck(
    name: string,
    bo: string,
    description: string,
    format: number,
    list: string
  ): Promise<string> {
    var message = "";

    // Ensure a vlid token
    await this.initialize();
    // Create an empty deck
    let deck = await this.createDeck();
    // Add metadata to new deck
    await this.editMetadata(deck.id, name, bo, description, format);
    // Import list
    await this.importDeck(deck.id, list)
      .then(() => {
        message = `Decklist : ${name} created ! Go check it at ${this.url}/deck/new-deck-${deck.id}`;
      })
      .catch(error => {
        console.log(error);
        message = error.message;
      });

    // Log success or failure
    console.info(message);

    // Return message, then send it with Discord client
    return message;
  }

  // Getter for token
  public getToken(): string {
    return this.Cookie.token;
  }

  // Get decks, filter with keywords
  public async formatSearch(keywords: string): Promise<string> {
    // Final message containing search result
    let message = "";

    // Counter of number of items found
    let found = 0;

    // Init Manastack instance instance
    this.initialize();

    // Call to ManaStack API to get all the decks
    let resp = await this.getDecks();

    // Extract json returned by ManaStack
    let parsed = JSON.parse(resp.body)[0];

    // If no deck is found
    if (parsed.decks.length <= 0) {
      message = "**No deck found**";
    } else {
      // If decks found
      parsed.decks.forEach((e: any) => {
        // Check for keywords absence or presence
        if (
          keywords == "" ||
          e.name.toLowerCase().includes(keywords.toLowerCase()) ||
          e.description.toLowerCase().includes(keywords.toLowerCase())
        ) {
          // Append message if deck pass filters
          message += `**${e.name}** - _${e.owner.username}_ - ${this.url}/deck/${e.slug}\n`;
          found += 1;
        }
      });

      // If no decks found using keywords
      if (found <= 0) {
        message = `No deck found for keyword(s): _${keywords}_`;
      } else {
        // Else, prepend message with total results
        message = `Found ${found} deck(s):\n` + message;
      }
    }

    // Log some info
    console.info(
      `A search for "${keywords}" (empty for no keywords) was requested, found ${found} deck(s)`
    );

    // Return the formated message
    return message;
  }

  // Methods (private)
  // Refresh cookie
  private async refresh() {
    // Regex data example :
    // 'PHPSESSID=jhe7o5b5pi2d1dh211714sbrk6; expires=Mon, 14-Oct-2019 16:30:18 GMT; Max-Age=604800; path=/'
    let regex = new RegExp("PHPSESSID=(\\w+); path=(.*)");

    await request
      .post({
        headers: { "content-type": "application/json" },
        url: `${this.url}/${this.routes["login"]}`,
        body: `{ "username": "${this.username}", "password": "${this.password}" }`,
        resolveWithFullResponse: true
      })
      .then(response => {
        if (response.headers["set-cookie"]) {
          // Get cookie and parse PHPSESSID
          let result = response.headers["set-cookie"][0].match(regex);
          // Ensure result is not null
          try {
            this.Cookie = new Cookie(result[1], result[2]);
          } catch (_) {
            // Throw an error if null
            throw new RegexCookieError(
              "No PHPSESSID found in set-cookie directive"
            );
          }
        } else {
          // Throw an error is a problem occurs when trying to retrive the token
          throw new NoSetCookie("Error getting set-cookie from login");
        }
      })
      .catch(error => {
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
  private async createDeck(): Promise<Deck> {
    var deck!: Deck;

    await request
      .post({
        url: `${this.url}/${this.routes["deck_create"]}`,
        headers: { Cookie: `PHPSESSID=${this.Cookie.token}` },
        resolveWithFullResponse: true
      })
      .then(response => {
        let obj = JSON.parse(response.body);
        deck = new Deck(obj["id"]);
      })
      .catch(error => {
        throw new ManaStackDeckError("Error creating deck on ManaStack");
      });

    if (deck === undefined) {
      throw new ManaStackDeckError("Error creating deck on ManaStack");
    } else {
      return deck;
    }
  }

  // Edit deck metadata
  private async editMetadata(
    id: string,
    name: string,
    bo: string,
    desc: string,
    format: number
  ) {
    await request
      .post({
        url: `${this.url}/${this.routes["deck_edit"]}/${id}}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`
        },
        resolveWithFullResponse: true,
        body: JSON.stringify({
          name: `${name}`,
          description: desc,
          private: false,
          format: { id: format },
          cards: [],
          groups: []
        })
      })
      .catch(() => {
        throw new ManaStackDeckError(
          "Error updating deck metadata on ManaStack"
        );
      });
  }

  // Import Decklist from a string
  private async importDeck(id: string, list: string) {
    await request
      .post({
        url: `${this.url}/${this.routes["deck_import"]}`,
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.Cookie.token}`
        },
        resolveWithFullResponse: true,
        body: JSON.stringify({
          deck: `${id}`,
          list: list
        })
      })
      .catch(() => {
        throw new ManaStackDeckError("Error importing decklist on ManaStack");
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
          Cookie: `PHPSESSID=${this.Cookie.token}`
        },
        resolveWithFullResponse: true
      })
      .catch(() => {
        throw new ManaStackDeckError("Error getting decklists on ManaStack");
      });

    return res;
  }
}
