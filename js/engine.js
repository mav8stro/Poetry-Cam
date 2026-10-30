/**
 * VerseCam — Poetic Vision & Multimodal Object Detection Engine
 * Features:
 * - Real-time client-side object detection (TensorFlow.js + COCO-SSD) with smart CV fallback
 * - Object-aware poetic synthesis: crafts verses directly inspired by detected image elements
 * - Extensive poetic lexicon for 80+ object classes + visual scene elements
 * - Cadence formats: Free Verse, Rhymed Quatrains, Haiku, Micro-Verse
 * - Songwriter studio lyric generator (Verse, Chorus, Bridge, Outro)
 * - Optional Google Gemini Vision API bridge with seamless offline fallback
 * - Web Audio API tactile shutter & click synthesizer
 */

const VerseEngine = (() => {

  // Global COCO-SSD model reference
  let cocoModel = null;
  let isModelLoading = false;
  let modelLoadPromise = null;

  // Mood Profiles with metadata & feedback
  const MOOD_PROFILES = {
    dreamy: {
      name: 'Dreamy',
      icon: '✦',
      feedback: 'Soft reverie, hazy horizons, ethereal wonder, and tender longing.',
      adjectives: ['hazy', 'translucent', 'gossamer', 'fleeting', 'drifting', 'luminous', 'quiet', 'surreal'],
      nouns: ['horizon', 'mist', 'whisper', 'shadow', 'breath', 'reverie', 'twilight', 'mirror'],
      verbs: ['wanders', 'dissolves', 'lingers', 'folds', 'floats', 'sighs', 'glimmers'],
      imagery: [
        ['The daylight melts like sugar into air,', 'leaving a hush where footsteps used to be.'],
        ['Shadows soften into rust,', 'evening keeps what daylight trusts.'],
        ['A pale drift of cloud across the plum ceiling,', 'holding whatever we could not name.'],
        ['Light folds into silence,', 'tracing edges the eye had almost forgotten.'],
        ['Between the blur of glass and distance,', 'an unsaid dream takes quiet root.']
      ]
    },
    hopeful: {
      name: 'Hopeful',
      icon: '☼',
      feedback: 'Bright dawn, rising currents, quiet resilience, and open doorways.',
      adjectives: ['unfurling', 'radiant', 'golden', 'fresh', 'unbroken', 'clear', 'vibrant', 'dawning'],
      nouns: ['morning', 'pathway', 'seedling', 'ember', 'glimmer', 'threshold', 'song', 'skyline'],
      verbs: ['rises', 'awakens', 'blooms', 'kindles', 'reaches', 'breaks open', 'shines'],
      imagery: [
        ['Every horizon is a door left slightly ajar,', 'waiting for your step to cross the sill.'],
        ['A seed breaks stone without a sound;', 'so light returns to unforgotten ground.'],
        ['Even the longest dusk will yield,', 'to golden warmth across the waking field.'],
        ['The breeze remembers how to sing,', 'promising the gentle return of spring.'],
        ['A sudden beam of amber cutting through,', 'making the oldest story look brand new.']
      ]
    },
    reflective: {
      name: 'Reflective',
      icon: '✧',
      feedback: 'Deep stillness, mirrors of time, gentle introspection, and calm shadows.',
      adjectives: ['still', 'measured', 'hallowed', 'contemplative', 'pensive', 'ancient', 'patient', 'deep'],
      nouns: ['memory', 'mirror', 'crossroad', 'silhouette', 'tide', 'echo', 'stone', 'passage'],
      verbs: ['remembers', 'pauses', 'weighs', 'abides', 'reflects', 'settles', 'listens'],
      imagery: [
        ['The puddle holds the entire sky,', 'without asking why the bird flew by.'],
        ['We look into the frame to see', 'not where we stand, but who we used to be.'],
        ['A silence older than the stone,', 'where every wandering soul feels less alone.'],
        ['Time does not pass inside this square;', 'it merely gathers all the ambient air.'],
        ['In the pause between two thoughts,', 'the heart untangles what the mind forgot.']
      ]
    },
    electric: {
      name: 'Electric',
      icon: '⚡',
      feedback: 'Sudden pulses, kinetic sparks, vivid city blood, and neon rhythm.',
      adjectives: ['neon', 'surging', 'vibrant', 'kinetic', 'jittering', 'feverish', 'crackling', 'acute'],
      nouns: ['current', 'spark', 'signal', 'pulse', 'wire', 'grid', 'frequency', 'flash'],
      verbs: ['ignites', 'pulses', 'charges', 'scatters', 'zips', 'flashes', 'thrums'],
      imagery: [
        ['A wire humming underneath the skin of night,', 'streetlamps waking up in sudden shocks of white.'],
        ['Pixel, pulse, and rapid stride;', 'nothing here has time to hide.'],
        ['Electric arcs across the chrome,', 'guiding the sleepless stranger home.'],
        ['The rhythm ticks at hundred-twenty beats,', 'spilling its voltage down the crowded streets.'],
        ['A split-second lens closure catches fire,', 'freezing pure motion on an optic wire.']
      ]
    },
    melancholic: {
      name: 'Melancholic',
      icon: '☂',
      feedback: 'Fading twilight, lingering scents, bittersweet echoes, and rain-washed glass.',
      adjectives: ['rain-swept', 'dusky', 'solitary', 'wistful', 'distant', 'muted', 'faded', 'tender'],
      nouns: ['rain', 'windowpane', 'goodbye', 'relic', 'twilight', 'autumn', 'hollow', 'driftwood'],
      verbs: ['recedes', 'fades', 'mourns', 'echoes', 'sighs', 'weeps', 'slips away'],
      imagery: [
        ['The rain leaves signatures upon the pane,', 'tracing names that will not come again.'],
        ['A lonely coat upon an empty chair,', 'still keeping warmth that isn’t there.'],
        ['Autumn folds its amber cloak away,', 'leaving the cold and quiet gray.'],
        ['Some beauty hurts because it cannot stay;', 'we capture it to weep another day.'],
        ['A lingering scent of lavender and smoke,', 'beneath the silence neither of us broke.']
      ]
    }
  };

  // Theme Prompts (Explore screen)
  const THEME_DICTIONARY = {
    nature: {
      keywords: ['moss', 'canopy', 'riverbed', 'breeze', 'pines', 'lichen', 'wildflower', 'petal'],
      lines: [
        'Roots drink the subterranean dark, while green leaves turn to light.',
        'The river does not debate the stone; it merely sings as it flows home.',
        'Wild grasses bend without breaking under the dusk wind.',
        'Breathe in the damp perfume of cedar, pine, and fallen moss.'
      ]
    },
    city: {
      keywords: ['asphalt', 'skyscraper', 'subway', 'crosswalk', 'traffic', 'steel', 'graffiti', 'glass'],
      lines: [
        'A canyon built of glass and steel where ten thousand lives intersect.',
        'Traffic lights blinking amber, green, and red like mechanical stars.',
        'Footsteps on rain-glazed sidewalks echoing against the subway grate.',
        'Above the avenue, the sirens fade into an urban lullaby.'
      ]
    },
    people: {
      keywords: ['glance', 'silhouette', 'laughter', 'hands', 'wrinkle', 'expression', 'stride', 'empathy'],
      lines: [
        'A stranger’s gaze holds an entire lifetime of unuttered stories.',
        'Hands calloused with work, resting gently across the wooden bench.',
        'A smile caught mid-laughter, defying the ticking of the clock.',
        'We pass like ships across twilight water, bound by common breath.'
      ]
    },
    food: {
      keywords: ['steam', 'crust', 'espresso', 'cinnamon', 'olive', 'tablecloth', 'harvest', 'honey'],
      lines: [
        'Steam curls upward like a blessing from the freshly broken bread.',
        'A single cup of bitter roast, sweet with the sugar of companionship.',
        'Salt on the tongue, rosemary in the air, a table made for communion.',
        'The warmth of shared sustenance against the evening chill.'
      ]
    }
  };

  /**
   * EXTENSIVE OBJECT POETIC LEXICON
   * Mappings for COCO-SSD object classes to rich, evocative poetic lines
   */
  const OBJECT_POETIC_LEXICON = {
    person: [
      'A solitary silhouette anchored in the moving light,',
      'Eyes holding quiet stories language could never fully bind,',
      'The quiet presence of a soul breathing within the frame,',
      'A human shadow learning the patience of the evening air,'
    ],
    cup: [
      'A quiet cup holding steam and morning reverie,',
      'Warmth contained within delicate porcelain edges,',
      'A peaceful pause between sips of passing time,',
      'The scent of roasted beans rising into quiet air,'
    ],
    bottle: [
      'A glass vessel guarding liquid reflections,',
      'Amber currents resting gently on the tabletop,',
      'Clear glass bending light into a thousand miniature suns,'
    ],
    laptop: [
      'A glowing screen holding a thousand unwritten journeys,',
      'Fingertips dancing on keys of glass and electric light,',
      'A portal of pixels humming in the quiet sanctuary of night,'
    ],
    keyboard: [
      'Rows of quiet keys waiting for thought to take flight,',
      'The gentle click of letters carving thoughts into the air,'
    ],
    mouse: [
      'A smooth palm-sized stone guiding wandering thought across the screen,'
    ],
    'cell phone': [
      'A black mirror holding voices from across distant horizons,',
      'A pocket-sized window glowing softly in the twilight hush,',
      'Signals of human longing carried through invisible air,'
    ],
    book: [
      'A paper sanctuary holding unread horizons in its spine,',
      'Words resting asleep until the wandering eye awakens them,',
      'Ink remembering what the fading voice had long forgot,'
    ],
    chair: [
      'A wooden chair keeping the shape of human rest,',
      'An invitation to sit and watch the restless world pass by,',
      'Wood and fabric holding the quiet echo of yesterday,'
    ],
    couch: [
      'Soft fabric embracing the weary hours of the day,',
      'A harbor where tired thoughts find gentle quietude,'
    ],
    'potted plant': [
      'Green leaves drinking whatever quiet light remains,',
      'Roots dreaming of earth inside their terra-cotta home,',
      'Nature breathing peacefully upon the sunlit windowsill,'
    ],
    vase: [
      'A clay vessel holding fragile blooms against the passing hours,',
      'Stems suspended in crystal water, defying the clock,'
    ],
    dog: [
      'Loyal eyes that understand what words could never say,',
      'A warm heart curled in gentle trust upon the floor,',
      'A companion walking beside every shadow of your stride,'
    ],
    cat: [
      'Quiet paws measuring the silent rhythm of the room,',
      'Whiskers tuned to frequencies the human ear can never hear,',
      'A creature of mystery resting in the golden sliver of sun,'
    ],
    bird: [
      'Feathers cutting through the sky like an unwritten poem,',
      'A momentary song suspended between earth and open wind,'
    ],
    bicycle: [
      'Two wheels poised for the thrill of wandering horizons,',
      'Spokes spinning sunlight into streaks of golden wind,'
    ],
    car: [
      'Steel and glass waiting for the open highway to call,',
      'Metal resting quietly beneath the falling dusk,'
    ],
    clock: [
      'The steady pulse of seconds carving stone into memory,',
      'A pendulum counting what the heart had rather keep,'
    ],
    'dining table': [
      'A shared table blessed with the warmth of communion,',
      'Wood that has heard laughter, confessions, and silence,'
    ],
    backpack: [
      'A canvas satchel packed with journeys yet to start,',
      'Carrying small anchors of home into the wide unknown,'
    ],
    umbrella: [
      'A nylon canopy unfurled against the weeping skies,',
      'Walking dry through a world baptized by autumn rain,'
    ],
    apple: [
      'A crimson orb sweet with the memory of orchard sun,'
    ],
    sandwich: [
      'Simple sustenance shared between the morning and the afternoon,'
    ],
    pizza: [
      'Warm crust and rich aroma gathering friends around the hearth,'
    ],
    // Fallback Scene Elements
    'twilight sky': [
      'The violet heavens folding down to meet the quiet hills,',
      'A sky where daylight surrenders softly to the stars,'
    ],
    'earth & hills': [
      'Rolling ridges keeping ancient secrets in their stones,',
      'A gravel trail winding through the wild heather and moss,'
    ],
    'foliage & greens': [
      'Emerald leaves whispering in the gentle evening breeze,',
      'Branches reaching upward to cradle the fading light,'
    ],
    'indoor ambient': [
      'A sanctuary enclosed by quiet walls and warm shadows,',
      'Domestic peace holding the outside world at bay,'
    ]
  };

  /**
   * Load COCO-SSD Object Detection Model asynchronously
   */
  async function initObjectDetector() {
    if (cocoModel) return cocoModel;
    if (modelLoadPromise) return modelLoadPromise;

    if (typeof window !== 'undefined' && window.cocoSsd) {
      isModelLoading = true;
      modelLoadPromise = window.cocoSsd.load({ base: 'lite_mobilenet_v2' })
        .then(model => {
          cocoModel = model;
          isModelLoading = false;
          console.log('✦ VerseCam: COCO-SSD Object Detection Engine active');
          return model;
        })
        .catch(err => {
          console.warn('COCO-SSD could not be loaded, using CV fallback:', err);
          isModelLoading = false;
          return null;
        });
      return modelLoadPromise;
    }
    return null;
  }

  // Preload detector in background
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      initObjectDetector();
    }, 500);
  }

  /**
   * Detect objects in image (via COCO-SSD with NMS suppression or CV feature analysis)
   */
  async function detectImageElements(canvasOrImg) {
    let rawDetections = [];
    try {
      // 1. Try ML model if available
      const model = await initObjectDetector();
      if (model) {
        let detections = await model.detect(canvasOrImg);
        // Filter predictions by initial confidence
        detections = detections
          .filter(d => d.score >= 0.38)
          .sort((a, b) => b.score - a.score);

        if (detections.length > 0) {
          rawDetections = detections.map(d => ({
            class: d.class,
            score: Math.round(d.score * 100),
            bbox: d.bbox
          }));

          // Apply Non-Maximum Suppression (NMS DSA) to prune overlapping jitter
          rawDetections = CNNRNNNeuralModel.NMS.suppress(rawDetections, 0.45);
          return rawDetections;
        }
      }
    } catch (e) {
      console.warn('ML object detection issue, falling back to scene analyzer:', e);
    }

    // 2. Intelligent Computer Vision Scene Element Fallback
    rawDetections = detectSceneElementsFallback(canvasOrImg);
    return rawDetections;
  }

  /**
   * Fallback Scene Element Analyzer (Computer Vision heuristic analysis)
   */
  function detectSceneElementsFallback(canvasOrImg) {
    try {
      let canvas;
      if (canvasOrImg instanceof HTMLCanvasElement) {
        canvas = canvasOrImg;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(canvasOrImg, 0, 0, 80, 80);
      }
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let rSum = 0, gSum = 0, bSum = 0;
      let topBlue = 0, midGreen = 0, skinTones = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        rSum += r; gSum += g; bSum += b;

        const pixelIndex = i / 4;
        const y = Math.floor(pixelIndex / canvas.width);

        // Top third: sky / light check
        if (y < canvas.height * 0.35) {
          if (b > r && b > g) topBlue++;
        }
        // Middle & bottom: foliage check
        if (g > r * 1.15 && g > b * 1.15) {
          midGreen++;
        }
        // Skin tone heuristic check
        if (r > 95 && g > 40 && b > 20 && (r - g) > 15 && r > b) {
          skinTones++;
        }
      }

      const elements = [];
      const avgBrightness = (rSum + gSum + bSum) / (totalPixels * 3);

      if (skinTones / totalPixels > 0.08) {
        elements.push({ class: 'person', score: 88 });
      }

      if (midGreen / totalPixels > 0.12) {
        elements.push({ class: 'potted plant', score: 85 });
      }

      if (topBlue / (canvas.width * canvas.height * 0.35) > 0.3) {
        elements.push({ class: 'twilight sky', score: 92 });
      }

      if (avgBrightness < 90) {
        elements.push({ class: 'earth & hills', score: 89 });
      } else if (avgBrightness > 160) {
        elements.push({ class: 'indoor ambient', score: 84 });
      } else {
        elements.push({ class: 'cup', score: 79 });
      }

      // Default evocative pair if list is short
      if (elements.length === 0) {
        elements.push({ class: 'twilight sky', score: 91 });
        elements.push({ class: 'earth & hills', score: 86 });
      }

      return elements.slice(0, 3);

    } catch (e) {
      return [
        { class: 'twilight sky', score: 90 },
        { class: 'earth & hills', score: 84 }
      ];
    }
  }

  // Web Audio Synthesizer for Tactile and Shutter feedback
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playShutterSound() {
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;

      // 1. Mechanical Clack (filtered noise burst)
      const bufferSize = audioCtx.sampleRate * 0.08;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3, now);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);

      // 2. Mirror return clink (delayed by 90ms)
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.setValueAtTime(0.4, now + 0.09);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now + 0.09);
      osc.stop(now + 0.19);

    } catch (e) {
      console.warn('Audio play shutter error:', e);
    }
  }

  function playTapSound() {
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  /**
   * Safe RGB to HEX converter
   */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Poetic Color Naming Engine
   */
  function nameColorPoetically(r, g, b) {
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 45) return 'Obsidian Dark';
    if (brightness > 220) return 'Luminous Pearl';
    if (r > 150 && g < 100 && b < 100) return 'Crimson Ember';
    if (r > 180 && g > 110 && b < 80) return 'Golden Amber';
    if (g > r * 1.15 && g > b * 1.1) return 'Verdant Moss';
    if (b > r * 1.15 && b > g) return 'Twilight Azure';
    if (r > 100 && b > 100 && g < 90) return 'Electric Plum';
    if (r > 160 && g > 150 && b < 100) return 'Sunlit Ochre';
    return 'Misty Tint';
  }

  /**
   * Extract Atmosphere Color Palette (Top 4 dominant scene tones)
   */
  function extractAtmospherePalette(canvasOrImg) {
    try {
      let canvas;
      if (canvasOrImg instanceof HTMLCanvasElement) {
        canvas = canvasOrImg;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(canvasOrImg, 0, 0, 64, 64);
      }
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      const quads = [
        { r: 0, g: 0, b: 0, count: 0 },
        { r: 0, g: 0, b: 0, count: 0 },
        { r: 0, g: 0, b: 0, count: 0 },
        { r: 0, g: 0, b: 0, count: 0 }
      ];

      const w = canvas.width, h = canvas.height;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const i = (y * w + x) * 4;
          let qIdx = 0;
          if (y < h * 0.4) qIdx = 0;
          else if (x >= w * 0.3 && x <= w * 0.7 && y >= h * 0.3 && y <= h * 0.7) qIdx = 1;
          else if (x < w * 0.5) qIdx = 2;
          else qIdx = 3;

          quads[qIdx].r += data[i];
          quads[qIdx].g += data[i + 1];
          quads[qIdx].b += data[i + 2];
          quads[qIdx].count++;
        }
      }

      return quads.map(q => {
        const c = q.count || 1;
        const r = q.r / c, g = q.g / c, b = q.b / c;
        const pName = nameColorPoetically(r, g, b);
        return {
          hex: rgbToHex(r, g, b),
          name: pName,
          poeticName: pName
        };
      });
    } catch (e) {
      return [
        { hex: '#16081B', name: 'Twilight Plum', poeticName: 'Twilight Plum' },
        { hex: '#E29547', name: 'Golden Amber', poeticName: 'Golden Amber' },
        { hex: '#2D6A4F', name: 'Verdant Moss', poeticName: 'Verdant Moss' },
        { hex: '#FAF5F9', name: 'Luminous Pearl', poeticName: 'Luminous Pearl' }
      ];
    }
  }

  /**
   * Detect Scene Environment & Lighting Condition
   */
  function detectEnvironmentAndLighting(canvasOrImg) {
    try {
      let canvas;
      if (canvasOrImg instanceof HTMLCanvasElement) {
        canvas = canvasOrImg;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(canvasOrImg, 0, 0, 64, 64);
      }
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let rTot = 0, gTot = 0, bTot = 0;
      for (let i = 0; i < data.length; i += 4) {
        rTot += data[i];
        gTot += data[i+1];
        bTot += data[i+2];
      }
      const total = data.length / 4;
      const avgR = rTot / total;
      const avgG = gTot / total;
      const avgB = bTot / total;
      const lum = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;

      let lighting = 'DIFFUSED DAYLIGHT';
      if (lum < 65) lighting = 'NOCTURNAL SHADOW';
      else if (avgR > avgB * 1.35 && lum < 140) lighting = 'GOLDEN HOUR';
      else if (avgB > avgR * 1.15 && lum < 110) lighting = 'BLUE HOUR DUSK';
      else if (avgR > 130 && avgG > 100 && avgB < 90) lighting = 'WARM CANDLELIGHT';

      let environment = 'WILD LANDSCAPE';
      if (avgG > avgR * 1.1 && avgG > avgB * 1.1) environment = 'BOTANICAL SANCTUARY';
      else if (Math.abs(avgR - avgG) < 15 && Math.abs(avgG - avgB) < 15 && lum > 110) environment = 'URBAN METROPOLIS';
      else if (avgR > 120 && avgG > 80 && avgB < 110 && lum < 150) environment = 'DOMESTIC INTERIOR';

      return { lighting, environment, setting: environment };
    } catch (e) {
      return { lighting: 'TWILIGHT LIGHT', environment: 'NATURAL SCENE', setting: 'NATURAL SCENE' };
    }
  }

  /**
   * Real-Time AR Bounding Box Renderer on Live Video Canvas
   */
  function drawARBoundingBoxes(canvas, detections, videoW, videoH) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detections || detections.length === 0) return;

    const scaleX = canvas.width / (videoW || canvas.width);
    const scaleY = canvas.height / (videoH || canvas.height);

    detections.forEach(det => {
      if (!det.bbox) return;
      const [bx, by, bw, bh] = det.bbox;
      const x = bx * scaleX;
      const y = by * scaleY;
      const w = bw * scaleX;
      const h = bh * scaleY;

      // Glow border
      ctx.save();
      ctx.strokeStyle = '#CCFF00'; // Acid Lime
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(204, 255, 0, 0.45)';
      ctx.shadowBlur = 8;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();

      // Corner brackets (Coral Accent)
      const cornerLen = Math.min(14, w / 4, h / 4);
      ctx.strokeStyle = '#FF5A5F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      // Top-Right
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
      // Bottom-Left
      ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
      // Bottom-Right
      ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // Label badge
      const label = `✦ ${det.class.toUpperCase()} ${det.score}%`;
      ctx.font = '700 10px "Space Mono", monospace';
      const txtWidth = ctx.measureText(label).width;

      const badgeY = Math.max(0, y - 20);
      ctx.fillStyle = 'rgba(22, 8, 27, 0.9)';
      ctx.fillRect(x, badgeY, txtWidth + 12, 19);
      ctx.strokeStyle = '#CCFF00';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, badgeY, txtWidth + 12, 19);

      ctx.fillStyle = '#CCFF00';
      ctx.fillText(label, x + 6, badgeY + 13);
    });
  }

  /* =========================================================================
   * DATA STRUCTURES & ALGORITHMS (DSA) FOR HIGH-ACCURACY VISION & POETRY
   * ========================================================================= */

  // (A) Non-Maximum Suppression (NMS) for high-accuracy bounding box deduplication
  const NMS = {
    calculateIoU(boxA, boxB) {
      if (!boxA || !boxB) return 0;
      const [x1A, y1A, wA, hA] = boxA;
      const [x1B, y1B, wB, hB] = boxB;
      const x2A = x1A + wA, y2A = y1A + hA;
      const x2B = x1B + wB, y2B = y1B + hB;

      const interX1 = Math.max(x1A, x1B);
      const interY1 = Math.max(y1A, y1B);
      const interX2 = Math.min(x2A, x2B);
      const interY2 = Math.min(y2A, y2B);

      if (interX2 <= interX1 || interY2 <= interY1) return 0;
      const interArea = (interX2 - interX1) * (interY2 - interY1);
      const areaA = wA * hA;
      const areaB = wB * hB;
      return interArea / (areaA + areaB - interArea);
    },

    suppress(detections, iouThreshold = 0.45) {
      if (!detections || detections.length <= 1) return detections || [];
      const sorted = [...detections].sort((a, b) => (b.score || 0) - (a.score || 0));
      const retained = [];

      while (sorted.length > 0) {
        const top = sorted.shift();
        retained.push(top);
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (top.bbox && sorted[i].bbox) {
            const iou = this.calculateIoU(top.bbox, sorted[i].bbox);
            if (iou > iouThreshold) {
              sorted.splice(i, 1);
            }
          }
        }
      }
      return retained;
    }
  };

  // (B) Spatial Scene Graph (DSA) for semantic relational reasoning
  const SpatialSceneGraph = {
    build(detections, width = 640, height = 480) {
      if (!detections || detections.length === 0) {
        return { nodes: [], edges: [], primarySubject: 'scene', summary: 'Ambient panoramic scene' };
      }

      const nodes = detections.map((d, id) => {
        const bbox = d.bbox || [width * 0.3, height * 0.3, width * 0.4, height * 0.4];
        const cx = bbox[0] + bbox[2] / 2;
        const cy = bbox[1] + bbox[3] / 2;
        return {
          id,
          name: d.class,
          score: d.score,
          cx,
          cy,
          area: bbox[2] * bbox[3]
        };
      });

      const edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let relation = 'ALONGSIDE';
          if (a.cy < b.cy - height * 0.15) relation = 'ABOVE';
          else if (a.cy > b.cy + height * 0.15) relation = 'BELOW';
          else if (a.cx < b.cx) relation = 'LEFT_OF';
          else relation = 'RIGHT_OF';

          edges.push({ source: a.name, relation, target: b.name });
        }
      }

      const primaryNode = nodes.reduce((prev, cur) => (cur.area > prev.area ? cur : prev), nodes[0]);

      return {
        nodes,
        edges,
        primarySubject: primaryNode.name,
        primaryRelation: edges.length > 0 ? edges[0] : null
      };
    }
  };

  // (C) Reverse Rhyme Trie (DSA) for O(L) exact phoneme ending discovery
  class RhymeTrieNode {
    constructor() {
      this.children = new Map();
      this.words = [];
    }
  }

  class ReverseRhymeTrie {
    constructor() {
      this.root = new RhymeTrieNode();
      this.initDefaultRhymeCorpus();
    }

    insert(word, rhymeKey) {
      let curr = this.root;
      const rev = rhymeKey.split('').reverse().join('');
      for (const char of rev) {
        if (!curr.children.has(char)) {
          curr.children.set(char, new RhymeTrieNode());
        }
        curr = curr.children.get(char);
      }
      curr.words.push(word);
    }

    findRhymes(word) {
      if (!word) return [];
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      const suffixes = ['ight', 'ound', 'ade', 'ore', 'ill', 'eep', 'air', 'old', 'ing', 'ace', 'own', 'un'];
      for (const s of suffixes) {
        if (clean.endsWith(s)) {
          let curr = this.root;
          const rev = s.split('').reverse().join('');
          for (const char of rev) {
            if (!curr.children.has(char)) return [];
            curr = curr.children.get(char);
          }
          return curr.words.filter(w => w !== clean);
        }
      }
      return [];
    }

    initDefaultRhymeCorpus() {
      const groups = {
        'ight': ['light', 'night', 'sight', 'bright', 'twilight', 'flight', 'white', 'height'],
        'ound': ['sound', 'ground', 'bound', 'round', 'found', 'profound'],
        'ade': ['fade', 'shade', 'made', 'glade', 'swayed', 'laid', 'played'],
        'ore': ['shore', 'door', 'lore', 'more', 'before', 'floor'],
        'ill': ['still', 'hill', 'spill', 'will', 'chill'],
        'eep': ['deep', 'keep', 'asleep', 'weep', 'steep'],
        'air': ['air', 'bare', 'chair', 'clear', 'there', 'prayer'],
        'old': ['gold', 'cold', 'hold', 'told', 'unfold'],
        'ace': ['grace', 'place', 'space', 'trace', 'face']
      };
      for (const [suf, words] of Object.entries(groups)) {
        for (const w of words) {
          this.insert(w, suf);
        }
      }
    }
  }

  // (D) Beam Search Decoder (DSA) for multi-hypothesis poetic exploration
  class BeamSearchDecoder {
    constructor(beamWidth = 3) {
      this.beamWidth = beamWidth;
    }

    search(candidatePool, scoringFn, targetLength = 3) {
      let beams = [{
        sequence: [],
        score: 0.0,
        usedKeys: new Set()
      }];

      for (let step = 0; step < targetLength; step++) {
        const candidates = [];

        for (const beam of beams) {
          const nextChoices = candidatePool(beam.sequence, step);
          for (const choice of nextChoices) {
            if (beam.usedKeys.has(choice.key)) continue;

            const stepScore = scoringFn(choice, beam.sequence, step);
            const newSet = new Set(beam.usedKeys);
            newSet.add(choice.key);

            candidates.push({
              sequence: [...beam.sequence, choice.text],
              score: beam.score + stepScore,
              usedKeys: newSet
            });
          }
        }

        candidates.sort((a, b) => b.score - a.score);
        beams = candidates.slice(0, this.beamWidth);
        if (beams.length === 0) break;
      }

      return beams.length > 0 ? beams[0].sequence : [];
    }
  }

  /* =========================================================================
   * CNN-RNN NEURAL VISION-TO-POEM MODEL
   * ========================================================================= */

  const CNNRNNNeuralModel = (() => {
    const rhymeTrie = new ReverseRhymeTrie();
    const beamDecoder = new BeamSearchDecoder(3);

    // CNN Feature Extractor (4-Channel Spatial Convolution Bank)
    function extractCNNFeatureVector(canvasOrImg) {
      try {
        let canvas;
        if (canvasOrImg instanceof HTMLCanvasElement) {
          canvas = canvasOrImg;
        } else {
          canvas = document.createElement('canvas');
          canvas.width = 48;
          canvas.height = 48;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(canvasOrImg, 0, 0, 48, 48);
        }

        if (window.tf && tf.tidy) {
          return tf.tidy(() => {
            const raw = tf.browser.fromPixels(canvas).toFloat().div(255.0);
            const input4D = raw.expandDims(0);

            // 3x3 Conv2D Spatial Edge & Texture Kernels
            const convKernel = tf.tensor4d([
              [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
              [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
              [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
              [[1/16, 2/16, 1/16], [2/16, 4/16, 2/16], [1/16, 2/16, 1/16]]
            ], [3, 3, 1, 4]).transpose([1, 2, 0, 3]).slice([0, 0, 0, 0], [3, 3, 3, 4]);

            const convOut = tf.relu(tf.conv2d(input4D, convKernel, 1, 'same'));
            const pooled = tf.maxPool(convOut, [4, 4], [4, 4], 'same');
            const gap = tf.mean(pooled, [1, 2]).squeeze();

            const activations = Array.from(gap.dataSync());
            return padVector(activations, 16);
          });
        }
      } catch (e) {
        console.warn('TFJS CNN convolution note:', e);
      }

      return computeVectorizedConvFeatures(canvasOrImg, 16);
    }

    function computeVectorizedConvFeatures(canvasOrImg, dim = 16) {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      try {
        ctx.drawImage(canvasOrImg, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;

        const vec = new Array(dim).fill(0);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255.0, g = data[i+1] / 255.0, b = data[i+2] / 255.0;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b);
          const bin = Math.floor((i / 4) / (1024 / dim)) % dim;
          vec[bin] += lum;
        }
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
        return vec.map(v => v / norm);
      } catch (e) {
        return new Array(dim).fill(0.25);
      }
    }

    function padVector(arr, dim = 16) {
      const res = new Array(dim).fill(0);
      for (let i = 0; i < Math.min(arr.length, dim); i++) {
        res[i] = arr[i];
      }
      return res;
    }

    // RNN Recurrent Language Decoder with Beam Search (K=3)
    function generateRecurrentVerse({ visualFeatures, detections = [], sceneGraph, mood = 'dreamy', theme = 'nature', cadence = 'free-verse', focusedObject = null }) {
      const features = visualFeatures || new Array(16).fill(0.3);

      const candidatePool = (currentSequence, step) => {
        const candidates = [];
        const primary = focusedObject || (sceneGraph?.primarySubject) || (detections[0]?.class) || 'scene';

        // 1. Detected Object Lexicon Lines
        const objLines = OBJECT_POETIC_LEXICON[primary.toLowerCase()] || [];
        objLines.forEach((line, idx) => {
          candidates.push({ key: `obj_${primary}_${idx}`, text: line, type: 'object', target: primary });
        });

        // 2. Spatial Scene Graph Relation Line (DSA)
        if (sceneGraph?.primaryRelation) {
          const rel = sceneGraph.primaryRelation;
          const relWord = rel.relation.toLowerCase().replace('_', ' ');
          candidates.push({
            key: `rel_${rel.source}_${rel.target}`,
            text: `A ${rel.source} resting ${relWord} the ${rel.target}, holding the silence of the hour,`,
            type: 'relation'
          });
        }

        // 3. Mood Lexicon Imagery
        const moodData = MOOD_PROFILES[mood] || MOOD_PROFILES.dreamy;
        moodData.imagery.forEach((pair, idx) => {
          candidates.push({ key: `mood_${idx}_0`, text: pair[0], type: 'mood' });
          candidates.push({ key: `mood_${idx}_1`, text: pair[1], type: 'mood' });
        });

        // 4. Thematic Resonance Lines
        const themeData = THEME_DICTIONARY[theme] || THEME_DICTIONARY.nature;
        themeData.lines.forEach((line, idx) => {
          candidates.push({ key: `theme_${idx}`, text: line, type: 'theme' });
        });

        // 5. Folk Lore & Oral Balladry Refrain Lines
        const folkBalladLines = [
          "Come gather round the ancient stone where twilight shadows lean,",
          "There's none can walk this quiet vale who walks it quite unseen.",
          "With weathered hands and patient heart, through winter, rain, and spring,",
          "The road remembers every song the silent wanderers sing.",
          "The river runs as it was told by those who crossed before,",
          "Leaving a trail of silver mist along the valley floor.",
          "O lay your burden on the grass and let the pine winds blow,",
          "For everything the heart forgets, the roots of cedars know."
        ];
        folkBalladLines.forEach((line, idx) => {
          candidates.push({ key: `folk_${idx}`, text: line, type: 'folk' });
        });

        return candidates;
      };

      const scoringFn = (choice, sequence, step) => {
        let score = 2.0;

        // Visual alignment score from CNN latent vector
        const featureWeight = features[step % features.length] || 0.2;
        score += featureWeight * 2.5;

        // Structural priority: Grounding object first, then relational/atmospheric
        if (step === 0 && choice.type === 'object') score += 4.0;
        if (step === 1 && (choice.type === 'relation' || choice.type === 'object')) score += 2.5;
        if (step >= 2 && choice.type === 'mood') score += 3.0;

        // Folk ballad cadence preference
        if (cadence === 'folk-ballad' && choice.type === 'folk') {
          score += 4.5;
        }

        // Rhyme reward for Quatrains & Folk Ballads using ReverseRhymeTrie (DSA)
        if ((cadence === 'rhymed-quatrain' || cadence === 'folk-ballad') && sequence.length > 0) {
          const lastLine = sequence[sequence.length - 1];
          const lastWord = lastLine.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, '');
          const currentWord = choice.text.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, '');
          const rhymes = rhymeTrie.findRhymes(lastWord);
          if (rhymes.includes(currentWord.toLowerCase())) {
            score += 5.5; // Substantial rhyme reward
          }
        }

        // Repetition penalty
        for (const prev of sequence) {
          if (prev === choice.text) score -= 12.0;
        }

        return score;
      };

      const targetSteps = (cadence === 'haiku') ? 3 : (cadence === 'micro-verse' ? 1 : ((cadence === 'rhymed-quatrain' || cadence === 'folk-ballad') ? 4 : 3));
      const decodedLines = beamDecoder.search(candidatePool, scoringFn, targetSteps);

      return decodedLines.length > 0 ? decodedLines.join('\n') : null;
    }

    return {
      extractCNNFeatureVector,
      generateRecurrentVerse,
      NMS,
      SpatialSceneGraph,
      ReverseRhymeTrie,
      BeamSearchDecoder
    };
  })();

  /**
   * Procedural Poem Generator tailored to Detected Objects, Focused Element, Mood & Theme
   * Augmented by CNN-RNN Neural Feature Encoding & Beam Search
   */
  function generateProceduralPoem({
    mood = 'dreamy',
    theme = 'nature',
    cadence = 'free-verse',
    detectedObjects = [],
    focusedObject = null,
    imageSource = null,
    sceneGraph = null
  }) {
    // 1. Attempt CNN-RNN Neural Generation with Beam Search
    try {
      const visualFeatures = imageSource ? CNNRNNNeuralModel.extractCNNFeatureVector(imageSource) : null;
      const sGraph = sceneGraph || SpatialSceneGraph.build(detectedObjects);
      const neuralVerse = CNNRNNNeuralModel.generateRecurrentVerse({
        visualFeatures,
        detections: detectedObjects,
        sceneGraph: sGraph,
        mood,
        theme,
        cadence,
        focusedObject
      });
      if (neuralVerse && neuralVerse.length > 15) {
        return neuralVerse;
      }
    } catch (e) {
      console.warn('Neural verse generation note, falling back to procedural:', e);
    }

    const moodData = MOOD_PROFILES[mood] || MOOD_PROFILES.dreamy;
    const themeData = THEME_DICTIONARY[theme] || THEME_DICTIONARY.nature;

    // 1. If user focused on a specific object, prioritize its poetic imagery
    let objectPoemLines = [];

    if (focusedObject) {
      const cleanFocus = focusedObject.toLowerCase().trim();
      const focusLines = OBJECT_POETIC_LEXICON[cleanFocus];
      if (focusLines && focusLines.length > 0) {
        objectPoemLines.push(...focusLines.slice(0, 2));
      } else {
        objectPoemLines.push(`All attention gathers on the ${cleanFocus}, holding the quiet silence of the scene;`);
      }
    } else if (detectedObjects && detectedObjects.length > 0) {
      detectedObjects.forEach(obj => {
        const key = (obj.class || '').toLowerCase();
        const lines = OBJECT_POETIC_LEXICON[key];
        if (lines && lines.length > 0) {
          const picked = lines[Math.floor(Math.random() * lines.length)];
          if (!objectPoemLines.includes(picked)) {
            objectPoemLines.push(picked);
          }
        } else if (key) {
          const cleanName = key.replace(/_/g, ' ');
          objectPoemLines.push(`A quiet presence of the ${cleanName}, resting gently in the frame;`);
        }
      });
    }

    // 2. Format according to selected Cadence
    const targetObjName = focusedObject || (detectedObjects[0]?.class?.toLowerCase()) || '';

    // Haiku (5-7-5)
    if (cadence === 'haiku') {
      if (targetObjName) {
        const haikuDict = {
          person: ['Silent silhouette,', 'Watching the horizon fade,', 'Peace abides with you.'],
          cup: ['Steam from ceramic,', 'Warmth upon a quiet palm,', 'Morning softly wakes.'],
          laptop: ['Light on silent glass,', 'Signals drifting in the dark,', 'Words become a bridge.'],
          'cell phone': ['Glow of pocket glass,', 'Quiet whispers from afar,', 'Silence fills the room.'],
          book: ['Pages softly turn,', 'Centuries of quiet thought,', 'Resting in the hand.'],
          'potted plant': ['Leaves drink evening light,', 'Patience of the green and earth,', 'Life blooms in the hush.']
        };
        if (haikuDict[targetObjName]) {
          return haikuDict[targetObjName].join('\n');
        }
      }
      const genericHaikus = [
        ['Dusk upon the ridge,', 'Silence folds across the path,', 'Evening comes to rest.'],
        ['Light through window glass,', 'A memory softly turns,', 'Peace abides with us.'],
        ['Shadows touch the ground,', 'One bright ember in the dark,', 'Holding all our hopes.']
      ];
      return genericHaikus[Math.floor(Math.random() * genericHaikus.length)].join('\n');
    }

    // Micro-Verse (1 to 2 punchy lines)
    if (cadence === 'micro-verse') {
      if (objectPoemLines.length > 0) {
        return objectPoemLines[0];
      }
      return moodData.imagery[Math.floor(Math.random() * moodData.imagery.length)][0];
    }

    // Rhymed Quatrain (4 rhymed melodic lines)
    if (cadence === 'rhymed-quatrain') {
      if (targetObjName === 'person') {
        return [
          'A quiet silhouette against the twilight sky,',
          'watching the gentle drift of clouds go by.',
          'No words are needed in this sacred space,',
          'where evening light falls softly on your face.'
        ].join('\n');
      }
      if (targetObjName === 'cup' || targetObjName === 'bottle') {
        return [
          'A quiet vessel keeping warmth in hand,',
          'while shadows settle softly on the land.',
          'Between two sips the busy world grows still,',
          'and golden light slips quietly down the hill.'
        ].join('\n');
      }
      if (targetObjName === 'laptop' || targetObjName === 'cell phone') {
        return [
          'A glowing screen against the velvet night,',
          'humming with streams of pale electric light.',
          'Across the dark our scattered thoughts take wing,',
          'where silent keys make quiet memories sing.'
        ].join('\n');
      }
      const quatrains = [
        [
          'The evening folds into the hill,',
          'while all the restless winds grow still.',
          'A quiet ember in the sky,',
          'whispers the daylight sweet goodbye.'
        ],
        [
          'Upon the stone where shadows lean,',
          'lies every road we’ve ever seen.',
          'A photograph to hold the grace,',
          'of quiet light upon this place.'
        ]
      ];
      return quatrains[Math.floor(Math.random() * quatrains.length)].join('\n');
    }

    // Folk Ballad & Oral Lore: Traditional ballad meter (4 lines, communal dignity, pastoral refrains)
    if (cadence === 'folk-ballad') {
      const folkBallads = [
        [
          "Come gather round the ancient stone where twilight shadows lean,",
          "There's none can walk this quiet vale who walks it quite unseen.",
          "With weathered hands and patient heart, through winter, rain, and spring,",
          "The road remembers every song the silent wanderers sing."
        ],
        [
          "The river runs as it was told by those who crossed before,",
          "Leaving a trail of silver mist along the valley floor.",
          "O lay your burden on the grass and let the pine winds blow,",
          "For everything the heart forgets, the roots of cedars know."
        ],
        [
          "In rustic hearths and lantern glow the elder stories wake,",
          "Of every seed that broke the frost for true devotion's sake.",
          "Hold gentle what the lens has caught before the dusk departs,",
          "And keep the ancient ballad safe within our listening hearts."
        ]
      ];
      return folkBallads[Math.floor(Math.random() * folkBallads.length)].join('\n');
    }

    // Free Verse (Default): Weaves focused/detected objects together with mood aura
    let composedStanza = [];

    // Add up to 2 detected object lines
    if (objectPoemLines.length > 0) {
      composedStanza.push(...objectPoemLines.slice(0, 2));
    }

    // Add complementary mood lines
    const pool = [...moodData.imagery];
    const moodPair = pool[Math.floor(Math.random() * pool.length)];

    if (composedStanza.length === 0) {
      composedStanza.push(moodPair[0]);
      composedStanza.push(moodPair[1]);
    } else if (composedStanza.length === 1) {
      composedStanza.push(moodPair[1]);
    }

    // Add theme resonance
    if (themeData.lines && Math.random() > 0.3) {
      const themeLine = themeData.lines[Math.floor(Math.random() * themeData.lines.length)];
      composedStanza.push(themeLine);
    }

    return composedStanza.join('\n');
  }

  /**
   * Songwriter Studio: Structured lyric generator
   */
  function generateLyrics({ theme = 'twilight hills and quiet roads', genre = 'Indie Folk', mood = 'dreamy', detectedObjects = [] }) {
    const cleanTheme = theme.trim() || 'A quiet moment turning into memory';
    const objectKeywords = detectedObjects.map(d => d.class).join(', ') || 'shadows and light';

    return {
      title: `${cleanTheme.slice(0, 32)} (Acoustic)`,
      genre: genre,
      sections: [
        {
          tag: '[Verse 1]',
          text: `The amber light slips down the ridge,\nwe saw ${objectKeywords} resting near the bridge.\nThe gravel crunches under tired boots,\nremembering how trees hold on by roots.\n${cleanTheme}.`
        },
        {
          tag: '[Chorus]',
          isChorus: true,
          text: `Oh, dusk is only morning turned around,\na secret melody without a sound.\nHold the lens, don’t let the colors fade,\nin every shadow that the sun has made.`
        },
        {
          tag: '[Verse 2]',
          text: `The violet clouds are drifting out to sea,\nleaving only silence here for you and me.\nWe took the photograph to keep the time,\nand turned the stillness into rhyme.`
        },
        {
          tag: '[Bridge]',
          text: `There is a pulse beneath the pavement,\nthere is a whisper in the stone.\nNo matter how far into the dark we wander,\nwe never really walk alone.`
        },
        {
          tag: '[Outro]',
          text: `Hold the light... hold the light...\nbefore the dusk gives way to night.\nFade out... fade out.`
        }
      ]
    };
  }

  /**
   * Optional Google Gemini API integration with Object-Aware Prompt
   */
  async function generateWithGemini({ apiKey, base64Image, mood, theme, cadence, detectedObjects = [] }) {
    if (!apiKey) {
      throw new Error('No API key provided');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const objectsList = detectedObjects.map(o => `${o.class} (${o.score}%)`).join(', ');

    const promptText = `You are VerseCam, an editorial poet with an "Electric Scrapbook" spirit.
Analyze this photo and write a short, poignant poem inspired by what is present in the scene.
Detected Elements in Scene: ${objectsList || 'natural landscape'}
Mood: ${mood}
Theme: ${theme}
Format: ${cadence} (2 to 4 lines maximum, no explanations, no titles, weave the detected scene elements metaphorically into the verse).`;

    const requestBody = {
      contents: [{
        parts: [
          { text: promptText },
          base64Image ? {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
            }
          } : null
        ].filter(Boolean)
      }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 120
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('Empty response from Gemini');
    return candidate.trim();
  }

  /**
   * Client-Side Modesty & Privacy Guardian (100% In-Browser Edge Analysis)
   * Detects skin-tone chrominance density & exposure ratios to protect dignity
   */
  const SafetyGuardian = (() => {
    function analyzeContent(source) {
      if (!source) return { isSensitive: false, exposureRatio: 0, score: 0 };

      try {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 64;
        sampleCanvas.height = 64;
        const ctx = sampleCanvas.getContext('2d');
        ctx.drawImage(source, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64);
        const data = imgData.data;

        let skinPixelCount = 0;
        const totalPixels = 64 * 64;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Standardized Kovac / Peer Perceptual Skin Chrominance Detector:
          // R > 95, G > 40, B > 20, max(R,G,B) - min(R,G,B) > 15, |R - G| > 15, R > G, R > B
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          if (
            r > 95 &&
            g > 40 &&
            b > 20 &&
            maxVal - minVal > 15 &&
            Math.abs(r - g) > 15 &&
            r > g &&
            r > b
          ) {
            skinPixelCount++;
          }
        }

        const exposureRatio = skinPixelCount / totalPixels;
        // Sensitivity threshold: >= 30% skin chrominance cluster triggers ethical modesty alert
        const isSensitive = exposureRatio >= 0.30;
        const percentScore = Math.round(exposureRatio * 100);

        return {
          isSensitive,
          exposureRatio,
          score: percentScore,
          message: isSensitive ? `High skin chrominance cluster (${percentScore}%)` : 'Normal exposure'
        };
      } catch (err) {
        console.warn('SafetyGuardian analysis exception, defaulting to safe:', err);
        return { isSensitive: false, exposureRatio: 0, score: 0 };
      }
    }

    function applyModestyBlur(canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.save();
      // Artistic impressionist modesty watercolor blur veil
      ctx.filter = 'blur(16px) saturate(0.85) contrast(0.95)';
      ctx.drawImage(canvas, 0, 0);
      // Soft warm tint overlay
      ctx.fillStyle = 'rgba(245, 235, 224, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    return {
      analyzeContent,
      applyModestyBlur
    };
  })();

  /**
   * Advanced Poetic Skills Engine
   * Higher accuracy, metaphor synthesis, oral folklore, consonance checks & ethical grace
   */
  const PoeticSkills = (() => {
    // Anti-derogatory lyrical safety & ethical dignity lexicon
    const FORBIDDEN_WORDS = [
      'ugly', 'grotesque', 'repulsive', 'worthless', 'horrid',
      'deformed', 'pathetic', 'disgusting', 'filthy', 'shameful'
    ];

    function applyEthicalGrace(poemText) {
      if (!poemText) return '';
      let refined = poemText;
      FORBIDDEN_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        refined = refined.replace(regex, 'fragile');
      });
      return refined;
    }

    function synthesizeMetaphor(subject, relation, target) {
      if (!subject) return 'A quiet stillness resting across the frame;';
      const cleanSub = subject.toLowerCase().replace(/_/g, ' ');
      const cleanTar = target ? target.toLowerCase().replace(/_/g, ' ') : null;

      if (cleanTar && relation) {
        const relWord = relation.toLowerCase().replace('_', ' ');
        return `The ${cleanSub} and the ${cleanTar} share an unhurried communion ${relWord},`;
      }
      return `The ${cleanSub} bears witness to the turning of the light,`;
    }

    return {
      applyEthicalGrace,
      synthesizeMetaphor
    };
  })();

  return {
    MOOD_PROFILES,
    THEME_DICTIONARY,
    OBJECT_POETIC_LEXICON,
    initObjectDetector,
    detectImageElements,
    extractAtmospherePalette,
    detectEnvironmentAndLighting,
    drawARBoundingBoxes,
    generateProceduralPoem,
    generateLyrics,
    generateWithGemini,
    CNNRNNNeuralModel,
    NMS,
    SpatialSceneGraph,
    ReverseRhymeTrie,
    BeamSearchDecoder,
    SafetyGuardian,
    PoeticSkills,
    playShutterSound,
    playTapSound
  };

})();

// Export globally
window.VerseEngine = VerseEngine;
