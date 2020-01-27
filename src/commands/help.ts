// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";
import { Command } from "./utils";
import { syncHelpMessage } from "./sync";

// Functions
// handleHelp is triggered when a used asks for the help command
export function handleHelp(cmd: Command, origin: Message, config: any) {
  let message = `Using prefix **${cmd.prefix}**, available commands are :
  - \`sync\` (subcommand): to iteract with the remote builder (enabled : ${
    config.settings.push ? "yes" : "no"
  })
  - \`profile\`: to get user profile on remote builder
  - \`help\`: to get this help message

  You can also type \`${
    cmd.prefix
  }help <subcommand>\` to get specific subcommand instructions`;

  switch (cmd.sub) {
    case "sync":
      message = syncHelpMessage(cmd);
      break;
  }

  origin.author.send(message);
}

// generateSubcommandExample is used to generated a subcomment example message, nicely formated
export function generateSubcommandExample(
  cmd: Command,
  main: string,
  sub: string,
  example: string
) {
  return `Here is an example of the \`${sub}\` subcommand of the \`${main}\` command :
    \`\`\`${cmd.prefix}${main} ${sub} ${example}\`\`\``;
}
