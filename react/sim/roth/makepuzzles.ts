// Turn chosen candidates (from puzzlegen.ts) into the game's board puzzles, checking each answer exactly.
//   npx tsx sim/roth/makepuzzles.ts candidates.json > src/games/roth/puzzles/boards.json
import { readFileSync } from "node:fs";
import { cloneState, nextDecision } from "../../src/games/roth/engine/engine";
import { optionValues, packState, unpackState } from "../../src/games/roth/puzzles/position";
import { optionLabel } from "../../src/games/roth/text";

interface Pick { set: "draft" | "play" | "combat"; idx: number; id: string; level: string; title: string; question: string; expect: string; explain: string }

const PICKS: Pick[] = [
  // ---- drafting: the other spots are settled and nobody acts in the Playing turn
  { set: "draft", idx: 33, id: "d-tathlum", level: "Beginner", title: "The stone that killed Balor", expect: "Place The tathlum",
    question: "You place the last support, at spot 12, behind Lugh. In the second duel Lugh meets Balor of the Evil Eye. Which card?",
    explain: "The tathlum: Strike 1, +2 against a hero of Valour 5 or more. Lugh counts every support as his Focus (+1), and Water is both Balor's Weakness (+1) and strong against his Fire Focus (+1): 6 in all. Lugh strikes first, so Balor falls before his Evil Eye opens. No other card fells him, and then the gaze of Balor fells Lugh." },
  { set: "draft", idx: 1, id: "d-club", level: "Intermediate", title: "Finish the job", expect: "Place Club of the Fomóire",
    question: "Conall's Gáe Bolga will fell Cethlenn in the first duel, so Indech must fell Cú Chulainn to keep you level. Which support goes behind Indech at spot 12?",
    explain: "Blight of the Fomóire hits Cú Chulainn's Weakness (Wind) and leaves him on 1, but the Brown Bull heals him back to 4. You need a second real blow: the Club of the Fomóire strikes 2 + kinship + Indech's Earth Focus = 4 and fells him. Conand's tower only blocks, and the Tribute strikes 3: one short." },
  { set: "draft", idx: 9, id: "d-wave", level: "Intermediate", title: "Through the sealskin", expect: "Place Clíodhna's wave",
    question: "Merrow against Merrow. Manannán (spot 10) meets Fand in the second duel, and Fand has Sealskin behind her. Which support goes at spot 12?",
    explain: "Fand will raise Sealskin (Shield 3, +1 for kinship) before your last blow lands. Only Clíodhna's wave ignores Shield, so only it can fell her. Undertow, Riptide and the soul cage all break on the Shield, and the match goes to Fand's side on wounds." },
  { set: "draft", idx: 3, id: "d-thunder", level: "Intermediate", title: "Fell them both", expect: "Place Thunder feat",
    question: "Cú Chulainn will fell Medb in the first duel, so you're winning. In the second duel Conall meets Fergus, with Láeg behind him. What goes at spot 12 to win by the most?",
    explain: "Láeg heals and adds 1 to Conall's next Strike. Follow it with Thunder feat: 2 + kinship + Láeg's 1 + Conall's +1 against a hero of Valour 5 = 5, through any Shield. Fergus falls too. The Brown Bull or a Salmon leap keep Conall healthier, but fell nobody." },
  { set: "draft", idx: 16, id: "d-pearl", level: "Advanced", title: "Mind the wave", expect: "Place Pearl of the deep",
    question: "Your Coomara will fell Fand in the first duel, so you lead. Your own Fand (spot 10) meets Manannán, who holds Clíodhna's wave. Which support at spot 12?",
    explain: "Leading, Fand only has to survive. Clíodhna's wave ignores Shield, so Sealskin won't save her, and striking hard is no use against Manannán's cloak (the first Strike against him misses). Pearl of the deep heals Fand from 3 to 5, out of the wave's reach. Any Strike card leaves her on 3 for the wave to fell." },
  // ---- the Playing turn: after your action, everyone holds and the duels are fought
  { set: "play", idx: 9, id: "p-kingsdue", level: "Advanced", title: "The king's long reach", expect: "Supplant Thunder feat with Pearl of the deep",
    question: "Last step of the Playing turn. You face spot 6, Thunder feat, behind Conall. Lí Ban fights Conchobar in the first duel. What do you do?",
    explain: "Thunder feat sits in Conall's quadrant, but Conchobar's King's due lets him borrow it in the first duel, and with the Muster of the Red Branch it pierces Lí Ban's Shield and fells her. Supplant it with Pearl of the deep: a heal can't hurt you. Turning the flood tide or holding leaves Conchobar his blow." },
  { set: "play", idx: 26, id: "p-oath", level: "Advanced", title: "One more point", expect: "Swear Champion's oath on The Morrígan (spot 10)",
    question: "Last step of the Playing turn. In the second duel the Morrígan meets Bres, who has Tory's tower (Shield 1 at the start). What do you do?",
    explain: "The Morrígan shape-shifts to Water and hurls the tathlum: 1 + kinship + Focus + her own +1 = 4, but Bres's Shield 1 leaves him on 1. The Champion's oath adds 1 to her Strikes and fells him. Its vow (never rest) costs her nothing here. The Druid's oath, or an oath on the Dagda, doesn't add that point." },
  { set: "play", idx: 60, id: "p-mantle", level: "Intermediate", title: "A cloak against the spasm", expect: "Turn Brigid's mantle on Conchobar mac Nessa (spot 7)",
    question: "Ulster against Ulster. Your Conchobar (spot 7) meets Emer, who strikes first and holds the warp-spasm. Last step of the Playing turn: what do you do?",
    explain: "The warp-spasm strikes 4 + kinship + Conchobar's Weakness to Fire = 6, and Culann's hound takes 1: exactly his 5 Valour. Brigid's mantle on Conchobar adds Shield 1, so the warp-spasm no longer kills. Emer turns to Gáe Bolga, which only wounds, and Conchobar's Thunder feat fells her. The Champion's oath adds Strike, but he'd never swing." },
  { set: "play", idx: 10, id: "p-hold", level: "Intermediate", title: "Nothing to give", expect: "Hold",
    question: "Sídhe against Sídhe. You face spot 12: Fragarach, behind the enemy's Lugh. Your hand: the harp of the Dagda, the spear of Assal, the Geis of the open door. What do you do?",
    explain: "Every support in your hand is Sídhe, so whatever you put in Lugh's quadrant fights for him, with kinship. The harp would heal him and add 1 to his next Strike; the spear of Assal hits harder than Fragarach. You face a support, so the geis can't be laid. Hold, and leave him the card he has." },
  { set: "play", idx: 52, id: "p-crow", level: "Intermediate", title: "Starve the healers", expect: "Turn The Morrígan's crow",
    question: "Last step for you (assume the Merrow then hold). The Merrow have Dian Cécht's well, the soul cage and the flood tide. You're behind on the long count. What do you do?",
    explain: "In a long fight the Merrow heal past you. The Morrígan's crow forbids every Heal (a hero who breaks it pays 2 Valour), and the race comes out level instead of lost: a draw, then the round runs backwards. The Mist of the druids lets you strike first, but striking first doesn't outpace their healing." },
  // ---- combat: both sides play perfectly from here
  { set: "combat", idx: 42, id: "c-free", level: "Beginner", title: "A free blow", expect: "Use Thunder feat",
    question: "Cú Chulainn meets Conchobar and strikes first. Which support?",
    explain: "Both feats fell Conchobar at once: Thunder feat strikes 2 + kinship + Cú's Fire Focus + his own +1 + Conchobar's Weakness to Fire = 6. But the warp-spasm costs Cú 1 Valour, and this match is decided on wounds after the second duel. Take the free blow." },
  { set: "combat", idx: 6, id: "c-cloak", level: "Beginner", title: "The cloak of mist", expect: "Use Sealskin",
    question: "Cú Chulainn meets Manannán mac Lir and strikes first. Which support?",
    explain: "The first Strike against Manannán each duel misses. Throw the warp-spasm now and it's swallowed by his cloak (and costs Cú 1), leaving him open to the soul cage and Thunder feat. Raise Sealskin first: Cú stays standing, and Conall wins the second duel." },
  { set: "combat", idx: 56, id: "c-wall", level: "Intermediate", title: "Don't break into a wall", expect: "Rest",
    question: "The Morrígan (3 Valour, sworn to the Druid's oath: no Weapons) meets Ferdiad behind Shield 4. Your supports are Weapons. What do you do?",
    explain: "Breaking the Druid's oath costs 2 of her 3 Valour, and Goibniu's forge or the tathlum would mostly hit Shield. Rest: Lugh wins the second duel's exchange, the Morrígan only has to stay standing, and you win on wounds." },
  { set: "combat", idx: 2, id: "c-price", level: "Intermediate", title: "Worth the price", expect: "Break the geis or oath and use The gaze of Balor",
    question: "Second duel. Cethlenn (3 Valour) meets Emer (Brigid's mantle: Shield 1) and strikes first. The Geis of the hearth forbids Fire. What do you do?",
    explain: "Breaking the geis costs Cethlenn 2 of her 3 Valour. Pay it: the gaze of Balor strikes 2 + kinship + Cethlenn's +1 + Emer's Weakness to Fire + the Samhain tribute = 6. Culann's hound and the mantle take 2, and Emer falls before she can act. Anything else, and Emer's Thunder feat fells Cethlenn." },
  { set: "combat", idx: 16, id: "c-riastrad", level: "Advanced", title: "The Ríastrad", expect: "Use Stones of Octriallach",
    question: "Cú Chulainn is down to 1 Valour against Cethlenn (4). He is sworn to the Blood-oath. What does he do?",
    explain: "At 1 Valour, Cú Chulainn's Ríastrad adds 2 more to his Strikes, and the Blood-oath adds 2. The Stones of Octriallach (supplanted in by the Fomóire, but not Unwilling for an Ulsterman) strike 1 + 1 + 2 + 2 = 6, and Cethlenn falls. Ochain's Shield only delays her Blight, which fells him." },
  { set: "combat", idx: 46, id: "c-borrow", level: "Advanced", title: "The king borrows", expect: "Use Gáe Bolga",
    question: "Conchobar is on 1 Valour against Lugh (4), sworn to the Blood-oath: no Heals, never rest. What does he do?",
    explain: "Conchobar's King's due lets him use one unused support from Cú Chulainn's quadrant. Gáe Bolga there ignores Shield: 2 + kinship + the Blood-oath's 2 = 5, and Lugh falls now. Shields only delay Lugh's next blow, and breaking the oath to heal costs 2 Valour he doesn't have." },
];

