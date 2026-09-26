import React from "react"
import { motion } from "framer-motion"

export default function About(props){
    return(
        <>
        

<motion.section
  
  variants={props.sectionFade}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: false, amount: 0.4 }}
   onViewportEnter={() => props.setAboutInView(true)}
  whileHover={{
    scale: 1.02,
    boxShadow:
      "0 0 20px rgba(124, 58, 237, 0.2), 0 0 40px rgba(45, 212, 191, 0.2)",
    borderColor: "#2DD4BF",
  }}

  whileTap={{
    scale: 1.02,
    boxShadow:
      "0 0 20px rgba(124, 58, 237, 0.2), 0 0 40px rgba(45, 212, 191, 0.2)",
    borderColor: "#2DD4BF",
  }}
  className="relative px-6 py-12 max-w-3xl mx-auto bg-[#3a354add] rounded-lg shadow overflow-hidden transition z-10"
>
  
 

 <motion.h3
  variants={props.sectionFade}
className="text-2xl bebas-neue-regular text-zinc-100 mb-4 text-center">
  {props.typedAboutHeading}
</motion.h3>
<motion.p variants={props.sectionFade} className="text-zinc-200">
  {props.typedAboutContent}
</motion.p>

</motion.section>
        </>
    )
}
