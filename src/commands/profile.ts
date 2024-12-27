// profile.ts contains code handling the profile command

// Imports
import {Message, TextChannel} from "discord.js";

// handleProfile is triggered when a used enter the profile command
export function handleProfile(origin: Message, config: any) {
  const chan = origin.channel as TextChannel

  if (config.settings.builder.kind && config.settings.builder.profile) {
    chan.send(config.settings.builder.profile);
    return;
  }

  // If no builder is configurated
  chan.send("Looks like there is no builder configurated");
}