const file = process.argv[2];
const cands = JSON.parse(readFileSync(file, "utf8")) as { kind: string; state: string }[];
const bySet = (k: string) => cands.filter((c) => c.kind === k);
const out = PICKS.map((p) => {
  const S = unpackState(bySet(p.set)[p.idx].state);
  // tidy what the puzzle shows: drafting puzzles assume no Playing turn, so drop omens and spare cards
  if (p.set === "draft") {
    const me = nextDecision(cloneState(S))!.player;
    for (const P of S.players) P.omens = [];
    S.players[1 - me].hand = [];
    S.players[me].hand = S.players[me].hand.filter((c) => c.def.type === "support");
  }
  if (p.set === "combat") for (const P of S.players) P.hand = [];
  const { d, values } = optionValues(S);
  const best = Math.max(...values.filter(Number.isFinite));
  const answer = values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  const labels = d.options.map((o) => optionLabel(S, d, o));
  if (answer.length !== 1 || labels[answer[0]] !== p.expect) throw new Error(`${p.id}: best is ${answer.map((i) => labels[i])}, expected ${p.expect} (${values})`);
  const { idx: _i, expect: _e, ...rest } = p;
  return { ...rest, answer, state: packState(S) };
});
process.stdout.write(JSON.stringify(out, null, 1));
