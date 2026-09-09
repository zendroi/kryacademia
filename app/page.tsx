"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Globe2,
  Mail,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Search as SearchIcon,
  Sparkles,
  X,
} from "lucide-react";
import { events, faqs, img, klasses, partners, programs } from "./mockData";
import FoldText from "./FoldText";
import StaggeredMenu from "./StaggeredMenu";
import LogoLoop, { type LogoItem } from "@/components/LogoLoop";
import ScrollReveal from "@/components/ScrollReveal";
import Reveal from "./Reveal";

const WhyLens = dynamic(() => import("./WhyKryacademiaLens"), {
  ssr: false,
  loading: () => <Image src="/activities/sustainability.jpg" alt="Students learning creative coding" fill sizes="100vw" />,
});
const ActivityGallery = dynamic(() => import("./ActivitiesInfiniteScroll"), {
  ssr: false,
  loading: () => <Image src="/activities/collaboration.jpg" alt="Hands-on learning at KRYAcademia" fill sizes="100vw" />,
});
const nav = [
  ["Home", "home"],
  ["Klass", "klass"],
  ["Programs", "programs"],
  ["Agenda", "agenda"],
  ["Activities", "activities"],
  ["Partner Schools", "partners"],
  ["FAQ", "faq"],
  ["Contact", "contact"],
];
const partnerLogos: LogoItem[] = partners.map((school) => ({
  node: (
    <span className="partner-school-mark">
      <span className="partner-school-monogram" aria-hidden="true">
        {school
          .split(" ")
          .map((word) => word[0])
          .slice(0, 3)
          .join("")}
      </span>
      <strong>{school}</strong>
    </span>
  ),
  title: school,
  ariaLabel: school,
}));

function inquire(type: string, interest = "") {
  window.dispatchEvent(
    new CustomEvent("inquiry", { detail: { type, interest } }),
  );
  document
    .getElementById("contact")
    ?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  document.getElementById("inquiry-name")?.focus({ preventScroll: true });
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`brand ${light ? "light" : ""}`}
      href="#home"
      aria-label="KRYAcademia home"
    >
      <b aria-hidden="true">K</b>
      <span>
        KRYAcademia<small>BY KRYA GLOBAL</small>
      </span>
    </a>
  );
}

function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a className={`btn ${secondary ? "btn-secondary" : ""}`} href={href}>
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </a>
  );
}

function SectionHeading({
  number,
  label,
  title,
  copy,
}: {
  number: string;
  label: string;
  title: string;
  copy?: string;
}) {
  return (
    <header className="section-heading">
      <div>
        <span className="eyebrow">
          <span>{number}</span>
          {label}
        </span>
        <h2>
          <FoldText
            text={title}
            trigger="scroll"
            duration={0.65}
            stagger={0.025}
          />
        </h2>
      </div>
      {copy && <p>{copy}</p>}
    </header>
  );
}

