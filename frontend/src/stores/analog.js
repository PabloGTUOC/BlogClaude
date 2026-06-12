import { defineStore } from 'pinia';
import api from '@/services/api';

export const useAnalogStore = defineStore('analog', {
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
        const response = await api.get('/analog/galleries');
        this.galleries = response.data;
      } catch (error) {
        console.error('Failed to fetch analog galleries:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async fetchGalleryDetail(id) {
      this.loading = true;
      try {
        const response = await api.get(`/analog/galleries/${id}`);
        this.currentGallery = response.data.gallery;
        this.currentPhotos = response.data.photos;
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch analog gallery ${id}:`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async createGallery(payload) {
      try {
        const response = await api.post('/analog/galleries', payload);
        await this.fetchGalleries();
        return response.data;
      } catch (error) {
        console.error('Failed to create analog gallery:', error);
        throw error;
      }
    },
    async updateGallery(id, payload) {
      try {
        await api.put(`/analog/galleries/${id}`, payload);
        await this.fetchGalleries();
      } catch (error) {
        console.error(`Failed to update analog gallery ${id}:`, error);
        throw error;
      }
    },
    async deleteGallery(id) {
      try {
        await api.delete(`/analog/galleries/${id}`);
        await this.fetchGalleries();
      } catch (error) {
        console.error(`Failed to delete analog gallery ${id}:`, error);
        throw error;
      }
    },
    async uploadPhotos(galleryId, formData) {
      try {
        const response = await api.post(`/analog/galleries/${galleryId}/photos`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        await this.fetchGalleryDetail(galleryId);
        return response.data;
      } catch (error) {
        console.error(`Failed to upload photos to gallery ${galleryId}:`, error);
        throw error;
      }
    },
    async deletePhoto(photoId, galleryId) {
      try {
        await api.delete(`/analog/photos/${photoId}`);
        if (galleryId) {
          await this.fetchGalleryDetail(galleryId);
        }
      } catch (error) {
        console.error(`Failed to delete analog photo ${photoId}:`, error);
        throw error;
      }
    },
    async publishPhoto(photoId, payload, galleryId) {
      try {
        await api.post(`/analog/photos/${photoId}/publish`, payload);
        if (galleryId) {
          await this.fetchGalleryDetail(galleryId);
        }
      } catch (error) {
        console.error(`Failed to publish photo ${photoId}:`, error);
        throw error;
      }
    },
    async unpublishPhoto(photoId, galleryId) {
      try {
        await api.put(`/analog/photos/${photoId}/unpublish`);
        if (galleryId) {
          await this.fetchGalleryDetail(galleryId);
        }
      } catch (error) {
        console.error(`Failed to unpublish photo ${photoId}:`, error);
        throw error;
      }
    },
    async reorderPhotos(galleryId, updates) {
      try {
        await api.put(`/analog/galleries/${galleryId}/photos/reorder`, { updates });
      } catch (error) {
        console.error(`Failed to reorder photos in gallery ${galleryId}:`, error);
        throw error;
      }
    },
    async saveGalleryDetail(id, payload) {
      try {
        await api.put(`/analog/galleries/${id}`, payload);
        await this.fetchGalleryDetail(id);
      } catch (error) {
        console.error(`Failed to save gallery detail ${id}:`, error);
        throw error;
      }
    },
    async toggleGalleryPublished(id) {
      try {
        const numId = parseInt(id, 10);
        const response = await api.put(`/analog/galleries/${numId}/publish`);
        if (this.currentGallery?.id === numId) {
          this.currentGallery = { ...this.currentGallery, is_published: response.data.is_published };
        }
        const idx = this.galleries.findIndex(g => g.id === numId);
        if (idx !== -1) {
          this.galleries[idx] = { ...this.galleries[idx], is_published: response.data.is_published };
        }
        return response.data;
      } catch (error) {
        console.error(`Failed to toggle gallery published state ${id}:`, error);
        throw error;
      }
    },
    async togglePhotoGallery(photoId, galleryId) {
      try {
        const response = await api.put(`/analog/photos/${photoId}/gallery`);
        if (galleryId) {
          await this.fetchGalleryDetail(galleryId);
        }
        return response.data;
      } catch (error) {
        console.error(`Failed to toggle photo gallery state ${photoId}:`, error);
        throw error;
      }
    }
  }
});
