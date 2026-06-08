<template>
  <div class="relative min-h-screen pb-16">
    <!-- SVGs texture noise grain (opacity ~3.5%) -->
    <svg class="grain select-none pointer-events-none">
      <filter id="grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)"/>
    </svg>

    <!-- Hero Header section -->
    <header class="hero select-none py-12 border-b border-gridColor">
      <div class="max-w-[1440px] mx-auto px-6 md:px-12 hero__inner">
        <div class="hero__kicker kicker mb-2">// PUBLIC LOG // TRANSMISSION SPEC v1.0</div>
        <h1 class="text-5xl md:text-8xl font-display text-white tracking-wider mb-4">
          ENDER<span class="ab hover:aberration">THOUGHTS</span>
        </h1>
        <p class="hero__sub text-sm md:text-base font-body text-fog max-w-[68ch] leading-relaxed">
          A transmission from a slightly alternate 1984 — where the network was wired a decade early and photography went digital while still feeling chemical. Retro-brutalist. CRT phosphor on wet-concrete black. <span class="cursor">_</span>
        </p>
      </div>
    </header>

    <!-- Public Grid Section -->
    <section class="max-w-[1440px] mx-auto px-6 md:px-12 py-8">
      <div v-if="photosStore.loading && photos.length === 0" class="flex items-center justify-center py-20 font-body text-phosphor">
        LOADING TRANSMISSIONS<span class="cursor">...</span>
      </div>
      <div v-else-if="photos.length === 0" class="flex flex-col items-center justify-center py-20 font-label text-fog select-none">
        <div>// NO FRAMES IN THIS ZONE //</div>
      </div>
      <div v-else>
        <!-- Masonry Grid -->
        <PhotoGrid :photos="photos" @photo-click="openPhotoLightbox" />

        <!-- Pagination Controls -->
        <div class="flex items-center justify-center gap-4 mt-12 select-none font-label text-xs">
          <button 
            class="btn btn--sm" 
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            [ PREV ]
          </button>
          <span class="text-fog">
            PAGE {{ pagination.page }} OF {{ pagination.pages }}
          </span>
          <button 
            class="btn btn--sm" 
            :disabled="pagination.page >= pagination.pages"
            @click="changePage(pagination.page + 1)"
          >
            [ NEXT ]
          </button>
        </div>
      </div>
    </section>

    <!-- Global Lightbox Detail -->
    <Lightbox 
      :photo="selectedPhoto" 
      :is-open="lightboxOpen"
      :show-nav="photos.length > 1"
      @close="closePhotoLightbox"
      @prev="navigateLightbox(-1)"
      @next="navigateLightbox(1)"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { usePhotosStore } from '@/stores/photos';
import PhotoGrid from '@/components/PhotoGrid.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'Home',
  components: {
    PhotoGrid,
    Lightbox
  },
  setup() {
    const photosStore = usePhotosStore();
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    const photos = computed(() => photosStore.photos);
    const pagination = computed(() => photosStore.pagination);

    onMounted(() => {
      photosStore.fetchPhotos(1, 12);
    });

    const changePage = (newPage) => {
      photosStore.fetchPhotos(newPage, 12);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      changePage,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>
