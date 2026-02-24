/**
 * StrongToby - Pet Medical Records SPA
 * Core routing, data loading, and navigation module
 */
(function () {
  'use strict';

  /* ======================================================================
   *  Constants
   * ====================================================================== */

  var DATA_FILES = [
    'basic-info.json',
    'reports-index.json',
    'blood-pressure.json',
    'weight.json',
    'medications.json',
    'blood-work.json'
  ];

  var DATA_KEYS = {
    'basic-info.json': 'basicInfo',
    'reports-index.json': 'reportsIndex',
    'blood-pressure.json': 'bloodPressure',
    'weight.json': 'weight',
    'medications.json': 'medications',
    'blood-work.json': 'bloodWork'
  };

  var DEFAULT_ROUTE = 'overview';

  /** Category display names and ordering for the sidebar */
  var NAV_SECTIONS = [
    { key: 'overview',     label: '概览',         icon: 'overview',   type: 'static', hash: '#overview' },
    { key: 'imaging',      label: '影像报告',     icon: 'imaging',    type: 'report-group', subcategories: [
      { key: 'ct',         label: 'CT' },
      { key: 'ultrasound', label: 'B超' },
      { key: 'xray',       label: 'X光' }
    ]},
    { key: 'pathology',    label: '病理报告',     icon: 'pathology',  type: 'report-group', subcategories: [
      { key: 'biopsy',    label: '活检 / 病理' },
      { key: 'cytology',  label: '细胞学' },
      { key: 'culture',   label: '培养 / 药敏' },
      { key: 'photos',    label: '术中影像' }
    ]},
    { key: 'bloodwork',    label: '血常规/生化',  icon: 'bloodwork',  type: 'static', hash: '#bloodwork' },
    { key: 'bp',           label: '血压/体重',    icon: 'bp',         type: 'static', hash: '#bp' },
    { key: 'medications',  label: '服药记录',     icon: 'medications',type: 'static', hash: '#medications' },
    { key: 'archive',      label: '过往体检',     icon: 'archive',    type: 'report-group', subcategories: [] }
  ];

  /* ======================================================================
   *  Internal state
   * ====================================================================== */

  var _sidebarOpen = false;

  /* ======================================================================
   *  Utility Functions
   * ====================================================================== */

  /**
   * Format an ISO-ish date string into a Chinese-formatted date.
   * Handles both "2026-02-12" and partial dates like "2025-09".
   * @param {string} dateStr
   * @returns {string}  e.g. "2026年02月12日" or "2025年09月"
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var y = parts[0];
    var m = parts[1] ? parts[1].padStart(2, '0') : null;
    var d = parts[2] ? parts[2].padStart(2, '0') : null;

    if (y && m && d) return y + '年' + m + '月' + d + '日';
    if (y && m)       return y + '年' + m + '月';
    return dateStr;
  }

  /**
   * Format an ISO date string as MM/DD for nav items.
   * Falls back to the original string when day is not available.
   * @param {string} dateStr
   * @returns {string}  e.g. "02/12"
   */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var m = parts[1] ? parts[1].padStart(2, '0') : null;
    var d = parts[2] ? parts[2].padStart(2, '0') : null;
    if (m && d) return m + '/' + d;
    if (m)      return parts[0] + '/' + m;
    return dateStr;
  }

  /**
   * Parse the current hash into its route segments.
   * @returns {{ section: string, subsection: string|null, id: string|null }}
   */
  function parseHash() {
    var hash = window.location.hash.replace(/^#\/?/, '') || DEFAULT_ROUTE;
    var parts = hash.split('/');
    return {
      section:    parts[0] || DEFAULT_ROUTE,
      subsection: parts[1] || null,
      id:         parts[2] || null
    };
  }

  /**
   * Find a report object by its id.
   * @param {string} id
   * @returns {object|null}
   */
  function getReport(id) {
    if (!window.AppData || !window.AppData.reportsIndex) return null;
    var reports = window.AppData.reportsIndex.reports || [];
    for (var i = 0; i < reports.length; i++) {
      if (reports[i].id === id) return reports[i];
    }
    return null;
  }

  /**
   * Navigate to a hash route programmatically.
   * @param {string} hash - e.g. "#overview" or "overview" (leading # is optional)
   */
  function navigateTo(hash) {
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    window.location.hash = hash;
  }

  /**
   * Return the main #content element.
   * @returns {HTMLElement}
   */
  function getContentEl() {
    return document.getElementById('content');
  }

  /* ======================================================================
   *  Data Loading
   * ====================================================================== */

  /**
   * Fetch a single JSON file from the data/ directory.
   * @param {string} filename
   * @returns {Promise<object>}
   */
  function fetchJSON(filename) {
    return fetch('data/' + filename).then(function (res) {
      if (!res.ok) throw new Error('Failed to load ' + filename + ' (' + res.status + ')');
      return res.json();
    });
  }

  /**
   * Load all data files in parallel and populate window.AppData.
   * @returns {Promise<void>}
   */
  function loadAllData() {
    window.AppData = {};

    var promises = DATA_FILES.map(function (file) {
      return fetchJSON(file).then(function (data) {
        var key = DATA_KEYS[file];
        window.AppData[key] = data;
      }).catch(function (err) {
        console.error('[StrongToby] Error loading ' + file + ':', err);
        window.AppData[DATA_KEYS[file]] = null;
      });
    });

    return Promise.all(promises);
  }

  /* ======================================================================
   *  Navigation Generation
   * ====================================================================== */

  /**
   * Group reports by category and subcategory from reports-index.json.
   * Reports within each group are sorted by date descending (newest first).
   * @returns {object}  { imaging: { ct: [...], ultrasound: [...] }, pathology: {...}, archive: [...] }
   */
  function groupReports() {
    var reports = (window.AppData.reportsIndex && window.AppData.reportsIndex.reports) || [];
    var groups = {};

    reports.forEach(function (r) {
      var cat = r.category;
      if (!groups[cat]) groups[cat] = {};

      var sub = r.subcategory || '_default';
      if (!groups[cat][sub]) groups[cat][sub] = [];
      groups[cat][sub].push(r);
    });

    // Sort each group newest-first
    Object.keys(groups).forEach(function (cat) {
      Object.keys(groups[cat]).forEach(function (sub) {
        groups[cat][sub].sort(function (a, b) {
          return (b.date || '').localeCompare(a.date || '');
        });
      });
    });

    return groups;
  }

  /**
   * Build the sidebar <nav> HTML and insert it into #sidebar-nav.
   */
  function buildNavigation() {
    var navEl = document.getElementById('sidebarNav');
    if (!navEl) return;

    var grouped = groupReports();
    var html = '<ul class="nav-list">';

    NAV_SECTIONS.forEach(function (section) {
      if (section.type === 'static') {
        html += buildStaticNavItem(section);
      } else if (section.type === 'report-group') {
        html += buildReportGroupNavItem(section, grouped);
      }
    });

    html += '</ul>';
    navEl.innerHTML = html;

    // Attach click handlers after inserting HTML
    attachNavClickHandlers(navEl);
  }

  /** SVG icons for nav sections */
  var NAV_ICONS = {
    overview:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    imaging:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/></svg>',
    pathology:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v2H9zM12 10v4M10 12h4"/><rect x="5" y="4" width="14" height="18" rx="2"/></svg>',
    bloodwork:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C12 2 6 9 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12z"/></svg>',
    bp:          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    medications: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="7" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    archive:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>'
  };

  var CHEVRON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  /**
   * Build HTML for a static (non-expandable) nav item.
   */
  function buildStaticNavItem(section) {
    return '<li class="nav-item" data-section="' + section.key + '">' +
           '<a class="nav-link" href="' + section.hash + '">' +
           '<span class="nav-icon">' + (NAV_ICONS[section.icon] || '') + '</span>' +
           '<span class="nav-label">' + section.label + '</span>' +
           '</a></li>';
  }

  /**
   * Build HTML for a report-group nav item with collapsible subcategories.
   * Uses class names matching the CSS: nav-item--has-children, nav-subgroup, nav-subitem, etc.
   */
  function buildReportGroupNavItem(section, grouped) {
    var catReports = grouped[section.key] || {};
    var subcategories = section.subcategories;

    // For archive, there are no predefined subcategories -- list reports directly
    var isFlat = !subcategories || subcategories.length === 0;

    var html = '<li class="nav-item nav-item--has-children" data-section="' + section.key + '">';
    html += '<a class="nav-link nav-link--toggle" href="javascript:void(0)">' +
            '<span class="nav-icon">' + (NAV_ICONS[section.icon] || '') + '</span>' +
            '<span class="nav-label">' + section.label + '</span>' +
            '<span class="nav-chevron">' + CHEVRON_SVG + '</span>' +
            '</a>';

    html += '<ul class="nav-sublist">';

    if (isFlat) {
      // Flat list: all reports without subcategory grouping
      var allReports = [];
      Object.keys(catReports).forEach(function (sub) {
        allReports = allReports.concat(catReports[sub]);
      });
      allReports.sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
      allReports.forEach(function (report) {
        html += buildReportNavLeaf(section.key, null, report);
      });
    } else {
      subcategories.forEach(function (sub) {
        var reports = catReports[sub.key] || [];
        if (reports.length === 0) return;

        html += '<li class="nav-subgroup">';
        html += '<span class="nav-subgroup__label">' + sub.label + '</span>';
        html += '<ul class="nav-subgroup__items">';

        reports.forEach(function (report) {
          html += buildReportNavLeaf(section.key, sub.key, report);
        });

        html += '</ul></li>';
      });
    }

    html += '</ul></li>';
    return html;
  }

  /**
   * Build HTML for an individual report link in the nav tree.
   */
  function buildReportNavLeaf(category, subcategory, report) {
    var hash;
    if (category === 'archive') {
      hash = '#archive/' + report.id;
    } else if (subcategory) {
      hash = '#' + category + '/' + subcategory + '/' + report.id;
    } else {
      hash = '#' + category + '/' + report.id;
    }

    var dateLabel = formatDateShort(report.date);
    return '<li class="nav-subitem" data-report-id="' + report.id + '">' +
           '<a class="nav-sublink" href="' + hash + '">' +
           dateLabel + ' ' + escapeHtml(report.title) +
           '</a></li>';
  }

  /**
   * Minimal HTML escaping for inserting user-controlled text.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ======================================================================
   *  Navigation Click Handlers & Helpers
   * ====================================================================== */

  /**
   * Attach event delegation on the sidebar nav for expand/collapse and routing.
   */
  function attachNavClickHandlers(navEl) {
    navEl.addEventListener('click', function (e) {
      // Toggle expandable group items
      var toggle = e.target.closest('.nav-link--toggle');
      if (toggle) {
        e.preventDefault();
        var parentLi = toggle.parentElement;
        if (parentLi) {
          parentLi.classList.toggle('nav-item--expanded');
        }
        return;
      }

      // For regular nav links (sublinks, static links), close sidebar on mobile
      var link = e.target.closest('.nav-link, .nav-sublink');
      if (link && !link.classList.contains('nav-link--toggle')) {
        closeSidebarMobile();
      }
    });
  }

  /**
   * Highlight the active nav item based on the current hash.
   * Also expands parent sections when deep-linking.
   */
  function highlightActiveNav() {
    var navEl = document.getElementById('sidebarNav');
    if (!navEl) return;

    // Remove all active states
    var allActive = navEl.querySelectorAll('.nav-item--active, .nav-subitem--active');
    for (var i = 0; i < allActive.length; i++) {
      allActive[i].classList.remove('nav-item--active');
      allActive[i].classList.remove('nav-subitem--active');
    }

    var route = parseHash();
    var targetEl = null;

    if (route.id) {
      // Deep link to a specific report
      targetEl = navEl.querySelector('[data-report-id="' + route.id + '"]');
    } else if (route.subsection && !route.id) {
      // archive/report-id case: subsection is actually the report id
      targetEl = navEl.querySelector('[data-report-id="' + route.subsection + '"]');
    }

    if (!targetEl && route.section) {
      // Section-level link (overview, bloodwork, bp, medications)
      targetEl = navEl.querySelector('[data-section="' + route.section + '"]');
      // Only mark top-level static items, not expandable groups
      if (targetEl && targetEl.classList.contains('nav-item--has-children')) {
        targetEl = null;
      }
    }

    if (targetEl) {
      // Use the appropriate active class based on element type
      if (targetEl.classList.contains('nav-subitem')) {
        targetEl.classList.add('nav-subitem--active');
      } else {
        targetEl.classList.add('nav-item--active');
      }
      expandParentSections(targetEl);
    }
  }

  /**
   * Expand all ancestor nav groups for a given nav element so it is visible.
   */
  function expandParentSections(el) {
    var parent = el.parentElement;
    while (parent) {
      if (parent.classList && parent.classList.contains('nav-item--has-children')) {
        parent.classList.add('nav-item--expanded');
      }
      parent = parent.parentElement;
    }
  }

  /* ======================================================================
   *  Sidebar Mobile Toggle
   * ====================================================================== */

  function toggleSidebar() {
    _sidebarOpen = !_sidebarOpen;
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var hamburger = document.getElementById('hamburgerBtn');
    if (sidebar) sidebar.classList.toggle('open', _sidebarOpen);
    if (overlay) overlay.classList.toggle('active', _sidebarOpen);
    if (hamburger) hamburger.setAttribute('aria-expanded', String(_sidebarOpen));
  }

  function closeSidebarMobile() {
    _sidebarOpen = false;
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var hamburger = document.getElementById('hamburgerBtn');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  /**
   * Wire up the hamburger button for mobile sidebar toggling.
   */
  function initSidebarToggle() {
    var hamburger = document.getElementById('hamburgerBtn');
    if (hamburger) {
      hamburger.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidebar();
      });
    }

    // Close sidebar when clicking the overlay area
    var overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        closeSidebarMobile();
      });
    }

    // Desktop collapse button
    var collapseBtn = document.getElementById('collapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        document.body.classList.toggle('sidebar-collapsed');
      });
    }
  }

  /* ======================================================================
   *  Router
   * ====================================================================== */

  /**
   * Route to the correct view based on the current hash.
   */
  function handleRoute() {
    var route = parseHash();
    var section    = route.section;
    var subsection = route.subsection;
    var id         = route.id;

    highlightActiveNav();

    switch (section) {
      case 'overview':
        callRenderer('Overview', 'render');
        break;

      case 'imaging':
        // #imaging/ct/report-id  |  #imaging/ultrasound/report-id  |  #imaging/xray/report-id
        if (subsection && id) {
          callRenderer('ReportViewer', 'render', id);
        } else {
          // Fallback: show overview if no specific report
          callRenderer('Overview', 'render');
        }
        break;

      case 'pathology':
        // #pathology/biopsy/report-id  etc.
        if (subsection && id) {
          callRenderer('ReportViewer', 'render', id);
        } else {
          callRenderer('Overview', 'render');
        }
        break;

      case 'bloodwork':
        callRenderer('BloodWork', 'render');
        break;

      case 'bp':
        callRenderer('BPWeightTracker', 'render');
        break;

      case 'medications':
        callRenderer('Medication', 'render');
        break;

      case 'archive':
        // #archive/report-id
        if (subsection) {
          // subsection is actually the report-id for archive routes
          callRenderer('ReportViewer', 'render', subsection);
        } else {
          callRenderer('Overview', 'render');
        }
        break;

      default:
        // Unknown route -- go to overview
        navigateTo(DEFAULT_ROUTE);
        break;
    }
  }

  /**
   * Safely call a renderer module. Renders are expected on the window object
   * (e.g. window.Overview, window.ReportViewer, etc.).
   * If the module or method is not yet loaded, display a placeholder message.
   *
   * @param {string} moduleName
   * @param {string} method
   * @param {...*}   args
   */
  function callRenderer(moduleName, method) {
    var args = Array.prototype.slice.call(arguments, 2);
    var mod = window[moduleName];

    if (mod && typeof mod[method] === 'function') {
      mod[method].apply(mod, args);
    } else {
      // Module not loaded yet -- show a friendly placeholder
      var contentEl = getContentEl();
      if (contentEl) {
        contentEl.innerHTML =
          '<div class="placeholder-message">' +
          '<p>模块 <strong>' + escapeHtml(moduleName) + '</strong> 尚未加载。</p>' +
          '</div>';
      }
      console.warn('[StrongToby] Module "' + moduleName + '" or method "' + method + '" is not available.');
    }
  }

  /**
   * Initialize the hash-based router.
   */
  function initRouter() {
    window.addEventListener('hashchange', handleRoute);

    // Route to the current hash (or default)
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#' + DEFAULT_ROUTE;
    } else {
      handleRoute();
    }
  }

  /* ======================================================================
   *  Initialization
   * ====================================================================== */

  /**
   * Boot the application: load data, build nav, start router.
   */
  function init() {
    loadAllData().then(function () {
      buildNavigation();
      initSidebarToggle();
      initRouter();
    }).catch(function (err) {
      console.error('[StrongToby] Critical init error:', err);
      var contentEl = getContentEl();
      if (contentEl) {
        contentEl.innerHTML =
          '<div class="error-message">' +
          '<h2>加载数据时出错</h2>' +
          '<p>请检查网络连接或数据文件是否完整，然后刷新页面重试。</p>' +
          '<pre>' + escapeHtml(String(err)) + '</pre>' +
          '</div>';
      }
    });
  }

  // Start when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ======================================================================
   *  Public API  --  window.App
   * ====================================================================== */

  window.App = {
    /** Format a date string in Chinese, e.g. "2026年02月12日" */
    formatDate: formatDate,

    /** Format a date as MM/DD for compact display */
    formatDateShort: formatDateShort,

    /** Find a report by its id from AppData.reportsIndex */
    getReport: getReport,

    /** Navigate to a hash route programmatically */
    navigateTo: navigateTo,

    /** Returns the #content element */
    getContentEl: getContentEl,

    /** Re-build sidebar navigation (useful after data updates) */
    buildNavigation: buildNavigation,

    /** Highlight the active nav item for the current hash */
    highlightActiveNav: highlightActiveNav,

    /** Toggle sidebar visibility (mobile) */
    toggleSidebar: toggleSidebar,

    /** Close sidebar (mobile) */
    closeSidebarMobile: closeSidebarMobile,

    /** Parse current hash into route segments */
    parseHash: parseHash,

    /** Escape HTML special characters */
    escapeHtml: escapeHtml,

    /** Re-run the current route (e.g., after dynamically loading a module) */
    handleRoute: handleRoute
  };

})();
