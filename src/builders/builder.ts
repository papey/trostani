// builter.ts, containing builder base interface

// Base interface
export interface Builder {
  // Builder name
  name: string;
  // Builder url
  url: string;

  // User
  user: { name: string; password: string };

  // Builder token (with value and expiration)
  cookie: Cookie;

  // Builder routes
  routes: { [route: string]: string };

  // Methods
  // Login or refresh token is nedeed
  login(): void;
}

// Cookie base class
export class Cookie {
  // Value
  public value!: string;
  // Expiration date of the current session
  private expiration!: Date;

  // Constructor
  constructor(token: string, date: string) {
    this.value = token;
    this.expiration = new Date(date);
  }

  // Ensure cookie is valid
  public valid(): boolean {
    let d = new Date();
    return d > this.expiration ? false : true;
  }
}
