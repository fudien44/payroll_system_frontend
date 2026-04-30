<script setup lang="ts">
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/dist/vue3-perfect-scrollbar.css'

const isNotificationDialogVisible = ref(false)

const notificationsArray = ref([
  {
    id: 1,
    type: 'email',
    message: 'You have a new email from John Doe.',
    timestamp: ' 24 minutes ago',
    isRead: false,
    icon: 'mdi-email-outline',
    color: 'primary',
  },
  {
    id: 2,
    type: 'reminder',
    message: 'Don\'t forget to attend the meeting at 10 AM.',
    timestamp: '2 days ago',
    isRead: false,
    icon: 'mdi-clock-outline',
    color: 'info',
  },
  {
    id: 3,
    type: 'notification',
    message: 'You have a new follower on social media.',
    timestamp: '2024-02-25T11:20:00',
    isRead: true,
    icon: 'mdi-bell-ring-outline',
    color: 'blue',
  },
  {
    id: 4,
    type: 'alert',
    message: 'Emergency: Server is down!',
    timestamp: '2024-02-25T12:15:00',
    isRead: false,
    icon: 'mdi-alert-circle-outline',
    color: 'error',
  },
  {
    id: 5,
    type: 'announcement',
    message: 'Important announcement: New company policy in effect.',
    timestamp: '2024-02-25T13:30:00',
    isRead: true,
    icon: 'mdi-bullhorn-outline',
    color: 'warning',
  },
  {
    id: 6,
    type: 'chat',
    message: 'New message from support: Your issue has been resolved.',
    timestamp: '2024-02-25T15:00:00',
    isRead: false,
    icon: 'mdi-chat-outline',
    color: 'purple',
  },
  {
    id: 7,
    type: 'payment',
    message: 'Payment received from client XYZ.',
    timestamp: '2024-02-25T16:45:00',
    isRead: true,
    icon: 'mdi-currency-usd',
    color: 'success',
  },
])

const markNotificationStatus = (id: number, isRead: boolean) => {
  const notification = notificationsArray.value.find(n => n.id === id)
  if (notification)
    notification.isRead = !isRead
}

const markAllNotificationsAsRead = () => {
  notificationsArray.value.forEach(notification => {
    notification.isRead = true
  })
}

const hideNotification = (id: number) => {
  const index = notificationsArray.value.findIndex(n => n.id === id)
  if (index !== -1)
    notificationsArray.value.splice(index, 1)
}
</script>

<template>
  <!-- Notification -->
  <VBadge
    dot
    color="error"
    location="top"
    :offset-y="12"
  >
    <VBtn
      icon
      class="me-3"
      @click="isNotificationDialogVisible = !isNotificationDialogVisible"
    >
      <VIcon icon="mdi-bell-outline" />
    </VBtn>
  </VBadge>

  <VDialog
    v-model="isNotificationDialogVisible"
    max-width="600"
    max-height="500"
  >
    <VCard class="notifications-wrapper">
      <VCardItem class="pb-5">
        <VCardTitle>Notifications</VCardTitle>
        <template #append>
          <VBtn
            icon
            size="small"
            variant="text"
            color="success"
            @click="markAllNotificationsAsRead"
          >
            <VIcon icon="mdi-check-all" />
            <VTooltip activator="parent">
              Mark all as read
            </VTooltip>
          </VBtn>
          <VBtn
            icon
            size="small"
            variant="text"
            @click="isNotificationDialogVisible = false"
          >
            <VIcon icon="mdi-close" />
          </VBtn>
        </template>
      </VCardItem>

      <VDivider />

      <PerfectScrollbar
        :options="{ wheelPropagation: false, suppressScrollX: true }"
        class="h-100"
      >
        <VList
          lines="two"
          class="pt-0"
        >
          <VListItem
            v-for="notification in notificationsArray"
            :key="notification.id"
            :class="notification.isRead ? 'unread' : 'read'"
            class="py-3"
          >
            <template #prepend>
              <VAvatar
                :color="notification.color"
                variant="tonal"
                size="small"
              >
                <VIcon
                  size="18"
                  :icon="notification.icon"
                />
              </VAvatar>
            </template>

            <VListItemTitle>
              <strong class="text-capitalize me-1">{{ notification.type }} :</strong>
              <span class="text-sm">{{ notification.message }}</span>
            </VListItemTitle>
            <VListItemSubtitle class="text-caption">
              {{ notification.timestamp }}
            </VListItemSubtitle>

            <template #append>
              <VBtn
                icon
                variant="text"
                size="x-small"
                class="read-unread-toggler"
                @click="markNotificationStatus(notification.id, notification.isRead)"
              >
                <VIcon :icon="notification.isRead ? 'mdi-email-outline' : 'mdi-email-open-outline'" />
                <VTooltip activator="parent">
                  {{ notification.isRead ? 'Mark as Unread' : 'Mark as read' }}
                </VTooltip>
              </VBtn>

              <VBtn
                icon
                variant="text"
                size="x-small"
                class="clear-notification"
                @click="hideNotification(notification.id)"
              >
                <VIcon icon="mdi-close" />
                <VTooltip activator="parent">
                  Hide notification
                </VTooltip>
              </VBtn>
            </template>
          </VListItem>
        </VList>
      </PerfectScrollbar>
      <VCardText
        v-show="!notificationsArray.length"
        class="text-center"
      >
        No Notification Found!
      </VCardText>

      <VCardActions>
        <VBtn
          block
          variant="elevated"
          color="primary"
        >
          View All
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style lang="scss">
@use "@styles/mixin/mixin";

.notifications-wrapper {
  .unread {
    background-color: rgba(var(--v-theme-on-surface), var(--v-idle-opacity));
  }

  .v-list-item {
    transition: all 0.2s ease-in-out;
    will-change: transform, box-shadow;

    .read-unread-toggler,
    .clear-notification {
      opacity: 0;
      visibility: hidden;
    }

    &:hover {
      transform: translateY(-2px);

      @include mixin.elevation(3);

      .read-unread-toggler,
      .clear-notification {
        opacity: 1;
        visibility: visible;
      }
    }
  }
}
</style>
