// errors.ts file, containing all errors stuff

// Classes
// Parsing Error
export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Parsing Error";
    this.message = message;
  }
}

// When set-cookie is not found
export class NoSetCookie extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Set-Cookie Error";
    this.message = message;
  }
}

// When set-cookie is not found
export class RegexCookieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error in set-cookie regex";
    this.message = message;
  }
}

// When deck creating failed on ManaStack
export class ManaStackDeckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error creating deck on ManaStack";
    this.message = message;
  }
}

// Error building deck
export class DeckBuildingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error creating deck on ManaStack";
    this.message = message;
  }
}

// Error building deck
export class DontMessWithMeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error creating deck on ManaStack";
    this.message = message;
  }
}

// Error building deck
export class FormatNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error creating deck on ManaStack";
    this.message = message;
  }
}

// Error translating card
export class TranslateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error translating card on Scryfall";
    this.message = message;
  }
}
