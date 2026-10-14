import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useAnimationControls } from "framer-motion"
import {
  Code2, ShieldCheck, BrainCircuit, FileSearch, MessageCircle,
  Smartphone, Server, Database as DbIcon, Plug, Bug, UploadCloud,
  Globe, Network, SearchCode, Eye, Lock, Cable, Sparkles,
  Brain, Boxes,
  ClipboardList, BookOpen, Compass, ScanSearch, FileCheck2, FileText,
  GraduationCap, PenSquare, Mic, MessagesSquare, Users, Award, Presentation,
} from "lucide-react"
import {
  FaHtml5, FaCss3Alt, FaJsSquare, FaReact, FaNodeJs, FaPython, FaJava, FaGitAlt, FaGithub, FaDocker,
} from "react-icons/fa"
import {
  SiTypescript, SiTailwindcss, SiBootstrap, SiExpress, SiPostgresql, SiMysql, SiSupabase,
  SiKalilinux, SiSplunk, SiHuggingface,
} from "react-icons/si"

/*
  Expertise
  One section, five clickable icons: Development, Security, AI & ML,
  Research, Rhetoric.

  CLOSED   "Expertise" heading + the five icons in a row, centred.

  OPEN     the clicked icon travels to the top-centre (smaller than before),
           spinning and glowing (same .tool-icon / .tool-active CSS the old
           Tools section used - keep those two classes in index.css).
           The other four sit in a column down the left edge.
           Below: a small 16:9 image top-right, the introduction beside it, then
           the discipline's grouped details underneath. Sized to fit the
           screen without scrolling.

  CLICK the open icon          -> everything goes back to the row.
  CLICK an icon in the column  -> POSITIONAL SWAP: the clicked icon flies to the
                                  top-centre and the icon that was open drops
                                  into the exact slot the clicked one just left.
                                  The `stack` array below holds the column order;
                                  a swap replaces one entry in it.

  HOW THE MOVEMENT WORKS
  Every icon is a motion.div with a fixed layoutId, so Framer Motion animates it
  between row / top / column positions on its own. The layoutId node is a plain
  wrapper; the visible circle (with .tool-icon and its CSS spin) is a child
  inside it, so Framer's transform and the CSS spin never fight. The open icon
  carries key={id}, so a swap is a real unmount/mount pair that Framer can
  animate between (without the key React reuses one element and nothing flies).

  NO SCROLLING
  The section sits inside a fixed 100vh layer in App.jsx. The layout is sized to
  fit that on a laptop screen. The area below the icon is still overflow-y-auto
  as a safety net (phones / very short windows), and ONLY while it genuinely
  overflows does it get data-lenis-prevent. When it all fits, the wheel over it
  keeps scrolling the page through Lenis as normal.

  LOGO FILES (optional, drop into /public/logos/)
  Burp Suite, Nmap, Wireshark, Metasploit and OpenAI don't have a logo I can
  guarantee exists in react-icons, and a wrong import would break your build.
  So those five load /logos/<name>.svg and fall back to a line icon until the
  file exists:
    burpsuite.svg  nmap.svg  wireshark.svg  metasploit.svg  openai.svg
*/

const SECTION_LABEL = "text-[11px] uppercase tracking-[0.14em] text-zinc-400"

/* ---------- small building blocks ---------- */

const TechIcon = ({ Icon, color, label }) => (
  <div className="flex flex-col items-center gap-1 w-[3.25rem]">
    <Icon size={26} color={color} />
    <span className="text-[10px] text-zinc-300 text-center leading-tight">{label}</span>
  </div>
)

// real logo file if present, line icon until then
const FileLogo = ({ file, Fallback, label }) => {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex flex-col items-center gap-1 w-[3.25rem]">
      {failed ? (
        <Fallback size={26} className="text-zinc-300" />
      ) : (
        <img
          src={`/logos/${file}`}
          alt=""
          width={26}
          height={26}
          className="w-[26px] h-[26px] object-contain"
          onError={() => setFailed(true)}
        />
      )}
      <span className="text-[10px] text-zinc-300 text-center leading-tight">{label}</span>
    </div>
  )
}

