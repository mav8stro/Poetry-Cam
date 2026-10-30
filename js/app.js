/**
 * VerseCam — Main Application Orchestrator
 * Connects UI, Camera, Poetic Engine, Canvas Export, Library, and Modals.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Application State
  const state = {
    currentView: 'view-home',
    selectedMood: localStorage.getItem('versecam_pref_mood') || 'dreamy',
    selectedTheme: 'nature',
    selectedCadence: localStorage.getItem('versecam_pref_cadence') || 'free-verse',
    textSize: localStorage.getItem('versecam_pref_textsize') || 'standard',
    refreshMode: localStorage.getItem('versecam_pref_refresh') || 'manual',
    soundEnabled: localStorage.getItem('versecam_pref_sound') !== 'false',
    geminiApiKey: localStorage.getItem('versecam_gemini_key') || '',
    libraryFilter: 'all',
    arBoundingBoxesEnabled: true,

    // Current Active Moment
    currentMoment: {
      id: null,
      photoSrc: null,
      poemText: '',
      mood: 'dreamy',
      theme: 'nature',
      detectedObjects: [],
      atmospherePalette: [],
      environmentInfo: null,
      focusedObject: null,
      isFav: false,
      dateStr: ''
    },

    livePoemInterval: null,
    liveScannerInterval: null
  };

  // DOM Elements
  const views = {
    home: document.getElementById('view-home'),
    camera: document.getElementById('view-camera'),
    result: document.getElementById('view-result'),
    library: document.getElementById('view-library')
  };

  const navTabs = document.querySelectorAll('.nav-tab');
  const navCenterCamera = document.getElementById('nav-btn-center-camera');
  const globalFileInput = document.getElementById('global-file-input');
  const cameraVideoEl = document.getElementById('camera-stream');
  const cameraFallbackBox = document.getElementById('camera-fallback-canvas');
  const cameraFlashOverlay = document.getElementById('camera-flash-overlay');
  const liveVerseEl = document.getElementById('viewfinder-live-verse');
  const overlayMoodIndicator = document.getElementById('overlay-mood-indicator');
  const hudPromptBadge = document.getElementById('hud-prompt-badge');
  const hudVerseTime = document.getElementById('hud-verse-time');
  const btnBookmarkVerse = document.getElementById('btn-bookmark-verse');
  const appToast = document.getElementById('app-toast');
  const toastMessage = document.getElementById('toast-message');

  // Modals
  const modalSongwriter = document.getElementById('modal-songwriter');
  const modalSettings = document.getElementById('modal-settings');
  const modalEthicsPrivacy = document.getElementById('modal-ethics-privacy');
  const modalSafetyAlert = document.getElementById('modal-safety-alert');

  // Library Elements
  const libraryEmptyPanel = document.getElementById('library-empty-panel');
  const libraryGrid = document.getElementById('library-items-grid');
  const countAllEl = document.getElementById('count-all');
  const countPhotosEl = document.getElementById('count-photos');
  const countFavsEl = document.getElementById('count-favs');

  /* ================= 1. INITIALIZATION ================= */
  function initApp() {
    // Initialize Camera Controller
    CameraController.init(cameraVideoEl);

    // Initialize Library from localStorage
    LibraryStore.load();
    renderLibraryView();

    // Restore Mood, Theme & Preferences
    applyMood(state.selectedMood);
    applyCadence(state.selectedCadence);
    applyTextSize(state.textSize);

    if (state.geminiApiKey) {
      const keyInput = document.getElementById('gemini-api-key-input');
      if (keyInput) keyInput.value = state.geminiApiKey;
      updateApiKeyStatus(true);
    }

    const soundToggle = document.getElementById('toggle-sound-effects');
    if (soundToggle) soundToggle.checked = state.soundEnabled;

    setupThemeMode();
    setupNavigation();
    setupMoodListeners();
    setupCameraControls();
    setupResultActions();
    setupEthicsModals();
    setupSongwriterModal();
    setupSettingsModal();
    setupLibraryTabs();

    // Preload sample verse on camera viewfinder
    refreshLiveViewfinderVerse();
  }

  /* ================= 2. NAVIGATION ================= */
  function switchView(targetViewId) {
    if (!views[targetViewId.replace('view-', '')]) return;

    // Stop camera if navigating away from camera screen
    if (state.currentView === 'view-camera' && targetViewId !== 'view-camera') {
      CameraController.stopCamera();
      clearInterval(state.livePoemInterval);
      clearInterval(state.liveScannerInterval);
      const arCanvas = document.getElementById('viewfinder-ar-canvas');
      if (arCanvas) {
        const ctx = arCanvas.getContext('2d');
        ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
      }
    }

    // Toggle active class on views
    Object.values(views).forEach(v => v.classList.remove('active'));
    const targetEl = document.getElementById(targetViewId);
    if (targetEl) {
      targetEl.classList.add('active');
      targetEl.scrollTop = 0;
    }

    state.currentView = targetViewId;

    // Update bottom nav active state
    navTabs.forEach(tab => {
      const isTarget = tab.dataset.target === targetViewId;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    if (state.soundEnabled) VerseEngine.playTapSound();

    // Specific on-screen hooks
    if (targetViewId === 'view-camera') {
      startCameraViewfinder();
    } else if (targetViewId === 'view-library') {
      renderLibraryView();
    }
  }

  function setupNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        if (target) switchView(target);
      });
    });

    if (navCenterCamera) {
      navCenterCamera.addEventListener('click', () => {
        switchView('view-camera');
      });
    }

    // Header buttons
    const btnSongwriter = document.getElementById('btn-quick-songwriter');
    if (btnSongwriter) {
      btnSongwriter.addEventListener('click', openSongwriterModal);
    }

    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', openSettingsModal);
    }

    // Home shortcuts
    const homeCameraBtn = document.getElementById('btn-home-camera');
    if (homeCameraBtn) {
      homeCameraBtn.addEventListener('click', () => switchView('view-camera'));
    }

    const homeGalleryBtn = document.getElementById('btn-home-gallery');
    if (homeGalleryBtn) {
      homeGalleryBtn.addEventListener('click', () => globalFileInput.click());
    }

    const homeSongwriterCard = document.getElementById('home-songwriter-card');
    if (homeSongwriterCard) {
      homeSongwriterCard.addEventListener('click', openSongwriterModal);
    }

    // Global file input handling for gallery imports
    if (globalFileInput) {
      globalFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImportedImageFile(file);
      });
    }
  }

  /* ================= 3. MOOD SELECTION ================= */
  function applyMood(moodKey) {
    state.selectedMood = moodKey;
    localStorage.setItem('versecam_pref_mood', moodKey);

    const moodData = VerseEngine.MOOD_PROFILES[moodKey] || VerseEngine.MOOD_PROFILES.dreamy;

    // Update Chips UI
    document.querySelectorAll('.mood-chip').forEach(chip => {
      const isMatch = chip.dataset.mood === moodKey;
      chip.classList.toggle('active', isMatch);
      chip.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    // Update Feedback line
    const feedbackEl = document.getElementById('mood-feedback-text');
    if (feedbackEl) {
      feedbackEl.innerHTML = `<strong>${moodData.name}:</strong> ${moodData.feedback}`;
    }

    // Update live camera badge
    if (overlayMoodIndicator) {
      overlayMoodIndicator.textContent = `✦ ${moodData.name.toUpperCase()} CADENCE`;
    }
  }

  function setupMoodListeners() {
    const chips = document.querySelectorAll('.mood-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const mood = chip.dataset.mood;
        if (mood) {
          applyMood(mood);
          if (state.soundEnabled) VerseEngine.playTapSound();
          showToast(`Mood set to ${VerseEngine.MOOD_PROFILES[mood].name}`);
        }
      });
    });
  }

  /* ================= 4. CAMERA VIEWFINDER ================= */
  async function startCameraViewfinder() {
    try {
      cameraFallbackBox.classList.add('hidden');
      await CameraController.startCamera();
      cameraFallbackBox.classList.add('hidden');
    } catch (err) {
      console.warn('Camera stream could not start, displaying fallback frame', err);
      cameraFallbackBox.classList.remove('hidden');
    }

    refreshLiveViewfinderVerse();

    // Auto refresh interval if enabled in settings
    clearInterval(state.livePoemInterval);
    if (state.refreshMode === 'auto-10s') {
      state.livePoemInterval = setInterval(() => {
        refreshLiveViewfinderVerse();
      }, 10000);
    }

    // Live Object Scanner Loop
    clearInterval(state.liveScannerInterval);
    state.liveScannerInterval = setInterval(async () => {
      if (CameraController.isActive() && cameraVideoEl && cameraVideoEl.videoWidth > 0) {
        try {
          const detected = await VerseEngine.detectImageElements(cameraVideoEl);
          updateViewfinderScannerBadge(detected);
          const arCanvas = document.getElementById('viewfinder-ar-canvas');
          if (arCanvas) {
            if (state.arBoundingBoxesEnabled) {
              VerseEngine.drawARBoundingBoxes(arCanvas, detected, cameraVideoEl.videoWidth, cameraVideoEl.videoHeight);
            } else {
              const ctx = arCanvas.getContext('2d');
              ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
            }
          }
        } catch (e) {}
      }
    }, 1800);
  }

  function updateViewfinderScannerBadge(detected) {
    const labelEl = document.getElementById('viewfinder-object-label');
    if (!labelEl) return;
    if (detected && detected.length > 0) {
      const topNames = detected.slice(0, 2).map(d => `${d.class.toUpperCase()} (${d.score}%)`).join(' • ');
      labelEl.textContent = `CNN-RNN: ${topNames}`;
    } else {
      labelEl.textContent = 'CNN-RNN: SCANNING';
    }
  }

  function refreshLiveViewfinderVerse() {
    const verse = VerseEngine.generateProceduralPoem({
      mood: state.selectedMood,
      theme: state.selectedTheme,
      cadence: state.selectedCadence,
      detectedObjects: state.currentMoment?.detectedObjects || []
    });

    if (liveVerseEl) {
      liveVerseEl.style.opacity = '0';
      setTimeout(() => {
        liveVerseEl.innerHTML = verse.replace(/\n/g, '<br>');
        liveVerseEl.style.opacity = '1';
      }, 150);
    }

    if (hudVerseTime) {
      const now = new Date();
      hudVerseTime.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }

    if (btnBookmarkVerse) {
      btnBookmarkVerse.classList.remove('saved');
    }
  }

  function setupCameraControls() {
    // Back button from camera
    const btnBack = document.getElementById('btn-camera-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => switchView('view-home'));
    }

    // Switch camera (front/back)
    const btnSwitch = document.getElementById('btn-switch-camera');
    if (btnSwitch) {
      btnSwitch.addEventListener('click', async () => {
        try {
          if (state.soundEnabled) VerseEngine.playTapSound();
          await CameraController.switchCamera();
        } catch (e) {
          showToast('Could not flip camera');
        }
      });
    }

    // Toggle live AR bounding boxes
    const btnToggleAR = document.getElementById('btn-toggle-ar');
    if (btnToggleAR) {
      btnToggleAR.addEventListener('click', () => {
        state.arBoundingBoxesEnabled = !state.arBoundingBoxesEnabled;
        btnToggleAR.classList.toggle('active', state.arBoundingBoxesEnabled);
        btnToggleAR.setAttribute('aria-pressed', state.arBoundingBoxesEnabled ? 'true' : 'false');
        const arCanvas = document.getElementById('viewfinder-ar-canvas');
        if (!state.arBoundingBoxesEnabled && arCanvas) {
          const ctx = arCanvas.getContext('2d');
          ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
        }
        if (state.soundEnabled) VerseEngine.playTapSound();
        showToast(state.arBoundingBoxesEnabled ? 'AR Vision Overlays: ON' : 'AR Vision Overlays: OFF');
      });
    }

    // Refresh live verse
    const btnRefresh = document.getElementById('btn-refresh-live-verse');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        if (state.soundEnabled) VerseEngine.playTapSound();
        refreshLiveViewfinderVerse();
      });
    }

    // Bookmark verse only
    if (btnBookmarkVerse) {
      btnBookmarkVerse.addEventListener('click', async () => {
        const text = liveVerseEl.innerText;
        await LibraryStore.addItem({
          type: 'text',
          poem: text,
          mood: state.selectedMood,
          theme: state.selectedTheme,
          isFav: true
        });
        btnBookmarkVerse.classList.add('saved');
        if (state.soundEnabled) VerseEngine.playTapSound();
        showToast('Poem bookmarked to Library');
      });
    }

    // Primary Shutter Button
    const btnShutter = document.getElementById('btn-capture-shutter');
    if (btnShutter) {
      btnShutter.addEventListener('click', handleCaptureMoment);
    }

    // Secondary Camera Deck Actions
    const btnImport = document.getElementById('btn-camera-import');
    if (btnImport) {
      btnImport.addEventListener('click', () => globalFileInput.click());
    }

    const btnCameraLyrics = document.getElementById('btn-camera-to-songwriter');
    if (btnCameraLyrics) {
      btnCameraLyrics.addEventListener('click', openSongwriterModal);
    }

    // Fallback actions if camera denied
    const btnPerm = document.getElementById('btn-request-cam-perm');
    if (btnPerm) {
      btnPerm.addEventListener('click', startCameraViewfinder);
    }

    const btnFallbackUpload = document.getElementById('btn-camera-upload-fallback');
    if (btnFallbackUpload) {
      btnFallbackUpload.addEventListener('click', () => globalFileInput.click());
    }
  }

  /* ================= 4. SAFETY GUARDIAN & SENSITIVE FILTER ================= */
  function promptSafetyAlert(tempImg, originalPhoto, onProceed) {
    if (!VerseEngine.SafetyGuardian) {
      onProceed(originalPhoto);
      return;
    }

    const safetyCheck = VerseEngine.SafetyGuardian.analyzeContent(tempImg);
    if (!safetyCheck.isSensitive) {
      onProceed(originalPhoto);
      return;
    }

    const modalAlert = document.getElementById('modal-safety-alert');
    const scoreLabel = document.getElementById('safety-score-label');
    const btnBlur = document.getElementById('btn-safety-blur');
    const btnProceed = document.getElementById('btn-safety-proceed');
    const btnCancel = document.getElementById('btn-safety-cancel');

    if (!modalAlert || !btnBlur || !btnProceed || !btnCancel) {
      onProceed(originalPhoto);
      return;
    }

    if (scoreLabel) {
      scoreLabel.textContent = `Exposure Metric: ${safetyCheck.score}% Chrominance Density • In-Browser Edge Neural`;
    }

    modalAlert.classList.remove('hidden');

    function cleanup() {
      modalAlert.classList.add('hidden');
      btnBlur.removeEventListener('click', onBlur);
      btnProceed.removeEventListener('click', onConsent);
      btnCancel.removeEventListener('click', onCancel);
    }

    function onBlur() {
      cleanup();
      try {
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = tempImg.naturalWidth || tempImg.width || 640;
        blurCanvas.height = tempImg.naturalHeight || tempImg.height || 480;
        const bCtx = blurCanvas.getContext('2d');
        bCtx.drawImage(tempImg, 0, 0, blurCanvas.width, blurCanvas.height);
        VerseEngine.SafetyGuardian.applyModestyBlur(blurCanvas);
        const blurredDataUrl = blurCanvas.toDataURL('image/jpeg', 0.9);
        showToast('Applied Artistic Modesty Veil');
        onProceed(blurredDataUrl);
      } catch (e) {
        onProceed(originalPhoto);
      }
    }

    function onConsent() {
      cleanup();
      showToast('Artistic Consent Confirmed');
      onProceed(originalPhoto);
    }

    function onCancel() {
      cleanup();
      showToast('Snapshot discarded');
      switchView('view-camera');
    }

    btnBlur.addEventListener('click', onBlur);
    btnProceed.addEventListener('click', onConsent);
    btnCancel.addEventListener('click', onCancel);
  }

  async function handleCaptureMoment() {
    // Tactile sound & Flash
    if (state.soundEnabled) VerseEngine.playShutterSound();
    CameraController.triggerFlash(cameraFlashOverlay);

    // Haptic vibration on mobile
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }

    let photoData = CameraController.captureFrame();

    // If camera wasn't running or empty frame, fallback to dusk featured hero
    if (!photoData) {
      const duskImg = document.getElementById('home-featured-img');
      if (duskImg) {
        photoData = duskImg.src;
      }
    }

    showToast('Analyzing scene & extracting atmosphere...');

    // Run Object Detection, Atmosphere Palette & Environment Classification on captured photo
    let detectedObjects = [];
    let atmospherePalette = [];
    let environmentInfo = null;
    let tempImg = null;

    try {
      tempImg = new Image();
      tempImg.src = photoData;
      await new Promise(r => { tempImg.onload = r; tempImg.onerror = r; });
      detectedObjects = await VerseEngine.detectImageElements(tempImg);
      atmospherePalette = VerseEngine.extractAtmospherePalette(tempImg);
      environmentInfo = VerseEngine.detectEnvironmentAndLighting(tempImg);
    } catch (e) {
      console.warn('Analysis error on capture', e);
    }

    // Safety Modesty Guardian check
    promptSafetyAlert(tempImg, photoData, async (finalPhotoSrc) => {
      let poemText = '';
      if (state.geminiApiKey) {
        try {
          poemText = await VerseEngine.generateWithGemini({
            apiKey: state.geminiApiKey,
            base64Image: finalPhotoSrc,
            mood: state.selectedMood,
            theme: state.selectedTheme,
            cadence: state.selectedCadence,
            detectedObjects
          });
        } catch (geminiErr) {
          console.warn('Gemini error, fallback to procedural engine', geminiErr);
        }
      }

      if (!poemText) {
        poemText = VerseEngine.generateProceduralPoem({
          mood: state.selectedMood,
          theme: state.selectedTheme,
          cadence: state.selectedCadence,
          detectedObjects,
          imageSource: tempImg
        });
      }

      // Apply Ethical Grace filter
      if (VerseEngine.PoeticSkills) {
        poemText = VerseEngine.PoeticSkills.applyEthicalGrace(poemText);
      }

      displayResultMoment({
        photoSrc: finalPhotoSrc,
        poemText: poemText,
        mood: state.selectedMood,
        theme: state.selectedTheme,
        detectedObjects,
        atmospherePalette,
        environmentInfo,
        focusedObject: null,
        isFav: false
      });
    });
  }

  async function handleImportedImageFile(file) {
    showToast('Importing photo & analyzing scene elements...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      // Run Object Detection, Atmosphere Palette & Environment Classification on imported photo
      let detectedObjects = [];
      let atmospherePalette = [];
      let environmentInfo = null;
      let tempImg = null;

      try {
        tempImg = new Image();
        tempImg.src = dataUrl;
        await new Promise(r => { tempImg.onload = r; tempImg.onerror = r; });
        detectedObjects = await VerseEngine.detectImageElements(tempImg);
        atmospherePalette = VerseEngine.extractAtmospherePalette(tempImg);
        environmentInfo = VerseEngine.detectEnvironmentAndLighting(tempImg);
      } catch (err) {
        console.warn('Scene analysis error on imported file', err);
      }

      // Safety Modesty Guardian check
      promptSafetyAlert(tempImg, dataUrl, async (finalPhotoSrc) => {
        let poemText = '';
        if (state.geminiApiKey) {
          try {
            poemText = await VerseEngine.generateWithGemini({
              apiKey: state.geminiApiKey,
              base64Image: finalPhotoSrc,
              mood: state.selectedMood,
              theme: state.selectedTheme,
              cadence: state.selectedCadence,
              detectedObjects
            });
          } catch (geminiErr) {}
        }

        if (!poemText) {
          poemText = VerseEngine.generateProceduralPoem({
            mood: state.selectedMood,
            theme: state.selectedTheme,
            cadence: state.selectedCadence,
            detectedObjects,
            imageSource: tempImg
          });
        }

        // Apply Ethical Grace filter
        if (VerseEngine.PoeticSkills) {
          poemText = VerseEngine.PoeticSkills.applyEthicalGrace(poemText);
        }

        displayResultMoment({
          photoSrc: finalPhotoSrc,
          poemText: poemText,
          mood: state.selectedMood,
          theme: state.selectedTheme,
          detectedObjects,
          atmospherePalette,
          environmentInfo,
          focusedObject: null,
          isFav: false
        });
      });
    };
    reader.readAsDataURL(file);
  }

  /* ================= 5. RESULT SCREEN ================= */
  function displayResultMoment({
    photoSrc,
    poemText,
    mood,
    theme,
    detectedObjects = [],
    atmospherePalette = [],
    environmentInfo = null,
    focusedObject = null,
    isFav = false
  }) {
    state.currentMoment = {
      id: 'moment_' + Date.now(),
      photoSrc,
      poemText,
      mood,
      theme,
      detectedObjects,
      atmospherePalette,
      environmentInfo,
      focusedObject,
      isFav,
      dateStr: LibraryStore.formatCurrentDate()
    };

    const photoDisplay = document.getElementById('result-photo-display');
    const poemDisplay = document.getElementById('result-poem-text');
    const moodPill = document.getElementById('result-mood-pill');
    const promptPill = document.getElementById('result-prompt-pill');
    const envPill = document.getElementById('result-environment-pill');
    const dateStamp = document.getElementById('result-date-stamp');
    const btnFav = document.getElementById('btn-result-favourite');
    const cadenceLabel = document.getElementById('result-cadence-label');
    const chipsContainer = document.getElementById('result-detected-chips');
    const swatchesContainer = document.getElementById('result-palette-swatches');

    if (photoDisplay) photoDisplay.src = photoSrc;
    if (poemDisplay) poemDisplay.innerHTML = poemText.replace(/\n/g, '<br>');
    if (moodPill) moodPill.textContent = `✦ ${mood.toUpperCase()}`;
    if (promptPill) promptPill.textContent = theme.toUpperCase();
    if (dateStamp) dateStamp.textContent = state.currentMoment.dateStr;
    if (btnFav) btnFav.classList.toggle('is-fav', isFav);

    // Environment and lighting condition pill
    if (envPill) {
      if (environmentInfo) {
        const settingName = environmentInfo.environment || environmentInfo.setting || 'NATURAL SCENE';
        const lightingName = environmentInfo.lighting || 'DAYLIGHT';
        envPill.textContent = `✦ ${settingName.toUpperCase()} • ${lightingName.toUpperCase()}`;
        envPill.style.display = 'inline-flex';
      } else {
        envPill.style.display = 'none';
      }
    }

    const modelPill = document.getElementById('result-model-pill');
    if (modelPill) {
      modelPill.textContent = '✦ CNN-RNN // BEAM-3';
    }

    if (cadenceLabel) {
      const focusText = state.currentMoment.focusedObject
        ? ` • Focused on ${state.currentMoment.focusedObject.toUpperCase()}`
        : ' • Scene Resonance';
      cadenceLabel.textContent = `${formatCadenceTitle(state.selectedCadence)}${focusText}`;
    }

    // Atmosphere Color Palette Swatches
    if (swatchesContainer) {
      if (atmospherePalette && atmospherePalette.length > 0) {
        swatchesContainer.innerHTML = atmospherePalette.map(c => `
          <span class="color-swatch-badge" title="${c.poeticName} (${c.hex})">
            <span class="color-dot" style="background:${c.hex};"></span>
            <span>${c.poeticName}</span>
          </span>
        `).join('');
      } else {
        swatchesContainer.innerHTML = '';
      }
    }

    // Detected Elements Chips with Interactive Tap-to-Focus
    if (chipsContainer) {
      if (detectedObjects && detectedObjects.length > 0) {
        chipsContainer.innerHTML = detectedObjects.map(d => {
          const isFocused = state.currentMoment.focusedObject === d.class;
          return `
            <button class="element-chip ${isFocused ? 'focused' : ''}" data-class="${d.class}" type="button" aria-pressed="${isFocused}">
              <span class="chip-star">✦</span>
              <span>${d.class}</span>
              <span class="chip-score">${d.score}%</span>
            </button>
          `;
        }).join('');

        // Attach click listeners to chips for focusing
        chipsContainer.querySelectorAll('.element-chip').forEach(chipBtn => {
          chipBtn.addEventListener('click', () => {
            const targetClass = chipBtn.dataset.class;
            const wasFocused = chipBtn.classList.contains('focused');

            // Unfocus all chips first
            chipsContainer.querySelectorAll('.element-chip').forEach(c => {
              c.classList.remove('focused');
              c.setAttribute('aria-pressed', 'false');
            });

            if (!wasFocused) {
              chipBtn.classList.add('focused');
              chipBtn.setAttribute('aria-pressed', 'true');
              state.currentMoment.focusedObject = targetClass;
              showToast(`Poem re-focused on ${targetClass.toUpperCase()}`);
            } else {
              state.currentMoment.focusedObject = null;
              showToast('Poem balanced across entire scene');
            }

            if (state.soundEnabled) VerseEngine.playTapSound();

            // Re-generate poem with focusedObject via CNN-RNN & Beam Search
            const photoEl = document.getElementById('result-photo-display');
            const focusedPoem = VerseEngine.generateProceduralPoem({
              mood: state.selectedMood,
              theme: state.selectedTheme,
              cadence: state.selectedCadence,
              detectedObjects: state.currentMoment.detectedObjects,
              focusedObject: state.currentMoment.focusedObject,
              imageSource: photoEl
            });

            state.currentMoment.poemText = focusedPoem;

            if (poemDisplay) {
              poemDisplay.style.opacity = '0';
              setTimeout(() => {
                poemDisplay.innerHTML = focusedPoem.replace(/\n/g, '<br>');
                poemDisplay.style.opacity = '1';
              }, 150);
            }

            if (cadenceLabel) {
              const focusText = state.currentMoment.focusedObject
                ? ` • Focused on ${state.currentMoment.focusedObject.toUpperCase()}`
                : ' • Scene Resonance';
              cadenceLabel.textContent = `${formatCadenceTitle(state.selectedCadence)}${focusText}`;
            }
          });
        });
      } else {
        chipsContainer.innerHTML = '<span class="element-chip"><span class="chip-star">✦</span> Ambient Scene Elements</span>';
      }
    }

    switchView('view-result');
  }

  function setupResultActions() {
    // Back to Camera
    const btnBack = document.getElementById('btn-result-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => switchView('view-camera'));
    }

    // Toggle Favourite
    const btnFav = document.getElementById('btn-result-favourite');
    if (btnFav) {
      btnFav.addEventListener('click', async () => {
        state.currentMoment.isFav = !state.currentMoment.isFav;
        btnFav.classList.toggle('is-fav', state.currentMoment.isFav);
        
        // Save to library
        await LibraryStore.addItem({
          type: 'photo',
          photo: state.currentMoment.photoSrc,
          poem: state.currentMoment.poemText,
          mood: state.currentMoment.mood,
          theme: state.currentMoment.theme,
          detectedObjects: state.currentMoment.detectedObjects,
          atmospherePalette: state.currentMoment.atmospherePalette,
          environmentInfo: state.currentMoment.environmentInfo,
          isFav: state.currentMoment.isFav
        });

        if (state.soundEnabled) VerseEngine.playTapSound();
        showToast(state.currentMoment.isFav ? 'Added to Favourites & Library' : 'Removed from Favourites');
      });
    }

    // Export PNG Image Card
    const btnExport = document.getElementById('btn-export-image');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        try {
          if (state.soundEnabled) VerseEngine.playTapSound();
          showToast('Rendering snapshot card...');
          const renderCanvas = document.getElementById('export-render-canvas');
          await CanvasExporter.downloadSnapshot({
            photoSrc: state.currentMoment.photoSrc,
            poemText: state.currentMoment.poemText,
            mood: state.currentMoment.mood,
            theme: state.currentMoment.theme,
            dateStr: state.currentMoment.dateStr,
            detectedObjects: state.currentMoment.detectedObjects,
            atmospherePalette: state.currentMoment.atmospherePalette,
            environmentInfo: state.currentMoment.environmentInfo,
            canvasEl: renderCanvas
          });
          showToast('Snapshot downloaded as PNG');
        } catch (e) {
          console.error(e);
          showToast('Failed to export image');
        }
      });
    }

    // Native Web Share
    const btnShare = document.getElementById('btn-share-verse');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        try {
          if (state.soundEnabled) VerseEngine.playTapSound();
          const renderCanvas = document.getElementById('export-render-canvas');
          const res = await CanvasExporter.shareSnapshot({
            photoSrc: state.currentMoment.photoSrc,
            poemText: state.currentMoment.poemText,
            mood: state.currentMoment.mood,
            theme: state.currentMoment.theme,
            dateStr: state.currentMoment.dateStr,
            detectedObjects: state.currentMoment.detectedObjects,
            atmospherePalette: state.currentMoment.atmospherePalette,
            environmentInfo: state.currentMoment.environmentInfo,
            canvasEl: renderCanvas
          });
          if (res === 'shared-file' || res === 'shared-text') {
            showToast('Moment shared successfully');
          } else if (res === 'downloaded') {
            showToast('Snapshot downloaded');
          }
        } catch (e) {
          navigator.clipboard.writeText(state.currentMoment.poemText);
          showToast('Poem copied to clipboard');
        }
      });
    }

    // Copy Verse text
    const btnCopy = document.getElementById('btn-copy-poem');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(state.currentMoment.poemText);
        if (state.soundEnabled) VerseEngine.playTapSound();
        showToast('Poem text copied to clipboard');
      });
    }

    // Remix / Re-roll poem (with detected objects and focused object)
    const btnReroll = document.getElementById('btn-reroll-poem');
    if (btnReroll) {
      btnReroll.addEventListener('click', () => {
        if (state.soundEnabled) VerseEngine.playTapSound();
        const photoEl = document.getElementById('result-photo-display');
        const newPoem = VerseEngine.generateProceduralPoem({
          mood: state.selectedMood,
          theme: state.selectedTheme,
          cadence: state.selectedCadence,
          detectedObjects: state.currentMoment.detectedObjects,
          focusedObject: state.currentMoment.focusedObject,
          imageSource: photoEl
        });
        state.currentMoment.poemText = newPoem;
        const poemDisplay = document.getElementById('result-poem-text');
        if (poemDisplay) {
          poemDisplay.style.opacity = '0';
          setTimeout(() => {
            poemDisplay.innerHTML = newPoem.replace(/\n/g, '<br>');
            poemDisplay.style.opacity = '1';
          }, 150);
        }
        showToast('Poem remixed with detected objects');
      });
    }

    // Convert to Songwriter
    const btnToSongwriter = document.getElementById('btn-convert-lyrics');
    if (btnToSongwriter) {
      btnToSongwriter.addEventListener('click', () => {
        openSongwriterModal(state.currentMoment.poemText.split('\n')[0]);
      });
    }
  }

  /* ================= 6. LIBRARY SCREEN ================= */
  function renderLibraryView() {
    const items = LibraryStore.getItems(state.libraryFilter);
    const counts = LibraryStore.getCounts();

    if (countAllEl) countAllEl.textContent = counts.all;
    if (countPhotosEl) countPhotosEl.textContent = counts.photos;
    if (countFavsEl) countFavsEl.textContent = counts.favs;

    if (items.length === 0) {
      libraryEmptyPanel.classList.remove('hidden');
      libraryGrid.classList.add('hidden');
      libraryGrid.innerHTML = '';
      return;
    }

    libraryEmptyPanel.classList.add('hidden');
    libraryGrid.classList.remove('hidden');
    libraryGrid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      
      if (item.type === 'photo' && item.photo) {
        const objectBadge = (item.detectedObjects && item.detectedObjects.length > 0)
          ? `<span class="lib-badge" style="color:var(--coral-primary);border-color:var(--coral-primary)">✦ ${item.detectedObjects[0].class.toUpperCase()}</span>`
          : '';

        card.className = 'library-card-photo';
        card.innerHTML = `
          <img src="${item.photo}" alt="Scrapbook snapshot" class="lib-photo-thumb">
          <div class="lib-card-details">
            <div class="lib-meta-tags">
              <span class="lib-badge lime">✦ ${item.mood.toUpperCase()}</span>
              <span class="lib-badge">${item.theme.toUpperCase()}</span>
              ${objectBadge}
            </div>
            <div class="lib-poem-excerpt">“${item.poem.replace(/\n/g, ' ')}”</div>
            <div class="lib-card-footer">
              <span class="lib-date-text">${item.formattedDate || 'OCT 30'}</span>
              <div class="lib-actions-row">
                <button class="lib-icon-btn btn-lib-fav ${item.isFav ? 'active-fav' : ''}" data-id="${item.id}" title="Toggle Favourite">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="${item.isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
                <button class="lib-icon-btn btn-lib-view" data-id="${item.id}" title="Open Moment">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
                <button class="lib-icon-btn btn-lib-del" data-id="${item.id}" title="Delete Item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        card.className = 'library-card-text';
        card.innerHTML = `
          <div class="lib-meta-tags">
            <span class="lib-badge lime">✦ ${item.mood.toUpperCase()}</span>
            <span class="lib-badge">POEM NOTE</span>
          </div>
          <div class="lib-poem-excerpt" style="font-size:1.05rem;">${item.poem.replace(/\n/g, '<br>')}</div>
          <div class="lib-card-footer">
            <span class="lib-date-text">${item.formattedDate || 'OCT 30'}</span>
            <div class="lib-actions-row">
              <button class="lib-icon-btn btn-lib-fav ${item.isFav ? 'active-fav' : ''}" data-id="${item.id}" title="Toggle Favourite">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${item.isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button class="lib-icon-btn btn-lib-copy" data-id="${item.id}" title="Copy Poem">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="lib-icon-btn btn-lib-del" data-id="${item.id}" title="Delete Item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      }

      // Bind events
      const btnFav = card.querySelector('.btn-lib-fav');
      if (btnFav) {
        btnFav.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowFav = LibraryStore.toggleFavourite(item.id);
          renderLibraryView();
          showToast(isNowFav ? 'Saved to Favourites' : 'Removed from Favourites');
        });
      }

      const btnDel = card.querySelector('.btn-lib-del');
      if (btnDel) {
        btnDel.addEventListener('click', (e) => {
          e.stopPropagation();
          LibraryStore.removeItem(item.id);
          renderLibraryView();
          showToast('Item deleted from Library');
        });
      }

      const btnView = card.querySelector('.btn-lib-view');
      if (btnView && item.type === 'photo') {
        btnView.addEventListener('click', () => {
          displayResultMoment({
            photoSrc: item.photo,
            poemText: item.poem,
            mood: item.mood,
            theme: item.theme,
            detectedObjects: item.detectedObjects || [],
            atmospherePalette: item.atmospherePalette || [],
            environmentInfo: item.environmentInfo || null,
            focusedObject: null,
            isFav: item.isFav
          });
        });
      }

      const btnCopy = card.querySelector('.btn-lib-copy');
      if (btnCopy) {
        btnCopy.addEventListener('click', () => {
          navigator.clipboard.writeText(item.poem);
          showToast('Poem copied to clipboard');
        });
      }

      libraryGrid.appendChild(card);
    });
  }

  function setupLibraryTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.libraryFilter = tab.dataset.filter || 'all';
        if (state.soundEnabled) VerseEngine.playTapSound();
        renderLibraryView();
      });
    });

    const btnClear = document.getElementById('btn-clear-library');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Clear all moments from your session library?')) {
          LibraryStore.clearAll();
          renderLibraryView();
          showToast('Library cleared');
        }
      });
    }

    const btnEmptyCam = document.getElementById('btn-empty-camera');
    if (btnEmptyCam) {
      btnEmptyCam.addEventListener('click', () => switchView('view-camera'));
    }

    const btnEmptyGal = document.getElementById('btn-empty-gallery');
    if (btnEmptyGal) {
      btnEmptyGal.addEventListener('click', () => globalFileInput.click());
    }
  }

  /* ================= 7. THEME MODE & ETHICS CHARTER MODALS ================= */
  function setupThemeMode() {
    const savedTheme = localStorage.getItem('versecam_theme');
    if (savedTheme === 'oled') {
      document.body.setAttribute('data-theme', 'oled');
    }

    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', () => {
        const isOled = document.body.getAttribute('data-theme') === 'oled';
        if (isOled) {
          document.body.removeAttribute('data-theme');
          localStorage.setItem('versecam_theme', 'plum');
          showToast('Theme: Electric Plum Scrapbook');
        } else {
          document.body.setAttribute('data-theme', 'oled');
          localStorage.setItem('versecam_theme', 'oled');
          showToast('Theme: True OLED Pitch Dark');
        }
        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    }
  }

  function setupEthicsModals() {
    const btnOpenEthics = document.getElementById('btn-open-ethics');
    const btnCloseEthics = document.getElementById('btn-close-ethics');

    if (btnOpenEthics) {
      btnOpenEthics.addEventListener('click', () => {
        if (modalEthicsPrivacy) modalEthicsPrivacy.classList.remove('hidden');
        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    }

    if (btnCloseEthics) {
      btnCloseEthics.addEventListener('click', () => {
        if (modalEthicsPrivacy) modalEthicsPrivacy.classList.add('hidden');
      });
    }

    if (modalEthicsPrivacy) {
      modalEthicsPrivacy.addEventListener('click', (e) => {
        if (e.target === modalEthicsPrivacy) modalEthicsPrivacy.classList.add('hidden');
      });
    }

    // Charter Navigation Tabs Switching
    const tabButtons = document.querySelectorAll('#ethics-tabs-nav .ethics-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetPaneId = btn.dataset.tab;
        document.querySelectorAll('.ethics-tab-pane').forEach(pane => {
          pane.classList.toggle('active', pane.id === targetPaneId);
        });

        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    });
  }

  /* ================= 8. SONGWRITER MODAL ================= */
  function openSongwriterModal(initialTheme = null) {
    if (initialTheme && typeof initialTheme === 'string') {
      const themeInput = document.getElementById('song-theme-input');
      if (themeInput) themeInput.value = initialTheme.trim();
    }
    modalSongwriter.classList.remove('hidden');
    if (state.soundEnabled) VerseEngine.playTapSound();
  }

  function closeSongwriterModal() {
    modalSongwriter.classList.add('hidden');
  }

  function setupSongwriterModal() {
    const btnClose = document.getElementById('btn-close-songwriter');
    if (btnClose) btnClose.addEventListener('click', closeSongwriterModal);

    modalSongwriter.addEventListener('click', (e) => {
      if (e.target === modalSongwriter) closeSongwriterModal();
    });

    // Genre pills
    const genrePills = document.querySelectorAll('.genre-pill');
    let currentGenre = 'Indie Folk';
    genrePills.forEach(pill => {
      pill.addEventListener('click', () => {
        genrePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentGenre = pill.dataset.genre;
        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    });

    // Generate Lyrics action
    const btnGenerate = document.getElementById('btn-generate-lyrics');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => {
        const themeInput = document.getElementById('song-theme-input');
        const themeText = themeInput ? themeInput.value : '';
        const lyrics = VerseEngine.generateLyrics({
          theme: themeText,
          genre: currentGenre,
          mood: state.selectedMood
        });

        const lyricsGenreTag = document.getElementById('lyrics-genre-tag');
        const lyricsDisplay = document.getElementById('lyrics-text-display');

        if (lyricsGenreTag) lyricsGenreTag.textContent = `${currentGenre.toUpperCase()} // 4/4 CADENCE`;

        if (lyricsDisplay) {
          lyricsDisplay.innerHTML = lyrics.sections.map(s => `
            <div class="lyric-section-block ${s.isChorus ? 'chorus-highlight' : ''}">
              <span class="lyric-section-tag">${s.tag}</span>
              <p>${s.text.replace(/\n/g, '<br>')}</p>
            </div>
          `).join('');
        }

        if (state.soundEnabled) VerseEngine.playTapSound();
        showToast('New song lyrics composed');
      });
    }

    // Copy lyrics button
    const btnCopyLyrics = document.getElementById('btn-copy-lyrics');
    if (btnCopyLyrics) {
      btnCopyLyrics.addEventListener('click', () => {
        const lyricsDisplay = document.getElementById('lyrics-text-display');
        if (lyricsDisplay) {
          navigator.clipboard.writeText(lyricsDisplay.innerText);
          showToast('Lyrics copied to clipboard');
        }
      });
    }

    // Save lyrics to library
    const btnSaveLyrics = document.getElementById('btn-save-lyrics-to-library');
    if (btnSaveLyrics) {
      btnSaveLyrics.addEventListener('click', async () => {
        const lyricsDisplay = document.getElementById('lyrics-text-display');
        if (lyricsDisplay) {
          await LibraryStore.addItem({
            type: 'text',
            poem: lyricsDisplay.innerText,
            mood: state.selectedMood,
            theme: state.selectedTheme,
            isFav: true
          });
          showToast('Lyrics saved to Library');
          closeSongwriterModal();
          switchView('view-library');
        }
      });
    }
  }

  /* ================= 9. SETTINGS MODAL ================= */
  function openSettingsModal() {
    modalSettings.classList.remove('hidden');
    if (state.soundEnabled) VerseEngine.playTapSound();
  }

  function closeSettingsModal() {
    modalSettings.classList.add('hidden');
  }

  function applyCadence(cadenceKey) {
    state.selectedCadence = cadenceKey;
    localStorage.setItem('versecam_pref_cadence', cadenceKey);
    document.querySelectorAll('#cadence-selector .setting-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cadence === cadenceKey);
    });
  }

  function applyTextSize(sizeKey) {
    state.textSize = sizeKey;
    localStorage.setItem('versecam_pref_textsize', sizeKey);
    document.querySelectorAll('#fontsize-selector .setting-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.size === sizeKey);
    });

    const poemEl = document.getElementById('result-poem-text');
    if (poemEl) {
      poemEl.classList.remove('size-compact', 'size-standard', 'size-dramatic');
      poemEl.classList.add(`size-${sizeKey}`);
    }
  }

  function formatCadenceTitle(cadenceKey) {
    const titles = {
      'free-verse': 'Free Verse',
      'rhymed-quatrain': 'Rhymed Quatrain',
      'folk-ballad': 'Folk Ballad & Lore',
      'haiku': 'Haiku (5-7-5)',
      'micro-verse': 'Micro-Verse'
    };
    return titles[cadenceKey] || 'Free Verse';
  }

  function updateApiKeyStatus(hasKey) {
    const statusEl = document.getElementById('api-key-status-text');
    if (statusEl) {
      statusEl.textContent = hasKey
        ? '✦ Active: Connected to Google Gemini Vision Engine'
        : 'Using: Built-in Evocative Vision & Cadence Engine';
    }
  }

  function setupSettingsModal() {
    const btnClose = document.getElementById('btn-close-settings');
    if (btnClose) btnClose.addEventListener('click', closeSettingsModal);

    modalSettings.addEventListener('click', (e) => {
      if (e.target === modalSettings) closeSettingsModal();
    });

    // Cadence Selector
    document.querySelectorAll('#cadence-selector .setting-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        applyCadence(pill.dataset.cadence);
        if (state.soundEnabled) VerseEngine.playTapSound();
        refreshLiveViewfinderVerse();
        showToast(`Cadence set to ${formatCadenceTitle(state.selectedCadence)}`);
      });
    });

    // Font Size Selector
    document.querySelectorAll('#fontsize-selector .setting-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        applyTextSize(pill.dataset.size);
        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    });

    // Refresh Mode Selector
    document.querySelectorAll('#refresh-mode-selector .setting-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#refresh-mode-selector .setting-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.refreshMode = pill.dataset.refresh;
        localStorage.setItem('versecam_pref_refresh', state.refreshMode);
        if (state.soundEnabled) VerseEngine.playTapSound();
      });
    });

    // Sound toggle
    const soundToggle = document.getElementById('toggle-sound-effects');
    if (soundToggle) {
      soundToggle.addEventListener('change', (e) => {
        state.soundEnabled = e.target.checked;
        localStorage.setItem('versecam_pref_sound', state.soundEnabled);
      });
    }

    // Gemini API Key Input
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) {
      keyInput.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        state.geminiApiKey = val;
        localStorage.setItem('versecam_gemini_key', val);
        updateApiKeyStatus(!!val);
        showToast(val ? 'Gemini API Key saved locally' : 'Using built-in engine');
      });
    }
  }

  /* ================= 10. TOAST NOTIFICATIONS ================= */
  let toastTimeout = null;
  function showToast(msg) {
    if (!appToast || !toastMessage) return;
    toastMessage.textContent = msg;
    appToast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      appToast.classList.add('hidden');
    }, 2400);
  }

  // Start the Application
  initApp();

});
