// tnmt.ts contains code to handle the tnmt command and tnmt subcommands

// Imports
import { Message } from "discord.js";
import { Challonge, TournamentInterfaces, Tournament } from "challonge-ts";
import { MD5 } from "crypto-js";
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
  - \`list <filter> (optional, values: pending, underway, complete)\` : to list tournaments`;

  if (cmd.args.includes("create")) {
    return generateSubcommandExample(cmd, "tnmt", "create", createExample);
  } else if (cmd.args.includes("list")) {
    return generateSubcommandExample(cmd, "tnmt", "list", listExample);
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
    default:
      throw new TnmtError(
        `\`${cmd.sub}\` is not a valid subcommand of the \`tnmt\` command (if you need help try \`${cmd.prefix}help\`)`
      );
  }
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
  if (isAuthorized(origin.channel.id, config.channels)) {
    if (hasPermission(origin.member.roles, config.roles)) {
      let args = parseArgs(cmd.args, true);
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

// Arity arguments mapper
let Arguments: { [f: string]: number } = {
  handleCreate: 4
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
