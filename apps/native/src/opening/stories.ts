/**
 * The opening flow's stories, as content. Every word, photo and number the
 * opening shows comes from here, so a story can be added or changed without
 * touching a screen. Photos are named by key; images.ts turns a key into the
 * bundled file.
 *
 * Rules from the design thread: the same six housemates turn up in every
 * story; real people's names never go on a cast face; each story keeps all
 * its slides (four, five for the crisps).
 */
import type { ImageKey } from "./images";

export type CastId = "jp" | "maya" | "theo" | "ama" | "mei" | "leo";
export type Person = { n: string; img: ImageKey; av: ImageKey; role: string; line: string; facts: string[] };
export type Beat = { img: ImageKey; e: string; h: string; cast?: boolean; chat?: { who: CastId; from: string; t: string }; note?: { who: CastId; w?: string; t: string; s: string } };
export type When = { days?: number[]; hours?: number[]; months?: number[]; dates?: number[] };
export type Kind = "A home" | "A trip" | "A workspace" | "Something else";
export type Story = {
  id: string; title: string; cat: string; kind: Kind; commune: string; cast: CastId[];
  when?: When; season?: boolean; invite?: InviteKind;
  bill: { n: string; p: number; cur?: "€"; payer: CastId; img: ImageKey };
  lines: string[]; sig: string; beats: Beat[];
};
export type GroupKey = "home" | "trip" | "night" | "work";
export type Group = { t: string; s: string; img: ImageKey; ids: string[]; kind: Kind };
export type InviteKind = "home" | "trip" | "work";
export type Invite = {
  by: string; commune: string; short: string; img: ImageKey; kind: Kind; people: string[]; facts: string[];
  owe: { amt: string; what: string };
  /** Three notifications for the reminders screen: title, line, time. {name} is the person's own name. */
  rem: Array<[string, string, string]>;
  lines: string[];
};
export type Extra = { n: string; p: number; payer: CastId };

/** Hours from a up to (not including) b, wrapping past midnight. */
const H = (a: number, b: number): number[] => { const r: number[] = []; for (let h = a; h !== b; h = (h + 1) % 24) r.push(h); return r; };

export const CAST: Record<CastId, Person> = {
  jp: {n:"Jean Phil",img:"p-jeanphil",av:"av-jeanphil",role:"The organiser",line:"Keeps the rota on a clipboard. Has never once been late with rent.",facts:["Pays with Monzo","On the bins rota","Started 14 Park Street"]},
  maya: {n:"Maya",img:"p-maya",av:"av-maya",role:"Pays first",line:"Books the table, buys the picnic, sorts it out later. Commune does the sorting now.",facts:["Pays with PayPal","Always gets the taxi","Joined by QR"]},
  theo: {n:"Theo",img:"p-sam",av:"av-sam",role:"\"I'll get you back\"",line:"Means it every time. Commune makes sure he actually does.",facts:["Pays by bank transfer","Books the five-a-side pitch","Runs a design studio"]},
  ama: {n:"Ama",img:"p-ama",av:"av-ama",role:"Does the food shop",line:"Knows the price of oat milk in three supermarkets. Scans every receipt.",facts:["Pays with Monzo","Food shop every Sunday","Scans receipts"]},
  mei: {n:"Mei",img:"p-mei",av:"av-mei",role:"Remembers birthdays",line:"Runs the gift kitty, plans the trips and never forgets a card.",facts:["Pays with Revolut","Runs the gift kitty","Plans the holidays"]},
  leo: {n:"Leo",img:"p-leo",av:"av-leo",role:"Bins? What bins?",line:"Getting better at it. The reminders help. Has never put up a tent.",facts:["Pays with Monzo","On bins tonight","Drives the road trips"]},
};

