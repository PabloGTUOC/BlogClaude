<template>
  <div class="wrap py-12">
    <!-- Back btn -->
    <div class="mb-6 select-none font-label text-xs">
      <router-link to="/analog" class="btn btn--ghost btn--sm">
        [ ◀ BACK TO ANALOG INDEX ]
      </router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      READING ARCHIVE INDEXES<span class="cursor">...</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 font-label text-neon-red">
      <div>// TRANSMISSION CORRUPTED OR ROLL NOT FOUND //</div>
      <p class="text-xs text-dust mt-2">{{ error }}</p>
    </div>

    <div v-else-if="gallery" class="space-y-8">
      <!-- Gallery details header -->
      <div class="border-b border-gridColor pb-6 space-y-3">
        <h2 class="text-3xl md:text-4xl font-display text-white tracking-wide uppercase">
          ROLL #{{ String(gallery.id).padStart(3, '0') }}: {{ gallery.title }}
        </h2>

        <GalleryMeta
          :camera="gallery.camera"
          :film-stock="gallery.film_stock"
          :month="gallery.month"
          :year="gallery.year"
          :tags="gallery.tags"
        />

        <p v-if="gallery.notes" class="text-xs font-body text-fog max-w-3xl leading-relaxed bg-panel/30 p-3 border border-gridColor/40">
          {{ gallery.notes }}
        </p>
      </div>

      <!-- Photos grid -->
      <div>
        <h3 class="text-xs font-label text-dust uppercase mb-4 select-none">// CAPTURED FRAMES</h3>
        <div v-if="photos.length === 0" class="text-xs font-body text-fog py-12 border border-dashed border-gridColor/60 text-center">
          // NO FRAMES CAPTURED ON THIS ROLL //
        </div>
        <PhotoGrid v-else :photos="photos" @photo-click="openPhotoLightbox" />
      </div>
    </div>

    <!-- Lightbox -->
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAnalogStore } from '@/stores/analog';
import GalleryMeta from '@/components/GalleryMeta.vue';
import PhotoGrid from '@/components/PhotoGrid.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'AnalogGalleryDetail',
  components: {
    GalleryMeta,
    PhotoGrid,
    Lightbox
  },
  setup() {
    const route = useRoute();
    const analogStore = useAnalogStore();
    
    const error = ref(null);
    const loading = ref(true);
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    const gallery = computed(() => analogStore.currentGallery);
    const photos = computed(() => analogStore.currentPhotos);

    const openPhotoById = (photoId) => {
      const id = parseInt(photoId, 10);
      const photo = photos.value.find(p => p.id === id);
      if (photo) {
        selectedPhoto.value = photo;
        lightboxOpen.value = true;
      }
    };

    onMounted(async () => {
      try {
        await analogStore.fetchGalleryDetail(route.params.id);
        if (route.params.photoId) {
          openPhotoById(route.params.photoId);
        }
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    });

    // If user navigates between photo routes without remounting the component
    watch(() => route.params.photoId, (newId) => {
      if (newId && photos.value.length > 0) {
        openPhotoById(newId);
      }
    });

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
      gallery,
      photos,
      loading,
      error,
      selectedPhoto,
      lightboxOpen,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>
