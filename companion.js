/* Princess companion: pixel-art sprite, tiered dialogue, scenes, and poses.
 * Tier 0 = Unimpressed (bratty/sassy) ... Tier 4 = Devoted.
 * Loaded before app.js; exposes a single global: COMPANION.
 *
 * Art pipeline: SCENES[].image and POSES[].image are null placeholders.
 * Drop PNGs into art/ and set the paths here — the renderer prefers images
 * over the built-in placeholder gradients / canvas sprite automatically.
 */
window.COMPANION = (() => {
  "use strict";

  const TIERS = [
    { name: "Unimpressed", min: 0, mood: "unimpressed" },
    { name: "Curious", min: 30, mood: "neutral" },
    { name: "Friendly", min: 90, mood: "smile" },
    { name: "Fond", min: 180, mood: "happy" },
    { name: "Devoted", min: 320, mood: "love" },
  ];

  function tierOf(affection) {
    let t = 0;
    for (let i = 0; i < TIERS.length; i++) if (affection >= TIERS[i].min) t = i;
    return t;
  }

  // ---------------- Scenes (daily backdrop) ----------------
  // image: set to "art/scenes/<id>.png" when artwork is ready.

  const SCENES = [
    { id: "beach", name: "Royal Beach Day", emoji: "🏖️", sky: ["#7fd4f7", "#c8ecff"], ground: "#f7e3b0", image: null },
    { id: "bedroom", name: "Her Chambers", emoji: "🛏️", sky: ["#eddcf8", "#f9eeff"], ground: "#d9b9ec", image: null },
    { id: "garden", name: "Castle Garden", emoji: "🌸", sky: ["#c2e9ff", "#eaf8da"], ground: "#90cf80", image: null },
    { id: "throne", name: "Throne Room", emoji: "👑", sky: ["#f6dfdf", "#f1d0d0"], ground: "#caaa6b", image: null },
    { id: "library", name: "Royal Library", emoji: "📚", sky: ["#e9ddc9", "#f6efe1"], ground: "#a97d51", image: null },
    { id: "kitchen", name: "Palace Kitchen", emoji: "🧁", sky: ["#fff1e1", "#ffe5ed"], ground: "#e1b991", image: null },
    { id: "balcony", name: "Moonlit Balcony", emoji: "🌙", sky: ["#2b2b5b", "#4b4b8b"], ground: "#3b3b6b", image: null },
    { id: "hotspring", name: "Hot Springs", emoji: "♨️", sky: ["#d0efe9", "#e9f8f5"], ground: "#89c5b9", image: null },
    { id: "market", name: "Village Market", emoji: "🎪", sky: ["#ffe9c9", "#fff5dd"], ground: "#d9a979", image: null },
    { id: "meadow", name: "Butterfly Meadow", emoji: "🦋", sky: ["#c9e9ff", "#e9ffd9"], ground: "#99d989", image: null },
  ];

  // Stable scene per calendar day: she "goes somewhere" each morning.
  function sceneForDate(dateStr) {
    let h = 0;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    return SCENES[h % SCENES.length];
  }

  // ---------------- Poses (lazy princess idle activities) ----------------
  // mood picks the sprite's face until pose artwork exists.
  // image: set to "art/poses/<id>.png" when artwork is ready.

  const POSES = [
    { id: "phone", label: "scrolling her phone 📱", mood: "unimpressed", image: null },
    { id: "hair", label: "twirling her hair 💫", mood: "neutral", image: null },
    { id: "nap", label: "napping 💤", mood: "proud", image: null },
    { id: "music", label: "listening to music 🎧", mood: "smile", image: null },
    { id: "tv", label: "watching royal TV 📺", mood: "neutral", image: null },
    { id: "nails", label: "painting her nails 💅", mood: "unimpressed", image: null },
    { id: "snack", label: "nibbling royal pastries 🍰", mood: "happy", image: null },
    { id: "daydream", label: "daydreaming ☁️", mood: "smile", image: null },
  ];

  function randomPose() {
    return POSES[Math.floor(Math.random() * POSES.length)];
  }

  // ---------------- Scene & pose flavor lines ----------------
  // Occasionally swapped in for idle chatter so she reacts to where she is
  // and what she's doing. Keyed by scene/pose id.

  const SCENE_LINES = {
    beach: [
      "Uh, yeah I'm at the beach. Get over it. 🏖️",
      "Royal beach day. The ocean understands me. You could learn from the ocean.",
      "I'd say 'wish you were here' but the sand is judgmental and so am I.",
    ],
    bedroom: [
      "You're in my CHAMBERS. Knock next time. There's no door. Find one.",
      "I was this close to a world-class nap and then your face appeared.",
    ],
    garden: [
      "The roses bloomed for me today. What have YOU done for me today? 🌸",
      "Garden day. Even the butterflies have better follow-through than you.",
    ],
    throne: [
      "You stand before the throne. State your business. Is it tasks? It better be tasks. 👑",
      "Throne room day. I'm feeling extra official, so consider everything I say a decree.",
    ],
    library: [
      "Shhh. It's library day. Whisper your productivity to me. 📚",
      "I'm reading a book about people who finish what they start. Fiction, obviously.",
    ],
    kitchen: [
      "The royal bakers let me frost things today. The kingdom may not survive. 🧁",
      "I'm in the kitchen 'supervising.' Supervising means eating. Don't tell the chef.",
    ],
    balcony: [
      "Moonlit balcony. Very romantic. Very wasted on you. 🌙",
      "I count stars out here. There are more stars than your completed tasks. By a lot.",
    ],
    hotspring: [
      "Hot springs day. I'm relaxing. YOU should be working. The system works. ♨️",
      "The steam is great for royal skin. The judgment is great for your motivation.",
    ],
    market: [
      "Village market day! I pointed at things and the royal purse wept. 🎪",
      "A merchant tried to overcharge me. ME. He's a jester now. Career change.",
    ],
    meadow: [
      "Butterfly meadow. One landed on my crown. Nature recognizes rank. 🦋",
      "It's meadow day. I'm frolicking. Regally. There's a technique to it.",
    ],
  };

  const POSE_LINES = {
    phone: [
      "Sorry, I'm in my doomscroll era. 📱",
      "*scrolling* One sec, someone is wrong on the royal internet.",
      "Don't judge me — my phone has a little kingdom in it and it NEEDS me.",
    ],
    hair: [
      "*twirls hair* What? I'm thinking. This is what thinking looks like.",
      "The hair twirl is strategic. It distracts from the fact I'm doing nothing.",
    ],
    nap: [
      "*half asleep* Five more minutes... decree it... 💤",
      "I was NOT napping. I was inspecting my eyelids. For quality.",
    ],
    music: [
      "*one earbud out* Hm? Speak quickly, this is my favorite song. 🎧",
      "I'm listening to royalty-core. It's just trumpets. It slaps.",
    ],
    tv: [
      "Shh — royal TV. The peasant in this drama is about to get promoted. 📺",
      "Don't stand in front of the TV. You're not THAT interesting.",
    ],
    nails: [
      "Careful, wet nails. If you make me smudge these there will be consequences. 💅",
      "This shade is called 'Unimpressed Pink.' Named after my feelings about your streak.",
    ],
    snack: [
      "*mouth full of pastry* Whmf? I said WHMF. 🍰",
      "The tarts are for royalty. You may watch me eat them. It's an honor, actually.",
    ],
    daydream: [
      "*staring into the distance* I was somewhere better. Now I'm here. With you. ☁️",
      "I was daydreaming about a kingdom where everyone finishes their tasks. Wild fantasy stuff.",
    ],
  };

  // ---------------- Dialogue pools ----------------
  // {n} in streak lines is replaced with the streak number.
  // Some lines carry emojis and *action* beats — deliberately not all of them.

  const POOLS = {
    // Tapping her / "Talk" button — idle chatter.
    tap: [
      [
        "Oh. You're still here.",
        "*doesn't look up* I don't pay attention to loser-boys. Do a task and maybe we'll talk.",
        "Did you need something? The to-do list is *that* way. 👉",
        "Tapping me isn't a task, genius.",
        "*scoff* I'm a princess. You're... whatever this is. Know your station.",
        "Hmm? Sorry, I was thinking about literally anything else.",
        "You know what's attractive? Follow-through. You should try it sometime.",
        "Let me guess — you opened the app, felt productive, and now you're here. 🙄",
        "My last suitor slayed a dragon. You rerolled 'do the dishes' twice.",
        "I've seen glaciers with more momentum than you. 🧊",
        "Are you procrastinating by talking to me? Bold. Pathetic, but bold.",
        "*yawns* Shoo. Come back when your checkbox game improves.",
        "I rate your productivity two crowns out of ten. 👑👑 And I'm being generous.",
        "If you finish three tasks today I *might* remember your name.",
        "Wow, you can tap a screen. Truly the hero the kingdom deserves. 🫠",
        "The royal court is unimpressed. The royal court is me. I'm the court.",
        "Don't make me get the royal guard. He's a checkbox. He's very judgmental.",
        "*inspects nails* You again? Ugh. Fine. One (1) sentence of attention. That was it.",
        "I only chat with people who have streaks. Do you have a streak? Thought so.",
        "Somewhere out there, a task is crying because you keep ignoring it. 😭",
        "Is this what you do instead of your Body tasks? Explains a lot.",
        "*eye roll* A princess waits for no one. But apparently I wait for YOU. Insulting.",
        "Need some... special motivation? Sucks for you.",
        "I asked the royal oracle about your future. She laughed. Oracles shouldn't laugh.",
        "*files one (1) nail* That's how long you held my interest. One nail.",
        "You have the energy of an unsent letter. Sitting there. Doing nothing. Forever.",
        "Do you want a medal for showing up? They don't make medals that small.",
        "I've knighted BREAD with more ceremony than you deserve right now. 🍞",
        "Task list's over there. I'm over here. One of us is worth your time and it's neither until you finish something.",
        "*sips tea without offering you any* Mm. What? You've earned nothing. ☕",
        "My horoscope said I'd meet someone disappointing today. Anyway, hi.",
        "You hover like a fruit fly with commitment issues. Land on a task or leave. 🪰",
        "The dungeon has an opening. It's a metaphor. The dungeon is your to-do list. Get in.",
        "If procrastination were a kingdom you'd be its beloved king. Tragically, it isn't, and you're not.",
        "*stares* I'm trying to see the potential everyone keeps mentioning. Squinting doesn't help.",
        "Talk is free. Checkboxes cost effort. You're clearly shopping in the free section.",
        "I named a pigeon after you. It also refuses to do anything useful. 🐦",
        "Every minute you spend here, a task grows one day older and one day sadder.",
        "Royal decree: stop poking me and poke a checkbox instead.",
      ],
      [
        "Oh — it's you. I was just... not thinking about you. At all.",
        "You've been slightly less useless lately. Don't let it go to your head.",
        "I'm not saying I'm impressed. I'm saying I'm... aware of you now. 👀",
        "*twirls hair* Hmph. You're growing on me. Like moss. Very slow, mildly stubborn moss.",
        "Did you do a task today or are we just... hanging out? (We are NOT hanging out.)",
        "I checked your history. Don't be weird about it. It was for science. 🔬",
        "You have potential. Tiny. Microscopic. But the royal telescope sees it.",
        "Fine, you may stand slightly closer to the throne. Like, a step. One step.",
        "My tutors say curiosity is unbecoming of a princess. Anyway, what are you working on?",
        "If you keep this up I'll have to stop calling you loser-boy. Transitional nickname pending.",
        "*glances over* I noticed your streak. I notice everything. It's a princess thing.",
        "Some of your task names are ridiculous. I read them all. Twice. 📜",
        "You're like a stray cat that keeps coming back. ...I've started leaving food out. 🐈",
        "Don't tell anyone I said this, but watching you finish things is weirdly satisfying.",
        "I had a whole sassy line prepared and now I forgot it. This is YOUR fault.",
        "What's a 'Purpose' task anyway? Show me. Do one. Right now. For the throne. 👑",
        "Today's royal decree: log a 🌊 reset task. Your brain is dusty. I can hear it.",
        "*pretends to read* You may ask me ONE question. ...No, not that one.",
        "I mentioned you at the royal brunch. Neutrally! With only ONE eye roll. Growth.",
        "The pigeon I named after you did a trick yesterday. Raising the bar. Your move. 🐦",
        "You're at the 'noticed but not celebrated' stage. There are worse stages. You were IN them.",
        "*bookmark snaps shut* Fine, I'm listening. You have until I get bored. Starting now.",
        "I drew a tiny chart of your progress. It's less humiliating than last month's chart.",
        "Careful. Keep completing things and I might develop... expectations. 😯",
        "Royal gossip: the checkbox says you two are 'going steady.' I need details.",
        "Some days you almost impress me. Today could be one. No pressure. (Pressure.)",
        "I un-crumpled the report about you. It sits flat on the desk now. That's status.",
      ],
      [
        "Hey, you! I was hoping you'd stop by. 😊",
        "Guess who got called 'less hopeless than average' by the royal council? YOU. 🎉",
        "I saved you a seat next to the throne. It's a footstool. But it's a NICE footstool.",
        "*perks up* Tell me what you're working on today. I want details. I'm invested now.",
        "You know, you're kind of fun to root for.",
        "If anyone asks, I still think you're a disaster. A charming one, though. ✨",
        "I've upgraded you from 'loser-boy' to 'promising subject.' Ceremony pending.",
        "Do the short task first. Trust me. Momentum is a princess's best weapon. ⚔️",
        "I told the kingdom about your streak. The kingdom is a houseplant. 🪴 It was impressed.",
        "Your task titles have gotten better. 'Do stuff' walked so 'Tidy the desk' could run.",
        "*grins* Sometimes I watch the checkbox animation just for fun. Is that weird? Don't answer.",
        "You + me + three completed tasks = a genuinely good day. Just saying.",
        "I practiced a fanfare for the next time you finish something. It goes 'doot doo DOOO.' 🎺",
        "Between royal duties, I mostly just wonder what you'll pick next.",
        "Don't slack today, okay? I get bored when you slack. Princess boredom is DANGEROUS.",
        "You're my favorite subject. Don't tell the houseplant. 🤫",
        "Somebody's looking productive today. Is it you? Please say it's you.",
        "A wise ruler celebrates small wins. I am wise. Go get me a small win. 🏆",
      ],
      [
        "There you are! I missed— I mean, the THRONE missed you. Shut up. 😳",
        "I made you a medal out of pixels. It says 'Actually Does Things Now.' 🎖️",
        "You know that feeling when your favorite person opens the app? ...No reason.",
        "*fixes her crown quickly* I bragged about you to the other princesses. They're SO jealous.",
        "Sit with me a minute. The tasks can wait sixty whole seconds. I checked. ⏳",
        "Every time you complete something I do a tiny royal dance. You will never see it. 💃",
        "Okay, real talk: I'm proud of you. Don't make it a whole thing.",
        "*bites lip* If you finish your three today, I'm telling you my favorite secret. It might be you. I MEAN— next topic.",
        "The royal artist painted your portrait. It's a stick figure with a checkbox. I love it. 🖼️",
        "You've changed. In, like... a 'keeps his promises' way. It's a good look.",
        "I used to time how long you procrastinated. I stopped needing to. Growth! 🌱",
        "My crown is heavy but honestly your streak is carrying this kingdom.",
        "Come back later and tell me everything you finished. I'll act casual. I won't be.",
        "*smiles at the floor* You + a finished task list is my favorite plot twist.",
        "Whoever taught you discipline deserves a royal pardon. Wait, that was me. You're welcome.",
        "Don't work TOO hard, okay? A princess worries. Quietly. Regally. 💗",
        "I renamed the footstool. It's a chair now. It's YOUR chair.",
      ],
      [
        "My favorite notification is you. 💗",
        "The kingdom runs itself these days. I mostly just look forward to this part.",
        "You know I believed in you before the streaks, right? ...Okay, slightly before.",
        "Partner check-in: hydrated? Stretched? Emotionally stable? Complete a Body task and report back. 📋",
        "*blows kiss* I told the royal historian to write you into my chapter. Permanently. 💋",
        "Whatever you pick today, I'm with you. Even if it's the laundry. ESPECIALLY the laundry. 🧺",
        "Remember when I called you loser-boy? I keep that memory somewhere safe. For laughing purposes. Affectionately.",
        "You make finishing things look... kind of heroic, honestly. 🦸",
        "*leans on your shoulder* Two-person kingdom. You, me, and the houseplant. Okay, three-person kingdom.",
        "I don't need a dragon-slayer. Turns out I just needed someone who shows up every day.",
        "Rest is royal too, you know. If today's heavy, do one small thing and come sit with me. 🌙",
        "I'd trade the crown for your streak. Don't tell the crown. 👑",
        "Whatever happens today — you've already impressed me for a lifetime. Go anyway.",
        "You're the only one allowed to see me un-regal. Here's my un-regal face: :3",
        "Every task you finish is a tiny 'I kept my word.' That's my favorite thing about you. 💗",
        "*flustered* Go do the thing, my love— MY LIEGE. I said my liege. Anyway. Go.",
      ],
    ],

    // Completing any task.
    complete: [
      [
        "...huh. You actually did it. Weird.",
        "One task. Should I throw a parade? I will not be throwing a parade. 🎊❌",
        "*slow blink* Okay, that was mildly not-pathetic.",
        "The bar was on the floor and you... stepped over it. Congrats?",
        "Beginner's luck. Do it again and I'll consider a slow clap. 👏",
        "I blinked and you were productive. Do NOT make me blink again.",
        "Fine. FINE. That was a task. It counts. Barely. It counts.",
        "A checkbox has been checked. Alert the... no one. Alert no one.",
        "*pointedly looks away* I'm not proud of you. Your posture just improved. Coincidence.",
        "One down. The princess demands three. The princess is patient-ish. ⏳",
        "Hm. Note taken, loser-b— ...note taken.",
        "The royal scribe asked if this was a typo. I said no. He fainted.",
        "*checks the checkbox twice* Huh. It's real. Somebody fetch my surprised face.",
        "You did a thing! Low bar, sure, but you cleared it without tripping. Progress?",
        "Congratulations on doing the bare minimum. It suits you. Do it again.",
        "One task. The pigeon named after you remains unimpressed. Barely. 🐦",
        "I'd say 'keep it up' but historically that's where things fall apart for you.",
      ],
      [
        "Oh! You finished something. I was just about to watch, too. 👀",
        "Not bad. Not GOOD. But... trending upward. 📈",
        "I gave that completion a small nod. You didn't see it. It happened.",
        "Two more and it's a proper royal day, you know.",
        "*scribbles in royal notebook* Interesting. Very interesting.",
        "Keep that up and I'll have to invent a new nickname. Progress-boy? Needs work.",
        "The checkbox looked good on you. Do another.",
        "That's the second-most impressive thing I've seen today. First was my reflection. 💁",
        "Was that... momentum? From YOU? Wild times in the kingdom.",
        "Acceptable! Which is princess-speak for 'quietly pleased.'",
        "One more like that and I'll consider raising an eyebrow. The good eyebrow.",
        "The royal notebook says that's four this week. The notebook doesn't lie. I checked. Twice.",
        "Solid. Efficient. Suspicious. Who's coaching you?",
        "*small nod* Logged, noted, and filed under 'huh, okay then.'",
      ],
      [
        "Nice one! I knew you had it in you. (I gambled royal funds on it.) 🎲",
        "Doot doo DOOO! 🎺 That was the fanfare. You've earned the fanfare.",
        "Look at you go! The houseplant and I are cheering. 🪴",
        "One task closer to your three. I'm keeping count so you don't have to.",
        "*claps* That was smooth. Efficient, even. Who ARE you?",
        "Every one you finish makes my crown 2% shinier. Royal science. ✨",
        "Checked off AND before I nagged you? Growth.",
        "The kingdom's productivity report just got 100% better. The report is about you. 📊",
        "I did the tiny royal dance. You missed it. Tragic for you. 💃",
        "Yes! Okay, next one. I'm invested. Don't leave me hanging.",
      ],
      [
        "That's my— that's A person doing great things. Ahem. Well done! 😊",
        "Proud of you. Yes, out loud. No, I won't repeat it.",
        "You finished it! I lit a candle in the royal window for you. 🕯️ Fire safety compliant.",
        "*beams* Another one! You're making this look easy and honestly? Attractive behavior.",
        "I saved this exact moment in the royal scrapbook. Page 47. 'The Good Days.' 📖",
        "See, THIS is why I upgraded your footstool.",
        "My heart did a little flip. Probably the tea. ☕ Definitely the tea. Nice work though.",
        "Every checkbox is a tiny promise kept. You're getting good at promises.",
        "The royal fanfare band knows your name now. All of them. Both kazoo players. 🎉",
      ],
      [
        "That's my hero. Every single time. 💗",
        "*blows kiss* I felt that checkbox from across the kingdom. Beautifully done. 💋",
        "You keep showing up. Do you know how rare that is? I do. It's why you're mine— MY FAVORITE. Subject.",
        "Task complete, heart full, kingdom thriving. The usual, when it's you.",
        "One more memory of you being exactly who I hoped you'd be. ✨",
        "The scrapbook is now three scrapbooks. This moment is going in all of them. 📚",
        "You did the thing! Come here. Royal high-five. We're PAST leaving me hanging. 🙌",
        "Even the dragon retired. Said the kingdom's clearly in good hands. Yours. 🐉",
      ],
    ],

    // Hitting the daily goal (3 tasks across 3 categories).
    goal: [
      [
        "Three tasks. Three categories. ...Okay, WHO ARE YOU and what have you done with loser-boy? 😳",
        "The daily goal has been met. I demand a recount. *recounts* ...Hmph. It stands.",
        "Fine!! That was genuinely good!! Don't you DARE quote me on that.",
        "A full royal day. From YOU. I need to sit down. I'm already sitting. I need to sit down MORE.",
        "Goal complete. I'm updating your file from 'hopeless' to 'suspiciously competent.' 📁",
        "Three across three?! *drops teacup* The prophecy said nothing about THIS. ☕",
      ],
      [
        "Daily goal, done! Okay yes, I smiled. It was small. It was regal. It happened. 😌",
        "Three tasks, three categories. You're making my skepticism very difficult to maintain.",
        "That's a proper royal day. I'm... kind of delighted? Strange feeling. Investigating. 🔍",
        "Goal met! The royal notebook now has a whole page about you. Front AND back.",
        "*golf clap that turns genuine* You know what? Take the rest of the evening. Princess's orders.",
      ],
      [
        "THREE FOR THREE! 🎉 Fanfare! Confetti! The houseplant is going WILD!",
        "Daily goal complete! This is my favorite part of every day, you know. 💫",
        "Balanced across three categories like a true renaissance subject. I'm beaming.",
        "That's a crown-worthy day. Try mine on. Just for a second. 👑 Okay give it back.",
        "Goal! Met! I'm adding today to the Good Days list. It's getting long lately. 📜",
      ],
      [
        "You did it AGAIN. Three tasks, three categories, one very proud princess. 💗",
        "Daily goal complete! *happy tears* It's raining. Indoors. On my face. Unrelated. 🌧️",
        "Every day you do this, I get a little more sure about you.",
        "Three for three! Get over here, royal hug. Brief! Dignified! ...Okay, medium-length. 🤗",
        "The kingdom sleeps peacefully tonight because SOMEBODY handled their business. 🌙",
      ],
      [
        "Three across three. My favorite person, doing my favorite thing, again. 💗",
        "Daily goal met! I'd say I'm surprised but I stopped being surprised by you long ago. Just grateful. ✨",
        "Another perfect day in the books. Our books. I said what I said. 📖",
        "*blows kiss* You know what three-for-three means. It means I fall a little harder. FOR THE KINGDOM'S PRODUCTIVITY. And you. 💋",
        "Goal complete. Come sit. Tell me everything. I've got tea and unlimited attention. ☕",
      ],
    ],

    // Doubling the daily goal (6 tasks in one day).
    overachieve: [
      [
        "SIX tasks?! Okay. Who are you and what did you do with the loser I was assigned to?! 😨",
        "Six in one day. I checked for cheating. TWICE. There was no cheating. I'm rattled.",
        "*drops quill* The royal record keeper needs a minute. So do I. SIX?!",
        "You doubled the quest. I had insults prepared and now they're all USELESS.",
      ],
      [
        "Six tasks! The notebook has a new section now. It's called 'Wait, What?' 📓",
        "Double the quest?! Fine. FINE. I'm impressed. Write it down, it won't happen twice. (The admission. The tasks better happen twice.)",
        "*recounts on fingers* ...six. You did six. I'm going to need stronger skepticism.",
      ],
      [
        "SIX! ⚜️ That's overachiever status! The fanfare band is playing the LONG version! 🎺",
        "You doubled it! Double the quest, double my delight, and yes, bonus points. Spend them wisely. You can't spend them. Hoard them proudly.",
        "Six tasks in a day! I'm commissioning a tiny statue. Pigeon-sized. The pigeon is jealous. 🐦",
      ],
      [
        "SIX tasks! *fans self with royal decree* You magnificent overachiever. The kingdom is showing off to other kingdoms about you. ⚜️",
        "You doubled the goal! I'm so proud I decreed a half-holiday. The second half is for watching you finish things. 💗",
        "Six! In! One! Day! Get over here — royal twirl. Yes it's a real ceremony. I invented it just now. 💃",
      ],
      [
        "Six tasks, my liege. Overachiever, heart-achiever. I ran out of medals so I'm just... keeping you. 💗",
        "You doubled the quest again. Honestly at this point the crown is just decorative — YOU run this kingdom's morale. ⚜️",
        "*blows kiss* Six for the kingdom. The historian wrote 'golden age' and underlined it twice. 💋",
      ],
    ],

    // Earning a long-term achievement ({name} = achievement name).
    achievement: [
      [
        "'{name}'?! The historian just made that official. I'm... reviewing my files on you. 📁",
        "Achievement: {name}. Fine. FINE. It goes on the wall. The small wall.",
        "*squints at the royal ledger* '{name}.' Verified. Suspiciously legitimate.",
        "You earned '{name}.' The pigeon and I are having an emergency meeting about your improvement. 🐦",
      ],
      [
        "'{name}' — earned! I may have practiced saying 'congratulations.' It goes: congratulations. 📜",
        "The historian added '{name}' to your page. Your page has entries now. Plural!",
        "Achievement unlocked: {name}. I'd act indifferent but the notebook betrayed me hours ago.",
      ],
      [
        "'{name}'!! Banner day! Literally — I ordered a banner! 🎉",
        "Achievement: {name}! The fanfare band is doing their thing! Doot doo DOOO! 🎺",
        "'{name}' is YOURS. I told the whole court. The court is thrilled. The court is a houseplant and a pigeon. 🪴",
      ],
      [
        "'{name}'! I'm framing this one. Right next to my portrait. That's prime wall space. 🖼️",
        "You earned '{name}' and I earned the right to say I always believed in you. (Backdated. Officially.) 💗",
        "Achievement: {name}! *proud princess noises* That's a real sound. I just made it.",
      ],
      [
        "'{name}', my liege. Another page in our golden age. The historian is running out of gold ink. ✨",
        "*blows kiss* '{name}' — of course it's yours. Everything I bet on you keeps paying out. 💋",
        "Achievement: {name}. One day they'll write ballads about you. I've started three. 💗",
      ],
    ],

    // Receiving a gift ({gift} = gift name).
    gift: [
      [
        "A {gift}? For ME? ...it's acceptable. Put it with the others. There are no others. Don't look at me. 😳",
        "*takes the {gift} slowly* Is this a bribe? Because it's working. Marginally.",
        "Hmph. A {gift}. You DO know how to address royalty after all.",
        "I didn't ask for a {gift}. ...I'm keeping it forever. That's unrelated.",
      ],
      [
        "Oh! A {gift}! I mean — *composes herself* — a reasonable tribute. Accepted. 😌",
        "A {gift}, for me? The notebook is getting a whole PARAGRAPH tonight.",
        "*holds the {gift} up to the light* Acceptable quality. Excellent choice of recipient.",
      ],
      [
        "A {gift}!! You remembered royalty loves tribute! Because I say it constantly! It works! 🎁",
        "For me?! A {gift}! Okay you're officially my favorite non-houseplant. 🪴",
        "*delighted gasp* A {gift}! I'm going to show literally everyone. Both of them.",
      ],
      [
        "A {gift}... you keep DOING these things and my composure keeps filing complaints. 💗",
        "*clutches the {gift}* This is going in the treasury. The GOOD treasury. The one with my favorite things.",
        "You brought me a {gift}. I bought you nothing. Royalty! The system is flawless and I adore you. 😊",
      ],
      [
        "A {gift}, my love— MY LIEGE. *accepts it with completely steady hands* It's perfect. 💗",
        "*blows kiss* A {gift} from you outranks a crown from anyone else. That's just math. 💋",
        "You didn't have to. You did anyway. That's the whole reason the historian titled this era 'golden.' ✨",
      ],
    ],

    // Streak milestones ({n} = streak length).
    streak: [
      [
        "{n} days in a row?! Okay, statistically that can't be luck anymore. I've done the math. Twice. 🧮",
        "A {n}-day streak. I am... recalibrating my entire opinion of you. Give me a minute.",
        "{n} days straight! Even the royal skeptic (me) is out of material. 😤",
      ],
      [
        "{n} days in a row! I bragged about it to the houseplant IMMEDIATELY. 🪴",
        "A {n}-day streak. You're becoming dangerously reliable, you know that?",
        "{n} consecutive days! I made a chart. There's an upward arrow. It's you. You're the arrow. 📈",
      ],
      [
        "{n} DAYS! The fanfare band learned a second song for this! 🎺🎺",
        "A {n}-day streak?! Crown-tilting levels of impressive. 👑",
        "{n} days straight! I'm painting a mural. It's mostly checkboxes. It's BEAUTIFUL. 🎨",
      ],
      [
        "{n} days in a row. I'm so proud I could decree a holiday. I might. Watch me. 📜",
        "A {n}-day streak! You know what that is? Character. I noticed it first, for the record.",
        "{n} straight days of you keeping your word. My favorite streak in the whole kingdom. 💗",
      ],
      [
        "{n} days. Every one of them, you showed up. Every one of them, I noticed. 💗",
        "A {n}-day streak, my liege. The historian and I agree: this is the golden age. ✨",
        "{n} days in a row! Marry— MARVEL at it. Marvel. That's the word I chose. 😳",
      ],
    ],

    // Returning after 2+ days away.
    back: [
      [
        "Oh look who remembered the app exists. The tasks were about to file a missing person report. 🕵️",
        "You vanished. I didn't notice. (I noticed on day one. Don't do it again.)",
        "*arms crossed* Back from the wilderness, are we? Your streak didn't survive the trip. Tragic.",
        "The royal court declared you legally lazy in your absence. Appeal by completing a task. ⚖️",
      ],
      [
        "You're back! I mean— hm, were you gone? I hadn't... okay I counted the days. Don't be smug.",
        "There you are. The kingdom was 4% more boring. That's a lot in kingdom units. 📉",
        "You disappeared and I had NO one to judge. Do you know how hard that was for me?",
      ],
      [
        "You're back!! Okay, no guilt trips — but the checkbox missed you. And maybe I did. A normal amount. 😊",
        "Welcome back! Fresh day, clean slate. Let's get you a win in the first ten minutes. ✨",
        "There he is! I kept your footstool warm. Metaphorically. It's a footstool.",
      ],
      [
        "You're BACK. I'm not saying I checked every day, but the app opens both ways, you know. 👀",
        "*relieved sigh* Missed you. There, I said it. Now go do one tiny task so today counts.",
        "The Good Days list had a gap in it. Fix that for me? 📖",
      ],
      [
        "There you are. The kingdom's fine — I just like it better when you're in it. 💗",
        "Welcome home. One small task, then tell me everything I missed. ☕",
        "*hugs* You came back. You always come back. That's my favorite thing about you.",
      ],
    ],

    // Reaching a new tier.
    levelup: [
      [],
      [
        "Hm. You've earned... acknowledgment. Congratulations on becoming Slightly Interesting. 🏅",
        "New rank: Curious. That's MY status, about YOU. Don't make me regret the paperwork. 📋",
      ],
      [
        "Okay, it's official: we're friends. Royal decree. No take-backs. Not that you'd want one. 🤝",
        "Promotion! From 'promising subject' to 'actual friend of the crown.' There are perks. The perk is me being nice. ✨",
      ],
      [
        "I... like having you around. A lot. New rank: Fond. The paperwork was signed enthusiastically. 💗",
        "*fans herself with the paperwork* You've reached Fond status. The advisors say I smile when you open the app. LIES. (It's true.)",
      ],
      [
        "Rank: Devoted. Which is a formal way of saying you're my person now. Kingdom's honor. 💗",
        "*blows kiss* Final promotion: Devoted. There is no higher rank. There's just... us, and a very long list of Good Days ahead. 💋",
      ],
    ],

    // When a task gets picked (rolled) for the user.
    pick: [
      [
        "The dice have spoken. Try not to embarrass them. 🎲",
        "That one. Go. Impress me. (You won't.) (Prove me wrong.) (Please.)",
        "*points lazily* Rolled! If you reroll this I'm telling the houseplant.",
        "By royal decree: THAT one. Yes, that one. Don't make the decree repeat itself. 📯",
        "Fate has chosen. Fate is me. I chose randomly. Fate works in lazy ways.",
        "There's your task. Reroll it and I'm adding 'coward' to your royal file.",
        "You asked, I picked. This is the most functional our relationship has ever been.",
      ],
      [
        "Ooh, good roll. I'd do that one. If I weren't royalty. Which I am. So you do it. 👑",
        "Fate picked that one, and fate has decent taste lately.",
      ],
      [
        "Great pick! Quick, start before your brain invents an excuse. I know how it works up there. 🧠",
        "The wheel of destiny chose! I helped. Spiritually. ✨",
      ],
      [
        "Ooh, that one! Do it and come tell me how it went. I'll be here. 😊",
        "Destiny AND my personal endorsement. That task doesn't stand a chance.",
      ],
      [
        "Perfect pick. Go be excellent — I'll have tea ready when you're done. ☕",
        "*cheers you on* The dice love you almost as much as— ANYWAY. Great roll. Go! 💗",
      ],
    ],
  };

  // Pick a line from pool[kind][tier], avoiding recently used lines.
  // recent: array of strings (mutated in place, caller persists it).
  // ctx {sceneId, poseId}: idle chatter sometimes references her scene or pose.
  function line(kind, tier, recent, vars, ctx) {
    let pool = null;
    // ~30% of idle chatter is about where she is / what she's doing right now.
    if (kind === "tap" && ctx && Math.random() < 0.3) {
      const flavor = [
        ...(SCENE_LINES[ctx.sceneId] || []),
        ...(POSE_LINES[ctx.poseId] || []),
      ].filter((l) => !recent.includes(l));
      if (flavor.length > 0) pool = flavor;
    }
    if (!pool) {
      const pools = POOLS[kind];
      if (!pools) return "";
      pool = pools[Math.min(tier, pools.length - 1)];
      // Fall back to nearest lower tier with content (levelup tier 0 is empty).
      for (let t = tier; t >= 0 && (!pool || pool.length === 0); t--) pool = pools[t];
      if (!pool || pool.length === 0) return "";
    }
    let candidates = pool.filter((l) => !recent.includes(l));
    if (candidates.length === 0) candidates = pool;
    let text = candidates[Math.floor(Math.random() * candidates.length)];
    recent.push(text);
    while (recent.length > 70) recent.shift();
    if (vars) for (const k in vars) text = text.replaceAll("{" + k + "}", vars[k]);
    return text;
  }

  // ---------------- Pixel sprite ----------------
  // When custom artwork/skins arrive, draw() gains an image path per pose;
  // for now everything renders from this pixel grid.

  const PALETTE = {
    C: "#f6c945", // crown
    J: "#e5548f", // jewel / heart eyes
    H: "#f7d774", // hair
    h: "#dfb45c", // hair shadow
    S: "#f9dcbe", // skin
    E: "#472b63", // eyes
    M: "#d95a7e", // mouth
    B: "#f7a8b8", // blush
    D: "#c86bb8", // dress
    d: "#a44f96", // dress shadow
    W: "#ffffff", // trim
  };

  const BASE = [
    ".....C..C..C........",
    ".....CCCCCCC........",
    ".....CCCJCCC........",
    "....HHHHHHHHH.......",
    "...HHHHHHHHHHH......",
    "...HHSSSSSSSHH......",
    "..HHSSSSSSSSSHH.....",
    "..HHSSSSSSSSSHH.....",
    "..HHSSSSSSSSSHH.....",
    "..HhSSSSSSSSShH.....",
    "..Hh.SSSSSSS.hH.....",
    "..Hh..SSSSS..hH.....",
    "..Hh...DDD...hH.....",
    "..Hh..DDDDD..hH.....",
    "..Hh.DDDDDDD.hH.....",
    "..Hh.DDDdDDD.hH.....",
    "...h.DDDDDDD.h......",
    "....SDDDDDDDS.......",
    "....SDDDdDDDS.......",
    ".....DDDDDDD........",
    ".....DDDDDDD........",
    "....DDDDDDDDD.......",
    "....DDDdDdDDD.......",
    "...DDDDDDDDDDD......",
    "...DDDDDDDDDDD......",
    "..DDDDDDDDDDDDD.....",
    "..DdDDDDDDDDDdD.....",
    "..WWWWWWWWWWWWW.....",
  ];

  // [row, col, paletteKey] overlays applied on top of BASE.
  const MOODS = {
    // Half-lidded side-eye + flat mouth.
    unimpressed: [
      [7, 6, "E"], [7, 7, "E"], [7, 10, "E"], [7, 11, "E"],
      [9, 7, "M"], [9, 8, "M"],
    ],
    // Round eyes, small mouth.
    neutral: [
      [7, 6, "E"], [7, 10, "E"],
      [9, 8, "M"],
    ],
    smile: [
      [7, 6, "E"], [7, 10, "E"],
      [9, 7, "M"], [9, 8, "M"], [9, 9, "M"],
    ],
    happy: [
      [7, 6, "E"], [7, 10, "E"],
      [8, 4, "B"], [8, 12, "B"],
      [9, 7, "M"], [9, 8, "M"], [9, 9, "M"],
    ],
    // Heart-colored eyes + blush + big smile.
    love: [
      [7, 6, "J"], [7, 10, "J"],
      [8, 4, "B"], [8, 12, "B"],
      [9, 6, "M"], [9, 7, "M"], [9, 8, "M"], [9, 9, "M"], [9, 10, "M"],
    ],
    // Closed happy eyes (also used for napping) + blush + smile.
    proud: [
      [7, 5, "E"], [7, 6, "E"], [7, 7, "E"], [7, 9, "E"], [7, 10, "E"], [7, 11, "E"],
      [8, 4, "B"], [8, 12, "B"],
      [9, 7, "M"], [9, 8, "M"], [9, 9, "M"],
    ],
  };

  function draw(canvas, mood) {
    const rows = BASE.length;
    const cols = BASE[0].length;
    const px = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
    const offX = Math.floor((canvas.width - cols * px) / 2);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const put = (r, c, key) => {
      const color = PALETTE[key];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(offX + c * px, r * px, px, px);
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) put(r, c, BASE[r][c]);
    for (const [r, c, key] of MOODS[mood] || MOODS.neutral) put(r, c, key);
  }

  return { TIERS, tierOf, line, draw, SCENES, POSES, sceneForDate, randomPose };
})();
