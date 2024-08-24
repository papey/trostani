// archidekt.ts contains the Archidekt Builder Interface implementation

// Imports
import axios from "axios";

import {
  Builder,
  BuilderDeckMetadata,
  Cookie,
  DeckResult,
  JWT,
  User,
} from "./builder";
import {Deck, Metadata} from "../scry/mtg";

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
    await axios.post(`${this.url}/${this.routes["login"]}`, {
      email: this.user.name,
      password: this.user.password
    }, {
      headers: {'Content-Type': 'application/json'}
    })
      .then(({data: body}) => {
        this.ID = body.user.id;
        this.jwt = new JWT(body.access_token, body.refresh_token);
        this.rootFolder = body.user.rootFolder;
      });

    return true;
  }

  // Create folder into the remote builder
  async mkdir(name: string) {
    return axios.post(`${this.url}/${this.routes["folders"]}/`, {
      name: name,
      private: false,
      parentFolder: this.rootFolder
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`
      }
    });
  }

  // List dirs
  async ls() {
    return axios.get(`${this.url}/${this.routes["folders"]}/${this.rootFolder}/`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`
      }
    })
      .then((response) => response.data.subfolders);
  }

  // Find a dir by it's name
  async find(name: string) {
    return this.ls().then((res) => res.find((value: { name: string; }) => value.name == name));
  }

  // Remove an item by it's id (deck or folder)
  async rm(id: string, kind: string = "deck") {
    return axios.post(`${this.url}/${this.routes["folders"]}/deleteItems/`, {
      items: [{id: id, type: kind}]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`
      }
    });
  }

  // Creates a new empty deck
  protected async newDeck(
    dm: Metadata,
    folder: number = null
  ): Promise<BuilderDeckMetadata> {

    return axios.post(`${this.url}/${this.routes["decks"]}/`, {
      jwt: this.jwt.getValue(),
      name: dm.name,
      deckFormat: 7,
      cards: [],
      copyId: 0,
      private: false,
      parent_folder: folder ? folder : this.rootFolder,
      description: dm.description,
      featured: "",
      paymat: ""
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`
      }
    })
      .then((response) => {
        const body = response.data;
        return new BuilderDeckMetadata(
          body.id,
          `${this.url}/decks/${body.id}`,
          dm
        );
      });
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
    return axios.post(`${this.url}/api/cards/massDeckEdit/`, {
      parser: "archidekt",
      current: "",
      edit: this.format(d)
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`,
        'Origin': `${this.url}`,
        'Referer': `${this.url}/decks/${base.id}`
      }
    })
      .then(({data}) => {
        // check for errors
        // in cards
        if (data["cardErrors"].length > 0) {
          Promise.reject(new ArchidektError(data["cardErrors"][0]));
        }
        // in syntax
        if (data["syntaxErrors"].length > 0) {
          Promise.reject(new ArchidektError(data["syntaxErrors"][0]));
        }
        return {cards: data["toAdd"], categories: data["categories"]};
      })
      .then((data) => {
        const cardsPayload = data.cards.reduce((acc: {
          cardid: any;
          quantity: any;
          modifier: string;
          categories: any;
          label: string;
        }[], content: { card: { id: any; }; quantity: any; categories: any; }) => {
          acc.push({
            cardid: content.card.id,
            quantity: content.quantity,
            modifier: "Normal",
            categories: content.categories,
            label: ",#656565",
          });
          return acc;
        }, []);

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
          []
        );

        return axios.post(`${this.url}/${this.routes["decks"]}/${base.id}/add/`, {
          cards: cardsPayload,
          categories: categoriesPayload
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `JWT ${this.jwt.getValue()}`,
            'Origin': `${this.url}`,
            'Referer': `${this.url}/decks/${base.id}`
          }
        });
      })
      .then(() => base);
  }

  async getDecks(): Promise<DeckResult[]> {
    return axios.get(`${this.url}/${this.routes["user"]}/${this.ID}/decks/`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.jwt.getValue()}`
      }
    })
      .then((response) => {
        const body = response.data;

        return body.decks.map((d: { id: any; name: string; }) =>
          new DeckResult(
            `${this.url}/decks/${d.id}`,
            this.user.name,
            d.name
          )
        );
      });
  }

  async deleteDeck(identifier: string): Promise<string> {
    return this.rm(identifier).then(() => "deleted");
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
