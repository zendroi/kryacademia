import { useRef } from "react";

type Skiper30Props = {
  eyebrow: string;
  images: readonly string[];
  title: string;
};

const Skiper30 = ({ eyebrow, images, title }: Skiper30Props) => {
  const gallery = useRef<HTMLDivElement>(null);
  const columns = Array.from({ length: 4 }, (_, column) => images.filter((_, index) => index % 4 === column));

  return (
    <div className="skiper30" ref={gallery}>
      <div className="skiper30-grid" aria-hidden="true">
        {columns.map((column, index) => (
          <div className="skiper30-column" key={index}>
            {column.map((src) => (
              <figure key={src}>
                <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </figure>
            ))}
          </div>
        ))}
      </div>
      <header className="skiper30-copy">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </header>
    </div>
  );
};

export { Skiper30 };
