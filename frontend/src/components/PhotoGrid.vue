<template>
  <div class="grid-photos">
    <PhotoCard
      v-for="photo in photos"
      :key="photo.id"
      :photo="photo"
      @click="$emit('photo-click', photo)"
    />
  </div>
</template>

<script>
import PhotoCard from './PhotoCard.vue';

export default {
  name: 'PhotoGrid',
  components: {
    PhotoCard
  },
  props: {
    photos: {
      type: Array,
      required: true
    }
  },
  emits: ['photo-click']
};
</script>
