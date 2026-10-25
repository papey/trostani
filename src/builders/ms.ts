// ms.ts contains the ManaStack Builder interface implementation

// Imports
import {
  Builder,
  User,
  Session,
  BuilderDeckMetadata,
  DeckResult,
} from "./builder";
import { Deck, Metadata } from "../scry/mtg";
import axios from "axios";

// ManaStack builder interface implementation
class MS implements Builder {
  name = "ManaStack";
  user: User;

  session: Session | null = null;

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
    if (!this.session || !this.session.valid()) {
      const response = await axios.post(
        `${this.url}/${this.routes["login"]}`,
        {
          username: this.user.name,
          password: this.user.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const setCookieArray = response.headers["set-cookie"];
      if (!setCookieArray || setCookieArray.length === 0) {
        throw new ManastackError("No cookies found in login response");
      }

      // 1. Get valid cookies and build the header string
      const validCookies = setCookieArray.filter(
        (c) => !c.toLowerCase().includes("max-age=0"),
      );
      const cookieHeader = validCookies
        .map((cookieStr) => cookieStr.split(";")[0])
        .join("; ");

      // 2. Extract XSRF token
      let xsrfToken: string | undefined = undefined;
      const xsrfCookie = validCookies.find((c) => c.startsWith("XSRF-TOKEN="));
      if (xsrfCookie) {
        const xsrfMatch = xsrfCookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          xsrfToken = decodeURIComponent(xsrfMatch[1]);
        }
      }

      // 3. Extract the session expiration date
      const sessionStr = validCookies.find((c) =>
        c.startsWith("manastack_session="),
      );
      if (!sessionStr)
        throw new ManastackError("manastack_session cookie not found");

      const expiresMatch = sessionStr.match(/expires=([^;]+)/i);
      if (!expiresMatch)
        throw new ManastackError("Could not extract expiration date");
      const expirationDateStr = expiresMatch[1];

      // 4. Store everything in your newly expanded class
      this.session = new Session(cookieHeader, expirationDateStr, xsrfToken);
    }

    return true;
  }

  // Remove a deck from the remote builder
  async deleteDeck(identifier: string): Promise<string> {
    return axios
      .delete(`${this.url}/${this.routes["deck_delete"]}/${identifier}`, {
        headers: { ...this.session.getHeaders() },
      })
      .then(() => identifier);
  }

  // Push a deck to the remote builder
  async pushDeck(d: Deck): Promise<BuilderDeckMetadata> {
    // Create emtpy deck
    const bdm = await this.newDeck(d.metadata);

    // Fill deck with medatadata and cards
    return this.editMedataData(bdm)
      .then((bdm) => this.importDeck(d, bdm))
      .catch(async (err) => {
        // if something fails, try to delete the non-complete deck
        await this.deleteDeck(bdm.id);
        // Return the error
        return Promise.reject(err);
      });
  }

  // Get all the decks from remote builder
  async getDecks(): Promise<DeckResult[]> {
    // get all the deck
    return axios
      .get(`${this.url}/${this.routes["decks_list"]}`, {
        headers: { ...this.session.getHeaders() },
      }) // then map them all to a DeckResult object
      .then(({ data }) => {
        return data[0]["decks"].map(
          (d: { slug: any; owner: { username: string }; name: string }) =>
            new DeckResult(
              `${this.url}/deck/${d.slug}`,
              d.owner.username,
              d.name,
            ),
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
        // Search over each keyword
        for (const kw of keywords) {
          // If a keyword is found, return true, deck is filtered
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
        formated += `${d.getCompanion()?.export()}\n`;
      }
      // Since ManaStack can't display commander properly in Brawl Decks, it goes into the sideboard
      if (d.getCommander()) {
        formated += `${d.getCommander()?.export()}\n`;
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
    return axios
      .post(`${this.url}/${this.routes["deck_create"]}`, null, {
        headers: { ...this.session.getHeaders() },
      })
      .then(({ data }) => {
        return new BuilderDeckMetadata(
          data["id"],
          `${this.url}/${this.routes["preview"]}/${data["id"]}}`,
          dm,
        );
      })
      .catch((err) => {
        Promise.reject(new ManastackError(err));
      });
  }

  // Edit created deck Metadata
  protected async editMedataData(
    bdm: BuilderDeckMetadata,
  ): Promise<BuilderDeckMetadata> {
    return axios
      .put(
        `${this.url}/${this.routes["deck_edit"]}/${bdm.id}`,
        {
          name: bdm.dm.name,
          description: bdm.dm.description,
          private: false,
          format: { id: Formats[bdm.dm.format] },
          cards: [],
          groups: [],
        },
        {
          headers: { ...this.session.getHeaders() },
        },
      )
      .then(() => bdm)
      .catch((err) => Promise.reject(new ManastackError(err)));
  }

  protected async importDeck(
    d: Deck,
    bdm: BuilderDeckMetadata,
  ): Promise<BuilderDeckMetadata> {
    return axios
      .put(
        `${this.url}/${this.routes["deck_import"]}`,
        {
          deck: bdm.id,
          list: this.format(d),
        },
        {
          headers: { ...this.session.getHeaders() },
        },
      )
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

// List of exported elements from this module
export { MS };
