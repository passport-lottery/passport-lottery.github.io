/* Инициализация: полные тексты разделов из data.js, ссылки «к паспорту», мелочи. */
(function () {
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  };

  function timelineHtml() {
    return '<ol class="tl">' + TIMELINE.map(function (t) {
      return '<li><b>' + esc(t.year) + '</b>' + t.text + '</li>';
    }).join('') + '</ol>';
  }

  function wave() {
    var h = '';
    for (var k = 0; k < 56; k++) {
      var a = Math.abs(Math.sin(k * 0.55) * 0.6 + Math.sin(k * 1.7) * 0.3) + 0.12;
      h += '<i style="height:' + Math.round(a * 100) + '%"></i>';
    }
    return '<div class="wave" aria-hidden="true">' + h + '</div>';
  }

  function videoHtml() {
    if (typeof VIDEO === 'undefined' || !VIDEO) return '';
    return '<figure class="film">' +
      '<video controls playsinline preload="metadata" poster="' + esc(VIDEO.poster) + '" aria-label="' + esc(VIDEO.title) + '">' +
        '<source src="' + esc(VIDEO.src) + '" type="video/mp4">' +
        'Видео не открывается в этом браузере. <a href="' + esc(VIDEO.src) + '">Скачать ролик</a>.' +
      '</video>' +
      '<figcaption><b>' + esc(VIDEO.title) + '</b> · ' + esc(VIDEO.length) + '<br>' + esc(VIDEO.note) + '</figcaption>' +
    '</figure>';
  }

  function interviewsHtml() {
    return videoHtml() + '<div class="grid">' + INTERVIEWS.map(function (v) {
      var n = (v.n < 10 ? '0' : '') + v.n;
      var excerpts = v.excerpts.map(function (x) {
        return '<div><dt>' + x.q + '</dt><dd>' + x.a + '</dd></div>';
      }).join('');
      var audio = v.audio
        ? '<div class="audio">' + wave() + '<audio controls preload="none" src="' + esc(v.audio) + '"></audio></div>'
        : '';
      return '<details class="card">' +
        '<summary>' +
          '<span class="k">' + ['Визит ' + n, v.date, v.format].filter(Boolean).map(esc).join(' · ') + '</span>' +
          '<span class="place">' + esc(v.place) + '</span>' +
          (v.role ? '<span class="role">' + esc(v.role) + '</span>' : '') +
          '<span class="idea">' + v.keyIdea + '</span>' +
          '<span class="toggle" aria-hidden="true"></span>' +
        '</summary>' +
        '<div class="excerpts">' +
          audio +
          (v.excerpts.length ? '<dl>' + excerpts + '</dl>' : '') +
          (v.points && v.points.length ? '<ul class="b-list">' + v.points.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' : '') +
          (v.quote ? '<blockquote class="quote">' + esc(v.quote) + '</blockquote>' : '') +
          (v.note ? '<p class="note">' + v.note + '</p>' : '') +
        '</div>' +
      '</details>';
    }).join('') + '</div>';
  }

  // 1 визит, 2–4 визита, 5+ визитов
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  var WIDGETS = {
    timeline: timelineHtml,
    interviews: interviewsHtml,
    lottery: function () { return '<div data-lottery></div>'; }
  };

  function listHtml(items, tag) {
    return '<' + tag + ' class="b-list">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</' + tag + '>';
  }

  function rightsHtml(rows) {
    return '<div class="rights" role="table" aria-label="Что можно без паспорта, а что только с ним">' +
      '<div class="r-row r-head" role="row"><span role="columnheader">Сфера</span><span role="columnheader">Без паспорта</span><span role="columnheader">Только с паспортом</span></div>' +
      rows.map(function (r) {
        return '<div class="r-row" role="row">' +
          '<div class="r-sphere" role="rowheader"><b>' + esc(r.sphere) + '</b><small>' + esc(r.where) + '</small></div>' +
          '<div class="r-no" role="cell"><span class="r-lbl">Без паспорта</span>' + r.without + '</div>' +
          '<div class="r-yes" role="cell"><span class="r-lbl">Только с паспортом</span>' + r.only + '</div>' +
        '</div>';
      }).join('') + '</div>';
  }

  function galleryHtml(b) {
    return '<div class="gallery' + (b.single ? ' single' : '') + '">' + b.gallery.map(function (g) {
      return '<figure><img src="' + esc(g.src) + '" alt="' + esc(g.caption) + '" loading="lazy"><figcaption>' + esc(g.caption) + '</figcaption></figure>';
    }).join('') + '</div>';
  }

  function blockHtml(b, s) {
    if (typeof b === 'string') return '<p' + (s.bodyMuted ? ' class="muted"' : '') + '>' + b + '</p>';
    if (b.widget) return WIDGETS[b.widget] ? WIDGETS[b.widget]() : '';
    if (b.lead) return '<p class="lead">' + b.lead + '</p>';
    if (b.h) return '<h4>' + esc(b.h) + '</h4>';
    if (b.list) return listHtml(b.list, 'ul');
    if (b.olist) return listHtml(b.olist, 'ol');
    if (b.quote) return '<figure class="b-quote"><blockquote class="quote">' + esc(b.quote) + '</blockquote>' + (b.who ? '<figcaption>' + esc(b.who) + '</figcaption>' : '') + '</figure>';
    if (b.facts) return '<div class="facts">' + b.facts.map(function (f) {
        return '<div class="fact"><b>' + esc(f[0]) + '</b><span>' + f[1] + '</span></div>';
      }).join('') + '</div>' + (b.note ? '<p class="draft">' + b.note + '</p>' : '');
    if (b.rights) return rightsHtml(b.rights);
    if (b.gallery) return galleryHtml(b);
    if (b.note) return '<p class="draft">' + b.note + '</p>';
    return '';
  }

  function renderSections() {
    var main = document.getElementById('sections');
    main.innerHTML = SECTIONS.map(function (s) {
      var n = INTERVIEWS.length;
      var label = s.id === 'interviews' ? n + ' ' + plural(n, 'визит', 'визита', 'визитов') : s.stamp;
      var blocks = s.body || [];
      var html = blocks.map(function (b) { return blockHtml(b, s); }).join('');
      // особый блок, не размещённый внутри текста, — в конце раздела
      var placed = blocks.some(function (b) { return b && b.widget; });
      if (s.widget && !placed && WIDGETS[s.widget]) html += WIDGETS[s.widget]();
      return '<section class="doc" id="' + s.id + '" style="--sec:' + s.color + '"><div class="wrap">' +
        '<span class="eyebrow">' + esc(label) + ' · ' + esc(s.title) + '</span>' +
        '<h3>' + esc(s.heading || s.title) + '</h3>' +
        html +
        '<a class="back-up" href="#top"><i class="tp-arrow" aria-hidden="true"></i>Вернуться к паспорту</a>' +
      '</div></section>';
    }).join('');
  }

  renderSections();
  document.getElementById('footer-text').textContent = SITE.footer;
  Passport.init();
  var lot = document.querySelector('[data-lottery]');
  if (lot) Lottery.mount(lot);

  // «Вернуться к паспорту» под разделом: к открытому развороту на странице этого раздела
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a.back-up');
    if (!a) return;
    ev.preventDefault();
    var sec = a.closest('section');
    Passport.showSection(sec ? sec.id : null);
  });

  /* Плавающая кнопка «К паспорту»: видна, пока читаешь разделы, прячется, когда паспорт на экране.
     Возвращает к открытому паспорту на странице того раздела, который сейчас читаешь. */
  var tp = document.getElementById('to-passport'), opener = document.getElementById('top');
  var sections = [].slice.call(document.querySelectorAll('section.doc'));
  function currentSection() {
    var cur = null, mark = window.innerHeight * 0.4;
    sections.forEach(function (s) { if (s.getBoundingClientRect().top <= mark) cur = s; });
    return cur;
  }
  var ticking = false;
  function updateTp() {
    ticking = false;
    var show = opener.getBoundingClientRect().bottom < window.innerHeight * 0.35;
    tp.classList.toggle('show', show);
    tp.setAttribute('aria-hidden', String(!show));
    tp.tabIndex = show ? 0 : -1;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateTp); }
  }, { passive: true });
  window.addEventListener('resize', updateTp);
  updateTp();
  tp.addEventListener('click', function (ev) {
    ev.preventDefault();
    var sec = currentSection();
    Passport.showSection(sec ? sec.id : null);
  });
})();
