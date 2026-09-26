import React from "react";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";
import { FaMedium } from "react-icons/fa";

export default function Footer(props){
    return(
        <>
        

<footer id="footer" className="relative flex flex-col items-center justify-center overflow-hidden text-[#EDEDF2]">
  {/* BACKGROUND IMAGE: the height now lives on this wrapper, not the <img>,
      so "h-full" on the image actually has something to size against */}
  <div className="relative w-full min-h-[550px] lg:h-[600px]">
    <img
      src="/footer.jpg"
      alt="Footer Background"
      className="absolute inset-0 w-full h-full object-cover opacity-65"
    />

    {/* CONTENT with slide-up */}
    <motion.div
     
      className="absolute inset-0 flex flex-col items-center justify-center px-8 py-12"
     
    >
            {/* CLOCK FIRST */}
      <div className="text-center text-4xl bebas-neue-regular mb-6">
        {props.time}
      </div>

      {/* Vertical Nav */}
      <div className="flex flex-col items-center mb-8">
        {["Home", "About", "Tools", "Projects"].map((tab, idx) => (
          <React.Fragment key={idx}>
            <a
              href={`#${tab.toLowerCase()}`}
              className="py-2 px-4 hover:text-[#E4572E] transition"
            >
              {tab}
            </a>
            {idx < 3 && (
              <div className="w-32 border-t border-[#EDEDF2] mx-auto"></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Floating Contact Icons */}
      <motion.div
        className="flex gap-6 mb-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={{
          visible: {
            transition: { staggerChildren: 0.2 },
          },
        }}
      >
        {[
          {
            icon: <Mail size={20} color="#D14836" />,
            href: "mailto:ogbontheakpos@gmail.com",
            slideFrom: "top",
          },
          {
            icon: <Github size={20} color="#FFFFFF" />,
            href: "https://github.com/dahgrate",
            slideFrom: "bottom",
          },
          {
            icon: <Linkedin size={20} color="#0A66C2" />,
            href: "https://www.linkedin.com/in/akpos-ogbon-3aa291351",
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
            className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#E4572E]"
            initial={{ opacity: 0, y: link.slideFrom === "top" ? -50 : 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            viewport={{ once: false, amount: 0.4 }}
            whileHover={{ scale: 1.1 }}
          >
            <motion.div
              animate={{
                y: [0, -5, 0],
              }}
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

      {/* COPYRIGHT + CLOCK */}
      <div className="text-center text-sm ">
        &copy; {new Date().getFullYear()} AkposWorld. All rights reserved.
        <br />
        
      </div>
    </motion.div>
  </div>

  {/* THIN FINAL STRIP */}
  <div className="w-full text-center text-sm py-4 border-t border-[#1F1E24] bg-[#1F1E24]"></div>
</footer>

</>
    )
}
