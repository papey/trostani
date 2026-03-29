// tnmt.ts contains code to handle the tnmt command and tnmt subcommands

// Imports
import { ChannelType, Guild, Message, TextChannel } from "discord.js";
import { Challonge, Tournament, TournamentInterfaces } from "challonge-ts";
import { MD5 } from "crypto-js";
import { Deck } from "../scry/mtg";
import { newBuilder } from "../builders/builder";
import {
  Command,
  decklistFromAttachment,
  generateArgsErrorMsg,
  hasPermission,
  isAuthorized,
  parseArgs,
  SearchResultTooLong,
} from "./utils";
import { CmdHelp, SubHelp } from "./help";

const HASHLEN = 7;

// --- INTERFACES TO BYPASS LIBRARY RESTRICTIONS ---
interface ChallongeTournament {
  name: string;
  full_challonge_url: string;
  state: string;
  started_at: string;
  completed_at: string;
  start_at: string;
  created_at: string;
}

interface ChallongeMatch {
  id: number;
  player1_id: number;
  player2_id: number;
  round: number;
  identifier: string;
  state: string;
  scores_csv: string;
  completed_at: string | null;
}

interface ChallongeParticipant {
  id: number;
  display_name: string;
}

async function handleTnmt(cmd: Command, origin: Message, config: any) {
  if (
    config.settings.challonge == undefined ||
    config.settings.challonge.key == undefined
  ) {
    throw new TnmtError(
      "Challonge is not properly configured on this bot instance"
    );
  }

  // FIX: Type Narrowing for the entire command flow
  if (!origin.guild || !origin.member) {
    return;
  }

  const chlg = new Challonge(config.settings.challonge.key);

  switch (cmd.sub) {
    case "create":
      await handleCreate(
        cmd,
        origin,
        chlg,
        config.settings.challonge,
        config.settings.challonge.parent
      );
      break;
    case "list":
      await handleList(cmd, origin, chlg);
      break;
    case "join":
      await handleJoin(
        cmd,
        origin,
        chlg,
        config.settings.challonge,
        config.settings.builder
      );
      break;
    case "status":
      await handleStatus(cmd, origin, chlg, config.settings.challonge);
      break;
    case "report":
      await handleReport(cmd, origin, chlg, config.settings.challonge);
      break;
    case "start":
      await handleStart(origin, chlg, config.settings.challonge);
      break;
    case "finalize":
      await handleFinalize(origin, chlg, config.settings.challonge);
      break;
    case "decks":
      await handleDecks(origin, config.settings.builder);
      break;
    default:
      throw new TnmtError(
        `\`${cmd.sub}\` is not a valid subcommand of the \`tnmt\` command (if you need help try \`${cmd.prefix}help\`)`
      );
  }
}

async function handleStart(origin: Message, client: Challonge, config: any) {
  const chan = origin.channel as TextChannel;

  if (!hasPermission(origin.member?.roles.cache, config.roles)) {
    await chan.send(`You don't have the required permissions to use this command`);
    return;
  }

  let tnmt = await tnmtFromChannel(
    origin,
    client,
    config,
    TournamentInterfaces.tournamentStateEnum.PENDING
  );

  await tnmt.randomizeParticipants();
  await chan.send(`Random rolling tournament **${getTournamentName(tnmt)}**`);
  await tnmt.startTournament();

  await chan.send(`Tournament **${getTournamentName(tnmt)}** started ! 🃏 GLHF 🃏 !`);
}

function getTournamentName(tournament: Tournament): string {
  const raw = (tournament as any).data;
  if (raw?.tournament?.name) return raw.tournament.name;
  return (tournament as unknown as ChallongeTournament).name || "Unknown Tournament";
}

function getTournamentUrl(tournament: Tournament): string {
  const raw = (tournament as any).data;
  if (raw?.tournament?.full_challonge_url) return raw.tournament.full_challonge_url;
  return (tournament as unknown as ChallongeTournament).full_challonge_url || "Unknown URL";
}

