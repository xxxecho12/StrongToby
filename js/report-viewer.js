/**
 * ReportViewer Module
 * Handles displaying individual reports: PDF, images, galleries, and video.
 * Also provides a reusable PDF modal viewer for other modules (e.g., blood work page).
 *
 * Usage:
 *   window.ReportViewer.render(reportId)    - Render a report into #content
 *   window.ReportViewer.showPdfModal(path, title) - Open a modal PDF viewer
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Look up a report object by its id.
   */
  function getReport(id) {
    // Prefer the App helper if available; fall back to raw AppData.
    if (window.App && typeof window.App.getReport === 'function') {
      return window.App.getReport(id);
    }
    if (window.AppData && Array.isArray(window.AppData.reports)) {
      return window.AppData.reports.find(function (r) { return r.id === id; });
    }
    return null;
  }

  /**
   * Create a DOM element with optional className and textContent.
   */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /**
   * Format a date string for display (e.g. "2026-02-12" -> "2026-02-12").
   * Handles partial dates like "2025-09".
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    return dateStr;
  }

  // ---------------------------------------------------------------------------
  // Lightbox Component
  // ---------------------------------------------------------------------------

  var lightbox = {
    overlay: null,
    img: null,
    closeBtn: null,
    prevBtn: null,
    nextBtn: null,
    caption: null,

    // Gallery state
    images: [],       // Array of { path, caption }
    currentIndex: 0,

    // Zoom / pan state
    scale: 1,
    minScale: 1,
    maxScale: 5,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,

    /**
     * Build the lightbox DOM (once). Appends to document.body.
     */
    init: function () {
      if (this.overlay) return; // already initialised

      // Overlay
      this.overlay = el('div', 'rv-lightbox-overlay');
      this.overlay.setAttribute('role', 'dialog');
      this.overlay.setAttribute('aria-label', '图片查看器');

      // Close button
      this.closeBtn = el('button', 'rv-lightbox-close', '\u00D7'); // ×
      this.closeBtn.setAttribute('aria-label', '关闭');
      this.overlay.appendChild(this.closeBtn);

      // Image container (for centring + zoom transforms)
      var container = el('div', 'rv-lightbox-container');
      this.img = el('img', 'rv-lightbox-img');
      this.img.setAttribute('draggable', 'false');
      container.appendChild(this.img);
      this.overlay.appendChild(container);

      // Caption
      this.caption = el('div', 'rv-lightbox-caption');
      this.overlay.appendChild(this.caption);

      // Prev / Next buttons (hidden for single images)
      this.prevBtn = el('button', 'rv-lightbox-arrow rv-lightbox-prev', '\u2039'); // <
      this.prevBtn.setAttribute('aria-label', '上一张');
      this.nextBtn = el('button', 'rv-lightbox-arrow rv-lightbox-next', '\u203A'); // >
      this.nextBtn.setAttribute('aria-label', '下一张');
      this.overlay.appendChild(this.prevBtn);
      this.overlay.appendChild(this.nextBtn);

      document.body.appendChild(this.overlay);

      // --- Bind events ---
      var self = this;

      this.closeBtn.addEventListener('click', function () { self.close(); });

      // Click on overlay background (but not the image) closes
      this.overlay.addEventListener('click', function (e) {
        if (e.target === self.overlay || e.target.classList.contains('rv-lightbox-container')) {
          self.close();
        }
      });

      // Prevent clicks on image from closing when zoomed
      this.img.addEventListener('click', function (e) {
        if (self.scale <= 1) {
          self.close();
        }
        e.stopPropagation();
      });

      // Keyboard
      this._onKeyDown = function (e) { self._handleKey(e); };

      // Scroll wheel zoom
      this.overlay.addEventListener('wheel', function (e) {
        e.preventDefault();
        self._handleWheel(e);
      }, { passive: false });

      // Drag to pan
      this.img.addEventListener('mousedown', function (e) { self._panStart(e); });
      this.overlay.addEventListener('mousemove', function (e) { self._panMove(e); });
      this.overlay.addEventListener('mouseup', function () { self._panEnd(); });
      this.overlay.addEventListener('mouseleave', function () { self._panEnd(); });

      // Touch support for pan
      this.img.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) self._panStart(e.touches[0]);
      }, { passive: false });
      this.overlay.addEventListener('touchmove', function (e) {
        if (e.touches.length === 1) {
          e.preventDefault();
          self._panMove(e.touches[0]);
        }
      }, { passive: false });
      this.overlay.addEventListener('touchend', function () { self._panEnd(); });

      // Prev / Next
      this.prevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.prev();
      });
      this.nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.next();
      });

      // Inject styles once
      this._injectStyles();
    },

    /**
     * Open the lightbox with a single image.
     */
    openSingle: function (src, captionText) {
      this.init();
      this.images = [{ path: src, caption: captionText || '' }];
      this.currentIndex = 0;
      this._showImage(0);
      this.prevBtn.style.display = 'none';
      this.nextBtn.style.display = 'none';
      this._show();
    },

    /**
     * Open the lightbox in gallery mode.
     * @param {Array} images  Array of { path, caption }
     * @param {number} startIndex
     */
    openGallery: function (images, startIndex) {
      this.init();
      this.images = images;
      this.currentIndex = startIndex || 0;
      this._showImage(this.currentIndex);
      var hasMultiple = images.length > 1;
      this.prevBtn.style.display = hasMultiple ? '' : 'none';
      this.nextBtn.style.display = hasMultiple ? '' : 'none';
      this._show();
    },

    prev: function () {
      if (this.images.length <= 1) return;
      this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
      this._showImage(this.currentIndex);
    },

    next: function () {
      if (this.images.length <= 1) return;
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      this._showImage(this.currentIndex);
    },

    close: function () {
      if (!this.overlay) return;
      this.overlay.classList.remove('rv-lightbox-visible');
      document.removeEventListener('keydown', this._onKeyDown);
      document.body.style.overflow = '';
    },

    // --- Internal ---

    _show: function () {
      // Force reflow so transition fires
      void this.overlay.offsetHeight;
      this.overlay.classList.add('rv-lightbox-visible');
      document.addEventListener('keydown', this._onKeyDown);
      document.body.style.overflow = 'hidden';
    },

    _showImage: function (index) {
      var item = this.images[index];
      if (!item) return;
      this.img.src = item.path;
      this.caption.textContent = item.caption || '';
      this.caption.style.display = item.caption ? '' : 'none';
      // Reset zoom/pan
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this._applyTransform();
      // Reset cursor
      this.img.style.cursor = 'zoom-in';
    },

    _applyTransform: function () {
      this.img.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.scale + ')';
      this.img.style.cursor = this.scale > 1 ? 'grab' : 'zoom-in';
    },

    _handleKey: function (e) {
      switch (e.key) {
        case 'Escape':
          this.close();
          break;
        case 'ArrowLeft':
          this.prev();
          break;
        case 'ArrowRight':
          this.next();
          break;
      }
    },

    _handleWheel: function (e) {
      var delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      var newScale = this.scale * delta;
      newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

      // Zoom towards cursor position relative to image centre
      if (newScale !== this.scale) {
        var rect = this.img.getBoundingClientRect();
        var imgCenterX = rect.left + rect.width / 2;
        var imgCenterY = rect.top + rect.height / 2;
        var cursorX = e.clientX - imgCenterX;
        var cursorY = e.clientY - imgCenterY;

        var ratio = 1 - newScale / this.scale;
        this.panX += cursorX * ratio;
        this.panY += cursorY * ratio;
        this.scale = newScale;

        // If zoomed back to 1x, reset pan
        if (this.scale <= 1.01) {
          this.scale = 1;
          this.panX = 0;
          this.panY = 0;
        }

        this._applyTransform();
      }
    },

    _panStart: function (e) {
      if (this.scale <= 1) return;
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panOriginX = this.panX;
      this.panOriginY = this.panY;
      this.img.style.cursor = 'grabbing';
    },

    _panMove: function (e) {
      if (!this.isPanning) return;
      this.panX = this.panOriginX + (e.clientX - this.panStartX);
      this.panY = this.panOriginY + (e.clientY - this.panStartY);
      this._applyTransform();
      this.img.style.cursor = 'grabbing';
    },

    _panEnd: function () {
      if (!this.isPanning) return;
      this.isPanning = false;
      this.img.style.cursor = this.scale > 1 ? 'grab' : 'zoom-in';
    },

    /**
     * Inject the lightbox CSS into the <head>. Idempotent.
     */
    _injectStyles: function () {
      if (document.getElementById('rv-lightbox-styles')) return;

      var css = [
        /* Overlay */
        '.rv-lightbox-overlay {',
        '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
        '  background: rgba(0,0,0,0.9);',
        '  z-index: 10000;',
        '  display: flex; align-items: center; justify-content: center;',
        '  flex-direction: column;',
        '  opacity: 0; visibility: hidden;',
        '  transition: opacity 0.3s ease, visibility 0.3s ease;',
        '}',
        '.rv-lightbox-overlay.rv-lightbox-visible {',
        '  opacity: 1; visibility: visible;',
        '}',

        /* Container */
        '.rv-lightbox-container {',
        '  display: flex; align-items: center; justify-content: center;',
        '  flex: 1; width: 100%; overflow: hidden;',
        '}',

        /* Image */
        '.rv-lightbox-img {',
        '  max-width: 90vw; max-height: 85vh;',
        '  object-fit: contain;',
        '  user-select: none;',
        '  -webkit-user-drag: none;',
        '  transition: transform 0.15s ease;',
        '}',

        /* Close button */
        '.rv-lightbox-close {',
        '  position: absolute; top: 16px; right: 20px;',
        '  background: none; border: none;',
        '  color: #fff; font-size: 36px; line-height: 1;',
        '  cursor: pointer; z-index: 10001;',
        '  opacity: 0.7; transition: opacity 0.2s;',
        '  padding: 4px 12px;',
        '}',
        '.rv-lightbox-close:hover { opacity: 1; }',

        /* Arrows */
        '.rv-lightbox-arrow {',
        '  position: absolute; top: 50%; transform: translateY(-50%);',
        '  background: rgba(255,255,255,0.1); border: none;',
        '  color: #fff; font-size: 48px; line-height: 1;',
        '  cursor: pointer; z-index: 10001;',
        '  padding: 12px 16px; border-radius: 4px;',
        '  opacity: 0.6; transition: opacity 0.2s, background 0.2s;',
        '}',
        '.rv-lightbox-arrow:hover { opacity: 1; background: rgba(255,255,255,0.2); }',
        '.rv-lightbox-prev { left: 16px; }',
        '.rv-lightbox-next { right: 16px; }',

        /* Caption */
        '.rv-lightbox-caption {',
        '  color: rgba(255,255,255,0.85); font-size: 14px;',
        '  padding: 12px 20px; text-align: center;',
        '  max-width: 80%; word-break: break-word;',
        '}',

        /* ---- PDF Modal ---- */
        '.rv-pdf-modal-overlay {',
        '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
        '  background: rgba(0,0,0,0.75);',
        '  z-index: 10000;',
        '  display: flex; align-items: center; justify-content: center;',
        '  opacity: 0; visibility: hidden;',
        '  transition: opacity 0.3s ease, visibility 0.3s ease;',
        '}',
        '.rv-pdf-modal-overlay.rv-pdf-modal-visible {',
        '  opacity: 1; visibility: visible;',
        '}',
        '.rv-pdf-modal-content {',
        '  background: #fff; border-radius: 8px; overflow: hidden;',
        '  width: 90vw; max-width: 1000px; height: 85vh;',
        '  display: flex; flex-direction: column;',
        '  box-shadow: 0 8px 32px rgba(0,0,0,0.4);',
        '}',
        '.rv-pdf-modal-header {',
        '  display: flex; align-items: center; justify-content: space-between;',
        '  padding: 12px 20px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0;',
        '}',
        '.rv-pdf-modal-title {',
        '  font-size: 16px; font-weight: 600; color: #333;',
        '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        '}',
        '.rv-pdf-modal-close {',
        '  background: none; border: none;',
        '  font-size: 24px; color: #666; cursor: pointer;',
        '  padding: 4px 8px; line-height: 1;',
        '  transition: color 0.2s;',
        '}',
        '.rv-pdf-modal-close:hover { color: #333; }',
        '.rv-pdf-modal-iframe {',
        '  flex: 1; border: none; width: 100%;',
        '}'
      ].join('\n');

      var style = document.createElement('style');
      style.id = 'rv-lightbox-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  };

  // ---------------------------------------------------------------------------
  // PDF Modal (reusable by other modules, e.g. blood work page)
  // ---------------------------------------------------------------------------

  var pdfModal = {
    overlay: null,

    /**
     * Open a modal with an embedded PDF.
     * @param {string} filePath  Path to the PDF file.
     * @param {string} title     Title shown in the modal header.
     */
    show: function (filePath, title) {
      // Ensure lightbox styles are injected (they include PDF modal styles)
      lightbox.init();

      // Build modal DOM if needed
      if (!this.overlay) {
        this.overlay = el('div', 'rv-pdf-modal-overlay');

        var content = el('div', 'rv-pdf-modal-content');

        // Header
        var header = el('div', 'rv-pdf-modal-header');
        this._titleEl = el('span', 'rv-pdf-modal-title');
        var closeBtn = el('button', 'rv-pdf-modal-close', '\u00D7');
        closeBtn.setAttribute('aria-label', '关闭');
        header.appendChild(this._titleEl);
        header.appendChild(closeBtn);
        content.appendChild(header);

        // Iframe
        this._iframe = el('iframe', 'rv-pdf-modal-iframe');
        this._iframe.setAttribute('title', 'PDF查看器');
        content.appendChild(this._iframe);

        this.overlay.appendChild(content);
        document.body.appendChild(this.overlay);

        // Events
        var self = this;
        closeBtn.addEventListener('click', function () { self.close(); });
        this.overlay.addEventListener('click', function (e) {
          if (e.target === self.overlay) self.close();
        });
        this._onKeyDown = function (e) {
          if (e.key === 'Escape') self.close();
        };
      }

      // Populate
      this._titleEl.textContent = title || 'PDF';
      this._iframe.src = filePath;

      // Show
      void this.overlay.offsetHeight;
      this.overlay.classList.add('rv-pdf-modal-visible');
      document.addEventListener('keydown', this._onKeyDown);
      document.body.style.overflow = 'hidden';
    },

    close: function () {
      if (!this.overlay) return;
      this.overlay.classList.remove('rv-pdf-modal-visible');
      document.removeEventListener('keydown', this._onKeyDown);
      document.body.style.overflow = '';
      // Clear iframe to stop any ongoing loading
      this._iframe.src = 'about:blank';
    }
  };

  // ---------------------------------------------------------------------------
  // Report Rendering
  // ---------------------------------------------------------------------------

  /**
   * Inject report-viewer page styles. Idempotent.
   */
  function injectPageStyles() {
    if (document.getElementById('rv-page-styles')) return;

    var css = [
      /* Header */
      '.rv-header { margin-bottom: 24px; }',
      '.rv-title {',
      '  font-size: 24px; font-weight: 700; color: #1a1a1a;',
      '  margin: 0 0 8px 0; line-height: 1.3;',
      '}',
      '.rv-subtitle {',
      '  font-size: 14px; color: #666; margin: 0 0 16px 0;',
      '}',
      '.rv-subtitle span + span::before {',
      '  content: "\\00B7"; margin: 0 8px; color: #ccc;',
      '}',
      '.rv-download-btn {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 8px 18px; border-radius: 6px;',
      '  background: #2563eb; color: #fff; text-decoration: none;',
      '  font-size: 14px; font-weight: 500;',
      '  transition: background 0.2s;',
      '}',
      '.rv-download-btn:hover { background: #1d4ed8; }',
      '.rv-download-btn svg { width: 16px; height: 16px; fill: currentColor; }',

      /* Summary card */
      '.rv-summary-section { margin-bottom: 24px; }',
      '.rv-summary-card {',
      '  background: #f8fafc; border: 1px solid #e2e8f0;',
      '  border-radius: 8px; padding: 16px 20px;',
      '  margin-bottom: 16px;',
      '}',
      '.rv-summary-card p {',
      '  margin: 0; font-size: 15px; color: #334155; line-height: 1.6;',
      '}',
      '.rv-highlights {',
      '  border-left: 3px solid #cbd5e1; padding-left: 16px;',
      '  margin: 0;',
      '}',
      '.rv-highlights li {',
      '  font-size: 14px; color: #475569; line-height: 1.7;',
      '  list-style: disc; margin-left: 16px;',
      '}',

      /* Content section */
      '.rv-content-section { margin-top: 24px; }',

      /* PDF iframe */
      '.rv-pdf-wrapper { width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }',
      '.rv-pdf-iframe {',
      '  width: 100%; border: none;',
      '  height: calc(100vh - 300px); min-height: 500px;',
      '}',
      '.rv-pdf-fallback {',
      '  padding: 20px; text-align: center; color: #666; font-size: 14px;',
      '}',
      '.rv-pdf-fallback a { color: #2563eb; text-decoration: underline; }',

      /* Single image */
      '.rv-image-wrapper { text-align: center; }',
      '.rv-image-single {',
      '  max-width: 100%; border-radius: 8px; cursor: pointer;',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
      '  transition: box-shadow 0.2s;',
      '}',
      '.rv-image-single:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.18); }',

      /* Gallery grid */
      '.rv-gallery-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));',
      '  gap: 16px;',
      '}',
      '.rv-gallery-item {',
      '  border-radius: 8px; overflow: hidden;',
      '  border: 1px solid #e2e8f0; cursor: pointer;',
      '  transition: box-shadow 0.2s, transform 0.2s;',
      '}',
      '.rv-gallery-item:hover {',
      '  box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      '  transform: translateY(-2px);',
      '}',
      '.rv-gallery-item img {',
      '  width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover;',
      '}',
      '.rv-gallery-caption {',
      '  padding: 8px 12px; font-size: 13px; color: #555;',
      '  background: #fafafa; border-top: 1px solid #e2e8f0;',
      '}',

      /* Video */
      '.rv-video-wrapper { text-align: center; }',
      '.rv-video {',
      '  max-width: 100%; border-radius: 8px;',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
      '}',

      /* Not found */
      '.rv-not-found {',
      '  text-align: center; padding: 80px 20px; color: #888;',
      '}',
      '.rv-not-found h2 { font-size: 22px; margin-bottom: 8px; color: #666; }',
      '.rv-not-found p { font-size: 15px; }',

      /* Responsive */
      '@media (max-width: 600px) {',
      '  .rv-title { font-size: 20px; }',
      '  .rv-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }',
      '  .rv-lightbox-arrow { font-size: 32px; padding: 8px 10px; }',
      '  .rv-pdf-modal-content { width: 96vw; height: 80vh; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'rv-page-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Build the download icon SVG string.
   */
  function downloadIcon() {
    return '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1z"/>' +
      '<path d="M3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>' +
      '</svg>';
  }

  /**
   * Build the header section.
   */
  function buildHeader(report) {
    var header = el('div', 'rv-header');

    // Title
    var title = el('h1', 'rv-title', report.title);
    header.appendChild(title);

    // Subtitle: date + institution
    var subtitle = el('p', 'rv-subtitle');
    if (report.date) {
      var dateSpan = el('span', null, formatDate(report.date));
      subtitle.appendChild(dateSpan);
    }
    if (report.institution) {
      var instSpan = el('span', null, report.institution);
      subtitle.appendChild(instSpan);
    }
    header.appendChild(subtitle);

    // Download button (only if there is a filePath)
    var downloadPath = report.filePath || (report.files && report.files.length ? report.files[0].path : null);
    if (downloadPath) {
      var btn = document.createElement('a');
      btn.className = 'rv-download-btn';
      btn.href = downloadPath;
      btn.download = '';
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.innerHTML = downloadIcon() + ' 下载原件';
      header.appendChild(btn);
    }

    return header;
  }

  /**
   * Build the summary section (summary text + highlights).
   */
  function buildSummary(report) {
    var hasSummary = report.summary && report.summary.trim();
    var hasHighlights = report.highlights && report.highlights.length > 0;

    if (!hasSummary && !hasHighlights) return null;

    var section = el('div', 'rv-summary-section');

    if (hasSummary) {
      var card = el('div', 'rv-summary-card');
      var p = el('p', null, report.summary);
      card.appendChild(p);
      section.appendChild(card);
    }

    if (hasHighlights) {
      var ul = el('ul', 'rv-highlights');
      report.highlights.forEach(function (h) {
        var li = el('li', null, h);
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }

    return section;
  }

  /**
   * Build the content section based on fileType.
   */
  function buildContent(report) {
    var section = el('div', 'rv-content-section');

    switch (report.fileType) {
      case 'pdf':
        section.appendChild(buildPdfContent(report));
        break;
      case 'image':
        section.appendChild(buildImageContent(report));
        break;
      case 'gallery':
        section.appendChild(buildGalleryContent(report));
        break;
      case 'video':
        section.appendChild(buildVideoContent(report));
        break;
      default:
        // Unknown file type - show download link only
        var notice = el('p', null, '不支持预览此文件类型，请下载查看。');
        notice.style.color = '#888';
        notice.style.textAlign = 'center';
        section.appendChild(notice);
    }

    return section;
  }

  /**
   * PDF content: full-width iframe with fallback.
   */
  function buildPdfContent(report) {
    var wrapper = el('div', 'rv-pdf-wrapper');

    var iframe = document.createElement('iframe');
    iframe.className = 'rv-pdf-iframe';
    iframe.src = report.filePath;
    iframe.setAttribute('title', report.title || 'PDF文档');
    wrapper.appendChild(iframe);

    // Fallback
    var fallback = el('div', 'rv-pdf-fallback');
    fallback.innerHTML = '如果PDF无法显示，请 <a href="' +
      escapeHtml(report.filePath) + '" target="_blank" rel="noopener">点击此处直接打开</a>。';
    wrapper.appendChild(fallback);

    return wrapper;
  }

  /**
   * Escape HTML entities for safe insertion.
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Image content: single image with lightbox on click.
   */
  function buildImageContent(report) {
    var wrapper = el('div', 'rv-image-wrapper');

    var img = document.createElement('img');
    img.className = 'rv-image-single';
    img.src = report.filePath;
    img.alt = report.title || '报告图片';
    img.loading = 'lazy';

    img.addEventListener('click', function () {
      lightbox.openSingle(report.filePath, report.title);
    });

    wrapper.appendChild(img);
    return wrapper;
  }

  /**
   * Gallery content: grid of thumbnails with lightbox.
   */
  function buildGalleryContent(report) {
    var files = report.files || [];
    var grid = el('div', 'rv-gallery-grid');

    files.forEach(function (file, index) {
      var item = el('div', 'rv-gallery-item');

      var img = document.createElement('img');
      img.src = file.path;
      img.alt = file.caption || '照片 ' + (index + 1);
      img.loading = 'lazy';
      item.appendChild(img);

      if (file.caption) {
        var caption = el('div', 'rv-gallery-caption', file.caption);
        item.appendChild(caption);
      }

      item.addEventListener('click', function () {
        lightbox.openGallery(files, index);
      });

      grid.appendChild(item);
    });

    return grid;
  }

  /**
   * Video content: HTML5 video player.
   */
  function buildVideoContent(report) {
    var wrapper = el('div', 'rv-video-wrapper');

    var video = document.createElement('video');
    video.className = 'rv-video';
    video.controls = true;
    video.preload = 'metadata';
    video.src = report.filePath;
    video.textContent = '您的浏览器不支持视频播放。';

    wrapper.appendChild(video);
    return wrapper;
  }

  /**
   * Show a "report not found" message.
   */
  function buildNotFound(reportId) {
    var wrapper = el('div', 'rv-not-found');
    var heading = el('h2', null, '报告未找到');
    var msg = el('p', null, '未能找到ID为 "' + (reportId || '') + '" 的报告。');
    wrapper.appendChild(heading);
    wrapper.appendChild(msg);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Render a report into the #content element.
   * @param {string} reportId  The report ID to look up and render.
   */
  function render(reportId) {
    injectPageStyles();

    var container = document.getElementById('content');
    if (!container) {
      console.error('[ReportViewer] #content element not found.');
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Look up report
    var report = getReport(reportId);

    if (!report) {
      container.appendChild(buildNotFound(reportId));
      return;
    }

    // 1. Header
    container.appendChild(buildHeader(report));

    // 2. Summary
    var summary = buildSummary(report);
    if (summary) {
      container.appendChild(summary);
    }

    // 3. Content (PDF / image / gallery / video)
    container.appendChild(buildContent(report));
  }

  /**
   * Open a modal PDF viewer. Useful from other pages (e.g., blood work).
   * @param {string} filePath  Path to the PDF file.
   * @param {string} title     Title to display in the modal header.
   */
  function showPdfModal(filePath, title) {
    pdfModal.show(filePath, title);
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  window.ReportViewer = {
    render: render,
    showPdfModal: showPdfModal
  };

})();
