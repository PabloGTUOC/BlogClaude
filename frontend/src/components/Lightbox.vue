<template>
  <div :class="['lightbox', isOpen ? 'open' : '']" @click.self="close">
    <!-- Close button (top right) -->
    <button class="btn btn--ghost lightbox__close select-none" @click="close">[ ESC ]</button>

    <!-- Centered Full-res Media -->
    <div class="flex flex-col items-center justify-center max-w-[85vw] max-h-[85vh]">
      <video
        v-if="isVideo"
        class="lightbox__img max-h-[60vh] object-contain border border-gridColor bg-black"
        :src="imageUrl"
        controls
        autoplay
        playsinline
      ></video>
      <img v-else class="lightbox__img max-h-[60vh] object-contain border border-gridColor" :src="imageUrl" :alt="photo?.caption || 'Photo'" />
      
      <!-- Metadata panel directly underneath -->
      <div class="lightbox__panel mt-4 w-full text-left">
        <p class="exif text-xs md:text-sm font-body text-fog select-text leading-relaxed">
          FILE: <b class="text-chrome font-medium">{{ fileName }}</b>
          <template v-if="exifData">
            <span class="mx-2 text-dust">//</span> ISO: <b class="text-chrome font-medium">{{ exifData.ISO || 'N/A' }}</b>
            <span class="mx-2 text-dust">//</span> APERTURE: <b class="text-chrome font-medium">{{ formattedAperture }}</b>
            <span class="mx-2 text-dust">//</span> SHUTTER: <b class="text-chrome font-medium">{{ formattedShutter }}</b>
            <span v-if="cameraInfo" class="mx-2 text-dust">//</span> CAMERA: <b class="text-chrome font-medium">{{ cameraInfo }}</b>
            <span v-if="lensInfo" class="mx-2 text-dust">//</span> LENS: <b class="text-chrome font-medium">{{ lensInfo }}</b>
          </template>
          <!-- Show basic film/camera metadata if analog gallery meta is appended -->
          <template v-else-if="photo?.camera || photo?.film_stock">
            <span class="mx-2 text-dust">//</span> CAMERA: <b class="text-chrome font-medium">{{ photo.camera || 'N/A' }}</b>
            <span class="mx-2 text-dust">//</span> FILM: <b class="text-chrome font-medium">{{ photo.film_stock || 'N/A' }}</b>
          </template>
        </p>

        <!-- Tag badges row -->
        <div v-if="tags && tags.length > 0" class="lb-tags flex flex-wrap gap-2 mt-3 select-none">
          <TagBadge v-for="t in tags" :key="t.id" :name="t.name" :color="t.color" />
        </div>
      </div>
    </div>

    <!-- Viewport edge navigations -->
    <div v-if="showNav" class="lightbox__nav select-none font-label flex justify-between w-[85vw] text-chrome">
      <span class="cursor-pointer hover:text-phosphor transition-colors duration-150" @click.stop="$emit('prev')">◀ PREV</span>
      <span class="cursor-pointer hover:text-phosphor transition-colors duration-150" @click.stop="$emit('next')">NEXT ▶</span>
    </div>
  </div>
</template>

<script>
import { computed, watch, onMounted, onUnmounted } from 'vue';
import TagBadge from './TagBadge.vue';

export default {
  name: 'Lightbox',
  components: {
    TagBadge
  },
  props: {
    photo: {
      type: Object,
      default: null
    },
    isOpen: {
      type: Boolean,
      default: false
    },
    showNav: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'prev', 'next'],
  setup(props, { emit }) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const isVideo = computed(() => props.photo?.media_type === 'video');

    const imageUrl = computed(() => {
      if (!props.photo) return '';
      if (props.photo.filename.startsWith('http')) return props.photo.filename;
      return `${apiBase}/uploads/${props.photo.filename}`;
    });

    const fileName = computed(() => {
      if (!props.photo) return 'N/A';
      return props.photo.filename.split('/').pop();
    });

    const tags = computed(() => {
      if (!props.photo) return [];
      if (typeof props.photo.tags === 'string') {
        try {
          return JSON.parse(props.photo.tags);
        } catch (e) {
          return [];
        }
      }
      return props.photo.tags || [];
    });

    const exifData = computed(() => {
      if (!props.photo || !props.photo.exif_json) return null;
      if (typeof props.photo.exif_json === 'string') {
        try {
          return JSON.parse(props.photo.exif_json);
        } catch (e) {
          return null;
        }
      }
      return props.photo.exif_json;
    });

    // Formatting helpers
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
        const recip = Math.round(1 / s);
        return `1/${recip}s`;
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

    const close = () => {
      emit('close');
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (!props.isOpen) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft' && props.showNav) emit('prev');
      if (e.key === 'ArrowRight' && props.showNav) emit('next');
    };

    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden'; // Lock scrolling
      } else {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = ''; // Restore scrolling
      }
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    });

    return {
      isVideo,
      imageUrl,
      fileName,
      tags,
      exifData,
      formattedAperture,
      formattedShutter,
      cameraInfo,
      lensInfo,
      close
    };
  }
};
</script>
