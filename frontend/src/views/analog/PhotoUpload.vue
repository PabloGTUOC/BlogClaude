<template>
  <div class="wrap py-12">
    <div class="mb-6 select-none font-label text-xs">
      <router-link :to="`/analog/${galleryId}`" class="btn btn--ghost btn--sm">
        [ ◀ BACK TO GALLERY ]
      </router-link>
    </div>

    <header class="section__head border-b border-gridColor pb-6 mb-8">
      <div class="section__num">ADD</div>
      <h2 class="section__title">// TRANSMIT IMAGES //</h2>
      <p class="section__desc">Select and upload scanned frames directly to roll archive index #{{ galleryId }}.</p>
    </header>

    <div class="max-w-2xl bg-surface border border-gridColor p-6">
      <UploadZone @files-uploaded="handleFilesUploaded" />
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAnalogStore } from '@/stores/analog';
import UploadZone from '@/components/UploadZone.vue';

export default {
  name: 'PhotoUpload',
  components: {
    UploadZone
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const analogStore = useAnalogStore();

    const galleryId = computed(() => route.params.id);

    const handleFilesUploaded = async ({ files, onSuccess, onFailure }) => {
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));
        await analogStore.uploadPhotos(galleryId.value, formData);
        onSuccess();
        setTimeout(() => {
          router.push(`/analog/${galleryId.value}`);
        }, 1000);
      } catch (err) {
        onFailure();
      }
    };

    return {
      galleryId,
      handleFilesUploaded
    };
  }
};
</script>
