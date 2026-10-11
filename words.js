// கிறுக்கல் word bank.
//   - Tamil everyday words (3 difficulty tiers) and English everyday words (3 tiers)
//   - Tamil movies and movie/pop-culture characters, written as "தமிழ்|English" pairs so they work in both languages
// Difficulty is about how hard the word is to DRAW / recognise, not how hard it is to spell.

const list = (s) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- Tamil words
const TA_WORDS = {
  easy: list(`
    யானை, சிங்கம், புலி, குரங்கு, பாம்பு, முயல், ஆமை, நண்டு, குதிரை, கரடி, மான், ஆடு, பசு, நாய், பூனை, எலி, அணில், மீன், தவளை, சுறா,
    பன்றி, கழுதை, வௌவால், முதலை, நரி, ஓநாய், ஒட்டகம், கிளி, மயில், காகம், வாத்து, கோழி, சேவல், புறா, ஆந்தை, குயில், கொக்கு,
    தேனீ, எறும்பு, சிலந்தி, கொசு, நத்தை, பல்லி,
    மரம், பூ, இலை, மலை, ஆறு, கடல், நிலா, சூரியன், மேகம், மழை, நெருப்பு, நட்சத்திரம், குகை, பாறை, மணல், புல், வானம், காடு, அலை, ஏரி, தீவு, கல், தீ,
    இட்லி, தோசை, காபி, பால், முட்டை, தேங்காய், ஆப்பிள், கேரட், தக்காளி, வெங்காயம், மிளகாய், பூரி, லட்டு, கேக், ஐஸ்கிரீம், சாக்லேட்,
    உப்பு, சர்க்கரை, சோறு, வடை, பிரியாணி, வாழைப்பழம், மாம்பழம், திராட்சை, தர்பூசணி, அன்னாசி, எலுமிச்சை, ஆரஞ்சு, பப்பாளி, கொய்யா,
    பூண்டு, இஞ்சி, பீட்சா, பர்கர், பரோட்டா, சமோசா, ஜிலேபி, அப்பளம், பிஸ்கட்,
    நாற்காலி, மேசை, கதவு, ஜன்னல், குடை, தொப்பி, கண்ணாடி, கடிகாரம், புத்தகம், பேனா, பென்சில், கத்தரிக்கோல், சாவி, பூட்டு, விளக்கு,
    பலூன், பொம்மை, பந்து, பட்டம், கரண்டி, தட்டு, பானை, அடுப்பு, விசிறி, படுக்கை, சுத்தி, ஏணி, துடைப்பம், செருப்பு, சட்டை, புடவை, மணி,
    கார், பேருந்து, ரயில், படகு, கப்பல், விமானம், சைக்கிள், வீடு, கொடி, கிரீடம், பணம், கத்தி, கூடை, பை, பெட்டி, சுவர், பாலம், சாலை,
    கண், மூக்கு, காது, கை, கால், இதயம், பல், வாய், விரல், தலை, முடி, நாக்கு, வயிறு, முகம்
  `),
  medium: list(`
    திமிங்கிலம், டால்பின், நட்சத்திரமீன், கடல்குதிரை, ஜெல்லிமீன், ஆக்டோபஸ், பென்குயின், ஒட்டகச்சிவிங்கி, காண்டாமிருகம், நீர்யானை,
    வரிக்குதிரை, கங்காரு, பாண்டா, கொரில்லா, சிறுத்தை, மைனா, கழுகு, அன்னம், மரங்கொத்தி, தூக்கணாங்குருவி, குருவி, பட்டாம்பூச்சி,
    கரப்பான்பூச்சி, தேள், மின்மினிப்பூச்சி, புழு, வண்டு,
    வானவில், இடி, மின்னல், எரிமலை, பாலைவனம், அருவி, குளம், கிணறு, பனிமனிதன், வெயில், பூமி, சூரியகாந்தி, தாமரை, ரோஜா, மல்லிகை,
    சாம்பார், சட்னி, பொங்கல், பணியாரம், இடியாப்பம், புட்டு, முறுக்கு, அதிரசம், கொழுக்கட்டை, பாயசம், பாப்கார்ன், சாண்ட்விச், நூடுல்ஸ்,
    சுண்டல், தயிர், வெண்ணெய், தேன், நுங்கு, இளநீர், கரும்பு, உருளைக்கிழங்கு, கத்திரிக்காய், பலாப்பழம், மாதுளை, தேநீர், முட்டைக்கோஸ்,
    மெழுகுவர்த்தி, குடம், தலையணை, சீப்பு, சோப்பு, துண்டு, கைப்பை, நாணயம், தபால்பெட்டி, தொலைபேசி, கணினி, தொலைக்காட்சி, வானொலி,
    குளிர்சாதனப்பெட்டி, மின்விசிறி, கேமரா, வாளி, குழாய், உரல், அம்மி, தராசு, கோடாரி, அரிவாள், கலப்பை, பம்பரம், சதுரங்கம், ஊஞ்சல்,
    தூண்டில், வலை, வில், கேடயம், வாள், சிம்மாசனம், கூடாரம், பூந்தொட்டி, குப்பைத்தொட்டி,
    மாட்டுவண்டி, ஆட்டோ, ஹெலிகாப்டர், ராக்கெட், பள்ளி, கோவில், தேவாலயம், மருத்துவமனை, சந்தை, கடற்கரை, கோட்டை, அரண்மனை, கலங்கரைவிளக்கம்,
    கோலம், வீணை, புல்லாங்குழல், மிருதங்கம், வேட்டி, தாவணி, நாதஸ்வரம், தவில்,
    மருத்துவர், ஆசிரியர், விவசாயி, காவலர், சமையல்காரர், மீனவர், தச்சர், கோமாளி, மந்திரவாதி, ராஜா, ராணி, குழந்தை, பாட்டி, தாத்தா, திருடன், பேய், ரோபோ, தேவதை
  `),
  hard: list(`
    ஒற்றுமை, சுதந்திரம், நட்பு, கனவு, பயம், கோபம், மகிழ்ச்சி, வெற்றி, தோல்வி, நேரம், அமைதி, காதல், பசி, தூக்கம், வலி, ஏமாற்றம்,
    திருவிழா, தீபாவளி, பட்டாசு, ஜல்லிக்கட்டு, கபடி, சிலம்பம், பரதநாட்டியம், கரகாட்டம், தேர், கோபுரம், நூலகம்,
    விமானநிலையம், ரயில்நிலையம், பேருந்துநிலையம், தொலைநோக்கி, நுண்ணோக்கி, செயற்கைக்கோள், விண்கலம், புவியீர்ப்பு, கிரகணம், நிலநடுக்கம், சூறாவளி,
    வெள்ளம், வறட்சி, எதிரொலி, பூகோளம், வரைபடம், திசைகாட்டி, பனிக்கட்டி, கடற்கொள்ளையர், புதையல், மந்திரக்கோல், பறக்கும்தட்டு, வேற்றுகிரகவாசி,
    டைனோசர், டிராகன், கடல்கன்னி, பூதம், சூனியக்காரி, பொம்மலாட்டம், கண்ணாமூச்சி, தேர்தல், பிறந்தநாள், திருமணம், பள்ளிக்கூடம், கிரிக்கெட்,
    கால்பந்து, கூடைப்பந்து, பேட்மிண்டன், கேரம்போர்டு, மாரத்தான், நீச்சல், மலையேற்றம், சர்க்கஸ், மேஜிக், அணைக்கட்டு, காற்றாலை, சூரியஉதயம்,
    சூரியஅஸ்தமனம், தேன்கூடு, சிலந்திவலை, எறும்புப்புற்று, பறவைக்கூடு, ஆலமரம், பனைமரம், வாழைமரம், தென்னைமரம், விண்வெளிவீரர், பறவைகள்கூட்டம்,
    மின்சாரம், ஒளி, நிழல், பனிமூட்டம், பனிச்சறுக்கு, படகுப்போட்டி, ஊர்வலம், கொண்டாட்டம், வாணவேடிக்கை, ஆட்டுக்கிடை, மீன்பிடித்தல், நெல்வயல்
  `),
};