async function handleDecks(origin: Message, builder: any) {
  const chan = origin.channel as TextChannel;
  const id = tnmtIDFromChannel(origin);
  const bldr = newBuilder(builder.kind, builder.username, builder.password);

  const results = await bldr
    .login()
    .then(() => bldr.search([`Tournament: ${id}`]));

  if (results.length == 0) {
    await chan.send(`No decks found for this tournament`);
    return;
  }

  const message = results.reduce((acc, r) => `${acc}${r.title} - ${r.url}\n`, "");

  if (message.length > 2000) {
    throw new SearchResultTooLong("Tournament deck lists is too long for Discord");
  }

  await chan.send(message);
}

async function handleFinalize(origin: Message, client: Challonge, config: any) {
  const chan = origin.channel as TextChannel;

  if (!hasPermission(origin.member?.roles.cache, config.roles)) {
    await chan.send(`You don't have the required permissions to use this command`);
    return;
  }

  let tnmt = await tnmtFromChannel(
    origin,
    client,
    config,
    TournamentInterfaces.tournamentStateEnum.IN_PROGRESS
  );

  try {
    await tnmt.finalizeResults();
  } catch (error) {
    console.error(error);
    throw new TnmtError(`It's impossible to finalize a tournament containing pending matches`);
  }

  await chan.send(
    `Tournament **${getTournamentName(tnmt)}** is now finalized ! Thanks everyone ! Standings are available at ${getTournamentUrl(tnmt)}/standings`
  );
}

async function handleReport(cmd: Command, origin: Message, client: Challonge, config: any) {
  const args = parseArgs(cmd.args);
  const chan = origin.channel as TextChannel;

  if (args.length < Arguments["handleReport"]) {
    await chan.send(generateArgsErrorMsg(Arguments["handleReport"], cmd.prefix));
    return;
  }

  let tnmt = await tnmtFromChannel(
    origin,
    client,
    config,
    TournamentInterfaces.tournamentStateEnum.IN_PROGRESS
  );

  let matches = await tnmt.getMatches();
  const identifier = args[0].toUpperCase();

  let match = matches.find((m) => (m as unknown as ChallongeMatch).identifier === identifier);

  if (!match) {
    throw new TnmtError(`Match with identifer _${identifier}_ in tournament **${getTournamentName(tnmt)}** not found`);
  }

  const username = getUserFromMention(args[1], origin.guild!);
  let participants = await tnmt.getParticipants();

  const mData = match as unknown as ChallongeMatch;
  const p1 = participants.find((p) => (p as unknown as ChallongeParticipant).id === mData.player1_id);
  const p2 = participants.find((p) => (p as unknown as ChallongeParticipant).id === mData.player2_id);

  if (!p1 || !p2) {
    throw new TnmtError(`Player not found for match ${identifier}`);
  }

  let winner = participants.find((p) => (p as unknown as ChallongeParticipant).display_name == username);
  if (!winner) {
    throw new TnmtError(`Participant named _${args[1]}_ not found in tournament **${getTournamentName(tnmt)}**`);
  }

  const wData = winner as unknown as ChallongeParticipant;
  const p1Data = p1 as unknown as ChallongeParticipant;
  const p2Data = p2 as unknown as ChallongeParticipant;

  let score = wData.id == p1Data.id ? forgeScore(args[2], 1) : forgeScore(args[2], 2);

  // library specific method call
  await match.selectWinner(wData.id, score);

  await chan.send(
    `Participant **${wData.display_name}** has been set as winner of match **${args[0]}** in tournament **${getTournamentName(tnmt)}** _(score : ${p1Data.display_name} ${score} ${p2Data.display_name})_`
  );
}

export function forgeScore(score: string, winner: number) {
  const sanitize = score.replace(/\s/g, "");
  const reg = new RegExp("(\\d+)-(\\d+)");
  const res = reg.exec(sanitize);

  if (!res || res.length < 3) {
    throw new TnmtError("Score is not formated correctly, please verify and try again");
  }

  if (res[1] == res[2]) {
    throw new TnmtError("This is not a valid score, please verify and try again");
  }

  const s1 = parseInt(res[1]);
  const s2 = parseInt(res[2]);
  const inverse = winner === 1 ? s1 <= s2 : s1 >= s2;

  return inverse ? `${res[2]}-${res[1]}` : `${res[1]}-${res[2]}`;
}

