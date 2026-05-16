/**
 * ZOO Analytics Tracker
 * Plausible Analytics + Custom Event Tracking
 * 
 * Tracks: page views, CTA clicks, form submissions, checkout initiations
 * Privacy-first: uses Plausible (no cookies, GDPR compliant)
 * Local storage: events saved for dashboard visualization
 */

(function() {
  'use strict';

  // ── LOCAL EVENT STORE ──
  function saveEvent(eventName, props) {
    try {
      var events = JSON.parse(localStorage.getItem('zoo_events') || '[]');
      events.push({
        event: eventName,
        props: props || {},
        timestamp: new Date().toISOString(),
        page: window.location.pathname
      });
      // Keep last 500 events
      if (events.length > 500) events = events.slice(-500);
      localStorage.setItem('zoo_events', JSON.stringify(events));
    } catch(e) {}
  }

  function getEvents() {
    try {
      return JSON.parse(localStorage.getItem('zoo_events') || '[]');
    } catch(e) { return []; }
  }

  function getEventCount(eventName, hours) {
    var events = getEvents();
    var cutoff = hours ? (Date.now() - hours * 3600000) : 0;
    return events.filter(function(e) {
      return e.event === eventName && (!cutoff || new Date(e.timestamp).getTime() > cutoff);
    }).length;
  }

  // ── PLAUSIBLE INIT ──
  // Plausible is loaded via <script> tag in <head>
  // This module adds custom event tracking on top

  window.ZOO = window.ZOO || {};
  window.ZOO.analytics = {

    // Track a custom event (Plausible goal)
    trackEvent: function(eventName, props) {
      if (window.plausible) {
        plausible(eventName, { props: props || {} });
      }
      // Save to localStorage for dashboard
      saveEvent(eventName, props);
      // Also log to console in dev
      console.log('[ZOO Analytics] ' + eventName, props || '');
    },

    // Track CTA button clicks
    trackCTA: function(ctaName, location, destination) {
      this.trackEvent('cta_click', {
        cta_name: ctaName,
        page_location: location,
        destination: destination || ''
      });
    },

    // Track form submissions
    trackFormSubmit: function(formName, formLocation) {
      this.trackEvent('form_submit', {
        form_name: formName,
        page_location: formLocation
      });
    },

    // Track checkout initiation
    trackCheckoutStart: function(productName, price, currency) {
      this.trackEvent('checkout_initiated', {
        product_name: productName,
        price: price || '',
        currency: currency || 'USD'
      });
    },

    // Track product page views
    trackProductView: function(productName, price) {
      this.trackEvent('product_view', {
        product_name: productName,
        price: price || ''
      });
    },

    // Track lead capture (email submitted)
    trackLeadCapture: function(source, email) {
      this.trackEvent('lead_captured', {
        source: source,
        // Don't store PII — just that a lead was captured
        has_email: email ? 'yes' : 'no'
      });
    },

    // Track outbound link clicks
    trackOutbound: function(url, linkText) {
      this.trackEvent('outbound_click', {
        url: url,
        link_text: linkText || ''
      });
    },

    // Get stats for dashboard
    getStats: function() {
      return {
        ctaClicks: getEventCount('cta_click'),
        formSubmits: getEventCount('form_submit'),
        checkoutStarts: getEventCount('checkout_initiated'),
        productViews: getEventCount('product_view'),
        leadsCapture: getEventCount('lead_captured'),
        outboundClicks: getEventCount('outbound_click'),
        totalEvents: getEvents().length,
        recentEvents: getEvents().slice(-20).reverse()
      };
    },

    // Get events by page
    getEventsByPage: function() {
      var events = getEvents();
      var pages = {};
      events.forEach(function(e) {
        var page = e.page || '(unknown)';
        if (!pages[page]) pages[page] = { views: 0, ctas: 0, forms: 0, checkouts: 0, leads: 0 };
        if (e.event === 'product_view' || e.event === 'page_view') pages[page].views++;
        if (e.event === 'cta_click') pages[page].ctas++;
        if (e.event === 'form_submit') pages[page].forms++;
        if (e.event === 'checkout_initiated') pages[page].checkouts++;
        if (e.event === 'lead_captured') pages[page].leads++;
      });
      return pages;
    }
  };

  // ── AUTO-TRACKING SETUP ──
  document.addEventListener('DOMContentLoaded', function() {
    var zoo = window.ZOO.analytics;

    // Auto-track all CTA buttons
    var ctas = document.querySelectorAll('.btn-primary, .nav-cta, .pay-btn, .zoo-result-cta, a[href*="checkout"]');
    ctas.forEach(function(cta) {
      cta.addEventListener('click', function() {
        var text = (this.textContent || '').trim().substring(0, 60);
        var href = this.getAttribute('href') || '';
        var location = window.location.pathname;
        zoo.trackCTA(text, location, href);
      });
    });

    // Auto-track checkout buttons specifically
    var checkoutBtns = document.querySelectorAll('a[href*="checkout.html"]');
    checkoutBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var href = this.getAttribute('href') || '';
        var productMatch = href.match(/[?&]product=([^&]+)/);
        var priceMatch = href.match(/[?&]price=([^&]+)/);
        zoo.trackCheckoutStart(
          productMatch ? productMatch[1] : 'unknown',
          priceMatch ? priceMatch[1] : '',
          'USD'
        );
      });
    });

    // Auto-track form submissions
    var forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
      form.addEventListener('submit', function() {
        var formName = this.getAttribute('name') || this.id || 'unnamed-form';
        zoo.trackFormSubmit(formName, window.location.pathname);
      });
    });

    // Auto-track email inputs (lead capture)
    var emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(function(input) {
      input.addEventListener('change', function() {
        if (this.value && this.value.includes('@')) {
          zoo.trackLeadCapture(window.location.pathname, this.value);
        }
      });
    });

    // Auto-track outbound links
    var links = document.querySelectorAll('a[href^="http"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('zootechnologies.com') === -1 && href.indexOf('localhost') === -1) {
        link.addEventListener('click', function() {
          zoo.trackOutbound(href, (link.textContent || '').trim().substring(0, 60));
        });
      }
    });

    // Track product page views automatically
    var productMatch = window.location.pathname.match(/^\/products\/([^\/]+)/);
    if (productMatch) {
      var productNameEl = document.querySelector('.product-name, h1');
      var priceEl = document.querySelector('.price-amount, .product-price .amount');
      zoo.trackProductView(
        productNameEl ? productNameEl.textContent.trim() : productMatch[1],
        priceEl ? priceEl.textContent.trim() : ''
      );
    }

    // Track checkout page view
    if (window.location.pathname.indexOf('checkout.html') !== -1) {
      var params = new URLSearchParams(window.location.search);
      var productKey = params.get('product') || 'unknown';
      var price = params.get('price') || '';
      zoo.trackCheckoutStart(productKey, price, 'USD');
    }

    // Track page view
    zoo.trackEvent('page_view', { path: window.location.pathname });
  });

})();
