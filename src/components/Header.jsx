import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Home, User, Folder, Database, HatGlasses } from "lucide-react"

export default function Header(props){
    return(
        <>
        
      <nav className="p-6 flex justify-between items-center absolute top-0 left-0 w-full z-10 bg-transparent">
<h1 className="w-64 md:w-80">
  <svg
    viewBox="10 10 310 85"
    className="w-full h-auto overflow-visible"
    role="img"
    aria-label="Meet the Visionary"
  >
    <defs>
      <path id="header-arc" d="M 10 80 A 280 310 0 0 1 310 80" fill="none" />
    </defs>
    <text
      className="butcherman-regular"
      fill="#EDEDF2"
      fontSize="20"
      textAnchor="middle"
    >
      <textPath href="#header-arc" startOffset="50%">
        MEET THE VISIONARY
      </textPath>
    </text>
  </svg>
</h1>        <ul className="hidden md:flex gap-6 text-sm items-center">
          {["home", "about", "tools", "expertise","works"].map((item, idx) => (
           <motion.li
        key={idx}
        whileHover={{ scale: 1.1 }}
        whileTap={props.tapEffect}
        className="flex items-center gap-1 bebas-neue-regular text-[#EDEDF2] hover:text-[#E4572E] transition"
        >
              {item === "home" && <Home size={16} />}
              {item === "about" && <User size={16} />}
              {item === "tools" && <Database size={16} />}
              {item === "works" && <Folder size={16} />}
              {item == "expertise" && <HatGlasses size={16} />}
              <a href={`#${item}`}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </a>
            </motion.li>
          ))}
          <motion.li whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
           
          </motion.li>
        </ul>

        <button className="md:hidden flex flex-col gap-1" onClick={props.toggleMenu}>
          <span className="w-6 h-0.5 bg-[#EDEDF2]"></span>
          <span className="w-6 h-0.5 bg-[#EDEDF2]"></span>
          <span className="w-6 h-0.5 bg-[#EDEDF2]"></span>
        </button>
      </nav>

      <AnimatePresence>
        {props.isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black z-30"
              variants={props.backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => props.setIsOpen(false)}
            />
  <motion.div
  variants={props.sidebarVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  className="fixed top-0 left-0 h-full w-64 bg-[#1F1E24]/90 backdrop-blur-lg shadow-lg flex flex-col gap-6 p-6 border-r border-[#2C2F34] z-40 text-white"
>

  {["home", "about", "tools", "expertise", "works"].map((item, idx) => (
    <a
      key={idx}
      href={`#${item}`}
      onClick={props.toggleMenu}
      className="flex items-center gap-2 text-lg bebas-neue-regular"
    >
      {item === "home" && <Home size={20} />}
      {item === "about" && <User size={20} />}
      {item === "tools" && <Database size={20} />}
      {item === "works" && <Folder size={20} />}
      {item === "expertise" && <HatGlasses size={20} />}
      {item.charAt(0).toUpperCase() + item.slice(1)}
    </a>
  ))}

</motion.div>

          </>
        )}
      </AnimatePresence>
        </>
    )
}