export const STORIES: Story[] = [
  { id:"crisps",title:"The missing crisps",cat:"Home",kind:"A home",commune:"14 Park Street",cast:["jp","maya","theo","ama","mei","leo"], bill:{n:"Picnic in the park",p:4860,payer:"maya",img:"picnic"},lines:["Counting the crisps again","Reading the sticky notes on the fridge","Asking Jean Phil for the clipboard","Reminding Leo about the bins"],sig:"Finding the crisps",
    beats: [
      {img:"picnic",e:"This is 14 Park Street",h:"Six friends. One house. A lot of shared crisps.",cast:true},
      {img:"fridge",e:"Every house knows this bit",h:"Somebody always pays. Nobody remembers who.",chat:{who:"jp",from:"House chat",t:"Who ate my crisps. That's £3.40. Again."}},
      {img:"chips",e:"So Jean Phil started a commune",h:"Now every crisp is counted. Kindly.",note:{who:"jp",t:"Jean Phil added Crisps",s:"£3.40 between four. Theo owes 85p."}},
      {img:"bench",e:"Bills, chores, plans",h:"The house admin, finally calm.",note:{who:"jp",w:"Tonight",t:"Bins go out tonight",s:"Leo's turn. Jean Phil has it on the clipboard."}},
      {img:"shadowbox",e:"By Sunday",h:"All square. Back to the good bits.",note:{who:"theo",t:"Theo paid Jean Phil 85p",s:"Everyone at 14 Park Street is square."}},
    ] },
  { id:"taxi",title:"The taxi home",cat:"Night out",kind:"Something else",commune:"Friday nights",cast:["maya","theo","ama","leo","jp"], when: { days: [5,6], hours: H(21, 4) }, bill:{n:"Taxi home",p:3800,payer:"maya",img:"taxi-b"},lines:["Finding Maya's other earring","Counting heads for the taxi","Ordering chips on the way home","Charging Leo's phone"],sig:"Finding the taxi",
    beats: [
      {img:"taxi-a",e:"Friday, 11:52pm",h:"Friday night. Nobody is thinking about money.",cast:true},
      {img:"taxi-b",e:"1:48am",h:"One card pays for the taxi. Again.",chat:{who:"maya",from:"Night out",t:"Taxi was £38. Sort me out tomorrow x"}},
      {img:"taxi-f",e:"So Maya used Commune",h:"Split before anyone is home.",note:{who:"maya",t:"Maya added Taxi home",s:"£38.00 between five. £7.60 each."}},
      {img:"taxi-c",e:"Saturday brunch",h:"By brunch, everyone is square.",note:{who:"theo",t:"Everyone paid Maya back",s:"Taxi home, £38.00. All square."}},
    ] },
  { id:"villa",title:"The villa",cat:"Holiday",kind:"A trip",commune:"Lisbon in June",cast:["maya","mei","theo","ama","leo"],invite:"trip", when: { months: [5,6,7,8] }, bill:{n:"Boat trip",p:24000,cur:"€",payer:"mei",img:"villa-b"},lines:["Converting euros to pounds","Finding the villa keys","Reapplying the sun cream","Asking who booked the boat"],sig:"Packing the souvenirs",
    beats: [
      {img:"villa-a",e:"Lisbon, day one",h:"Five friends. One villa. A lot of euros.",cast:true},
      {img:"villa-b",e:"Day four",h:"Who paid for the boat? And was that in euros?",chat:{who:"mei",from:"Lisbon 2026",t:"Who paid for the boat?? And is that euros or pounds"}},
      {img:"villa-f",e:"So Mei used Commune",h:"Every receipt, every currency, one answer.",note:{who:"mei",t:"Mei added Boat trip",s:"€240 between five. €48 each, shown in pounds too."}},
      {img:"villa-c",e:"Last day",h:"Come home with photos, not maths.",note:{who:"leo",t:"Lisbon is settled",s:"Everyone is square. Book the next one."}},
    ] },
  { id:"lunch",title:"The team lunch",cat:"Work",kind:"A workspace",commune:"Theo's studio",cast:["theo","ama","mei","leo"],invite:"work", when: { days: [1,2,3,4,5], hours: H(9, 16) }, bill:{n:"Team lunch",p:9640,payer:"ama",img:"work-b"},lines:["Refilling the coffee machine","Finding the good pens","Booking the meeting room","Asking who took the stapler"],sig:"Splitting the biscuits",
    beats: [
      {img:"work-a",e:"Theo's studio, Tuesday",h:"Four people. One coffee machine. A lot of lunches.",cast:true},
      {img:"work-b",e:"1:15pm",h:"The bill arrives. Everyone finds their phone interesting.",chat:{who:"ama",from:"Studio",t:"I got the last two lunches. Just saying."}},
      {img:"work-f",e:"So Ama used Commune",h:"Lunch splits itself. Even the steak.",note:{who:"ama",t:"Ama added Team lunch",s:"£96.40. Theo had the steak, so his share is bigger."}},
      {img:"work-c",e:"3pm",h:"Lunch is just lunch again.",note:{who:"theo",t:"Theo paid Ama £31.20",s:"The studio is square."}},
    ] },
  { id:"festival",title:"The festival",cat:"Festival",kind:"A trip",commune:"Festival crew",cast:["leo","maya","ama","theo"],invite:"trip", when: { months: [5,6,7], days: [4,5,6,0] }, bill:{n:"Festival tickets",p:81200,payer:"theo",img:"fest-a"},lines:["Finding the tent pegs","Drying Leo's socks","Learning the words","Queueing for the loo"],sig:"Finding the tent",
    beats: [
      {img:"fest-a",e:"Three days in a field",h:"One tent. Four friends. Leo has never camped.",cast:true},
      {img:"fest-b",e:"It is raining",h:"The tickets were £812. Nobody has paid Theo.",chat:{who:"theo",from:"Festival",t:"Tickets were £812 for four. Leo, that includes you."}},
      {img:"fest-f",e:"So Theo used Commune",h:"Everyone sees their share. Leo too.",note:{who:"theo",t:"Theo added Festival tickets",s:"£812 between four. £203 each."}},
      {img:"fest-c",e:"Sunday, sunset",h:"All square before the headliner.",note:{who:"leo",t:"Leo paid Theo £203",s:"Everyone is square. Leo still can't do tents."}},
    ] },
  { id:"birthday",title:"The secret kitty",cat:"Birthday",kind:"Something else",commune:"Leo's 30th",cast:["mei","ama","theo","maya","leo"], bill:{n:"Leo's present",p:7500,payer:"mei",img:"bday-b"},lines:["Hiding the present","Wrapping the record player","Lighting the candles","Keeping it secret from Leo"],sig:"Finding the birthday card",
    beats: [
      {img:"bday-a",e:"Leo turns 30 on Saturday",h:"He has no idea what is coming.",cast:true},
      {img:"bday-b",e:"Thursday",h:"Five friends. One present. Who is chasing who?",chat:{who:"mei",from:"Leo's 30th (no Leo)",t:"£15 each for the record player? Need it by Thursday."}},
      {img:"bday-f",e:"So Mei started a kitty",h:"Everyone chips in. Leo can't see a thing.",note:{who:"mei",t:"Mei started a kitty",s:"Leo's present. Five of five are in."}},
      {img:"bday-c",e:"Saturday",h:"He cried a bit. Nobody had to chase anyone.",note:{who:"ama",t:"The kitty is complete",s:"£75 for Leo's present. All square."}},
    ] },
  { id:"rent",title:"Rent day",cat:"Home",kind:"A home",commune:"14 Park Street",cast:["jp","leo","theo","maya","ama"],invite:"home", when: { dates: [28,29,30,31,1,2,3] }, bill:{n:"Rent",p:245000,payer:"jp",img:"rent-a"},lines:["Checking the rent went out","Reading the meter","Asking about the boiler","Finding the landlord's email"],sig:"Counting the pennies",
    beats: [
      {img:"rent-a",e:"The first of the month",h:"Jean Phil is up early. It is rent day.",cast:true},
      {img:"rent-b",e:"8:40am",h:"Rent goes at nine. Two shares are missing.",chat:{who:"jp",from:"14 Park Street",t:"Rent goes out at 9. Two of you haven't sent your share."}},
      {img:"rent-f",e:"So Jean Phil used Commune",h:"Everyone sees their share. Nobody has to ask.",note:{who:"jp",t:"Rent for this month",s:"£2,450 between five. Every share is in."}},
      {img:"rent-c",e:"9:01am",h:"Rent day, without the awkward bit.",note:{who:"jp",t:"Rent has gone out",s:"14 Park Street is square for the month."}},
    ] },
  { id:"roast",title:"Sunday dinner",cat:"Home",kind:"A home",commune:"14 Park Street",cast:["ama","leo","mei","jp","theo","maya"],invite:"home", when: { days: [0], hours: H(9, 22) }, bill:{n:"Food shop",p:8640,payer:"ama",img:"roast-a"},lines:["Peeling the potatoes","Warming the plates","Making the gravy","Finding the big dish"],sig:"Carving the chicken",
    beats: [
      {img:"roast-a",e:"Sunday, 11am",h:"Ama did the big shop. Again.",cast:true},
      {img:"roast-b",e:"4pm",h:"Six people, one roast, one very long receipt.",chat:{who:"ama",from:"14 Park Street",t:"Shop was £86.40. Receipt's on the fridge."}},
      {img:"roast-f",e:"So Ama scanned it",h:"One photo of the receipt. Split six ways.",note:{who:"ama",t:"Ama scanned a receipt",s:"Food shop, £86.40. £14.40 each."}},
      {img:"roast-c",e:"7pm",h:"Sunday dinner, sorted.",note:{who:"leo",t:"Leo paid Ama £14.40",s:"Everyone is square. Leo is still carving."}},
    ] },
  { id:"football",title:"Five-a-side",cat:"Sport",kind:"Something else",commune:"Wednesday five-a-side",cast:["theo","leo","jp","maya"], when: { days: [1,2,3,4], hours: H(17, 23) }, bill:{n:"Pitch hire",p:6000,payer:"theo",img:"foot-a"},lines:["Pumping up the ball","Finding the bibs","Picking teams fairly","Stretching Jean Phil's hamstrings"],sig:"Finding the other shin pad",
    beats: [
      {img:"foot-a",e:"Wednesday night",h:"The floodlights are on. Jean Phil is in goal.",cast:true},
      {img:"foot-b",e:"Full time",h:"Theo has paid for the pitch since March.",chat:{who:"theo",from:"Wednesday five-a-side",t:"Pitch is £60 a week. I've paid since March. Just saying."}},
      {img:"foot-f",e:"So Theo used Commune",h:"It repeats every week. Nobody forgets.",note:{who:"theo",t:"Theo set Pitch hire to repeat",s:"£60 every Wednesday. £15 each."}},
      {img:"foot-c",e:"Next Wednesday",h:"Theo just plays now.",note:{who:"jp",t:"Jean Phil paid Theo £15",s:"The team is square this week."}},
    ] },
  { id:"roadtrip",title:"The road trip",cat:"Trip",kind:"A trip",commune:"Cornwall road trip",cast:["leo","maya","theo","ama"],invite:"trip", when: { days: [6,0], hours: H(6, 13) }, bill:{n:"Petrol and pasties",p:9500,payer:"leo",img:"road-b"},lines:["Checking the tyre pressure","Choosing the playlist","Finding the services","Folding the map wrong"],sig:"Finding the car keys",
    beats: [
      {img:"road-a",e:"Saturday, 8am",h:"Cornwall or bust.",cast:true},
      {img:"road-b",e:"Somewhere near Exeter",h:"Leo filled up. And bought everyone a pasty.",chat:{who:"leo",from:"Road trip",t:"Petrol was £74. Also I bought pasties."}},
      {img:"road-f",e:"So Leo used Commune",h:"Petrol and pasties, split before the next junction.",note:{who:"leo",t:"Leo added Petrol and pasties",s:"£95 between four. £23.75 each."}},
      {img:"road-c",e:"Sunset",h:"Chips on the bonnet. Everyone square.",note:{who:"maya",t:"Maya paid Leo £23.75",s:"The road trip is square."}},
    ] },
  { id:"christmas",title:"Christmas at Park Street",cat:"Christmas",kind:"A home",commune:"14 Park Street",cast:["jp","mei","ama","leo","theo","maya"],season:true,invite:"home", when: { months: [11] }, bill:{n:"Tree and lights",p:6300,payer:"mei",img:"xmas-a"},lines:["Untangling the fairy lights","Pulling the crackers","Hiding the presents","Warming the mince pies"],sig:"Finding the end of the sellotape",
    beats: [
      {img:"xmas-a",e:"December",h:"The tree is up. Jean Phil has a jumper on.",cast:true},
      {img:"xmas-b",e:"21 December",h:"Tree, lights, crackers, turkey. Who paid for what?",chat:{who:"mei",from:"14 Park Street",t:"Tree £45, lights £18. Who's buying the turkey?"}},
      {img:"xmas-f",e:"So Mei used Commune",h:"Every Christmas bill in one place.",note:{who:"mei",t:"Mei added three Christmas bills",s:"£148 between six. Everyone's share is ready."}},
      {img:"xmas-c",e:"Christmas Day",h:"Paper hats on. Everyone square.",note:{who:"jp",t:"Christmas is settled",s:"Everyone at 14 Park Street is square."}},
    ] },
  { id:"movein",title:"Moving day",cat:"Home",kind:"A home",commune:"14 Park Street",cast:["maya","ama","theo","jp"],invite:"home", when: { months: [8,0] }, bill:{n:"Deposit",p:180000,payer:"maya",img:"move-b"},lines:["Finding the Allen key","Labelling the boxes","Measuring the hallway","Meeting the neighbours"],sig:"Finding the kettle",
    beats: [
      {img:"move-a",e:"Monday, moving day",h:"New flat. Four near strangers. One hallway.",cast:true},
      {img:"move-b",e:"Wednesday",h:"The deposit. The flat-pack. The Allen keys.",chat:{who:"maya",from:"New flat",t:"Deposit is £1,800. Who has the furniture receipt?"}},
      {img:"move-f",e:"So Maya started a commune",h:"Deposit and furniture, split four ways.",note:{who:"maya",t:"Maya started 14 Park Street",s:"Deposit £1,800. £450 each."}},
      {img:"move-c",e:"Friday",h:"Strangers on Monday. A house by Friday.",note:{who:"theo",t:"Theo paid Maya £450",s:"The new flat is square."}},
    ] },
];

