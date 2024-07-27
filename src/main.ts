// main.ts, file containing main logic

// Imports
// Main bot class
import { Trostani } from "./bot";

// Argument parsing
import * as yargs from "yargs";

// Args and cli setup
let args = yargs
  .scriptName("Trostani")
  .version("0.4.22")
  .help()
  .option("config", {
    alias: "c",
    demand: false,
    default: "/etc/trostani/settings.yml",
  })
  .parseSync();

// Create object, using config file from args
const bot: Trostani = new Trostani(args.config);

// Ready ? Set ! Go !
bot.start();