function getUserFromMention(mention: string, guild: Guild) {
  const matches = mention.match(/^<@!?(\d+)>$/);
  if (!matches) return mention;

  const id = matches[1];
  let member = guild.members.cache.get(id);

  return member?.displayName || member?.user.username || mention;
}

async function handleStatus(cmd: Command, origin: Message, client: Challonge, config: any) {
  const args = parseArgs(cmd.args);
  const chan = origin.channel as TextChannel;

  let tnmt = await tnmtFromChannel(
    origin,
    client,
    config,
    TournamentInterfaces.tournamentStateEnum.IN_PROGRESS
  );

  let participants = await tnmt.getParticipants();
  let idToParticipant = new Map<number, ChallongeParticipant>();

  participants.forEach((p) => {
    const pData = p as unknown as ChallongeParticipant;
    idToParticipant.set(pData.id, pData);
  });

  let matches = await tnmt.getMatches();

  if (args[0]) {
    let matchesFilter = matches.filter((e) => (e as unknown as ChallongeMatch).round === parseInt(args[0]));
    if (matchesFilter && matchesFilter.length >= 1) {
      await chan.send(`_Here is all the matches associated with round : ${args[0]}_`);
      matches = matchesFilter;
    } else {
      await chan.send(`_Nothing found using filter **${args[0]}**, fallback to no filter mode_`);
    }
  }

  let resp = "";
  let currentRound = -1;

  matches.forEach((m) => {
    const mData = m as unknown as ChallongeMatch;
    let p1 = idToParticipant.get(mData.player1_id);
    let p2 = idToParticipant.get(mData.player2_id);

    if (!p1 || !p2) return;

    if (currentRound != mData.round) {
      resp += "\n";
      currentRound = mData.round;
    }

    if (mData.completed_at == null) {
      resp += `_Round ${mData.round}_ - **${p1.display_name} VS ${p2.display_name}** - state : ${mData.state} - identifier : ${mData.identifier}`;
    } else {
      resp += `_Round ${mData.round}_ - **${p1.display_name} VS ${p2.display_name}** - score : **${mData.scores_csv}** - state : ${mData.state} - identifier : ${mData.identifier}`;
    }
    resp += "\n";
  });

  await chan.send(resp || "No status information available.");
}

async function handleJoin(cmd: Command, origin: Message, client: Challonge, config: any, builder: any) {
  const args = parseArgs(cmd.args);
  const chan = origin.channel as TextChannel;

  let tnmt = await tnmtFromChannel(origin, client, config, TournamentInterfaces.tournamentStateEnum.PENDING);

  const member = origin.guild!.members.cache.get(origin.author.id);
  const displayName = member?.displayName || origin.author.username;

  const participants = await tnmt.getParticipants();

  for (const p of participants) {
    if ((p as unknown as ChallongeParticipant).display_name === displayName) {
      await chan.send(`Participant <@${origin.author.id}> is already registered in tournament ${getTournamentName(tnmt)}`);
      return;
    }
  }

  await chan.send(`_Processing ${displayName} decklist_`);

  let title = `[Tournament: ${tnmtIDFromChannel(origin)}] ${displayName}'s Deck`;
  if (args.length >= 1) title += ` (${args[0]})`;

  let deck = new Deck([title, `casual`, `Deck played by ${displayName} during tournament ${getTournamentName(tnmt)}`]);

  const fromAttachment = await decklistFromAttachment(origin);
  await deck.buildDeck(fromAttachment || cmd.extra, true);

  const bldr = newBuilder(builder.kind, builder.username, builder.password);
  const synced = await bldr.login().then(() => bldr.pushDeck(deck));

  await tnmt.newParticipant({ name: displayName, misc: synced.url }).catch(async (error) => {
    console.info(`Deck : ${synced.id}, deleted due to tnmt error`);
    await bldr.deleteDeck(synced.id);
    throw error;
  });

  const tData = tnmt as unknown as ChallongeTournament;
  await chan.send(`Registration successfull for user <@${origin.author.id}> in tournament ${tData.full_challonge_url || getTournamentUrl(tnmt)}, deck list is available at ${synced.url}`);
}

