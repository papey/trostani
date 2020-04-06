// sync.ts contains code to handle the sync command and sync subcommands

// Imports
import { Message } from "discord.js";
import { Command, parseArgs, isAuthorized } from "./utils";
import { Deck } from "../scry/mtg";
import { Manastack } from "../builders/manastack";
import { BuilderDeckMetadata } from "../builders/utils";
import { generateSubcommandExample } from "./help";
import { SearchResultTooLong } from "./utils";

// Functions
// syncHelpMessage is used to generated a specific help message when asksing for a sync command
export function syncHelpMessage(cmd: Command) {
  let message = `Using command \`${cmd.prefix}sync\`, available subcommands are :
  - \`search <keywords>\` : to search for deck containing <keywords> in their name
  - \`push <name> // <format> (optional) // <description> (optional) : [...decklist...(on a new line)]\` : to push the decklist formated as MTGA export`;

  if (cmd.args.includes("search")) {
    return generateSubcommandExample(cmd, "sync", "search", searchExample);
  } else if (cmd.args.includes("push")) {
    return generateSubcommandExample(cmd, "sync", "push", pushExample);
  }

  return message;
}

// handleSync is triggered when a user asks for a sync sub command
export async function handleSync(cmd: Command, origin: Message, config: any) {
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
  // If ManaStack is used
  if (builder.kind && builder.kind == "manastack") {
    let ms = new Manastack(
      builder.username,
      builder.password,
      builder.url,
      builder.profile
    );

    // Forge response for Discord
    let results = await ms.formatSearch(cmd.args);

    // ensure there is results
    if (results.length == 0) {
      throw new SyncError("There is no decks mathing this query");
    }

    // join results into one message
    let message = results.join(`\n`);

    // Final word, with result sumary
    if (cmd.args != "") {
      message += `Found ${results.length} deck(s) associated with keyword(s) _${cmd.args}_`;
    } else {
      message += `Found ${results.length} deck(s)`;
    }

    // throw error if message is too long
    if (message.length >= 2000) {
      throw new SearchResultTooLong(
        `This search result is too long for Discord, please add filters`
      );
    }

    // Send message including lists of decks
    origin.channel.send(message);
  }
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
    throw new SyncError(
      "`push` subcommand of command `sync` is not authorized on this channel"
    );
  }
  // push deck and five back url to channel
  let meta = await push(cmd, origin, translate, builder);
  origin.channel.send(
    `A new deck named **${meta.getName()}** is available ! Go check it at ${meta.getUrl()}`
  );
}

// push called when a users asks for the push subcommand of the sync command
async function push(
  cmd: Command,
  origin: Message,
  translate: boolean,
  builder: any
): Promise<BuilderDeckMetadata> {
  // Send a nice message
  origin.channel.send("_Analysing and publishing decklist_");

  try {
    let meta = parseArgs(cmd.args);

    if (meta[0] == "") {
      throw new SyncError("Error, this deck needs at least a name");
    }

    // Try building the deck
    let deck = new Deck(meta);

    // Parse it
    await deck.parseDeck(cmd.extra, translate);

    // If ManaStack is used
    if (builder.kind && builder.kind == "manastack") {
      let ms = new Manastack(
        builder.username,
        builder.password,
        builder.url,
        builder.profile
      );

      // Try formating the deck to ManaStack format
      let formated = deck.exportToManaStack();

      // Try creating the deck on ManaStack
      let meta = await ms.newDeck(
        deck.metadata.name,
        deck.metadata.description,
        deck.metadata.format,
        formated
      );

      // return deck url
      return meta;
    }
  } catch (error) {
    // If error, throw it
    throw error;
  }

  return Promise.reject("Error when pushing deck");
}

// Sync Command Error
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Sync Command Error";
    this.message = message;
  }
}

// Examples used in help command
// push command example
let pushExample: string = `Temur Elementals
Deck
4 Steam Vents (GRN) 257
4 Breeding Pool (RNA) 246
4 Stomping Ground (RNA) 259
1 Jace, Wielder of Mysteries (WAR) 54
2 Paradise Druid (WAR) 171
4 Neoform (WAR) 206
2 Cloudkin Seer (M20) 54
3 Scampering Scorcher (M20) 158
4 Shock (M20) 160
2 Thunderkin Awakener (M20) 162
2 Cavalier of Thorns (M20) 167
4 Leafkin Druid (M20) 178
1 Overgrowth Elemental (M20) 187
4 Omnath, Locus of the Roil (M20) 216
4 Risen Reef (M20) 217
1 Temple of Mystery (M20) 255
2 Island (ANA) 57
1 Mountain (ANA) 59
2 Forest (ANA) 60
3 The Great Henge (ELD) 161
1 Castle Embereth (ELD) 239
1 Castle Garenbrig (ELD) 240
1 Castle Vantress (ELD) 242
3 Fabled Passage (ELD) 244

Réserve
1 Jace, Wielder of Mysteries (WAR) 54
3 Nissa, Who Shakes the World (WAR) 169
1 Tamiyo, Collector of Tales (WAR) 220
3 Chandra, Awakened Inferno (M20) 127
`;

// search command example
let searchExample: string = `temur aggro`;
