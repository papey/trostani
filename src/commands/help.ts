// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";
import { Command } from "./utils";
import { SyncHelp } from "./sync";
import { TnmtHelp } from "./tnmt";

// handleHelp is triggered when a used asks for the help command
export function handleHelp(cmd: Command, origin: Message, config: any) {
  const message = `Using prefix **${cmd.prefix}**, available commands are :
  - \`sync\` (subcommand): iteract with the remote builder (enabled : ${
    config.settings.push ? "yes" : "no"
  })
  - \`tnmt\` (subcommand): iteract with Challonge and organize tournaments (enabled : ${
    config.settings.challonge.key ? "yes" : "no"
  })
  - \`profile\`: get user profile on remote builder
  - \`help\`: get this help message

  You can also type \`${
    cmd.prefix
  }help <subcommand>\` to get specific subcommand instructions`;

  switch (cmd.sub) {
    case "sync":
      origin.channel.send(new SyncHelp(cmd).handle());
      return;
    case "tnmt":
      origin.channel.send(new TnmtHelp(cmd).handle());
      return;
  }

  origin.channel.send(message);
}

// Represent a subcommand helper with associated example
class SubHelp {
  // Subcommand string identifier
  subcmd: string;
  // Subcommand arg list
  args: string;
  // Subcommand default help desciption
  help: string;
  // Subcommand args example
  example: string;

  // Generate a help line for this subcommand
  generate(): string {
    return `\`${this.subcmd} ${this.args}\` : ${this.help}`;
  }

  constructor(subcmd: string, args: string, help: string, example: string) {
    this.subcmd = subcmd;
    this.args = args;
    this.help = help;
    this.example = example;
  }
}

// Represent a per command help, all commands with subcommands needs to implement this interface
interface CmdHelp {
  // Command name
  cmd: string;
  // Commmand default help message
  help: string;
  // Help command send by the user
  request: Command;
  // Map of all subcommands with associated subcommand object
  sub: { [subcmd: string]: SubHelp };

  // An handle function to call when this help command is trigger
  handle(): string;
}

// List of exported elements from this module
export { SubHelp, CmdHelp };
