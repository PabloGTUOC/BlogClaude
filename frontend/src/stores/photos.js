import { defineStore } from 'pinia';
import api from '@/services/api';

export const usePhotosStore = defineStore('photos', {
  state: () => ({
    photos: [],
    currentPhoto: null,
    pagination: {
      page: 1,
      limit: 12,
      total: 0,
      pages: 0
    },
    loading: false
  }),
  actions: {
    async fetchPhotos(page = 1, limit = 12, append = false) {
      this.loading = true;
      try {
        const response = await api.get('/photos', { params: { page, limit } });
        if (append) {
          this.photos = [...this.photos, ...response.data.photos];
        } else {
          this.photos = response.data.photos;
        }
        this.pagination = response.data.pagination;
      } catch (error) {
        console.error('Failed to fetch public photos:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async fetchPhotoDetail(id) {
      this.loading = true;
      try {
        const response = await api.get(`/photos/${id}`);
        this.currentPhoto = response.data;
        return this.currentPhoto;
      } catch (error) {
        console.error(`Failed to fetch photo detail for ID ${id}:`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});
