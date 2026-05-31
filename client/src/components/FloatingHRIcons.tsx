import React from "react";
import { motion } from "framer-motion";
import { Users, Briefcase, FileText, BarChart3, Calendar, MessageSquare, Mail, ClipboardCheck } from "lucide-react";

export function FloatingHRIcons() {
  const icons = [
    { Icon: Users, size: 64, top: "15%", left: "15%", delay: 0 },
    { Icon: Briefcase, size: 48, top: "25%", left: "80%", delay: 2 },
    // Avoid middle left where the text is: moved FileText to top right
    { Icon: FileText, size: 72, top: "10%", left: "65%", delay: 1 },
    { Icon: BarChart3, size: 56, top: "70%", left: "75%", delay: 3 },
    // Avoid middle left: moved Calendar to bottom right
    { Icon: Calendar, size: 40, top: "85%", left: "60%", delay: 1.5 },
    { Icon: MessageSquare, size: 50, top: "85%", left: "20%", delay: 2.5 },
    { Icon: Mail, size: 48, top: "35%", left: "85%", delay: 0.5 },
    { Icon: ClipboardCheck, size: 60, top: "55%", left: "80%", delay: 3.5 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {icons.map(({ Icon, size, top, left, delay }, i) => (
        <motion.div
          key={i}
          className="absolute text-white/60"
          style={{ top, left }}
          animate={{
            y: ["0%", "-20%", "0%"],
            rotate: [0, 10, -10, 0],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 15 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay,
          }}
        >
          <Icon size={size} strokeWidth={1} />
        </motion.div>
      ))}
    </div>
  );
}
