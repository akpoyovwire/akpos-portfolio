import React from "react"
import { motion } from "framer-motion"
import {  Mail, Github, Linkedin } from "lucide-react"
import { FaMedium } from "react-icons/fa"
 import WaterRipple from "./WaterRipple"

export default function Hero(){
    return(
        <>

<motion.section
  id="home"
  initial="hidden"
  animate="visible"
    style={{ minHeight: "100dvh" }}
  className="relative px-6 py-48 text-center flex flex-col items-center justify-center overflow-hidden"
>
 
     {/* VIDEO BACKGROUND with water ripples */}
   <WaterRipple src="/herovid2.mp4" />

  {/* Overlay for darkness */}
  <div className="absolute inset-0 bg-black/40"></div>
   {/* PROFILE PICTURE (bottom left) */}
  <motion.a
    href="https://www.linkedin.com/in/akpoyovwire"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Akpoyovwire on LinkedIn"
    className="absolute bottom-6 left-6 z-10 block"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.5 }}
    whileTap={{ scale: 0.92 }}
  >
    <motion.img
      src="/profile.jpg"
      alt="Akpoyovwire"
      className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover  shadow-lg cursor-pointer"
      animate={{ scale: [0.8, 1, 0.8] }}
      transition={{
        duration: 1.6,
        ease: "easeInOut",
        repeat: Infinity,
        delay: 1.5, // starts pulsing after the entrance finishes
      }}
    />
  </motion.a>
<motion.h2
  initial={{ width: 0, borderRightColor: "#E4572E" }}
  animate={{
    width: "fit-content",
    borderRightColor: [
      "#E4572E",
      "#E4572E",
      "rgba(38,177,161,0)",
      "rgba(38,177,161,0)",
    ],
  }}
  transition={{
    width: { duration: 2, ease: "easeInOut" },
    borderRightColor: {
      delay: 2,          // waits for the typing to finish
      duration: 1,       // one full blink cycle
      times: [0, 0.49, 0.5, 1],
      ease: "linear",
      repeat: Infinity,
    },
  }}
className="text-4xl sm:text-6xl md:text-8xl over-the-rainbow-regular mb-4 pb-8 leading-[1.35] overflow-hidden border-r-4 whitespace-nowrap relative text-[#EDEDF2]"
>
  AKPOYOVWIRE
</motion.h2>

  {/* Added mb-12 for spacing below this line */}
  <motion.p
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 2, duration: 1 }}
className="text-lg relative text-[#EDEDF2] mb-12 bebas-neue-regular -mt-5"
  >
    Build. Secure. Innovate. Educate.
  </motion.p>

  {/* Floating Contact Icons with entrance */}
  <motion.div className="flex gap-6">
    {[
      {
        icon: <Mail size={20} color="#D14836" />,
        href: "mailto:ogbontheakpos@gmail.com",
        slideFrom: "top",
      },
      {
        icon: <Github size={20} color="#FFFFFF" />,
        href: "https://github.com/akpoyovwire",
        slideFrom: "bottom",
      },
      {
        icon: <Linkedin size={20} color="#0A66C2" />,
        href: "https://www.linkedin.com/in/akpoyovwire",
        slideFrom: "top",
      },
      {
        icon: <FaMedium size={22} color="#000000" />,
        href: "https://medium.com/@dahgrate",
        slideFrom: "bottom",
      },
    ].map((link, idx) => (
      <motion.a
        key={idx}
        href={link.href}
        target="_blank"
        initial={{ opacity: 0, y: link.slideFrom === "top" ? -50 : 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        viewport={{ once: false, amount: 0.4 }}
        whileHover={{ scale: 1.1 }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          {link.icon}
        </motion.div>
      </motion.a>
    ))}
  </motion.div>
</motion.section>

        </>
    )
}