<template>
  <div 
    class="pcard relative flex flex-col justify-between overflow-hidden border border-gridColor bg-surface cursor-pointer select-none min-h-[160px] group"
    @click="$emit('click')"
  >
    <!-- Background Cover Image (If available) -->
    <div v-if="coverUrl" class="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-200">
      <img :src="coverUrl" class="w-full h-full object-cover" alt="Gallery Cover" />
    </div>

    <!-- Terminal corners decoration -->
    <div class="z-10 p-4 flex flex-col justify-between h-full flex-1">
      <div>
        <div class="text-xs font-label text-phosphor tracking-wider uppercase mb-1">
          // GALLERY // {{ zone }}
        </div>
        <h3 class="text-xl md:text-2xl font-display text-white tracking-wide uppercase leading-tight">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="text-xs font-body text-fog mt-1">
          {{ subtitle }}
        </p>
      </div>

      <div class="mt-4 flex items-center justify-between border-t border-gridColor/50 pt-3 text-xs font-label text-dust">
        <span>{{ photoCount }} FRAMES</span>
        <span v-if="contributorCount !== undefined" class="text-amber">{{ contributorCount }} CONTRIBUTORS</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'GalleryCard',
  props: {
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: ''
    },
    zone: {
      type: String,
      default: 'ANALOG'
    },
    photoCount: {
      type: [Number, String],
      default: 0
    },
    contributorCount: {
      type: Number,
      default: undefined
    },
    coverPhoto: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  setup(props) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const coverUrl = computed(() => {
      if (!props.coverPhoto) return '';
      if (props.coverPhoto.startsWith('http')) return props.coverPhoto;
      return `${apiBase}/uploads/${props.coverPhoto}`;
    });

    return {
      coverUrl
    };
  }
};
</script>
