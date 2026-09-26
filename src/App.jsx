import React, { useState, useEffect } from "react"
import { Home, Folder, Database, Pencil, } from "lucide-react"
import { FaReact } from "react-icons/fa"
import Ripple from "./components/Ripple"
import Footer from "./components/Footer"
import Works from "./components/Works"
import Expertise from "./components/Expertise"
import Tools from "./components/Tools"
import About from "./components/About"
import Hero from "./components/Hero"
import Header from "./components/Header"
import ScrollArrow from "./components/ScrollArrow"
import FlipStack from "./components/FlipStack"
import WaterTrail from "./components/WaterTrail"
import CustomCursor from "./components/CustomCursor"

export default function App() {
const [isOpen, setIsOpen] = useState(false)
const [scrollTarget, setScrollTarget] = useState("#footer")
const [toolDescription, setToolDescription] = useState(null);
const [currentIndex, setCurrentIndex] = useState(0)
const [touchStartX, setTouchStartX] = useState(null)
const [time, setTime] = useState("")
const [aboutInView, setAboutInView] = useState(false)
const [worksInView, setworksInView] = useState(false)
const [expertiseInView, setExpertiseInView] = useState(false)
const [toolsInView, setToolsInView] = useState(false)

const pageBg = "linear-gradient(135deg, #1F1E24, #23241E)"

// ABOUT
const typedAboutHeading = useTypingEffect("About Me", 80, aboutInView)
const typedAboutContent = useTypingEffect(
  "I build secure, modern web apps with React, Supabase, OWASP best practices, Wireshark & Burp Suite.",
  6,
  aboutInView
)

// WORKS
const typedworksHeading = useTypingEffect("works", 80, worksInView)

// EXPERTISE
const typedExpertiseHeading = useTypingEffect("Expertise", 80, expertiseInView)

// TOOLS
const typedToolsHeading = useTypingEffect("Tools & Stack", 80, toolsInView)

useEffect(() => {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    setTime(`${hours}:${minutes}:${seconds}`);
  };

updateClock();
  const interval = setInterval(updateClock, 1000);

  return () => clearInterval(interval);
}, []);

const handleTouchStart = (e) => {
  setTouchStartX(e.touches[0].clientX);
};

const handleTouchEnd = (e) => {
  if (touchStartX === null) return;
  const touchEndX = e.changedTouches[0].clientX;
  const diffX = touchStartX - touchEndX;

  if (diffX > 50) {
    // Swipe Left = Next
    setCurrentIndex((prev) => (prev === 2 ? 0 : prev + 1));
  } else if (diffX < -50) {
    // Swipe Right = Prev
    setCurrentIndex((prev) => (prev === 0 ? 2 : prev - 1));
  }

  setTouchStartX(null);
};

  const toggleMenu = () => setIsOpen(!isOpen);

 useEffect(() => {
  const handleScroll = () => {
    const expertiseSection = document.getElementById("expertise");
    const expertisePosition = expertiseSection
  ? expertiseSection.getBoundingClientRect().top + window.scrollY
  : 0;
    const scrollY = window.scrollY || window.pageYOffset;

    // If we haven't scrolled PAST expertise, arrow goes down to #contact
    if (scrollY + window.innerHeight / 2 < expertisePosition) {
      setScrollTarget("#footer");
    } else {
      // If we are PAST expertise, arrow goes back to top (#home)
      setScrollTarget("#home");
    }
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

function useTypingEffect(text, speed = 50, active = true) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, active]);

  return displayed;
}

  const sectionFade = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, staggerChildren: 0.2 },
    },
  };

  const tapEffect = { scale: 0.95, rotate: -2 };

  const sidebarVariants = {
    hidden: { x: "-100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 70 } },
    exit: { x: "-100%", opacity: 0, transition: { duration: 0.3 } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 0.4, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };


  const expertiseList = [
    { icon: <FaReact />, label: "Frontend Development", desc: "Modern, responsive interfaces with React and friends." },
    { icon: <Database />, label: "Backend Integration", desc: "Connecting frontend to secure backend services like Supabase." },
    { icon: <Pencil />, label: "Design Customization", desc: "Unique, user-focused designs directed to the last detail." },
    { icon: <Folder />, label: "Project Planning", desc: "Research-driven project setup, clear user flows & structure." },
    { icon: <Home />, label: "SEO & Visibility", desc: "Making your site discoverable and visible to the world." },
  ];


return (
<>
<Ripple />
<WaterTrail />
<CustomCursor />

<main className="min-h-screen voltaire-regular text-[#EDEDF2] scroll-smooth relative overflow-x-clip" style={{ background: pageBg }}>
<Header 
backdropVariants={backdropVariants}
isOpen={isOpen}
sidebarVariants={sidebarVariants}
toggleMenu={toggleMenu}
tapEffect={tapEffect}
setIsOpen={setIsOpen}
/>

<Hero />

<FlipStack background={pageBg} mapBg="/section-map-bg.svg"
  pages={[
    { id: "about", content: <About typedAboutContent={typedAboutContent} typedAboutHeading={typedAboutHeading} setAboutInView={setAboutInView} sectionFade={sectionFade} /> },
    { id: "tools", onActiveChange: setToolsInView, content: <Tools setToolDescription={setToolDescription} toolDescription={toolDescription} typedToolsHeading={typedToolsHeading} sectionFade={sectionFade} /> },
    { id: "expertise", onActiveChange: setExpertiseInView, content: <Expertise expertiseList={expertiseList} sectionFade={sectionFade} typedExpertiseHeading={typedExpertiseHeading} /> },
    { id: "works", onActiveChange: setworksInView, content: <Works sectionFade={sectionFade} typedworksHeading={typedworksHeading} handleTouchStart={handleTouchStart} handleTouchEnd={handleTouchEnd} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} /> },
  ]}
/>
<Footer time={time} />
</main>

<ScrollArrow scrollTarget={scrollTarget}/>
</>
);}