async function handleList(cmd: Command, origin: Message, client: Challonge) {
  const limit = 10;
  let params = {};

  const query = cmd.args.toLowerCase();
  if (query.includes("pending")) params = { state: TournamentInterfaces.tournamentStateEnum.PENDING };
  else if (query.includes("complete")) params = { state: TournamentInterfaces.tournamentStateEnum.ENDED };
  else if (query.includes("underway")) params = { state: TournamentInterfaces.tournamentStateEnum.IN_PROGRESS };

  let all = await client.getTournaments(params);
  all = all.reverse();

  let parts: string[] = [];
  let len = Math.min(all.length, limit);

  for (let index = 0; index < len; index++) {
    parts.push(generateListLine(all[index]));
  }

  const chan = origin.channel as TextChannel;
  if (parts.length == 0) await chan.send(`Sorry, there is no entry matching the request`);
  else await chan.send(parts.join("\n"));
}

function generateListLine(t: Tournament) {
  const url = getTournamentUrl(t);
  const tData = (t as any).data.tournament;
  let base = `**${getTournamentName(t)}** - Code : _${getCode(url)}_ - ${url}`;

  let dateStr: string;
  const state = tData.state;

  if (state === "complete") {
    dateStr = `started at **${new Date(tData.started_at).toDateString()}** and completed at **${new Date(tData.completed_at).toDateString()}**`;
  } else if (state === "underway") {
    dateStr = `started at **${new Date(tData.started_at).toDateString()}**`;
  } else if (state === "pending") {
    dateStr = `starting at **${new Date(tData.start_at).toDateString()}** | **${new Date(tData.start_at).toTimeString()}**`;
  } else {
    dateStr = `created at **${new Date(tData.created_at).toDateString()}**`;
  }

  return `${base} - ${state} - ${dateStr}`;
}

async function handleCreate(cmd: Command, origin: Message, client: Challonge, config: any, parent: string) {
  const chan = origin.channel as TextChannel;

  if (!isAuthorized(chan.id, config.channels)) {
    await chan.send(`This command cannot be used on this channel`);
    return;
  }

  if (!hasPermission(origin.member?.roles.cache, config.roles)) {
    await chan.send(`You don't have the required permissions to use this command`);
    return;
  }

  const args = parseArgs(cmd.args);
  if (args.length < Arguments["handleCreate"]) {
    await chan.send(generateArgsErrorMsg(Arguments["handleCreate"], cmd.prefix));
    return;
  }

  await create(args, origin, client, parent);
}

function tnmtIDFromChannel(origin: Message): string {
  const ch = origin.channel as TextChannel;
  const parts = ch.name.split("-");
  if (parts.length <= 2 || parts[0] != "tnmt") {
    throw new TnmtError("This is not a tournament channel");
  }
  return parts[1];
}

async function tnmtFromChannel(origin: Message, client: Challonge, config: any, state: TournamentInterfaces.tournamentStateEnum): Promise<Tournament> {
  const id = tnmtIDFromChannel(origin);
  const found = await findTournament(id, client, state);
  // Re-instantiate using the specific raw data key required by the constructor
  return new Tournament(config.key, (found as any).data);
}

function parseTnmtType(input: string): TournamentInterfaces.tournamentTypeEnum {
  switch (input.toUpperCase()) {
    case "SW": return TournamentInterfaces.tournamentTypeEnum.SWISS;
    case "DE": return TournamentInterfaces.tournamentTypeEnum.DOUBLE_ELIMINATION;
    case "SE": return TournamentInterfaces.tournamentTypeEnum.SINGLE_ELIMINATION;
    case "RR": return TournamentInterfaces.tournamentTypeEnum.ROUND_ROBIN;
    default: throw new TnmtError(`Tournament type ${input} is not supported`);
  }
}

function parseDate(input: string): Date | null {
  const regex = /(\d{4})-(\d{2})-(\d{2}) at (\d{2}):(\d{2})/;
  const res = regex.exec(input);
  if (!res) return null;

  return new Date(parseInt(res[1]), parseInt(res[2]) - 1, parseInt(res[3]), parseInt(res[4]), parseInt(res[5]));
}

