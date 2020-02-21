// tnmt.ts contains code to handle the tnmt command and tnmt subcommands

// Imports
import { Message } from "discord.js";
import { Challonge, TournamentInterfaces, Tournament } from "challonge-ts";
import { MD5 } from "crypto-js";
import { Deck } from "../scry/mtg";
import { Manastack } from "../builders/manastack";
import {
  Command,
  parseArgs,
  isAuthorized,
  hasPermission,
  generateArgsErrorMsg
} from "./utils";
import { generateSubcommandExample } from "./help";

// Functions
// tnmtHelpMessage is used to generate an help message for the tnmt command and subcommands
export function tnmtHelpMessage(cmd: Command): string {
  let message = `Using command \`${cmd.prefix}tnmt\`, available subcommands are :
  - \`create <name> // <description> // <type> (SW, DE, SE or RR) // <format> // <date> (optional, format: YYYY-MM-DD at HH:MM) \` : to create a tournament
  - \`join <tournament id> [... decklist... ]\` : join a tournament (only with PENDING tournaments)
  - \`status <tournament id> // <round> (optional) \` : get tournament current status and results (only with IN PROGRESS tournaments)
  - \`list <filter> (optional, values: pending, underway, complete)\` : to list tournaments`;

  if (cmd.args.includes("create")) {
    return generateSubcommandExample(cmd, "tnmt", "create", createExample);
  } else if (cmd.args.includes("list")) {
    return generateSubcommandExample(cmd, "tnmt", "list", listExample);
  } else if (cmd.args.includes("join")) {
    return generateSubcommandExample(cmd, "tnmt", "join", joinExample);
  } else if (cmd.args.includes("status")) {
    return generateSubcommandExample(cmd, "tnmt", "status", statusExample);
  }
  return message;
}

// handleTnmt is triggered when a user asks for a tnmt command
export async function handleTnmt(cmd: Command, origin: Message, config: any) {
  if (
    config.settings.challonge == undefined ||
    config.settings.challonge.key == undefined
  ) {
    throw new TnmtError(
      "Challonge is not properly configured on this bot instance"
    );
  }

  const chlg = new Challonge(config.settings.challonge.key);

  switch (cmd.sub) {
    case "create":
      await handleCreate(cmd, origin, chlg, config.settings.challonge);
      break;
    case "list":
      await handleList(cmd, origin, chlg);
      break;
    case "join":
      await handleJoin(
        cmd,
        origin,
        chlg,
        config.settings.challonge,
        config.settings.builder
      );
      break;
    case "status":
      await handleStatus(cmd, origin, chlg, config.settings.challonge.key);
      break;
    default:
      throw new TnmtError(
        `\`${cmd.sub}\` is not a valid subcommand of the \`tnmt\` command (if you need help try \`${cmd.prefix}help\`)`
      );
  }
}

// handleStatus is used to get current status of specified challonge tournament
async function handleStatus(
  cmd: Command,
  origin: Message,
  client: Challonge,
  key: string
) {
  // response message
  let resp = "";

  // parse args
  let args = parseArgs(cmd.args);
  // check arguments requirements
  if (args.length >= Arguments["handleStatus"]) {
    // get tournament in progress
    let filter = await filtered(
      args[0],
      client,
      TournamentInterfaces.tournamentStateEnum.IN_PROGRESS
    );

    // get tournament data
    let tnmt = new Tournament(key, filter["tournament"]);

    // get all parcitipants for this tournament
    let participants = await tnmt.getParticipants();

    // since matches only contains id, ensure ability to quickly found participant from his ID
    let idToParticipant = new Map();
    participants.forEach(p => {
      idToParticipant.set(p["id"], p);
    });

    // get all the matches
    let matches = await tnmt.getMatches();

    // if an arg containing round paramater is found
    if (args[1]) {
      // filter matches if requested
      let matchesFilter = matches.filter(e => {
        return e["round"] == args[1];
      });
      // if a filter is provided, replace matches by filtered matches
      if (matchesFilter && matchesFilter.length >= 1) {
        origin.channel.send(
          `_Here is all the matches associated with round : ${args[1]}_`
        );
        matches = matchesFilter;
      } else {
        // if filter filters nothing, fallback to all
        origin.channel.send(
          `_Nothing found using filter **${args[1]}**, fallback to non filtered mode_`
        );
      }
    }

    // for all matches, create response
    matches.forEach(m => {
      if (m["completed_at"] == null) {
        // participants data, player 1 and player 2
        if (m["player1_id"] != null && m["player2_id"] != null) {
          let p1 = idToParticipant.get(m["player1_id"]);
          let p2 = idToParticipant.get(m["player2_id"]);
          resp += `_Round ${m["round"]}_ - **${p1["name"]} VS ${p2["name"]}** - state : ${m["state"]} - identifier : ${m["identifier"]}`;
        }
      } else {
        // participants data, winner and loser
        let w = idToParticipant.get(m["winner_id"]);
        let l = idToParticipant.get(m["loser_id"]);
        resp += `_Round ${m["round"]}_ - **${w["name"]} VS ${l["name"]}** - score : **${m["scores_csv"]}** - state : ${m["state"]} - identifier : ${m["identifier"]}`;
      }
      resp += "\n";
    });

    // send back response to channel
    origin.channel.send(resp);
  } else {
    throw new TnmtError(
      generateArgsErrorMsg(Arguments["handleStatus"], cmd.prefix)
    );
  }
}

