// builder.ts file contains all the logic used to represent an online deck builder

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

  login(): void;
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
