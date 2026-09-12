'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Search as SearchIcon, X, Mail, MessageCircle } from 'lucide-react';
import { events, faqs, img, klasses, partners, programs } from './mockData';
import ActivitiesInfiniteScroll from './ActivitiesInfiniteScroll';
import FoldText from './FoldText';
import StaggeredMenu from './StaggeredMenu';
import LogoLoop, { type LogoItem } from '@/components/LogoLoop';
import AgendaCalendar from './AgendaCalendar';

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

const partnerLogoItems: LogoItem[] = partners.map((school) => ({
  node: (
    <span className="partner-school-mark">
      <span className="partner-school-monogram" aria-hidden="true">
        {school.split(' ').map((word) => word[0]).slice(0, 3).join('')}
      </span>
      <strong>{school}</strong>
    </span>
  ),
  title: school,
  ariaLabel: school,
}));

const A = () => <ArrowUpRight aria-hidden size={17} />;

function AnimatedCounter({ end, duration = 1500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frameId: number;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!started.current) {
            started.current = true;
            let startTime: number | null = null;
            const step = (timestamp: number) => {
              if (!startTime) startTime = timestamp;
              const progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min((timestamp - startTime) / duration, 1);
              // Ease out cubic
              const easeProgress = 1 - Math.pow(1 - progress, 3);
              setCount(Math.floor(easeProgress * end));
              if (progress < 1) {
                frameId = requestAnimationFrame(step);
              }
            };
            frameId = requestAnimationFrame(step);
          }
        } else {
          started.current = false;
          cancelAnimationFrame(frameId);
          setCount(0);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [end, duration]);

  return <b ref={ref}>{count}</b>;
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={'brand ' + (light ? 'light' : '')} href="/#home" aria-label="KRYAcademia home">
      <NextImage src="/kryacademia-logo.png" alt="" width={48} height={48} priority />
      <strong>KRYAcademia</strong>
    </Link>
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

const FOLD_TITLES = [
  'Discover Your Next Klass',
  'Learning Experiences for Every Journey',
  'What’s Happening at KRYAcademia',
  'Partner Schools',
];

function Heading({
  eyebrow,
  title,
  copy,
  fold,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  fold?: boolean;
}) {
  const shouldFold = fold ?? FOLD_TITLES.includes(title);

  return (
    <header className={`heading ${shouldFold ? '' : 'reveal'}`}>
      <div>
        <span className="eyebrow reveal">{eyebrow}</span>
        <h2>{shouldFold ? <FoldText text={title} trigger="scroll" /> : title}</h2>
      </div>
      <p className="reveal">{copy}</p>
    </header>
  );
}

const staggeredNavItems = nav.map(([label, id]) => ({
  label,
  ariaLabel: `Navigate to ${label}`,
  link: `#${id}`,
}));

const staggeredSocialItems = [
  { label: 'Teacher & Admin Portal →', link: '/login' },
  { label: 'Instagram', link: 'https://instagram.com/krya.global' },
  { label: 'LinkedIn', link: 'https://linkedin.com/company/krya-global' },
  { label: 'WhatsApp', link: 'https://wa.me/6285111212362' },
];

function Navbar({ search }: { search: () => void }) {
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
          <SearchIcon size={19} aria-hidden />
        </button>
        <a className="login group" href="/login">
          Login <A />
        </a>
        <StaggeredMenu
          items={staggeredNavItems}
          socialItems={staggeredSocialItems}
          colors={['#0b192c', '#173051', '#e8001b']}
          accentColor="#e8001b"
        />
      </div>
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
  return (
    <section id="home" className="hero">
      <div className="hero-copy">
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
          <Btn href="#klass">Klass</Btn>
          <Btn href="#activities" alt>
            See How We Learn
          </Btn>
        </div>
      </div>

      <div className="hero-art">
        <div>
          <NextImage src={img.hero} alt="Students collaborating in a creative learning activity" width={1500} height={1060} priority />
        </div>
        <i>IDEA → MAKE → IMPACT</i>
        <aside>
          <small>Sample agenda</small>
          <strong>
            Young Makers
            <br />
            Open Class
          </strong>
          <span>08 Sep · Online</span>
        </aside>
      </div>

    </section>
  );
}

