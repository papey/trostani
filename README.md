# Trostani, The Discordant

[![Build Status](https://drone.github.papey.fr/api/badges/papey/trostani/status.svg)](https://drone.github.papey.fr/papey/trostani)

Trostani is a [TypeScript](http://www.typescriptlang.org/) Discord bot with
various [Magic: The Gathering Arena](https://magic.wizards.com/fr/mtgarena)
related features such as tournament management using Challonge and decklist
sync to a online builder.

Trostani builder list :

- [Archidekt](https://www.archidekt.com/)
- [ManaStack](https://manastack.com)

## Getting Started

### Prerequisites

- [TypeScript](https://www.rust-lang.org/)
- [Node.JS](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/lang/en/)

### Installing

#### Get Trostani

##### From source

Clone this repo and run

```sh
yarn
```

To download all the deps, then

```
yarn build
```

To build js files from ts files into `dist`

##### From Docker Hub

See [papey/trostani](https://hub.docker.com/r/papey/trostani) on Docker Hub

### Usage

```sh
yarn start --help
```

Trostani uses config files in .yaml format, see `settings.yml` file inside
the `examples` directory for real life examples.

## Running the tests

```sh
yarn test
```

## User Help & Manual

Once the bot is connected,

```text
!help
```

or for more specific stuff,

```text
!help <command>
```

An asciidoctor user documentation is also available in the `docs` directory

## Built With

- [discord.js](https://discordjs.guide) - A Discord bot library
- [scryfall-sdk](https://github.com/Yuudaari/scryfall-sdk) - A Scryfall TypeScript library
- [got](https://github.com/sindresorhus/got) - An HTTP client
- [challonge-ts](https://github.com/EdwardJFox/challonge-ts) - A Typescript wrapper for the Challonge API

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Authors

- **Wilfried OLLIVIER** - _Main author_ - [Papey](https://github.com/papey)

## License

[LICENSE](LICENSE) file for details

## Acknowledgments

- [Wizards Of The Cost](https://magic.wizards.com) for Magic: The Gathering and Magic: The Gathering Arena
- [ManaStack.com](https://manastack.com) as a main online deck builder
- [Scryfall](https://scryfall.com) for the awesome tooling they provide for free
- [Discord](https://discordapp.com) for the plateform they provide for free
- [Val & PL Magic Arena FR](https://www.youtube.com/channel/UCQJQLJFuAj0Q8LPgqdzTbag) two MTGA french steamers who inspired this bot
- [Forgeron Community](https://forgeronmtg.wixsite.com/mtgforgeron) for crash testing tournament features
- Kudos @Namarand !

## Notes

[Trostani, the Discordant](https://scryfall.com/card/grn/208/trostani-discordant) is a Magic: The Gathering card. I found the name quite relevent with a `Discord` bot.

Portions of names used in this projet are unofficial Fan Content permitted
under the Wizards of the Coast Fan Content Policy. The literal information
presented on this site about Magic: The Gathering, including card, the mana
symbols, and Oracle text, is copyright Wizards of the Coast, LLC, a
subsidiary of Hasbro, Inc. Trostani is not produced by, endorsed by,
supported by, or affiliated with Wizards of the Coast.
