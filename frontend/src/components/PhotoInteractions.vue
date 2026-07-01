<template>
  <div class="pint border-t border-gridColor/50 pt-3 mt-3 space-y-3">
    <!-- Like + comment count row -->
    <div class="flex items-center gap-4 font-label text-xs select-none">
      <button
        class="flex items-center gap-1.5 transition-colors duration-150"
        :class="liked ? 'text-neon-red' : 'text-fog hover:text-phosphor'"
        :disabled="!canInteract || likePending"
        @click="onToggleLike"
      >
        <span>{{ liked ? '♥' : '♡' }}</span>
        <span>{{ likeCount }} {{ likeCount === 1 ? 'LIKE' : 'LIKES' }}</span>
      </button>
      <span class="text-dust">//</span>
      <span class="text-fog">{{ comments.length }} {{ comments.length === 1 ? 'COMMENT' : 'COMMENTS' }}</span>
    </div>

    <!-- Comment list -->
    <ul v-if="comments.length" class="space-y-2">
      <li v-for="c in comments" :key="c.id" class="text-xs font-body group">
        <span class="text-amber uppercase font-label">{{ c.author_name || 'UNKNOWN' }}</span>
        <span class="text-dust mx-1">·</span>
        <span class="text-chrome">{{ c.body }}</span>
        <button
          v-if="canDelete(c)"
          class="ml-2 text-dust hover:text-neon-red opacity-0 group-hover:opacity-100 transition-opacity"
          @click="onDelete(c)"
        >[x]</button>
      </li>
    </ul>
    <p v-else class="text-xs font-body text-dust">// NO COMMENTS YET //</p>

    <!-- Add comment -->
    <form v-if="canInteract" class="flex gap-2" @submit.prevent="onSubmit">
      <input
        v-model="draft"
        type="text"
        maxlength="2000"
        placeholder="LEAVE A COMMENT..."
        class="flex-1 bg-surface border border-gridColor px-2 py-1 text-xs font-body text-chrome focus:outline-none focus:border-phosphor"
      />
      <button
        type="submit"
        class="btn btn--ghost btn--sm"
        :disabled="!draft.trim() || submitPending"
      >[ SEND ]</button>
    </form>
    <p v-else class="text-xs font-body text-dust">// LOG IN TO JOIN THE CONVERSATION //</p>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useInteractionsStore } from '@/stores/interactions';
import { useAuthStore } from '@/stores/auth';

export default {
  name: 'PhotoInteractions',
  props: {
    photo: { type: Object, required: true }
  },
  setup(props) {
    const store = useInteractionsStore();
    const auth = useAuthStore();

    const liked = ref(!!props.photo.liked_by_me);
    const likeCount = ref(Number(props.photo.like_count) || 0);
    const comments = ref([]);
    const draft = ref('');
    const likePending = ref(false);
    const submitPending = ref(false);

    const canInteract = computed(() => auth.isApproved || auth.isAdmin);
    const canDelete = (c) => auth.isAdmin || (auth.userId && c.user_id === auth.userId);

    const load = async () => {
      liked.value = !!props.photo.liked_by_me;
      likeCount.value = Number(props.photo.like_count) || 0;
      try { comments.value = await store.fetchComments(props.photo.id); }
      catch (e) { comments.value = []; }
    };

    onMounted(load);
    watch(() => props.photo.id, load);

    const onToggleLike = async () => {
      if (!canInteract.value || likePending.value) return;
      likePending.value = true;
      try {
        const res = await store.toggleLike(props.photo.id);
        liked.value = res.liked;
        likeCount.value = res.like_count;
        // Persist onto the shared photo object so cached lists (e.g. the
        // lightbox's photos array) stay in sync when this component remounts.
        props.photo.liked_by_me = res.liked;
        props.photo.like_count = res.like_count;
      } finally { likePending.value = false; }
    };

    const onSubmit = async () => {
      const body = draft.value.trim();
      if (!body || submitPending.value) return;
      submitPending.value = true;
      try {
        const created = await store.addComment(props.photo.id, body);
        comments.value.push(created);
        props.photo.comment_count = comments.value.length;
        draft.value = '';
      } finally { submitPending.value = false; }
    };

    const onDelete = async (c) => {
      await store.deleteComment(props.photo.id, c.id);
      comments.value = comments.value.filter(x => x.id !== c.id);
      props.photo.comment_count = comments.value.length;
    };

    return { liked, likeCount, comments, draft, likePending, submitPending,
             canInteract, canDelete, onToggleLike, onSubmit, onDelete };
  }
};
</script>