// ---------------------------------------------------------------- English words
const EN_WORDS = {
  easy: list(`
    cat, dog, fish, bird, cow, pig, horse, sheep, duck, frog, snake, lion, tiger, bear, monkey, elephant, rabbit, mouse, turtle, crab, bee, ant, spider,
    snail, butterfly, owl, parrot, peacock, crow, hen, goat, camel, deer, fox, wolf, whale, shark,
    tree, flower, leaf, sun, moon, star, cloud, rain, snow, fire, mountain, river, sea, beach, island, rainbow, grass, rock, sand, wind,
    apple, banana, mango, orange, grapes, carrot, tomato, onion, egg, milk, bread, cake, pizza, burger, cookie, ice cream, rice, cheese, coffee, candy,
    lemon, watermelon, pineapple, strawberry, cherry, potato, corn, popcorn,
    chair, table, door, window, umbrella, hat, glasses, clock, book, pen, pencil, scissors, key, lock, lamp, candle, balloon, toy, ball, kite, spoon, fork,
    plate, cup, bottle, bed, pillow, hammer, ladder, broom, shoe, shirt, sock, bell, car, bus, train, boat, ship, plane, bicycle, house, flag, crown, money,
    knife, basket, bag, box, wall, bridge, road, phone, camera, mirror, soap, towel, comb,
    eye, nose, ear, hand, foot, heart, tooth, mouth, finger, head, hair, tongue, face, leg, arm
  `),
  medium: list(`
    octopus, penguin, kangaroo, panda, gorilla, rhino, hippo, crocodile, leopard, eagle, swan, flamingo, dolphin, jellyfish, starfish, seahorse, scorpion,
    firefly, caterpillar, dragonfly, bat, giraffe, zebra, squirrel,
    volcano, waterfall, desert, forest, cave, tornado, thunder, glacier, snowman, planet, galaxy, lightning, sunflower, cactus,
    sandwich, spaghetti, pancake, doughnut, sushi, honey, pumpkin, coconut, pepper, garlic, mushroom, broccoli, avocado, cupcake, lollipop, noodles, peanut,
    guitar, piano, drum, violin, trumpet, microphone, telescope, microscope, binoculars, compass, magnet, battery, flashlight, remote control, headphones,
    calculator, fridge, oven, toaster, kettle, bucket, anchor, tent, treasure, sword, shield, arrow, castle, throne, helicopter, rocket, submarine,
    motorcycle, tractor, ambulance, skateboard, parachute, hot air balloon, lighthouse, windmill, fountain, bench, swing, television, computer, laptop,
    clown, wizard, pirate, ninja, mermaid, fairy, ghost, robot, vampire, skeleton, king, queen, knight, farmer, teacher, chef, firefighter,
    astronaut, scarecrow, snowflake, pyramid, tunnel, trophy, medal, ring, necklace, backpack, wallet, envelope, calendar, globe
  `),
  hard: list(`
    freedom, music, dream, nightmare, friendship, love, anger, silence, time, gravity, electricity, shadow, echo, mystery, victory, jealousy, memory,
    secret, danger, sleep, hunger, sneeze, hiccup, daydream, shopping, camping, fishing, traffic jam, sunburn, earthquake, flood, eclipse, birthday party,
    wedding, graduation, haircut, marathon, yoga, karate, ballet, circus, magic trick, fireworks, parade, picnic, library, hospital, airport, museum,
    supermarket, skyscraper, laboratory, satellite, dinosaur, dragon, unicorn, alien, flying saucer, time machine, black hole, solar system, pollution,
    recycling, global warming, treasure map, bermuda triangle, haunted house, roller coaster, ferris wheel, bungee jump, scuba diving, rock climbing,
    tug of war, hide and seek, musical chairs, spider web, bee hive, ant hill, bird nest, quicksand, avalanche, lava lamp, snow globe, hourglass,
    sundial, weather vane, drawbridge, escalator, elevator, traffic light, zebra crossing, fire escape, vending machine, hot dog
  `),
};

