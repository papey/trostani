// ms.ts contains the ManaStack Builder interface implementation

import { Builder, User, Cookie } from "./builder";
const got = require("got");

export class MS implements Builder {
  name = "ManaStack";
  user: User;

  cookie: Cookie = null;

  url = "https://manastack.com";

  private routes: { [route: string]: string } = {
    login: "/api/user/login",
  };

  constructor(u: string, p: string) {
    // Create user
    this.user = new User(u, p);
  }

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
}

// ManaStack specific error
class ManastackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Error when interacting with Manastack";
  }
}
