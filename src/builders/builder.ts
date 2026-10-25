// builder.ts file contains all the logic used to represent an online deck builder

// Imports
import { Deck, Metadata } from "../scry/mtg";
import { MS } from "./ms";

// Builder base interface
export interface Builder {
  // builder name
  name: string;
  // User
  user: User;

  session: Session | null;

  // Base url
  url: string;

  login(): Promise<boolean>;

  pushDeck(d: Deck): Promise<BuilderDeckMetadata>;

  deleteDeck(identifier: string): Promise<string>;

  getDecks(): Promise<DeckResult[]>;

  search(keywords: string[]): Promise<DeckResult[]>;

  format(d: Deck): string;
}

export function newBuilder(
  kind: string,
  user: string,
  password: string,
): Builder {
  switch (kind) {
    case "manastack":
      return new MS(user, password);

    default:
      throw new Error(`Builder ${kind} not supported`);
  }
}

// Builder user class
export class User {
  // username
  name: string;
  // password
  password: string;

  constructor(u: string, p: string) {
    this.name = u;
    this.password = p;
  }
}

export class Session {
  public cookieHeader: string;
  public xsrfToken?: string;
  private expiration: Date;

  constructor(cookieHeader: string, expirationStr: string, xsrfToken?: string) {
    this.cookieHeader = cookieHeader;
    this.expiration = new Date(expirationStr);
    this.xsrfToken = xsrfToken;
  }

  public valid(): boolean {
    if (isNaN(this.expiration.getTime())) return false;
    return new Date() < this.expiration;
  }

  public getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Cookie: this.cookieHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (this.xsrfToken) {
      headers["X-XSRF-TOKEN"] = this.xsrfToken;
    }

    return headers;
  }
}

// BuilderDeckMetadata contains generic Metadatas from a deck builder object
export class BuilderDeckMetadata {
  id: string;
  url: string;
  dm: Metadata;

  constructor(id: string, u: string, dm: Metadata) {
    this.id = id;
    this.url = u;
    this.dm = dm;
  }
}

// DeckResults contains generic information about a deck returned from a deck search
export class DeckResult {
  url: string;
  creator: string;
  title: string;

  constructor(u: string, c: string, t: string) {
    this.url = u;
    this.creator = c;
    this.title = t;
  }
}