// handleJoin is used to register a user to a specified challonge tournament
async function handleJoin(
  cmd: Command,
  origin: Message,
  client: Challonge,
  challonge: any,
  builder: any
) {
  // check if channel is authorized
  if (isAuthorized(origin.channel.id, challonge.channels)) {
    // parse args
    let args = parseArgs(cmd.args);
    // check arguments requirements
    if (args.length >= Arguments["handleJoin"]) {
      let filter = await filtered(
        args[0],
        client,
        TournamentInterfaces.tournamentStateEnum.PENDING
      );

      // create deck
      let meta = new Array();
      // prepare meta data
      // name
      meta.push(`[Tournament: ${args[0]}] ${origin.author.username}'s Deck`);
      // Format, TODO more specific if format is supported by builder, use casual as default
      meta.push(`casual`);
      // description
      meta.push(
        `Deck played by participant ${origin.author.username} during tournament with associated ID ${args[0]}`
      );
      let deck = new Deck(meta);
      await deck.parseDeck(origin.content, true);

      // sync deck to Manastack
      if (builder.kind && builder.kind == "manastack") {
        var ms = new Manastack(
          builder.username,
          builder.password,
          builder.url,
          builder.profile
        );

        // Try formating the deck to ManaStack format
        let formated = deck.exportToManaStack();

        // Try creating the deck on ManaStack
        var synced = await ms.newDeck(
          deck.metadata.name,
          deck.metadata.description,
          deck.metadata.format,
          formated
        );
      }

      // add participant to associated tournament
      let tnmt = new Tournament(challonge.key, filter["tournament"]);
      await tnmt
        .newParticipant({ name: origin.author.username, misc: synced.getUrl() })
        .catch(async error => {
          // ensure a deck delete since adding a participant trigger an error
          if (builder.kind && builder.kind == "manastack") {
            await ms.deleteDeck(synced.getID());
          }

          // trigger specific error
          triggerParticipantError(error, origin.author.id, args[0]);
        });

      // return decklist, and message
      origin.channel.send(
        `Registration succesfull for user <@${
          origin.author.id
        }> in tournament ${
          filter["data"]["tournament"]["full_challonge_url"]
        }, deck list is available at ${synced.getUrl()}`
      );
    } else {
      throw new TnmtError(
        generateArgsErrorMsg(Arguments["handleJoin"], cmd.prefix)
      );
    }
  } else {
    throw new TnmtError(`This command cannot be used on this channel`);
  }
}

// triggerParticipantError is used to create a custom error when newParcipant fails
function triggerParticipantError(err: Error, oid: string, id: string) {
  if (err["response"]["status"] == 422 && err["response"]["data"]["errors"]) {
    throw new TnmtError(
      `Participant <@${oid}> is already registered in tournament ${id}`
    );
  }
  throw new TnmtError("Error registering participant");
}

