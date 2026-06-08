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
          <p class="exif text-xs md:text-sm leading-relaxed text-fog">
            FILE: <b class="text-chrome font-medium">{{ fileName }}</b>
            <template v-if="exifData">
              <span class="mx-2 text-dust">//</span> ISO: <b class="text-chrome font-medium">{{ exifData.ISO || 'N/A' }}</b>
              <span class="mx-2 text-dust">//</span> APERTURE: <b class="text-chrome font-medium">{{ formattedAperture }}</b>
              <span class="mx-2 text-dust">//</span> SHUTTER: <b class="text-chrome font-medium">{{ formattedShutter }}</b>
              <span v-if="cameraInfo" class="mx-2 text-dust">//</span> CAMERA: <b class="text-chrome font-medium">{{ cameraInfo }}</b>
              <span v-if="lensInfo" class="mx-2 text-dust">//</span> LENS: <b class="text-chrome font-medium">{{ lensInfo }}</b>
            </template>
            <template v-else-if="photo.camera || photo.film_stock">
              <span class="mx-2 text-dust">//</span> CAMERA: <b class="text-chrome font-medium">{{ photo.camera || 'N/A' }}</b>
              <span class="mx-2 text-dust">//</span> FILM: <b class="text-chrome font-medium">{{ photo.film_stock || 'N/A' }}</b>
            </template>
          </p>

          <p v-if="photo.caption" class="font-body text-sm text-chrome mt-3 border-t border-gridColor/40 pt-3">
            {{ photo.caption }}
          </p>
        </div>

        <!-- Tag badges row -->
        <div v-if="tags.length > 0" class="flex flex-wrap gap-2 select-none">
          <TagBadge v-for="t in tags" :key="t.id" :name="t.name" :color="t.color" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePhotosStore } from '@/stores/photos';
import TagBadge from '@/components/TagBadge.vue';

export default {
  name: 'PhotoDetail',
  components: {
    TagBadge
  },
  setup() {
    const route = useRoute();
    const photosStore = usePhotosStore();
    const error = ref(null);
    const loading = ref(true);

    const photo = computed(() => photosStore.currentPhoto);
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const imageUrl = computed(() => {
      if (!photo.value) return '';
      if (photo.value.filename.startsWith('http')) return photo.value.filename;
      return `${apiBase}/uploads/${photo.value.filename}`;
    });

    const fileName = computed(() => {
      if (!photo.value) return 'N/A';
      return photo.value.filename.split('/').pop();
    });

    const tags = computed(() => {
      if (!photo.value) return [];
      return photo.value.tags || [];
    });

    const exifData = computed(() => {
      if (!photo.value || !photo.value.exif_json) return null;
      if (typeof photo.value.exif_json === 'string') {
        try {
          return JSON.parse(photo.value.exif_json);
        } catch (e) {
          return null;
        }
      }
      return photo.value.exif_json;
    });

    const formattedAperture = computed(() => {
      if (!exifData.value) return 'N/A';
      const f = exifData.value.FNumber || exifData.value.ApertureValue;
      return f ? `f/${f}` : 'N/A';
    });

    const formattedShutter = computed(() => {
      if (!exifData.value) return 'N/A';
      const s = exifData.value.ExposureTime || exifData.value.ShutterSpeedValue;
      if (!s) return 'N/A';
      if (s < 1) {
        return `1/${Math.round(1 / s)}s`;
      }
      return `${s}s`;
    });

    const cameraInfo = computed(() => {
      if (!exifData.value) return null;
      const make = exifData.value.Make || '';
      const model = exifData.value.Model || '';
      if (!make && !model) return null;
      return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
    });

    const lensInfo = computed(() => {
      if (!exifData.value) return null;
      return exifData.value.LensModel || exifData.value.LensInfo || null;
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
      fileName,
      tags,
      exifData,
      formattedAperture,
      formattedShutter,
      cameraInfo,
      lensInfo
    };
  }
};
</script>
