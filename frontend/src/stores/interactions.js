import { defineStore } from 'pinia';
import api from '@/services/api';

export const useInteractionsStore = defineStore('interactions', {
  actions: {
    async toggleLike(photoId) {
      const { data } = await api.post(`/photos/${photoId}/like`);
      return data; // { liked, like_count }
    },
    async fetchComments(photoId) {
      const { data } = await api.get(`/photos/${photoId}/comments`);
      return data.comments;
    },
    async addComment(photoId, body) {
      const { data } = await api.post(`/photos/${photoId}/comments`, { body });
      return data; // created comment
    },
    async deleteComment(photoId, commentId) {
      await api.delete(`/photos/${photoId}/comments/${commentId}`);
    }
  }
});
