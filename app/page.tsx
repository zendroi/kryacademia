'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { activities, events, faqs, img, klasses, partners, programs } from './mockData';

const nav = [
  ['Home', 'home'],
  ['Klass', 'klass'],
  ['Programs', 'programs'],
  ['Agenda', 'agenda'],
  ['Activities', 'activities'],
  ['Partner Schools', 'partners'],
  ['FAQ', 'faq'],
  ['Contact', 'contact'],
];

const A = () => <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">↗</span>;

function CursorSpotlight() {
  const [pos, setPos] = useState({ x: -600, y: -600 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);
    
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [visible]);

  return (
    <div
      className="cursor-spotlight"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

function AnimatedCounter({ end, duration = 1500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let startTime: number | null = null;
          const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeProgress * end));
            if (progress < 1) {
              requestAnimationFrame(step);
            }
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return <b ref={ref}>{count}</b>;
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a className={'brand ' + (light ? 'light' : '')} href="https://krya.global/" target="_blank" rel="noreferrer">
      <b>K</b>
      <strong>
        KRYA<small>GLOBAL</small>
      </strong>
    </a>
  );
}

function Btn({ href, children, alt = false }: { href: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <a className={'btn group ' + (alt ? 'alt' : '')} href={href}>
      {children}
      <A />
    </a>
  );
}

function Heading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="heading reveal">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{copy}</p>
    </header>
  );
}

function Navbar({ search }: { search: () => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('home');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 30);
      let c = 'home';
      nav.forEach(([, id]) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 220) c = id;
      });
      setActive(c);
    };
    h();
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <header className={'navbar ' + (scrolled ? 'scrolled' : '')}>
      <Brand />
      <nav>
        {nav.map(([n, id]) => (
          <a className={active === id ? 'active' : ''} href={'#' + id} key={id}>
            {n}
          </a>
        ))}
      </nav>
      <div className="navact">
        <button aria-label="Search" onClick={search}>
          ⌕
        </button>
        <a className="login group" href="/login">
          Login <A />
        </a>
        <button className="hamb" onClick={() => setOpen(true)}>
          ☰
        </button>
      </div>
      {open && (
        <div className="mobile">
          <div>
            <Brand light />
            <button onClick={() => setOpen(false)}>×</button>
          </div>
          <nav>
            {nav.map(([n, id], i) => (
              <a href={'#' + id} key={id} onClick={() => setOpen(false)}>
                <small>0{i + 1}</small>
                {n}
              </a>
            ))}
          </nav>
          <a href="/login">Teacher & Admin Portal →</a>
        </div>
      )}
    </header>
  );
}

