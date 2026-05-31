import React from "react";
import { motion } from "framer-motion";

export function SwirlingBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#FAFAFA]">
      {/* 
        We use framer-motion to create a beautiful, slow, swirling 
        gradient effect typical of modern, premium Apple-like interfaces.
      */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          x: ["-10%", "10%", "-10%"],
          y: ["-10%", "10%", "-10%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-1/4 w-3/4 h-3/4 bg-primary/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          rotate: [0, -90, 0],
          x: ["10%", "-10%", "10%"],
          y: ["10%", "-10%", "10%"],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-1/4 w-3/4 h-3/4 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-70"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          rotate: [0, 180, 0],
          x: ["0%", "10%", "0%"],
          y: ["-10%", "5%", "-10%"],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-1/4 -right-1/4 w-full h-full bg-cyan-300/10 rounded-full mix-blend-multiply filter blur-[150px] opacity-60"
      />
    </div>
  );
}
