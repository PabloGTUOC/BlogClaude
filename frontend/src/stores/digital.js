import { defineStore } from 'pinia';
import api from '@/services/api';

export const useDigitalStore = defineStore('digital', {
  state: () => ({
    galleries: [],
    currentGallery: null,
    currentPhotos: [],
    loading: false
  }),
  actions: {
    async fetchGalleries() {
      this.loading = true;
      try {
        const response = await api.get('/digital/galleries');
        this.galleries = response.data;
      } catch (error) {
        console.error('Failed to fetch digital galleries timeline:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async fetchGalleryDetail(idOrYearMonth) {
      this.loading = true;
      try {
        const response = await api.get(`/digital/galleries/${idOrYearMonth}`);
        this.currentGallery = response.data.gallery;
        this.currentPhotos = response.data.photos;
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch digital gallery ${idOrYearMonth}:`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async createGallery(payload) {
      try {
        const response = await api.post('/digital/galleries', payload);
        await this.fetchGalleries();
        return response.data; // { id, year_month, display_name }
      } catch (error) {
        if (error.response && error.response.status === 409) {
          // Silent conflict handling: return details for UI redirection
          return {
            conflict: true,
            galleryId: error.response.data.galleryId
          };
        }
        console.error('Failed to create monthly gallery:', error);
        throw error;
      }
    },
    async uploadPhotos(galleryId, formData) {
      try {
        const response = await api.post(`/digital/galleries/${galleryId}/photos`, formData);
        await this.fetchGalleryDetail(galleryId);
        return response.data;
      } catch (error) {
        console.error(`Failed to upload photos to digital gallery ${galleryId}:`, error);
        throw error;
      }
    },
    async getGooglePhotosOAuthUrl() {
      try {
        const response = await api.get('/digital/google-photos/oauth-url');
        return response.data; // { url, sessionId }
      } catch (error) {
        console.error('Failed to get Google Photos OAuth URL:', error);
        throw error;
      }
    },
    async pollGooglePhotosSession(sessionId) {
      const response = await api.get(`/digital/google-photos/poll/${sessionId}`);
      return response.data; // { status: 'pending' | 'done' | 'error', items?, error? }
    },
    async importGooglePhotos(galleryId, googlePhotosItems, importSessionId) {
      try {
        const response = await api.post(`/digital/galleries/${galleryId}/photos`, {
          source: 'google_photos',
          googlePhotos: googlePhotosItems,
          importSessionId
        });
        await this.fetchGalleryDetail(galleryId);
        return response.data;
      } catch (error) {
        console.error(`Failed to import Google Photos for gallery ${galleryId}:`, error);
        throw error;
      }
    },
    async deletePhoto(photoId, idOrYearMonth) {
      try {
        await api.delete(`/digital/photos/${photoId}`);
        if (idOrYearMonth) {
          await this.fetchGalleryDetail(idOrYearMonth);
        }
      } catch (error) {
        console.error(`Failed to delete digital photo ${photoId}:`, error);
        throw error;
      }
    },
    // Deletes several photos, then refreshes the gallery once. Returns { total, failed }
    // so the caller can report partial failures instead of throwing on the first error.
    async deletePhotosBulk(photoIds, idOrYearMonth) {
      const results = await Promise.allSettled(
        photoIds.map(id => api.delete(`/digital/photos/${id}`))
      );
      if (idOrYearMonth) {
        await this.fetchGalleryDetail(idOrYearMonth);
      }
      const failed = results.filter(r => r.status === 'rejected').length;
      return { total: photoIds.length, failed };
    }
  }
});
