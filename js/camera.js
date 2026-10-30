/**
 * VerseCam — Camera Controller
 * Manages getUserMedia stream, camera flips, snapshot capture, flash effects, and fallbacks.
 */

const CameraController = (() => {
  let videoEl = null;
  let stream = null;
  let currentFacingMode = 'environment'; // default to back camera
  let hasMultipleCameras = false;
  let isCameraActive = false;

  function init(videoElement) {
    videoEl = videoElement;
    checkDeviceCameras();
  }

  async function checkDeviceCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      hasMultipleCameras = videoDevices.length > 1;
    } catch (e) {
      console.warn('Could not enumerate video devices', e);
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser.');
    }

    stopCamera();

    const constraints = {
      audio: false,
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }
      isCameraActive = true;
      return true;
    } catch (err) {
      console.warn('getUserMedia error with facingMode, retrying generic video...', err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play();
        }
        isCameraActive = true;
        return true;
      } catch (fallbackErr) {
        isCameraActive = false;
        throw fallbackErr;
      }
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    isCameraActive = false;
  }

  async function switchCamera() {
    const prevMode = currentFacingMode;
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    try {
      return await startCamera();
    } catch (err) {
      currentFacingMode = prevMode;
      await startCamera().catch(() => {});
      throw err;
    }
  }

  /**
   * Captures the current video frame to an Image / DataURL
   */
  function captureFrame() {
    if (!videoEl || !isCameraActive || videoEl.videoWidth === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');

    // If front-facing camera, flip horizontally for natural mirror feel
    if (currentFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /**
   * Trigger the viewfinder flash visual effect
   */
  function triggerFlash(flashElement) {
    if (!flashElement) return;
    flashElement.classList.remove('flash-active');
    void flashElement.offsetWidth; // Force reflow
    flashElement.classList.add('flash-active');
    setTimeout(() => {
      flashElement.classList.remove('flash-active');
    }, 250);
  }

  return {
    init,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
    triggerFlash,
    isActive: () => isCameraActive,
    hasMultipleCameras: () => hasMultipleCameras
  };
})();

window.CameraController = CameraController;
