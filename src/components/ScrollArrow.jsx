import React from "react"
import { motion } from "framer-motion"

export default function ScrollArrow(props){
    return(
        <>
         <motion.a
        href={props.scrollTarget}
        className="fixed bottom-6 right-6 z-50 text-3xl text-[#E4572E] drop-shadow-lg"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        ➤
      </motion.a>
        </>
    )
}