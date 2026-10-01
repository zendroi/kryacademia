"use client";

import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";

type Skiper30Props = {
  eyebrow: string;
  images: readonly string[];
  title: string;
};

const Skiper30 = ({ eyebrow, images, title }: Skiper30Props) => {
  const gallery = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: gallery,
    offset: ["start end", "end start"],
  });
  const still = ["0%", "0%"];
  const y1 = useTransform(scrollYProgress, [0, 1], reduceMotion ? still : ["-9%", "9%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], reduceMotion ? still : ["10%", "-12%"]);
  const y3 = useTransform(scrollYProgress, [0, 1], reduceMotion ? still : ["-5%", "11%"]);
  const y4 = useTransform(scrollYProgress, [0, 1], reduceMotion ? still : ["12%", "-8%"]);
  const movement = [y1, y2, y3, y4];
  const columns = Array.from({ length: 4 }, (_, column) => images.filter((_, index) => index % 4 === column));

  return (
    <div className="skiper30" ref={gallery}>
      <div className="skiper30-grid" aria-hidden="true">
        {columns.map((column, index) => (
          <Column images={column} key={index} y={movement[index]} />
        ))}
      </div>
      <header className="skiper30-copy">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </header>
    </div>
  );
};

function Column({ images, y }: { images: readonly string[]; y: MotionValue<string> }) {
  return (
    <motion.div className="skiper30-column" style={{ y }}>
      {images.map((src) => (
        <figure key={src}>
          <Image src={src} alt="" fill sizes="(max-width: 720px) 46vw, 24vw" />
        </figure>
      ))}
    </motion.div>
  );
}

export { Skiper30 };
