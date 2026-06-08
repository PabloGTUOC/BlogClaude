<template>
  <span class="tag" :style="customStyle">
    [ {{ name.toUpperCase() }} ]
  </span>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'TagBadge',
  props: {
    name: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: null
    }
  },
  setup(props) {
    const customStyle = computed(() => {
      if (props.color) {
        return {
          color: props.color,
          borderColor: props.color
        };
      }
      return {};
    });

    return {
      customStyle
    };
  }
};
</script>
