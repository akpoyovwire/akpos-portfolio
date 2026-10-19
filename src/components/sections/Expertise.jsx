import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useAnimationControls } from "framer-motion"
import {
  Code2, ShieldCheck, BrainCircuit, FileSearch, MessageCircle,
  Sparkles, FileText, PenSquare, Presentation, Award,
} from "lucide-react"
import {
  FaHtml5, FaCss3Alt, FaJsSquare, FaReact, FaNodeJs, FaPython, FaJava, FaGitAlt, FaGithub, FaDocker,
} from "react-icons/fa"
import {
  SiTypescript, SiTailwindcss, SiBootstrap, SiExpress, SiPostgresql, SiMysql, SiSupabase,
  SiHuggingface,
} from "react-icons/si"

/*
  Expertise
  One section, five clickable icons: Development, Security, AI & ML,
  Research, Rhetoric.

  CLOSED   "Expertise" heading + the five icons in a row, centred.
  OPEN     the clicked icon travels to the top-centre, spinning and glowing.
           The other four sit in a column down the left edge. Clicking the open
           icon closes it; clicking one in the column swaps places with it.
           (All of that movement is unchanged: layoutId wrappers, the `stack`
           array, the hello pulse, the Lenis scroll handling.)

  OPEN LAYOUT (desktop, three columns)
    LEFT    top     the introduction (+ the quote, no casing, where there is one)
            bottom  Development: the tech icon groups
                    Security: frameworks + certifications (plain text, no boxes)
                    AI: the tool icons, no label, raised up under the quote
                    Research: the research outputs (no label, no boxes)
                    Rhetoric: nothing
    MIDDLE  the discipline image, big, and it pops open from nothing
            (scale 0 -> 1, spring) every time a discipline is opened.
    RIGHT   the capabilities as very big uppercase lines filling the right side.
            The one-line descriptions are kept as hover tooltips (title).
    BEHIND  the discipline's icon, huge and grey, twice: top right + bottom left.
  On phones the three columns simply stack.

  LOGO FILES (optional, drop into /public/logos/)
  OpenAI loads /logos/openai.svg and falls back to a line icon until it exists.
*/

const SECTION_LABEL = "text-[10px] uppercase tracking-[0.14em] text-zinc-500"

/* ---------- small building blocks ---------- */

const TechIcon = ({ Icon, color, label, size = 20 }) => (
  <div className="flex flex-col items-center gap-1" style={{ width: size + 24 }}>
    <Icon size={size} color={color} />
    <span className="text-[9px] text-zinc-400 text-center leading-tight">{label}</span>
  </div>
)

// real logo file if present, line icon until then
const FileLogo = ({ file, Fallback, label, size = 20 }) => {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 24 }}>
      {failed ? (
        <Fallback size={size} className="text-zinc-300" />
      ) : (
        <img
          src={`/logos/${file}`}
          alt=""
          width={size}
          height={size}
          className="object-contain"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      )}
      <span className="text-[9px] text-zinc-400 text-center leading-tight">{label}</span>
    </div>
  )
}

// plain labelled group (no box), used for the small icon rows bottom-left

const Group = ({ label, children, iconLayout = "flex flex-wrap" }) => (
  <div className="min-w-0">
    <p className={`${SECTION_LABEL} mb-1.5`}>{label}</p>
    <div className={`${iconLayout} gap-y-1.5`}>
      {children}
    </div>
  </div>
)


// a research output: icon + title + line, no box
const OutputCard = ({ Icon, label, desc, accent }) => (
  <div className="flex gap-3 items-start w-full">
    <Icon size={18} color={accent} className="shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[14px] tracking-wide text-zinc-100 leading-tight">{label}</p>
      <p className="text-[12px] text-zinc-400 leading-snug mt-1">{desc}</p>
    </div>
  </div>
)

// the quote: no box, no border. Just the big quotation mark, the words, the author.
const Quote = ({ text, accent, author }) => (
  <blockquote className="relative pl-9 pr-1 py-1">
    <span
      aria-hidden="true"
      className="absolute left-0 -top-1 font-serif text-5xl leading-none"
      style={{ color: accent, opacity: 0.85 }}
    >
      &ldquo;
    </span>
    <p className="italic text-[13px] lg:text-[14px] leading-snug text-zinc-50">{text}</p>
    {author && (
      <p className="mt-2 flex items-center justify-end gap-2 text-[12px] italic tracking-wide text-zinc-400">
        <span aria-hidden="true" className="inline-block h-px w-5 bg-zinc-400" />
        {author}
      </p>
    )}
  </blockquote>
)

