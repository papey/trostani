// builder.ts file contains all the logic used to represent an online deck builder

// Imports
import { Deck, Metadata } from "../scry/mtg";

// Builder base interface
export interface Builder {
  // builder name
  name: string;
  // User
  user: User;

  // Auth cookie
  cookie: Cookie;

  // Base url
  url: string;

  login(): Promise<boolean>;

  pushDeck(d: Deck): Promise<BuilderDeckMetadata>;

  deleteDeck(identifier: string): void;

  getDecks(): Promise<DeckResult[]>;

  search(keywords: string[]): Promise<DeckResult[]>;

  format(d: Deck): string;
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

// Builder cookie class
export class Cookie {
  // Token used to auth
  public value!: string;
  // Expiration date of the current session
  private expiration!: Date;

  constructor(v: string, d: string) {
    this.value = v;
    this.expiration = new Date(d);
  }

  // Ensure cookie is valid
  public valid(): boolean {
    return new Date() < this.expiration;
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