// ---------------------------------------------------------------- Tamil movies  ("தமிழ்|English")
const MOVIES = {
  easy: list(`
    லியோ|Leo, மாஸ்டர்|Master, ரெமோ|Remo, பிகில்|Bigil, கபாலி|Kabali, காலா|Kaala, தெறி|Theri, மெர்சல்|Mersal, சர்கார்|Sarkar, 
    கில்லி|Ghilli, ஜெயிலர்|Jailer, விக்ரம்|Vikram, கைதி|Kaithi, டாக்டர்|Doctor, டான்|Don, மாரி|Maari, பில்லா|Billa, மங்காத்தா|Mankatha,
    துப்பாக்கி|Thuppakki, இந்தியன்|Indian, அந்நியன்|Anniyan, எந்திரன்|Enthiran, சிவாஜி|Sivaji, பாட்ஷா|Baasha,
    முத்து|Muthu, அண்ணாமலை|Annamalai, கஜினி|Ghajini, போக்கிரி|Pokkiri, சாமி|Saamy, தளபதி|Thalapathi, நாயகன்|Nayakan,
    பாம்பே|Bombay, அசுரன்|Asuran, கர்ணன்|Karnan, வாரிசு|Varisu, துணிவு|Thunivu, வேதாளம்|Vedalam, வீரம்|Veeram,
    வலிமை|Valimai, விஸ்வாசம்|Viswasam, மின்னலே|Minnale, தூள்|Dhool, சிட்டிசன்|Citizen
  `),
  medium: list(`
    படையப்பா|Padayappa, சந்திரமுகி|Chandramukhi, முதல்வன்|Mudhalvan, ஆடுகளம்|Aadukalam, பருத்திவீரன்|Paruthiveeran,
    சுப்பிரமணியபுரம்|Subramaniapuram, காக்கா முட்டை|Kaakka Muttai, வடசென்னை|Vada Chennai, சூரரைப் போற்று|Soorarai Pottru, ஜெய் பீம்|Jai Bhim,
    அண்ணாத்த|Annaatthe, என்னை அறிந்தால்|Yennai Arindhaal, ஆரம்பம்|Arrambam, ஆட்டோகிராப்|Autograph, அழகி|Azhagi, அலைபாயுதே|Alaipayuthey,
    தசாவதாரம்|Dasavatharam, விஸ்வரூபம்|Vishwaroopam, குணா|Guna, மகாநதி|Mahanadhi, விசாரணை|Visaranai, பாகுபலி|Baahubali,
    பொன்னியின் செல்வன்|Ponniyin Selvan, ஆயிரத்தில் ஒருவன்|Aayirathil Oruvan, தில்|Dhill, திருப்பாச்சி|Thirupaachi, வில்லு|Villu,
    வேலாயுதம்|Velayudham, அயன்|Ayan, வரலாறு|Varalaru, பையா|Paiyaa, சேது|Sethu, நந்தா|Nandha, பிதாமகன்|Pithamagan
  `),
  hard: list(`
    அன்பே சிவம்|Anbe Sivam, அவ்வை சண்முகி|Avvai Shanmugi, மூன்றாம் பிறை|Moondram Pirai, விண்ணைத்தாண்டி வருவாயா|Vinnaithaandi Varuvaayaa,
    காதலுக்கு மரியாதை|Kadhalukku Mariyadhai, வாரணம் ஆயிரம்|Vaaranam Aayiram, எங்க வீட்டுப் பிள்ளை|Enga Veettu Pillai, ஏழாம் அறிவு|7aum Arivu,
    தென்மேற்குப் பருவக்காற்று|Thenmerku Paruvakaatru, பரியேறும் பெருமாள்|Pariyerum Perumal, விக்ரம் வேதா|Vikram Vedha,
    ஒரு கல் ஒரு கண்ணாடி|Oru Kal Oru Kannadi, தனி ஒருவன்|Thani Oruvan, நான் மகான் அல்ல|Naan Mahaan Alla, வேட்டையாடு விளையாடு|Vettaiyaadu Vilaiyaadu,
    காக்க காக்க|Kaakha Kaakha, புதுப்பேட்டை|Pudhupettai, சின்னத்தம்பி|Chinna Thambi, கரகாட்டக்காரன்|Karakattakaran,
    அபூர்வ சகோதரர்கள்|Apoorva Sagodharargal, மைக்கேல் மதன காமராஜன்|Michael Madana Kamarajan, ஜென்டில்மேன்|Gentleman
  `),
};

