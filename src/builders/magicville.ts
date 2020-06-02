// magicville.ts contains Magic Ville (https://www.magic-ville.com/fr/index) builder implementation

// Imports
const got = require("got");
import { Builder, Cookie } from "./builder";

// Magic Ville classe
export class MagicVille implements Builder {
  // Some default value
  name = "MV";
  url = "https://www.magic-ville.com/fr";

  user = null;
  cookie = null;

  // Routes on the MagicVille side
  routes = {
    login: "connexion",
    register: "register/perso",
  };

  // Basic constructor
  constructor(u: string, p: string) {
    this.user = { name: u, password: p };
  }

  // Check is a user is correctly logged or not
  async isLogged(): Promise<boolean> {
    const resp = await got.get({
      url: `${this.url}/${this.routes["register"]}`,
      headers: {
        // Magic Ville needs this "magicville" extra cookie containing the username 🤷
        Cookie: [`MVctrl=${this.cookie.value}`, `magicville=${this.user.name}`],
      },
      resolveWithFullResponse: true,
    });

    return resp.body.includes(`Magicvillois <b>${this.user.name}</b>`);
  }

  // Login a user
  async login() {
    let regex = new RegExp(
      "MVctrl=(\\w+); expires=(.*); Max-Age=(\\d+); path=(.*)"
    );

    // if there is no cookie or it's not valid
    if (!this.cookie || !this.cookie.valid()) {
      // request for a new login
      await got
        .post({
          headers: { "content-type": "application/x-www-form-urlencoded" },
          url: `${this.url}/${this.routes["login"]}`,
          resolveWithFullResponse: true,
          form: {
            pseudo: this.user.name,
            pass: this.user.password,
            data: 1,
          },
        })
        // after that, get the cookie
        .then((resp) => {
          // name is MVctrl
          const cookie = resp.headers["set-cookie"].find((v: string) =>
            v.includes("MVctrl")
          );

          // match against regex
          const res = cookie.match(regex);

          // fill cookie value
          this.cookie = new Cookie(res[1].trim(), res[2]);
        })
        .catch((error) => console.error(error));
    }
  }
}