const Panel = ({ label, children, className = "" }) => (
  <div className={`rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 ${className}`}>
    {label && <p className={`${SECTION_LABEL} mb-2`}>{label}</p>}
    {children}
  </div>
)

const Block = ({ label, children }) => (
  <div>
    <p className={`${SECTION_LABEL} mb-2`}>{label}</p>
    {children}
  </div>
)

// fluid = fills its grid cell; otherwise 1 / 2 / 3 per row, with a last
// short row centred (AI and Rhetoric have five)
const CapCard = ({ Icon, label, desc, accent, fluid = false }) => (
  <div
    className={`flex gap-3 items-start rounded-xl border border-white/10 bg-white/[0.04] p-3 w-full ${
      fluid ? "" : "sm:w-[calc((100%-0.625rem)/2)] lg:w-[calc((100%-1.25rem)/3)]"
    }`}
  >
    <Icon size={18} color={accent} className="shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[13px] font-normal tracking-wide text-zinc-400 leading-tight">{label}</p>
      <p className="text-[12.5px] text-zinc-300 leading-snug mt-1">{desc}</p>
    </div>
  </div>
)

const CapGrid = ({ children }) => <div className="flex flex-wrap justify-center gap-2.5">{children}</div>

const Quote = ({ text, accent, author }) => (
  <blockquote
    className="relative rounded-xl border border-white/10 bg-white/[0.05] pl-11 pr-4 py-3"
    style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
  >
    <span
      aria-hidden="true"
      className="absolute left-3 top-0.5 font-serif text-5xl leading-none"
      style={{ color: accent, opacity: 0.7 }}
    >
      &ldquo;
    </span>
    <p className="italic text-[15px] lg:text-[17px] leading-snug text-zinc-50">{text}</p>
 {author && (
  <p className="mt-2 flex items-center justify-end gap-2 text-[13px] italic tracking-wide text-zinc-400">
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
    icon: <Code2 size={30} color="#61DBFB" />,
    border: "#61DBFB",
    shadow: "rgba(97, 219, 251, 0.6)",
    image: "/devexp.jpg",
    intro: [
      "I build full-stack applications that turn ideas into working digital products. My work spans frontend interfaces, backend systems, databases and API integration, so I can take a product from the screen the user sees to the systems that power it.",
      "I focus on applications that are responsive, intuitive and maintainable: designing how components interact, tracing and fixing what breaks, and deploying solutions that solve real problems.",
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: <ShieldCheck size={30} color="#EF4444" />,
    border: "#EF4444",
    shadow: "rgba(239, 68, 68, 0.6)",
    image: "/secexp.jpg",
    intro: [
      "I approach cybersecurity by understanding how systems really work, finding where they can be broken, and building practical ways to strengthen them. My work spans ethical hacking, penetration testing, vulnerability assessment, web and network security, and defensive monitoring.",
      "I examine systems from both sides: how a weakness is exploited, what risk it creates, and how to close it. I build with protection in mind from the start, never as an afterthought.",
    ],
  },
  {
    id: "ai",
    label: "AI & Machine Learning",
    icon: <BrainCircuit size={30} color="#A78BFA" />,
    border: "#A78BFA",
    shadow: "rgba(167, 139, 250, 0.6)",
    image: "/aiexp.jpg",
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
    icon: <FileSearch size={30} color="#43bc88" />,
    border: "#43bc88",
    shadow: "rgba(67, 188, 136, 0.6)",
    image: "/resexp.jpg",
    intro: [
      "I treat research as a structured way to investigate problems, test existing knowledge and arrive at informed conclusions. I define the problem, frame the questions and objectives, review the literature, and organise what I find into clear, documented outputs.",
      "Evidence comes first for me. I examine sources, compare perspectives and weigh credibility so my conclusions are logical and well supported. Research is where curiosity meets critical thinking, and where better decisions begin.",
    ],
  },
  {
    id: "rhetoric",
    label: "Rhetoric",
    icon: <MessageCircle size={30} color="#F59E0B" />,
    border: "#F59E0B",
    shadow: "rgba(245, 158, 11, 0.6)",
    image: "/rhetexp.jpg",
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
  Each discipline returns two optional pieces:
    aside - sits under the image (top-left column)
    wide  - full-width block under the image + introduction
*/
const CONTENT = {
  development: (accent) => ({
    aside: null,
    wide: (
      <>
        <div className="flex flex-wrap gap-2.5 mb-3">
          <Panel label="Frontend">
            <div className="flex flex-wrap gap-y-2">
              <TechIcon Icon={FaHtml5} color="#E34F26" label="HTML" />
              <TechIcon Icon={FaCss3Alt} color="#1572B6" label="CSS" />
              <TechIcon Icon={FaJsSquare} color="#F7DF1E" label="JavaScript" />
              <TechIcon Icon={SiTypescript} color="#3178C6" label="TypeScript" />
              <TechIcon Icon={FaReact} color="#61DBFB" label="React" />
              <TechIcon Icon={SiTailwindcss} color="#38BDF8" label="Tailwind CSS" />
              <TechIcon Icon={SiBootstrap} color="#7952B3" label="Bootstrap" />
            </div>
          </Panel>
          <Panel label="Backend">
            <div className="flex flex-wrap gap-y-2">
              <TechIcon Icon={FaNodeJs} color="#3C873A" label="Node.js" />
              <TechIcon Icon={SiExpress} color="#EDEDF2" label="Express.js" />
              <TechIcon Icon={FaPython} color="#FFD43B" label="Python" />
              <TechIcon Icon={FaJava} color="#E76F00" label="Java" />
            </div>
          </Panel>
          <Panel label="Databases">
            <div className="flex flex-wrap gap-y-2">
              <TechIcon Icon={SiPostgresql} color="#4169E1" label="PostgreSQL" />
              <TechIcon Icon={SiMysql} color="#4479A1" label="MySQL" />
              <TechIcon Icon={SiSupabase} color="#3ECF8E" label="Supabase" />
            </div>
          </Panel>
          <Panel label="Development tools">
            <div className="flex flex-wrap gap-y-2">
              <TechIcon Icon={FaGitAlt} color="#F05032" label="Git" />
              <TechIcon Icon={FaGithub} color="#EDEDF2" label="GitHub" />
              <TechIcon Icon={FaDocker} color="#2496ED" label="Docker" />
            </div>
          </Panel>
        </div>

        <Block label="Capabilities">
          <CapGrid>
            <CapCard accent={accent} Icon={Smartphone} label="Responsive Interface Development" desc="Interfaces that feel right and work cleanly on every screen, from phone to widescreen." />
            <CapCard accent={accent} Icon={Server} label="Backend & API Development" desc="Server logic and APIs built to be dependable, clean and easy to extend." />
            <CapCard accent={accent} Icon={DbIcon} label="Database Design & Management" desc="Schemas and queries that keep data organised, consistent and quick to reach." />
            <CapCard accent={accent} Icon={Boxes} label="System Integration & Architecture" desc="Frontend, backend and third-party services joined into one coherent system." />
            <CapCard accent={accent} Icon={Bug} label="Debugging & Troubleshooting" desc="Finding the root cause and fixing it for good, not just patching the symptom." />
            <CapCard accent={accent} Icon={UploadCloud} label="Deployment & Maintenance" desc="Taking applications from local build to live production and keeping them healthy." />
          </CapGrid>
        </Block>
      </>
    ),
  }),

  security: (accent) => ({
    aside: null,
    wide: (
      <>
        <Block label="Security domains">
          <CapGrid>
            <CapCard accent={accent} Icon={Lock} label="Ethical Hacking & Penetration Testing" desc="Probing systems the way an attacker would, to find and validate real weaknesses." />
            <CapCard accent={accent} Icon={Globe} label="Web Application Security" desc="Reviewing applications for vulnerabilities and insecure implementations." />
            <CapCard accent={accent} Icon={Network} label="Network Security" desc="Analysing traffic, exposure and communication paths to see where a network is weak." />
            <CapCard accent={accent} Icon={ScanSearch} label="Vulnerability Assessment" desc="Identifying vulnerabilities and weighing the risk of each so fixes land in the right order." />
            <CapCard accent={accent} Icon={Eye} label="Defensive Security & Monitoring" desc="Reading events and logs to catch suspicious activity early." />
            <CapCard accent={accent} Icon={ShieldCheck} label="Information Security" desc="Applying core security principles to protect systems and the information they hold." />
          </CapGrid>
        </Block>

        <div className="grid gap-2.5 mt-3 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
          <Panel label="Toolkit">
            <div className="flex flex-wrap gap-y-2">
              <FileLogo file="burpsuite.svg" Fallback={Bug} label="Burp Suite" />
              <FileLogo file="nmap.svg" Fallback={Network} label="Nmap" />
              <FileLogo file="wireshark.svg" Fallback={SearchCode} label="Wireshark" />
              <FileLogo file="metasploit.svg" Fallback={Cable} label="Metasploit" />
              <TechIcon Icon={SiKalilinux} color="#557C94" label="Kali Linux" />
              <TechIcon Icon={SiSplunk} color="#F5680F" label="Splunk" />
            </div>
          </Panel>

          <Panel label="Frameworks">
            <div className="flex flex-wrap gap-1.5">
              {["OWASP Top 10", "NIST CSF", "ISO 27001", "CVSS"].map((f) => (
                <span
                  key={f}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] text-zinc-200"
                  style={{ borderColor: `${accent}66` }}
                >
                  {f}
                </span>
              ))}
            </div>
          </Panel>

          <Panel label="Certifications">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2 text-[13px] text-zinc-200">
                <Award size={15} className="shrink-0 mt-0.5 text-[#E4572E]" /> ISC2 Certified in Cybersecurity (CC)
              </div>
              <div className="flex items-start gap-2 text-[13px] text-zinc-200">
                <Award size={15} className="shrink-0 mt-0.5 text-[#E4572E]" />
                NIIT Cybersecurity and Ethical hacking
              </div>
            </div>
          </Panel>
        </div>
      </>
    ),
  }),

  ai: (accent) => ({
    aside: (
      <Panel label="Tools">
        <div className="flex flex-wrap gap-y-2">
          <TechIcon Icon={FaPython} color="#FFD43B" label="Python" />
          <TechIcon Icon={SiHuggingface} color="#FFD21E" label="Hugging Face" />
          <FileLogo file="openai.svg" Fallback={Sparkles} label="OpenAI API" />
        </div>
      </Panel>
    ),
    wide: (
      <Block label="Capabilities">
        <CapGrid>
          <CapCard accent={accent} Icon={Brain} label="Machine Learning" desc="Understanding how models learn from data, and turning that into dependable predictions." />
          <CapCard accent={accent} Icon={BookOpen} label="AI Research" desc="Investigating AI concepts, capabilities and real-world applications with a critical eye." />
          <CapCard accent={accent} Icon={Boxes} label="AI-Powered Applications" desc="Building software where AI does genuinely useful work for the people using it." />
          <CapCard accent={accent} Icon={Compass} label="Model Experimentation" desc="Putting existing models through their paces to learn exactly what they can and can't do." />
          <CapCard accent={accent} Icon={Plug} label="AI Integration" desc="Connecting AI services to applications and existing systems so they work as one." />
        </CapGrid>
      </Block>
    ),
  }),

  research: (accent) => ({
    aside: null,
    wide: (
      <>
        <Block label="Research process">
          <CapGrid>
            <CapCard accent={accent} Icon={ClipboardList} label="Problem Identification" desc="Spotting problems worth solving and defining the questions that need answers." />
            <CapCard accent={accent} Icon={BookOpen} label="Literature Review" desc="Mapping existing studies, articles and sources to set the context." />
            <CapCard accent={accent} Icon={Compass} label="Research Design" desc="Setting clear questions, objectives and the right methodology to pursue them." />
            <CapCard accent={accent} Icon={ScanSearch} label="Source Evaluation" desc="Comparing information and judging how credible each source really is." />
            <CapCard accent={accent} Icon={FileCheck2} label="Evidence-Based Conclusions" desc="Turning relevant evidence into sound, reasoned conclusions." />
            <CapCard accent={accent} Icon={FileText} label="Research Documentation" desc="Organising findings into clear, structured reports that others can follow." />
          </CapGrid>
        </Block>

        <div className="mt-3">
          <Block label="Research outputs">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <CapCard fluid accent={accent} Icon={FileText} label="Research Reports" desc="Structured documentation of investigations and findings." />
              <CapCard fluid accent={accent} Icon={PenSquare} label="Technical Articles" desc="Clear written exploration of technical topics." />
              <CapCard fluid accent={accent} Icon={Presentation} label="Presentations" desc="Findings and key ideas communicated to an audience." />
            </div>
          </Block>
        </div>
      </>
    ),
  }),

  rhetoric: (accent) => ({
    aside: null,
    wide: (
      <Block label="Communication capabilities">
        <CapGrid>
          <CapCard accent={accent} Icon={GraduationCap} label="Teaching & Explanation" desc="Breaking complex ideas down until they click, whatever the audience's starting point." />
          <CapCard accent={accent} Icon={PenSquare} label="Technical Writing" desc="Turning technical knowledge into structured reports and articles people can use." />
          <CapCard accent={accent} Icon={Mic} label="Presentations & Speaking" desc="Explaining ideas live, with demonstrations that make them clear and memorable." />
          <CapCard accent={accent} Icon={MessagesSquare} label="Persuasive Communication" desc="Building arguments that challenge perspectives and invite real reflection." />
          <CapCard accent={accent} Icon={Users} label="Mentorship" desc="Helping others grow their understanding, skills and independent thinking." />
        </CapGrid>
      </Block>
    ),
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
const PULSE_START_DELAY = 350 // ms after the section appears, before icon 1 starts
const PULSE_SCALE = 1.4// how big an icon gets
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
                  className="grid w-full max-w-[68rem] mx-auto gap-x-6 gap-y-4 pb-2 lg:grid-cols-[minmax(0,1fr)_clamp(11rem,40vh,17rem)] lg:items-start"
                >
                  {/* introduction (+ signature quote where there is one) */}
                  <div className="flex flex-col gap-3 min-w-0">
                    {current.intro.map((p, i) => (
                      <p key={i} className="text-sm lg:text-[15px] leading-snug text-zinc-200">
                        {p}
                      </p>
                    ))}
                    {current.quote && <Quote text={current.quote} accent={current.border} author={current.author} />}
                  </div>

                  {/* top-right: 16:9 image (never stretched, only ever cropped by a hair) + optional aside */}
                  <div className="flex flex-col gap-3 w-full max-w-[17rem] lg:max-w-none order-first lg:order-none">
                    <img
                      src={current.image}
                      alt=""
                      draggable={false}
                      className="w-full aspect-video object-cover rounded-xl"
                      style={{ border: `1px solid ${current.border}55` }}
                    />
                    {parts.aside}
                  </div>

                  {/* grouped details */}
                  <div className="lg:col-span-2 min-w-0">{parts.wide}</div>
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}