// ---------------------------------------------------------------- Characters  ("தமிழ்|English")
const CHARACTERS = {
  easy: list(`
    சிட்டி|Chitti, ரோலக்ஸ்|Rolex, ஸ்பைடர்மேன்|Spiderman, பேட்மேன்|Batman, சூப்பர்மேன்|Superman, டாம்|Tom, ஜெர்ரி|Jerry, டோரா|Dora,
    மிக்கி மவுஸ்|Mickey Mouse, டொனால்ட் டக்|Donald Duck, சோட்டா பீம்|Chhota Bheem, கட்டப்பா|Kattappa, அயன்மேன்|Iron Man
  `),
  medium: list(`
    வசீகரன்|Vaseegaran, வசூல் ராஜா|Vasool Raja, நேசமணி|Nesamani, கைப்புள்ள|Kaipulla, ஸ்நேக் பாபு|Snake Babu, தெனாலிராமன்|Tenali Raman,
    பீர்பால்|Birbal, விக்கிரமாதித்தன்|Vikramadithan, கண்ணகி|Kannagi, திருவள்ளுவர்|Thiruvalluvar, அவ்வையார்|Avvaiyar,
    கட்டபொம்மன்|Kattabomman, ராஜராஜ சோழன்|Raja Raja Chozhan, பாரதியார்|Bharathiyar, குந்தவை|Kundavai
  `),
  hard: list(`
    என்கவுண்டர் ஏகாம்பரம்|Encounter Ekambaram, வந்தியத்தேவன்|Vandiyathevan, அருண்மொழிவர்மன்|Arulmozhivarman,
    ஆதித்த கரிகாலன்|Aditha Karikalan, நந்தினி|Nandini, பல்வாள்தேவன்|Bhallaladeva, கோவலன்|Kovalan, பரமார்த்த குரு|Paramartha Guru
  `),
};

