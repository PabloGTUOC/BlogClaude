<template>
  <div class="font-body text-xs md:text-sm text-fog flex flex-wrap items-center gap-y-2 select-none uppercase">
    <span>// CAMERA: <b class="text-chrome font-medium">{{ camera }}</b></span>
    <span class="mx-3 text-dust">//</span>
    <span>FILM: <b class="text-chrome font-medium">{{ filmStock }}</b></span>
    <span class="mx-3 text-dust">//</span>
    <span>{{ formattedMonth }} {{ year }}</span>
    <template v-if="tags && tags.length > 0">
      <span class="mx-3 text-dust">//</span>
      <div class="flex flex-wrap gap-2">
        <TagBadge v-for="t in tags" :key="t.id" :name="t.name" :color="t.color" />
      </div>
    </template>
  </div>
</template>

<script>
import { computed } from 'vue';
import TagBadge from './TagBadge.vue';

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

export default {
  name: 'GalleryMeta',
  components: {
    TagBadge
  },
  props: {
    camera: {
      type: String,
      required: true
    },
    filmStock: {
      type: String,
      required: true
    },
    month: {
      type: [Number, String],
      required: true
    },
    year: {
      type: [Number, String],
      required: true
    },
    tags: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const formattedMonth = computed(() => {
      const idx = parseInt(props.month, 10) - 1;
      return MONTH_NAMES[idx] || String(props.month).toUpperCase();
    });

    return {
      formattedMonth
    };
  }
};
</script>
