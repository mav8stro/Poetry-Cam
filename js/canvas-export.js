/**
 * VerseCam — Canvas Snapshot Exporter
 * Generates editorial, high-resolution scrapbook snapshot cards (1080x1350)
 * suitable for Instagram, archiving, and social sharing.
 */

const CanvasExporter = (() => {

  /**
   * Helper to load an image source into an HTMLImageElement
   */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  /**
   * Safe Cross-Browser Rounded Rectangle helper
   */
  function drawRoundRect(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    const r = typeof radius === 'number' ? radius : (Array.isArray(radius) ? radius[0] : 8);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  /**
   * Helper to wrap text cleanly on canvas
   */
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = text.split('\n');
    let currentY = y;

    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line.trim(), x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), x, currentY);
      currentY += lineHeight * 1.15;
    }
    return currentY;
  }

  /**
   * Renders the complete scrapbook snapshot to a canvas
   */
  async function renderSnapshotCard({
    photoSrc,
    poemText,
    mood = 'Dreamy',
    theme = 'Nature',
    dateStr = 'OCT 30 • 2026',
    detectedObjects = [],
    atmospherePalette = [],
    environmentInfo = null,
    canvasEl
  }) {
    const canvas = canvasEl || document.createElement('canvas');
    const width = 1080;
    const height = 1350; // 4:5 Instagram Portrait Ratio
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Canvas Background (Dark Plum Canvas with subtle grain/gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#16081B');
    bgGrad.addColorStop(0.5, '#1E0A24');
    bgGrad.addColorStop(1, '#110416');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative subtle scrapbook border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // 2. Photo Section
    const photoMarginX = 64;
    const photoMarginY = 64;
    const photoW = width - (photoMarginX * 2);
    const photoH = 680;

    // Load photo
    if (photoSrc) {
      try {
        const img = await loadImage(photoSrc);
        
        // Draw photo container background & shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 12;

        ctx.fillStyle = '#000';
        ctx.fillRect(photoMarginX, photoMarginY, photoW, photoH);
        ctx.restore();

        // Calculate aspect fill
        const imgAspect = img.width / img.height;
        const targetAspect = photoW / photoH;
        let sWidth, sHeight, sx, sy;

        if (imgAspect > targetAspect) {
          sHeight = img.height;
          sWidth = img.height * targetAspect;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width / targetAspect;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.save();
        ctx.beginPath();
        drawRoundRect(ctx, photoMarginX, photoMarginY, photoW, photoH, 16);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sWidth, sHeight, photoMarginX, photoMarginY, photoW, photoH);
        ctx.restore();

      } catch (err) {
        console.warn('Could not draw photo to snapshot', err);
      }
    }

    // 3. Washi Tape Strip at top right corner of photo
    ctx.save();
    ctx.translate(width - 150, 48);
    ctx.rotate(4 * Math.PI / 180);
    ctx.fillStyle = 'rgba(255, 90, 95, 0.85)';
    ctx.fillRect(-60, -15, 120, 30);
    ctx.restore();

    // 4. Timestamp Pill on Photo
    ctx.save();
    ctx.fillStyle = 'rgba(18, 5, 23, 0.85)';
    ctx.beginPath();
    drawRoundRect(ctx, photoMarginX + 20, photoMarginY + photoH - 48, 180, 32, 6);
    ctx.fill();
    ctx.font = '600 14px "Space Mono", monospace';
    ctx.fillStyle = '#CCFF00'; // Acid Lime
    ctx.fillText(`✦ ${dateStr}`, photoMarginX + 32, photoMarginY + photoH - 27);
    ctx.restore();

    // 5. Editorial Content Area below Photo
    const textStartY = photoMarginY + photoH + 48;

    // Mood & Theme Badges
    ctx.save();
    // Mood Badge (Acid Lime pill)
    ctx.fillStyle = 'rgba(204, 255, 0, 0.15)';
    ctx.strokeStyle = '#CCFF00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawRoundRect(ctx, photoMarginX, textStartY, 130, 34, 17);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 13px "Space Mono", monospace';
    ctx.fillStyle = '#CCFF00';
    ctx.fillText(`✦ ${mood.toUpperCase()}`, photoMarginX + 16, textStartY + 22);

    // Theme Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    drawRoundRect(ctx, photoMarginX + 144, textStartY, 110, 34, 17);
    ctx.fill();
    ctx.font = '600 13px "Space Mono", monospace';
    ctx.fillStyle = '#D1C5B8';
    ctx.fillText(theme.toUpperCase(), photoMarginX + 160, textStartY + 22);

    // Detected Objects Pill
    let nextBadgeX = photoMarginX + 266;
    if (detectedObjects && detectedObjects.length > 0) {
      const objNames = detectedObjects.slice(0, 2).map(o => o.class.toUpperCase()).join(' • ');
      ctx.fillStyle = 'rgba(255, 90, 95, 0.15)';
      ctx.strokeStyle = '#FF5A5F';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, nextBadgeX, textStartY, 230, 34, 17);
      ctx.fill();
      ctx.stroke();
      ctx.font = '700 12px "Space Mono", monospace';
      ctx.fillStyle = '#FF5A5F';
      ctx.fillText(`✦ ${objNames}`, nextBadgeX + 14, textStartY + 22);
      nextBadgeX += 242;
    }

    // Atmosphere Color Palette Dots (Right Aligned on badge strip)
    if (atmospherePalette && atmospherePalette.length > 0) {
      const dotRadius = 9;
      const paletteRightEdge = width - photoMarginX;
      const paletteCount = Math.min(atmospherePalette.length, 4);
      const paletteStartX = paletteRightEdge - (paletteCount * 28);

      for (let i = 0; i < paletteCount; i++) {
        const swatch = atmospherePalette[i];
        const dotCenterX = paletteStartX + (i * 28) + dotRadius;
        const dotCenterY = textStartY + 17;
        
        ctx.beginPath();
        ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = swatch.hex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 6. Poem Text Typography (Editorial Serif)
    ctx.save();
    ctx.font = 'italic 500 36px "Fraunces", "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#FDFBF7';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    wrapText(ctx, poemText, photoMarginX, textStartY + 96, photoW, 54);
    ctx.restore();

    // 7. Footer Watermark & Branding
    const footerY = height - 70;

    // Dashed divider line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(photoMarginX, footerY - 24);
    ctx.lineTo(width - photoMarginX, footerY - 24);
    ctx.stroke();
    ctx.restore();

    // VerseCam Logo Stamp
    ctx.font = '700 24px "Fraunces", serif';
    ctx.fillStyle = '#FF5A5F'; // Coral
    ctx.fillText('✦ VerseCam', photoMarginX, footerY + 6);

    // Cadence / Sub-info
    ctx.font = '500 13px "Space Mono", monospace';
    ctx.fillStyle = '#957F9E';
    ctx.textAlign = 'right';
    ctx.fillText('ELECTRIC SCRAPBOOK // CNN-RNN VISION // BEAM-3', width - photoMarginX, footerY + 6);

    return canvas;
  }

  /**
   * Triggers download of the snapshot as PNG
   */
  async function downloadSnapshot(options) {
    const canvas = await renderSnapshotCard(options);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `VerseCam_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Share via Native Share API with file support or fallback
   */
  async function shareSnapshot(options) {
    const canvas = await renderSnapshotCard(options);

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Canvas blob failed'));
        const file = new File([blob], 'versecam-moment.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'VerseCam Moment',
              text: `${options.poemText}\n\n— Captured on VerseCam`,
              files: [file]
            });
            resolve('shared-file');
          } catch (e) {
            if (e.name !== 'AbortError') {
              reject(e);
            } else {
              resolve('cancelled');
            }
          }
        } else if (navigator.share) {
          try {
            await navigator.share({
              title: 'VerseCam Moment',
              text: `${options.poemText}\n\n— Captured on VerseCam`
            });
            resolve('shared-text');
          } catch (e) {
            reject(e);
          }
        } else {
          // Fallback to auto-download
          await downloadSnapshot(options);
          resolve('downloaded');
        }
      }, 'image/png');
    });
  }

  return {
    renderSnapshotCard,
    downloadSnapshot,
    shareSnapshot
  };

})();

window.CanvasExporter = CanvasExporter;