/** "Who are you sharing with?": each answer opens one of its stories. */
export const GROUPS: Record<GroupKey, Group> = {
  home: {t:"Housemates",s:"Rent, bills, the food shop",img:"t-home",ids:["crisps","rent","roast","christmas","movein"],kind:"A home"},
  trip: {t:"Friends away",s:"Holidays, festivals, road trips",img:"villa-a",ids:["villa","festival","roadtrip"],kind:"A trip"},
  night: {t:"Nights out",s:"Taxis, rounds, birthdays",img:"taxi-a",ids:["taxi","birthday","football"],kind:"Something else"},
  work: {t:"Workmates",s:"Lunches, coffee, the studio",img:"work-a",ids:["lunch"],kind:"A workspace"},
};

/** Sample invitations, for trying an invited arrival. A real invitation brings its own commune. */
export const INVITES: Record<InviteKind, Invite> = {
  home: {by:"Priya",commune:"Flat 3, Elm Road",short:"Flat 3",img:"inv-home",kind:"A home",people:["Priya","Dan","Kemi"],facts:["3 bills this month","Bins on Thursdays","Rent split four ways"],owe:{amt:"£38.50",what:"broadband and the food shop"},rem:[["Bins go out tonight","Your turn, {name}. Dan did it last week.","18:00"],["Priya confirmed your £38.50","Broadband and the food shop. All square.","now"],["Rent goes out on Friday","Everyone's share is in. Nothing to do.","Wed"]],lines:["Finding your key on the hook","Adding you to the bins rota","Splitting the broadband four ways"]},
  trip: {by:"Hannah",commune:"Ibiza in August",short:"Ibiza",img:"inv-trip",kind:"A trip",people:["Hannah","Josh","Ola","Ruth"],facts:["Villa booked","4 bills so far","Flights on the 12th"],owe:{amt:"£212.00",what:"your share of the villa deposit"},rem:[["Flights are on the 12th","Hannah added the airport taxi. £9.50 each.","09:00"],["Josh paid you £24.00","Paella on the first night. Tap to confirm.","now"],["The villa balance is due Friday","Your share is in. Nothing to do.","Wed"]],lines:["Checking the villa has a pool","Counting the beach towels","Adding you to the boat trip"]},
  work: {by:"Sid",commune:"Northside Studio",short:"Northside",img:"inv-work",kind:"A workspace",people:["Sid","Lou","Marco"],facts:["Coffee kitty","Friday lunch","Cleaning rota"],owe:{amt:"£6.00",what:"the coffee kitty"},rem:[["Friday lunch is at 1pm","Sid booked the table for four.","11:00"],["Lou paid you £4.20","Oat milk for the kitchen. Tap to confirm.","now"],["Your turn on the dishwasher","Marco did it last week.","Thu"]],lines:["Topping up the coffee kitty","Finding you a desk","Adding you to Friday lunch"]},
};

