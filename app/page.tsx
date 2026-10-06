'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import { PageLoadingLink as Link } from '@/components/smoothui/page-preloader';
import { ArrowUpRight, ChevronLeft, ChevronRight, Languages, X, Mail, MessageCircle } from 'lucide-react';
import { activities, coachProfiles, events, img, klasses, klassGalleries, partnerLogos, partners, programs, updates } from './mockData';
import ActivitiesInfiniteScroll from './ActivitiesInfiniteScroll';
import FoldText from './FoldText';
import StaggeredMenu from './StaggeredMenu';
import LogoLoop, { type LogoItem } from '@/components/LogoLoop';
import AgendaCalendar from './AgendaCalendar';
import ScrollExpand from '@/components/ScrollExpand';
import BasicAccordion from '@/components/smoothui/basic-accordion';
import AnimatedInput from '@/components/smoothui/animated-input';
import BasicDropdown, { type DropdownItem } from '@/components/smoothui/basic-dropdown';
import BasicToast from '@/components/smoothui/basic-toast';
import Checkbox from '@/components/smoothui/checkbox';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { Skiper30 } from '@/components/ui/skiper-ui/skiper30';
import { Link003 } from '@/components/ui/skiper-ui/skiper40';
import { LanguageProvider, useLanguage, type Language } from './i18n';
import { submitInquiry } from './inquiry/actions';
import { validateInquiry } from '@/lib/inquiry';

const nav = ['home', 'klass', 'programs', 'agenda', 'activities', 'partners', 'updates', 'faq', 'contact'] as const;

const partnerLogoItems: LogoItem[] = partners.map((school, index) => ({
  src: partnerLogos[index],
  alt: school,
}));

const A = () => <ArrowUpRight aria-hidden size={17} />;

const agendaImages = [img.makerSet, img.codingKlass, img.innovation, img.hero];
const heroSlides = events.map((event, index) => ({
  title: event[1],
  meta: `${event[0]} Sep · ${event[3]} · ${event[4]}`,
  image: agendaImages[index % agendaImages.length],
  alt: `${event[1]} at KRYAcademia`,
}));

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
    <a className={'brand ' + (light ? 'light' : '')} href="#home" aria-label="KRYAcademia home">
      <NextImage src="/kryacademia-logo.png" alt="" width={48} height={48} priority />
      <strong>KRYAcademia</strong>
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
  const shouldFold = fold ?? false;

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