async function createTnmtChannel(origin: Message, name: string, code: string, category: string) {
  return await origin.guild!.channels.create({
    name: `tnmt-${code}-${name}`,
    type: ChannelType.GuildText,
    parent: category,
  });
}

async function create(args: string[], origin: Message, client: Challonge, category: string) {
  const code = generateCode(args[0]);
  const name = generateName(args[0], args[3]);

  let meta: any = {
    accept_attachments: true,
    description: args[1],
    tournament_type: parseTnmtType(args[2]),
    name: name,
    url: code,
  };

  if (args[4]) {
    let date = parseDate(args[4]);
    if (!date) {
      await (origin.channel as TextChannel).send(`Warning, date used is not in a valid format and will not be used`);
    } else {
      meta.start_at = date;
    }
  }

  const tnmt = await client.createTournament(meta).catch((e) => {
    if (e.response?.status == 422) {
      throw new TnmtError("A tournament with the same ID already exists on Challonge");
    }
    throw e;
  });

  const channel = await createTnmtChannel(origin, args[0], code, category);
  const tData = tnmt as unknown as ChallongeTournament;
  await (origin.channel as TextChannel).send(`Tournament **${args[0]}** created and available at ${tData.full_challonge_url}, you can now use the channel <#${channel.id}>`);
}

function generateCode(name: string) {
  return MD5(name).toString().slice(0, HASHLEN);
}

function getCode(url: string): string {
  return url.split("/").pop() || "";
}

function generateName(name: string, format: string): string {
  return `[Format: ${format.toUpperCase()}] ${name}`;
}

async function findTournament(id: string, client: Challonge, status: TournamentInterfaces.tournamentStateEnum): Promise<Tournament> {
  let tnmts = await client.getTournaments({ state: status });
  let found = tnmts.find((t) => getCode(getTournamentUrl(t)) == id);

  if (!found) {
    throw new TnmtError(`There is no tournament with status '${status}' associated with id '${id}'.`);
  }
  return found;
}

let Arguments: { [f: string]: number } = {
  handleCreate: 4,
  handleReport: 3,
};

class TnmtHelp implements CmdHelp {
  cmd = "tnmt";
  help: string;
  sub: { [subcmd: string]: SubHelp } = {};
  request: Command;

  constructor(cmd: Command) {
    this.sub["create"] = new SubHelp("create", "<name> // <description> // <type> // <format> // <date>", "create a tournament (**admin only**)", "Tourney // Desc // SW // Modern // 2020-11-07 at 17:00");
    this.sub["start"] = new SubHelp("start", "", "start a tournament (**admin dedicated channel**)", "");
    this.sub["finalize"] = new SubHelp("finalize", "", "finish a tournament (**admin dedicated channel**)", "");
    this.sub["list"] = new SubHelp("list", "<filter>", "list tournaments", "pending");
    this.sub["join"] = new SubHelp("join", "<description> [... decklist... ]", "join a tournament (**dedicated channel**)", "Deck\n4 CardName (SET) 123");
    this.sub["status"] = new SubHelp("status", "<round>", "get status (only underway, **dedicated channel**)", "status 2");
    this.sub["decks"] = new SubHelp("decks", "", "list all decks (**dedicated channel**)", "");
    this.sub["report"] = new SubHelp("report", "<id> // <winner> // <score>", "report match result (**dedicated channel**)", "A // @Winner // 2-1");

    this.request = cmd;
    this.help = `Using command \`${this.request.prefix}${this.cmd}\`, available subcommands are :\n`;
    for (const k in this.sub) this.help += `- ${this.sub[k].generate()}\n`;
  }

  handle(): string {
    for (const key in this.sub) {
      if (this.request.args.includes(key)) {
        return `\`\`\`${this.request.prefix}${this.request.sub} ${this.request.args} ${this.sub[key].example}\`\`\``;
      }
    }
    return this.help;
  }
}

class TnmtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Tournament Error";
  }
}

export { handleTnmt, TnmtHelp };