const TIERS = ['easy', 'medium', 'hard'];
const CATS = ['words', 'movies', 'characters'];
const pairOf = (s) => { const [ta, en] = s.split('|').map((x) => x.trim()); return { ta, en }; };

// All entries for a language / difficulty / category selection.
//   word : what is displayed to the drawer and used for the hints
//   ta   : Tamil spelling when one exists (used to accept Tanglish typing in either language)
//   alts : extra spellings accepted as correct
function pool(lang, difficulty, cats) {
  const tiers = TIERS.includes(difficulty) ? [difficulty] : TIERS;
  const out = [];
  for (const cat of CATS) {
    if (!cats.includes(cat)) continue;
    for (const t of tiers) {
      if (cat === 'words') {
        for (const w of (lang === 'en' ? EN_WORDS : TA_WORDS)[t]) out.push({ word: w, ta: lang === 'ta' ? w : null, alts: [], cat, tier: t });
      } else {
        for (const s of (cat === 'movies' ? MOVIES : CHARACTERS)[t]) {
          const { ta, en } = pairOf(s);
          out.push(lang === 'en' ? { word: en, ta, alts: [], cat, tier: t } : { word: ta, ta, alts: [en], cat, tier: t });
        }
      }
    }
  }
  return out;
}

module.exports = { pool, TIERS, CATS, TA_WORDS, EN_WORDS, MOVIES, CHARACTERS, pairOf };
