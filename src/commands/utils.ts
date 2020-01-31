// utils.ts contains class and functions helpers related to bot commands

// Imports
import { Message, Role, Collection } from "discord.js";

// Classes
// Command class containing all parts of a command
export class Command {
  // main command
  public main: string = "";
  // sub command linked to main command
  public sub: string = "";
  // args (on the same line as the command)
  public args: string = "";
  // extra is remaining arg after carriage return
  public extra: string = "";
  // prefix used
  public prefix: string = "";

  constructor(command: string, prefix: string) {
    // get prefix
    this.prefix = prefix;

    // split on line
    let lines = command.split("\n");

    // if there is extra args, take it
    if (lines.length > 1) {
      this.extra = lines[1];
    }

    // split first line to get all the parts
    let split = lines[0].split(" ");

    // main command is the firt element of the first line
    this.main = split[0].replace(prefix, "").toLocaleLowerCase();

    // ensure there is a subcommand
    if (split.length > 1) {
      // sub command is the second element of the first line
      this.sub = split[1].trim().toLocaleLowerCase();
    }

    // ensure there args attached to this command
    if (split.length >= 3) {
      // args is remaining part of the array
      let args = split.slice(2, split.length);

      // rebuild args by joining all remaining elements
      this.args = args.join(" ");
    }
  }
}

// Functions
// handle cases where user asks for an unsupported function
export function handleNotSupported(cmd: Command, origin: Message) {
  let message = `Command, \`${cmd.prefix}${cmd.main}\`, not supported (if you need help try \`${cmd.prefix}help\`)`;
  origin.author.send(message);
}

// isAuthorized ensures that push command is comming from an authorized channel
export function isAuthorized(oid: string, aids: string[]): boolean {
  // loop over the array and check if id of the channel of the original message match configured channel
  // return true or false
  return aids.some(e => {
    return e === oid;
  });
}

// hasPermission check if a user is in an array of roles names
export function hasPermission(
  or: Collection<string, Role>,
  ar: string[]
): boolean {
  return or.some(r => {
    return ar.includes(r.name);
  });
}

// parseExtraArgs is used to split extra args commands
export function parseArgs(args: string, toLower: boolean = false): string[] {
  // Get args from the first line
  let a = args.split("\n")[0].trim();

  // split on "//"
  let sanitize = a.split("//");

  // ensure a trim on each arg
  for (let i = 0; i < sanitize.length; i++) {
    sanitize[i] = sanitize[i].trimLeft().trimRight();
    if (toLower) {
      sanitize[i].toLocaleLowerCase();
    }
  }

  // Return it
  return sanitize;
}

// generateArgsErrorMsg is used to generate an argument error message
export function generateArgsErrorMsg(na: number, prefix: string) {
  return `This command requires at least ${na} argument(s) (if you need help try \`${prefix}help\`)`;
}
