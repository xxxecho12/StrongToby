/**
 * Overview / Home Page for StrongToby Pet Medical Records SPA
 * Renders basic info, condition summary, timeline, past history,
 * and main symptoms into the #content element.
 *
 * Depends on: window.AppData.basicInfo, window.Timeline
 * Usage:      Overview.render()
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate age string "X岁X个月" from a birthDate string to today.
   * @param {string} birthDateStr - "YYYY-MM-DD"
   * @returns {string}
   */
  function calcAge(birthDateStr) {
    if (!birthDateStr) return '未知';

    var today = new Date();
    var parts = birthDateStr.split('-');
    var birthYear  = parseInt(parts[0], 10);
    var birthMonth = parseInt(parts[1], 10);
    var birthDay   = parseInt(parts[2], 10);

    var years  = today.getFullYear() - birthYear;
    var months = today.getMonth() + 1 - birthMonth;

    if (today.getDate() < birthDay) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years <= 0 && months <= 0) return '不到1个月';
    var result = '';
    if (years > 0) result += years + '岁';
    if (months > 0) result += months + '个月';
    return result;
  }

  /**
   * Create a DOM element with optional class, text, and children.
   */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /**
   * Inject scoped styles for overview page (once).
   */
  function injectStyles() {
    if (document.getElementById('overview-styles')) return;

    var css = [
      '.ov-page {',
      '  max-width: 780px;',
      '  margin: 0 auto;',
      '  padding: 24px 16px 48px;',
      '}',

      '.ov-card {',
      '  background: #fff;',
      '  border: 1px solid #e5e7eb;',
      '  border-radius: 12px;',
      '  padding: 20px 24px;',
      '  margin-bottom: 20px;',
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.04);',
      '}',

      '.ov-card-title {',
      '  font-size: 1.05rem;',
      '  font-weight: 700;',
      '  color: #111827;',
      '  margin: 0 0 14px 0;',
      '  padding-bottom: 8px;',
      '  border-bottom: 2px solid #f3f4f6;',
      '}',

      /* Basic info key-value grid */
      '.ov-info-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));',
      '  gap: 10px 24px;',
      '}',

      '.ov-kv {',
      '  display: flex;',
      '  align-items: baseline;',
      '  gap: 6px;',
      '}',

      '.ov-kv-label {',
      '  font-size: 0.85rem;',
      '  color: #6b7280;',
      '  white-space: nowrap;',
      '}',

      '.ov-kv-value {',
      '  font-size: 0.95rem;',
      '  color: #111827;',
      '  font-weight: 500;',
      '}',

      /* Condition summary */
      '.ov-text {',
      '  font-size: 0.92rem;',
      '  color: #374151;',
      '  line-height: 1.65;',
      '  margin-bottom: 10px;',
      '}',

      '.ov-text:last-child {',
      '  margin-bottom: 0;',
      '}',

      '.ov-markdown p {',
      '  margin: 0 0 8px 0;',
      '}',

      '.ov-markdown p:last-child {',
      '  margin-bottom: 0;',
      '}',

      '.ov-sub-label {',
      '  font-size: 0.82rem;',
      '  font-weight: 600;',
      '  color: #6b7280;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.04em;',
      '  margin-bottom: 4px;',
      '}',

      /* Past history bullets */
      '.ov-bullet-list {',
      '  list-style: disc;',
      '  padding-left: 20px;',
      '  margin: 0;',
      '}',

      '.ov-bullet-list li {',
      '  font-size: 0.92rem;',
      '  color: #374151;',
      '  line-height: 1.6;',
      '  margin-bottom: 4px;',
      '}',

      /* Main symptoms */
      '.ov-symptom-item {',
      '  display: flex;',
      '  align-items: flex-start;',
      '  gap: 8px;',
      '  margin-bottom: 8px;',
      '}',

      '.ov-symptom-dot {',
      '  flex-shrink: 0;',
      '  width: 8px;',
      '  height: 8px;',
      '  border-radius: 50%;',
      '  background: #ef4444;',
      '  margin-top: 7px;',
      '}',

      '.ov-symptom-text {',
      '  font-size: 0.92rem;',
      '  color: #374151;',
      '  line-height: 1.55;',
      '}',

      /* Pet name header */
      '.ov-hero {',
      '  text-align: center;',
      '  margin-bottom: 24px;',
      '}',

      '.ov-hero-name {',
      '  font-size: 1.6rem;',
      '  font-weight: 800;',
      '  color: #111827;',
      '  margin: 0 0 4px 0;',
      '}',

      '.ov-hero-sub {',
      '  font-size: 0.88rem;',
      '  color: #6b7280;',
      '}',

      /* 2×2 grid for info cards */
      '.ov-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(2, 1fr);',
      '  gap: 16px;',
      '  margin-bottom: 20px;',
      '}',

      '.ov-grid > .ov-card {',
      '  margin-bottom: 0;',
      '}',

      '@media (max-width: 768px) {',
      '  .ov-grid { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'overview-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Card builders
  // ---------------------------------------------------------------------------

  /**
   * Build hero/name header section.
   */
  function buildHero(info) {
    var hero = el('div', 'ov-hero');

    var name = el('h1', 'ov-hero-name', info.name || '未命名');
    hero.appendChild(name);

    var sub = el('div', 'ov-hero-sub');
    sub.textContent = (info.breed || '') + '  |  ' + calcAge(info.birthDate);
    hero.appendChild(sub);

    return hero;
  }

  /**
   * Build the Basic Info Card.
   */
  function buildBasicInfoCard(info) {
    var card = el('div', 'ov-card');
    card.appendChild(el('div', 'ov-card-title', '基本信息'));

    var grid = el('div', 'ov-info-grid');

    var fields = [
      { label: '品种', value: info.breed },
      { label: '年龄', value: calcAge(info.birthDate) },
      { label: '性别', value: info.sex },
      { label: '绝育状态', value: info.neutered ? '已绝育' + (info.neuteredDate ? ' (' + info.neuteredDate + ')' : '') : '未绝育' }
    ];

    fields.forEach(function (f) {
      var kv = el('div', 'ov-kv');
      kv.appendChild(el('span', 'ov-kv-label', f.label + ':'));
      kv.appendChild(el('span', 'ov-kv-value', f.value || '--'));
      grid.appendChild(kv);
    });

    card.appendChild(grid);
    return card;
  }

  /**
   * Build the Condition Summary Card.
   */
  /**
   * Render markdown text to HTML. Falls back to plain text if marked.js is not loaded.
   */
  function renderMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
      return marked.parse(text);
    }
    // Fallback: escape HTML and convert newlines to <br>
    var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\n/g, '<br>');
  }

  function buildConditionCard(info) {
    var card = el('div', 'ov-card');
    card.appendChild(el('div', 'ov-card-title', '健康概况'));

    if (info.conditionSummary) {
      var lbl1 = el('div', 'ov-sub-label', '病情摘要');
      card.appendChild(lbl1);
      var summaryEl = el('div', 'ov-text ov-markdown');
      summaryEl.innerHTML = renderMarkdown(info.conditionSummary);
      card.appendChild(summaryEl);
    }

    if (info.currentStatus) {
      var lbl2 = el('div', 'ov-sub-label', '当前状态');
      lbl2.style.marginTop = '12px';
      card.appendChild(lbl2);
      var statusEl = el('div', 'ov-text ov-markdown');
      statusEl.innerHTML = renderMarkdown(info.currentStatus);
      card.appendChild(statusEl);
    }

    return card;
  }

  /**
   * Build the Timeline section.
   */
  function buildTimelineSection(info) {
    var card = el('div', 'ov-card');
    card.appendChild(el('div', 'ov-card-title', '诊疗时间线'));

    var timelineContainer = el('div');

    if (window.Timeline && typeof window.Timeline.render === 'function') {
      window.Timeline.render(timelineContainer, info.timeline || []);
    } else {
      timelineContainer.innerHTML = '<p style="color:#9ca3af;font-size:0.9rem;">时间线组件未加载。</p>';
    }

    card.appendChild(timelineContainer);
    return card;
  }

  /**
   * Build the Past History Card.
   */
  function buildPastHistoryCard(info) {
    var history = info.pastHistory;
    if (!history || !history.length) return null;

    var card = el('div', 'ov-card');
    card.appendChild(el('div', 'ov-card-title', '既往病史'));

    var ul = el('ul', 'ov-bullet-list');
    history.forEach(function (item) {
      var li = el('li', null, item);
      ul.appendChild(li);
    });

    card.appendChild(ul);
    return card;
  }

  /**
   * Build the Main Symptoms section by extracting key issues from
   * timeline events tagged with "症状" or from the condition summary.
   */
  function buildSymptomsCard(info) {
    // Collect symptom descriptions from timeline events tagged with "症状"
    var symptoms = [];

    if (info.timeline && info.timeline.length) {
      info.timeline.forEach(function (evt) {
        if (evt.tags && evt.tags.indexOf('症状') !== -1) {
          var text = evt.title;
          if (evt.description) text += ' - ' + evt.description;
          symptoms.push(text);
        }
      });
    }

    // Fallback: if no explicit symptom events, extract sentences from conditionSummary
    if (symptoms.length === 0 && info.conditionSummary) {
      var sentences = info.conditionSummary
        .split(/[。；;]/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
      symptoms = sentences;
    }

    if (symptoms.length === 0) return null;

    var card = el('div', 'ov-card');
    card.appendChild(el('div', 'ov-card-title', '主要症状'));

    symptoms.forEach(function (text) {
      var row = el('div', 'ov-symptom-item');

      var dot = el('div', 'ov-symptom-dot');
      row.appendChild(dot);

      var txt = el('div', 'ov-symptom-text', text);
      row.appendChild(txt);

      card.appendChild(row);
    });

    return card;
  }

  // ---------------------------------------------------------------------------
  // Public render
  // ---------------------------------------------------------------------------

  function render() {
    var contentEl = document.getElementById('content');
    if (!contentEl) {
      console.error('[Overview] #content element not found.');
      return;
    }

    var appData = window.AppData;
    if (!appData || !appData.basicInfo) {
      contentEl.innerHTML = '<p style="padding:32px;color:#ef4444;">无法加载基本信息数据。</p>';
      return;
    }

    var info = appData.basicInfo;

    injectStyles();

    // Build the page
    var page = el('div', 'ov-page');

    // Hero header
    page.appendChild(buildHero(info));

    // 2×2 info grid: basic info | condition | past history | symptoms
    var grid = el('div', 'ov-grid');
    grid.appendChild(buildBasicInfoCard(info));
    grid.appendChild(buildConditionCard(info));

    var historyCard = buildPastHistoryCard(info);
    if (historyCard) grid.appendChild(historyCard);

    var symptomsCard = buildSymptomsCard(info);
    if (symptomsCard) grid.appendChild(symptomsCard);

    page.appendChild(grid);

    // Timeline at the bottom
    page.appendChild(buildTimelineSection(info));

    // Render into #content
    contentEl.innerHTML = '';
    contentEl.appendChild(page);
  }

  // Public API
  window.Overview = {
    render: render
  };
})();
