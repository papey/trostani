// bot.ts file, containing all stuff needed to interact with Discord

// Imports
import { Client, Message } from "discord.js";
import { Command, handleNotSupported } from "./commands/utils";
import { handleProfile } from "./commands/profile";
import { handleHelp } from "./commands/help";
import { handleSync } from "./commands/sync";
import { handleTnmt } from "./commands/tnmt";
// Use to read yaml file
import * as YAML from "yamljs";

// Classes
// Trostani, the Discordant : the main bot class
export class Trostani {
  // Discord client
  private client: Client;
  // Bot configuration
  public config: any;

  // Constructor
  constructor(confPath: string) {
    // Config
    try {
      this.config = YAML.load(confPath);
    } catch (ENOENT) {
      console.error(`Configuration file : ${confPath} not found`);
      process.exit(1);
    }
    // Ensure all needed variables are setup by config file
    this.verifyConfig();
    // Create a Discord client class
    this.client = new Client();
  }

  // Methods (public)
  // Start
  public start(): void {
    // Basic setup
    this.setup();

    // Setup routes between commands and actions
    this.routes();

    // Setup logs outputs
    this.client.on("error", console.error);
    this.client.on("warn", console.warn);

    // Login to Discord
    this.client.login(this.config.settings.token);
  }

  // Methods (private)
  // Setup routes to commands
  private routes() {
    // When a message is received
    this.client.on("message", (message: Message) => {
      if (
        // it's not the bot who sends the original message
        message.author.id != this.client.user.id &&
        // and if the message starts with prefix
        message.content.startsWith(this.config.settings.prefix)
      ) {
        // Extract command
        const command = new Command(
          message.content,
          this.config.settings.prefix
        );
        // Execute extracted command
        switch (command.main) {
          case "tnmt":
            handleTnmt(command, message, this.config).catch((error) => {
              this.logErr(error, message);
            });
            break;
          case "sync":
            handleSync(command, message, this.config).catch((error) => {
              this.logErr(error, message);
            });
            break;
          case "profile":
            handleProfile(message, this.config);
            break;
          case "help":
            handleHelp(command, message, this.config);
            break;
          default:
            handleNotSupported(command, message);
            break;
        }
      }
    });
  }

  // logErr to stdout and channel
  private logErr(error: Error, message: Message) {
    // error goes in stdout as well as Discord channel
    console.log(error);
    // send error to Discord channel
    message.channel.send(`**${error.message}**`);
  }

  // Setup client
  private setup() {
    // When client is ready
    this.client.on("ready", () => {
      // Set activity, name and basic stuff
      if (this.config.settings.activity != undefined) {
        this.client.user.setActivity(this.config.settings.activity);
      }
      if (this.config.settings.name != undefined) {
        this.client.user.setUsername(this.config.settings.name);
      }
      // Ensure a return in logs when everything looks good
      console.log("Ready to go using the following settings : ");
      console.log(this.config.settings);
    });
  }

  // Ensure needed variable are setup in config
  private verifyConfig() {
    // settings field
    if (this.config.settings == undefined) {
      console.error(
        "Error validating config file, `settings` field is missing"
      );
      process.exit(1);
    }
    // token field
    if (this.config.settings.token == undefined) {
      console.error("Error validating config file, `token` field is missing");
      process.exit(1);
    }
    // prefix field
    if (this.config.settings.prefix == undefined) {
      console.error("Error validating config file, `prefix` field is missing");
      process.exit(1);
    }

    // builder
    if (this.config.settings.builder == undefined) {
      console.error("Error validating config file, `builder` field is missing");
      process.exit(1);
    }

    // check translate config valitity
    if (this.config.settings.translate == undefined) {
      if (this.config.settings.translate.typeof() != Boolean) {
        this.config.settings.translate = false;
        console.warn(
          "Translate function not found or not set to `True` or `False`, defaulted to `False`"
        );
      }
    }
  }
}
