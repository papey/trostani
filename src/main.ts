// main.ts, file containing main logic

// Imports
// Main bot class
import { Trostani } from "./bot";
// Manastack builder tool

// Argument parsing
import * as yargs from "yargs";

// Args and cli setup
let args = yargs
  .scriptName("Trostani")
  .version("0.2.2")
  .help()
  .option("config", {
    alias: "c",
    demand: false,
    default: "/etc/trostani/settings.yml",
  }).argv;

// Create object, using config file from args
const bot: Trostani = new Trostani(args.config);

// Ready ? Set ! Go !
bot.start();
