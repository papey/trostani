// ms.ts contains the ManaStack Builder interface implementation

// Imports
import {
  Builder,
  User,
  Cookie,
  BuilderDeckMetadata,
  DeckResult,
} from "./builder";
import {Deck, Metadata} from "../scry/mtg";
import axios from "axios";

// ManaStack builder interface implementation
class MS implements Builder {
  name = "ManaStack";
  user: User;

  cookie: Cookie = null;

  url = "https://manastack.com";

  private routes: { [route: string]: string } = {
    login: "api/user/login",
    deck_create: "api/deck/create",
    deck_edit: "api/deck/save",
    deck_import: "api/deck/import",
    decks_list: "api/decks/my_decks",
    deck_delete: "api/deck/delete",
    preview: "deck/preview",
  };

  constructor(u: string, p: string) {
    // Create user
    this.user = new User(u, p);
  }

  // User login
  async login(): Promise<boolean> {
    // if there is no cookie or if cookie is invalid
    if (!this.cookie || !this.cookie.valid()) {
      // 'PHPSESSID=jhe7o5b5pi2d1dh211714sbrk6; expires=Mon, 14-Oct-2019 16:30:18 GMT; Max-Age=604800; path=/'
      const regex = new RegExp(
        "PHPSESSID=(\\w+); expires=(.*); Max-Age=(\\d+); path=(.*)"
      );

      await axios.post(`${this.url}/${this.routes["login"]}`, {
        username: this.user.name,
        password: this.user.password
      }, {
        headers: {'Content-Type': 'application/json'}
      }).then((resp) => {
        if (resp.headers["set-cookie"]) {
          try {
            let res = resp.headers["set-cookie"][0].match(regex);
            this.cookie = new Cookie(res[1], res[2]);
          } catch (error) {
            console.error(error);
            throw new ManastackError("Error when logging into remote builder");
          }
        }
      });
    }

    return true;
  }

  // Remove a deck from the remote builder
  async deleteDeck(identifier: string): Promise<string> {
    return axios.delete(`${this.url}/${this.routes["deck_delete"]}/${identifier}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `PHPSESSID=${this.cookie.value}`
      }
    }).then(() => identifier);
  }

  // Push a deck to the remote builder
  async pushDeck(d: Deck): Promise<BuilderDeckMetadata> {
    // Create emtpy deck
    const bdm = await this.newDeck(d.metadata);

    // Fill deck with medatadata and cards
    return this.editMedataData(bdm)
      .then((bdm) => this.importDeck(d, bdm))
      .catch(async (err) => {
        // if something fails, try delete the non complete deck
        await this.deleteDeck(bdm.id);
        // Return the error
        return Promise.reject(err);
      });
  }

  // Get all the decks from remote builder
  async getDecks(): Promise<DeckResult[]> {
    // get all the deck
    return axios.get(`${this.url}/${this.routes["decks_list"]}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `PHPSESSID=${this.cookie.value}`
      }
    }) // then map them all to a DeckResult object
      .then(({data}) => {
        return data[0]["decks"].map(
          (d: { slug: any; owner: { username: string; }; name: string; }) =>
            new DeckResult(
              `${this.url}/deck/${d.slug}`,
              d.owner.username,
              d.name
            )
        );
      })
      .catch((error) => Promise.reject(new ManastackError(error)));
  }

  // Search for a specific deck
  async search(keywords: string[]): Promise<DeckResult[]> {
    // Get all decks
    return this.getDecks().then((res) => {
      // Then filter
      return res.filter((d) => {
        // Search over each keywords
        for (const kw of keywords) {
          // If a keyword if found, return true, deck is filtered
          if (d.title.toLowerCase().includes(kw.toLowerCase())) return true;
        }
        // If deck title contains no kw, return false
        return false;
      });
    });
  }

  // format a deck into an importable builder string
  format(d: Deck): string {
    // main deck
    let formated = d.getMain().reduce((acc, c) => `${acc}${c.export()}\n`, "");

    // Side
    if (d.getCompanion() || d.getSide().length > 0 || d.getCommander()) {
      formated += "Sideboard:\n";
      // Companion is in the sideboard
      if (d.getCompanion()) {
        formated += `${d.getCompanion().export()}\n`;
      }
      // Since ManaStack can't display commander properly in Brawl Decks, it goes into the sideboard
      if (d.getCommander()) {
        formated += `${d.getCommander().export()}\n`;
      }
      // Regular Sideboard
      if (d.getSide().length > 0) {
        formated = d
          .getSide()
          .reduce((acc, c) => `${acc}${c.export()}\n`, formated);
      }
    }

    return formated;
  }

  // Create a new deck
  protected async newDeck(dm: Metadata): Promise<BuilderDeckMetadata> {
    // @ts-ignore
    return axios.post(`${this.url}/${this.routes["deck_create"]}`, null, {
      headers: {
        'Cookie': `PHPSESSID=${this.cookie.value}`
      }
    }).then(({data}) => {
      return new BuilderDeckMetadata(
        data["id"],
        `${this.url}/${this.routes["preview"]}/${data["id"]}}`,
        dm
      );
    })
      .catch((err) => {
        Promise.reject(new ManastackError(err));
      });
  }

  // Edit created deck Metadata
  protected async editMedataData(
    bdm: BuilderDeckMetadata
  ): Promise<BuilderDeckMetadata> {

    return axios.put(`${this.url}/${this.routes["deck_edit"]}/${bdm.id}`, {
      name: bdm.dm.name,
      description: bdm.dm.description,
      private: false,
      format: {id: Formats[bdm.dm.format]},
      cards: [],
      groups: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `PHPSESSID=${this.cookie.value}`
      }
    })
      .then(() => bdm)
      .catch(err => Promise.reject(new ManastackError(err)));
  }

  protected async importDeck(
    d: Deck,
    bdm: BuilderDeckMetadata
  ): Promise<BuilderDeckMetadata> {

    return axios.put(`${this.url}/${this.routes["deck_import"]}`, {
      deck: bdm.id,
      list: this.format(d),
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `PHPSESSID=${this.cookie.value}`
      }
    })
      .then(() => bdm)
      .catch(err => Promise.reject(new ManastackError(err)));
  }
}

// ManaStack, supported formats
const Formats: { [f: string]: number } = {
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

// ManaStack specific error
class ManastackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error when interacting with Manastack";
  }
}

// List of exported elements from this module
export {MS};
