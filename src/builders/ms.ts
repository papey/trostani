// ms.ts contains the ManaStack Builder interface implementation

// Imports
import { Builder, User, Cookie, BuilderDeckMetadata } from "./builder";
import { Deck, Metadata } from "../scry/mtg";
const got = require("got");

export class MS implements Builder {
  name = "ManaStack";
  user: User;

  cookie: Cookie = null;

  url = "https://manastack.com";

  private routes: { [route: string]: string } = {
    login: "api/user/login",
    deck_create: "api/deck/create",
    deck_edit: "api/deck/save",
    deck_import: "api/deck/import",
    deck_delete: "api/deck/delete",
    preview: "deck/preview",
  };

  constructor(u: string, p: string) {
    // Create user
    this.user = new User(u, p);
  }

  // User login
  async login() {
    // if there is no cookie or if cookie is invalid
    if (!this.cookie || !this.cookie.valid()) {
      // 'PHPSESSID=jhe7o5b5pi2d1dh211714sbrk6; expires=Mon, 14-Oct-2019 16:30:18 GMT; Max-Age=604800; path=/'
      const regex = new RegExp(
        "PHPSESSID=(\\w+); expires=(.*); Max-Age=(\\d+); path=(.*)"
      );

      await got
        .post(`${this.url}/${this.routes["login"]}`, {
          headers: { "content-type": "application/json" },
          body: `{ "username": "${this.user.name}", "password": "${this.user.password}" }`,
        })
        .then((resp) => {
          if (resp.headers["set-cookie"]) {
            try {
              let res = resp.headers["set-cookie"][0].match(regex);
              this.cookie = new Cookie(res[1], res[2]);
            } catch (error) {
              console.error(error);
              throw new ManastackError(
                "Error when logging into remote builder"
              );
            }
          }
        });
    }
  }

  // Remove a deck from the remote builder
  async deleteDeck(identifier: string) {
    return got
      .delete(`${this.url}/${this.routes["deck_delete"]}/${identifier}`, {
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.cookie.value}`,
        },
      })
      .then(() => identifier);
  }

  // Push a deck to the remote builder
  async pushDeck(d: Deck): Promise<BuilderDeckMetadata> {
    return this.newDeck(d.metadata)
      .then((bdm) => this.editMedataData(bdm))
      .then((bdm) => this.importDeck(d, bdm));
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
    return got
      .post(`${this.url}/${this.routes["deck_create"]}`, {
        headers: { Cookie: `PHPSESSID=${this.cookie.value}` },
      })
      .then((resp) => {
        const res = JSON.parse(resp.body);
        return new BuilderDeckMetadata(
          res["id"],
          `${this.url}/${this.routes["preview"]}/${res["id"]}}`,
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
    return got
      .put(`${this.url}/${this.routes["deck_edit"]}/${bdm.id}`, {
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.cookie.value}`,
        },
        body: JSON.stringify({
          name: bdm.dm.name,
          description: bdm.dm.description,
          private: false,
          format: { id: Formats[bdm.dm.format] },
          cards: [],
          groups: [],
        }),
      })
      .then(() => bdm)
      .catch((err) => Promise.reject(new ManastackError(err)));
  }

  protected async importDeck(
    d: Deck,
    bdm: BuilderDeckMetadata
  ): Promise<BuilderDeckMetadata> {
    return got
      .put(`${this.url}/${this.routes["deck_import"]}`, {
        headers: {
          "content-type": "application/json",
          Cookie: `PHPSESSID=${this.cookie.value}`,
        },
        body: JSON.stringify({
          deck: bdm.id,
          list: this.format(d),
        }),
      })
      .then(() => bdm)
      .catch((err) => Promise.reject(new ManastackError(err)));
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
