/**
 * BloodWork - Blood Work Comparison Table for StrongToby Pet Medical Records SPA
 * Renders a tabbed, horizontally-scrollable comparison table of lab results
 * across multiple test dates, with status-based cell styling and tooltips.
 *
 * Data source: window.AppData.bloodWork
 * Export:      window.BloodWork = { render() }
 */
(function () {
  'use strict';

  /* ======================================================================
   *  Constants
   * ====================================================================== */

  var STYLE_ID = 'blood-work-styles';

  /** Status-based cell styling map */
  var STATUS_STYLES = {
    normal:        { bg: 'transparent',  text: 'inherit',  dotColor: '#22c55e' },
    high:          { bg: '#FFF3E0',      text: '#F5A623',  dotColor: null },
    low:           { bg: '#FFF3E0',      text: '#F5A623',  dotColor: null },
    critical_high: { bg: '#FFEBEE',      text: '#D0021B',  dotColor: null },
    critical_low:  { bg: '#FFEBEE',      text: '#D0021B',  dotColor: null }
  };

  /* ======================================================================
   *  CSS Injection
   * ====================================================================== */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      /* Page header */
      '.bw-header { margin-bottom: 24px; }',
      '.bw-header h2 { font-size: 1.4rem; font-weight: 700; color: #111827; margin: 0 0 6px 0; }',
      '.bw-header p { font-size: 0.9rem; color: #6b7280; margin: 0; line-height: 1.5; }',

      /* Category tabs */
      '.bw-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }',
      '.bw-tab {',
      '  padding: 7px 18px;',
      '  border: 1px solid #d1d5db;',
      '  border-radius: 6px;',
      '  background: #fff;',
      '  color: #374151;',
      '  font-size: 0.9rem;',
      '  cursor: pointer;',
      '  transition: all 0.15s;',
      '  white-space: nowrap;',
      '}',
      '.bw-tab:hover { border-color: #9ca3af; background: #f9fafb; }',
      '.bw-tab.is-active {',
      '  background: #2563eb;',
      '  color: #fff;',
      '  border-color: #2563eb;',
      '}',

      /* Table wrapper for horizontal scroll */
      '.bw-table-wrap {',
      '  overflow-x: auto;',
      '  -webkit-overflow-scrolling: touch;',
      '  border: 1px solid #e5e7eb;',
      '  border-radius: 8px;',
      '  background: #fff;',
      '}',

      /* Table */
      '.bw-table {',
      '  width: 100%;',
      '  min-width: 480px;',
      '  border-collapse: separate;',
      '  border-spacing: 0;',
      '  font-size: 0.88rem;',
      '}',

      /* Table head */
      '.bw-table thead th {',
      '  padding: 10px 14px;',
      '  text-align: center;',
      '  font-weight: 600;',
      '  color: #374151;',
      '  background: #f9fafb;',
      '  border-bottom: 2px solid #e5e7eb;',
      '  white-space: nowrap;',
      '  vertical-align: bottom;',
      '}',

      /* Sticky first column header */
      '.bw-table thead th:first-child {',
      '  position: sticky;',
      '  left: 0;',
      '  z-index: 3;',
      '  text-align: left;',
      '  background: #f9fafb;',
      '  min-width: 160px;',
      '  border-right: 2px solid #e5e7eb;',
      '}',

      /* Column header date & institution */
      '.bw-col-date { display: block; font-size: 0.85rem; color: #111827; }',
      '.bw-col-inst { display: block; font-size: 0.75rem; color: #6b7280; font-weight: 400; margin-top: 2px; }',
      '.bw-col-link {',
      '  display: inline-block;',
      '  font-size: 0.72rem;',
      '  color: #2563eb;',
      '  text-decoration: none;',
      '  cursor: pointer;',
      '  font-weight: 400;',
      '  margin-top: 3px;',
      '}',
      '.bw-col-link:hover { text-decoration: underline; }',

      /* Table body */
      '.bw-table tbody td {',
      '  padding: 9px 14px;',
      '  text-align: center;',
      '  border-bottom: 1px solid #f0f0f0;',
      '  vertical-align: middle;',
      '  position: relative;',
      '  white-space: nowrap;',
      '}',

      /* Sticky first column body cells */
      '.bw-table tbody td:first-child {',
      '  position: sticky;',
      '  left: 0;',
      '  z-index: 2;',
      '  background: #fff;',
      '  text-align: left;',
      '  font-weight: 500;',
      '  color: #111827;',
      '  border-right: 2px solid #e5e7eb;',
      '  min-width: 160px;',
      '}',

      /* Alternating row background */
      '.bw-table tbody tr:nth-child(even) td { background-color: #fafbfc; }',
      '.bw-table tbody tr:nth-child(even) td:first-child { background-color: #fafbfc; }',

      /* Cell value containers */
      '.bw-cell-value { display: inline-flex; align-items: center; gap: 5px; }',
      '.bw-cell-null { color: #d1d5db; }',

      /* Status dot for normal values */
      '.bw-dot-normal {',
      '  display: inline-block;',
      '  width: 7px;',
      '  height: 7px;',
      '  border-radius: 50%;',
      '  background: #22c55e;',
      '  flex-shrink: 0;',
      '}',

      /* Reference range small text below value */
      '.bw-ref-range {',
      '  display: block;',
      '  font-size: 0.7rem;',
      '  color: #9ca3af;',
      '  margin-top: 2px;',
      '}',

      /* Indicator name sub-line (unit) */
      '.bw-item-unit {',
      '  display: block;',
      '  font-size: 0.72rem;',
      '  color: #9ca3af;',
      '  font-weight: 400;',
      '  margin-top: 1px;',
      '}',

      /* Tooltip */
      '.bw-tooltip {',
      '  position: absolute;',
      '  bottom: calc(100% + 6px);',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  background: #1f2937;',
      '  color: #fff;',
      '  padding: 5px 10px;',
      '  border-radius: 5px;',
      '  font-size: 0.75rem;',
      '  white-space: nowrap;',
      '  pointer-events: none;',
      '  z-index: 10;',
      '  opacity: 0;',
      '  transition: opacity 0.15s;',
      '}',
      '.bw-tooltip::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 100%;',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  border: 5px solid transparent;',
      '  border-top-color: #1f2937;',
      '}',
      '.bw-cell:hover .bw-tooltip { opacity: 1; }',
      '.bw-cell { position: relative; }',

      /* Empty state */
      '.bw-empty {',
      '  text-align: center;',
      '  padding: 48px 20px;',
      '  color: #9ca3af;',
      '  font-size: 0.95rem;',
      '}',

      /* Footer note */
      '.bw-footer-note {',
      '  margin-top: 24px;',
      '  padding: 12px 16px;',
      '  background: #f9fafb;',
      '  border-radius: 6px;',
      '  font-size: 0.82rem;',
      '  color: #6b7280;',
      '  line-height: 1.5;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ======================================================================
   *  Utility Helpers
   * ====================================================================== */

  /**
   * Minimal HTML escaping.
   */
  function esc(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Format a date string as "MM/DD" or "YYYY/MM/DD" for column headers.
   */
  function formatDateForColumn(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var y = parts[0];
    var m = parts[1] ? parts[1].padStart(2, '0') : null;
    var d = parts[2] ? parts[2].padStart(2, '0') : null;
    if (y && m && d) return y + '/' + m + '/' + d;
    if (y && m) return y + '/' + m;
    return dateStr;
  }

  /**
   * Parse a date string into a numeric value for sorting.
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
   * Find a report object by its id from AppData.reportsIndex.
   * Returns the report object or null.
   */
  function findReport(reportId) {
    if (!reportId || !window.AppData || !window.AppData.reportsIndex) return null;
    var reports = window.AppData.reportsIndex.reports || [];
    for (var i = 0; i < reports.length; i++) {
      if (reports[i].id === reportId) return reports[i];
    }
    return null;
  }

  /* ======================================================================
   *  Data Processing
   * ====================================================================== */

  /**
   * Collect all unique date columns for a category, sorted oldest to newest.
   * Each column entry: { date, institution, reportId }
   *
   * When the same date appears from multiple institutions (or with different
   * reportIds), each gets its own column.
   *
   * @param {Array} items - Category items array
   * @returns {Array} Sorted column descriptors
   */
  function collectDateColumns(items) {
    var columnMap = {}; // key = "date|reportId"

    items.forEach(function (item) {
      (item.results || []).forEach(function (r) {
        var key = (r.date || '') + '|' + (r.reportId || '');
        if (!columnMap[key]) {
          columnMap[key] = {
            date: r.date || '',
            institution: r.institution || '',
            reportId: r.reportId || ''
          };
        }
      });
    });

    var columns = Object.keys(columnMap).map(function (k) { return columnMap[k]; });

    // Sort oldest to newest
    columns.sort(function (a, b) {
      return parseDateValue(a.date) - parseDateValue(b.date);
    });

    return columns;
  }

  /**
   * For a given item and column, find the matching result entry.
   * @param {object} item   - Lab item object
   * @param {object} column - Column descriptor { date, reportId }
   * @returns {object|null} The matching result, or null
   */
  function findResult(item, column) {
    var results = item.results || [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.date === column.date && r.reportId === column.reportId) {
        return r;
      }
    }
    return null;
  }

  /**
   * Determine whether reference ranges vary across institutions for a given item.
   * Returns true if more than one distinct non-empty refRange exists.
   */
  function hasMultipleRefRanges(item) {
    var seen = {};
    var count = 0;
    (item.results || []).forEach(function (r) {
      if (r.refRange && !seen[r.refRange]) {
        seen[r.refRange] = true;
        count++;
      }
    });
    return count > 1;
  }

  /* ======================================================================
   *  DOM Building
   * ====================================================================== */

  /**
   * Build the page header.
   */
  function buildHeader() {
    var div = document.createElement('div');
    div.className = 'bw-header';
    div.innerHTML =
      '<h2>' + esc('血常规 / 生化检查') + '</h2>' +
      '<p>' + esc('对比不同日期的检验指标，追踪数值变化趋势。颜色标注表示超出或低于参考范围。') + '</p>';
    return div;
  }

  /**
   * Build category tab buttons.
   * @param {Array}  categories     - Category objects
   * @param {number} activeIndex    - Currently active tab index
   * @param {function} onTabClick   - Callback when a tab is clicked
   * @returns {HTMLElement}
   */
  function buildTabs(categories, activeIndex, onTabClick) {
    var wrap = document.createElement('div');
    wrap.className = 'bw-tabs';

    categories.forEach(function (cat, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bw-tab' + (idx === activeIndex ? ' is-active' : '');
      btn.textContent = cat.name;
      btn.addEventListener('click', function () {
        onTabClick(idx);
      });
      wrap.appendChild(btn);
    });

    return wrap;
  }

  /**
   * Build the comparison table for a category.
   * @param {object} category - Category object with .name and .items
   * @returns {HTMLElement}
   */
  function buildTable(category) {
    var items = category.items || [];

    // Empty state
    if (items.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'bw-empty';
      emptyDiv.textContent = '暂无数据，待从报告中提取';
      return emptyDiv;
    }

    var columns = collectDateColumns(items);

    // If somehow no date columns exist, also show empty state
    if (columns.length === 0) {
      var emptyDiv2 = document.createElement('div');
      emptyDiv2.className = 'bw-empty';
      emptyDiv2.textContent = '暂无数据，待从报告中提取';
      return emptyDiv2;
    }

    var tableWrap = document.createElement('div');
    tableWrap.className = 'bw-table-wrap';

    var table = document.createElement('table');
    table.className = 'bw-table';

    // --- THEAD ---
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    // First column header: indicator name
    var thIndicator = document.createElement('th');
    thIndicator.textContent = '检查指标';
    headerRow.appendChild(thIndicator);

    // Date columns
    columns.forEach(function (col) {
      var th = document.createElement('th');

      // Date line
      var dateSpan = document.createElement('span');
      dateSpan.className = 'bw-col-date';
      dateSpan.textContent = formatDateForColumn(col.date);
      th.appendChild(dateSpan);

      // Institution line
      if (col.institution) {
        var instSpan = document.createElement('span');
        instSpan.className = 'bw-col-inst';
        instSpan.textContent = col.institution;
        th.appendChild(instSpan);
      }

      // "查看原文" link
      var report = findReport(col.reportId);
      if (report && report.filePath) {
        var link = document.createElement('a');
        link.className = 'bw-col-link';
        link.href = 'javascript:void(0)';
        link.textContent = '查看原文';
        link.addEventListener('click', (function (rpt) {
          return function (e) {
            e.preventDefault();
            if (window.ReportViewer && typeof window.ReportViewer.showPdfModal === 'function') {
              window.ReportViewer.showPdfModal(rpt.filePath, rpt.title || '报告');
            } else {
              console.warn('[BloodWork] ReportViewer.showPdfModal is not available.');
            }
          };
        })(report));
        th.appendChild(link);
      }

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // --- TBODY ---
    var tbody = document.createElement('tbody');

    items.forEach(function (item) {
      var tr = document.createElement('tr');
      var multiRef = hasMultipleRefRanges(item);

      // First cell: indicator name + unit
      var tdName = document.createElement('td');
      var nameText = document.createTextNode(item.name || '');
      tdName.appendChild(nameText);
      if (item.unit) {
        var unitSpan = document.createElement('span');
        unitSpan.className = 'bw-item-unit';
        unitSpan.textContent = item.unit;
        tdName.appendChild(unitSpan);
      }
      tr.appendChild(tdName);

      // Value cells for each date column
      columns.forEach(function (col) {
        var td = document.createElement('td');
        td.className = 'bw-cell';
        var result = findResult(item, col);

        if (!result || result.value === null || result.value === undefined) {
          // Null / missing value
          var nullSpan = document.createElement('span');
          nullSpan.className = 'bw-cell-null';
          nullSpan.textContent = '\u2014'; // em dash
          td.appendChild(nullSpan);
        } else {
          // Apply status styling
          var status = result.status || 'normal';
          var styles = STATUS_STYLES[status] || STATUS_STYLES.normal;

          if (styles.bg && styles.bg !== 'transparent') {
            td.style.backgroundColor = styles.bg;
          }

          var valueWrap = document.createElement('span');
          valueWrap.className = 'bw-cell-value';

          // Green dot for normal
          if (status === 'normal') {
            var dot = document.createElement('span');
            dot.className = 'bw-dot-normal';
            valueWrap.appendChild(dot);
          }

          var valueText = document.createElement('span');
          valueText.textContent = result.value;
          if (styles.text && styles.text !== 'inherit') {
            valueText.style.color = styles.text;
            valueText.style.fontWeight = '600';
          }
          valueWrap.appendChild(valueText);

          td.appendChild(valueWrap);

          // Show ref range below value when institutions differ
          if (multiRef && result.refRange) {
            var refSpan = document.createElement('span');
            refSpan.className = 'bw-ref-range';
            refSpan.textContent = '(' + esc(result.refRange) + ')';
            td.appendChild(refSpan);
          }

          // Tooltip: always show reference range on hover
          if (result.refRange) {
            var tooltip = document.createElement('span');
            tooltip.className = 'bw-tooltip';
            tooltip.textContent = '参考范围: ' + result.refRange;
            td.appendChild(tooltip);
          }
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    return tableWrap;
  }

  /**
   * Build the footer note element.
   */
  function buildFooterNote() {
    var div = document.createElement('div');
    div.className = 'bw-footer-note';
    div.textContent = '数据持续更新中，如需查看原始报告请点击表头的「查看原文」链接。';
    return div;
  }

  /* ======================================================================
   *  Main Render
   * ====================================================================== */

  /**
   * Render the blood work comparison view into #content.
   * Reads data from window.AppData.bloodWork.
   */
  function render() {
    injectStyles();

    var contentEl = document.getElementById('content');
    if (!contentEl) {
      console.warn('[BloodWork] #content element not found.');
      return;
    }

    var data = window.AppData && window.AppData.bloodWork;
    var categories = (data && data.categories) || [];

    // Track active tab index
    var activeIndex = 0;

    /**
     * Full re-render of the blood work view for the given active tab.
     * @param {number} tabIdx
     */
    function renderView(tabIdx) {
      activeIndex = tabIdx;
      contentEl.innerHTML = '';

      // Header
      contentEl.appendChild(buildHeader());

      // Tabs
      if (categories.length > 0) {
        contentEl.appendChild(buildTabs(categories, activeIndex, function (idx) {
          renderView(idx);
        }));
      }

      // Table (or empty state if no categories at all)
      if (categories.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'bw-empty';
        emptyDiv.textContent = '暂无数据，待从报告中提取';
        contentEl.appendChild(emptyDiv);
      } else {
        var activeCategory = categories[activeIndex];
        contentEl.appendChild(buildTable(activeCategory));
      }

      // Footer note
      contentEl.appendChild(buildFooterNote());
    }

    // Initial render
    renderView(0);
  }

  /* ======================================================================
   *  Public API
   * ====================================================================== */

  window.BloodWork = {
    render: render
  };

})();
