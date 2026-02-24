/**
 * Timeline Component for StrongToby Pet Medical Records SPA
 * Renders a vertical timeline of medical events.
 *
 * Usage: Timeline.render(containerElement, eventsArray)
 */
(function () {
  'use strict';

  // Tag color mapping
  var TAG_COLORS = {
    'CT':   { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'B超':  { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
    'X光':  { bg: '#ccfbf1', text: '#0f766e', dot: '#14b8a6' },
    '手术': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    '血检': { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
    '腹水': { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
    '体检': { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    '症状': { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
    '术后': { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
    '病理': { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' }
  };

  var DEFAULT_TAG_COLOR = { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' };

  /**
   * Injects scoped CSS for the timeline into the document head (once).
   */
  function injectStyles() {
    if (document.getElementById('timeline-styles')) return;

    var css = [
      '.tl-container {',
      '  position: relative;',
      '  padding: 16px 0 16px 36px;',
      '  margin: 0;',
      '}',

      '/* The vertical line */',
      '.tl-container::before {',
      '  content: "";',
      '  position: absolute;',
      '  left: 14px;',
      '  top: 0;',
      '  bottom: 0;',
      '  width: 3px;',
      '  background: #e5e7eb;',
      '  border-radius: 2px;',
      '}',

      '.tl-event {',
      '  position: relative;',
      '  padding: 0 0 28px 20px;',
      '}',

      '.tl-event:last-child {',
      '  padding-bottom: 0;',
      '}',

      '/* Dot on the line */',
      '.tl-dot {',
      '  position: absolute;',
      '  left: -28px;',
      '  top: 4px;',
      '  width: 13px;',
      '  height: 13px;',
      '  border-radius: 50%;',
      '  border: 2.5px solid #fff;',
      '  box-shadow: 0 0 0 2px currentColor;',
      '  z-index: 1;',
      '}',

      '.tl-date {',
      '  font-size: 0.8rem;',
      '  color: #6b7280;',
      '  margin-bottom: 2px;',
      '  letter-spacing: 0.02em;',
      '}',

      '.tl-title {',
      '  font-weight: 600;',
      '  font-size: 1rem;',
      '  color: #111827;',
      '  margin-bottom: 4px;',
      '  line-height: 1.4;',
      '}',

      '.tl-desc {',
      '  font-size: 0.88rem;',
      '  color: #4b5563;',
      '  line-height: 1.55;',
      '  margin-bottom: 8px;',
      '}',

      '.tl-tags {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 6px;',
      '  margin-bottom: 6px;',
      '}',

      '.tl-tag {',
      '  display: inline-block;',
      '  padding: 1px 9px;',
      '  border-radius: 9999px;',
      '  font-size: 0.75rem;',
      '  font-weight: 500;',
      '  line-height: 1.7;',
      '  white-space: nowrap;',
      '}',

      '.tl-report-link {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 2px;',
      '  font-size: 0.8rem;',
      '  color: #2563eb;',
      '  text-decoration: none;',
      '  cursor: pointer;',
      '  margin-right: 12px;',
      '  transition: color 0.15s;',
      '}',

      '.tl-report-link:hover {',
      '  color: #1d4ed8;',
      '  text-decoration: underline;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'timeline-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Determines the primary color for the dot based on the event's tags.
   * Uses the first recognized tag color, or falls back to gray.
   */
  function getDotColor(tags) {
    if (!tags || !tags.length) return DEFAULT_TAG_COLOR.dot;
    for (var i = 0; i < tags.length; i++) {
      var c = TAG_COLORS[tags[i]];
      if (c) return c.dot;
    }
    return DEFAULT_TAG_COLOR.dot;
  }

  /**
   * Formats a date string for display.
   * Handles "YYYY-MM-DD", "YYYY-MM", "YYYY" formats.
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[0] + ' 年 ' + parseInt(parts[1], 10) + ' 月 ' + parseInt(parts[2], 10) + ' 日';
    }
    if (parts.length === 2) {
      return parts[0] + ' 年 ' + parseInt(parts[1], 10) + ' 月';
    }
    return parts[0] + ' 年';
  }

  /**
   * Parse a date string into a sortable numeric value.
   * Missing month/day default to 01.
   */
  function parseDateValue(dateStr) {
    if (!dateStr) return 0;
    var parts = dateStr.split('-');
    var y = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 1;
    var d = parseInt(parts[2], 10) || 1;
    return y * 10000 + m * 100 + d;
  }

  /**
   * Creates a single tag chip element.
   */
  function createTagChip(tagText) {
    var colors = TAG_COLORS[tagText] || DEFAULT_TAG_COLOR;
    var chip = document.createElement('span');
    chip.className = 'tl-tag';
    chip.textContent = tagText;
    chip.style.backgroundColor = colors.bg;
    chip.style.color = colors.text;
    return chip;
  }

  /**
   * Build the correct hash for a report based on its category/subcategory.
   */
  function buildReportHash(reportId) {
    var report = window.App && window.App.getReport ? window.App.getReport(reportId) : null;
    if (!report) return '#overview';
    var cat = report.category;
    var sub = report.subcategory;
    if (cat === 'archive') return '#archive/' + reportId;
    if (cat === 'bloodwork') return '#bloodwork';
    if (sub) return '#' + cat + '/' + sub + '/' + reportId;
    return '#' + cat + '/' + reportId;
  }

  /**
   * Creates a linked-report anchor element.
   */
  function createReportLink(reportId) {
    var a = document.createElement('a');
    a.className = 'tl-report-link';
    var hash = buildReportHash(reportId);
    a.href = hash;
    a.textContent = '查看报告 \u2192';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.hash = buildReportHash(reportId);
    });
    return a;
  }

  /**
   * Builds the DOM for a single timeline event node.
   */
  function buildEventNode(evt) {
    var node = document.createElement('div');
    node.className = 'tl-event';

    // Dot
    var dot = document.createElement('div');
    dot.className = 'tl-dot';
    var dotColor = getDotColor(evt.tags);
    dot.style.backgroundColor = dotColor;
    dot.style.color = dotColor;
    node.appendChild(dot);

    // Date
    var dateEl = document.createElement('div');
    dateEl.className = 'tl-date';
    dateEl.textContent = formatDate(evt.date);
    node.appendChild(dateEl);

    // Title
    var titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = evt.title || '';
    node.appendChild(titleEl);

    // Description
    if (evt.description) {
      var descEl = document.createElement('div');
      descEl.className = 'tl-desc';
      descEl.textContent = evt.description;
      node.appendChild(descEl);
    }

    // Tags
    if (evt.tags && evt.tags.length) {
      var tagsWrap = document.createElement('div');
      tagsWrap.className = 'tl-tags';
      evt.tags.forEach(function (t) {
        tagsWrap.appendChild(createTagChip(t));
      });
      node.appendChild(tagsWrap);
    }

    // Linked reports
    if (evt.linkedReports && evt.linkedReports.length) {
      var linksWrap = document.createElement('div');
      linksWrap.style.marginTop = '4px';
      evt.linkedReports.forEach(function (rid) {
        linksWrap.appendChild(createReportLink(rid));
      });
      node.appendChild(linksWrap);
    }

    return node;
  }

  /**
   * Render the timeline into the given container element.
   *
   * @param {HTMLElement} container - The DOM element to render into.
   * @param {Array}       events   - Array of timeline event objects.
   */
  function render(container, events) {
    if (!container) {
      console.warn('[Timeline] No container element provided.');
      return;
    }
    if (!events || !events.length) {
      container.innerHTML = '<p style="color:#6b7280;font-size:0.9rem;">暂无时间线记录。</p>';
      return;
    }

    injectStyles();

    // Sort chronologically (oldest first)
    var sorted = events.slice().sort(function (a, b) {
      return parseDateValue(a.date) - parseDateValue(b.date);
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'tl-container';

    sorted.forEach(function (evt) {
      wrapper.appendChild(buildEventNode(evt));
    });

    // Clear container and append
    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  // Public API
  window.Timeline = {
    render: render
  };
})();
