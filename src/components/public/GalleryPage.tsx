import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { GalleryImage } from '../../types';
import { Image, X, Calendar, Sparkles } from 'lucide-react';

export const GalleryPage: React.FC = () => {
  const { galleryImages } = useSchool();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  const categories = ['All', 'Campus', 'Sports Day', 'Science Fair', 'Graduation', 'Arts & Culture'];

  const filteredImages = galleryImages.filter(
    (img) => selectedCategory === 'All' || img.category === selectedCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Page Title Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Campus Life
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white">
          Photo & Media Gallery
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Explore our vibrant facilities, athletic competitions, cultural festivals, and graduation moments.
        </p>
      </div>

      {/* Category Pills Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Image Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredImages.map((img) => (
          <div
            key={img.id}
            onClick={() => setLightboxImage(img)}
            className="group relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md cursor-pointer aspect-video"
          >
            <img
              src={img.imageUrl}
              alt={img.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end text-white space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                {img.category}
              </span>
              <h3 className="font-bold text-sm leading-tight">{img.title}</h3>
              <p className="text-[11px] text-slate-300 line-clamp-1">{img.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 text-white rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 bg-slate-950/80 text-white p-2 rounded-full hover:bg-amber-500 hover:text-slate-950 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={lightboxImage.imageUrl} alt={lightboxImage.title} className="w-full h-[450px] object-cover" />
            <div className="p-6 space-y-2">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">{lightboxImage.category}</span>
              <h2 className="font-serif font-bold text-2xl">{lightboxImage.title}</h2>
              <p className="text-slate-300 text-sm">{lightboxImage.caption}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
