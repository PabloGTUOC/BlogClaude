import { defineStore } from 'pinia';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    role: (state) => state.user?.role || 'public',
    status: (state) => state.user?.status || 'public',
    isAdmin: (state) => state.user?.role === 'admin',
    isApproved: (state) => state.user?.status === 'approved',
    isPending: (state) => state.user?.status === 'pending',
  },
  actions: {
    async loginWithFirebaseToken(firebaseToken) {
      try {
        const response = await api.post('/auth/firebase', { firebaseToken });
        const { token, user } = response.data;

        this.token = token;
        this.user = user;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        return user;
      } catch (error) {
        this.logout();
        throw error;
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    async checkTokenValidity() {
      if (!this.token) return false;

      // Check JWT local expiration first
      try {
        const payloadBase64 = this.token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        const exp = payload.exp * 1000;
        if (Date.now() >= exp) {
          console.warn('JWT session has expired.');
          this.logout();
          return false;
        }
      } catch (e) {
        this.logout();
        return false;
      }

      // Query server to verify the token is not revoked
      try {
        // Hitting health route to test simple responsiveness, or query galleries if approved
        if (this.isApproved || this.isAdmin) {
          await api.get('/analog/galleries');
        }
        return true;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.warn('JWT rejected by API server.');
          this.logout();
          return false;
        }
        // If it's a network error, assume token is still valid
        return true;
      }
    }
  }
});
