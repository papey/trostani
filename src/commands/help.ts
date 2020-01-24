// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";
import { Command } from "./utils";
import { syncHelpMessage } from "./sync";

// handleHelp is triggered when a used asks for the help command
export function handleHelp(cmd: Command, origin: Message) {
  let message = `Using prefix **${cmd.prefix}**, available commands are :
  - \`sync\` (subcommand): to iteract with the remote builder
  - \`profile\`: to get user profile on remote builder
  - \`help\`: to get this help message

  You can also type \`${cmd.prefix}help <subcommand> to get specific subcommand instructions\``;

  switch (cmd.sub) {
    case "sync":
      message = syncHelpMessage(cmd);
      break;
  }

  origin.author.send(message);
}