// handleList is used to list all tournaments on challonge
async function handleList(cmd: Command, origin: Message, client: Challonge) {
  // set a limit
  let limit = 15;

  // declare optionnal parameters
  let params = {};

  // fill optional parameters
  if (cmd.args.toLocaleLowerCase().includes("pending")) {
    params = { state: TournamentInterfaces.tournamentStateEnum.PENDING };
  } else if (cmd.args.toLocaleLowerCase().includes("completed")) {
    params = { state: TournamentInterfaces.tournamentStateEnum.ENDED };
  } else if (cmd.args.toLocaleLowerCase().includes("underway")) {
    params = { state: TournamentInterfaces.tournamentStateEnum.IN_PROGRESS };
  }

  // get all tournaments
  let all = await client.getTournaments(params);

  // challonge-ts sort by id, so reverse to get most recent entries
  all = all.reverse();

  // prepare output
  let parts: string[] = [];

  // check len, set limit if needed
  let len = all.length < limit ? all.length : limit;

  // loop over items (limit or length) and generate line
  for (let index = 0; index < len; index++) {
    parts.push(generateListLine(all[index]));
  }

  // check if something was found
  if (parts.length == 0) {
    origin.channel.send(`Sorry, there is no entry matching the request`);
  } else {
    // push message to channel by joining outputs parts
    origin.channel.send(parts.join("\n"));
  }
}

// generateListLine is used to generate an output line for each tournament
function generateListLine(t: Tournament) {
  // base of the string
  let base = `**${t["data"]["tournament"]["name"]}** - Code : _${getCode(
    t["data"]["tournament"]["full_challonge_url"]
  )}_ - ${t["data"]["tournament"]["full_challonge_url"]}`;

  // date
  let date = "";

  // date is specific for each tournament state
  switch (t["data"]["tournament"]["state"]) {
    case "complete":
      var started = new Date(t["data"]["tournament"]["started_at"]);
      var completed = new Date(t["data"]["tournament"]["completed_at"]);
      date = `started at **${started.toDateString()}** and completed at **${completed.toDateString()}**`;
      break;
    case "underway":
      var started = new Date(t["data"]["tournament"]["started_at"]);
      date = `started at **${started.toDateString()}**`;
      break;
    case "pending":
      var start = new Date(t["data"]["tournament"]["start_at"]);
      date = `starting at **${start.toDateString()}** | **${start.toTimeString()}**`;
      break;
    default:
      break;
  }

  // return full string
  return base + " - _" + t["data"]["tournament"]["state"] + "_ - " + date;
}

// handleCreate is used to create a tournament on challonge
async function handleCreate(
  cmd: Command,
  origin: Message,
  client: Challonge,
  config: any
) {
  // check authorization and permissions
  if (isAuthorized(origin.channel.id, config.channels)) {
    if (hasPermission(origin.member.roles, config.roles)) {
      // parse args
      let args = parseArgs(cmd.args, true);
      // ensure args requirements
      if (args.length >= Arguments["handleCreate"]) {
        await create(args, origin, client);
      } else {
        throw new TnmtError(
          generateArgsErrorMsg(Arguments["handleCreate"], cmd.prefix)
        );
      }
    } else {
      throw new TnmtError(
        `You don't have the required permissions to use this command`
      );
    }
  } else {
    throw new TnmtError(`This command cannot be used on this channel`);
  }
}

// parseTnmtType is used to translate a tournament type as a string to a Challonge supported type
function parseTnmtType(input: string): TournamentInterfaces.tournamentTypeEnum {
  // return specific value for each possible tournament
  switch (input.toLocaleUpperCase()) {
    case "SW":
      return TournamentInterfaces.tournamentTypeEnum.SWISS;
    case "DE":
      return TournamentInterfaces.tournamentTypeEnum.DOUBLE_ELIMINATION;
    case "SE":
      return TournamentInterfaces.tournamentTypeEnum.SINGLE_ELIMINATION;
    case "RR":
      return TournamentInterfaces.tournamentTypeEnum.ROUND_ROBIN;
    default:
      throw new TnmtError(
        `Tournament type ${input} is not supported by Challonge`
      );
  }
}

// parseDate is used to parse date from a Discord argument
function parseDate(input: string): Date | null {
  // parse input
  const regex = new RegExp(/(\d{4})-(\d{2})-(\d{2}) at (\d{2}):(\d{2})/);
  // exec regex
  let res = regex.exec(input);

  // check match results
  if (!res || res.length < 6) {
    return null;
  }

  // if it's ok, convert to int
  let toInt: number[] = res.map(e => {
    return Number.parseInt(e);
  });

  // create date
  return new Date(toInt[1], toInt[2], toInt[3], toInt[4], toInt[5]);
}

