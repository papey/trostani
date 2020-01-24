// utils.ts contains class and functions helpers related to bot commands

// Imports
import { Message } from "discord.js";

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
    this.main = split[0].replace(prefix, "");

    // ensure there is a subcommand
    if (split.length > 1) {
      // sub command is the second element of the first line
      this.sub = split[1].trim();
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

// handle cases where user asks for an unsupported function
export function handleNotSupported(cmd: Command, origin: Message) {
  let message = `Command, \`${cmd.prefix}${cmd.main}\`, not supported (if you need help try \`${cmd.prefix}help\`)`;
  origin.author.send(message);
}