function Navbar() {
  const [active, setActive] = useState('home');
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage, copy } = useLanguage();
  const staggeredNavItems = nav.map((id) => ({ label: copy.nav[id], ariaLabel: `Navigate to ${copy.nav[id]}`, link: `#${id}` }));
  const staggeredSocialItems = [
    { label: `${copy.footer.portal} ->`, link: '/login' },
    { label: 'Instagram', link: 'https://instagram.com/krya.global' },
    { label: 'LinkedIn', link: 'https://linkedin.com/company/krya-global' },
    { label: 'WhatsApp', link: 'https://wa.me/6285111212362' },
  ];
  const languageItems: DropdownItem[] = [
    { id: 'en', label: 'EN' },
    { id: 'id', label: 'ID' },
    { id: 'zh', label: 'ZH' },
  ];
  const languageLabel = languageItems.find((item) => item.id === language)?.label || 'EN';

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 30);
      let c = 'home';
      nav.forEach((id) => {
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
        {nav.map((id) => (
          <a className={active === id ? 'active' : ''} href={'#' + id} key={id}>
            {copy.nav[id]}
          </a>
        ))}
      </nav>
      <div className="navact">
        <div className="language-picker">
          <Languages size={19} aria-hidden />
          <span className="sr-only">Language</span>
          <BasicDropdown
            key={language}
            className="language-dropdown"
            label={languageLabel}
            items={languageItems}
            onChange={(item) => setLanguage(item.id as Language)}
          />
        </div>
        <Link className="login group" href="/login">
          Login <A />
        </Link>
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

function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);
  const { copy } = useLanguage();

  const slide = heroSlides[activeSlide];

  return (
    <section id="home" className="hero">
      <div className="hero-copy">
        <span className="eyebrow">{copy.hero.eyebrow}</span>
        <h1>
          {copy.hero.first}
          <br />
          <em>{copy.hero.accent}</em> {copy.hero.last}
        </h1>
        <p>{copy.hero.copy}</p>
        <div>
          <Btn href="#klass">{copy.hero.klass}</Btn>
          <Btn href="#activities" alt>
            {copy.hero.learn}
          </Btn>
        </div>
      </div>

      <div className="hero-art" role="region" aria-roledescription="carousel" aria-label="Upcoming programs">
        <div className="hero-art-media">
          {heroSlides.map((item, index) => (
            <NextImage
              className={index === activeSlide ? 'active' : ''}
              src={item.image}
              alt={item.alt}
              aria-hidden={index !== activeSlide}
              fill
              sizes="(max-width: 720px) 100vw, 52vw"
              priority={index === 0}
              key={item.title}
            />
          ))}
        </div>
        <i>INSPIRING → CREATING → DEDICATING</i>
        <aside className="hero-art-card">
          <div className="hero-slide-copy" aria-live="polite" aria-atomic="true">
            <small>{copy.hero.upcoming}</small>
            <strong>{slide.title}</strong>
            <span>{slide.meta}</span>
          </div>
        </aside>
        <nav className="hero-slide-controls" aria-label="Upcoming program navigation">
          <button type="button" aria-label="Previous upcoming program" onClick={() => setActiveSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)}><ChevronLeft size={18} aria-hidden /></button>
          <button type="button" aria-label="Next upcoming program" onClick={() => setActiveSlide(current => (current + 1) % heroSlides.length)}><ChevronRight size={18} aria-hidden /></button>
        </nav>
      </div>

    </section>
  );
}