// create is used to trigger a tournament creation on challonge
async function create(args: string[], origin: Message, client: Challonge) {
  // generate pseudo-random code from name
  let code = generateCode(args[0]);

  // generate name by adding format in it
  let name = generateName(args[0], args[3]);

  // Here is a generic overview of arguments order
  // NAME // DESCRIPTION // TYPE // FORMAT // DATE
  let meta = {
    accept_attachments: true,
    description: args[1],
    tournament_type: parseTnmtType(args[2]),
    name: name,
    url: code
  };

  // if a date is specified
  if (args[4]) {
    // parse it
    let date = parseDate(args[4]);
    // if parsing fail
    if (date == null) {
      // default to now
      origin.channel.send(
        `Warning, date used is not in a valid format and will not be used`
      );
    } else {
      // add date information by merging the two objects
      meta = { ...meta, ...{ start_at: date } };
    }
  }

  // trigger call to challonge API
  await client.createTournament(meta);

  // send message to channel when tournament is created
  origin.channel.send(
    `Tournament **${args[0]}** created and available at https://challonge.com/${code}, you can interact with it using the following code : **${code}**`
  );
}

// generateCode is used to generate a pseudo code for the current tournament
function generateCode(name: string) {
  return MD5(name)
    .toString()
    .slice(0, 5);
}

// getCode is used to retreive code from a tournament url
function getCode(url: string): string {
  // split on / and get the last part of the url
  return url.split("/").reverse()[0];
}

// generateName si used to generated final name of tournament on Challonge using name and specified format
function generateName(name: string, format: string): string {
  return `[Format: ${format.toLocaleUpperCase()}] ${name}`;
}

// filtered is used to get all tournaments and filter using id
async function filtered(
  id: string,
  client: Challonge,
  status: TournamentInterfaces.tournamentStateEnum
) {
  // get pending tournaments
  let tnmts = await client.getTournaments({ state: status });
  // filter using specified ID by the participant
  let filter = tnmts.filter(t => {
    return getCode(t["data"]["tournament"]["full_challonge_url"]) == id;
  });

  // check if tournament exists and is in pending state
  if (filter.length <= 0) {
    throw new TnmtError(
      `There is no tournament with status '${status.replace(
        "_",
        " "
      )}' associated with id '${id}'.`
    );
  }

  return filter[0];
}

// Arity arguments mapper
let Arguments: { [f: string]: number } = {
  handleCreate: 4,
  handleJoin: 1,
  handleStatus: 1
};

// Sync Command Error
export class TnmtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Tournament Error";
    this.message = message;
  }
}

// Examples
// create subcommand example
let createExample = `Tournament Name // Tournament Description // SW // Forgeron // 2020-11-07 at 17:00`;

// list subcommand example
let listExample = `pending`;

// join subcommand example
let joinExample = `df898
Deck
4 Frisson de probabilité (ELD) 146
4 Soif de sens (THB) 74
4 Montagne (THB) 285
2 Falaises des eaux vives (M20) 252
2 Électromancien gobelin (GRN) 174
1 Étreinte de lave (GRN) 108
3 Frappe foudroyante (XLN) 149
4 Landes de cendres (M19) 248
4 Révélation // Répartition (GRN) 223
4 Marais (THB) 283
3 Érudite des âges (M20) 74
2 Géant rugissant (M20) 177
2 Île (THB) 281
1 Golem météoritique (M19) 241
3 Don du chaudron (ELD) 83
4 Étendues sauvages en évolution (RIX) 186
2 Du sang pour les os (M20) 89
3 Liche engrimoirée (M20) 219
1 Marigot lugubre (M20) 245
3 Ossuaire submergé (M19) 257
4 Tritonne des fondrières (THB) 105

Réserve
3 Instant d'envie (RIX) 79
2 Contrainte (M19) 94
1 Étanchement (RNA) 48
2 Cramer (M20) 140
2 Pyrohélice de Chandra (WAR) 120
3 Balayage de flammes (M20) 139
2 Surgissement de Ral (WAR) 212`;

// status subcommand example
let statusExample = `d6399 // 1`;