/* ---------- the five disciplines ---------- */

const EXPERTISE = [
  {
    id: "development",
    label: "Development",
    Icon: Code2,
    icon: <Code2 size={30} color="#61DBFB" />,
    border: "#61DBFB",
    shadow: "rgba(97, 219, 251, 0.6)",
    image: "/images/devexp.jpg",
    intro: [
      "I build full-stack applications that turn ideas into working digital products. My work spans frontend interfaces, backend systems, databases and API integration, so I can take a product from the screen the user sees to the systems that power it.",
      "I focus on applications that are responsive, intuitive and maintainable: designing how components interact, tracing and fixing what breaks, and deploying solutions that solve real problems.",
    ],
  },
  {
    id: "security",
    label: "Security",
    Icon: ShieldCheck,
    icon: <ShieldCheck size={30} color="#EF4444" />,
    border: "#EF4444",
    shadow: "rgba(239, 68, 68, 0.6)",
    image: "/images/secexp.jpg",
    intro: [
      "I approach cybersecurity by understanding how systems really work, finding where they can be broken, and building practical ways to strengthen them. My work spans ethical hacking, penetration testing, vulnerability assessment, web and network security, and defensive monitoring.",
      "I examine systems from both sides: how a weakness is exploited, what risk it creates, and how to close it. I build with protection in mind from the start, never as an afterthought.",
    ],
  },
  {
    id: "ai",
    label: "AI & Machine Learning",
    Icon: BrainCircuit,
    icon: <BrainCircuit size={30} color="#A78BFA" />,
    border: "#A78BFA",
    shadow: "rgba(167, 139, 250, 0.6)",
    image: "/images/aiexp.jpg",
    intro: [
      "I work at the intersection of AI, software development and research, putting intelligent systems to work on practical problems. My focus spans machine learning, research and technical writing, model experimentation, and integrating AI services into real applications.",
      "AI will shape how people live, work, create and solve problems, and I intend to master it rather than simply keep up. Understanding what it can do, and applying it with purpose, is how we make that change work for us.",
    ],
    quote:
      "AI is a storm we must learn to weather, harness, and ultimately shape.",
    author: "Ogbon Akpoyovwire",
  },
  {
    id: "research",
    label: "Research",
    Icon: FileSearch,
    icon: <FileSearch size={30} color="#43bc88" />,
    border: "#43bc88",
    shadow: "rgba(67, 188, 136, 0.6)",
    image: "/images/resexp.jpg",
    intro: [
      "I treat research as a structured way to investigate problems, test existing knowledge and arrive at informed conclusions. I define the problem, frame the questions and objectives, review the literature, and organise what I find into clear, documented outputs.",
      "Evidence comes first for me. I examine sources, compare perspectives and weigh credibility so my conclusions are logical and well supported. Research is where curiosity meets critical thinking, and where better decisions begin.",
    ],
  },
  {
    id: "rhetoric",
    label: "Rhetoric",
    Icon: MessageCircle,
    icon: <MessageCircle size={30} color="#F59E0B" />,
    border: "#F59E0B",
    shadow: "rgba(245, 158, 11, 0.6)",
    image: "/images/rhetexp.jpg",
    intro: [
      "I see communication as more than passing on information. It shapes perspectives, challenges assumptions and changes how people think. Through teaching, writing, presentations and mentorship, I make complex ideas understandable and invite people to examine them for themselves.",
      "My approach rests on clarity, sound reasoning and a real understanding of the audience. Whether I'm explaining a technical concept, making an argument or guiding someone through a hard subject, my aim is to equip people to think independently and reach their own conclusions.",
    ],
    quote:
      "Meaningful influence is not about telling people what to think, but helping them think for themselves.",
  },
]

const ORDER = EXPERTISE.map((e) => e.id)
const byId = (id) => EXPERTISE.find((e) => e.id === id)

