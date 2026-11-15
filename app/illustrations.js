// Nordic Minimalist SVG Illustrations — Featuring Deer (鹿), Cat (貓咪) & Small Woodland Creatures (小刺蝟、小松鼠、小山雀、小兔)

window.NordicIllustrations = {
  // 1. Wide Header Tapestry: Deer + Cat + Woodland Friends in a Scandinavian Forest Clearing
  forestTapestry: `<svg viewBox="0 0 820 210" fill="none" xmlns="http://www.w3.org/2000/svg" class="nordic-tapestry-svg">
    <!-- Soft organic background hills & sun -->
    <circle cx="670" cy="64" r="38" fill="#EBD8B7" opacity="0.65"/>
    <path d="M0 175 Q180 135 390 168 T820 155 L820 210 L0 210 Z" fill="#E5E0D3" opacity="0.7"/>
    <path d="M0 188 Q260 158 520 182 T820 178 L820 210 L0 210 Z" fill="#D8DEC9" opacity="0.55"/>

    <!-- Minimalist Birch & Pine Trees -->
    <g opacity="0.75">
      <!-- Pine tree left -->
      <line x1="65" y1="75" x2="65" y2="180" stroke="#5F7464" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M65 68 L42 112 L88 112 Z" fill="#8A9A86"/>
      <path d="M65 95 L36 145 L94 145 Z" fill="#6F826C"/>
      <!-- Birch tree back -->
      <line x1="130" y1="50" x2="130" y2="175" stroke="#FAF8F5" stroke-width="6" stroke-linecap="round"/>
      <line x1="128" y1="85" x2="132" y2="85" stroke="#4A524D" stroke-width="2"/>
      <line x1="127" y1="125" x2="131" y2="125" stroke="#4A524D" stroke-width="2"/>
      <circle cx="130" cy="58" r="24" fill="#A9B89E" opacity="0.65"/>
      <!-- Distant pine right -->
      <line x1="755" y1="88" x2="755" y2="182" stroke="#5F7464" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M755 82 L734 126 L776 126 Z" fill="#8A9A86"/>
      <path d="M755 108 L728 156 L782 156 Z" fill="#6F826C"/>
    </g>

    <!-- Nordic Botanical Ferns & Berries -->
    <g stroke="#5F7464" stroke-width="1.8" stroke-linecap="round">
      <path d="M235 185 Q225 155 210 140" fill="none"/>
      <circle cx="210" cy="140" r="3.5" fill="#C87D65" stroke="none"/>
      <circle cx="222" cy="152" r="3" fill="#C87D65" stroke="none"/>
      <circle cx="215" cy="162" r="3" fill="#D4A359" stroke="none"/>
      <path d="M565 182 Q578 152 592 142" fill="none"/>
      <ellipse cx="580" cy="155" rx="6" ry="3" transform="rotate(-30 580 155)" fill="#8A9A86" stroke="none"/>
      <ellipse cx="592" cy="142" rx="6" ry="3" transform="rotate(-25 592 142)" fill="#8A9A86" stroke="none"/>
    </g>

    <!-- MAIN CHARACTER 1: THE NORDIC STAG (北歐森林鹿) -->
    <g class="anim-float-slow" transform="translate(285, 28)">
      <!-- Botanical Antlers -->
      <path d="M72 48 C58 28, 38 18, 22 6" stroke="#8C624C" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M52 28 C48 14, 42 8, 38 2" stroke="#8C624C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M36 18 C26 22, 18 20, 12 16" stroke="#8C624C" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M84 48 C98 28, 118 18, 134 6" stroke="#8C624C" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M104 28 C108 14, 114 8, 118 2" stroke="#8C624C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M120 18 C130 22, 138 20, 144 16" stroke="#8C624C" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <!-- Antler Leaves & Glowing Berries -->
      <circle cx="22" cy="6" r="4" fill="#D4A359"/>
      <circle cx="134" cy="6" r="4" fill="#D4A359"/>
      <ellipse cx="48" cy="14" rx="5" ry="2.5" transform="rotate(-40 48 14)" fill="#8A9A86"/>
      <ellipse cx="108" cy="14" rx="5" ry="2.5" transform="rotate(40 108 14)" fill="#8A9A86"/>
      <!-- Little Nordic Bird perched on right antler! -->
      <g transform="translate(115, 0)">
        <ellipse cx="8" cy="7" rx="7" ry="5.5" fill="#6E8898"/>
        <circle cx="12" cy="4" r="4" fill="#6E8898"/>
        <circle cx="13" cy="3.5" r="1" fill="#FAF8F5"/>
        <polygon points="16,3 20,4.5 16,5.5" fill="#D4A359"/>
        <path d="M4 7 Q8 11 12 8" fill="#C87D65"/>
      </g>
      <!-- Deer Ears -->
      <ellipse cx="60" cy="52" rx="10" ry="4.5" transform="rotate(-25 60 52)" fill="#C88A68"/>
      <ellipse cx="96" cy="52" rx="10" ry="4.5" transform="rotate(25 96 52)" fill="#C88A68"/>
      <!-- Deer Neck & Graceful Body -->
      <path d="M68 62 L58 115 L96 115 L86 62 Z" fill="#C88A68"/>
      <rect x="52" y="102" width="88" height="44" rx="22" fill="#C88A68"/>
      <!-- Cream Chest & Fawn Spots -->
      <path d="M56 82 Q72 95 66 128 L52 122 Z" fill="#F3ECE1"/>
      <circle cx="96" cy="116" r="3.5" fill="#F3ECE1" opacity="0.85"/>
      <circle cx="112" cy="112" r="4" fill="#F3ECE1" opacity="0.85"/>
      <circle cx="124" cy="120" r="3" fill="#F3ECE1" opacity="0.85"/>
      <circle cx="104" cy="126" r="3" fill="#F3ECE1" opacity="0.85"/>
      <!-- Deer Legs -->
      <line x1="64" y1="142" x2="60" y2="162" stroke="#A66E4E" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="78" y1="142" x2="80" y2="162" stroke="#8C583A" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="118" y1="142" x2="116" y2="162" stroke="#A66E4E" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="130" y1="142" x2="134" y2="162" stroke="#8C583A" stroke-width="4.5" stroke-linecap="round"/>
      <!-- Deer Tail -->
      <path d="M138 108 Q150 102 146 118 Z" fill="#F3ECE1"/>
      <!-- Deer Head -->
      <ellipse cx="78" cy="58" rx="16" ry="13" fill="#C88A68"/>
      <ellipse cx="78" cy="64" rx="9" ry="6" fill="#F3ECE1"/>
      <!-- Peaceful Eyes & Nose -->
      <path d="M68 55 Q72 58 75 55" stroke="#2C322E" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M81 55 Q84 58 88 55" stroke="#2C322E" stroke-width="2" stroke-linecap="round" fill="none"/>
      <ellipse cx="78" cy="62" rx="3.5" ry="2.5" fill="#2C322E"/>
    </g>

    <!-- MAIN CHARACTER 2: THE COZY NORDIC CAT (北歐暖窩貓咪) sitting beside the Stag -->
    <g class="anim-breathe" transform="translate(455, 108)">
      <!-- Tail curving gently -->
      <path d="M56 64 C78 64, 84 40, 70 32" stroke="#39403B" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M70 32 C68 30, 72 28, 73 31" stroke="#F3ECE1" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Plump Cat Body -->
      <ellipse cx="38" cy="54" rx="24" ry="22" fill="#39403B"/>
      <!-- White Nordic Bib / Chest -->
      <ellipse cx="32" cy="52" rx="12" ry="13" fill="#F3ECE1"/>
      <!-- Cat Head -->
      <circle cx="32" cy="28" r="16" fill="#39403B"/>
      <!-- Ears -->
      <polygon points="17,22 19,5 30,15" fill="#39403B"/>
      <polygon points="20,20 21,9 28,16" fill="#D99B84"/>
      <polygon points="47,22 45,5 34,15" fill="#39403B"/>
      <polygon points="44,20 43,9 36,16" fill="#D99B84"/>
      <!-- Happy Eyes & Pink Nose -->
      <path d="M23 27 Q26 24 29 27" stroke="#F3ECE1" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M35 27 Q38 24 41 27" stroke="#F3ECE1" stroke-width="2" stroke-linecap="round" fill="none"/>
      <polygon points="30,31 34,31 32,34" fill="#D99B84"/>
      <!-- Whiskers -->
      <line x1="14" y1="30" x2="21" y2="31" stroke="#F3ECE1" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="43" y1="31" x2="50" y2="30" stroke="#F3ECE1" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Little Terracotta Collar with Bell -->
      <path d="M20 40 Q32 45 44 40" stroke="#C87D65" stroke-width="3" stroke-linecap="round" fill="none"/>
      <circle cx="32" cy="43" r="3" fill="#D4A359"/>
    </g>

    <!-- SMALL WOODLAND CREATURE 1: LITTLE HEDGEHOG (小刺蝟) on the left -->
    <g transform="translate(168, 152)">
      <!-- Spines -->
      <path d="M8 24 Q10 4 28 6 Q44 8 44 24 Z" fill="#6E5A4F"/>
      <!-- Little Leaf on back -->
      <ellipse cx="28" cy="7" rx="6" ry="3.5" transform="rotate(-15 28 7)" fill="#C87D65"/>
      <circle cx="21" cy="9" r="2.5" fill="#D4A359"/>
      <!-- Face -->
      <path d="M24 14 L4 22 L24 25 Z" fill="#DFCBB5"/>
      <circle cx="4" cy="22" r="2" fill="#2C322E"/>
      <circle cx="14" cy="19" r="1.5" fill="#2C322E"/>
      <!-- Tiny Paws -->
      <circle cx="16" cy="26" r="2" fill="#6E5A4F"/>
      <circle cx="34" cy="26" r="2" fill="#6E5A4F"/>
    </g>

    <!-- SMALL WOODLAND CREATURE 2: LITTLE SQUIRREL (小松鼠) on the right -->
    <g transform="translate(625, 138)">
      <!-- Fluffy Tail -->
      <path d="M28 34 C48 34, 54 8, 36 6 C24 5, 24 22, 28 30" fill="#B86B4B"/>
      <!-- Body & Head -->
      <ellipse cx="20" cy="28" rx="9" ry="11" fill="#C87D65"/>
      <circle cx="17" cy="15" r="7.5" fill="#C87D65"/>
      <polygon points="15,9 18,3 21,9" fill="#C87D65"/>
      <circle cx="15" cy="14" r="1.5" fill="#2C322E"/>
      <!-- Holding an Acorn -->
      <circle cx="8" cy="24" r="4" fill="#8C583A"/>
      <path d="M4 22 Q8 18 12 22" stroke="#4A3222" stroke-width="2.5" fill="none"/>
    </g>
  </svg>`,

  // 2. Guardian Animal Icons for Life Pillars & UI Badges
  guardians: {
    cat_pair: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#F4E6DF"/>
      <!-- Two cats cuddling: Charcoal cat + Warm Ginger/Cream cat -->
      <path d="M26 74 C22 54, 34 44, 45 48 L47 74 Z" fill="#39403B"/>
      <circle cx="37" cy="40" r="11" fill="#39403B"/>
      <polygon points="27,35 28,23 36,31" fill="#39403B"/>
      <polygon points="47,35 45,23 39,31" fill="#39403B"/>
      <path d="M33 40 Q36 37 39 40" stroke="#F7F4EB" stroke-width="1.6" stroke-linecap="round"/>
      <!-- Second Cat (Terracotta/Cream) leaning in -->
      <path d="M74 74 C78 54, 66 44, 53 48 L50 74 Z" fill="#C87D65"/>
      <circle cx="61" cy="42" r="10.5" fill="#C87D65"/>
      <polygon points="52,37 54,26 60,33" fill="#C87D65"/>
      <polygon points="70,37 69,26 63,33" fill="#C87D65"/>
      <path d="M58 42 Q61 39 64 42" stroke="#F7F4EB" stroke-width="1.6" stroke-linecap="round"/>
      <!-- Intertwined tails forming a heart curve -->
      <path d="M28 72 C14 58, 28 38, 49 24 C70 38, 84 58, 70 72" stroke="#D48C70" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 3" fill="none"/>
      <path d="M46 21 C46 18, 50 18, 50 21 C50 18, 54 18, 54 21 C54 25, 50 28, 50 28 C50 28, 46 25, 46 21 Z" fill="#C87D65"/>
    </svg>`,

    deer: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#E3EAE0"/>
      <!-- Antlers -->
      <path d="M42 36 C34 24, 24 18, 20 10" stroke="#8C624C" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M32 24 L26 14" stroke="#8C624C" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M58 36 C66 24, 76 18, 80 10" stroke="#8C624C" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M68 24 L74 14" stroke="#8C624C" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="20" cy="10" r="3" fill="#D4A359"/>
      <circle cx="80" cy="10" r="3" fill="#D4A359"/>
      <ellipse cx="34" cy="16" rx="4" ry="2" transform="rotate(-30 34 16)" fill="#5F7464"/>
      <ellipse cx="66" cy="16" rx="4" ry="2" transform="rotate(30 66 16)" fill="#5F7464"/>
      <!-- Ears & Head -->
      <ellipse cx="33" cy="40" rx="8" ry="3.5" transform="rotate(-25 33 40)" fill="#C88A68"/>
      <ellipse cx="67" cy="40" rx="8" ry="3.5" transform="rotate(25 67 40)" fill="#C88A68"/>
      <path d="M41 52 L35 82 L65 82 L59 52 Z" fill="#C88A68"/>
      <ellipse cx="50" cy="46" rx="15" ry="13" fill="#C88A68"/>
      <ellipse cx="50" cy="52" rx="8" ry="5.5" fill="#F7F4EB"/>
      <circle cx="43" cy="44" r="2" fill="#2C322E"/>
      <circle cx="57" cy="44" r="2" fill="#2C322E"/>
      <ellipse cx="50" cy="50" rx="3" ry="2.2" fill="#2C322E"/>
      <!-- Fawn spots on neck -->
      <circle cx="45" cy="68" r="2.2" fill="#F7F4EB"/>
      <circle cx="54" cy="64" r="2.5" fill="#F7F4EB"/>
      <circle cx="52" cy="74" r="2" fill="#F7F4EB"/>
    </svg>`,

    cat_cozy: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#EFE8D8"/>
      <!-- Curled sleeping cat with tiny bird -->
      <ellipse cx="50" cy="60" rx="26" ry="18" fill="#39403B"/>
      <circle cx="34" cy="50" r="14" fill="#39403B"/>
      <polygon points="22,43 24,28 33,38" fill="#39403B"/>
      <polygon points="45,43 43,28 35,38" fill="#39403B"/>
      <path d="M27 51 Q30 54 33 51" stroke="#F7F4EB" stroke-width="2" stroke-linecap="round"/>
      <path d="M36 51 Q39 54 42 51" stroke="#F7F4EB" stroke-width="2" stroke-linecap="round"/>
      <polygon points="33,55 36,55 34.5,57" fill="#D99B84"/>
      <!-- Tail wrapped around front -->
      <path d="M72 64 C76 76, 52 78, 38 72" stroke="#F7F4EB" stroke-width="5" stroke-linecap="round"/>
      <!-- Little Nordic Bird sitting on cat's back -->
      <circle cx="58" cy="39" r="6" fill="#6E8898"/>
      <polygon points="64,38 68,39.5 64,41" fill="#D4A359"/>
      <circle cx="60" cy="38" r="1.2" fill="#F7F4EB"/>
    </svg>`,

    hedgehog: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#EAE4DC"/>
      <!-- Hedgehog body & spines -->
      <path d="M26 66 C26 36, 74 34, 76 66 Z" fill="#6E5A4F"/>
      <!-- Berry & Leaf on spines -->
      <ellipse cx="54" cy="36" rx="9" ry="4.5" transform="rotate(-15 54 36)" fill="#8A9A86"/>
      <circle cx="43" cy="39" r="4" fill="#C87D65"/>
      <circle cx="50" cy="42" r="3.5" fill="#D4A359"/>
      <!-- Snout -->
      <path d="M42 48 L18 60 L42 66 Z" fill="#DFCBB5"/>
      <circle cx="18" cy="60" r="3" fill="#2C322E"/>
      <circle cx="32" cy="56" r="2.2" fill="#2C322E"/>
      <circle cx="34" cy="68" r="3" fill="#6E5A4F"/>
      <circle cx="62" cy="68" r="3" fill="#6E5A4F"/>
    </svg>`,

    squirrel: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#F3E8D6"/>
      <!-- Bushy Tail -->
      <path d="M54 68 C82 68, 86 26, 62 24 C46 22, 48 48, 54 60" fill="#B86B4B"/>
      <ellipse cx="42" cy="56" rx="13" ry="16" fill="#C87D65"/>
      <circle cx="38" cy="36" r="11" fill="#C87D65"/>
      <polygon points="35,27 39,18 44,27" fill="#C87D65"/>
      <circle cx="35" cy="35" r="2" fill="#2C322E"/>
      <!-- Acorn -->
      <circle cx="24" cy="50" r="6" fill="#8C583A"/>
      <path d="M18 47 Q24 41 30 47" stroke="#4A3222" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,

    robin: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="#E1EAEF"/>
      <!-- Pine branch -->
      <path d="M18 70 Q50 64 82 72" stroke="#6E5A4F" stroke-width="3" stroke-linecap="round"/>
      <!-- Plump Nordic Robin -->
      <ellipse cx="48" cy="52" rx="18" ry="15" fill="#6E8898"/>
      <path d="M32 50 Q42 64 54 54 C50 44, 38 42, 32 50 Z" fill="#C87D65"/>
      <circle cx="36" cy="42" r="10" fill="#6E8898"/>
      <polygon points="26,41 19,43 26,45" fill="#D4A359"/>
      <circle cx="33" cy="40" r="2" fill="#F7F4EB"/>
      <line x1="45" y1="66" x2="43" y2="70" stroke="#2C322E" stroke-width="2"/>
      <line x1="53" y1="66" x2="51" y2="70" stroke="#2C322E" stroke-width="2"/>
    </svg>`
  },

  // 3. Notebook & Section Companion Illustrations
  notebookCatPeeking: `<svg viewBox="0 0 140 65" fill="none" xmlns="http://www.w3.org/2000/svg" class="peeking-cat-svg">
    <!-- Cat peeking over top edge of the notebook with paws on the border -->
    <path d="M42 62 C42 32, 98 32, 98 62" fill="#39403B"/>
    <polygon points="44,44 46,16 64,34" fill="#39403B"/>
    <polygon points="48,40 49,22 60,34" fill="#D99B84"/>
    <polygon points="96,44 94,16 76,34" fill="#39403B"/>
    <polygon points="92,40 91,22 80,34" fill="#D99B84"/>
    <!-- Curious Golden Eyes -->
    <circle cx="58" cy="46" r="4.5" fill="#D4A359"/>
    <circle cx="58" cy="46" r="2" fill="#2C322E"/>
    <circle cx="82" cy="46" r="4.5" fill="#D4A359"/>
    <circle cx="82" cy="46" r="2" fill="#2C322E"/>
    <polygon points="68,51 72,51 70,54" fill="#D99B84"/>
    <!-- Little White Paws resting on notebook edge -->
    <ellipse cx="46" cy="61" rx="8" ry="4.5" fill="#F7F4EB" stroke="#39403B" stroke-width="1.5"/>
    <ellipse cx="94" cy="61" rx="8" ry="4.5" fill="#F7F4EB" stroke="#39403B" stroke-width="1.5"/>
    <!-- Tiny Sprout on head -->
    <path d="M70 32 Q70 20 78 16" stroke="#8A9A86" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="78" cy="16" rx="5" ry="2.5" transform="rotate(-20 78 16)" fill="#8A9A86"/>
  </svg>`
};