function Navbar({ onSearch }: { onSearch: () => void }) {
  const [active, setActive] = useState("home");
  useEffect(() => {
    const update = () => {
      let current = "home";
      nav.forEach(([, id]) => {
        if (
          (document.getElementById(id)?.getBoundingClientRect().top ??
            Infinity) < 180
        )
          current = id;
      });
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className="navbar">
      <Brand />
      <nav aria-label="Main navigation">
        {nav.slice(1, 5).map(([label, id]) => (
          <a
            href={`#${id}`}
            key={id}
            aria-current={active === id ? "location" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="nav-actions">
        <button
          className="icon-button"
          aria-label="Search KRYAcademia"
          title="Search"
          onClick={onSearch}
        >
          <SearchIcon size={20} />
        </button>
        <a className="nav-contact" href="#contact">
          Let&apos;s talk
          <ArrowUpRight size={17} />
        </a>
        <StaggeredMenu
          items={nav.map(([label, id]) => ({
            label,
            ariaLabel: `Go to ${label}`,
            link: `#${id}`,
          }))}
          socialItems={[
            { label: "Teacher & Admin Portal", link: "/login" },
            { label: "Instagram", link: "https://instagram.com/krya.global" },
            { label: "WhatsApp", link: "https://wa.me/628172362236" },
          ]}
          colors={["#c9eadd", "#edecab", "#e8001b"]}
          accentColor="#e8001b"
        />
      </div>
    </header>
  );
}

function Search({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  const results = [
    ...klasses.map((x) => ["Klass", x[0], "klass"]),
    ...programs.map((x) => ["Program", x[0], "programs"]),
    ...partners.map((x) => ["Partner School", x, "partners"]),
  ]
    .filter((x) => x[1].toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 7);
  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-labelledby="search-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-content">
        <div className="dialog-heading">
          <h2 id="search-title">Find your next discovery.</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close search"
            title="Close"
          >
            <X />
          </button>
        </div>
        <label className="search-field">
          <SearchIcon />
          <input
            autoFocus
            aria-label="Search classes, programs and schools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes, programs, schools..."
          />
        </label>
        <p className="search-count" aria-live="polite">
          {query ? `${results.length} matching results` : "Explore KRYAcademia"}
        </p>
        <ul>
          {results.map(([type, title, id]) => (
            <li key={title}>
              <a href={`#${id}`} onClick={onClose}>
                <span>
                  <small>{type}</small>
                  <strong>{title}</strong>
                </span>
                <ArrowUpRight size={20} />
              </a>
            </li>
          ))}
        </ul>
        {!results.length && (
          <p className="empty-state">
            No matches yet. Try coding, holiday, or a school name.
          </p>
        )}
      </div>
    </dialog>
  );
}

function Hero() {
  return (
    <section id="home" className="hero" aria-labelledby="hero-title">
      <Image
        className="hero-photo"
        src={img.hero}
        alt="A KRYAcademia educator helping a student build a hands-on project in the classroom"
        fill
        priority
        sizes="100vw"
      />
      <div className="hero-shade" />
      <div className="hero-top">
        <span className="hero-label">
          <span />
          THE 21ST EDUCATION CENTER
        </span>
        <span className="hero-location">
          SURABAYA, INDONESIA
          <Globe2 size={16} />
        </span>
      </div>
      <div className="hero-content">
        <p className="hero-kicker">Big ideas start with a little curiosity.</p>
        <h1 id="hero-title">
          KRYAcademia<span className="hero-dot">.</span>
        </h1>
        <div className="hero-bottom">
          <p>
            A space to explore, create, and become.
            <br />
            Real projects. New possibilities. Your next chapter.
          </p>
          <Action href="#klass">Find your Klass</Action>
        </div>
      </div>
      <a
        className="hero-explore"
        href="#activities"
        aria-label="Explore our activities"
      >
        <ArrowDown size={20} />
        <span>Life at KRYAcademia</span>
      </a>
    </section>
  );
}

function Impact() {
  return (
    <section className="impact" aria-label="KRYAcademia at a glance">
      <p>
        Small beginnings.
        <br />
        <strong>Meaningful possibilities.</strong>
      </p>
      <div>
        <b>
          141<span>+</span>
        </b>
        <span>Students learning by doing</span>
      </div>
      <div>
        <b>07</b>
        <span>Partner school communities</span>
      </div>
      <div>
        <b>04</b>
        <span>Ways to start your journey</span>
      </div>
    </section>
  );
}

function Klass() {
  const [mode, setMode] = useState("All");
  const [category, setCategory] = useState("All subjects");
  const items = klasses.filter(
    (x) =>
      (mode === "All" || x[1] === mode) &&
      (category === "All subjects" || x[2] === category),
  );
  return (
    <section id="klass" className="section klass-section">
      <SectionHeading
        number="01"
        label="FIND YOUR SPARK"
        title="Your next Klass."
        copy="A new skill. A fresh perspective. Explore creative experiences made for curious young minds."
      />
      <div className="filters">
        <div className="segmented" role="group" aria-label="Learning mode">
          {["All", "Online", "Onsite"].map((x) => (
            <button
              key={x}
              aria-pressed={mode === x}
              onClick={() => setMode(x)}
            >
              {x === "All" ? "All classes" : x}
            </button>
          ))}
        </div>
        <label className="subject-filter">
          <span>Subject</span>
          <select
            aria-label="Filter by subject"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "All subjects",
              "Innovation & Creativity",
              "Technology",
              "Art & Language",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="result-meta" aria-live="polite">
        <span>
          {String(items.length).padStart(2, "0")} experiences to explore
        </span>
        <span>CREATIVITY HAS NO SINGLE PATH</span>
      </div>
      <div className="klass-grid">
        {items.map((x) => (
          <Reveal key={x[0]} className="klass-item">
            <article>
              <div
                className={`klass-image ${x[4].endsWith(".png") ? "illustration" : ""}`}
              >
                <Image
                  src={x[4]}
                  alt={x[0]}
                  width={720}
                  height={540}
                  sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                />
                {x[3] && <span className="status-label">{x[3]}</span>}
                <span className="mode-label">
                  {x[1] === "Online" ? (
                    <Globe2 size={13} />
                  ) : (
                    <MapPin size={13} />
                  )}
                  {x[1]}
                </span>
              </div>
              <div className="klass-body">
                <small>{x[2]}</small>
                <h3>{x[0]}</h3>
                <p>{x[5]}</p>
                <button
                  className="text-action"
                  onClick={() => inquire("Klass", x[0])}
                >
                  {x[3] === "Coming Soon"
                    ? "Ask about availability"
                    : "Explore this Klass"}
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      {!items.length && (
        <div className="empty-state">
          <h3>A different path is waiting.</h3>
          <p>No classes match this combination yet.</p>
          <button
            className="text-action"
            onClick={() => {
              setMode("All");
              setCategory("All subjects");
            }}
          >
            See all classes
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}

function SceneExperience({ kind }: { kind: "why" | "activities" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) setReady(true);
      },
      { rootMargin: "200px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`scene-slot scene-${kind}`}>
      {ready ? (
        kind === "why" ? (
          <WhyLens active={active} />
        ) : (
          <ActivityGallery active={active} />
        )
      ) : (
        <Image
          src={
            kind === "why"
              ? "/activities/collaboration.jpg"
              : "/activities/sustainability.jpg"
          }
          alt="Students exploring ideas together at KRYAcademia"
          fill
          sizes="100vw"
        />
      )}
    </div>
  );
}

function Purpose() {
  return (
    <section id="why" className="purpose">
      <div className="section why-intro">
        <SectionHeading
          number="02"
          label="LEARNING WITH PURPOSE"
          title="Why KRYAcademia?"
        />
        <ScrollReveal
          baseOpacity={0.3}
          baseRotation={0}
          enableBlur={false}
          wordAnimationEnd="bottom 75%"
        >
          Learning should prepare young people to shape the world. Through
          creative, project-based experiences, curiosity becomes something they
          can use beyond the classroom.
        </ScrollReveal>
      </div>
      <SceneExperience kind="why" />
      <div className="section why-principles">
        {[
          [
            "Our background",
            "Curiosity becomes capability.",
            "Young people need opportunities to connect what they learn with the world around them. KRYAcademia brings technology, art, and hands-on making together, using real challenges to build practical skills and a sense of purpose.",
          ],
          [
            "Our vision",
            "A future made by doing.",
            "We envision thoughtful, confident creators who contribute to a sustainable future. Students learn to question, imagine possibilities, and consider how their ideas affect other people and the environment.",
          ],
          [
            "Our mission",
            "Learn, make, and share.",
            "We develop critical thinking, creativity, confidence, and collaboration through project-based learning. Students explore a challenge, build and test their ideas, improve their work, and share what they discover.",
          ],
        ].map(([label, title, copy], i) => (
          <Reveal key={label}>
            <article>
              <span className="principle-number">
                0{i + 1}
                <ArrowUpRight size={24} />
              </span>
              <small>{label}</small>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="sdg-band">
        <Reveal className="sdg-reveal">
          <figure className="why-sdgs-figure">
            <Image
              src="/sdg-goals.png"
              alt="The 17 United Nations Sustainable Development Goals"
              width={1350}
              height={500}
              sizes="(max-width: 700px) 100vw, 850px"
              draggable={false}
            />
            <figcaption>
              KRYAcademia connects creative, project-based learning with the
              SDGs to inspire a more sustainable future.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

function Programs() {
  return (
    <section id="programs" className="section programs-section">
      <SectionHeading
        number="03"
        label="MAKE ROOM FOR DISCOVERY"
        title="A journey for everyone."
        copy="School days, weekends, and everything in between. Learning that meets you where you are."
      />
      <div className="program-list">
        {programs.map((x, i) => (
          <Reveal key={x[0]}>
            <article className="program-row">
              <span className="program-number">0{i + 1}</span>
              <div
                className={`program-image ${x[3].endsWith(".png") ? "illustration" : ""}`}
              >
                <Image
                  src={x[3]}
                  alt={x[0]}
                  width={400}
                  height={300}
                  sizes="(max-width: 700px) 38vw, 190px"
                />
              </div>
              <div className="program-description">
                <small>{x[1]}</small>
                <h3>{x[0]}</h3>
                <p>{x[4]}</p>
                <span className="program-mode">
                  <MapPin size={14} />
                  {x[2]}
                </span>
              </div>
              <button
                className="program-action icon-button"
                onClick={() => inquire("Program", x[0])}
                title={`Ask about ${x[0]}`}
                aria-label={`Ask about ${x[0]}`}
              >
                <ArrowUpRight />
              </button>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="custom-program">
        <Sparkles size={31} aria-hidden="true" />
        <p>
          <strong>Something uniquely yours?</strong>
          <span>Let&apos;s shape a custom learning experience for your school.</span>
        </p>
        <button
          className="text-action"
          onClick={() => inquire("Program", "Custom Program")}
        >
          Start a conversation
          <ArrowUpRight size={20} />
        </button>
      </div>
    </section>
  );
}

function Agenda() {
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [tab, setTab] = useState("All events");
  const [today] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  });
  const monthEvents = year === 2026 && month === 8 ? events : [];
  const filtered = monthEvents.filter(
    (e) =>
      (selectedDay === null || Number(e[0]) === selectedDay) &&
      (tab === "All events" ||
        new Date(year, month, Number(e[0])).getTime() >= today ===
          (tab === "Upcoming")),
  );
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    setSelectedDay(null);
  };
  return (
    <section id="agenda" className="section agenda-section">
      <SectionHeading
        number="04"
        label="ON THE CALENDAR"
        title="Good things ahead."
        copy="Open classes, creative workshops, and moments worth sharing. Explore our sample agenda."
      />
      <div className="agenda-layout">
        <div className="calendar">
          <header>
            <h3>{monthName}</h3>
            <div>
              <button
                className="icon-button"
                aria-label="Previous month"
                title="Previous month"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                title="Next month"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </header>
          <div className="calendar-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span className="weekday" key={`day-${i}`}>
                {d}
              </span>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const hasEvent = monthEvents.some((e) => Number(e[0]) === day);
              return (
                <button
                  key={day}
                  className={hasEvent ? "has-event" : ""}
                  aria-pressed={selectedDay === day}
                  aria-label={`${monthName} ${day}${hasEvent ? ", event scheduled" : ""}`}
                  onClick={() =>
                    setSelectedDay(selectedDay === day ? null : day)
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="calendar-footer">
            <span>
              <i />
              Sample event
            </span>
            {selectedDay !== null && (
              <button onClick={() => setSelectedDay(null)}>
                Clear date
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="agenda-events">
          <div
            className="agenda-tabs segmented"
            role="group"
            aria-label="Event period"
          >
            {["All events", "Upcoming", "Past"].map((x) => (
              <button
                key={x}
                aria-pressed={tab === x}
                onClick={() => setTab(x)}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="event-list" aria-live="polite">
            {filtered.map((e) => (
              <article className="event-row" key={e[0]}>
                <div className="event-date">
                  <strong>{e[0]}</strong>
                  <span>SEP</span>
                </div>
                <div>
                  <small>
                    {e[2]}
                    <span>/ {e[3]}</span>
                  </small>
                  <h3>{e[1]}</h3>
                  <p>
                    <Clock3 size={13} />
                    {e[4]}
                  </p>
                  {e[5] === "Registration Closed" && (
                    <span className="closed-label">Registration closed</span>
                  )}
                </div>
                <button
                  className="icon-button"
                  title={`Ask about ${e[1]}`}
                  aria-label={`Ask about ${e[1]}`}
                  onClick={() => inquire("Event", e[1])}
                >
                  <ArrowUpRight size={20} />
                </button>
              </article>
            ))}
            {!filtered.length && (
              <div className="empty-state">
                <p>No sample events for this selection.</p>
                <button
                  className="text-action"
                  onClick={() => {
                    setMonth(8);
                    setYear(2026);
                    setSelectedDay(null);
                    setTab("All events");
                  }}
                >
                  See the sample agenda
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
          <p className="note">
            Sample dates only. Please contact our team for the current schedule
            and availability.
          </p>
        </div>
      </div>
    </section>
  );
}

function Activities() {
  return (
    <section id="activities" className="activities">
      <div className="section activities-heading">
        <SectionHeading
          number="05"
          label="LIFE AT KRYACADEMIA"
          title="Little moments. Big ideas."
          copy="A closer look at our activities, where questions become experiments and ideas take shape together."
        />
      </div>
      <SceneExperience kind="activities" />
      <div className="activities-bottom">
        <span>OUR ACTIVITIES</span>
        <a className="text-action" href="#contact">
          Be part of the next chapter
          <ArrowUpRight size={19} />
        </a>
      </div>
    </section>
  );
}

function Partners() {
  const [paused, setPaused] = useState(false);
  return (
    <section id="partners" className="section partners-section">
      <SectionHeading
        number="06"
        label="TOGETHER, FURTHER"
        title="Partner Schools."
        copy="Different communities. A shared belief in what young people can become."
      />
      <div className="partner-logo-loop-shell">
        <LogoLoop
          logos={partnerLogos}
          speed={paused ? 0 : 48}
          logoHeight={78}
          gap={48}
          pauseOnHover
          fadeOut
          fadeOutColor="#ffffff"
          ariaLabel="KRYAcademia partner schools"
          className="partner-logo-loop"
        />
      </div>
      <div className="partner-footer">
        <button
          className="text-action"
          onClick={() => inquire("School Partnership")}
        >
          Let&apos;s build something together
          <ArrowUpRight size={19} />
        </button>
        <button
          className="icon-button loop-toggle"
          aria-label={
            paused ? "Play partner animation" : "Pause partner animation"
          }
          title={paused ? "Play animation" : "Pause animation"}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
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
        <span className="eyebrow">
          <span>07</span>A LITTLE CLARITY
        </span>
        <h2>
          Curious?
          <br />
          <em>Good.</em>
        </h2>
        <p>
          A few answers before
          <br />
          your next adventure.
        </p>
        <a className="text-action" href="#contact">
          Ask us anything
          <ArrowUpRight size={19} />
        </a>
      </aside>
      <div className="faq-list">
        {faqs.map(([q, a], i) => (
          <article key={q} className={open === i ? "open" : ""}>
            <h3>
              <button
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span className="faq-number">0{i + 1}</span>
                <span>{q}</span>
                {open === i ? <Minus size={19} /> : <Plus size={19} />}
              </button>
            </h3>
            <div id={`faq-answer-${i}`} hidden={open !== i}>
              <p>{a}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const [type, setType] = useState("");
  const [interest, setInterest] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; interest: string }>)
        .detail;
      setType(detail.type);
      setInterest(detail.interest);
      setDone(false);
    };
    window.addEventListener("inquiry", handle);
    return () => window.removeEventListener("inquiry", handle);
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDone(true);
  };
  return (
    <section id="contact" className="section contact">
      <aside>
        <span className="eyebrow">
          <span>08</span>LET&apos;S TALK
        </span>
        <h2>
          The next idea
          <br />
          starts <em>here.</em>
        </h2>
        <p>
          Looking for a Klass, a school partnership, or something entirely new?
          We&apos;d love to hear about it.
        </p>
        <a href="mailto:aha@krya.global">
          <Mail size={20} />
          <span>
            <small>WRITE TO US</small>aha@krya.global
          </span>
          <ArrowUpRight size={18} />
        </a>
        <a href="https://wa.me/628172362236" target="_blank" rel="noreferrer">
          <Globe2 size={20} />
          <span>
            <small>LET&apos;S CONNECT ON WHATSAPP</small>+62 817-2362-236
          </span>
          <ArrowUpRight size={18} />
        </a>
      </aside>
      <div className="contact-form-area">
        {done ? (
          <div className="form-success" role="status">
            <CircleCheck size={42} />
            <h3>Your inquiry is ready.</h3>
            <p>
              This is a prototype form. Your information has not been sent or
              stored. Contact our team by email or WhatsApp to continue.
            </p>
            <a className="btn" href="mailto:aha@krya.global">
              Email the team
              <ArrowUpRight size={18} />
            </a>
            <button className="text-action" onClick={() => setDone(false)}>
              Back to inquiry
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-heading">
              <h3>Tell us a little about you.</h3>
              <span>All fields marked * are required.</span>
            </div>
            <label>
              <span>Full name *</span>
              <input
                id="inquiry-name"
                name="name"
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span>Email address *</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>WhatsApp number *</span>
              <input name="phone" type="tel" autoComplete="tel" required />
            </label>
            <label>
              <span>City / Country *</span>
              <input name="place" autoComplete="address-level2" required />
            </label>
            <label>
              <span>I&apos;m interested in *</span>
              <select
                name="type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setInterest("");
                }}
                required
              >
                <option value="">Select an inquiry</option>
                {[
                  "Klass",
                  "Program",
                  "School Partnership",
                  "Workshop",
                  "Event",
                  "Other",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Preferred language *</span>
              <select name="language" required defaultValue="">
                <option value="">Select a language</option>
                <option>English</option>
                <option>Indonesian</option>
              </select>
            </label>
            {type && (
              <label className="full">
                <span>
                  {type === "School Partnership"
                    ? "School / Institution"
                    : "Experience or topic of interest"}
                </span>
                {["Klass", "Program"].includes(type) ? (
                  <select
                    name="interest"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                  >
                    <option value="">Select an experience</option>
                    {(type === "Klass" ? klasses : programs).map((x) => (
                      <option key={x[0]}>{x[0]}</option>
                    ))}
                    {type === "Program" && <option>Custom Program</option>}
                  </select>
                ) : (
                  <input
                    name="interest"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                  />
                )}
              </label>
            )}
            {type === "Klass" && (
              <label className="full">
                <span>Preferred mode</span>
                <select name="mode">
                  <option>Online</option>
                  <option>Onsite</option>
                  <option>No preference</option>
                </select>
              </label>
            )}
            <label className="full">
              <span>What do you have in mind? *</span>
              <textarea name="message" rows={3} required />
            </label>
            <label className="consent full">
              <input type="checkbox" name="consent" required />
              <span>
                I agree that KRYAcademia may use this information to respond. *
              </span>
            </label>
            <div className="form-submit full">
              <button className="btn" type="submit">
                Preview inquiry
                <Check size={18} />
              </button>
              <p className="note">
                Prototype only.
                <br />
                No information is sent to a server.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Brand light />
          <p>
            Creative minds.
            <br />
            Meaningful futures.
          </p>
          <a
            href="https://krya.global"
            target="_blank"
            rel="noreferrer"
            className="text-action"
          >
            An initiative by KRYA Global
            <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="footer-links">
          <h3>Explore</h3>
          {nav.slice(1, 5).map(([label, id]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </div>
        <div className="footer-links">
          <h3>Connect</h3>
          <a href="#partners">Partner Schools</a>
          <a href="#faq">FAQs</a>
          <a href="#contact">Contact</a>
          <a href="/login">Teacher & Admin Portal</a>
        </div>
        <div className="footer-address">
          <h3>Come say hello.</h3>
          <p>
            AD Kavling 3, Jl. Kupang Jaya I,
            <br />
            Sonokwijenan, Sukomanunggal,
            <br />
            Surabaya, East Java 60189,
            <br />
            Indonesia
          </p>
          <a href="mailto:aha@krya.global">
            aha@krya.global
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        KRYAcademia<span>.</span>
      </div>
      <div className="footer-bottom">
        <span>&copy; 2026 KRYA Global. All rights reserved.</span>
        <a href="#home">
          Back to top
          <ArrowUp size={16} />
        </a>
      </div>
    </footer>
  );
}

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#klass">
        Skip to learning experiences
      </a>
      <Navbar onSearch={() => setSearchOpen(true)} />
      {searchOpen && <Search onClose={() => setSearchOpen(false)} />}
      <main>
        <Hero />
        <Impact />
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
