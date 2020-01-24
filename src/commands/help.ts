// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";
import { Command } from "./utils";
import { pushExample, searchExample } from "../examples";

// handleHelp is triggered when a used asks for the help command
export function handleHelp(cmd: Command, origin: Message) {
  let message = `Using prefix **${cmd.prefix}**, available commands are :
  - \`push\`: to push a decklist to the remote builder (on specified channels)
  - \`search\`: to search for a decklist posted to the remote builder
  - \`profile\`: to get user profile on remote builder
  - \`help\`: to get this help message`;

  switch (cmd.sub) {
    case "push":
      message = `Here is an example of the \`${cmd.sub}\` command\n`;
      message += `\`\`\`${cmd.prefix}${cmd.sub} ${pushExample}\`\`\``;
      break;
    case "search":
      message = `Here is an example of the \`${cmd.sub}\` command\n`;
      message += `\`\`\`${cmd.prefix}${cmd.sub} ${searchExample}\`\`\``;
      break;
  }

  origin.author.send(message);
}
