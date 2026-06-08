<template>
  <div class="wrap py-12">
    <!-- Back btn -->
    <div class="mb-6 select-none font-label text-xs">
      <router-link to="/digital" class="btn btn--ghost btn--sm">
        [ ◀ BACK TO TIMELINE ]
      </router-link>
    </div>

    <div v-if="loading && !gallery" class="flex items-center justify-center py-20 font-body text-phosphor">
      READING ARCHIVE INDEXES<span class="cursor">...</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 font-label text-neon-red">
      <div>// TRANSMISSION CORRUPTED OR GALLERY NOT FOUND //</div>
      <p class="text-xs text-dust mt-2">{{ error }}</p>
    </div>

    <div v-else-if="gallery" class="space-y-8">
      <!-- Month Header -->
      <header class="flex flex-col md:flex-row md:items-baseline md:justify-between border-b border-gridColor pb-6 gap-4">
        <div>
          <div class="month text-white font-display text-4xl uppercase select-none">
            <span class="tri text-amber">▶</span> {{ gallery.display_name }} 
            <span class="text-dust font-label text-base font-normal mx-2">//</span> 
            <span class="frames text-amber text-2xl font-label">{{ photos.length }} FRAMES</span>
          </div>
          <p class="text-xs font-body text-fog mt-1">
            Aggregated timeline directory: {{ gallery.year_month }}.
          </p>
        </div>

        <!-- Ingestion actions -->
        <div class="flex gap-3 select-none self-end md:self-auto">
          <button class="btn btn--ghost btn--sm" @click="triggerGooglePhotosPicker">
            [ LINK GOOGLE PHOTOS ]
          </button>
          <button class="btn btn--sm" @click="showUploadZone = !showUploadZone">
            [ {{ showUploadZone ? 'CLOSE UPLOADER' : 'DIRECT UPLOAD' }} ]
          </button>
        </div>
      </header>

      <!-- Direct Upload Drawer -->
      <div v-if="showUploadZone" class="p-6 border border-gridColor bg-surface/50">
        <h4 class="text-xs font-label text-dust uppercase mb-3 select-none">// TRANSMIT IMAGES TO {{ gallery.display_name }}</h4>
        <UploadZone @files-uploaded="handleFilesUploaded" />
      </div>

      <!-- Photos Grid -->
      <div>
        <div v-if="photos.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor/60 text-center select-none">
          // NO FRAMES CAPTURED IN THIS TIMELINE YET //
        </div>
        <div v-else class="grid-photos">
          <!-- Renders cards, with admin delete override overlays -->
          <div v-for="photo in photos" :key="photo.id" class="relative group">
            <PhotoCard :photo="photo" @click="openPhotoLightbox(photo)" />
            
            <!-- Admin delete action overlay -->
            <button 
              v-if="isAdmin" 
              class="absolute top-2 left-2 z-20 btn btn--danger btn--sm text-[9px] py-1 px-2 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              @click.stop="confirmDeletePhoto(photo.id)"
            >
              [ SCRAP ]
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- GOOGLE PHOTOS IMPORT PICKER MODAL -->
    <div v-if="showGooglePicker" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showGooglePicker = false">
      <div class="demo bracket max-w-[640px] w-full bg-surface border border-gridColor p-6 flex flex-col h-[80vh]">
        <span class="br-tr"></span><span class="br-bl"></span>
        
        <header class="mb-4">
          <h3 class="text-white font-display text-2xl uppercase mb-1 text-shadow-phosphor">// GOOGLE PHOTOS PICKER //</h3>
          <p class="text-xs font-body text-dust">Select frames to archive into the monthly dashboard</p>
        </header>

        <!-- Media list -->
        <div class="flex-1 overflow-y-auto border border-gridColor p-2 bg-void space-y-4">
          <div v-if="googleLoading" class="flex items-center justify-center h-full font-body text-phosphor">
            QUERYING GOOGLE PHOTO CLOUD<span class="cursor">...</span>
          </div>
          <div v-else-if="googleMediaItems.length === 0" class="flex items-center justify-center h-full font-label text-fog">
            // NO RECENT PHOTOS DETECTED IN CLOUD //
          </div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <div 
              v-for="item in googleMediaItems" 
              :key="item.id"
              :class="['relative border cursor-pointer aspect-square bg-panel overflow-hidden', 
                       selectedGoogleIds.includes(item.id) ? 'border-phosphor shadow-[0_0_4px_#00FF94]' : 'border-gridColor hover:border-dust']"
              @click="toggleGoogleSelect(item)"
            >
              <img :src="item.baseUrl" class="w-full h-full object-cover" alt="cloud photo" />
              <!-- Selection indicator -->
              <div v-if="selectedGoogleIds.includes(item.id)" class="absolute top-1 right-1 bg-phosphor text-void font-label text-[9px] px-1 font-bold">
                SEL
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex justify-between items-center mt-4 border-t border-gridColor/50 pt-4 select-none">
          <span class="text-xs font-body text-fog">{{ selectedGooglePhotos.length }} SECURE SELECTIONS</span>
          <div class="flex gap-2">
            <button class="btn btn--ghost text-xs" @click="showGooglePicker = false">[ CLOSE ]</button>
            <button class="btn text-xs" :disabled="selectedGooglePhotos.length === 0 || importingGoogle" @click="submitGoogleImport">
              <span v-if="importingGoogle">IMPORTING...</span>
              <span v-else>[ IMPORT SELECTED ]</span>
            </button>
          </div>
        </div>
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDigitalStore } from '@/stores/digital';
import { useAuthStore } from '@/stores/auth';
import GalleryMeta from '@/components/GalleryMeta.vue';
import PhotoCard from '@/components/PhotoCard.vue';
import PhotoGrid from '@/components/PhotoGrid.vue';
import UploadZone from '@/components/UploadZone.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'DigitalMonthlyGallery',
  components: {
    GalleryMeta,
    PhotoCard,
    PhotoGrid,
    UploadZone,
    Lightbox
  },
  setup() {
    const route = useRoute();
    const digitalStore = useDigitalStore();
    const authStore = useAuthStore();

    const error = ref(null);
    const loading = ref(true);
    const showUploadZone = ref(false);
    
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    // Google Photos Picker state
    const showGooglePicker = ref(false);
    const googleLoading = ref(false);
    const importingGoogle = ref(false);
    const googleMediaItems = ref([]);
    const selectedGooglePhotos = ref([]);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    const gallery = computed(() => digitalStore.currentGallery);
    const photos = computed(() => digitalStore.currentPhotos);
    const isAdmin = computed(() => authStore.isAdmin);

    const selectedGoogleIds = computed(() => selectedGooglePhotos.value.map(p => p.id));

    onMounted(async () => {
      // Load Google Sign-In SDK
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      document.head.appendChild(script);

      await loadGallery();
    });

    const loadGallery = async () => {
      try {
        await digitalStore.fetchGalleryDetail(route.params.yearMonth);
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    };

    const handleFilesUploaded = async ({ files, onSuccess, onFailure }) => {
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));
        await digitalStore.uploadPhotos(gallery.value.id, formData);
        onSuccess();
        showUploadZone.value = false;
      } catch (err) {
        onFailure();
      }
    };

    const confirmDeletePhoto = async (photoId) => {
      if (confirm('CRITICAL WARN: SECURELY SCRAP THIS FRAME FROM TIMELINE?')) {
        await digitalStore.deletePhoto(photoId, gallery.value.year_month);
      }
    };

    // Google Photos Picker OAuth and Loading
    const triggerGooglePhotosPicker = () => {
      if (!googleClientId) {
        alert('Google Client ID configuration missing. Please review backend setup.');
        return;
      }

      if (typeof google === 'undefined') {
        alert('Google Identity library loading... Try again in a moment.');
        return;
      }

      googleLoading.value = true;
      showGooglePicker.value = true;
      selectedGooglePhotos.value = [];

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            googleLoading.value = false;
            showGooglePicker.value = false;
            alert('OAuth connection failed: ' + tokenResponse.error_description);
            return;
          }
          if (tokenResponse.access_token) {
            await fetchGooglePhotos(tokenResponse.access_token);
          }
        }
      });

      tokenClient.requestAccessToken();
    };

    const fetchGooglePhotos = async (accessToken) => {
      try {
        // Query google photos API endpoints via CORS (supported for mediaItems list)
        const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=24', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to query media Items: ' + response.statusText);
        }
        const data = await response.json();
        googleMediaItems.value = data.mediaItems || [];
      } catch (err) {
        alert('Photos fetch failure: ' + err.message);
        showGooglePicker.value = false;
      } finally {
        googleLoading.value = false;
      }
    };

    const toggleGoogleSelect = (item) => {
      const idx = selectedGooglePhotos.value.findIndex(p => p.id === item.id);
      if (idx === -1) {
        selectedGooglePhotos.value.push(item);
      } else {
        selectedGooglePhotos.value.splice(idx, 1);
      }
    };

    const submitGoogleImport = async () => {
      importingGoogle.value = true;
      try {
        // Build items payload (backend will download the images using baseUrls)
        const payload = selectedGooglePhotos.value.map(item => ({
          id: item.id,
          baseUrl: item.baseUrl,
          filename: item.filename || 'google_photos_import.jpg'
        }));

        await digitalStore.importGooglePhotos(gallery.value.id, payload);
        showGooglePicker.value = false;
      } catch (err) {
        alert('Google Import processing failure: ' + err.message);
      } finally {
        importingGoogle.value = false;
      }
    };

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
      showUploadZone,
      isAdmin,
      selectedPhoto,
      lightboxOpen,
      showGooglePicker,
      googleLoading,
      importingGoogle,
      googleMediaItems,
      selectedGooglePhotos,
      selectedGoogleIds,
      handleFilesUploaded,
      confirmDeletePhoto,
      triggerGooglePhotosPicker,
      toggleGoogleSelect,
      submitGoogleImport,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>
