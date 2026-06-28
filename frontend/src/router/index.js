import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

import OAuthGooglePhotosCallback from '@/views/OAuthGooglePhotosCallback.vue';
import Home from '@/views/Home.vue';
import PhotoDetail from '@/views/PhotoDetail.vue';
import About from '@/views/About.vue';
import Login from '@/views/Login.vue';
import Waiting from '@/views/Waiting.vue';

// Analog Views
import AnalogGalleryList from '@/views/analog/GalleryList.vue';
import AnalogGalleryDetail from '@/views/analog/GalleryDetail.vue';

// Digital Views
import DigitalMonthlyTimeline from '@/views/digital/MonthlyTimeline.vue';
import DigitalMonthlyGallery from '@/views/digital/MonthlyGallery.vue';

// Admin Views
import AdminLayout from '@/views/admin/AdminLayout.vue';
import AdminFeedManager from '@/views/admin/FeedManager.vue';
import AdminAnalogManager from '@/views/admin/AnalogManager.vue';
import AdminAnalogGallery from '@/views/admin/AnalogGallery.vue';
import AdminDigitalManager from '@/views/admin/DigitalManager.vue';
import AdminTagManager from '@/views/admin/TagManager.vue';
import AdminUserManager from '@/views/admin/UserManager.vue';

const routes = [
  // OAuth callback for Google Photos popup — no auth guard, loads and closes immediately
  { path: '/oauth/google-photos', name: 'OAuthGooglePhotosCallback', component: OAuthGooglePhotosCallback },

  { path: '/', name: 'Home', component: Home },
  { path: '/photo/:id', name: 'PhotoDetail', component: PhotoDetail },
  { path: '/about', name: 'About', component: About },
  { path: '/login', name: 'Login', component: Login },
  { path: '/waiting', name: 'Waiting', component: Waiting },

  // Analog routes (Guarded)
  {
    path: '/analog',
    name: 'AnalogGalleryList',
    component: AnalogGalleryList,
    meta: { requiresApproved: true }
  },
  {
    path: '/analog/:id',
    name: 'AnalogGalleryDetail',
    component: AnalogGalleryDetail,
    meta: { requiresApproved: true }
  },
  {
    path: '/analog/:id/photo/:photoId',
    name: 'AnalogPhotoDetail',
    component: AnalogGalleryDetail,
    meta: { requiresApproved: true }
  },
  {
    path: '/analog/:id/upload',
    name: 'AnalogPhotoUpload',
    component: () => import('@/views/analog/PhotoUpload.vue'),
    meta: { requiresAdmin: true }
  },

  // Digital routes (Guarded)
  {
    path: '/digital',
    name: 'DigitalMonthlyTimeline',
    component: DigitalMonthlyTimeline,
    meta: { requiresApproved: true }
  },
  {
    path: '/digital/:yearMonth',
    name: 'DigitalMonthlyGallery',
    component: DigitalMonthlyGallery,
    meta: { requiresApproved: true }
  },

  // Admin routes (Guarded)
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: { name: 'AdminFeedManager' } },
      { path: 'feed', name: 'AdminFeedManager', component: AdminFeedManager },
      { path: 'analog', name: 'AdminAnalogManager', component: AdminAnalogManager },
      { path: 'analog/:galleryId', name: 'AdminAnalogGallery', component: AdminAnalogGallery },
      { path: 'digital', name: 'AdminDigitalManager', component: AdminDigitalManager },
      { path: 'tags', name: 'AdminTagManager', component: AdminTagManager },
      { path: 'users', name: 'AdminUserManager', component: AdminUserManager },
    ]
  },

  // Fallback redirect
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation Guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Validate the current token locally/remotely on navigation
  const isValid = await authStore.checkTokenValidity();

  const isAuth = authStore.isAuthenticated && isValid;
  const isPending = authStore.isPending;
  const isAdmin = authStore.isAdmin;
  const isApproved = authStore.isApproved;

  // 1. Guard for /waiting room: only accessible to pending status users
  if (to.name === 'Waiting') {
    if (!isAuth) {
      return next({ name: 'Login' });
    }
    if (isApproved || isAdmin) {
      return next({ name: 'Home' }); // approved users redirect home
    }
    return next();
  }

  // 2. Guard for admin pages
  if (to.matched.some(record => record.meta.requiresAdmin)) {
    if (!isAuth) {
      return next({ name: 'Login' });
    }
    if (!isAdmin) {
      return next({ name: 'Home' }); // bounce back to feed if not admin
    }
    return next();
  }

  // 3. Guard for private sections (analog / digital)
  if (to.matched.some(record => record.meta.requiresApproved)) {
    if (!isAuth) {
      return next({ name: 'Login', query: { redirect: to.fullPath } });
    }
    if (isPending) {
      return next({ name: 'Waiting' }); // send to waiting page
    }
    return next();
  }

  // 4. Guest access routes (home, detail, login, about)
  if (to.name === 'Login' && isAuth) {
    if (isPending) return next({ name: 'Waiting' });
    return next({ name: 'Home' }); // already authenticated
  }

  next();
});

export default router;
