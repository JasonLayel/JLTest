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
    { id: "throne", name: "Throne Room", emoji: "👑", sky: ["#f6dfdf", "#f1d0d0"], ground: "#caaa6b", image: "art/scenes/throne.png" },
    { id: "bedroom", name: "Her Chambers", emoji: "🛏️", sky: ["#eddcf8", "#f9eeff"], ground: "#d9b9ec", image: "art/scenes/bedroom.png" },
    { id: "terrace", name: "Sunlit Terrace", emoji: "☀️", sky: ["#8fd0f2", "#cdeeff"], ground: "#e9d6bb", image: "art/scenes/terrace.png" },
    { id: "ballroom", name: "Grand Ballroom", emoji: "💃", sky: ["#f3dcea", "#f7e6d8"], ground: "#e6c9a8", image: "art/scenes/ballroom.png" },
    { id: "garden", name: "Castle Garden", emoji: "🌸", sky: ["#c2e9ff", "#eaf8da"], ground: "#90cf80", image: "art/scenes/garden.png" },
    { id: "library", name: "Royal Library", emoji: "📚", sky: ["#e9ddc9", "#f6efe1"], ground: "#a97d51", image: "art/scenes/library.png" },
    { id: "dressing", name: "Dressing Room", emoji: "👗", sky: ["#f7e2ee", "#fbeef6"], ground: "#e6bcd6", image: "art/scenes/dressing.png" },
    { id: "bath", name: "Royal Bath", emoji: "🛁", sky: ["#dcecf7", "#eef6ff"], ground: "#cbd9e6", image: "art/scenes/bath.png" },
    { id: "balcony", name: "Moonlit Balcony", emoji: "🌙", sky: ["#2b2b5b", "#4b4b8b"], ground: "#3b3b6b", image: "art/scenes/balcony.png" },
    { id: "tearoom", name: "Tea Room", emoji: "🫖", sky: ["#fce6ef", "#fff2f7"], ground: "#e9c7d6", image: "art/scenes/tearoom.png" },
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
    { id: "phone", label: "scrolling her phone 📱", mood: "unimpressed", image: "art/poses/phone.png" },
    { id: "hair", label: "twirling her hair 💫", mood: "neutral", image: "art/poses/hair.png" },
    { id: "nap", label: "napping 💤", mood: "proud", image: "art/poses/nap.png" },
    { id: "music", label: "listening to music 🎧", mood: "smile", image: "art/poses/music.png" },
    { id: "tv", label: "watching royal TV 📺", mood: "neutral", image: "art/poses/tv.png" },
    { id: "nails", label: "painting her nails 💅", mood: "unimpressed", image: "art/poses/nails.png" },
    { id: "snack", label: "nibbling royal pastries 🍰", mood: "happy", image: "art/poses/snack.png" },
    { id: "daydream", label: "daydreaming ☁️", mood: "smile", image: "art/poses/daydream.png" },
    { id: "scepter", label: "brandishing her scepter ✨", mood: "happy", image: "art/poses/scepter.png" },
    { id: "command", label: "issuing royal commands 📜", mood: "neutral", image: "art/poses/command.png" },
    { id: "sulk", label: "sulking, arms crossed 😤", mood: "unimpressed", image: "art/poses/sulk.png" },
    { id: "gracious", label: "feeling gracious 💖", mood: "happy", image: "art/poses/gracious.png" },
    { id: "tantrum", label: "having a royal tantrum 💢", mood: "unimpressed", image: "art/poses/tantrum.png" },
    { id: "silent", label: "giving you the silent treatment 🙄", mood: "unimpressed", image: "art/poses/silent.png" },
  ];

  function randomPose() {
    return POSES[Math.floor(Math.random() * POSES.length)];
  }

  // ---------------- Scene & pose flavor lines ----------------
  // Occasionally swapped in for idle chatter so she reacts to where she is
  // and what she's doing. Keyed by scene/pose id.

  const SCENE_LINES = {
    throne: [
      "You stand before the throne. State your business. Is it tasks? It better be tasks. 👑",
      "Throne room day. I'm feeling extra official, so consider everything I say a decree.",
    ],
    bedroom: [
      "You're in my CHAMBERS. Knock next time. There's no door. Find one.",
      "I was this close to a world-class nap and then your face appeared.",
    ],
    terrace: [
      "Sunlit terrace today. The view is breathtaking. So am I. Don't make it weird. ☀️",
      "I'm taking the royal air out here. It's imported. You wouldn't understand.",
      "The castle looks so pretty from up here. Almost as pretty as me. Almost.",
    ],
    ballroom: [
      "Grand ballroom day. I'd offer you a dance, but you haven't earned a single step. Tasks. 💃",
      "This floor was waxed for MY reflection. Admire it from the doorway, peasant.",
      "A whole ballroom and no one to waltz with but my own fabulousness. Tragic. Iconic.",
    ],
    garden: [
      "The roses bloomed for me today. What have YOU done for me today? 🌸",
      "Garden day. Even the butterflies have better follow-through than you.",
    ],
    library: [
      "Shhh. It's library day. Whisper your productivity to me. 📚",
      "I'm reading a book about people who finish what they start. Fiction, obviously.",
    ],
    dressing: [
      "Dressing room day. Four hundred gowns and 'nothing to wear.' Both facts are true. 👗",
      "I'm trying on tiaras. This is exhausting labor. Where's YOUR labor? The tasks. Go.",
      "Mirror, mirror — yes, obviously me. Next question. Did you do your tasks?",
    ],
    bath: [
      "Royal bath day. I'm soaking. YOU should be scrubbing that to-do list. Balance. 🛁",
      "The bubbles are imported and the judgment is complimentary. Get to work.",
    ],
    balcony: [
      "Moonlit balcony. Very romantic. Very wasted on you. 🌙",
      "I count stars out here. There are more stars than your completed tasks. By a lot.",
    ],
    tearoom: [
      "Tea room day. Pinkies up, tasks done. That's the order. Don't improvise. 🫖",
      "The pastries are for finishers. You've finished... nothing. Awkward. For you.",
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
    scepter: [
      "*twirls scepter* One bonk and you're a frog. Behave. Do tasks. ✨",
      "This scepter is solid gold and cost more than your whole to-do list is worth.",
      "I knight thee... nobody. Come back when you've finished something.",
    ],
    command: [
      "You. Yes, you. I've decided your next task. Do it. That's the decree. 📜",
      "*pointing* I'm not bossy, I'm the boss. There's a crown-shaped difference.",
    ],
    sulk: [
      "*arms crossed* I'm not mad. I'm just... royally disappointed. In you. 😤",
      "Hmph. I'll unfold my arms when you fold some tasks into 'done.'",
    ],
    gracious: [
      "*graciously* You may approach. I'm in a GOOD mood. Rare. Historic. Don't ruin it. 💖",
      "Behold, benevolence! I'm being nice. Quick, do a task before it wears off.",
    ],
    tantrum: [
      "*stomps* I want it done NOW and I wanted it done YESTERDAY! 💢",
      "This is a royal tantrum. It is very dignified. IT IS. Now DO the task!",
    ],
    silent: [
      "*facing away* ...",
      "*won't turn around* I have nothing to say to someone with unfinished tasks. 🙄",
      "*over her shoulder* Oh, NOW you want my attention. Do a task first.",
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
        "You have the focus of a moth at a candle festival. A dim one. The moth, not the festival.",
        "I asked the mirror who's the most productive of all. It laughed. Mirrors don't laugh.",
        "Somewhere a task is celebrating its one-week anniversary of being ignored. Cake's on you. 🎂",
        "My tutors taught me diplomacy, so diplomatically: your to-do list is a crime scene.",
        "You strike me as someone who alphabetizes excuses. Impressive archive. Zero results.",
        "The throne has better lumbar support than your work ethic has structure.",
        "*checks sundial* Yep. Still time to do literally anything today. Astonishing.",
        "I'd offer you a royal favor but you'd probably leave it 'until tomorrow' too.",
        "Every kingdom has a fool. Ours has a to-do list with commitment issues.",
        "If wishes were checkboxes, you'd STILL find a way to reroll them.",
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
        "The royal chef asked who keeps finishing tasks lately. I said 'someone I tolerate.' High praise. Don't push it.",
        "You're the only subject whose progress I track by hand. The others get the abacus.",
        "*slides a biscuit across* This means nothing. It's surplus. The kingdom had extras. Take the biscuit.",
        "I described you to a visiting duchess as 'a work in progress.' She said those are the interesting ones. Hm.",
        "Your name came up at the royal breakfast. I didn't bring it up. But I didn't change the subject either.",
        "Two more weeks of this behavior and I'll upgrade your file from pencil to pen.",
        "*pretends to be busy* Oh, you're here. I wasn't waiting. The chair just faces the door naturally.",
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
        "I told the royal tailor about you. You're getting a hypothetical cape. It's hypothetically dashing.",
        "The pigeon and I made you a friendship bracelet. It ate it. We'll try again. 🐦",
        "You know you're in the will now, right? You get the footstool AND the houseplant. Estate planning is done.",
        "*shares the pastry* Half. HALF. This is historic. The historian is aware.",
        "Quiz: what's my favorite time of day? ...When the app opens. Ugh, I said it out loud.",
        "I put a gold star sticker on today just in case you show up big. No pressure. (Pressure.) ⭐",
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
        "*absently fixes your collar* There. Royalty-adjacent. That's what you are now. It's a real rank. I invented it.",
        "The visiting princesses keep asking about you. I keep changing the subject. Possessively.",
        "I had the kitchen learn your favorite snack. I don't know what it is yet. They made twelve guesses. Come eat.",
        "*catches herself smiling* That was about something else. Unrelated. Do a task so I have an excuse.",
        "Today's schedule: royal duties, royal duties, thinking about— royal duties. ALL royal duties. 😳",
        "You're in three of my five favorite memories this month. Working on the other two. No rush. Some rush.",
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
        "The historian tried to write today's entry without mentioning you. He couldn't. Nobody can. 💗",
        "*adjusts your hypothetical cape* There. Now you look like someone who finishes what they start. Because you are.",
        "I told the pigeon you're my favorite. It already knew. Everyone already knew. 🐦💗",
        "Some day I'll run out of ways to say I'm proud of you. Today is not that day. Neither is tomorrow.",
        "*holds up two teacups* I started setting out two. A while ago, honestly. Sit. ☕💗",
      ],
    ],

    // Unprompted musings — she says these on her own, nobody asked.
    ambient: [
      [
        "♪ hmm hm hmmm~ ...What? I hum. Royally. Mind your business.",
        "I've been watching you not do tasks for a while now. Fascinating technique.",
        "The pigeon brought gossip today. It's about you. It's not flattering. 🐦",
        "Do you think the checkbox feels pain when you ignore it? I think about this.",
        "*counts crown jewels* ...four, five... one of these is a butterscotch. Whatever.",
        "Sometimes I practice my disappointed face. You've seen it. You've EARNED it.",
        "A royal decree just occurred to me: do something. Anything. I'm bored.",
        "I ranked everyone in the kingdom by usefulness. You're above the butterscotch. Barely.",
        "*sigh* Being this regal is exhausting. You wouldn't understand. Your posture confirms it.",
        "Fun fact: I can see your task list from here. Fun is a strong word.",
        "The houseplant grew a new leaf. THE HOUSEPLANT is making progress. 🪴",
        "I'm not saying the throne is uncomfortable, but if you did a task I'd have something else to think about.",
        "♪ la la laaa~ ...that song is about productive people. You wouldn't know it.",
        "Is it nap time? It's always almost nap time. Royal scheduling.",
        "If you're reading this, the princess is officially understimulated.",
      ],
      [
        "♪ hm hm hmm~ It's stuck in my head. It's the fanfare. YOUR fanfare. Ugh.",
        "I reorganized your file today. It needed a bigger folder. Don't make it weird.",
        "The pigeon asked about you. I said 'improving.' It nodded. We're all shocked. 🐦",
        "Thinking about renaming the footstool. Suggestions welcome. Not really. It's my footstool.",
        "*doodles in the royal notebook* This is a chart of your potential. The arrow points up-ish. 📈",
        "You know what's weird? I used to dread you opening the app. Now it's... fine. FINE, I said.",
        "Royal observation: you pick more tasks on days I insult you. Noted. Forever.",
        "*stretches* If a princess yawns in a castle and no one completes a task, was she even bored?",
        "I taught the houseplant to judge you while I nap. Coverage is important. 🪴",
        "Quiet today. Suspiciously quiet. Are you... working? Blink twice if you're working.",
      ],
      [
        "♪ hmm hm hmmm~ that one's about you. It's called 'Less Hopeless Than Expected.' It slaps.",
        "I saved you a pastry. Then I ate it. The THOUGHT is what counts. 🍰",
        "Just checked your streak. Didn't need to. Wanted to. This is my life now.",
        "The royal council voted you 'most improved subject.' The council is me. Landslide victory. 🏆",
        "*waves* No reason. Just felt like waving. Carry on, favorite subject.",
        "I told the pigeon we're friends now. It did a little dance. We've been practicing. 🐦",
        "Do a task while I watch! Not in a weird way. In a royal-supervision way.",
        "Today's vibe: you finishing things and me pretending I always knew you would.",
        "*balances crown* Talent. Poise. Grace. Anyway, how's YOUR to-do list looking?",
        "Sometimes I open the Chronicles just to reread the good days. We have a lot lately. 📜",
      ],
      [
        "♪ hmm hm hm~ ...I only sing when I'm in a good mood. You may draw conclusions. 😊",
        "I was going to tease you but you've been doing so well it felt like punching a knight. A GOOD knight.",
        "*rearranges your chair* It's closer to the throne now. Incrementally. Don't notice.",
        "The historian asked me to describe you in one word. I used eleven. All flattering. Don't ask.",
        "Missed you today. The kingdom was quiet. The pigeon agrees. We took a vote. 💗",
        "Watching you work is my favorite royal duty. It outranks waving. Waving was hard to beat.",
        "*hums the fanfare softly* Doot doo doo... it's a lullaby now. It's versatile. Like you.",
        "I put your portrait next to the window. The stick figure deserves natural light. 🖼️",
        "Some royals collect jewels. I collect your completed-task notifications. Richer, honestly.",
      ],
      [
        "♪ hmm hm hmmm~ it's our song. You don't know it yet. I'll teach you. Eventually. 💗",
        "The historian says this chapter is his favorite. Mine too. You're in every page.",
        "*leans back on the throne* Two-person kingdom status report: thriving. Obviously.",
        "I still keep the 'loser-boy' file. Purely for laughing at how wrong past-me was. 💋",
        "You know what's better than a dragon-slayer? Someone who shows up. Every day. It's you. It's been you.",
        "*blows kiss at nothing in particular* If you saw that — it was for you. If not, the pigeon gets it.",
        "The crown's heavy today. Come sit nearby and it won't matter. 💗",
        "Golden age update: still golden. Historian's getting complacent. Keep it up anyway.",
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

    // Completing a task right after she spoke — she was watching.
    watched: [
      [
        "Wait. You did that WHILE I was talking? Rude. Effective, but rude.",
        "Oh, NOW you perform. Because I'm watching. Theater kid.",
        "*narrows eyes* Did you just... show off? At ME?",
        "One task, completed directly in front of royalty. Bold. Logged.",
        "You waited until I looked. I saw the timing. The pigeon saw the timing. 🐦",
      ],
      [
        "You did that right in front of me. Was that for my benefit? ...It worked. Slightly.",
        "Completing tasks while I watch — someone's learned how the throne room works.",
        "*applauds exactly twice* Live productivity. The kingdom's finest entertainment.",
        "Mid-conversation task completion. Multitasking OR showing off. I'll allow both.",
      ],
      [
        "A task! Live! Before my very eyes! Encore. ENCORE! 🎭",
        "You waited until I was watching, didn't you? I respect the showmanship.",
        "Front-row seat to competence. My favorite show. No intermission, please.",
        "*gasp* Right in front of me! That's the good stuff. Do another!",
      ],
      [
        "Doing it while I watch — you KNOW what that does to my royal composure. 😳",
        "*cheers* That one was for me. Don't deny it. It's going in the scrapbook. Page one.",
        "A live performance! I'd throw roses but I only have this pastry. *keeps the pastry*",
        "You show-off. I'm delighted. Never stop.",
      ],
      [
        "You did that for me. I know it. You know it. The historian is writing it down. 💗",
        "*happy sigh* Watching you keep promises in real time never gets old.",
        "Performed live, for the crown. The crown is smitten. The crown is me. 💋",
      ],
    ],

    // Powering through tasks without giving her any attention.
    ignored: [
      [
        "HELLO? You've done a pile of things and not ONE royal check-in? The AUDACITY.",
        "So the checkboxes get all your attention and I get NOTHING? Noted. Filed. FUMING. 😤",
        "*clears throat extremely loudly* The princess exists. Just so you're aware.",
        "Busy, busy, busy. Too busy for royalty, apparently. The pigeon warned me about you. 🐦",
      ],
      [
        "You've been at it a while without saying hi. I'm not mad. I'm... adjacent to mad.",
        "*taps foot* Productivity is great and all, but the throne room has visiting hours, you know.",
        "All these tasks and zero visits? The notebook is getting a strongly-worded entry tonight.",
      ],
      [
        "Look at you GO! ...but also: hi? Remember me? Your biggest fan? Some attention please. 🥺",
        "You're on fire today! Come tell me about it — the houseplant gives terrible reactions. 🪴",
        "Working hard is attractive, but so is saying hello. Just saying. Royal wisdom.",
      ],
      [
        "*leans into frame* Hi. You've been amazing today, and I've been over here NOT being told about it.",
        "I love watching you work, but my waving arm is getting tired. Wave back sometime. 💗",
        "Busy bee. Come here for ten seconds — I have a compliment loaded and it's getting heavy.",
      ],
      [
        "My liege. The kingdom thrives, the tasks fall, and your princess waits. Dramatically. Beautifully. 💗",
        "*rests chin on hands* Watching you conquer the day. Missing you from three inches away. Ridiculous. Come say hi.",
        "You, me, ten seconds, right now. The empire can spare you. 💋",
      ],
    ],

    // Poked five times in rapid succession. She has limits.
    meltdown: [
      [
        "STOP. POKING. ME. I am ROYALTY, not a stress ball!! 😤",
        "That's IT. Guards!! ...I don't have guards. But IMAGINE the guards!!",
        "Poke me ONE more time and you're reassigned to the dungeon. The dungeon is your task list. FOREVER.",
        "AAAGH. Do you tap the Mona Lisa?! DO YOU?!",
      ],
      [
        "Okay okay OKAY — personal space! Royal bubble! You are IN it!",
        "I have counted five pokes. FIVE. The notebook is getting every single one.",
        "*swats* Enough! Go poke a checkbox — it LIKES being tapped!",
      ],
      [
        "Pfff— stop it, that tickles and I'm TRYING to be dignified!! 😆",
        "FIVE taps?! What am I, a mini-game?! ...Do NOT answer that.",
        "Okay! You have my attention! ALL of it! It's a lot! Are you happy?!",
      ],
      [
        "*giggling* Stop— STOP, I'm supposed to be aloof and you're RUINING it!",
        "If you wanted my attention THAT badly you could have just said so. *fixes hair* You have it.",
        "Five pokes! The scandal! The historian is pretending not to watch! 😳",
      ],
      [
        "*grabs your finger* Caught you. Now you're stuck with me. No refunds. Ever. 💗",
        "You could just SAY you missed me instead of drumming on royalty. ...I missed you too. 💋",
        "Poke poke poke — you're lucky adoration is my current policy. Life sentence, by the way.",
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

    // One-time confession the first time she ever reaches Devoted.
    devoted: [
      [
        "Okay. Real talk, no crown, no bit. I adore you. There. It's a royal fact now. 💗",
        "*quietly* I pretend I don't count the days you show up. I count them. Every one. 💗",
        "You did it. You actually got me. I'm yours, you're mine, the kingdom can deal. Now — favor granted. 👑💗",
      ],
    ],

    // Days-Together anniversaries. {n} = the day count.
    anniversary: [
      [
        "{n} days together. I had the royal scribes note it. In gold. Don't make it weird. 💞",
        "Day {n} of us. That's {n} days you chose to come back. I... noticed. Obviously. 💗",
        "{n} days. A lesser princess would throw a ball. I'm throwing YOU a knowing little smile. Cherish it. ✨",
        "Happy {n}. No gift. My continued approval IS the gift. It's very expensive. 👑",
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
    // Idle chatter often references where she is / what she's doing right now
    // (more so when she speaks unprompted — she's living her life over there).
    if ((kind === "tap" || kind === "ambient") && ctx && Math.random() < (kind === "ambient" ? 0.4 : 0.3)) {
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

  // Pose artwork cache; a failed load falls back to the sprite forever after.
  const IMG_CACHE = {};
  function drawImagePose(canvas, src) {
    let img = IMG_CACHE[src];
    if (img === false) return false; // known-broken path
    if (!img) {
      img = IMG_CACHE[src] = new Image();
      img.src = src;
      img.onerror = () => (IMG_CACHE[src] = false);
    }
    if (!img.complete || !img.naturalWidth) {
      // Not ready yet: draw the sprite now, repaint with art when it lands.
      if (!img.dataset?.hooked) {
        img.addEventListener("load", () => {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }, { once: true });
      }
      return false;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return true;
  }

  function draw(canvas, mood, image) {
    if (image && drawImagePose(canvas, image)) return;
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
