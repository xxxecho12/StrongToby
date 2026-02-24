/**
 * medication.js
 * Medication records page for StrongToby pet medical records.
 * Renders current medications, dosage change timeline, and history into #content.
 *
 * Data source: window.AppData.medications
 *   { current: [...], history: [...], dosageChanges: [...] }
 *
 * Exports: window.Medication = { render() }
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Inject scoped CSS                                                  */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (document.getElementById('med-styles')) return;

    var css = '';

    /* Section titles */
    css += '.med-section-title { font-size:18px; font-weight:700; color:#2c3e50; margin:28px 0 16px 0; padding-bottom:8px; border-bottom:2px solid #e0e0e0; }';
    css += '.med-section-title:first-child { margin-top:0; }';

    /* Current medication cards */
    css += '.med-cards { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:24px; }';
    css += '.med-card { flex:1 1 300px; max-width:480px; background:#fff; border:1px solid #e0e0e0; border-left:5px solid #27ae60; border-radius:8px; padding:20px 24px; box-shadow:0 1px 4px rgba(0,0,0,0.06); transition:box-shadow .2s; }';
    css += '.med-card:hover { box-shadow:0 3px 12px rgba(0,0,0,0.1); }';
    css += '.med-card-name { font-size:18px; font-weight:700; color:#2c3e50; margin-bottom:12px; }';
    css += '.med-card-row { display:flex; margin-bottom:6px; font-size:13px; color:#555; }';
    css += '.med-card-label { font-weight:600; min-width:72px; color:#777; flex-shrink:0; }';
    css += '.med-card-value { color:#333; }';
    css += '.med-card-notes { margin-top:10px; padding:8px 12px; background:#f0faf4; border-radius:4px; font-size:12px; color:#555; line-height:1.5; }';

    /* Dosage change timeline */
    css += '.med-timeline { position:relative; padding-left:28px; margin-bottom:32px; }';
    css += '.med-timeline::before { content:""; position:absolute; left:10px; top:0; bottom:0; width:2px; background:#d5d8dc; }';
    css += '.med-timeline-item { position:relative; margin-bottom:20px; }';
    css += '.med-timeline-dot { position:absolute; left:-23px; top:4px; width:12px; height:12px; border-radius:50%; background:#9b59b6; border:2px solid #fff; box-shadow:0 0 0 2px #9b59b6; }';
    css += '.med-timeline-date { font-size:12px; font-weight:600; color:#9b59b6; margin-bottom:4px; }';
    css += '.med-timeline-body { background:#fff; border:1px solid #e8e8e8; border-radius:6px; padding:12px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }';
    css += '.med-timeline-med { font-weight:700; color:#2c3e50; font-size:14px; margin-bottom:6px; }';
    css += '.med-timeline-change { display:flex; align-items:center; gap:8px; font-size:13px; color:#555; flex-wrap:wrap; }';
    css += '.med-timeline-from { background:#fdecea; padding:3px 10px; border-radius:12px; color:#c0392b; font-size:12px; }';
    css += '.med-timeline-arrow { color:#9b59b6; font-size:16px; font-weight:700; flex-shrink:0; }';
    css += '.med-timeline-to { background:#eafaf1; padding:3px 10px; border-radius:12px; color:#27ae60; font-size:12px; }';
    css += '.med-timeline-reason { margin-top:6px; font-size:12px; color:#888; }';

    /* History table */
    css += '.med-table-wrap { overflow-x:auto; margin-bottom:32px; }';
    css += '.med-table { width:100%; border-collapse:collapse; font-size:13px; }';
    css += '.med-table th { background:#f5f6fa; padding:10px 12px; text-align:left; font-weight:600; color:#555; border-bottom:2px solid #ddd; white-space:nowrap; }';
    css += '.med-table td { padding:8px 12px; border-bottom:1px solid #eee; color:#888; }';
    css += '.med-table tr:hover { background:#fafbfd; }';
    css += '.med-table .med-inactive-name { color:#999; font-weight:600; }';

    /* Fade in animation */
    css += '.med-page { animation: med-fadeIn .25s ease; }';
    css += '@keyframes med-fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }';

    /* Empty state */
    css += '.med-empty { color:#aaa; font-size:14px; padding:20px 0; }';

    var style = document.createElement('style');
    style.id = 'med-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ */
  /*  Current Medications (card layout)                                  */
  /* ------------------------------------------------------------------ */

  function renderCurrentCards(current) {
    if (!current || current.length === 0) {
      return '<p class="med-empty">暂无正在使用的药品。</p>';
    }

    var html = '<div class="med-cards">';

    current.forEach(function (med) {
      html += '<div class="med-card">';
      html += '  <div class="med-card-name">' + escapeHtml(med.name) + '</div>';

      html += '  <div class="med-card-row"><span class="med-card-label">剂量</span><span class="med-card-value">' + escapeHtml(med.dosage) + '</span></div>';
      html += '  <div class="med-card-row"><span class="med-card-label">频次</span><span class="med-card-value">' + escapeHtml(med.frequency) + '</span></div>';
      html += '  <div class="med-card-row"><span class="med-card-label">用途</span><span class="med-card-value">' + escapeHtml(med.purpose) + '</span></div>';
      html += '  <div class="med-card-row"><span class="med-card-label">起始日期</span><span class="med-card-value">' + escapeHtml(med.startDate) + '</span></div>';

      if (med.notes) {
        html += '  <div class="med-card-notes">' + escapeHtml(med.notes) + '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Dosage Changes Timeline                                            */
  /* ------------------------------------------------------------------ */

  function renderDosageTimeline(dosageChanges) {
    if (!dosageChanges || dosageChanges.length === 0) {
      return '<p class="med-empty">暂无剂量变更记录。</p>';
    }

    // Sort newest first
    var sorted = dosageChanges.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var html = '<div class="med-timeline">';

    sorted.forEach(function (dc) {
      html += '<div class="med-timeline-item">';
      html += '  <div class="med-timeline-dot"></div>';
      html += '  <div class="med-timeline-date">' + escapeHtml(dc.date) + '</div>';
      html += '  <div class="med-timeline-body">';
      html += '    <div class="med-timeline-med">' + escapeHtml(dc.medication) + '</div>';
      html += '    <div class="med-timeline-change">';
      html += '      <span class="med-timeline-from">' + escapeHtml(dc.from) + '</span>';
      html += '      <span class="med-timeline-arrow">&rarr;</span>';
      html += '      <span class="med-timeline-to">' + escapeHtml(dc.to) + '</span>';
      html += '    </div>';
      if (dc.reason) {
        html += '    <div class="med-timeline-reason">' + escapeHtml(dc.reason) + '</div>';
      }
      html += '  </div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  History Table                                                      */
  /* ------------------------------------------------------------------ */

  function renderHistoryTable(history) {
    if (!history || history.length === 0) {
      return '<p class="med-empty">暂无历史用药记录。</p>';
    }

    var html = '<div class="med-table-wrap"><table class="med-table">';
    html += '<thead><tr>';
    html += '<th>药品</th><th>剂量</th><th>频次</th><th>用途</th><th>起始</th><th>结束</th><th>停药原因</th>';
    html += '</tr></thead><tbody>';

    history.forEach(function (med) {
      html += '<tr>';
      html += '<td class="med-inactive-name">' + escapeHtml(med.name) + '</td>';
      html += '<td>' + escapeHtml(med.dosage) + '</td>';
      html += '<td>' + escapeHtml(med.frequency) + '</td>';
      html += '<td>' + escapeHtml(med.purpose) + '</td>';
      html += '<td>' + escapeHtml(med.startDate) + '</td>';
      html += '<td>' + escapeHtml(med.endDate || '') + '</td>';
      html += '<td>' + escapeHtml(med.stopReason || '') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ */
  /*  Public render()                                                    */
  /* ------------------------------------------------------------------ */

  function render() {
    var data = (window.AppData && window.AppData.medications) || {};
    var current = data.current || [];
    var history = data.history || [];
    var dosageChanges = data.dosageChanges || [];

    injectStyles();

    var container = document.getElementById('content');

    var html = '<div class="med-page">';

    // Section 1: Current Medications
    html += '<div class="med-section-title">正在使用的药品</div>';
    html += renderCurrentCards(current);

    // Section 2: Dosage Changes Timeline
    html += '<div class="med-section-title">剂量变更记录</div>';
    html += renderDosageTimeline(dosageChanges);

    // Section 3: History
    html += '<div class="med-section-title">历史用药</div>';
    html += renderHistoryTable(history);

    html += '</div>';

    container.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */

  window.Medication = { render: render };

})();
