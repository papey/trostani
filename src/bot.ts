// bot.ts file, containing all stuff needed to interact with Discord

// Imports
import { Client, Message } from "discord.js";
import { Command, handleNotSupported } from "./commands/utils";
import { handleProfile } from "./commands/profile";
import { handleHelp } from "./commands/help";
import { Deck } from "./mtg";
import { Manastack } from "./manastack";
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

  // Methods (protected)
  // Ensure push is authorized on this channel
  protected isPushAuthorized(id: string): boolean {
    if (this.config.settings.push.channels) {
      if (this.config.settings.push.channels.includes(id)) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
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
        let command = new Command(message.content, this.config.settings.prefix);
        // Execute extracted command
        switch (command.main) {
          case "push":
            // Check if channel is authorized
            if (this.isPushAuthorized(message.channel.id)) {
              // Try pushing deck
              this.push(message).catch(error => {
                this.logErrToDiscord(error, message);
              });
            }
            break;
          case "search":
            // Check if it's a DM
            if (message.channel.type == "dm") {
              this.search(command, message).catch(error => {
                this.logErrToDiscord(error, message);
              });
            } else {
              // If not, tell the original author
              message.author.send(
                "Sorry but `search` command is not available on public channels"
              );
            }
            break;
          case "profile":
            handleProfile(this.config, message);
            break;
          case "help":
            handleHelp(command, message);
            break;
          default:
            handleNotSupported(command, message);
            break;
        }
      }
    });
  }

  // logError to stdout and channel
  private logErrToDiscord(error: Error, message: Message) {
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

  private async push(m: Message) {
    // Send a nice message
    m.channel.send("_Analysing and publishing decklist_");
    try {
      // Try building the deck
      let deck = new Deck(m.content, this.config.settings.prefix);

      // Parse it
      await deck.parseDeck(m.content, this.config.settings.translate);

      // If ManaStack is used
      if (
        this.config.settings.builder.kind &&
        this.config.settings.builder.kind == "manastack"
      ) {
        let ms = new Manastack(
          this.config.settings.builder.username,
          this.config.settings.builder.password,
          this.config.settings.builder.url,
          this.config.settings.builder.profile
        );

        // Try formating the deck to ManaStack format
        let formated = deck.exportToManaStack();

        // Try creating the deck on ManaStack
        let message = await ms.newDeck(
          deck.metadata.name,
          deck.metadata.bo,
          deck.metadata.description,
          deck.metadata.format,
          formated
        );

        // Send message with error or succes
        m.channel.send(message);
      }
    } catch (error) {
      // If error, throw it
      throw error;
    }
  }

  // Search for a deck by it's name
  private async search(cmd: Command, sender: Message) {
    // If ManaStack is used
    if (
      this.config.settings.builder.kind &&
      this.config.settings.builder.kind == "manastack"
    ) {
      let ms = new Manastack(
        this.config.settings.builder.username,
        this.config.settings.builder.password,
        this.config.settings.builder.url,
        this.config.settings.builder.profile
      );

      // Forge response for Discord
      let response = await ms.formatSearch(cmd.args);

      // Send message including lists of decks or an error message
      sender.channel.send(response);
    }
  }
}
