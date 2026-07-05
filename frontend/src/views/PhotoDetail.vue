<template>
  <div class="wrap py-12">
    <div class="mb-6 select-none font-label text-xs">
      <router-link to="/" class="btn btn--ghost btn--sm">
        [ ◀ BACK TO PUBLIC FEED ]
      </router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      RETRIEVING IMAGE DETAILS<span class="cursor">...</span>
    </div>
    
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 font-label text-neon-red">
      <div>// TRANSMISSION CORRUPTED OR PHOTO NOT FOUND //</div>
      <p class="text-xs text-dust mt-2">{{ error }}</p>
    </div>

    <div v-else-if="photo" class="flex flex-col items-center select-text">
      <!-- Full Image Container -->
      <div class="max-w-4xl border border-gridColor bg-surface p-2 w-full">
        <img :src="imageUrl" class="w-full h-auto object-contain max-h-[70vh] border border-gridColor" :alt="photo.caption || 'Photo'" />
      </div>

      <!-- EXIF / Caption Readout Card -->
      <div class="max-w-4xl w-full mt-6 space-y-4">
        <div class="p-4 border border-gridColor bg-panel">
          <p class="exif text-[11px] leading-relaxed text-dust break-all">
            FILE: <span class="text-fog">{{ fileName }}</span>
            <!-- Real camera/film metadata (analog), only when set -->
            <template v-if="photo.camera || photo.film_stock">
              <span class="mx-2 text-dust/60">//</span> CAMERA: <b class="text-chrome font-medium">{{ photo.camera || 'N/A' }}</b>
              <span class="mx-2 text-dust/60">//</span> FILM: <b class="text-chrome font-medium">{{ photo.film_stock || 'N/A' }}</b>
            </template>
            <span class="mx-2 text-dust/60">//</span>
            <a
              :href="downloadUrl"
              :download="fileName"
              class="text-chrome hover:text-phosphor transition-colors duration-150 select-none"
            >[ ↓ FULL RES ]</a>
          </p>

          <p v-if="photo.caption" class="font-body text-sm text-chrome mt-3 border-t border-gridColor/40 pt-3">
            {{ photo.caption }}
          </p>
        </div>

        <!-- Tag badges row -->
        <div v-if="tags.length > 0" class="flex flex-wrap gap-2 select-none">
          <TagBadge v-for="t in tags" :key="t.id" :name="t.name" :color="t.color" />
        </div>

        <PhotoInteractions v-if="photo" :photo="photo" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePhotosStore } from '@/stores/photos';
import TagBadge from '@/components/TagBadge.vue';
import PhotoInteractions from '@/components/PhotoInteractions.vue';

export default {
  name: 'PhotoDetail',
  components: {
    TagBadge,
    PhotoInteractions
  },
  setup() {
    const route = useRoute();
    const photosStore = usePhotosStore();
    const error = ref(null);
    const loading = ref(true);

    const photo = computed(() => photosStore.currentPhoto);
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const mediaUrl = (rel) => (rel.startsWith('http') ? rel : `${apiBase}/uploads/${rel}`);

    // Show the 900px thumbnail (the container caps at 70vh anyway); the
    // 5000px original stays behind the explicit FULL RES download link.
    const imageUrl = computed(() => {
      if (!photo.value) return '';
      if (photo.value.media_type === 'video' || !photo.value.thumbnail) return mediaUrl(photo.value.filename);
      return mediaUrl(photo.value.thumbnail);
    });

    const downloadUrl = computed(() => (photo.value ? mediaUrl(photo.value.filename) : ''));

    const fileName = computed(() => {
      if (!photo.value) return 'N/A';
      return photo.value.original_filename || photo.value.filename.split('/').pop();
    });

    const tags = computed(() => {
      if (!photo.value) return [];
      return photo.value.tags || [];
    });

    onMounted(async () => {
      try {
        await photosStore.fetchPhotoDetail(route.params.id);
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    });

    return {
      photo,
      loading,
      error,
      imageUrl,
      downloadUrl,
      fileName,
      tags
    };
  }
};
</script>
