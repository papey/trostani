// main.ts, file containing main logic

// Imports
// Main bot class
import { Trostani } from "./bot";

// Argument parsing
import yargs = require("yargs");
import { hideBin } from "yargs/helpers";

// Args and cli setup
let args = yargs(hideBin(process.argv))
  .scriptName("Trostani")
  .version("0.5.2")
  .help()
  .option("config", {
    alias: "c",
    demandOption: false,
    default: "/etc/trostani/settings.yml",
    type: "string",
  })
  .parseSync();

// Create object, using config file from args
const bot: Trostani = new Trostani(args.config);

// Ready ? Set ! Go !
bot.start();
