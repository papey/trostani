// utils.ts file contains generic code used by all builders

// Classes
// Used as a generic wrapper arround builders
export class BuilderDeckMetadata {
  // url of the deck
  private url: string;

  // name of the deck
  private name: string;

  // id of the deck
  private id: string;

  // Constructor
  constructor(url: string, name: string, id: string) {
    this.url = url;
    this.name = name;
    this.id = id;
  }

  // getters
  public getUrl() {
    return this.url;
  }

  public getName() {
    return this.name;
  }

  public getID() {
    return this.id;
  }
}
