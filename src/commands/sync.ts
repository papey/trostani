// sync.ts contains code to handle the sync command and sync subcommands

// Imports
import { Message } from "discord.js";
import { Command, parseArgs, isAuthorized } from "./utils";
import { Deck } from "../scry/mtg";
import { newBuilder } from "../builders/builder";
import { SubHelp, CmdHelp } from "./help";
import { SearchResultTooLong, decklistFromAttachment } from "./utils";

// handleSync is triggered when a user asks for a sync sub command
async function handleSync(cmd: Command, origin: Message, config: any) {
  switch (cmd.sub) {
    case "push":
      if (config.settings.push.channels) {
        await handlePush(
          cmd,
          origin,
          config.settings.push.channels,
          config.settings.translate,
          config.settings.builder
        );
      } else {
        throw new SyncError(
          "`push` subcommand of command `sync` is not enabled on this bot instance"
        );
      }
      break;

    case "search":
      await handleSearch(cmd, origin, config.settings.builder);
      break;

    default:
      throw new SyncError(
        `\`${cmd.sub}\` is not a valid subcommand of the \`sync\` command (if you need help try \`${cmd.prefix}help\`)`
      );
  }
}

// handleSearch handles the subcommand search of the sync command
async function handleSearch(cmd: Command, origin: Message, builder: any) {
  // Init builder
  const bldr = newBuilder(builder.kind, builder.username, builder.password);

  const results = await bldr
    .login()
    .then(() => bldr.search(cmd.args.split(" ").map((e) => e.toLowerCase())));

  // ensure there is results
  if (results.length == 0) {
    origin.channel.send("There is no decks matching this query");
    return;
  }

  // join results into one message
  let message = results.reduce(
    (acc, r) => (acc += `${r.title} - (${r.creator}) - ${r.url}\n`),
    ""
  );

  // Final word, with result sumary
  if (cmd.args != "") {
    message += `Found ${results.length} deck(s) associated with keyword(s) _${cmd.args}_`;
  } else {
    message += `Found ${results.length} deck(s)`;
  }

  // throw error if message is too long
  if (message.length >= 2000) {
    throw new SearchResultTooLong(
      `This search result is too long for Discord, please add keywords to filter your research`
    );
  }

  // Send message including lists of decks
  origin.channel.send(message);
}

// handlePush handles the subcommand push of the sync command
async function handlePush(
  cmd: Command,
  origin: Message,
  channels: string[],
  translate: boolean,
  builder: any
) {
  // check if the message is comming from an authorized channel
  if (!isAuthorized(origin.channel.id, channels)) {
    origin.channel.send(
      "`push` subcommand of command `sync` is not authorized on this channel"
    );
    return;
  }

  // get meta data
  const meta = parseArgs(cmd.args);
  if (meta[0] == "") {
    origin.channel.send("Error, this deck needs at least a name");
    return;
  }

  // Build and parse the deck
  let deck = new Deck(meta);
  // try from attachment
  const fromAttachment = await decklistFromAttachment(origin);
  if (fromAttachment != null) {
    await deck.buildDeck(fromAttachment, translate);
  } // if not found, fallback to text message
  else {
    await deck.buildDeck(cmd.extra, translate);
  }

  // create builder object
  const bldr = newBuilder(builder.kind, builder.username, builder.password);

  // Push the deck
  const bdm = await bldr.login().then(() => bldr.pushDeck(deck));
  origin.channel.send(
    `A new deck named **${bdm.dm.name}** is available ! Go check it at ${bdm.url}`
  );
}

// CmdHelp interface implementation for sync command
class SyncHelp implements CmdHelp {
  cmd = "sync";
  help: string;
  sub: { [subcmd: string]: SubHelp } = {};
  request: Command;

  constructor(cmd: Command) {
    // Subcommand Help
    this.sub["search"] = new SubHelp(
      "search",
      "<keywords>",
      "search for a deck containing <keywords> in their name",
      "temur aggro"
    );
    this.sub["push"] = new SubHelp(
      "push",
      "<name> // <format> (optional) // <description> (optional) [decklist (on a new line, exported as MTGA format)]",
      "push a list to the remote builder",
      `Bento
Deck
4 Téfeiri, effileur de temps (WAR) 221
3 Plaine (SLD) 63
7 Île (SLD) 64
3 Narset, déchireuse des voiles (WAR) 61
3 Absorption (RNA) 151
3 La naissance de Mélétis (THB) 5
2 Yorion, nomade céleste (IKO) 232
3 Elspeth conquiert la Mort (THB) 13
3 Typhon de requins (IKO) 67
4 Augure de la mer (THB) 58
3 Fracassement du ciel (THB) 37
2 Dispute mystique (ELD) 58
1 Véto de Dovin (WAR) 193
3 Augure du soleil (THB) 30
4 Temple de l'illumination (THB) 246
4 Passage merveilleux (ELD) 244
1 Château Vantress (ELD) 242
3 Château Ardenval (ELD) 238
4 Fontaine sacrée (RNA) 251

Réserve
3 Archonte de la grâce solaire (THB) 3
2 Dispute mystique (ELD) 58
3 Rafale d'Éther (M20) 42
4 Cercueil de verre (ELD) 15
3 Véto de Dovin (WAR) 193
`
    );

    this.request = cmd;

    this.help = `Using command \`${this.request.prefix}${this.cmd}\`, available subcommands are :\n`;
    for (const k in this.sub) {
      this.help += `- ${this.sub[k].generate()}\n`;
    }
  }

  handle(): string {
    for (const key in this.sub) {
      if (this.request.args.includes(key)) {
        return `\`\`\`${this.request.prefix}${this.request.sub} ${this.request.args} ${this.sub[key].example}\`\`\``;
      }
    }

    return this.help;
  }
}

// Sync Command Error
class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Sync Command Error";
    this.message = message;
  }
}

// List of exported elements from this module
export { handleSync, SyncHelp };
