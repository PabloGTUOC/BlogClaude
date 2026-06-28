<template>
  <div class="pcard relative group select-none overflow-hidden border border-gridColor bg-surface cursor-pointer focus:outline-none focus:ring-1 focus:ring-phosphor" tabindex="0" @click="$emit('click')" @keydown.enter="$emit('click')">
    <!-- Format Badge (Top-Right) -->
    <span :class="['pcard__badge', photo.zone === 'digital' ? 'pcard__badge--digital' : '']">
      [{{ photo.zone === 'analog' ? '35mm' : 'DIGITAL' }}]
    </span>

    <!-- Thumbnail Image -->
    <img class="pcard__img w-full h-full object-cover absolute inset-0" :src="thumbUrl" :alt="photo.caption || 'Photo'" loading="lazy" />

    <!-- Caption Overlay on Hover -->
    <div class="pcard__cap flex flex-col justify-end bg-void/90 border-t border-gridColor p-3 absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <div class="text-amber font-body text-xs md:text-sm">
        {{ photo.caption || '// NO CAPTION //' }}
        <span v-if="photo.uploader_name" class="text-fog mt-1 text-[11px] font-label block uppercase">
          ↑ BY {{ photo.uploader_name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'PhotoCard',
  props: {
    photo: {
      type: Object,
      required: true
    }
  },
  emits: ['click'],
  setup(props) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const thumbUrl = computed(() => {
      if (!props.photo.thumbnail) return '';
      if (props.photo.thumbnail.startsWith('http')) return props.photo.thumbnail;
      return `${apiBase}/uploads/${props.photo.thumbnail}`;
    });

    const imageUrl = computed(() => {
      if (!props.photo.filename) return '';
      if (props.photo.filename.startsWith('http')) return props.photo.filename;
      return `${apiBase}/uploads/${props.photo.filename}`;
    });

    return {
      thumbUrl,
      imageUrl
    };
  }
};
</script>