function Klass() {
  const [mode, setMode] = useState('All modes');
  const [cat, setCat] = useState('All');

  const items = useMemo(() => {
    return klasses.filter((x) => (mode === 'All modes' || x[1] === mode) && (cat === 'All' || x[2] === cat));
  }, [mode, cat]);

  return (
    <section id="klass" className="section">
      <Heading
        eyebrow="KRYAcademia Klass"
        title="Discover Your Next Klass"
        copy="Where creativity, technology, innovation, and practical learning meet—one meaningful project at a time."
        fold
      />
      <div className="filters">
        <div className="tabs">
          {['All modes', 'Online', 'Onsite'].map((x) => (
            <button aria-pressed={mode === x} className={mode === x ? 'on' : ''} onClick={() => setMode(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
        <div className="chips">
          {['All', 'Innovation & Creativity', 'Technology', 'Art & Language'].map((x) => (
            <button aria-pressed={cat === x} className={cat === x ? 'on' : ''} onClick={() => setCat(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
      </div>

      <p className="catalog-status" role="status">{items.length} Klass · Mode and schedule subject to confirmation.</p>
      <div className="klassgrid">
        {items.map((x) => (
          <article className="card klass-card group" key={x[0]}>
            <div className="photo">
              <NextImage src={x[4]} alt={x[0]} width={800} height={600} />
              {x[3] && <b>{x[3]}</b>}
              <span>{x[1] === 'To confirm' ? 'Mode to confirm' : x[1]}</span>
            </div>
            <div className="cardbody">
              <small>{x[2]}</small>
              <h3>{x[0]}</h3>
              <p>{x[5]}</p>
              <a href="#contact" onClick={() => dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'Klass', program: x[0] } }))}>
                Explore Klass <A />
              </a>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && <p className="catalog-empty">No Klass listed for this combination yet. <button onClick={() => { setMode('All modes'); setCat('All'); }}>View all Klass</button></p>}
    </section>
  );
}

function Purpose() {
  return (
    <section id="why" className="purpose" aria-labelledby="why-title">
      <header className="why-intro why-content">
        <div>
          <span className="why-label">Learning with purpose</span>
          <h2 id="why-title">Why KRYAcademia</h2>
        </div>
        <p>Learning should prepare young people to shape the world, not simply fit into it. Through creative, project-based experiences, students turn curiosity into skills they can use beyond the classroom.</p>
      </header>
      <figure className="why-photo why-content reveal">
        <NextImage src="/activities/collaboration.jpg" alt="A student and mentor working on a hands-on KRYAcademia project" width={1500} height={1060} />
        <figcaption>Real projects. <em>Meaningful learning.</em></figcaption>
      </figure>
      <div className="why-principles why-content">
        <article>
          <span className="why-label">01 / Our background</span>
          <h3>Curiosity becomes capability.</h3>
          <p>Young people need opportunities to connect what they learn with the world around them. KRYAcademia brings technology, art, and hands-on making together, using real challenges to build practical skills and a sense of purpose.</p>
        </article>
        <article>
          <span className="why-label">02 / Our vision</span>
          <h3>A future made by doing.</h3>
          <p>We envision thoughtful, confident creators who can contribute to a sustainable future. Students learn to question, imagine possibilities, and consider how their ideas affect other people and the environment.</p>
        </article>
        <article>
          <span className="why-label">03 / Our mission</span>
          <h3>Learn, make, and share.</h3>
          <p>Our mission is to develop critical thinking, creativity, confidence, and collaboration through project-based learning. Students explore a challenge, build and test their ideas, improve their work, and share what they discover.</p>
        </article>
      </div>
      <div className="why-sdgs">
        <div className="why-content">
          <figure className="why-sdgs-figure reveal">
            <NextImage
              src="/sdg-goals.png"
              alt="The 17 United Nations Sustainable Development Goals, from No Poverty to Partnerships for the Goals."
              width={1350}
              height={500}
              loading="eager"
              draggable={false}
              unoptimized
            />
            <figcaption>KRYAcademia connects creative, project-based learning with the SDGs to inspire a more sustainable future.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Programs() {
  const req = (p: string) => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'Program', program: p } }));
    window.location.assign('#contact');
  };

  return (
    <section id="programs" className="section soft">
      <Heading
        eyebrow="Programs"
        title="Learning Experiences for Every Journey"
        copy="Flexible formats for families, schools, and institutions—designed around active learning and purposeful outcomes."
        fold
      />
      <div className="programgrid">
        {programs.map((x, i) => (
          <article className="program reveal group" key={x[0]}>
            <small>0{i + 1}</small>
            <NextImage src={x[3]} alt={x[0]} width={600} height={424} />
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
  return (
    <section id="agenda" className="section">
      <Heading
        eyebrow="Agenda"
        title="What’s Happening at KRYAcademia"
        copy="A preview of how workshops, open classes, exhibitions, and events will be discovered. All entries below are mock data."
        fold
      />
      <AgendaCalendar />
    </section>
  );
}

function Activities() {
  return (
    <section id="activities" className="activities">
      <Heading
        eyebrow="Inside KRYAcademia"
        title="Our Activities"
        copy="Discover inspiring moments of creativity, collaboration, and meaningful learning at KRYAcademia."
      />
      <ActivitiesInfiniteScroll />
    </section>
  );
}

function Partners() {
  const go = () => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'School Partnership' } }));
    window.location.assign('#contact');
  };

  return (
    <section id="partners" className="section">
      <Heading
        eyebrow="Together, further"
        title="Partner Schools"
        copy="We collaborate with schools to create innovative and sustainable learning experiences shaped around each community."
        fold
      />
      <div className="partner-logo-loop-shell reveal">
        <LogoLoop
          logos={partnerLogoItems}
          speed={48}
          logoHeight={82}
          gap={22}
          pauseOnHover
          fadeOut
          fadeOutColor="#faf9f5"
          scaleOnHover
          ariaLabel="KRYAcademia partner schools"
          className="partner-logo-loop"
        />
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
  const [affiliation, setAffiliation] = useState('');

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setType(d.type);
      setProgram(d.program || '');
      setStatus('idle');
      setBad([]);
      if (d.type === 'School Partnership') setAffiliation('Institution');
    };
    window.addEventListener('inquiry', h);
    return () => window.removeEventListener('inquiry', h);
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const required = ['name', 'email', 'phone', 'place', 'type', 'affiliation', 'message', 'consent'];
    if (affiliation === 'Institution') required.push('institution');
    const m = required.filter((x) => !String(d.get(x) || '').trim());
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
        <a className="contact-link" href="mailto:aha@krya.global"><Mail size={20} aria-hidden />aha@krya.global</a>
        <a className="contact-link" href="https://wa.me/6285111212362" target="_blank" rel="noreferrer"><MessageCircle size={20} aria-hidden />+62 851-1121-2362</a>
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
              <select name="type" value={type} onChange={(e) => { setType(e.target.value); setProgram(''); }}>
                <option value="">Select one</option>
                {['Workshop', 'Klass', 'Program', 'School Partnership', 'Event', 'Other'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            {affiliation === 'Institution' ? (
              <div className="institution-field">
                <Field bad={bad} name="institution" label="Institution Name">
                  <input name="institution" placeholder="School or institution name" autoComplete="organization" autoFocus />
                </Field>
                <input type="hidden" name="affiliation" value="Institution" />
                <button className="institution-reset" type="button" onClick={() => setAffiliation('')} aria-label="Change institution type" title="Change institution type"><X size={17} /></button>
              </div>
            ) : (
              <Field bad={bad} name="affiliation" label="Institution">
                <select name="affiliation" value={affiliation} onChange={(e) => setAffiliation(e.target.value)}>
                  <option value="">Select one</option>
                  <option>Institution</option>
                  <option>Parent</option>
                  <option>Non-institution</option>
                </select>
              </Field>
            )}
            {type === 'Klass' && (
              <>
                <label>
                  <span>Klass of Interest</span>
                  <select name="klass" value={program} onChange={(e) => setProgram(e.target.value)}>
                    <option value="">Select a Klass</option>
                    {klasses.map((x) => (
                      <option key={x[0]}>{x[0]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Preferred Mode</span>
                  <select name="mode">
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
                  <option value="">Select a program</option>
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
          <a href="https://wa.me/6285111212362" target="_blank" rel="noreferrer">+62 851-1121-2362</a>
        </section>
      </div>
      <aside>
        © 2026 KRYAcademia. All rights reserved. <a href="#home">Back to top ↑</a>
      </aside>
    </footer>
  );
}

export default function Home() {
  const [s, setS] = useState(false);

  useEffect(() => {
    const o = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
          } else {
            e.target.classList.remove('visible');
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll('.reveal').forEach((x) => o.observe(x));
    return () => o.disconnect();
  }, []);

  return (
    <>
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
            <AnimatedCounter end={programs.length} />
            <span>Programs</span>
          </div>
          <div>
            <AnimatedCounter end={klasses.length} />
            <span>Klass</span>
          </div>
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