/*
  Each discipline returns:
    bottom - what sits under the intro, bottom-left (null = nothing)
    raised - true = put `bottom` right under the quote instead of at the very bottom
    lines  - [label, description] pairs, shown as big uppercase text on the right.
             The description only appears as a hover tooltip.
  The image always goes in the middle column.
*/
const CONTENT = {
  development: () => ({
    bottom: (
      <div className="flex flex-col gap-2">
        <Group label="Frontend">
          <TechIcon Icon={FaHtml5} color="#E34F26" label="HTML" />
          <TechIcon Icon={FaCss3Alt} color="#1572B6" label="CSS" />
          <TechIcon Icon={FaJsSquare} color="#F7DF1E" label="JavaScript" />
          <TechIcon Icon={SiTypescript} color="#3178C6" label="TypeScript" />
          <TechIcon Icon={FaReact} color="#61DBFB" label="React" />
          <TechIcon Icon={SiTailwindcss} color="#38BDF8" label="Tailwind CSS" />
          <TechIcon Icon={SiBootstrap} color="#7952B3" label="Bootstrap" />
        </Group>
      <Group label="Backend">
  <TechIcon Icon={FaNodeJs} color="#3C873A" label="Node.js" />
  <TechIcon Icon={SiExpress} color="#EDEDF2" label="Express.js" />
  <TechIcon Icon={FaPython} color="#FFD43B" label="Python" />
  <TechIcon Icon={FaJava} color="#E76F00" label="Java" />
</Group>


<div className="grid grid-cols-2 gap-x-2 gap-y-3">
  <Group label="Databases" iconLayout="flex flex-nowrap gap-x-1">
    <TechIcon Icon={SiPostgresql} color="#4169E1" label="PostgreSQL" />
    <TechIcon Icon={SiMysql} color="#4479A1" label="MySQL" />
    <TechIcon Icon={SiSupabase} color="#3ECF8E" label="Supabase" />
  </Group>

  <Group label="Development tools" iconLayout="flex flex-nowrap gap-x-1">
    <TechIcon Icon={FaGitAlt} color="#F05032" label="Git" />
    <TechIcon Icon={FaGithub} color="#EDEDF2" label="GitHub" />
    <TechIcon Icon={FaDocker} color="#2496ED" label="Docker" />
  </Group>
</div>


      </div>
    ),
    lines: [
      ["Responsive Interface Development", "Interfaces that feel right and work cleanly on every screen, from phone to widescreen."],
      ["Backend & API Development", "Server logic and APIs built to be dependable, clean and easy to extend."],
      ["Database Design & Management", "Schemas and queries that keep data organised, consistent and quick to reach."],
      ["System Integration & Architecture", "Frontend, backend and third-party services joined into one coherent system."],
      ["Debugging & Troubleshooting", "Finding the root cause and fixing it for good, not just patching the symptom."],
      ["Deployment & Maintenance", "Taking applications from local build to live production and keeping them healthy."],
    ],
  }),

  security: () => ({
    bottom: (
      <div className="flex flex-col gap-4">
        <div>
          <p className={`${SECTION_LABEL} mb-1.5`}>Frameworks</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-zinc-200">
            {["OWASP Top 10", "NIST CSF", "ISO 27001", "CVSS"].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </p>
        </div>
        <div>
          <p className={`${SECTION_LABEL} mb-1.5`}>Certifications</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2 text-[13px] text-zinc-200">
              <Award size={15} className="shrink-0 mt-0.5 text-[#E4572E]" /> ISC2 Certified in Cybersecurity (CC)
            </div>
            <div className="flex items-start gap-2 text-[13px] text-zinc-200">
              <Award size={15} className="shrink-0 mt-0.5 text-[#E4572E]" />
              NIIT Cybersecurity and Ethical hacking
            </div>
          </div>
        </div>
      </div>
    ),
    lines: [
      ["Ethical Hacking & Penetration Testing", "Probing systems the way an attacker would, to find and validate real weaknesses."],
      ["Web Application Security", "Reviewing applications for vulnerabilities and insecure implementations."],
      ["Network Security", "Analysing traffic, exposure and communication paths to see where a network is weak."],
      ["Vulnerability Assessment", "Identifying vulnerabilities and weighing the risk of each so fixes land in the right order."],
      ["Defensive Security & Monitoring", "Reading events and logs to catch suspicious activity early."],
      ["Information Security", "Applying core security principles to protect systems and the information they hold."],
    ],
  }),

  ai: () => ({
    // icons only, no "Tools" label, raised to sit just under the quote
    raised: true,
    bottom: (
      <div className="flex flex-wrap">
        <TechIcon Icon={FaPython} color="#FFD43B" label="Python" />
        <TechIcon Icon={SiHuggingface} color="#FFD21E" label="Hugging Face" />
        <FileLogo file="openai.svg" Fallback={Sparkles} label="OpenAI API" />
      </div>
    ),
    lines: [
      ["Machine Learning", "Understanding how models learn from data, and turning that into dependable predictions."],
      ["AI Research", "Investigating AI concepts, capabilities and real-world applications with a critical eye."],
      ["AI-Powered Applications", "Building software where AI does genuinely useful work for the people using it."],
      ["Model Experimentation", "Putting existing models through their paces to learn exactly what they can and can't do."],
      ["AI Integration", "Connecting AI services to applications and existing systems so they work as one."],
    ],
  }),

  research: (accent) => ({
    // no "Research outputs" label, no boxes
    bottom: (
      <div className="flex flex-col gap-3 w-full">
        <OutputCard accent={accent} Icon={FileText} label="Research Reports" desc="Structured documentation of investigations and findings." />
        <OutputCard accent={accent} Icon={PenSquare} label="Technical Articles" desc="Clear written exploration of technical topics." />
        <OutputCard accent={accent} Icon={Presentation} label="Presentations" desc="Findings and key ideas communicated to an audience." />
      </div>
    ),
    lines: [
      ["Problem Identification", "Spotting problems worth solving and defining the questions that need answers."],
      ["Literature Review", "Mapping existing studies, articles and sources to set the context."],
      ["Research Design", "Setting clear questions, objectives and the right methodology to pursue them."],
      ["Source Evaluation", "Comparing information and judging how credible each source really is."],
      ["Evidence-Based Conclusions", "Turning relevant evidence into sound, reasoned conclusions."],
      ["Research Documentation", "Organising findings into clear, structured reports that others can follow."],
    ],
  }),

  rhetoric: () => ({
    bottom: null,
    lines: [
      ["Teaching & Explanation", "Breaking complex ideas down until they click, whatever the audience's starting point."],
      ["Technical Writing", "Turning technical knowledge into structured reports and articles people can use."],
      ["Presentations & Speaking", "Explaining ideas live, with demonstrations that make them clear and memorable."],
      ["Persuasive Communication", "Building arguments that challenge perspectives and invite real reflection."],
      ["Mentorship", "Helping others grow their understanding, skills and independent thinking."],
    ],
  }),
}

/* ---------- the icons ---------- */

const SPRING = { type: "spring", stiffness: 220, damping: 26 }

/* ---------- the "hello" sequence ----------
  When the section scrolls into view (first time, and every return) and no
  discipline is open, the icons play one after another, first to last:
  grow big -> spin -> glow -> settle back. Each icon starts PULSE_STEP ms after
  the one before it, so the next begins while the last is still settling.
  The effect is on an INNER motion.div (between the layoutId wrapper and the
  button), so it never fights Framer's layout transform or the CSS spin. */
const PULSE_DURATION = 0.6 // seconds one icon's grow/spin/glow/settle takes
const PULSE_STEP = 230 // ms from one icon starting to the next starting
const PULSE_START_DELAY = 180 // ms after the section appears, before icon 1 starts
const PULSE_SCALE = 1.4 // how big an icon gets
const REST_FILTER = "drop-shadow(0 0 0px rgba(0,0,0,0))"
const REST = { scale: 1, rotate: 0, filter: REST_FILTER }

/* Scrolling UP from Works: Expertise never leaves the screen (Works just slides
  down off it), so onViewportEnter can't fire. Instead we watch the Works layer
  itself: while its top edge is above the bottom of the screen it is covering
  Expertise; the moment it slides fully away, Expertise is revealed again. */
const worksCovering = () => {
  const el = document.querySelector('[data-section="works"]')
  return !!el && el.getBoundingClientRect().top < window.innerHeight - 4
}

function IconButton({ exp, open, small = false, pulsing = false, cancelTick = 0, onClick }) {
  const controls = useAnimationControls()

  // play the pulse when the parent says it is this icon's turn
  useEffect(() => {
    if (!pulsing) return
    const glow = `drop-shadow(0 0 18px ${exp.shadow})`
    controls
      .start({
        scale: [1, PULSE_SCALE, PULSE_SCALE, 1],
        rotate: [0, 0, 360, 360],
        filter: [REST_FILTER, glow, glow, REST_FILTER],
        transition: { duration: PULSE_DURATION, times: [0, 0.3, 0.75, 1], ease: "easeInOut" },
      })
      .then(() => controls.set(REST)) // 360deg === 0deg, so this snap is invisible
      .catch(() => {})
  }, [pulsing]) // eslint-disable-line react-hooks/exhaustive-deps

  // parent cancelled the sequence (scrolled away / opened a discipline)
  useEffect(() => {
    if (!cancelTick) return
    try {
      controls.stop()
      controls.set(REST)
    } catch (e) {}
  }, [cancelTick]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // layoutId wrapper: Framer owns this node's transform
    <motion.div
      layout
      layoutId={`exp-icon-${exp.id}`}
      transition={SPRING}
      style={{ borderRadius: 9999, zIndex: pulsing ? 20 : undefined }}
      className={`shrink-0 ${
        open
          ? "relative z-30 w-12 h-12 md:w-14 md:h-14"
          : small
          ? "w-9 h-9 md:w-11 md:h-11 [&_svg]:w-[17px] [&_svg]:h-[17px] md:[&_svg]:w-[21px] md:[&_svg]:h-[21px]"
          : "w-14 h-14 md:w-16 md:h-16"
      }`}
    >
      {/* inner motion.div: owns the scale / spin / glow of the hello sequence */}
      <motion.div initial={REST} animate={controls} className="w-full h-full rounded-full">
      {/* visible circle: the CSS class owns the spin + glow on THIS node */}
      <button
        type="button"
        onClick={onClick}
        aria-label={exp.label}
        aria-pressed={open}
        className={`tool-icon ${open ? "tool-active" : ""} w-full h-full inline-flex items-center justify-center rounded-full cursor-pointer`}
        style={{
          border: `2px solid ${exp.border}`,
          backgroundColor: "#2C2F34",
          "--tool-glow": `drop-shadow(0 0 12px ${exp.shadow})`,
        }}
      >
        {exp.icon}
      </button>
      </motion.div>
    </motion.div>
  )
}

/* ---------- the section ---------- */

export default function Expertise(props) {
  const [openId, setOpenId] = useState(null) // null | discipline id
  const [stack, setStack] = useState([]) // ids down the left side, top to bottom
  const [overflowing, setOverflowing] = useState(false)
  const scrollRef = useRef(null)

  // ---- hello sequence (see PULSE_* above) ----
  const [pulseId, setPulseId] = useState(null) // whose turn it is right now
  const [cancelTick, setCancelTick] = useState(0) // bump = stop everything, back to rest
  const timersRef = useRef([])
  const openIdRef = useRef(openId)
  openIdRef.current = openId

  const stopIntro = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setPulseId(null)
    setCancelTick((t) => t + 1)
  }

  const startIntro = () => {
    if (openIdRef.current !== null) return // a discipline is open: no show
    if (worksCovering()) return // Works is on top of us: nothing to see yet
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    stopIntro()
    EXPERTISE.forEach((e, i) => {
      timersRef.current.push(
        setTimeout(() => {
          if (openIdRef.current === null) setPulseId(e.id)
        }, PULSE_START_DELAY + i * PULSE_STEP)
      )
    })
  }

  // opening a discipline mid-sequence cancels it; unmount cleans up
  useEffect(() => {
    if (openId !== null) stopIntro()
  }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  // Works slides away (scrolling up) -> replay; Works slides over us -> stop
  useEffect(() => {
    let last = worksCovering()
    const onScroll = () => {
      const now = worksCovering()
      if (now === last) return
      last = now
      if (now) stopIntro()
      else startIntro()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const current = openId ? byId(openId) : null
  const parts = current ? CONTENT[current.id](current.border) : null

  const onIconClick = (id) => {
    if (id === openId) {
      // close: back to the row
      setOpenId(null)
      setStack([])
    } else if (openId === null) {
      // open from the row: the other four line up in their original order
      setOpenId(id)
      setStack(ORDER.filter((x) => x !== id))
    } else {
      // swap: the clicked icon goes to the top, the open one takes its slot
      setStack((s) => s.map((x) => (x === id ? openId : x)))
      setOpenId(id)
    }
  }

  // new discipline -> start from the top
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [openId])

  // Only treat the area as an inner scroller while it really overflows.
  // Otherwise Lenis keeps handling the wheel over it like anywhere else.
  const isOpen = current !== null
  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      setOverflowing(false)
      return
    }
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 2)
    const ro = new ResizeObserver(check)
    const watch = () => {
      ro.disconnect()
      ro.observe(el)
      Array.from(el.children).forEach((c) => ro.observe(c))
      check()
    }
    const mo = new MutationObserver(watch) // content swaps between disciplines
    mo.observe(el, { childList: true })
    watch()
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [isOpen])

  // the big grey icon behind everything (used twice: top right + bottom left)
  const bgIconStyle = { width: "min(24rem, 55%)", height: "auto", aspectRatio: "1 / 1" }

  return (
    <motion.section
      variants={props.sectionFade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.4 }}
      onViewportEnter={() => {
        props.setExpertiseInView?.(true)
        startIntro()
      }}
      onViewportLeave={stopIntro}
      className="relative z-10 w-full h-full"
    >
      {/* LEFT COLUMN: every discipline except the open one */}
      {current && (
        <div className="absolute left-2.5 md:left-10 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3 md:gap-4">
          {stack.map((id) => (
            <IconButton key={id} exp={byId(id)} open={false} small onClick={() => onIconClick(id)} />
          ))}
        </div>
      )}

      <div
        className={`h-full w-full flex flex-col items-center pt-5 pb-4 ${
          current ? "justify-start pl-[3.6rem] pr-3 md:px-28" : "justify-center px-4"
        }`}
      >
        {/* HEADING */}
        <AnimatePresence mode="wait">
          <motion.h3
            key={current?.id ?? "title"}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`text-2xl bebas-neue-regular text-zinc-100 text-center ${current ? "mb-2" : "mb-6"}`}
          >
            {current ? current.label : props.typedExpertiseHeading ?? "Expertise"}
          </motion.h3>
        </AnimatePresence>

        {/* CLOSED: the row */}
        {!current && (
          <div className="flex flex-row flex-wrap justify-center gap-3 md:gap-10">
            {EXPERTISE.map((e) => (
              <IconButton
                key={e.id}
                exp={e}
                open={false}
                pulsing={pulseId === e.id}
                cancelTick={cancelTick}
                onClick={() => onIconClick(e.id)}
              />
            ))}
          </div>
        )}

        {/* OPEN: spinning icon at the top, details under it */}
        {current && (
          <>
            <IconButton key={current.id} exp={current} open onClick={() => onIconClick(current.id)} />

            <div
              ref={scrollRef}
              {...(overflowing ? { "data-lenis-prevent": "" } : {})}
              className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain mt-3 mb-16 md:mb-0"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.25) transparent" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="relative grid w-full max-w-[104rem] mx-auto gap-x-8 gap-y-6 pb-2 lg:min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.5fr)]"
                >
                  {/* BEHIND: the discipline icon, huge and grey, top right + bottom left */}
                  <current.Icon
                    aria-hidden="true"
                    strokeWidth={0.6}
                    className="pointer-events-none absolute z-0 right-0 top-0 text-zinc-500 opacity-[0.14]"
                    style={bgIconStyle}
                  />
                  <current.Icon
                    aria-hidden="true"
                    strokeWidth={0.6}
                    className="pointer-events-none absolute z-0 left-0 bottom-0 text-zinc-500 opacity-[0.14]"
                    style={bgIconStyle}
                  />

                  {/* LEFT: intro (+ quote) on top, small stuff at the bottom */}
                  <div className="relative z-10 flex flex-col justify-between gap-6 min-w-0">
                    <div className="flex flex-col gap-3">
                      {current.intro.map((p, i) => (
                        <p key={i} className="text-[12.5px] lg:text-[13px] leading-snug text-zinc-300">
                          {p}
                        </p>
                      ))}
                      {current.quote && <Quote text={current.quote} accent={current.border} author={current.author} />}
                      {parts.raised && parts.bottom && <div className="mt-3">{parts.bottom}</div>}
                    </div>

                    {!parts.raised && parts.bottom}
                  </div>

                  {/* MIDDLE: the image. Big, and it pops open from nothing. */}
                  <div className="relative z-10 flex items-center justify-center min-w-0">
                  <img
                      src={current.image}
                      alt=""
                      draggable={false}
                      className="w-full aspect-[3/2] max-h-[62vh] object-cover rounded-xl"
                      style={{ border: `1px solid ${current.border}55` }}
                      />
                  </div>

                  {/* RIGHT: big uppercase capabilities filling the right side */}
                  <div className="relative z-10 flex items-center min-w-0 py-2">
                    <div className="flex flex-col">
                      {parts.lines.map(([label, desc], i) => {
                        const last = i === parts.lines.length - 1
                        return (
                          <React.Fragment key={label}>
                            {last && (
                              <p className="bebas-neue-regular uppercase text-zinc-500 text-[clamp(1.2rem,3vh,2rem)] leading-none my-[0.7em]">
                                and
                              </p>
                            )}
                            <p
                              title={desc}
                              className={`bebas-neue-regular uppercase leading-[1.02] text-[clamp(1.9rem,5.6vh,3.5rem)] ${
                                last ? "text-zinc-100" : ""
                              }`}
                              style={last ? undefined : { color: current.border }}
                            >
                              {label}
                            </p>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}
