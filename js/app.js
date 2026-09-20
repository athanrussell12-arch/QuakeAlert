document.querySelectorAll("#tabs button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll("main > section").forEach(s => s.hidden = true);
    document.getElementById("tab-" + btn.dataset.tab).hidden = false;
  };
});

//started phase 2

const Engine = {
  rate: 10,              // samples per second
  windowSec: 60,         // ring buffer duration
  buffer: [],            // [{t, x, y, z, mag}]
  t: 0,
  timer: null,
  event: null,
  nextEventAt: 12,
  auto: true,
  pga: 0,                // peak-hold with decay
  peakSession: 0,
  samples: 0,
  events: 0,
  startedAt: Date.now(),

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000 / this.rate);
  },

  stop() { clearInterval(this.timer); this.timer = null; },

  startEvent(mag) {
    const pgaTarget = Math.min(0.010 * Math.pow(10, (mag - 3) / 2), 0.85) * 1.5;
    const dur = 7 + (mag - 3) * 4.5;
    this.event = {
      mag, pga: pgaTarget, dur,
      tau: dur / 3.1,          // exponential decay time constant
      rise: 0.35 + Math.random() * 0.3,
      t0: this.t,
      f: 1.6 + Math.random() * 4.5,   // dominant frequency Hz
      p1: Math.random() * 6.28,
      p2: Math.random() * 6.28,
      p3: Math.random() * 6.28
    };
    this.events++;
  },

  tick() {
    const dt = 1 / this.rate;
    this.t += dt;
    this.samples++;

    const noise = 0.00055;
    const rnd = () => Math.random() * 2 - 1;

    let x = rnd() * noise;
    let y = rnd() * noise;
    let z = rnd() * noise;

    // ambient structural sway (very low frequency)
    const sway = 0.00022 * Math.sin(2 * Math.PI * 0.33 * this.t);
    x += sway; y += sway * 0.7;

    if (this.auto && !this.event && this.t > this.nextEventAt) {
      this.startEvent(2.9 + Math.random() * 3.4);
    }

    if (this.event) {
      const ev = this.event;
      const d = this.t - ev.t0;
      if (d > ev.dur) {
        this.event = null;
        this.nextEventAt = this.t + 22 + Math.random() * 45;
      } else {
        const env = Math.exp(-d / ev.tau) * (1 - Math.exp(-d / ev.rise));
        const f = ev.f * (1 - 0.32 * (d / ev.dur));
        x += ev.pga * 0.55 * env * Math.sin(2 * Math.PI * f * d + ev.p1);
        y += ev.pga * 0.62 * env * Math.sin(2 * Math.PI * f * 1.13 * d + ev.p2);
        z += ev.pga * 0.42 * env * Math.sin(2 * Math.PI * f * 1.41 * d + ev.p3);
        const j = ev.pga * 0.07 * env;   // jitter
        x += j * rnd(); y += j * rnd(); z += j * 0.7 * rnd();
      }
    }

    const mag = Math.sqrt(x*x + y*y + z*z);
    this.pga = Math.max(mag, this.pga * 0.9855);   // ~1.5% decay/sample
    if (this.pga > this.peakSession) this.peakSession = this.pga;

    this.buffer.push({ t: this.t, x, y, z, mag });
    const maxLen = this.windowSec * this.rate;
    while (this.buffer.length > maxLen) this.buffer.shift();
  }
};

Engine.start();

// Wire one KPI to prove it works
setInterval(() => {
  document.getElementById("kPga").textContent = Engine.pga.toFixed(4);
}, 200);