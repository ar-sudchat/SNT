/* KruScan guide — walkthrough player (vanilla). Steps live in <script type="application/json"> inside each .player */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP_MS = 3400;

  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function src(i){ return 'img/' + i + '.jpg'; }
  function place(node, b){ node.style.left=b[0]+'%'; node.style.top=b[1]+'%'; node.style.width=b[2]+'%'; node.style.height=b[3]+'%'; }

  function buildStatic(root, steps, device){
    var g = el('div', 'static ' + device);
    steps.forEach(function(s, k){
      var f = el('figure', device), sc = el('div', 'screen'), im = el('img');
      im.src = src(s.i); im.alt = s.c; im.loading = 'lazy';
      sc.appendChild(im);
      if (s.b){ var h = el('div', 'hl'); place(h, s.b); sc.appendChild(h); }
      f.appendChild(sc); f.appendChild(el('figcaption', '', (k+1) + '. ' + s.c));
      g.appendChild(f);
    });
    root.appendChild(g);
  }

  function Player(root){
    var data = root.querySelector('script[type="application/json"]');
    var steps = JSON.parse(data.textContent);
    var device = root.getAttribute('data-device') || 'phone';
    var hero = root.hasAttribute('data-hero');
    var title = root.getAttribute('aria-label') || 'วิดีโอสาธิต';
    if (reduce){ buildStatic(root, steps, device); return; }

    root.setAttribute('role', 'region'); root.tabIndex = 0;
    var dev = el('div', 'dev ' + device), screen = el('div', 'screen'), zoom = el('div', 'zoom');
    var imA = el('img'), imB = el('img'); imA.alt = ''; imB.alt = ''; imB.style.opacity = 0;
    var hl = el('div', 'hl'), finger = el('div', 'finger');
    finger.style.left = '50%'; finger.style.top = '110%';
    zoom.appendChild(imA); zoom.appendChild(imB); zoom.appendChild(hl);
    screen.appendChild(zoom); screen.appendChild(finger); dev.appendChild(screen); root.appendChild(dev);
    var cap = el('p', 'cap'); cap.setAttribute('aria-live', 'polite'); root.appendChild(cap);
    var bar = el('div', 'bar'), fill = el('i'); bar.appendChild(fill); root.appendChild(bar);
    var ctl = el('div', 'ctl');
    var bPrev = el('button', '', '⏮'), bPlay = el('button', 'pp', '▶︎'), bNext = el('button', '', '⏭');
    bPrev.type = bPlay.type = bNext.type = 'button';
    bPrev.setAttribute('aria-label', 'ขั้นก่อนหน้า'); bNext.setAttribute('aria-label', 'ขั้นถัดไป');
    var dots = el('div', 'dots'), dotBtns = [];
    steps.forEach(function(s, k){
      var d = el('button'); d.type = 'button'; d.setAttribute('aria-label', 'ขั้นที่ ' + (k+1) + ': ' + s.c);
      d.addEventListener('click', function(){ manual = true; go(k); }); dots.appendChild(d); dotBtns.push(d);
    });
    ctl.appendChild(bPrev); ctl.appendChild(bPlay); ctl.appendChild(bNext); ctl.appendChild(dots);
    if (!hero) root.appendChild(ctl);
    // preload
    steps.forEach(function(s){ var p = new Image(); p.src = src(s.i); });

    var cur = -1, playing = false, visible = false, manual = false, t0 = 0, elapsed = 0, raf = 0, timers = [], front = imA, back = imB;

    function clearT(){ timers.forEach(clearTimeout); timers = []; }
    function setPlay(p){
      playing = p; bPlay.textContent = p ? '⏸' : '▶︎';
      bPlay.setAttribute('aria-label', p ? 'หยุดชั่วคราว' : 'เล่น');
      if (p){ t0 = performance.now() - elapsed; tick(); } else cancelAnimationFrame(raf);
    }
    function tick(){
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function loop(now){
        if (!playing) return;
        elapsed = now - t0;
        fill.style.width = ((cur + Math.min(elapsed / STEP_MS, 1)) / steps.length * 100) + '%';
        if (elapsed >= STEP_MS){ go((cur + 1) % steps.length); }
        raf = requestAnimationFrame(loop);
      });
    }
    function go(k){
      clearT(); var s = steps[k], prev = steps[cur]; cur = k; elapsed = 0; t0 = performance.now();
      fill.style.width = (k / steps.length * 100) + '%';
      dotBtns.forEach(function(d, j){ if (j === k) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      cap.innerHTML = '<span class="n">' + (k+1) + '</span>' + s.c;
      root.setAttribute('aria-label', title + ' — ขั้นที่ ' + (k+1) + ' จาก ' + steps.length);
      var url = src(s.i);
      if (!prev || prev.i !== s.i){
        back.src = url; back.style.opacity = 1; front.style.opacity = 0; var t = front; front = back; back = t;
        zoom.style.transition = 'none'; zoom.style.transform = 'none'; void zoom.offsetWidth; zoom.style.transition = '';
      }
      hl.classList.remove('on');
      if (s.b){
        place(hl, s.b);
        var cx = s.b[0] + s.b[2] / 2, cy = s.b[1] + s.b[3] / 2;
        var z = s.z || (device === 'desktop' ? 1.08 : 1.04);
        zoom.style.transformOrigin = cx + '% ' + cy + '%';
        timers.push(setTimeout(function(){ zoom.style.transform = 'scale(' + z + ')'; hl.classList.add('on'); }, 120));
        // finger position in screen coords (account for zoom around origin)
        var fx = cx + (cx - cx) * (z - 1), fy = cy;
        finger.style.opacity = 1;
        timers.push(setTimeout(function(){ finger.style.left = fx + '%'; finger.style.top = fy + '%'; }, 200));
        if (s.t){
          timers.push(setTimeout(function(){
            finger.classList.add('tap');
            var r = el('div', 'ripple'); r.style.left = fx + '%'; r.style.top = fy + '%'; screen.appendChild(r);
            setTimeout(function(){ r.remove(); }, 800);
          }, 1300));
          timers.push(setTimeout(function(){ finger.classList.remove('tap'); }, 1480));
        }
      } else {
        zoom.style.transform = 'none'; finger.style.opacity = 0; hl.style.width = '0';
      }
    }
    function step(d){ manual = true; go((cur + d + steps.length) % steps.length); }
    bPrev.addEventListener('click', function(){ step(-1); });
    bNext.addEventListener('click', function(){ step(1); });
    bPlay.addEventListener('click', function(){ manual = playing; setPlay(!playing); });
    root.addEventListener('keydown', function(e){
      if (e.target !== root) return;
      if (e.key === 'ArrowRight'){ step(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft'){ step(-1); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'k'){ manual = playing; setPlay(!playing); e.preventDefault(); }
    });
    go(0); setPlay(false);
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(en){
          visible = en.isIntersecting;
          if (visible && !manual && !playing) setPlay(true);
          else if (!visible && playing) setPlay(false);
        });
      }, { threshold: 0.45 }).observe(root);
    } else setPlay(true);
    document.addEventListener('visibilitychange', function(){ if (document.hidden && playing) setPlay(false); else if (!document.hidden && visible && !manual) setPlay(true); });
  }

  function init(){ Array.prototype.forEach.call(document.querySelectorAll('.player'), function(p){ try { Player(p); } catch (e) { console.error(e); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
