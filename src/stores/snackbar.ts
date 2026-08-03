import { defineStore } from 'pinia'
import { ref } from 'vue'

type AlertType = 'success' | 'error' | 'warning' | 'info'

export const useSnackbarStore = defineStore('snackbar', () => {
  const visible = ref(false)
  const message = ref('')
  const type    = ref<AlertType>('success')

  function show(newType: AlertType, newMessage: string) {
    type.value    = newType
    message.value = newMessage
    visible.value = true
  }

  return { visible, message, type, show }
})
