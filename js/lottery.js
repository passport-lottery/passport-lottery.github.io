/* Лотерея «Родиться заново»: барабан + мини-паспорт + три рейтинга.
   Данные — COUNTRIES и RATINGS в js/data.js. Никакого сравнения с ПМР. */
var Lottery = (function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function metric(key, title, src, rank) {
    return '<div class="metric">' +
      '<div class="m-head"><span>' + title + '</span><span class="m-src">' + src + '</span></div>' +
      '<div class="bar"><div class="track"><div class="fill f-' + key + '" data-fill="' + key + '"></div></div><span data-num="' + key + '">—</span></div>' +
      '<div class="m-rank" data-rank="' + key + '">' + rank + '</div>' +
    '</div>';
  }

  function mount(root) {
    var R = RATINGS;
    root.innerHTML =
      '<div class="lottery">' +
        '<div class="mini" data-mini aria-hidden="true">' +
          '<div class="m-top" data-mini-top>Паспорт</div>' +
          '<div class="m-emblem"></div>' +
          '<div class="m-bottom"><div class="m-label" data-mini-label>?</div><div class="chip"></div></div>' +
        '</div>' +
        '<div class="result">' +
          '<div aria-live="polite" aria-atomic="true">' +
            '<div class="drum" data-drum>Страна ещё не выпала</div>' +
            '<div class="big" data-verdict>Три независимых рейтинга покажут, что досталось вместе с паспортом.</div>' +
          '</div>' +
          '<div class="metrics">' +
            metric('h', 'Безвизовые направления', R.henley.name, 'из ' + R.henley.total + ' направлений') +
            metric('a', 'Индекс мобильности', R.arton.name, 'из ' + R.arton.total + ' стран') +
            metric('u', 'Индекс человеческого развития страны', R.hdi.name, 'шкала от 0 до 1: здоровье, образование, доход') +
          '</div>' +
          '<button class="btn" type="button" data-spin>Родиться заново</button>' +
        '</div>' +
      '</div>' +
      '<p class="draft">Источники: ' + R.sources.map(function (s) {
        return s.name + ' — <a href="' + s.url + '" target="_blank" rel="noopener">' + s.label + '</a>';
      }).join('; ') + '. Данные собраны ' + R.collected + '; рейтинги обновляются несколько раз в год.</p>';

    var q = function (sel) { return root.querySelector(sel); };
    var spin = q('[data-spin]'), drum = q('[data-drum]'), mini = q('[data-mini]'),
        miniTop = q('[data-mini-top]'), miniLabel = q('[data-mini-label]'), verdict = q('[data-verdict]');

    // обложка как у настоящего паспорта этой страны: цвет и надписи (тексты из data.js)
    function dress(pick) {
      mini.style.backgroundColor = pick.c;
      miniTop.innerHTML = pick.top || pick.n;
      miniLabel.innerHTML = pick.label || 'Passport';
    }
    // во время прокрутки барабана живая область молчит, объявляется только итог
    var live = drum.parentNode;

    function setBar(key, width, num, rank) {
      q('[data-fill="' + key + '"]').style.width = width + '%';
      q('[data-num="' + key + '"]').textContent = num;
      if (rank) q('[data-rank="' + key + '"]').textContent = rank;
    }

    function show(pick) {
      dress(pick);
      setBar('h', pick.h[1] / R.henley.total * 100, pick.h[1], pick.h[0] + '-е место · из ' + R.henley.total + ' направлений');
      setBar('a', pick.a[1] / R.arton.total * 100, pick.a[1], pick.a[0] + '-е место · из ' + R.arton.total + ' стран');
      setBar('u', pick.u * 100, pick.u.toFixed(3).replace('.', ','));
      verdict.textContent = 'Вы родились: ' + pick.n + '. Вот что досталось вместе с паспортом.';
    }

    spin.addEventListener('click', function () {
      spin.disabled = true;
      live.setAttribute('aria-live', 'off');
      var ticks = reduce ? 1 : 22, i = 0, pick;
      (function tick() {
        pick = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        drum.textContent = pick.n;
        dress(pick);   // пока крутится барабан, мелькают обложки разных стран
        // замедление как у рулетки
        if (++i < ticks) { setTimeout(tick, 40 + i * i * 0.9); return; }
        live.setAttribute('aria-live', 'polite');
        show(pick);
        spin.disabled = false;
        spin.textContent = 'Ещё раз';
      })();
    });
  }

  return { mount: mount };
})();
