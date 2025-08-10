import { ref } from 'vue'

const user = ref(null)

export function useAuth() {
  return {
    user,
    setUser: (u) => user.value = u,
    clearUser: () => user.value = null
  }
}