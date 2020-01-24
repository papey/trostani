// profile.ts contains code handling the profile command

// Imports
import { Message } from "discord.js";
import { Manastack } from "../builders/manastack";

// Functions
// handleProfile is triggered when a used enter the profile command
export function handleProfile(config: any, origin: Message) {
  // If ManaStack is used
  if (
    config.settings.builder.kind &&
    config.settings.builder.kind == "manastack"
  ) {
    let ms = new Manastack(
      config.settings.builder.username,
      config.settings.builder.password,
      config.settings.builder.url,
      config.settings.builder.profile
    );

    origin.channel.send(ms.getProfile());

    // early return
    return;
  }

  // If no builder is configurated
  origin.channel.send("Looks like there is no builder configurated");
}
