// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";

// Functions
// handleProfile is triggered when a used enter the profile command
export function handleProfile(config: any, origin: Message) {
  // If ManaStack is used
  if (config.settings.builder.kind && config.settings.builder.profile) {
    // just return configured value
    origin.channel.send(config.settings.builder.profile);
    // early return
    return;
  }

  // If no builder is configurated
  origin.channel.send("Looks like there is no builder configurated");
}
