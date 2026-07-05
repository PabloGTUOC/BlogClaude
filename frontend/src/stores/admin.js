import { defineStore } from 'pinia';
import api from '@/services/api';

export const useAdminStore = defineStore('admin', {
  state: () => ({
    usersPending: [],
    usersApproved: [],
    usersRevoked: [],
    tags: [],
    feedPhotos: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 0
    },
    loading: false
  }),
  getters: {
    pendingCount: (state) => state.usersPending.length
  },
  actions: {
    // ---- Users management ----
    async fetchUsers(status) {
      this.loading = true;
      try {
        const response = await api.get('/admin/users', { params: { status } });
        if (status === 'pending') this.usersPending = response.data;
        else if (status === 'approved') this.usersApproved = response.data;
        else if (status === 'revoked') this.usersRevoked = response.data;
      } catch (error) {
        console.error(`Failed to fetch users list (${status}):`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async approveUser(userId) {
      try {
        await api.put(`/admin/users/${userId}/approve`);
        await this.fetchUsers('pending');
        await this.fetchUsers('approved');
      } catch (error) {
        console.error(`Failed to approve user ${userId}:`, error);
        throw error;
      }
    },
    async revokeUser(userId, currentStatus = 'approved') {
      try {
        await api.put(`/admin/users/${userId}/revoke`);
        await this.fetchUsers(currentStatus);
        await this.fetchUsers('revoked');
      } catch (error) {
        console.error(`Failed to revoke user ${userId}:`, error);
        throw error;
      }
    },
    async restoreUser(userId) {
      try {
        await api.put(`/admin/users/${userId}/restore`);
        await this.fetchUsers('revoked');
        await this.fetchUsers('approved');
      } catch (error) {
        console.error(`Failed to restore user ${userId}:`, error);
        throw error;
      }
    },
    async updateUserRole(userId, role, group) {
      try {
        await api.put(`/admin/users/${userId}/role`, { role, group: group || null });
        await this.fetchUsers('approved');
        await this.fetchUsers('pending');
      } catch (error) {
        console.error(`Failed to update role for user ${userId}:`, error);
        throw error;
      }
    },

    // ---- Tags management ----
    async fetchTags() {
      this.loading = true;
      try {
        const response = await api.get('/admin/tags');
        this.tags = response.data;
      } catch (error) {
        console.error('Failed to fetch tags:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async createTag(payload) {
      try {
        const response = await api.post('/admin/tags', payload);
        await this.fetchTags();
        return response.data;
      } catch (error) {
        console.error('Failed to create tag:', error);
        throw error;
      }
    },
    async updateTag(tagId, payload) {
      try {
        await api.put(`/admin/tags/${tagId}`, payload);
        await this.fetchTags();
      } catch (error) {
        console.error(`Failed to update tag ${tagId}:`, error);
        throw error;
      }
    },
    async deleteTag(tagId) {
      try {
        await api.delete(`/admin/tags/${tagId}`);
        await this.fetchTags();
      } catch (error) {
        console.error(`Failed to delete tag ${tagId}:`, error);
        throw error;
      }
    },

    // ---- Feed curation & ordering ----
    async fetchFeedPhotos(page = 1, limit = 20, isPublicFilter = undefined) {
      this.loading = true;
      try {
        const params = { page, limit };
        if (isPublicFilter !== undefined) {
          params.is_public = isPublicFilter;
        }
        const response = await api.get('/admin/feed', { params });
        this.feedPhotos = response.data.photos;
        this.pagination = response.data.pagination;
      } catch (error) {
        console.error('Failed to fetch admin curation queue:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async updatePhotoCuration(photoId, payload) {
      try {
        await api.put(`/admin/feed/${photoId}`, payload);
      } catch (error) {
        console.error(`Failed to update curation for photo ${photoId}:`, error);
        throw error;
      }
    },
    async uploadFeedPhotos(formData) {
      try {
        const response = await api.post('/admin/feed/upload', formData);
        return response.data;
      } catch (error) {
        console.error('Failed to upload photos to feed:', error);
        throw error;
      }
    },
    async hardDeletePhoto(photoId) {
      try {
        await api.delete(`/admin/feed/${photoId}`);
      } catch (error) {
        console.error(`Failed to hard delete photo ${photoId}:`, error);
        throw error;
      }
    },
    async bulkReorder(updates) {
      try {
        await api.put('/admin/feed/reorder/bulk', { updates });
      } catch (error) {
        console.error('Failed to execute bulk photo reorder:', error);
        throw error;
      }
    }
  }
});
