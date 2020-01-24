// sync.ts contains code to handle the sync command and sync subcommands

// Imports
import { Message } from "discord.js";
import { Command } from "./utils";
import { Deck } from "../scry/mtg";
import { Manastack } from "../builders/manastack";
import { BuilderDeckMetadata } from "../builders/utils";

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

// syncHelpMessage is used to generated a specific help message when asksing for a sync command
export function syncHelpMessage(cmd: Command) {
  let message = `Using command \`${cmd.prefix}sync\`, available subcommands are :
  - \`search\`
  - \`push\``;

  if (cmd.args.includes("search")) {
    message = `Here is an example of the \`search\` subcommand of the \`sync\` command :
    \`\`\`${cmd.prefix}sync search ${searchExample}\`\`\``;
  } else if (cmd.args.includes("push")) {
    message = `Here is an example of the \`push\` subcommand of the \`sync\` command :
    \`\`\`${cmd.prefix}sync push ${pushExample}\`\`\``;
  }

  return message;
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
    let response = await ms.formatSearch(cmd.args);

    // Send message including lists of decks or an error message
    origin.channel.send(response);
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
  if (isAuthorized(origin.channel.id, channels)) {
    // push deck and five back url to channel
    let meta = await push(cmd, origin, translate, builder);
    origin.channel.send(
      `A new deck **${meta.getName()}** is available ! Go check it at ${meta.getUrl()}`
    );
  } else {
    throw new SyncError(
      "`push` subcommand of command `sync` is not authorized on this channel"
    );
  }
}

// isAuthorized ensures that push command is comming from an authorized channel
function isAuthorized(oid: string, aids: string[]): boolean {
  // loop over the array and check if id of the channel of the original message match configured channel
  // return true or false
  return aids.some(e => {
    return e === oid;
  });
}

// extract deck metadata from command args
function parseDeckMetadata(cmd: Command): string[] {
  // Get metadata from the first line
  let metas = cmd.args
    .split("\n")[0]
    .replace(":", "")
    .trim();

  // Metadata fields are separated using //
  let data = metas.split("//");

  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].trimLeft().trimRight();
  }

  // Return it
  return data;
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
    let meta = parseDeckMetadata(cmd);

    if (meta[0] == "") {
      throw new SyncError("Error, this deck needs at least a name");
    }

    // Try building the deck
    let deck = new Deck(meta);

    // Parse it
    await deck.parseDeck(origin.content, translate);

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

// Push command example
let pushExample: string = `Temur Elementals :
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

1 Jace, Wielder of Mysteries (WAR) 54
3 Nissa, Who Shakes the World (WAR) 169
1 Tamiyo, Collector of Tales (WAR) 220
3 Chandra, Awakened Inferno (M20) 127
`;

// Search command example
let searchExample: string = `temur aggro`;