function Search({ close }: { close: () => void }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const data = useMemo(() => {
    return [
      ...klasses.map((x) => ['Klass', x[0], 'klass']),
      ...programs.map((x) => ['Program', x[0], 'programs']),
      ...events.map((x) => ['Event', x[1], 'agenda']),
      ...partners.map((x) => ['Partner School', x, 'partners']),
    ]
      .filter((x) => x[1].toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  }, [q]);

  return (
    <div className="search" role="dialog">
      <header>
        <Brand />
        <button onClick={close}>Close ×</button>
      </header>
      <main>
        <span className="eyebrow">Discover KRYAcademia</span>
        <h2>What would you like to explore?</h2>
        <label>
          <span>⌕</span>
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “coding” or “holiday”" />
        </label>
        {data.map((x, i) => (
          <a href={'#' + x[2]} onClick={close} key={i} className="group">
            <small>{x[0]}</small>
            <strong>{x[1]}</strong>
            <A />
          </a>
        ))}
      </main>
    </div>
  );
}

function Hero() {
  const [video, setVideo] = useState(false);

  return (
    <section id="home" className="hero">
      <div className="ambient-orb ambient-orb-1" />
      <div className="hero-copy reveal">
        <span className="eyebrow">KRYAcademia</span>
        <h1>
          The 21st
          <br />
          <em>Education</em> Center
        </h1>
        <p>
          KRYAcademia creates innovative, project-based learning experiences that empower young people to think
          critically, create confidently, and make a meaningful impact.
        </p>
        <div>
          <Btn href="#klass">Find Your Klass</Btn>
          <Btn href="#programs" alt>
            Explore Programs
          </Btn>
        </div>
        <button className="watch group" onClick={() => setVideo(true)}>
          <span className="inline-block transition-transform duration-300 group-hover:scale-125">▶</span> &nbsp; See How We Learn
        </button>
      </div>

      <div className="hero-art reveal">
        <div>
          <img src={img.hero} alt="Students collaborating in a creative learning activity" />
        </div>
        <i>IDEA → MAKE → IMPACT</i>
        <aside>
          <small>Upcoming agenda</small>
          <strong>
            Young Makers
            <br />
            Open Class
          </strong>
          <span>08 Sep · Online</span>
          <a href="#agenda">See agenda →</a>
        </aside>
      </div>

      {video && (
        <div className="modal">
          <button onClick={() => setVideo(false)}>×</button>
          <article>
            <b>▶</b>
            <h3>Learning in action</h3>
            <p>Video story coming soon.</p>
          </article>
        </div>
      )}
    </section>
  );
}

function Klass() {
  const [mode, setMode] = useState('Online');
  const [cat, setCat] = useState('All');

  const items = useMemo(() => {
    const a = klasses.filter((x) => x[1] === mode && (cat === 'All' || x[2] === cat));
    return [...a, ...klasses.filter((x) => x[1] === mode && !a.includes(x))].slice(0, 4);
  }, [mode, cat]);

  return (
    <section id="klass" className="section">
      <Heading
        eyebrow="KRYAcademia Klass"
        title="Discover Your Next Klass"
        copy="Where creativity, technology, innovation, and practical learning meet—one meaningful project at a time."
      />
      <div className="filters">
        <div className="tabs">
          {['Online', 'Onsite'].map((x) => (
            <button className={mode === x ? 'on' : ''} onClick={() => setMode(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
        <div className="chips">
          {['All', 'Innovation & Creativity', 'Technology', 'Art & Language'].map((x) => (
            <button className={cat === x ? 'on' : ''} onClick={() => setCat(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
      </div>

      <div className="klassgrid">
        {items.map((x) => (
          <article className="card reveal group" key={x[0]}>
            <div className="photo">
              <img src={x[4]} alt={x[0] + ' activity'} />
              {x[3] && <b>{x[3]}</b>}
              <span>{x[1]}</span>
            </div>
            <div className="cardbody">
              <small>{x[2]}</small>
              <h3>{x[0]}</h3>
              <p>{x[5]}</p>
              <a href="#contact">
                Explore Klass <A />
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="center">
        <Btn href="#contact" alt>
          View All Klass
        </Btn>
      </div>
    </section>
  );
}

function Purpose() {
  return (
    <section className="purpose">
      <div className="ambient-orb ambient-orb-2" />
      <div className="reveal">
        <span className="eyebrow">Why KRYAcademia</span>
        <h2>Learning should prepare young people to shape the world—not simply fit into it.</h2>
        <p className="sdgs">SDG 4 · SDG 9 · SDG 12 · SDG 17</p>
      </div>
      <figure className="reveal">
        <img src={img.purpose} alt="Project-based learning activity" />
        <figcaption>
          Global citizenship
          <br />
          starts with curiosity.
        </figcaption>
      </figure>
      <div className="purposecopy reveal">
        {[
          [
            '01',
            'Background',
            'We integrate sustainable development into creative learning, inspiring students to understand global challenges and act with purpose.',
          ],
          [
            '02',
            'Our vision',
            'To foster a generation of thoughtful creators committed to a sustainable future.',
          ],
          [
            '03',
            'Our mission',
            'Deliver project-based learning that builds critical thinking, collaboration, and confidence.',
          ],
        ].map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <h3>{x[1]}</h3>
            <p>{x[2]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Programs() {
  const req = (p: string) => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'Program', program: p } }));
    window.location.hash = 'contact';
  };

  return (
    <section id="programs" className="section soft">
      <Heading
        eyebrow="Programs"
        title="Learning Experiences for Every Journey"
        copy="Flexible formats for families, schools, and institutions—designed around active learning and purposeful outcomes."
      />
      <div className="programgrid">
        {programs.map((x, i) => (
          <article className="program reveal group" key={x[0]}>
            <small>0{i + 1}</small>
            <img src={x[3]} alt={x[0]} />
            <div>
              <b>{x[1]}</b>
              <h3>{x[0]}</h3>
              <p>{x[4]}</p>
              <span>◉ {x[2]}</span>
              <footer>
                <a href="#contact">Explore Program</a>
                <button onClick={() => req(x[0])}>Request This Program ↗</button>
              </footer>
            </div>
          </article>
        ))}
      </div>
      <aside className="custom">
        <b>✦</b>
        <p>
          <strong>Have something different in mind?</strong>
          <br />
          We can design custom learning experiences with schools and institutions.
        </p>
        <button onClick={() => req('Custom Program')}>Start a conversation →</button>
      </aside>
    </section>
  );
}

function Agenda() {
  const [day, setDay] = useState(8);
  const [tab, setTab] = useState('Upcoming');

  return (
    <section id="agenda" className="section">
      <Heading
        eyebrow="Agenda"
        title="What’s Happening at KRYAcademia"
        copy="A preview of how workshops, open classes, exhibitions, and events will be discovered. All entries below are mock data."
      />
      <div className="agendagrid">
        <div className="calendar reveal">
          <header>
            <div>
              <small>MOCK CALENDAR · 2026</small>
              <h3>September 2026</h3>
            </div>
            <span>
              <button>←</button>
              <button>→</button>
            </span>
          </header>
          <div className="week">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((x) => (
              <b key={x}>{x}</b>
            ))}
          </div>
          <div className="days">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <button
                className={(day === d ? 'on ' : '') + (events.some((e) => +e[0] === d) ? 'event' : '')}
                onClick={() => setDay(d)}
                key={d}
              >
                {d}
              </button>
            ))}
          </div>
          <footer>
            <b>SEP {day}</b>
            <span>{events.find((e) => +e[0] === day)?.[1] || 'No mock events scheduled on this date.'}</span>
          </footer>
        </div>

        <div className="eventlist">
          <div className="agendatabs">
            {['Upcoming', 'Ongoing', 'Past'].map((x) => (
              <button className={tab === x ? 'on' : ''} onClick={() => setTab(x)} key={x}>
                {x}
              </button>
            ))}
          </div>
          {events.map((x) => (
            <article className="eventcard reveal" key={x[1]}>
              <div>
                <strong>{x[0]}</strong>
                <small>
                  SEP
                  <br />
                  2026
                </small>
              </div>
              <section>
                <span>{x[2]} · {x[3]} · Mock event</span>
                <h3>{x[1]}</h3>
                <p>A sample event entry demonstrating KRYAcademia’s future agenda experience.</p>
                <small>{x[4]} {x[3] !== 'Online' && '· Surabaya'}</small>
              </section>
              <button>{x[5]}</button>
            </article>
          ))}
        </div>
      </div>
      <div className="center">
        <Btn href="#contact" alt>
          View All Agenda
        </Btn>
      </div>
    </section>
  );
}

function Activities() {
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);

  useEffect(() => {
    if (pause) return;
    const timer = setInterval(() => {
      setI((prev) => (prev + 1) % activities.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [pause]);

  return (
    <section
      id="activities"
      className="activities group cursor-pointer"
      tabIndex={0}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setI((i + 1) % activities.length);
        if (e.key === 'ArrowLeft') setI((i + activities.length - 1) % activities.length);
      }}
    >
      <Heading
        eyebrow="Inside KRYAcademia"
        title="Our Activities"
        copy="Discover inspiring moments of creativity, collaboration, and meaningful learning at KRYAcademia. Hover cursor to pause auto-scroll."
      />
      <div className="viewport">
        <div className="track" style={{ transform: `translateX(calc(-${i} * (33.333% + 7px)))` }}>
          {activities.map((x, n) => (
            <figure key={n} className="transition-transform duration-500 hover:scale-[1.02]">
              <img src={x[1]} alt={x[0]} />
              <figcaption>
                <small>0{n + 1}</small>
                {x[0]}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="controls">
        <span>
          0{i + 1} / {activities.length} {pause && <small className="text-[#ff8996] ml-2 font-mono">⏸ PAUSED</small>}
        </span>
        <i>
          <b style={{ width: ((i + 1) / activities.length) * 100 + '%' }} />
        </i>
        <button aria-label="Previous slide" onClick={() => setI((i + activities.length - 1) % activities.length)}>
          ←
        </button>
        <button aria-label="Next slide" onClick={() => setI((i + 1) % activities.length)}>
          →
        </button>
      </div>
    </section>
  );
}

function Partners() {
  const go = () => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'School Partnership' } }));
    window.location.hash = 'contact';
  };

  return (
    <section id="partners" className="section">
      <Heading
        eyebrow="Together, further"
        title="Partner Schools"
        copy="We collaborate with schools to create innovative and sustainable learning experiences shaped around each community."
      />
      <div className="logos">
        {partners.map((p) => (
          <article className="reveal" key={p}>
            <span>{p.split(' ').map((x) => x[0]).slice(0, 3).join('')}</span>
            <strong>{p}</strong>
          </article>
        ))}
      </div>
      <div className="center">
        <button className="btn group" onClick={go}>
          Partner With KRYAcademia <A />
        </button>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="section faq">
      <aside>
        <span className="eyebrow">Good to know</span>
        <h2>
          Questions,
          <br />
          <em>answered.</em>
        </h2>
        <p>Can’t find what you need? Our team is ready to help.</p>
        <a href="#contact">Ask us directly →</a>
      </aside>
      <div>
        {faqs.map((x, i) => (
          <article className={open === i ? 'open' : ''} key={x[0]}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <small>0{i + 1}</small>
              <strong>{x[0]}</strong>
              <i>{open === i ? '−' : '+'}</i>
            </button>
            <p>{x[1]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Field({ bad, name, label, children }: { bad: string[]; name: string; label: string; children?: React.ReactNode }) {
  return (
    <label className={bad.includes(name) ? 'bad' : ''}>
      <span>
        {label} <b>*</b>
      </span>
      {children || <input name={name} />} {bad.includes(name) && <small>This field is required.</small>}
    </label>
  );
}

function Contact() {
  const [type, setType] = useState('');
  const [program, setProgram] = useState('');
  const [status, setStatus] = useState('idle');
  const [bad, setBad] = useState<string[]>([]);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setType(d.type);
      setProgram(d.program || '');
    };
    window.addEventListener('inquiry', h);
    return () => window.removeEventListener('inquiry', h);
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const m = ['name', 'email', 'phone', 'place', 'type', 'language', 'message', 'consent'].filter((x) => !d.get(x));
    setBad(m);
    if (m.length) return;
    setStatus('loading');
    setTimeout(() => setStatus('success'), 900);
  };

  return (
    <section id="contact" className="contact">
      <aside>
        <span className="eyebrow">Let’s talk</span>
        <h2>Get in Touch</h2>
        <p>
          Tell us what you are looking for, and our team will help you find the right learning experience or
          collaboration opportunity.
        </p>
        <strong>aha@krya.global</strong>
        <strong>+62 817-2362-236</strong>
      </aside>
      <form onSubmit={submit} noValidate>
        {status === 'success' ? (
          <div className="success">
            <b>✓</b>
            <h3>Thank you for reaching out.</h3>
            <p>This prototype inquiry has been captured locally. No information was sent.</p>
            <button type="button" onClick={() => setStatus('idle')}>
              Send another inquiry
            </button>
          </div>
        ) : (
          <>
            <Field bad={bad} name="name" label="Full Name" />
            <Field bad={bad} name="email" label="Email Address">
              <input name="email" type="email" />
            </Field>
            <Field bad={bad} name="phone" label="WhatsApp Number">
              <input name="phone" placeholder="+62 812 3456 7890" />
            </Field>
            <Field bad={bad} name="place" label="City / Country" />
            <Field bad={bad} name="type" label="Inquiry Type">
              <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Select one</option>
                {['Workshop', 'Klass', 'Program', 'School Partnership', 'Event', 'Other'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field bad={bad} name="language" label="Preferred Language">
              <select name="language">
                <option value="">Select one</option>
                <option>English</option>
                <option>Indonesian</option>
              </select>
            </Field>
            {type === 'Klass' && (
              <>
                <label>
                  <span>Klass of Interest</span>
                  <select>
                    {klasses.map((x) => (
                      <option key={x[0]}>{x[0]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Preferred Mode</span>
                  <select>
                    <option>Online</option>
                    <option>Onsite</option>
                  </select>
                </label>
              </>
            )}
            {type === 'Program' && (
              <label className="full">
                <span>Program of Interest</span>
                <select value={program} onChange={(e) => setProgram(e.target.value)}>
                  {programs.map((x) => (
                    <option key={x[0]}>{x[0]}</option>
                  ))}
                  <option>Custom Program</option>
                </select>
              </label>
            )}
            {type === 'School Partnership' && (
              <>
                <label>
                  <span>School / Institution Name</span>
                  <input />
                </label>
                <label>
                  <span>School Level</span>
                  <input />
                </label>
              </>
            )}
            {['Workshop', 'Event', 'Other'].includes(type) && (
              <label className="full">
                <span>
                  {type === 'Workshop'
                    ? 'Workshop Topic or Request'
                    : type === 'Event'
                    ? 'Event of Interest'
                    : 'Please Specify'}
                </span>
                <input />
              </label>
            )}
            <Field bad={bad} name="message" label="Message">
              <textarea name="message" rows={4} />
            </Field>
            <label className={'consent ' + (bad.includes('consent') ? 'bad' : '')}>
              <input type="checkbox" name="consent" />
              <span>I agree that KRYAcademia may use this information to respond. *</span>
            </label>
            <button className="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending…' : 'Send Inquiry ↗'}
            </button>
            <p className="note">UI prototype only — no information is sent to a server.</p>
          </>
        )}
      </form>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>
        <section>
          <Brand light />
          <p>Creative, project-based learning that equips young people to make meaningful impact.</p>
          <small>An educational initiative by KRYA Global.</small>
        </section>
        <section>
          <h3>Explore</h3>
          {nav.slice(0, 5).map((x) => (
            <a href={'#' + x[1]} key={x[1]}>
              {x[0]}
            </a>
          ))}
        </section>
        <section>
          <h3>Discover</h3>
          <a href="#klass">Online Klass</a>
          <a href="#klass">Onsite Klass</a>
          <a href="#programs">Programs</a>
          <a href="/login">Teacher & Admin Portal</a>
        </section>
        <section>
          <h3>Visit us</h3>
          <p>AD Kavling 3, Jl. Kupang Jaya I, Sonokwijenan, Sukomanunggal, Surabaya, East Java 60189, Indonesia</p>
          <a href="mailto:aha@krya.global">aha@krya.global</a>
          <a href="https://wa.me/628172362236">+62 817-2362-236</a>
        </section>
      </div>
      <aside>
        © 2026 KRYA Global. All rights reserved. <a href="#home">Back to top ↑</a>
      </aside>
    </footer>
  );
}

export default function Home() {
  const [s, setS] = useState(false);

  useEffect(() => {
    const o = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.reveal').forEach((x) => o.observe(x));
    return () => o.disconnect();
  }, []);

  return (
    <>
      <CursorSpotlight />
      <Navbar search={() => setS(true)} />
      {s && <Search close={() => setS(false)} />}
      <main>
        <Hero />
        <section className="impact reveal">
          <div>
            <AnimatedCounter end={141} />
            <span>Students</span>
          </div>
          <div>
            <AnimatedCounter end={7} />
            <span>Partner Schools</span>
          </div>
          <div>
            <b>—</b>
            <span>Programs · to be confirmed</span>
          </div>
          <p>
            Curiosity becomes capability
            <br />
            when students learn by doing.
          </p>
        </section>
        <Klass />
        <Purpose />
        <Programs />
        <Agenda />
        <Activities />
        <Partners />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
