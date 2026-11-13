/* Паспорт: открытие обложки при скролле + перелистывание листов.
   Страницы собираются из SITE и SECTIONS (js/data.js).

   Два движка листания:
   - «классический» (свой 3D): открывает и закрывает обложку по скроллу и делает быстрые
     прыжки на несколько листов (штампы содержания, «↑ к паспорту»);
   - StPageFlip (если библиотека загрузилась): включается, когда паспорт полностью открыт,
     и лежит точно поверх разворота. Страницу можно тянуть за угол, свайп листает.
     Библиотеку нельзя масштабировать через transform (она считает координаты пальца
     без учёта масштаба), поэтому она строится сразу в экранном размере разворота,
     а содержимое страниц уменьшается внутри. */
var Passport = (function () {
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var book, cover, opener, hint, controls, prev, next, counter, holder, stage, flipHost, shadowEl;
  var leaves = [], pages = [], N = 0;
  var idx = 0, opened = false, closing = false, busy = null;
  // StPageFlip
  var useFlip = typeof St !== 'undefined' && St.PageFlip && !reduce;
  var flip = null, flipKey = '', mode = 'classic', fullyOpen = false, classicUntil = 0;

  // номер листа, на котором стоит раздел i (0 — владельцы, 1 — содержание)
  function sectionLeaf(i) { return i + 2; }

  function stampHtml(s, i, tag, cls, extra) {
    return '<' + tag + ' class="stamp s' + (i % 4) + (cls ? ' ' + cls : '') + '" style="color:' + s.color + '"' + (extra || '') + '>' +
      esc(s.title) + '<small>' + esc(s.stamp) + '</small></' + tag + '>';
  }

  function renderCover() {
    var n = SITE.notice;
    cover.innerHTML =
      '<div class="face front">' +
        '<div class="country">' + SITE.coverTop + '</div>' +
        '<h1>' + esc(SITE.title) + '</h1>' +
        '<div class="bottom"><div class="label">' + esc(SITE.coverLabel) + '</div><div class="chip" aria-hidden="true"></div></div>' +
      '</div>' +
      '<div class="face back">' +
        '<div class="pghead"><span>Внимание</span><span>Notice</span></div>' +
        '<p class="sec-p notice-ru">' + esc(n.ru) + '</p>' +
        '<p class="sec-p notice-en" lang="en">' + esc(n.en) + '</p>' +
        '<div class="visas notice-mark" aria-hidden="true">✦</div>' +
      '</div>';
  }

  function buildPages() {
    var h = SITE.holders;
    var photo = h.photo
      ? '<div class="photo"><img src="' + esc(h.photo) + '" alt="Авторы проекта"></div>'
      : '<div class="photo" aria-hidden="true">' + esc(h.initials) + '</div>';
    var mrz = SITE.mrz.map(esc).join('<br>');
    pages.push({ front:
      '<div class="pghead"><span>Владельцы</span><span>Holders</span></div>' +
      '<div class="holder">' + photo +
        '<div class="holder-fields">' +
          '<div><div class="fld">Фамилии / Surnames</div><div class="val">' + h.surnames.map(esc).join('<br>') + '</div></div>' +
          '<div><div class="fld">Выдан / Issued</div><div class="val">' + esc(h.issued) + '</div></div>' +
        '</div></div>' +
      '<div><div class="fld">Тема / Subject</div><div class="val sm thin">' + esc(h.subject) + '</div></div>' +
      '<div><div class="fld">Защита / Valid until</div><div class="val sm">' + esc(h.validUntil) + '</div></div>' +
      '<div class="mrz" aria-hidden="true">' + mrz + '</div>' });

    var st = '';
    SECTIONS.forEach(function (s, i) { st += stampHtml(s, i, 'button', '', ' type="button" data-go="' + sectionLeaf(i) + '"'); });
    pages.push({ front: '<div class="pghead"><span>Содержание</span><span>Contents</span></div><div class="stamps">' + st + '</div>' });

    SECTIONS.forEach(function (s, i) {
      pages.push({ sec: s, front:
        '<div class="pghead"><span>Раздел ' + (i + 1) + '</span><span>' + esc(s.stamp) + '</span></div>' +
        stampHtml(s, i, 'span', 'bigstamp') +
        '<h2 class="sec-t">' + esc(s.title) + '</h2><p class="sec-p">' + esc(s.teaser) + '</p>' +
        '<a class="more" href="#' + s.id + '" style="--c:' + s.color + '"><span>' + esc(s.more || 'Читать раздел') + '</span><i class="more-arrow" aria-hidden="true"></i></a>' +
        '<div class="more-hint" aria-hidden="true">Раздел откроется ниже</div>' });
    });
  }

  function frontHtml(pg, i) { return pg.front + '<div class="pgnum">' + (2 * i + 1) + '</div>'; }
  // места для визовых штампов на обороте; на оборотах разделов — в обход штампа «ПРОЙДЕНО»
  var VISA_SLOTS = [
    { x: 8, y: 15, w: 52 }, { x: 40, y: 56, w: 48 }
  ];
  var VISA_SLOTS_SEC = [
    { x: 6, y: 13, w: 50 }, { x: 8, y: 66, w: 42 }
  ];
  function backHtml(pg, i) {
    // визовые штампы-картинки (этап 3) по порядку: штамп k ложится на оборот k % P,
    // второй круг — во второе место на странице. Оборот последнего листа не виден никогда,
    // поэтому видимых оборотов P = N - 1.
    var vs = (SITE.textures && SITE.textures.visaStamps) || [], visa = '', P = N - 1;
    vs.forEach(function (src, k) {
      if (k % P !== i) return;
      var slot = (pg.sec ? VISA_SLOTS_SEC : VISA_SLOTS)[Math.floor(k / P) % 2];
      var rot = ((k * 37) % 22) - 11;
      visa += '<img class="visa-img" src="' + esc(src) + '" alt="" loading="lazy" style="--vx:' + slot.x + '%;--vy:' + slot.y + '%;width:' + slot.w + '%;--vr:' + rot + 'deg">';
    });
    // штамп «ПРОЙДЕНО» раздела: картинка, если есть, иначе рисуется кодом
    var passed = '';
    if (pg.sec && pg.sec.passed) {
      passed = '<img class="passed-img" src="' + esc(pg.sec.passed) + '" alt="" loading="lazy" style="--vr:' + (((i * 29) % 14) - 7) + 'deg">';
    } else if (pg.sec) {
      passed = '<span class="stamp ghost s' + (i % 4) + '" style="color:' + pg.sec.color + '" aria-hidden="true">ПРОЙДЕНО<small>' + esc(pg.sec.stamp) + '</small></span>';
    }
    return '<div class="pghead"><span>Визы</span><span>Visas</span></div><div class="visas" aria-hidden="true">VISAS</div>' + visa + passed +
      '<div class="pgnum">' + (2 * i + 2) + '</div>';
  }

  function applyTextures() {
    var t = SITE.textures || {}, html = document.documentElement;
    // url() внутри CSS-переменной браузер считает от css/style.css, а не от страницы,
    // поэтому передаём полный адрес файла
    var url = function (p) { return 'url("' + new URL(p, document.baseURI).href + '")'; };
    // текстуру подставляем только целиком загруженной: на медленной сети обложка до этого
    // остаётся ровного бордового цвета, а не прорисовывается кусками
    var whenLoaded = function (p, fn) {
      var i = new Image();
      i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(fn, fn); };
      i.src = p;
    };
    if (t.cover) whenLoaded(t.cover, function () { html.style.setProperty('--cover-tex', url(t.cover)); html.classList.add('tex-cover'); });
    if (t.emboss) whenLoaded(t.emboss, function () { html.style.setProperty('--emboss-tex', url(t.emboss)); html.classList.add('tex-emboss'); });
    if (t.paper) whenLoaded(t.paper, function () { html.style.setProperty('--paper-tex', url(t.paper)); html.classList.add('tex-paper'); });
  }

  /* «Дыхание» закрытого паспорта: на ПК поворот вслед за курсором (±4°),
     на телефоне медленное покачивание (±2°). Гаснет к началу открытия обложки. */
  var tiltEl, fine = window.matchMedia('(pointer: fine)').matches;
  var tiltFade = 1, aim = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, raf = null;
  function tiltFrame(t) {
    raf = null;
    if (!fine) {
      aim.y = 2 * Math.sin(t / 1000 * 2 * Math.PI / 7);
      aim.x = 1.2 * Math.sin(t / 1000 * 2 * Math.PI / 9.5);
    }
    cur.x += (aim.x * tiltFade - cur.x) * 0.07;
    cur.y += (aim.y * tiltFade - cur.y) * 0.07;
    var still = tiltFade === 0 && Math.abs(cur.x) + Math.abs(cur.y) < 0.02;
    if (still) {
      // паспорт открывается: снимаем наклон совсем, чтобы разворот стоял ровно
      tiltEl.classList.remove('on');
      cur.x = cur.y = 0;
      return;
    }
    tiltEl.classList.add('on');
    tiltEl.style.setProperty('--rx', cur.x.toFixed(2) + 'deg');
    tiltEl.style.setProperty('--ry', cur.y.toFixed(2) + 'deg');
    raf = requestAnimationFrame(tiltFrame);
  }
  function tiltKick() { if (!reduce && raf === null) raf = requestAnimationFrame(tiltFrame); }

  function buildLeaves() {
    N = pages.length;
    pages.forEach(function (pg, i) {
      var el = document.createElement('div');
      el.className = 'leaf';
      el.innerHTML = '<div class="face lf-front">' + frontHtml(pg, i) + '</div>' +
        '<div class="face lf-back">' + backHtml(pg, i) + '</div>';
      holder.appendChild(el);
      leaves.push(el);
    });
  }

  /* ---------- StPageFlip ----------
     Страницы книги: оборот обложки, затем лицо и оборот каждого листа (у последнего — без оборота).
     Разворот k = страницы 2k (слева) и 2k+1 (справа) — ровно как разворот idx=k у своего движка. */
  function flipPagesHtml() {
    var h = '<div class="pf-page"><div class="face back pf-inner">' + cover.querySelector('.back').innerHTML + '</div></div>';
    pages.forEach(function (pg, i) {
      h += '<div class="pf-page"><div class="face lf-front pf-inner">' + frontHtml(pg, i) + '</div></div>';
      if (i < N - 1) h += '<div class="pf-page"><div class="face lf-back pf-inner">' + backHtml(pg, i) + '</div></div>';
    });
    return h;
  }

  // экранный размер одной страницы открытого разворота
  function spreadRect() {
    var r = book.querySelector('.base').getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { left: r.left - r.width - s.left, top: r.top - s.top, w: r.width, h: r.height };
  }

  function buildFlip() {
    var g = spreadRect(), key = Math.round(g.w) + 'x' + Math.round(g.h);
    if (flip && key === flipKey) return true;
    if (flip) { flip.destroy(); flip = null; }
    if (g.w < 40) return false;
    flipKey = key;
    flipHost.style.cssText = 'left:' + g.left + 'px;top:' + g.top + 'px;width:' + (2 * g.w) + 'px;height:' + g.h + 'px;' +
      '--pw:' + book.offsetWidth + 'px;--ph:' + book.offsetHeight + 'px;--s:' + (g.w / book.offsetWidth);
    var el = document.createElement('div');
    el.innerHTML = flipPagesHtml();
    flipHost.innerHTML = '';
    flipHost.appendChild(el);
    flip = new St.PageFlip(el, {
      width: Math.round(g.w), height: Math.round(g.h), size: 'fixed',
      showCover: false, usePortrait: false,           // разворот из двух страниц и на телефоне
      drawShadow: true, maxShadowOpacity: 0.5, flippingTime: 800,
      mobileScrollSupport: true,                      // вертикальный скролл страницы не ломается
      disableFlipByClick: true,                       // клик по штампу не листает страницу
      startPage: 2 * idx, autoSize: true
    });
    flip.loadFromHTML(el.querySelectorAll('.pf-page'));
    flip.on('flip', function (e) {
      idx = Math.min(N - 1, Math.floor(e.data / 2));
      paint();
    });
    // человек сам потянул или перелистнул страницу — подсказка больше не нужна
    flip.on('changeState', function (e) {
      if (e.data === 'user_fold' || e.data === 'flipping') flippedOnce();
    });
    return true;
  }

  /* Страницу можно тянуть пальцем из любой точки, а не только за угол.
     StPageFlip сам начинает тянуть только после удержания пальца 250мс, а к этому моменту
     браузер уже прокручивает сайт (touch-action: pan-y). Поэтому решаем по первому движению:
     по горизонтали — сразу отдаём жест библиотеке и не даём браузеру прокручивать,
     по вертикали — не вмешиваемся, сайт прокручивается как обычно.
     Касание в угловой зоне отдаём библиотеке сразу, ещё до движения. */
  var drag = null;   // { x, y } — начало касания; .on — тянем страницу
  function bindDrag() {
    var pos = function (t) {
      var b = flipHost.querySelector('.stf__block').getBoundingClientRect();
      return { x: t.clientX - b.left, y: t.clientY - b.top, w: b.width, h: b.height };
    };
    flipHost.addEventListener('touchstart', function (e) {
      drag = null;
      if (!flip || mode !== 'flip' || e.touches.length !== 1) return;
      if (e.target.closest('a, button')) return;      // штампы и ссылки нажимаются как обычно
      var p = pos(e.touches[0]);
      drag = { x: p.x, y: p.y, on: false };
      var size = Math.sqrt(Math.pow(p.w / 2, 2) + Math.pow(p.h, 2)) / 5;   // угловая зона, как в StPageFlip
      if ((p.x < size || p.x > p.w - size) && (p.y < size || p.y > p.h - size)) {
        drag.on = true;
        flip.startUserTouch({ x: p.x, y: p.y });
      }
    }, { passive: true, capture: true });
    flipHost.addEventListener('touchmove', function (e) {
      if (!drag) return;
      if (!drag.on) {
        var p = pos(e.touches[0]), dx = Math.abs(p.x - drag.x), dy = Math.abs(p.y - drag.y);
        if (dx < 4 && dy < 4) return;
        if (dx < dy) { drag = null; return; }          // вертикально — это прокрутка сайта
        drag.on = true;
        flip.startUserTouch({ x: drag.x, y: drag.y });
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false, capture: true });
    flipHost.addEventListener('touchend', function () { drag = null; }, { passive: true });
  }

  /* Подсказка, что страницу можно тянуть: уголок сам приподнимается
     и строка «Потяните страницу» под паспортом. Пропадает после первого перелистывания. */
  var peeked = 0, peekTimer = null, everFlipped = false, dragHint, pageHint;
  function peek() {
    clearTimeout(peekTimer);
    if (reduce || everFlipped || mode !== 'flip' || !flip || peeked >= 3) return;
    if (flip.getState() !== 'read') { peekTimer = setTimeout(peek, 1500); return; }
    var b = flipHost.querySelector('.stf__block').getBoundingClientRect();
    peeked++;
    flip.userMove({ x: b.width - 2, y: b.height - 2 }, false);          // приподнять нижний правый угол
    setTimeout(function () {
      if (flip && flip.getState() === 'fold_corner') flip.userMove({ x: b.width * 0.75, y: b.height / 2 }, false);
    }, 1100);
    peekTimer = setTimeout(peek, 6500);
  }
  function flippedOnce() {
    if (everFlipped) return;
    everFlipped = true;
    clearTimeout(peekTimer);
    dragHint.classList.add('gone');
  }

  function toFlip() {
    if (!useFlip || mode === 'flip' || Date.now() < classicUntil) return;
    // разворот ещё не выпрямился после «дыхания» — меряем его чуть позже
    if (tiltEl.classList.contains('on')) { setTimeout(function () { if (fullyOpen) toFlip(); }, 120); return; }
    if (!buildFlip()) return;
    flip.turnToPage(2 * idx);
    mode = 'flip';
    flipHost.classList.add('on');
    book.classList.add('off');
    if (!everFlipped) { dragHint.classList.add('on'); peekTimer = setTimeout(peek, 700); }
  }

  function toClassic() {
    if (mode !== 'flip') return;
    mode = 'classic';
    clearTimeout(peekTimer);
    dragHint.classList.remove('on');
    idx = Math.min(N - 1, Math.floor(flip.getCurrentPageIndex() / 2));
    paint();
    book.classList.remove('off');
    flipHost.classList.remove('on');
  }

  function paint() {
    leaves.forEach(function (el, i) {
      var f = i < idx;
      el.classList.toggle('flipped', f);
      el.classList.toggle('current', i === idx && opened);
      // перелистываемый лист всегда поверх остальных, иначе он проходит «сквозь» соседние
      el.style.zIndex = el.dataset.anim ? 100 : (f ? (10 + i) : (60 - i));
      el.inert = !(i === idx && opened);
    });
    counter.textContent = (idx + 1) + ' / ' + N;
    prev.disabled = idx === 0;
    next.disabled = idx === N - 1;
    // на развороте с содержанием подсказка под паспортом: штампы нажимаются
    if (pageHint) pageHint.classList.toggle('on', opened && idx === 1);
  }

  function go(target) {
    target = Math.max(0, Math.min(N - 1, target));
    if (target === idx) return;
    flippedOnce();
    // соседняя страница — листает StPageFlip, с изгибом и тенью
    if (mode === 'flip' && Math.abs(target - idx) === 1) {
      if (target > idx) flip.flipNext('bottom'); else flip.flipPrev('bottom');
      return;
    }
    // прыжок на несколько листов — своим движком, чтобы было видно, как страницы летят
    toClassic();
    classicUntil = Date.now() + (reduce ? 0 : (Math.abs(target - idx) - 1) * 140 + 950);
    goClassic(target);
    if (useFlip) setTimeout(function () { if (fullyOpen) toFlip(); }, classicUntil - Date.now() + 20);
  }

  // листать по одному листу с интервалом ~140мс, чтобы было видно, как страницы летят
  function goClassic(target) {
    clearTimeout(busy);
    (function step() {
      if (idx === target) return;
      var dir = target > idx ? 1 : -1, el = leaves[dir > 0 ? idx : idx - 1];
      el.dataset.anim = '1';
      idx += dir;
      setTimeout(function () { delete el.dataset.anim; paint(); }, reduce ? 0 : 900);
      setTimeout(paint, 0);
      if (idx !== target) busy = setTimeout(step, reduce ? 0 : 140);
    })();
    setTimeout(paint, 0);
  }

  function layout() {
    var vw = window.innerWidth, w = book.offsetWidth;
    var r = opener.getBoundingClientRect(), total = opener.offsetHeight - window.innerHeight;
    // обложка открывается за первые 40% прокрутки обёртки, easeInOutQuad
    var p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / (total * 0.4)));
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    cover.style.transform = 'rotateY(' + (-180 * e) + 'deg)';
    cover.style.zIndex = e > 0.5 ? 1 : 200;
    // разворот из двух страниц должен влезть в экран и на телефоне
    var scale = Math.min(1, (vw - 32) / (2 * w)), s = 1 - (1 - scale) * e;
    book.style.transform = 'translateX(' + (w * 0.5 * e * s) + 'px) scale(' + s + ')';
    hint.style.opacity = String(Math.max(0, 1 - p * 2));
    // тень разворота проявляется только в самом конце, когда обложка почти легла слева:
    // раньше она обводила пустое место под левую страницу, и там была видна бледная «панель»
    shadowEl.style.opacity = Math.max(0, Math.min(1, (e - 0.82) / 0.18)).toFixed(3);
    // блик по золоту — только пока паспорт закрыт
    book.classList.toggle('idle', p < 0.02 && !reduce);
    var fade = Math.max(0, 1 - p * 4);
    if (fade !== tiltFade) { tiltFade = fade; tiltKick(); }
    var o = e > 0.95;
    if (o !== opened) { opened = o; controls.setAttribute('aria-hidden', String(!o)); paint(); }
    // StPageFlip работает только на полностью открытом развороте
    fullyOpen = e >= 1;
    if (fullyOpen) toFlip(); else toClassic();
    // обложка закрывается — сначала перелистать всё назад, иначе листы торчат слева
    if (e < 0.9 && idx > 0 && !closing) { closing = true; goClassic(0); }
    if (idx === 0) closing = false;
  }

  // вернуться к открытому паспорту на странице раздела (паспорт не закрываем)
  function showSection(id) {
    var n = -1;
    SECTIONS.forEach(function (s, i) { if (s.id === id) n = sectionLeaf(i); });
    var y = opener.offsetTop + (opener.offsetHeight - window.innerHeight) * 0.55;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    if (n >= 0) setTimeout(function () { go(n); }, reduce ? 0 : 700);
  }

  function init() {
    book = document.getElementById('book');
    cover = document.getElementById('cover');
    opener = document.getElementById('top');
    hint = document.getElementById('hint');
    controls = document.getElementById('controls');
    prev = document.getElementById('prev');
    next = document.getElementById('next');
    counter = document.getElementById('counter');
    holder = document.getElementById('leaves');
    tiltEl = document.getElementById('tilt');
    stage = tiltEl.parentNode;
    flipHost = document.getElementById('flip');
    shadowEl = document.getElementById('spread-shadow');
    dragHint = document.getElementById('drag-hint');
    pageHint = document.getElementById('page-hint');
    if (useFlip) bindDrag();
    applyTextures();
    if (fine) {
      window.addEventListener('mousemove', function (e) {
        aim.y = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)) * 4;
        aim.x = -Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1)) * 4;
        if (tiltFade > 0) tiltKick();
      }, { passive: true });
    }
    tiltKick();

    renderCover();
    buildPages();
    buildLeaves();

    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx + 1); });
    [holder, flipHost].forEach(function (el) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-go]');
        if (b) go(+b.dataset.go);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (!opened) return;
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    });
    var sx = null, sy = null;
    book.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    book.addEventListener('touchend', function (e) {
      if (sx === null || !opened) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });

    window.addEventListener('scroll', layout, { passive: true });
    window.addEventListener('resize', function () {
      // размер разворота поменялся — книгу StPageFlip пересоберём при следующем открытии
      toClassic();
      if (flip) { flip.destroy(); flip = null; flipKey = ''; }
      layout();
    });
    paint();
    layout();
  }

  return { init: init, go: go, showSection: showSection, get index() { return idx; }, get count() { return N; } };
})();
