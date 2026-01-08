  (function(){
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cursor halo follows the mouse (ominous-but-friendly “presence”)
    const halo = document.querySelector('.vx-cursorHalo');
    if (halo && !prefersReduced){
      window.addEventListener('mousemove', (e) => {
        const x = e.clientX - 260;
        const y = e.clientY - 260;
        halo.style.transform = `translate(${x}px, ${y}px)`;
      }, {passive:true});
    }

    // Reveal engine: make sections appear like a machine “waking up”
    const candidates = [
      'section',
      '[id*="intake"]',
      'form',
      '[id*="pricing"]',
      '[id*="how"]',
      '[id*="deliver"]',
      '[id*="faq"]',
      '.card', '.panel', '.module', '.tier'
    ];

    const nodes = new Set();
    candidates.forEach(sel => document.querySelectorAll(sel).forEach(n => nodes.add(n)));

    nodes.forEach(n => n.classList.add('vx-reveal'));

    if (!prefersReduced && 'IntersectionObserver' in window){
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(ent=>{
          if(ent.isIntersecting){
            ent.target.classList.add('vx-on');
            io.unobserve(ent.target);
          }
        });
      }, {threshold: 0.12});
      nodes.forEach(n => io.observe(n));
    } else {
      nodes.forEach(n => n.classList.add('vx-on'));
    }

    // Auto-tag primary buttons to “pulse” like a command core
    const btns = Array.from(document.querySelectorAll('button, a, .btn, .cta'));
    const primaryWords = /(start|request|pay|checkout|verify|submit|allocate|secure|connect|join)/i;

    btns.forEach(b=>{
      const t = (b.textContent || '').trim();
      if(primaryWords.test(t)){
        b.classList.add('vx-primary');
      }
    });

    // Intake instrumentation: inputs “acknowledge” like a system panel
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(el=>{
      el.addEventListener('input', ()=>{
        el.style.boxShadow = '0 0 0 4px rgba(180,155,255,.08), 0 0 0 1px rgba(234,240,255,.10) inset';
        clearTimeout(el.__vxT);
        el.__vxT = setTimeout(()=>{ el.style.boxShadow = ''; }, 420);
      }, {passive:true});
    });

    // Optional: if there’s a payment status element, make it feel “alive”
    const bodyText = document.body.innerText || '';
    if (/Payment:\s*Not confirmed/i.test(bodyText) && !prefersReduced){
      const all = document.querySelectorAll('*');
      for(const el of all){
        if(el.children.length === 0 && /Payment:\s*Not confirmed/i.test(el.textContent || '')){
          el.style.position = 'relative';
          el.style.display = 'inline-block';
          el.style.padding = '6px 10px';
          el.style.borderRadius = '12px';
          el.style.border = '1px solid rgba(255,255,255,.14)';
          el.style.background = 'rgba(0,0,0,.24)';
          el.style.boxShadow = '0 0 0 4px rgba(255,107,138,.08)';
          el.style.animation = 'vxWarn 1.8s ease-in-out infinite';
          const style = document.createElement('style');
          style.textContent = `
            @keyframes vxWarn{
              0%{ filter:brightness(1); transform:translateY(0); }
              50%{ filter:brightness(1.08); transform:translateY(-1px); }
              100%{ filter:brightness(1); transform:translateY(0); }
            }
          `;
          document.head.appendChild(style);
          break;
        }
      }
    }
  })();
