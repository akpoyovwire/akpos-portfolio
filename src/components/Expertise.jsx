import React from "react"
import { motion } from "framer-motion"
import { Home, Folder, Database, Pencil, } from "lucide-react"
import { FaReact } from "react-icons/fa"

export default function Expertise(props){
    return(
        <>
        {/* EXPERTISE */}
      <motion.section
        variants={props.sectionFade}
        className="px-6 py-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10"
     >
         <motion.h3
  variants={props.sectionFade}
  className="text-2xl bebas-neue-regular mb-4 text-center col-span-full"
>
  {props.typedExpertiseHeading}
</motion.h3>

        {props.expertiseList.map((exp, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 1.1, rotate: 5  }}
            className="p-6 text-center rounded-xl bg-white/10 backdrop-blur border border-white/20"
          >
            <div className="mb-2 text-3xl">{exp.icon}</div>
            <h4 className="font-bold mb-2">{exp.label}</h4>
            <p className="text-sm">{exp.desc}</p>
          </motion.div>
        ))}
      </motion.section>
        </>
    )
}