function Klass() {
  const [mode, setMode] = useState('All modes');
  const [cat, setCat] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const { copy, localize } = useLanguage();
  const activeKlass = klasses.find((item) => item[0] === selected);
  const gallery = activeKlass ? klassGalleries[activeKlass[0]] || [activeKlass[4]] : [];
  const teachingCoaches = activeKlass
    ? activeKlass[0] === 'Biotechnology'
      ? coachProfiles.slice(3, 6)
      : activeKlass[2] === 'Technology'
      ? coachProfiles.slice(6, 9)
      : activeKlass[2] === 'Art & Language'
      ? coachProfiles.slice(9, 12)
      : coachProfiles.slice(0, 3)
    : [];

  const items = useMemo(() => {
    return klasses.filter((x) => (mode === 'All modes' || x[1] === mode) && (cat === 'All' || x[2] === cat));
  }, [mode, cat]);

  useEffect(() => {
    if (activeKlass && !dialog.current?.open) dialog.current?.showModal();
  }, [activeKlass]);

  const inquiry = () => {
    if (!activeKlass) return;
    dialog.current?.close();
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'Klass', program: activeKlass[0] } }));
    window.location.assign('#contact');
  };

  return (
    <section id="klass" className="section">
      <Heading
        eyebrow={copy.klass.eyebrow}
        title={copy.klass.title}
        copy={copy.klass.copy}
        fold
      />
      <div className="filters">
        <div className="tabs">
          {[['All modes', copy.klass.allModes], ['Online', copy.klass.online], ['Onsite', copy.klass.onsite]].map(([value, label]) => (
            <button aria-pressed={mode === value} className={mode === value ? 'on' : ''} onClick={() => setMode(value)} key={value}>
              {label}
            </button>
          ))}
        </div>
        <div className="chips">
          {[['All', copy.klass.all], ['Innovation & Creativity', copy.klass.innovation], ['Technology', copy.klass.technology], ['Art & Language', copy.klass.art]].map(([value, label]) => (
            <button aria-pressed={cat === value} className={cat === value ? 'on' : ''} onClick={() => setCat(value)} key={value}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="catalog-status" role="status">{items.length} {copy.klass.count} · {copy.klass.status}</p>
      <div className="klassgrid">
        {items.map((x) => (
          <article className="card klass-card group" key={x[0]}>
            <div className="photo">
              <NextImage src={x[4]} alt={x[0]} width={800} height={600} />
              {x[3] && <b>{x[3]}</b>}
              <span>{x[1] === 'Online' ? copy.klass.online : copy.klass.onsite}</span>
            </div>
            <div className="cardbody">
              <small>{x[2] === 'Technology' ? copy.klass.technology : x[2] === 'Art & Language' ? copy.klass.art : copy.klass.innovation}</small>
              <h3>{x[0]}</h3>
              <p>{localize(x[5])}</p>
              <button className="klass-details-trigger" type="button" onClick={() => { setGalleryIndex(0); setSelected(x[0]); }}>
                {copy.klass.explore} <A />
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && <p className="catalog-empty">{copy.klass.empty} <button onClick={() => { setMode('All modes'); setCat('All'); }}>{copy.klass.viewAll}</button></p>}
      <dialog ref={dialog} className="program-dialog klass-dialog" aria-labelledby="klass-dialog-title" onClose={() => setSelected(null)} onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        {activeKlass && (
          <div className="program-dialog-shell klass-dialog-shell">
            <button className="program-dialog-close" type="button" onClick={() => dialog.current?.close()} aria-label={copy.klass.close} title={copy.klass.close}><X size={20} /></button>
            <div className="klass-dialog-gallery" aria-label={copy.klass.documentation}>
              <NextImage src={gallery[galleryIndex]} alt={`${activeKlass[0]} documentation ${galleryIndex + 1}`} fill sizes="(max-width: 720px) 100vw, 54vw" />
              <div className="klass-gallery-controls">
                <button type="button" aria-label={copy.klass.previous} title={copy.klass.previous} onClick={() => setGalleryIndex((galleryIndex - 1 + gallery.length) % gallery.length)}><ChevronLeft size={20} /></button>
                <span>{galleryIndex + 1} / {gallery.length}</span>
                <button type="button" aria-label={copy.klass.next} title={copy.klass.next} onClick={() => setGalleryIndex((galleryIndex + 1) % gallery.length)}><ChevronRight size={20} /></button>
              </div>
            </div>
            <div className="program-dialog-content klass-dialog-content">
              <small>{copy.klass.details}</small>
              <h3 id="klass-dialog-title">{activeKlass[0]}</h3>
              <p>{localize(activeKlass[5])}</p>
              <dl>
                <div><dt>{copy.klass.availability}</dt><dd>{activeKlass[1] === 'Online' ? copy.klass.online : copy.klass.onsite}</dd></div>
                <div><dt>{copy.klass.count}</dt><dd>{activeKlass[2] === 'Technology' ? copy.klass.technology : activeKlass[2] === 'Art & Language' ? copy.klass.art : copy.klass.innovation}</dd></div>
              </dl>
              <section className="klass-teaching-team">
                <h4>{copy.klass.teachingTeam}</h4>
                <div>{teachingCoaches.map((coach) => (
                  <article key={coach[0]}>
                    <NextImage src={coach[2]} alt={coach[0]} width={46} height={46} />
                    <span><strong>{coach[0]}</strong><small>{copy.coaches.role(coach[1])}</small></span>
                  </article>
                ))}</div>
                <p>{copy.klass.teacherNote}</p>
              </section>
              <button className="program-dialog-action" type="button" onClick={inquiry}>{copy.klass.ask} <A /></button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}

function Purpose() {
  const { copy } = useLanguage();
  return (
    <section id="why" className="purpose" aria-labelledby="why-title">
      <header className="why-intro why-content">
        <div>
          <span className="why-label">{copy.why.label}</span>
          <h2 id="why-title">{copy.why.title}</h2>
        </div>
        <p>{copy.why.intro}</p>
      </header>
      <ScrollExpand
        className="why-expand"
        src="/activities/collaboration.jpg"
        alt="A student and mentor working on a hands-on KRYAcademia project"
        useWindowScroll
        startWidth={72}
        startHeight={80}
        startRadius={8}
        mediaZoom={1.12}
        scrollDistance={0.45}
        holdDistance={0}
        overlayScrim={0.8}
      >
        <p>{copy.why.overlay} <em>{copy.why.overlayAccent}</em></p>
      </ScrollExpand>
      <div className="why-principles why-content">
        <article>
          <span className="why-label">{copy.why.backgroundLabel}</span>
          <h3>{copy.why.backgroundTitle}</h3>
          <p>{copy.why.background}</p>
        </article>
        <article>
          <span className="why-label">{copy.why.visionLabel}</span>
          <h3>{copy.why.visionTitle}</h3>
          <p>{copy.why.vision}</p>
        </article>
        <article>
          <span className="why-label">{copy.why.missionLabel}</span>
          <h3>{copy.why.missionTitle}</h3>
          <p>{copy.why.mission}</p>
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
            <figcaption>{copy.why.sdgs}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Programs() {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const activeProgram = selected === null ? null : programs[selected];
  const documentation = activeProgram ? [[activeProgram[0], activeProgram[3]], ...activities.slice(selected!, selected! + 2)] : [];
  const { copy, localize } = useLanguage();

  useEffect(() => {
    if (activeProgram && !dialog.current?.open) dialog.current?.showModal();
  }, [activeProgram]);

  const req = (p: string) => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'Program', program: p } }));
    window.location.assign('#contact');
  };

  return (
    <section id="programs" className="section soft">
      <Heading
        eyebrow={copy.programs.eyebrow}
        title={copy.programs.title}
        copy={copy.programs.copy}
        fold
      />
      <div className="programgrid">
        {programs.map((x, i) => (
          <button type="button" className="program reveal group" key={x[0]} onClick={() => setSelected(i)} aria-haspopup="dialog">
            <small>0{i + 1}</small>
            <NextImage src={x[3]} alt={x[0]} width={600} height={424} />
            <div>
              <b>{localize(x[1])}</b>
              <h3>{x[0]}</h3>
              <p>{localize(x[4])}</p>
              <span>◉ {localize(x[2])}</span>
            </div>
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="program-dialog" aria-labelledby="program-dialog-title" aria-describedby="program-dialog-description" onClose={() => setSelected(null)} onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        {activeProgram && (
          <div className="program-dialog-shell">
            <button className="program-dialog-close" type="button" onClick={() => dialog.current?.close()} aria-label="Close program details" title="Close"><X size={20} /></button>
            <div className="program-dialog-gallery" aria-label="Program documentation">
              {documentation.map(([alt, src], index) => (
                <figure className={index === 0 ? 'featured' : ''} key={src}>
                  <NextImage src={src} alt={alt} width={900} height={700} />
                </figure>
              ))}
            </div>
            <div className="program-dialog-content">
              <small>{copy.programs.details}</small>
              <h3 id="program-dialog-title">{activeProgram[0]}</h3>
              <p id="program-dialog-description">{localize(activeProgram[4])}</p>
              <section>
                <h4>{copy.programs.experience}</h4>
                <p>{copy.programs.experienceCopy}</p>
              </section>
              <dl>
                <div><dt>{copy.programs.designed}</dt><dd>{localize(activeProgram[1])}</dd></div>
                <div><dt>{copy.programs.format}</dt><dd>{localize(activeProgram[2])}</dd></div>
              </dl>
              <button className="program-dialog-action" type="button" onClick={() => { dialog.current?.close(); req(activeProgram[0]); }}>{copy.programs.request} <A /></button>
            </div>
          </div>
        )}
      </dialog>
      <aside className="custom">
        <b>✦</b>
        <p>
          <strong>{copy.programs.customTitle}</strong>
          <br />
          {copy.programs.customCopy}
        </p>
        <button onClick={() => req('Custom Program')}>{copy.programs.customAction} →</button>
      </aside>
    </section>
  );
}

function Coaches() {
  const { copy } = useLanguage();
  return (
    <section id="coaches" className="coaches">
      <Skiper30 eyebrow={copy.coaches.eyebrow} images={coachProfiles.map((coach) => coach[2])} title={copy.coaches.title} />
      <div className="section coach-list">
        <p className="coach-intro">{copy.coaches.copy}</p>
        <div className="coach-grid">
          {coachProfiles.map((coach) => (
            <article className="coach-card reveal" key={coach[0]}>
              <NextImage src={coach[2]} alt={coach[0]} width={800} height={800} />
              <div>
                <small>{copy.coaches.role(coach[1])}</small>
                <h3>{coach[0]}</h3>
                <strong>{copy.coaches.focus}: {coach[1]}</strong>
                <p>{copy.coaches.description(coach[1])}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="coach-note">{copy.coaches.note}</p>
      </div>
    </section>
  );
}

function Agenda() {
  const { copy } = useLanguage();
  return (
    <section id="agenda" className="section">
      <Heading
        eyebrow={copy.agenda.eyebrow}
        title={copy.agenda.title}
        copy={copy.agenda.copy}
        fold
      />
      <AgendaCalendar />
    </section>
  );
}

function Activities() {
  const { copy } = useLanguage();
  return (
    <section id="activities" className="activities">
      <Heading
        eyebrow={copy.activities.eyebrow}
        title={copy.activities.title}
        copy={copy.activities.copy}
      />
      <ActivitiesInfiniteScroll />
    </section>
  );
}

function Partners() {
  const { copy } = useLanguage();
  const go = () => {
    dispatchEvent(new CustomEvent('inquiry', { detail: { type: 'School Partnership' } }));
    window.location.assign('#contact');
  };

  return (
    <section id="partners" className="section">
      <Heading
        eyebrow={copy.partners.eyebrow}
        title={copy.partners.title}
        copy={copy.partners.copy}
        fold
      />
      <div className="partner-logo-loop-shell reveal">
        <LogoLoop
          logos={partnerLogoItems}
          speed={48}
          logoHeight={144}
          gap={48}
          pauseOnHover
          fadeOut
          fadeOutColor="#faf9f5"
          scaleOnHover
          ariaLabel={copy.partners.aria}
          className="partner-logo-loop"
        />
      </div>
      <div className="center">
        <button className="btn group" onClick={go}>
          {copy.partners.action} <A />
        </button>
      </div>
    </section>
  );
}

function FAQ() {
  const { copy } = useLanguage();
  return (
    <section id="faq" className="section faq">
      <aside>
        <span className="eyebrow">{copy.faq.eyebrow}</span>
        <h2>
          {copy.faq.title}
          <br />
          <em>{copy.faq.accent}</em>
        </h2>
        <p>{copy.faq.copy}</p>
        <a href="#contact">{copy.faq.ask} →</a>
      </aside>
      <BasicAccordion
        className="faq-accordion"
        defaultExpandedIds={[0]}
        items={copy.faq.items.map(([title, content], id) => ({ id, title, content: <p>{content}</p> }))}
      />
    </section>
  );
}

function Updates() {
  const scroller = useRef<HTMLDivElement>(null);
  const { copy } = useLanguage();

  return (
    <section id="updates" className="section updates">
      <Heading
        eyebrow={copy.updates.eyebrow}
        title={copy.updates.title}
        copy={copy.updates.copy}
        fold
      />
      <div className="updates-controls" aria-label="KRYAcademia Updates navigation">
        <button type="button" onClick={() => scroller.current?.scrollBy({ left: -scroller.current.clientWidth * .9, behavior: 'smooth' })} aria-label={copy.updates.previous}><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => scroller.current?.scrollBy({ left: scroller.current.clientWidth * .9, behavior: 'smooth' })} aria-label={copy.updates.next}><ChevronRight size={20} /></button>
      </div>
      <div className="updates-grid" ref={scroller}>
        {updates.map(([category, title, excerpt, image, href]) => (
          <a className="update-card group" href={href} target="_blank" rel="noreferrer" key={title}>
            <div className="update-card-image">
              <NextImage src={image} alt="" width={768} height={960} />
            </div>
            <div className="update-card-copy">
              <small>{category}</small>
              <h3>{title}</h3>
              <p>{excerpt}</p>
              <span>{copy.updates.read} <A /></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Field({ bad, name, label, children }: { bad: string[]; name: string; label: string; children?: React.ReactNode }) {
  const { copy } = useLanguage();
  return (
    <label className={bad.includes(name) ? 'bad' : ''}>
      <span>
        {label} <b>*</b>
      </span>
      {children || <input name={name} />} {bad.includes(name) && <small>{copy.contact.required}</small>}
    </label>
  );
}

function AnimatedField({ bad, name, label, className = '', ...props }: { bad: string[]; name: string; label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'value'>) {
  const { copy } = useLanguage();
  return (
    <div className={`form-field ${className} ${bad.includes(name) ? 'bad' : ''}`}>
      <AnimatedInput {...props} name={name} label={`${label} *`} required aria-invalid={bad.includes(name)} />
      {bad.includes(name) && <small>{copy.contact.required}</small>}
    </div>
  );
}

function DropdownField({ bad, name, label, value, items, onChange, className = '' }: { bad: string[]; name: string; label: string; value: string; items: readonly (string | readonly [string, string])[]; onChange: (value: string) => void; className?: string }) {
  const { copy } = useLanguage();
  const options: DropdownItem[] = items.map((item) => Array.isArray(item) ? ({ id: item[0], label: item[1] }) : ({ id: item, label: item }));
  const selectedLabel = options.find((item) => item.id === value)?.label;
  return (
    <div className={`form-field ${className} ${bad.includes(name) ? 'bad' : ''}`}>
      <span>{label} <b>*</b></span>
      <BasicDropdown key={`${name}-${value}`} className="form-dropdown" label={selectedLabel || copy.contact.select} items={options} onChange={(item) => onChange(String(item.id))} />
      <input name={name} type="hidden" value={value} />
      {bad.includes(name) && <small>{copy.contact.required}</small>}
    </div>
  );
}

function Contact() {
  const [type, setType] = useState('');
  const [program, setProgram] = useState('');
  const [mode, setMode] = useState('Online');
  const [status, setStatus] = useState('idle');
  const [bad, setBad] = useState<string[]>([]);
  const [affiliation, setAffiliation] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<'' | 'validation' | 'unavailable' | 'rateLimit'>('');
  const pending = useRef(false);
  const submission = useRef({ id: '', data: '' });
  const { copy, language } = useLanguage();

  function edited() {
    if (pending.current) return;
    setStatus('idle');
    setError('');
  }

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setType(d.type);
      setProgram(d.program || '');
      setStatus('idle');
      setError('');
      setBad([]);
      setConsent(false);
      if (d.type === 'School Partnership') setAffiliation('Institution');
    };
    window.addEventListener('inquiry', h);
    return () => window.removeEventListener('inquiry', h);
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending.current || status === 'success') return;
    const d = new FormData(e.currentTarget);
    d.set('language', language);
    const { fields, data } = validateInquiry(d);
    setBad(fields);
    setError('');
    if (fields.length) { setError('validation'); return; }
    const serialized = JSON.stringify(data);
    if (submission.current.data !== serialized) submission.current = { id: crypto.randomUUID(), data: serialized };
    d.set('submission-id', submission.current.id);
    pending.current = true;
    setStatus('loading');
    try {
      const result = await submitInquiry(d);
      if (result.ok) setStatus('success');
      else { setBad(result.fields); setError(result.error); setStatus('idle'); }
    } catch { setError('unavailable'); setStatus('idle'); }
    finally { pending.current = false; }
  };

  return (
    <section id="contact" className="contact">
      <aside>
        <span className="eyebrow">{copy.contact.eyebrow}</span>
        <h2>{copy.contact.title}</h2>
        <p>{copy.contact.copy}</p>
        <Link003 className="contact-link" href="mailto:aha@krya.global"><Mail size={20} aria-hidden />aha@krya.global</Link003>
        <Link003 className="contact-link" href="https://wa.me/6285111212362" target="_blank" rel="noreferrer"><MessageCircle size={20} aria-hidden />+62 851-1121-2362 ({copy.contact.cleo})</Link003>
      </aside>
      <form onSubmit={submit} onChangeCapture={edited} aria-busy={status === 'loading'} noValidate>
        {status === 'success' && <BasicToast type="success" message={copy.contact.success} onClose={() => setStatus('idle')} />}
            <div className="inquiry-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <AnimatedField bad={bad} name="name" label={copy.contact.name} autoComplete="name" maxLength={120} />
            <AnimatedField bad={bad} name="email" label={copy.contact.email} type="email" autoComplete="email" maxLength={254} />
            <AnimatedField bad={bad} name="phone" label={copy.contact.phone} type="tel" placeholder="+62 812 3456 7890" autoComplete="tel" maxLength={30} />
            <AnimatedField bad={bad} name="place" label={copy.contact.place} autoComplete="address-level2" maxLength={120} />
            <DropdownField bad={bad} name="type" label={copy.contact.type} value={type} items={['Workshop', 'Klass', 'Program', 'School Partnership', 'Event', ['Other', copy.contact.other]]} onChange={(value) => { edited(); setType(value); setProgram(''); }} />
            {affiliation === 'Institution' ? (
              <div className="institution-field">
                <AnimatedField bad={bad} name="institution" label={copy.contact.institutionName} placeholder={copy.contact.institutionPlaceholder} autoComplete="organization" maxLength={180} autoFocus />
                <input type="hidden" name="affiliation" value="Institution" />
                <button className="institution-reset" type="button" onClick={() => { edited(); setAffiliation(''); }} aria-label={copy.contact.changeInstitution} title={copy.contact.changeInstitution}><X size={17} /></button>
              </div>
            ) : (
              <DropdownField bad={bad} name="affiliation" label={copy.contact.institution} value={affiliation} items={['Institution', ['Parent', copy.contact.parent], ['Non-institution', copy.contact.nonInstitution]]} onChange={(value) => { edited(); setAffiliation(value); }} />
            )}
            {type === 'Klass' && (
              <>
                <DropdownField bad={bad} name="klass" label={copy.contact.klass} value={program} items={klasses.map((x) => x[0])} onChange={(value) => { edited(); setProgram(value); }} />
                <DropdownField bad={bad} name="mode" label={copy.contact.mode} value={mode} items={['Online', 'Onsite']} onChange={(value) => { edited(); setMode(value); }} />
              </>
            )}
            {type === 'Program' && (
              <DropdownField bad={bad} className="full" name="program" label={copy.contact.program} value={program} items={[...programs.map((x) => x[0]), ['Custom Program', copy.contact.customProgram]]} onChange={(value) => { edited(); setProgram(value); }} />
            )}
            {type === 'School Partnership' && (
              <AnimatedField bad={bad} name="school-level" label={copy.contact.schoolLevel} maxLength={180} />
            )}
            {['Workshop', 'Event', 'Other'].includes(type) && (
              <AnimatedField bad={bad} className="full" name="request" maxLength={1000} label={type === 'Workshop'
                    ? copy.contact.workshop
                    : type === 'Event'
                    ? copy.contact.event
                    : copy.contact.specify} />
            )}
            <Field bad={bad} name="message" label={copy.contact.message}>
              <textarea name="message" rows={4} required maxLength={5000} aria-invalid={bad.includes('message')} />
            </Field>
            <label className={'consent ' + (bad.includes('consent') ? 'bad' : '')}>
              <Checkbox id="consent" name="consent" value="yes" checked={consent} onCheckedChange={(value) => { edited(); setConsent(value); }} required />
              <span>{copy.contact.consent} *</span>
            </label>
            {error && <p className="inquiry-error full" role="alert">{copy.contact[error]}</p>}
            <InteractiveHoverButton className="submit" disabled={status === 'loading' || status === 'success'} type="submit">
              {status === 'loading' ? copy.contact.sending : copy.contact.send}
            </InteractiveHoverButton>
            <p className="note">{copy.contact.note}</p>
      </form>
    </section>
  );
}

function Footer() {
  const { copy } = useLanguage();
  return (
    <footer className="footer">
      <div>
        <section>
          <Brand light />
          <p>{copy.footer.copy}</p>
        </section>
        <section>
          <h3>{copy.footer.explore}</h3>
          {nav.slice(0, 5).map((id) => (
            <Link003 href={'#' + id} key={id}>
              {copy.nav[id]}
            </Link003>
          ))}
        </section>
        <section>
          <h3>{copy.footer.discover}</h3>
          <Link003 href="#klass">{copy.footer.online}</Link003>
          <Link003 href="#klass">{copy.footer.onsite}</Link003>
          <Link003 href="#programs">{copy.nav.programs}</Link003>
          <Link003 href="/login">{copy.footer.portal}</Link003>
        </section>
        <section>
          <h3>{copy.footer.visit}</h3>
          <p>AD Kavling 3, Jl. Kupang Jaya I, Sonokwijenan, Sukomanunggal, Surabaya, East Java 60189, Indonesia</p>
          <Link003 href="mailto:aha@krya.global">aha@krya.global</Link003>
          <Link003 href="https://wa.me/6285111212362" target="_blank" rel="noreferrer">+62 851-1121-2362</Link003>
        </section>
      </div>
      <aside>
        © 2026 KRYAcademia. {copy.footer.rights} <Link003 href="#home">{copy.footer.back} ↑</Link003>
      </aside>
    </footer>
  );
}

function LandingPage() {
  const cursorGlow = useRef<HTMLDivElement>(null);
  const { copy } = useLanguage();

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

  useEffect(() => {
    const glow = cursorGlow.current;
    if (!glow || matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const move = ({ clientX, clientY }: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        glow.style.setProperty('--cursor-x', `${clientX}px`);
        glow.style.setProperty('--cursor-y', `${clientY}px`);
        glow.dataset.active = 'true';
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return (
    <>
      <div ref={cursorGlow} className="cursor-glow" aria-hidden="true" />
      <Navbar />
      <main>
        <Hero />
        <section className="impact reveal">
          <div>
            <AnimatedCounter end={141} />
            <span>{copy.stats.students}</span>
          </div>
          <div>
            <AnimatedCounter end={7} />
            <span>{copy.stats.partners}</span>
          </div>
          <div>
            <AnimatedCounter end={programs.length} />
            <span>{copy.stats.programs}</span>
          </div>
          <div>
            <AnimatedCounter end={klasses.length} />
            <span>{copy.stats.klass}</span>
          </div>
        </section>
        <Klass />
        <Purpose />
        <Programs />
        <Coaches />
        <Agenda />
        <Activities />
        <Partners />
        <Updates />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

export default function Home() {
  return <LanguageProvider><LandingPage /></LanguageProvider>;
}
