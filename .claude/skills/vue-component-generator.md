---
name: vue-component-generator
description: Generates Vue 3 components using Composition API, TypeScript, proper props definition, and best practices. Use when creating Vue components or building Vue UI.
---

# Vue.js Component Generator Skill

Expert at creating modern Vue 3 components with Composition API and TypeScript.

## When to Activate

- "create a Vue component"
- "generate Vue 3 component for [feature]"
- "build a [component] in Vue"
- "scaffold Vue UI component"

## Component Structure

### Single File Component (SFC)

```vue
<template>
  <div :class="['container', props.className]">
    <h2 class="title">{{ props.title }}</h2>

    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <div v-else class="content">
      <slot />

      <button
        v-if="props.showAction"
        @click="handleAction"
        class="action-button"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

// Props
interface Props {
  title: string;
  showAction?: boolean;
  className?: string;
  items?: Item[];
}

const props = withDefaults(defineProps<Props>(), {
  showAction: false,
  className: '',
  items: () => [],
});

// Emits
interface Emits {
  (e: 'action-clicked'): void;
  (e: 'update:modelValue', value: string): void;
}

const emit = defineEmits<Emits>();

// State
const isLoading = ref(false);
const internalValue = ref('');

// Computed
const actionLabel = computed(() => {
  return isLoading.value ? 'Processing...' : 'Click Me';
});

// Methods
const handleAction = () => {
  emit('action-clicked');
};

const loadData = async () => {
  isLoading.value = true;
  try {
    // Fetch data
  } finally {
    isLoading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadData();
});

// Watchers
watch(() => props.items, (newItems) => {
  console.log('Items changed:', newItems);
}, { deep: true });

// Expose (optional - for parent template refs)
defineExpose({
  loadData,
});
</script>

<style scoped>
.container {
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: var(--background);
}

.title {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.action-button {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  background-color: var(--primary);
  color: white;
  border: none;
  cursor: pointer;
}

.action-button:hover {
  opacity: 0.9;
}
</style>
```

## Component Patterns

### Simple Presentational Component
```vue
<template>
  <button
    :class="['btn', `btn-${variant}`]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
interface Props {
  label: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
});

defineEmits<{
  (e: 'click'): void;
}>();
</script>
```

### Form Input with v-model
```vue
<template>
  <div class="input-group">
    <label :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :placeholder="placeholder"
    />
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  error: '',
});

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputId = `input-${Math.random().toString(36).slice(2)}`;
</script>
```

### Composable for Data Fetching
```typescript
// composables/useUsers.ts
import { ref } from 'vue';

export interface User {
  id: number;
  name: string;
  email: string;
}

export function useUsers() {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/users');
      users.value = await response.json();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  };

  return {
    users,
    loading,
    error,
    fetchUsers,
  };
}
```

## File Structure

```
ComponentName/
├── ComponentName.vue           # Component SFC
├── ComponentName.spec.ts       # Unit tests
├── composables/
│   └── useComponentLogic.ts   # Composable logic (if complex)
├── types.ts                   # TypeScript types
└── index.ts                   # Export
```

## Testing Pattern

```typescript
// ComponentName.spec.ts
import { mount } from '@vue/test-utils';
import ComponentName from './ComponentName.vue';

describe('ComponentName', () => {
  it('renders with required props', () => {
    const wrapper = mount(ComponentName, {
      props: {
        title: 'Test Title',
      },
    });

    expect(wrapper.text()).toContain('Test Title');
  });

  it('emits event on button click', async () => {
    const wrapper = mount(ComponentName, {
      props: {
        title: 'Test',
        showAction: true,
      },
    });

    await wrapper.find('.action-button').trigger('click');
    expect(wrapper.emitted('action-clicked')).toBeTruthy();
  });
});
```

## Best Practices

- Use Composition API with `<script setup>`
- Define props with TypeScript interfaces
- Use `withDefaults` for default values
- Define emits with TypeScript
- Use computed for derived state
- Keep template logic simple
- Use composables for reusable logic
- Scoped styles by default
- Proper TypeScript typing
- Test component behavior

## Output Checklist

- ✅ Component .vue file created
- ✅ Props properly typed
- ✅ Emits defined
- ✅ Tests created
- ✅ Composables extracted (if needed)
- ✅ Accessibility considered
- 📝 Usage example provided