/** Where an ad or website link was tapped; the app opens on the same story. */
export const LINKS: Record<string, string> = {"link-villa":"the villa ad on Instagram","link-taxi":"the taxi ad on Instagram","link-crisps":"the homes page on the website","link-lunch":"the work page on the website"};

/** The two more bills that make up each story's week in the worked maths. */
export const EXTRA: Record<string, Extra[]> = {
  crisps: [{n:"Crisps, the big bags",p:1260,payer:"theo"},{n:"Pizza night",p:3450,payer:"jp"}],
  taxi: [{n:"Round of drinks",p:3240,payer:"theo"},{n:"Chips on the way home",p:1450,payer:"leo"}],
  villa: [{n:"Supermarket run",p:8650,payer:"maya"},{n:"Dinner in Alfama",p:15500,payer:"theo"}],
  lunch: [{n:"Coffee beans",p:2400,payer:"theo"},{n:"Friday cake",p:1800,payer:"mei"}],
  festival: [{n:"Tent and gas",p:9600,payer:"leo"},{n:"Food for the weekend",p:7200,payer:"maya"}],
  birthday: [{n:"Birthday cake",p:3600,payer:"ama"},{n:"Balloons and banner",p:1500,payer:"theo"}],
  rent: [{n:"Council tax",p:16800,payer:"leo"},{n:"Broadband",p:3500,payer:"maya"}],
  roast: [{n:"Wine for dinner",p:2400,payer:"jp"},{n:"Gas top up",p:3000,payer:"leo"}],
  football: [{n:"New ball",p:2400,payer:"jp"},{n:"Drinks after",p:2800,payer:"leo"}],
  roadtrip: [{n:"Parking in St Ives",p:1200,payer:"maya"},{n:"Fish and chips",p:4250,payer:"theo"}],
  christmas: [{n:"Turkey and trimmings",p:5600,payer:"jp"},{n:"Crackers and mince pies",p:1800,payer:"ama"}],
  movein: [{n:"Van hire",p:9000,payer:"theo"},{n:"Takeaway on the floor",p:4000,payer:"jp"}],
};

