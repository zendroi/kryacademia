import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { activities } from './mockData';

export default function ActivitiesInfiniteScroll() {
  const [carouselRef, carousel] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!carousel) return;
    const onSelect = () => setSelected(carousel.selectedScrollSnap());
    onSelect();
    carousel.on('select', onSelect).on('reInit', onSelect);
    return () => {
      carousel.off('select', onSelect).off('reInit', onSelect);
    };
  }, [carousel]);

  return (
    <div
      className="activities-gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label="KRYAcademia activity gallery"
      data-active-index={selected}
    >
      <div
        className="activities-carousel"
        ref={carouselRef}
        tabIndex={0}
        aria-label="Activity photos"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') carousel?.scrollPrev();
          if (event.key === 'ArrowRight') carousel?.scrollNext();
        }}
      >
        <div className="activities-track flex gap-4">
          {activities.map(([title, url], index) => (
            <figure
              className="activity-slide flex-shrink-0 w-[280px] md:w-[360px] h-[400px] md:h-[480px] rounded-2xl overflow-hidden relative"
              key={`${url}-${index}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${activities.length}`}
            >
              <img
                src={url}
                alt={title}
                draggable={false}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                <span className="text-white text-sm font-medium">{title}</span>
              </div>
            </figure>
          ))}
        </div>
      </div>

      <div className="gallery-controls flex gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={() => carousel?.scrollPrev()}
          aria-label="Previous activity photos"
          className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => carousel?.scrollNext()}
          aria-label="Next activity photos"
          className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
