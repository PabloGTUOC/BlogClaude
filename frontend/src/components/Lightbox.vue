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
        <p class="exif text-[11px] font-body text-dust select-text leading-relaxed break-all">
          FILE: <span class="text-fog">{{ fileName }}</span>
          <!-- Real camera/film metadata (analog), only when set -->
          <template v-if="photo?.camera || photo?.film_stock">
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

        <!-- Tag badges row -->
        <div v-if="tags && tags.length > 0" class="lb-tags flex flex-wrap gap-2 mt-3 select-none">
          <TagBadge v-for="t in tags" :key="t.id" :name="t.name" :color="t.color" />
        </div>

        <PhotoInteractions v-if="photo" :key="photo.id" :photo="photo" />
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
import { computed, watch, onUnmounted } from 'vue';
import TagBadge from './TagBadge.vue';
import PhotoInteractions from './PhotoInteractions.vue';

export default {
  name: 'Lightbox',
  components: {
    TagBadge,
    PhotoInteractions
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
    },
    // Full photo list the lightbox is navigating; used only to preload the
    // neighbours' display images so PREV/NEXT feels instant.
    photos: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'prev', 'next'],
  setup(props, { emit }) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const isVideo = computed(() => props.photo?.media_type === 'video');

    const mediaUrl = (rel) => (rel.startsWith('http') ? rel : `${apiBase}/uploads/${rel}`);

    // Videos have no smaller variant; images display the 900px thumbnail —
    // plenty for an ~85vh viewport and far faster to fetch than the 5000px
    // original, which stays behind the explicit FULL RES download link.
    const displayUrl = (photo) => {
      if (!photo) return '';
      if (photo.media_type === 'video' || !photo.thumbnail) return mediaUrl(photo.filename);
      return mediaUrl(photo.thumbnail);
    };

    const imageUrl = computed(() => displayUrl(props.photo));

    const downloadUrl = computed(() => (props.photo ? mediaUrl(props.photo.filename) : ''));

    const fileName = computed(() => {
      if (!props.photo) return 'N/A';
      return props.photo.original_filename || props.photo.filename.split('/').pop();
    });

    // Warm the browser cache for the adjacent photos' display images so
    // PREV/NEXT doesn't wait on the network.
    const preloadNeighbors = () => {
      if (!props.isOpen || !props.photo || props.photos.length < 2) return;
      const idx = props.photos.findIndex(p => p.id === props.photo.id);
      if (idx === -1) return;
      const len = props.photos.length;
      for (const neighbor of [props.photos[(idx + 1) % len], props.photos[(idx - 1 + len) % len]]) {
        if (neighbor && neighbor.media_type !== 'video') {
          new Image().src = displayUrl(neighbor);
        }
      }
    };

    watch(() => [props.photo, props.isOpen], preloadNeighbors);

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
      downloadUrl,
      fileName,
      tags,
      close
    };
  }
};
</script>