/** People left out of a story's extra bills (Leo doesn't pay for his own birthday). */
export const LEAVE_OUT: Record<string, CastId[]> = {birthday:["leo"]};

/**
 * Where each story photo is anchored on a tall phone screen: [centre of the
 * people from 0 (left) to 1 (right), how wide the group is]. A width of 0
 * means the group fits; a wider group is drawn a little smaller with a soft
 * blurred copy of the photo behind it, so nobody is cut off.
 */
export const FOCAL: Partial<Record<ImageKey, [number, number]>> = {
  "bday-a": [0.52,0],
  "bday-b": [0.5,0.82],
  "bday-c": [0.48,0.88],
  "bday-f": [0.5,0.86],
  "fest-a": [0.5,0.84],
  "fest-b": [0.54,0.68],
  "fest-c": [0.5,0.82],
  "fest-f": [0.5,0.74],
  "foot-a": [0.5,0.76],
  "foot-b": [0.48,0.9],
  "foot-c": [0.48,0.78],
  "foot-f": [0.5,0.94],
  "move-a": [0.48,0.76],
  "move-b": [0.5,0],
  "move-c": [0.5,0.82],
  "move-f": [0.55,0.76],
  "rent-a": [0.45,0],
  "rent-b": [0.33,0],
  "rent-c": [0.5,0.74],
  "rent-f": [0.6,0.8],
  "road-a": [0.5,0.8],
  "road-b": [0.46,0.8],
  "road-c": [0.52,0.76],
  "road-f": [0.55,0.8],
  "roast-a": [0.45,0],
  "roast-b": [0.5,0.84],
  "roast-c": [0.5,0.82],
  "roast-f": [0.45,0.84],
  "taxi-a": [0.52,0.76],
  "taxi-b": [0.45,0.74],
  "taxi-c": [0.52,0.76],
  "taxi-f": [0.5,0.84],
  "villa-a": [0.48,0.76],
  "villa-b": [0.5,0.76],
  "villa-c": [0.46,0.72],
  "villa-f": [0.5,0.82],
  "work-a": [0.45,0.66],
  "work-b": [0.5,0.82],
  "work-c": [0.52,0.66],
  "work-f": [0.52,0.82],
  "xmas-a": [0.45,0],
  "xmas-b": [0.5,0.74],
  "xmas-c": [0.48,0.86],
  "xmas-f": [0.5,0.8],
  "picnic": [0.53,0.88],
  "fridge": [0.5,0.78],
  "chips": [0.49,0.86],
  "bench": [0.5,0],
  "shadowbox": [0.5,0],
};

/** Photos whose clouds sit on their own layer and drift slowly across the sky. */
export const CLOUDS: Partial<Record<ImageKey, ImageKey>> = { shadowbox: "shadowbox-clouds" };

/** Loading lines any commune can show, mixed with the story's own. */
export const GENERAL_LINES: string[] = [ "Putting the kettle on", "Rounding the pennies kindly", "Untangling who owes who", "Asking who finished the milk", "Agreeing on the thermostat", "Finding the TV remote", "Checking the rota twice", "Sorting the recycling properly", "Defrosting the group chat", "Labelling Ama's oat milk", "Watering Mei's plants", "Waiting for Theo to get you back" ];

export const CAST_NAMES = ["Jean Phil", "Maya", "Theo", "Ama", "Mei", "Leo"];
