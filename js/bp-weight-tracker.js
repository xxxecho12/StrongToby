/**
 * bp-weight-tracker.js
 * Blood Pressure & Weight Tracking page for StrongToby pet medical records.
 * Renders charts (Chart.js) and tables into #content.
 *
 * Data sources:
 *   window.AppData.bloodPressure  - { records: [...] }
 *   window.AppData.weight         - { records: [...] }
 *   window.AppData.medications    - { dosageChanges: [...] }
 *
 * Exports: window.BPWeightTracker = { render() }
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Parse a record's date + time into a JS Date (local time).
   * Handles the edge case where time is "00:xx" which may actually belong
   * to the same calendar day (late night / early morning).
   */
  function parseDateTime(date, time) {
    return new Date(date + 'T' + time + ':00');
  }

  /** Format a Date to "MM-DD HH:mm" for axis tick labels. */
  function shortLabel(dt) {
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var dd = String(dt.getDate()).padStart(2, '0');
    var hh = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return mm + '-' + dd + ' ' + hh + ':' + mi;
  }

  /** Return the number of days between two dates (ignoring time). */
  function daysBetween(a, b) {
    var msPerDay = 86400000;
    var utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.abs(utcB - utcA) / msPerDay;
  }

  /* ------------------------------------------------------------------ */
  /*  Build the DOM skeleton                                             */
  /* ------------------------------------------------------------------ */

  function buildSkeleton() {
    var container = document.getElementById('content');
    container.innerHTML = '';

    var html = '';

    // Tab bar
    html += '<div class="bpw-tabs">';
    html += '  <button class="bpw-tab bpw-tab--active" data-tab="bp">血压</button>';
    html += '  <button class="bpw-tab" data-tab="weight">体重</button>';
    html += '</div>';

    // Blood Pressure section
    html += '<div id="bpw-section-bp" class="bpw-section">';
    html += '  <div class="bpw-filter-bar">';
    html += '    <button class="bpw-filter bpw-filter--active" data-range="all">全部</button>';
    html += '    <button class="bpw-filter" data-range="7">近7天</button>';
    html += '    <button class="bpw-filter" data-range="3">近3天</button>';
    html += '  </div>';
    html += '  <div class="bpw-chart-wrap"><canvas id="bpw-bp-chart"></canvas></div>';
    html += '  <div class="bpw-table-wrap" id="bpw-bp-table-wrap"></div>';
    html += '</div>';

    // Weight section
    html += '<div id="bpw-section-weight" class="bpw-section" style="display:none;">';
    html += '  <div class="bpw-chart-wrap"><canvas id="bpw-weight-chart"></canvas></div>';
    html += '  <div class="bpw-table-wrap" id="bpw-weight-table-wrap"></div>';
    html += '</div>';

    container.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /*  Inject scoped CSS                                                  */
  /* ------------------------------------------------------------------ */

  function injectStyles() {
    if (document.getElementById('bpw-styles')) return;

    var css = '';

    /* Tabs */
    css += '.bpw-tabs { display:flex; gap:0; margin-bottom:20px; border-bottom:2px solid #e0e0e0; }';
    css += '.bpw-tab { padding:10px 28px; border:none; background:none; font-size:15px; font-weight:600; color:#888; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-2px; transition:all .2s; }';
    css += '.bpw-tab:hover { color:#555; }';
    css += '.bpw-tab--active { color:#2c3e50; border-bottom-color:#3498db; }';

    /* Filter bar */
    css += '.bpw-filter-bar { display:flex; gap:8px; margin-bottom:16px; }';
    css += '.bpw-filter { padding:5px 16px; border:1px solid #ccc; border-radius:16px; background:#fff; font-size:13px; cursor:pointer; transition:all .15s; }';
    css += '.bpw-filter:hover { border-color:#3498db; color:#3498db; }';
    css += '.bpw-filter--active { background:#3498db; color:#fff; border-color:#3498db; }';

    /* Chart wrapper */
    css += '.bpw-chart-wrap { position:relative; width:100%; max-width:900px; margin-bottom:28px; }';

    /* Table wrapper */
    css += '.bpw-table-wrap { overflow-x:auto; margin-bottom:32px; }';

    /* Tables */
    css += '.bpw-table { width:100%; border-collapse:collapse; font-size:13px; }';
    css += '.bpw-table th { background:#f5f6fa; padding:10px 12px; text-align:left; font-weight:600; color:#555; border-bottom:2px solid #ddd; white-space:nowrap; }';
    css += '.bpw-table td { padding:8px 12px; border-bottom:1px solid #eee; vertical-align:middle; }';
    css += '.bpw-table tr:hover { background:#fafbfd; }';

    /* Same-day grouping: border on the first row of a new day */
    css += '.bpw-table tr.bpw-day-start td { border-top:2px solid #d0d5dd; }';

    /* Systolic highlights */
    css += '.bpw-sys-orange { color:#e67e22; font-weight:700; }';
    css += '.bpw-sys-red { color:#e74c3c; font-weight:700; }';

    /* Section */
    css += '.bpw-section { animation: bpw-fadeIn .25s ease; }';
    css += '@keyframes bpw-fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }';

    var style = document.createElement('style');
    style.id = 'bpw-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ */
  /*  Tab switching logic                                                */
  /* ------------------------------------------------------------------ */

  function initTabs() {
    var tabs = document.querySelectorAll('.bpw-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('bpw-tab--active'); });
        tab.classList.add('bpw-tab--active');

        var target = tab.getAttribute('data-tab');
        document.getElementById('bpw-section-bp').style.display = target === 'bp' ? '' : 'none';
        document.getElementById('bpw-section-weight').style.display = target === 'weight' ? '' : 'none';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Blood Pressure Chart                                               */
  /* ------------------------------------------------------------------ */

  var bpChartInstance = null;

  function buildBPChart(records, dosageChanges, rangeDays) {
    // Sort ascending by datetime for plotting
    var sorted = records.slice().sort(function (a, b) {
      return parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time);
    });

    // Apply range filter
    if (rangeDays !== 'all') {
      var now = new Date();
      var cutoff = new Date(now.getTime() - rangeDays * 86400000);
      sorted = sorted.filter(function (r) {
        return parseDateTime(r.date, r.time) >= cutoff;
      });
    }

    // Build data arrays
    var labels = [];
    var systolicData = [];
    var diastolicData = [];
    var pointBgSystolic = [];
    var pointBgDiastolic = [];
    var pointBorderSystolic = [];
    var pointBorderDiastolic = [];
    var pointRadiusSystolic = [];
    var pointRadiusDiastolic = [];
    var tooltipMeta = [];

    sorted.forEach(function (r) {
      var dt = parseDateTime(r.date, r.time);
      labels.push(dt);
      systolicData.push(r.systolic);
      diastolicData.push(r.diastolic);

      // Marker styling based on medicated status
      var isMedicated = r.medicated;
      if (isMedicated === true) {
        // Filled circle
        pointBgSystolic.push('#E74C3C');
        pointBgDiastolic.push('#3498DB');
        pointBorderSystolic.push('#E74C3C');
        pointBorderDiastolic.push('#3498DB');
        pointRadiusSystolic.push(5);
        pointRadiusDiastolic.push(5);
      } else if (isMedicated === false) {
        // Hollow circle
        pointBgSystolic.push('#fff');
        pointBgDiastolic.push('#fff');
        pointBorderSystolic.push('#E74C3C');
        pointBorderDiastolic.push('#3498DB');
        pointRadiusSystolic.push(5);
        pointRadiusDiastolic.push(5);
      } else {
        // Unknown: small dot
        pointBgSystolic.push('#E74C3C');
        pointBgDiastolic.push('#3498DB');
        pointBorderSystolic.push('#E74C3C');
        pointBorderDiastolic.push('#3498DB');
        pointRadiusSystolic.push(3);
        pointRadiusDiastolic.push(3);
      }

      tooltipMeta.push(r);
    });

    // Build annotation objects for dosage changes (only amlodipine)
    var annotations = {};

    // Hypertension threshold line
    annotations['hypertensionLine'] = {
      type: 'line',
      yMin: 140,
      yMax: 140,
      borderColor: 'rgba(231, 76, 60, 0.45)',
      borderWidth: 1.5,
      borderDash: [6, 4],
      label: {
        display: true,
        content: '140 mmHg (高血压阈值)',
        position: 'start',
        backgroundColor: 'rgba(231, 76, 60, 0.75)',
        color: '#fff',
        font: { size: 11 },
        padding: 4
      }
    };

    // Dosage change vertical lines (only for amlodipine)
    var amlodipineChanges = (dosageChanges || []).filter(function (dc) {
      return dc.medication === '氨氯地平';
    });

    amlodipineChanges.forEach(function (dc, i) {
      var dcDate = new Date(dc.date + 'T00:00:00');

      // Only include if within the current visible range
      if (rangeDays !== 'all') {
        var now = new Date();
        var cutoff = new Date(now.getTime() - rangeDays * 86400000);
        if (dcDate < cutoff) return;
      }

      annotations['dosage' + i] = {
        type: 'line',
        xMin: dcDate.getTime(),
        xMax: dcDate.getTime(),
        borderColor: 'rgba(155, 89, 182, 0.6)',
        borderWidth: 1.5,
        borderDash: [5, 3],
        label: {
          display: true,
          content: dc.to,
          position: 'start',
          backgroundColor: 'rgba(155, 89, 182, 0.8)',
          color: '#fff',
          font: { size: 10 },
          padding: 3,
          rotation: -90,
          yAdjust: -10
        }
      };
    });

    // Destroy previous chart if exists
    if (bpChartInstance) {
      bpChartInstance.destroy();
      bpChartInstance = null;
    }

    var ctx = document.getElementById('bpw-bp-chart').getContext('2d');

    bpChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '收缩压 (mmHg)',
            data: systolicData,
            borderColor: '#E74C3C',
            backgroundColor: 'rgba(231,76,60,0.08)',
            pointBackgroundColor: pointBgSystolic,
            pointBorderColor: pointBorderSystolic,
            pointRadius: pointRadiusSystolic,
            pointHoverRadius: 7,
            borderWidth: 2,
            tension: 0.25,
            fill: false
          },
          {
            label: '舒张压 (mmHg)',
            data: diastolicData,
            borderColor: '#3498DB',
            backgroundColor: 'rgba(52,152,219,0.08)',
            pointBackgroundColor: pointBgDiastolic,
            pointBorderColor: pointBorderDiastolic,
            pointRadius: pointRadiusDiastolic,
            pointHoverRadius: 7,
            borderWidth: 2,
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'yyyy-MM-dd HH:mm',
              displayFormats: {
                hour: 'MM-dd HH:mm',
                day: 'MM-dd'
              }
            },
            title: {
              display: true,
              text: '日期时间'
            },
            ticks: {
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            title: {
              display: true,
              text: 'mmHg'
            },
            suggestedMin: 50,
            suggestedMax: 200
          }
        },
        plugins: {
          annotation: {
            annotations: annotations
          },
          tooltip: {
            callbacks: {
              title: function (items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                var r = tooltipMeta[idx];
                return r.date + ' ' + r.time + ' (' + (r.period || '') + ')';
              },
              afterBody: function (items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                var r = tooltipMeta[idx];
                var lines = [];
                lines.push('心率: ' + r.heartRate + ' bpm');
                if (r.medicated === true) {
                  lines.push('服药: 是');
                } else if (r.medicated === false) {
                  lines.push('服药: 否');
                } else {
                  lines.push('服药: --');
                }
                if (r.note) {
                  lines.push('备注: ' + r.note);
                }
                return lines;
              }
            }
          },
          legend: {
            labels: {
              usePointStyle: true,
              padding: 16
            }
          }
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Blood Pressure Table                                               */
  /* ------------------------------------------------------------------ */

  function buildBPTable(records) {
    // Sort descending by date + time
    var sorted = records.slice().sort(function (a, b) {
      return parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time);
    });

    var html = '<table class="bpw-table">';
    html += '<thead><tr>';
    html += '<th>日期</th><th>时间</th><th>时间段</th><th>服药</th>';
    html += '<th>收缩压</th><th>舒张压</th><th>心率</th><th>备注</th>';
    html += '</tr></thead><tbody>';

    var lastDate = null;

    sorted.forEach(function (r) {
      var isNewDay = r.date !== lastDate;
      var trClass = isNewDay ? ' class="bpw-day-start"' : '';

      html += '<tr' + trClass + '>';

      // Date cell: only show on first row of a new day
      if (isNewDay) {
        html += '<td><strong>' + r.date + '</strong></td>';
        lastDate = r.date;
      } else {
        html += '<td></td>';
      }

      html += '<td>' + r.time + '</td>';
      html += '<td>' + (r.period || '') + '</td>';

      // Medicated
      var medLabel = r.medicated === true ? '是' : r.medicated === false ? '否' : '—';
      html += '<td>' + medLabel + '</td>';

      // Systolic with color coding
      var sysClass = '';
      if (r.systolic >= 180) {
        sysClass = ' class="bpw-sys-red"';
      } else if (r.systolic >= 160) {
        sysClass = ' class="bpw-sys-orange"';
      }
      html += '<td' + sysClass + '>' + r.systolic + '</td>';
      html += '<td>' + r.diastolic + '</td>';
      html += '<td>' + r.heartRate + '</td>';
      html += '<td>' + (r.note || '') + '</td>';

      html += '</tr>';
    });

    html += '</tbody></table>';

    document.getElementById('bpw-bp-table-wrap').innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /*  BP Range Filter                                                    */
  /* ------------------------------------------------------------------ */

  function initBPFilters(records, dosageChanges) {
    var buttons = document.querySelectorAll('.bpw-filter');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('bpw-filter--active'); });
        btn.classList.add('bpw-filter--active');

        var range = btn.getAttribute('data-range');
        var days = range === 'all' ? 'all' : parseInt(range, 10);
        buildBPChart(records, dosageChanges, days);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Weight Chart                                                       */
  /* ------------------------------------------------------------------ */

  var weightChartInstance = null;

  function buildWeightChart(records) {
    var sorted = records.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

    var labels = sorted.map(function (r) { return r.date; });
    var data = sorted.map(function (r) {
      return r.unit === 'kg' ? r.weight : r.weight; // assume kg
    });

    if (weightChartInstance) {
      weightChartInstance.destroy();
      weightChartInstance = null;
    }

    var ctx = document.getElementById('bpw-weight-chart').getContext('2d');

    weightChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '体重 (kg)',
          data: data,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.1)',
          pointBackgroundColor: '#27ae60',
          pointBorderColor: '#27ae60',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            title: {
              display: true,
              text: '日期'
            }
          },
          y: {
            title: {
              display: true,
              text: 'kg'
            },
            suggestedMin: 0
          }
        },
        plugins: {
          legend: {
            labels: { usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              afterBody: function (items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                var r = sorted[idx];
                if (r.note) return '备注: ' + r.note;
                return '';
              }
            }
          }
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Weight Table                                                       */
  /* ------------------------------------------------------------------ */

  function buildWeightTable(records) {
    var sorted = records.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var html = '<table class="bpw-table">';
    html += '<thead><tr><th>日期</th><th>体重 (kg)</th><th>备注</th></tr></thead><tbody>';

    sorted.forEach(function (r) {
      var wt = r.unit === 'kg' ? r.weight : r.weight;
      html += '<tr>';
      html += '<td>' + r.date + '</td>';
      html += '<td>' + wt + '</td>';
      html += '<td>' + (r.note || '') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';

    document.getElementById('bpw-weight-table-wrap').innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /*  Public render()                                                    */
  /* ------------------------------------------------------------------ */

  function render() {
    var bpData = (window.AppData && window.AppData.bloodPressure) || { records: [] };
    var weightData = (window.AppData && window.AppData.weight) || { records: [] };
    var medData = (window.AppData && window.AppData.medications) || { dosageChanges: [] };

    var bpRecords = bpData.records || [];
    var weightRecords = weightData.records || [];
    var dosageChanges = medData.dosageChanges || [];

    injectStyles();
    buildSkeleton();
    initTabs();

    // Blood Pressure
    buildBPChart(bpRecords, dosageChanges, 'all');
    buildBPTable(bpRecords);
    initBPFilters(bpRecords, dosageChanges);

    // Weight
    buildWeightChart(weightRecords);
    buildWeightTable(weightRecords);
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */

  window.BPWeightTracker = { render: render };

})();
