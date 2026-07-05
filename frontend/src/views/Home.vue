<template>
  <div class="relative min-h-screen pb-16">
    <!-- SVG grain texture -->
    <svg class="grain select-none pointer-events-none">
      <filter id="grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)"/>
    </svg>

    <!-- Hero Header -->
    <header class="hero select-none py-12 border-b border-gridColor">
      <div class="max-w-[1440px] mx-auto px-6 md:px-12 hero__inner">
        <div class="hero__kicker kicker mb-2">// PUBLIC LOG // TRANSMISSION SPEC v1.0</div>
        <h1 class="text-5xl md:text-8xl font-display text-white tracking-wider mb-4">
          ENDER<span class="hero-ab">THOUGHTS</span>
        </h1>
        <p class="hero__sub text-sm md:text-base font-body text-fog max-w-[68ch] leading-relaxed">
          A transmission from a slightly alternate 1983 — where the network was wired a decade early and photography went digital while still feeling chemical. A place to share with family & friends our daily life trough images. <span class="cursor">_</span>
        </p>
      </div>
    </header>there

    <!-- Feed -->
    <section class="max-w-[680px] mx-auto px-4 py-10">

      <div v-if="photosStore.loading && photos.length === 0" class="flex items-center justify-center py-20 font-body text-phosphor">
        LOADING TRANSMISSIONS<span class="cursor">...</span>
      </div>

      <div v-else-if="photos.length === 0" class="flex flex-col items-center justify-center py-20 font-label text-fog select-none">
        // NO FRAMES IN THIS ZONE //
      </div>

      <div v-else class="space-y-10">
        <article
          v-for="photo in photos"
          :key="photo.id"
          class="group bg-surface cursor-pointer"
          @click="openPhotoLightbox(photo)"
        >
          <!-- Phosphor top accent line -->
          <div class="h-[2px] bg-phosphor/25 group-hover:bg-phosphor transition-colors duration-200"></div>

          <!-- Photo -->
          <img
            :src="thumbUrl(photo)"
            :srcset="thumbSrcset(photo)"
            sizes="(max-width: 640px) 100vw, 33vw"
            class="w-full h-auto block"
            :alt="photo.caption || 'frame'"
            loading="lazy"
          />

          <!-- Metadata panel (always visible) -->
          <div class="border-t border-gridColor px-4 py-3 space-y-2 bg-surface">

            <!-- Zone + date row -->
            <div class="flex items-center justify-between select-none">
              <span :class="['font-label text-xs px-1.5 py-0.5 border', photo.zone === 'analog' ? 'text-phosphor border-phosphor/40' : 'text-amber border-amber/40']">
                [ {{ photo.zone === 'analog' ? '35MM' : 'DIGITAL' }} ]
              </span>
              <span class="font-label text-xs text-dust">{{ formatDate(photo) }}</span>
            </div>

            <!-- Caption -->
            <p v-if="photo.caption" class="font-body text-sm text-amber leading-relaxed">
              {{ photo.caption }}
            </p>

            <!-- Tags -->
            <div v-if="parseTags(photo.tags).length > 0" class="flex flex-wrap gap-1.5 select-none">
              <TagBadge
                v-for="t in parseTags(photo.tags)"
                :key="t.id"
                :name="t.name"
                :color="t.color"
              />
            </div>

            <!-- Film info (analog only) -->
            <div v-if="photo.zone === 'analog' && photo.camera" class="font-label text-xs text-dust uppercase select-none">
              {{ photo.camera }}{{ photo.film_stock ? ` // ${photo.film_stock}` : '' }}
            </div>

            <!-- Likes & comments (inline — clicks stay here, don't open the lightbox) -->
            <div @click.stop>
              <PhotoInteractions :photo="photo" />
            </div>
          </div>
        </article>

        <!-- Load More / End of Feed -->
        <div class="flex flex-col items-center gap-3 pt-4 select-none">
          <button
            v-if="pagination.page < pagination.pages"
            class="btn btn--sm text-xs"
            :disabled="photosStore.loading"
            @click="loadMore"
          >
            <span v-if="photosStore.loading">LOADING<span class="cursor">_</span></span>
            <span v-else>[ LOAD MORE ]</span>
          </button>
          <p v-else class="font-label text-xs text-dust/50 uppercase tracking-widest">
            // END OF TRANSMISSION //
          </p>
        </div>
      </div>
    </section>

    <!-- Lightbox -->
    <Lightbox
      :photo="selectedPhoto"
      :is-open="lightboxOpen"
      :show-nav="photos.length > 1"
      :photos="photos"
      @close="closePhotoLightbox"
      @prev="navigateLightbox(-1)"
      @next="navigateLightbox(1)"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePhotosStore } from '@/stores/photos';
import TagBadge from '@/components/TagBadge.vue';
import Lightbox from '@/components/Lightbox.vue';
import PhotoInteractions from '@/components/PhotoInteractions.vue';

export default {
  name: 'Home',
  components: {
    TagBadge,
    Lightbox,
    PhotoInteractions
  },
  setup() {
    const photosStore = usePhotosStore();
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    const photos = computed(() => photosStore.photos);
    const pagination = computed(() => photosStore.pagination);

    onMounted(() => {
      document.body.classList.add('scanlines');
      photosStore.fetchPhotos(1, 12);
    });

    onUnmounted(() => {
      document.body.classList.remove('scanlines');
    });

    const loadMore = () => {
      const nextPage = pagination.value.page + 1;
      photosStore.fetchPhotos(nextPage, 12, true);
    };

    const parseTags = (tags) => {
      if (!tags) return [];
      if (typeof tags === 'string') {
        try { return JSON.parse(tags); } catch { return []; }
      }
      return Array.isArray(tags) ? tags : [];
    };

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const thumbUrl = (photo) => {
      if (!photo?.thumbnail) return '';
      if (photo.thumbnail.startsWith('http')) return photo.thumbnail;
      return `${apiBase}/uploads/${photo.thumbnail}`;
    };

    // 320px + 900px srcset; pre-migration photos lack the small variant
    const thumbSrcset = (photo) => {
      if (!photo?.thumbnail_small || photo.thumbnail.startsWith('http')) return undefined;
      return `${apiBase}/uploads/${photo.thumbnail_small} 320w, ${apiBase}/uploads/${photo.thumbnail} 900w`;
    };

    const formatDate = (photo) => {
      if (photo.published_at) {
        const d = new Date(photo.published_at);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (photo.zone === 'analog' && photo.analog_year) {
        return `${photo.analog_year}.${String(photo.analog_month || 1).padStart(2, '0')}`;
      }
      return '';
    };

    const openPhotoLightbox = (photo) => {
      selectedPhoto.value = photo;
      lightboxOpen.value = true;
    };

    const closePhotoLightbox = () => {
      lightboxOpen.value = false;
    };

    const navigateLightbox = (direction) => {
      if (!selectedPhoto.value) return;
      const currentIndex = photos.value.findIndex(p => p.id === selectedPhoto.value.id);
      if (currentIndex === -1) return;
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = photos.value.length - 1;
      if (nextIndex >= photos.value.length) nextIndex = 0;
      selectedPhoto.value = photos.value[nextIndex];
    };

    return {
      photosStore,
      photos,
      pagination,
      selectedPhoto,
      lightboxOpen,
      loadMore,
      parseTags,
      thumbUrl,
      thumbSrcset,
      formatDate,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>

<style scoped>
.hero-ab:hover {
  text-shadow: -1px 0 var(--neon-red), 1px 0 var(--neon-cyan);
}
</style>
