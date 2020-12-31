// archidekt.ts contains the Archidekt Builder Interface implementation

// Imports
const got = require("got");
import {
  Builder,
  BuilderDeckMetadata,
  Cookie,
  DeckResult,
  JWT,
  User,
} from "./builder";
import { Deck, Metadata } from "../scry/mtg";

// Archidekt builder interface implementation
export class Archidekt implements Builder {
  name = "Archidekt";
  user: User;

  cookie: Cookie = null;
  jwt: JWT = null;

  url = "https://www.archidekt.com";

  // root folder for decks of the current user
  rootFolder: number;
  // user ID
  ID: number;
  private routes: { [route: string]: string } = {
    login: "api/rest-auth/login/",
    folders: "api/decks/folders",
    decks: "api/decks",
    import: "api/cards/massDeckEdit/",
    user: `api/users`,
  };

  constructor(u: string, p: string) {
    this.user = new User(u, p);
  }

  // User login
  async login(): Promise<boolean> {
    await got
      .post(`${this.url}/${this.routes["login"]}`, {
        headers: { "content-type": "application/json" },
        body: `{ "username": "${this.user.name}", "password": "${this.user.password}" }`,
      })
      .then((res) => {
        const body = JSON.parse(res.body);
        this.ID = body["user"]["id"];
        this.jwt = new JWT(body["token"], body["refresh_token"]);
        this.rootFolder = body["user"]["rootFolder"];
      });

    return true;
  }

  // Create folder into the remote builder
  async mkdir(name: string) {
    return got.post(`${this.url}/${this.routes["folders"]}/`, {
      headers: {
        "content-type": "application/json",
        authorization: `JWT ${this.jwt.getValue()}`,
      },
      body: `{ "name": "${name}", "private": false, "parentFolder": ${this.rootFolder} }`,
    });
  }

  // List dirs
  async ls() {
    return got
      .get(`${this.url}/${this.routes["folders"]}/${this.rootFolder}/`, {
        headers: {
          "content-type": "application/json",
          authorization: `JWT ${this.jwt.getValue()}`,
        },
      })
      .then((res) => JSON.parse(res.body)["subfolders"]);
  }

  // Find a dir by it's name
  async find(name: string) {
    return this.ls().then((res) => res.find((value) => value.name == name));
  }

  // Remove an item by it's id (deck or folder)
  async rm(id: string, kind: string = "deck") {
    return got.post(`${this.url}/${this.routes["folders"]}/deleteItems/`, {
      headers: {
        "content-type": "application/json",
        authorization: `JWT ${this.jwt.getValue()}`,
      },
      body: `{ "items": [{"id": ${id}, "type": "${kind}"}] }`,
    });
  }

  // Creates a new empty deck
  protected async newDeck(
    dm: Metadata,
    folder: number = null
  ): Promise<BuilderDeckMetadata> {
    return got
      .post(`${this.url}/${this.routes["decks"]}/`, {
        headers: {
          "content-type": "application/json",
          authorization: `JWT ${this.jwt.getValue()}`,
        },
        body: `{ "jwt": "${this.jwt.getValue()}", "name": "${
          dm.name
        }", "deckFormat": 7, "cards": [], "copyId": 0, "private": false, "parent_folder": ${
          folder ? folder : this.rootFolder
        }, "description": "${dm.description}", "featured":"", "playmat": "" }`,
      })
      .then(
        (res) =>
          new BuilderDeckMetadata(
            JSON.parse(res.body)["id"],
            `${this.url}/decks/${JSON.parse(res.body)["id"]}`,
            dm
          )
      );
  }

  // Format a deck into an importable builder string
  format(d: Deck): string {
    const md = d
      .getMain()
      .reduce(
        (acc, c) =>
          `${acc}${c.getTimes()} ${c.getName()} (${c
            .getEdition()
            .toLowerCase()})\\n`,
        ""
      );

    const sd = d
      .getSide()
      .reduce(
        (acc, c) =>
          `${acc}${c.getTimes()} ${c.getName()} (${c
            .getEdition()
            .toLowerCase()}) [Sideboard]\\n`,
        ""
      );

    return [md, sd].join("\\n");
  }

  // Push a deck to the remote builder
  async pushDeck(d: Deck): Promise<BuilderDeckMetadata> {
    const base = await this.newDeck(d.metadata);

    // Create empty deck
    return got
      .post(`${this.url}/api/cards/massDeckEdit/`, {
        headers: {
          "content-type": "application/json",
          authorization: `JWT ${this.jwt.getValue()}`,
          origin: `${this.url}`,
          referer: `${this.url}/decks/${base.id}`,
        },
        body: `{ "parser": "archidekt", "current": "", "edit": "${this.format(
          d
        )}" }`,
      })
      .then((res) => {
        const body = JSON.parse(res.body);
        // check for errors
        // in cards
        if (body["cardErrors"].length > 0) {
          Promise.reject(new ArchidektError(body["cardErrors"][0]));
        }
        // in syntax
        if (body["syntaxErrors"].length > 0) {
          Promise.reject(new ArchidektError(body["syntaxErrors"][0]));
        }
        return { cards: body["toAdd"], categories: body["categories"] };
      })
      .then((data) => {
        const cardsPayload = data.cards.reduce((acc, content) => {
          acc.push({
            cardid: content.card.id,
            quantity: content.quantity,
            modifier: "Normal",
            categories: content.card.oracleCard.types.concat(
              content.categories
            ),
            label: ",#656565",
          });
          return acc;
        }, new Array());

        const categoriesPayload = Object.keys(data.categories).reduce(
          (acc, key) => {
            acc.push({
              id: null,
              includedInDeck: data.categories[key].includedInDeck,
              includedInPrice: data.categories[key].includedInPrice,
              isPremier: data.categories[key].isPremier,
              name: data.categories[key].name,
            });
            return acc;
          },
          new Array()
        );

        return got.post(`${this.url}/${this.routes["decks"]}/${base.id}/add/`, {
          headers: {
            "content-type": "application/json",
            authorization: `JWT ${this.jwt.getValue()}`,
            origin: `${this.url}`,
            referer: `${this.url}/decks/${base.id}`,
          },
          body: JSON.stringify({
            cards: cardsPayload,
            categories: categoriesPayload,
          }),
        });
      })
      .then(() => base);
  }

  async getDecks(): Promise<DeckResult[]> {
    return got
      .get(`${this.url}/${this.routes["user"]}/${this.ID}/decks/`, {
        headers: {
          "content-type": "application/json",
          authorization: `JWT ${this.jwt.getValue()}`,
        },
      })
      .then((res) => {
        const body = JSON.parse(res.body);

        return body["decks"].map(
          (d) =>
            new DeckResult(
              `${this.url}/decks/${d["id"]}`,
              this.user.name,
              d["name"]
            )
        );
      });
  }

  async deleteDeck(identifier: string): Promise<string> {
    return this.rm(identifier);
  }

  async search(keywords: string[]): Promise<DeckResult[]> {
    return this.getDecks().then((res) => {
      return res.filter((d) => {
        for (const kw of keywords) {
          if (d.title.toLowerCase().includes(kw.toLowerCase())) return true;
        }
        return false;
      });
    });
  }
}

// Archidekt specific error
class ArchidektError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error when interacting with Archidekt";
  }
}
