<template>
  <div class="calendar-mgmt">

    <!-- ── Page Header ───────────────────────────────────────────────────── -->
    <div class="cm-page-header">
      <div>
        <h1 class="cm-page-title">
          <VIcon icon="mdi-calendar-month" class="cm-title-icon" />
          Calendar Management
        </h1>
        <p class="cm-page-subtitle">Manage public holidays and work suspension days</p>
      </div>

      <div class="cm-header-actions">
        <VBtn
          variant="outlined"
          prepend-icon="mdi-calendar-star"
          @click="openHolidayDialog()"
        >
          Add Holiday
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="mdi-calendar-remove"
          @click="openSuspensionDialog()"
        >
          Add Suspension
        </VBtn>
      </div>
    </div>

    <!-- ── Global Error ──────────────────────────────────────────────────── -->
    <VAlert v-if="error" type="error" variant="tonal" class="mb-4" closable>
      {{ error }}
    </VAlert>

    <!-- ── Main Layout ───────────────────────────────────────────────────── -->
    <div class="cm-layout">

      <!-- ── Left: Calendar ─────────────────────────────────────────────── -->
      <div class="cm-calendar-panel">

        <!-- Month Nav -->
        <div class="cm-month-nav">
          <VBtn icon="mdi-chevron-left" variant="text" :disabled="loading" @click="prevMonth" />
          <h2 class="cm-month-label">{{ monthLabel }}</h2>
          <VBtn icon="mdi-chevron-right" variant="text" :disabled="loading" @click="nextMonth" />
        </div>

        <!-- Legend -->
        <div class="cm-legend">
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--rh" />
            Regular Holiday
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--sh" />
            Special Holiday
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--susp" />
            Suspension
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--today" />
            Today
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--weekend" />
            Weekend
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-dot cm-legend-dot--fri-cmp" />
            Fri (Compressed)
          </span>
          <span class="cm-legend-item cm-legend-item--divider" />
          <span class="cm-legend-item">
            <span class="cm-legend-pill cm-legend-pill--std">STD</span>
            Mon–Fri 8am–5pm
          </span>
          <span class="cm-legend-item">
            <span class="cm-legend-pill cm-legend-pill--cmp">CMP</span>
            Mon–Thu 7am–6pm
          </span>
          <span class="cm-legend-item cm-legend-item--divider" />
          <span class="cm-legend-item">
            <span class="cm-legend-half-badge">½</span>
            Half-day
          </span>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="cm-loading">
          <VProgressLinear indeterminate color="primary" class="mb-3" />
        </div>

        <template v-else>
          <!-- Day Headers -->
          <div class="cm-day-headers">
            <span class="cm-week-gutter-header" />
            <span v-for="name in DAY_NAMES" :key="name" class="cm-day-name">{{ name }}</span>
          </div>

          <!-- Grid rows -->
          <div class="cm-weeks">
            <div
              v-for="(week, wIdx) in calendarWeeks"
              :key="wIdx"
              class="cm-week-row"
            >
              <div
                v-if="week.hasMonday"
                class="cm-week-label"
                :class="[
                  week.isCompressed ? 'cm-week-label--cmp' : 'cm-week-label--std',
                  scheduleOverrideLoading === week.weekStart ? 'cm-week-label--saving' : '',
                  weekScheduleMap[week.weekStart]?.is_manual_override ? 'cm-week-label--override' : '',
                ]"
                :title="(week.isCompressed ? 'Compressed: Mon–Thu, 7am–6pm' : 'Standard: Mon–Fri, 8am–5pm')
                  + '\nClick to toggle. Right-click to reset to auto.'
                  + (weekScheduleMap[week.weekStart]?.is_manual_override ? '\n⚠ Manual override active' : '')"
                @click="week.weekStart && toggleWeekSchedule(week.weekStart, week.isCompressed)"
                @contextmenu.prevent="week.weekStart && weekScheduleMap[week.weekStart]?.is_manual_override && clearWeekOverride(week.weekStart)"
              >
                <span v-if="scheduleOverrideLoading === week.weekStart" class="cm-week-saving">…</span>
                <template v-else>
                  {{ week.isCompressed ? 'CMP' : 'STD' }}
                  <span
                    v-if="weekScheduleMap[week.weekStart]?.is_manual_override"
                    class="cm-week-override-dot"
                    title="Manual override active"
                  />
                </template>
              </div>
              <div v-else class="cm-week-label-empty" />

              <!-- 7 cells -->
              <div
                v-for="(cell, cIdx) in week.cells"
                :key="cIdx"
                class="cm-cell"
                :class="cellClasses(cell, week.isCompressed)"
                @click="cell.date && !cell.isWeekend && onCellClick(cell)"
              >
                <template v-if="cell.date">
                  <span class="cm-cell-num">{{ cell.date.getDate() }}</span>
                  <div class="cm-cell-badges">
                    <VChip
                      v-if="cell.info.holiday"
                      size="x-small"
                      :color="cell.info.holiday.type === 'regular' ? 'error' : 'warning'"
                      class="cm-badge"
                    >
                      {{ cell.info.holiday.type === 'regular' ? 'RH' : 'SH' }}
                    </VChip>
                    <VChip
                      v-if="cell.info.suspension"
                      size="x-small"
                      color="success"
                      class="cm-badge"
                    >
                      SUSP
                    </VChip>
                    <!-- Half-day badge: shown for special holidays and suspensions -->
                    <VChip
                      v-if="isHalfDay(cell)"
                      size="x-small"
                      color="purple"
                      variant="tonal"
                      class="cm-badge cm-badge--half"
                    >
                      ½
                    </VChip>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Right: Sidebar ─────────────────────────────────────────────── -->
      <div class="cm-sidebar">

        <!-- Summary -->
        <div class="cm-card">
          <h3 class="cm-card-title">{{ monthLabel }} Summary</h3>
          <div class="cm-stats-grid">
            <div class="cm-stat cm-stat--rh">
              <div class="cm-stat-inner">
                <VAvatar color="error" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-star" size="16" />
                </VAvatar>
                <div>
                  <span class="cm-stat-value">{{ summary.regularHolidays.length }}</span>
                  <span class="cm-stat-label">Regular Holidays</span>
                </div>
              </div>
            </div>
            <div class="cm-stat cm-stat--working">
              <div class="cm-stat-inner">
                <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-briefcase-outline" size="16" />
                </VAvatar>
                <div>
                  <!-- Working days shown as decimal when half-days exist -->
                  <span class="cm-stat-value">{{ summary.totalWorkingDays }}</span>
                  <span class="cm-stat-label">Working Days</span>
                </div>
              </div>
            </div>
            <div class="cm-stat cm-stat--susp">
              <div class="cm-stat-inner">
                <VAvatar color="success" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-remove" size="16" />
                </VAvatar>
                <div>
                  <span class="cm-stat-value">{{ summary.suspensions.length }}</span>
                  <span class="cm-stat-label">Suspensions</span>
                </div>
              </div>
            </div>
            <div class="cm-stat cm-stat--sh">
              <div class="cm-stat-inner">
                <VAvatar color="warning" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-alert" size="16" />
                </VAvatar>
                <div>
                  <span class="cm-stat-value">{{ summary.specialHolidays.length }}</span>
                  <span class="cm-stat-label">Special Non-Working</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Holidays -->
        <div class="cm-card">
          <div class="cm-card-header">
            <h3 class="cm-card-title">Holidays</h3>
            <VBtn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="openHolidayDialog()">
              Add
            </VBtn>
          </div>

          <div v-if="summary.regularHolidays.length || summary.specialHolidays.length">
            <template v-if="summary.regularHolidays.length">
              <p class="cm-list-section-label">Regular</p>
              <div
                v-for="h in summary.regularHolidays"
                :key="h.id"
                class="cm-list-item"
              >
                <div class="cm-list-item-info">
                  <VChip size="x-small" color="error" variant="tonal" label>
                    {{ formatDisplayDate(h.date) }}
                  </VChip>
                  <span class="cm-list-item-label">{{ h.label }}</span>
                </div>
                <div class="cm-list-item-actions">
                  <VBtn icon size="x-small" variant="text" color="primary" @click="openHolidayDialog(h)">
                    <VIcon size="15">mdi-pencil-outline</VIcon>
                  </VBtn>
                  <VBtn icon size="x-small" variant="text" color="error" @click="confirmRemoveHoliday(h)">
                    <VIcon size="15">mdi-delete-outline</VIcon>
                  </VBtn>
                </div>
              </div>
            </template>

            <template v-if="summary.specialHolidays.length">
              <p class="cm-list-section-label mt-2">Special Non-Working</p>
              <div
                v-for="h in summary.specialHolidays"
                :key="h.id"
                class="cm-list-item"
              >
                <div class="cm-list-item-info">
                  <VChip size="x-small" color="warning" variant="tonal" label>
                    {{ formatDisplayDate(h.date) }}
                  </VChip>
                  <span class="cm-list-item-label">
                    {{ h.label }}
                    <VChip v-if="h.is_half_day" size="x-small" color="purple" variant="tonal" class="ml-1">½</VChip>
                  </span>
                </div>
                <div class="cm-list-item-actions">
                  <VBtn icon size="x-small" variant="text" color="primary" @click="openHolidayDialog(h)">
                    <VIcon size="15">mdi-pencil-outline</VIcon>
                  </VBtn>
                  <VBtn icon size="x-small" variant="text" color="error" @click="confirmRemoveHoliday(h)">
                    <VIcon size="15">mdi-delete-outline</VIcon>
                  </VBtn>
                </div>
              </div>
            </template>
          </div>

          <p v-else class="cm-empty-text">No holidays this month.</p>
        </div>

        <!-- Suspensions -->
        <div class="cm-card">
          <div class="cm-card-header">
            <h3 class="cm-card-title">Suspension Days</h3>
            <VBtn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="openSuspensionDialog()">
              Add
            </VBtn>
          </div>

          <div v-if="summary.suspensions.length">
            <div
              v-for="s in summary.suspensions"
              :key="s.id"
              class="cm-list-item"
            >
              <div class="cm-list-item-info">
                <VChip size="x-small" color="success" variant="tonal" label>
                  {{ formatDisplayDate(s.date) }}
                </VChip>
                <span class="cm-list-item-label">
                  {{ s.label }}
                  <VChip v-if="s.is_half_day" size="x-small" color="purple" variant="tonal" class="ml-1">½</VChip>
                </span>
              </div>
              <div class="cm-list-item-actions">
                <VBtn icon size="x-small" variant="text" color="primary" @click="openSuspensionDialog(s)">
                  <VIcon size="15">mdi-pencil-outline</VIcon>
                </VBtn>
                <VBtn icon size="x-small" variant="text" color="error" @click="confirmRemoveSuspension(s)">
                  <VIcon size="15">mdi-delete-outline</VIcon>
                </VBtn>
              </div>
            </div>
          </div>

          <p v-else class="cm-empty-text">No suspension days this month.</p>
        </div>

      </div>
    </div>

    <!-- ── Holiday Dialog ────────────────────────────────────────────────── -->
    <VDialog v-model="holidayDialog.visible" max-width="440" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-calendar-star" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">
                {{ holidayDialog.editId ? 'Edit Holiday' : 'Add Holiday' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ holidayDialog.editId ? 'Update holiday details' : 'Add a public holiday to the calendar' }}
              </div>
            </div>
          </div>

          <VAlert
            v-if="holidayDialog.editId && holidayDialog.dateChanged"
            type="warning"
            variant="tonal"
            density="compact"
            icon="mdi-alert-outline"
            class="mb-4"
          >
            You are changing the date of an official holiday. Make sure this is intentional.
          </VAlert>

          <div class="cm-field mb-3">
            <label class="cm-label">Date <span class="cm-required">*</span></label>
            <VTextField
              v-model="holidayDialog.date"
              type="date"
              :min="`${viewYear}-01-01`"
              :max="`${viewYear}-12-31`"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-calendar-outline"
              hide-details="auto"
              @update:model-value="holidayDialog.dateChanged = holidayDialog.date !== holidayDialog.originalDate"
            />
          </div>

          <div class="cm-field mb-3">
            <label class="cm-label">Label / Name <span class="cm-required">*</span></label>
            <VTextField
              v-model="holidayDialog.label"
              placeholder="e.g. Independence Day"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-tag-outline"
              hide-details="auto"
            />
          </div>

          <div class="cm-field mb-3">
            <label class="cm-label">Holiday Type <span class="cm-required">*</span></label>
            <div class="d-flex gap-3 mt-1">
              <VCard
                :variant="holidayDialog.type === 'regular' ? 'tonal' : 'outlined'"
                :color="holidayDialog.type === 'regular' ? 'error' : undefined"
                rounded="lg"
                flat
                style="cursor: pointer; flex: 1;"
                @click="holidayDialog.type = 'regular'; holidayDialog.isHalfDay = false"
              >
                <VCardText class="pa-3">
                  <div class="d-flex align-center gap-2 mb-1">
                    <VIcon icon="mdi-calendar-star" size="16"
                      :color="holidayDialog.type === 'regular' ? 'error' : 'medium-emphasis'" />
                    <span class="text-body-2 font-weight-medium">Regular</span>
                  </div>
                  <p class="text-caption text-medium-emphasis mb-0">
                    National public holiday
                  </p>
                </VCardText>
              </VCard>
              <VCard
                :variant="holidayDialog.type === 'special' ? 'tonal' : 'outlined'"
                :color="holidayDialog.type === 'special' ? 'warning' : undefined"
                rounded="lg"
                flat
                style="cursor: pointer; flex: 1;"
                @click="holidayDialog.type = 'special'"
              >
                <VCardText class="pa-3">
                  <div class="d-flex align-center gap-2 mb-1">
                    <VIcon icon="mdi-calendar-alert" size="16"
                      :color="holidayDialog.type === 'special' ? 'warning' : 'medium-emphasis'" />
                    <span class="text-body-2 font-weight-medium">Special</span>
                  </div>
                  <p class="text-caption text-medium-emphasis mb-0">
                    Special non-working day
                  </p>
                </VCardText>
              </VCard>
            </div>
          </div>

          <!-- Half-day toggle: only for special holidays -->
          <div v-if="holidayDialog.type === 'special'" class="cm-field mb-3">
            <VCard
              :variant="holidayDialog.isHalfDay ? 'tonal' : 'outlined'"
              :color="holidayDialog.isHalfDay ? 'purple' : undefined"
              rounded="lg"
              flat
              style="cursor: pointer;"
              @click="holidayDialog.isHalfDay = !holidayDialog.isHalfDay"
            >
              <VCardText class="pa-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    :color="holidayDialog.isHalfDay ? 'purple' : 'medium-emphasis'"
                    variant="tonal"
                    size="32"
                    rounded="lg"
                  >
                    <span style="font-size: 0.85rem; font-weight: 700;">½</span>
                  </VAvatar>
                  <div class="flex-1">
                    <div class="text-body-2 font-weight-medium">Half-day holiday</div>
                    <div class="text-caption text-medium-emphasis">
                      4 hrs (STD) · 4 hrs 60 min (CMP) — counts as 0.5 working day
                    </div>
                  </div>
                  <VSwitch
                    :model-value="holidayDialog.isHalfDay"
                    color="purple"
                    density="compact"
                    hide-details
                    style="pointer-events: none;"
                  />
                </div>
              </VCardText>
            </VCard>
          </div>

          <VAlert v-if="holidayDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
            {{ holidayDialog.error }}
          </VAlert>
        </VCardText>

        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="holidayDialog.loading" @click="closeHolidayDialog">
            Cancel
          </VBtn>
          <VBtn
            :color="holidayDialog.type === 'special' ? 'warning' : 'error'"
            variant="tonal"
            :loading="holidayDialog.loading"
            :prepend-icon="holidayDialog.editId ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
            @click="submitHoliday"
          >
            {{ holidayDialog.editId ? 'Save Changes' : 'Add Holiday' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Suspension Dialog ─────────────────────────────────────────────── -->
    <VDialog v-model="suspensionDialog.visible" max-width="440" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="success" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-calendar-remove" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">
                {{ suspensionDialog.editId ? 'Edit Suspension Day' : 'Add Suspension Day' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ suspensionDialog.editId ? 'Update suspension details' : 'Mark a day as suspended' }}
              </div>
            </div>
          </div>

          <div class="cm-field mb-3">
            <label class="cm-label">Date <span class="cm-required">*</span></label>
            <VTextField
              v-model="suspensionDialog.date"
              type="date"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-calendar-outline"
              hide-details="auto"
            />
          </div>

          <div class="cm-field mb-3">
            <label class="cm-label">Label / Reason <span class="cm-required">*</span></label>
            <VTextField
              v-model="suspensionDialog.label"
              placeholder="e.g. Typhoon Signal No. 2"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-tag-outline"
              hide-details="auto"
            />
          </div>

          <!-- Half-day toggle for suspensions -->
          <div class="cm-field">
            <VCard
              :variant="suspensionDialog.isHalfDay ? 'tonal' : 'outlined'"
              :color="suspensionDialog.isHalfDay ? 'purple' : undefined"
              rounded="lg"
              flat
              style="cursor: pointer;"
              @click="suspensionDialog.isHalfDay = !suspensionDialog.isHalfDay"
            >
              <VCardText class="pa-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    :color="suspensionDialog.isHalfDay ? 'purple' : 'medium-emphasis'"
                    variant="tonal"
                    size="32"
                    rounded="lg"
                  >
                    <span style="font-size: 0.85rem; font-weight: 700;">½</span>
                  </VAvatar>
                  <div class="flex-1">
                    <div class="text-body-2 font-weight-medium">Half-day suspension</div>
                    <div class="text-caption text-medium-emphasis">
                      4 hrs (STD) · 4 hrs 60 min (CMP) — counts as 0.5 working day
                    </div>
                  </div>
                  <VSwitch
                    :model-value="suspensionDialog.isHalfDay"
                    color="purple"
                    density="compact"
                    hide-details
                    style="pointer-events: none;"
                  />
                </div>
              </VCardText>
            </VCard>
          </div>

          <VAlert v-if="suspensionDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
            {{ suspensionDialog.error }}
          </VAlert>
        </VCardText>

        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="suspensionDialog.loading" @click="closeSuspensionDialog">
            Cancel
          </VBtn>
          <VBtn
            color="success"
            variant="tonal"
            :loading="suspensionDialog.loading"
            :prepend-icon="suspensionDialog.editId ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
            @click="submitSuspension"
          >
            {{ suspensionDialog.editId ? 'Save Changes' : 'Add Suspension' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Event Type Picker Dialog ──────────────────────────────────────── -->
    <VDialog v-model="pickerDialog.visible" max-width="340">
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-calendar-plus" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">What do you want to add?</div>
              <div class="text-caption text-medium-emphasis">
                {{ pickerDialog.prefillDate
                    ? new Date(pickerDialog.prefillDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '' }}
              </div>
            </div>
          </div>

          <div class="d-flex flex-column gap-2">
            <VCard variant="tonal" color="error" rounded="lg" flat style="cursor: pointer;" @click="onPickerSelect('regular')">
              <VCardText class="d-flex align-center gap-3 pa-3">
                <VAvatar color="error" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-star" size="16" />
                </VAvatar>
                <div>
                  <div class="text-body-2 font-weight-medium">Regular Holiday</div>
                  <div class="text-caption text-medium-emphasis">National public holiday</div>
                </div>
                <VSpacer />
                <VIcon icon="mdi-chevron-right" size="18" color="medium-emphasis" />
              </VCardText>
            </VCard>

            <VCard variant="tonal" color="warning" rounded="lg" flat style="cursor: pointer;" @click="onPickerSelect('special')">
              <VCardText class="d-flex align-center gap-3 pa-3">
                <VAvatar color="warning" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-alert" size="16" />
                </VAvatar>
                <div>
                  <div class="text-body-2 font-weight-medium">Special Non-Working Holiday</div>
                  <div class="text-caption text-medium-emphasis">Special non-working day</div>
                </div>
                <VSpacer />
                <VIcon icon="mdi-chevron-right" size="18" color="medium-emphasis" />
              </VCardText>
            </VCard>

            <VCard variant="tonal" color="success" rounded="lg" flat style="cursor: pointer;" @click="onPickerSelect('suspension')">
              <VCardText class="d-flex align-center gap-3 pa-3">
                <VAvatar color="success" variant="tonal" size="32" rounded="lg">
                  <VIcon icon="mdi-calendar-remove" size="16" />
                </VAvatar>
                <div>
                  <div class="text-body-2 font-weight-medium">Suspension Day</div>
                  <div class="text-caption text-medium-emphasis">Work suspension order</div>
                </div>
                <VSpacer />
                <VIcon icon="mdi-chevron-right" size="18" color="medium-emphasis" />
              </VCardText>
            </VCard>
          </div>
        </VCardText>

        <VDivider />
        <VCardActions class="justify-end pa-4">
          <VBtn variant="text" @click="pickerDialog.visible = false">Cancel</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Confirm Delete Dialog ─────────────────────────────────────────── -->
    <VDialog v-model="deleteDialog.visible" max-width="400">
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Confirm Removal</div>
              <div class="text-caption text-medium-emphasis">This action cannot be undone.</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Remove <strong class="text-high-emphasis">{{ deleteDialog.label }}</strong>
            on <strong class="text-high-emphasis">{{ deleteDialog.date ? formatDisplayDate(deleteDialog.date) : '' }}</strong>?
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="deleteDialog.loading" @click="deleteDialog.visible = false">
            Cancel
          </VBtn>
          <VBtn color="error" variant="tonal" :loading="deleteDialog.loading" @click="executeDelete">
            <VIcon start size="16">mdi-delete-outline</VIcon>
            Remove
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Success Snackbar ──────────────────────────────────────────────── -->
    <VSnackbar
      v-model="snackbar.visible"
      :color="snackbar.color"
      location="bottom right"
      :timeout="3000"
      rounded="lg"
    >
      <div class="d-flex align-center gap-2">
        <VIcon :icon="snackbar.color === 'success' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'" size="18" />
        {{ snackbar.message }}
      </div>
    </VSnackbar>

  </div>
</template>

<script setup lang="ts">
import {
  formatDisplayDate,
  toISODate,
  usePayrollCalendar,
  type Holiday,
  type HolidayType,
  type SuspensionDay,
} from '@/composable/usePayrollCalendar'
import axios from '@axios'
import { computed, reactive, ref, watch } from 'vue'

const {
  loading,
  error,
  fetchMonth,
  invalidateMonth,
  getDateInfo,
  getMonthSummary,
  addHoliday,
  updateHoliday,
  removeHoliday,
  addSuspensionDay,
  updateSuspensionDay,
  removeSuspensionDay,
} = usePayrollCalendar()

// ---------------------------------------------------------------------------
// Week Schedules
// ---------------------------------------------------------------------------
const weekScheduleMap         = ref<Record<string, { is_compressed: boolean; is_manual_override: boolean }>>({})
const scheduleOverrideLoading = ref<string | null>(null)

async function fetchWeekSchedules(year: number, month: number) {
  try {
    const { data } = await axios.get('/api/week-schedules', { params: { year, month } })
    const map: Record<string, { is_compressed: boolean; is_manual_override: boolean }> = {}
    for (const row of data.data ?? []) {
      map[row.week_start] = { is_compressed: row.is_compressed, is_manual_override: row.is_manual_override }
    }
    weekScheduleMap.value = map
  } catch {
    // non-fatal
  }
}

function isWeekCompressed(weekStart: string): boolean {
  const row = weekScheduleMap.value[weekStart]
  if (row !== undefined) return row.is_compressed
  return false
}

const pickerDialog = reactive({
  visible:     false,
  prefillDate: null as Date | null,
})

function openPickerDialog(date: Date) {
  pickerDialog.prefillDate = date
  pickerDialog.visible     = true
}

function onPickerSelect(type: 'regular' | 'special' | 'suspension') {
  pickerDialog.visible = false
  const date = pickerDialog.prefillDate!
  if (type === 'suspension') {
    openSuspensionDialog(undefined, date)
  } else {
    openHolidayDialog(undefined, date)
    holidayDialog.type = type
  }
}

async function toggleWeekSchedule(weekStart: string, currentIsCompressed: boolean) {
  if (scheduleOverrideLoading.value) return
  scheduleOverrideLoading.value = weekStart
  try {
    await axios.post(`/api/week-schedules/override/${weekStart}`, { is_compressed: !currentIsCompressed })
    weekScheduleMap.value = {
      ...weekScheduleMap.value,
      [weekStart]: { is_compressed: !currentIsCompressed, is_manual_override: true },
    }
    const label = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    showToast(`Week of ${label} set to ${!currentIsCompressed ? 'Compressed' : 'Standard'}.`)
  } catch {
    showToast('Failed to update week schedule.', 'error')
  } finally {
    scheduleOverrideLoading.value = null
  }
}

async function clearWeekOverride(weekStart: string) {
  if (scheduleOverrideLoading.value) return
  if (!weekScheduleMap.value[weekStart]?.is_manual_override) return
  scheduleOverrideLoading.value = weekStart
  try {
    const { data } = await axios.post(`/api/week-schedules/clear-override/${weekStart}`)
    if (data.data) {
      weekScheduleMap.value = { ...weekScheduleMap.value, [weekStart]: { is_compressed: data.data.is_compressed, is_manual_override: false } }
    } else {
      const { [weekStart]: _removed, ...rest } = weekScheduleMap.value
      weekScheduleMap.value = rest
    }
    showToast('Override cleared — schedule reset to Standard.')
  } catch {
    showToast('Failed to clear override.', 'error')
  } finally {
    scheduleOverrideLoading.value = null
  }
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const today     = new Date()
const viewYear  = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1)

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const monthLabel = computed(() => `${MONTH_NAMES[viewMonth.value - 1]} ${viewYear.value}`)

function prevMonth() {
  if (viewMonth.value === 1) { viewMonth.value = 12; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ }
  else viewMonth.value++
}

watch([viewYear, viewMonth], async ([y, m]) => {
  await Promise.all([fetchMonth(y, m), fetchWeekSchedules(y, m)])
}, { immediate: true })

// ---------------------------------------------------------------------------
// Snackbar
// ---------------------------------------------------------------------------
const snackbar = reactive({ visible: false, message: '', color: 'success' as 'success' | 'error' })

function showToast(message: string, color: 'success' | 'error' = 'success') {
  snackbar.message = message
  snackbar.color   = color
  snackbar.visible = true
}

// ---------------------------------------------------------------------------
// Calendar cell types
// ---------------------------------------------------------------------------
interface CalendarCell {
  date:      Date | null
  isoDate:   string
  isToday:   boolean
  isWeekend: boolean
  isFriday:  boolean
  info:      ReturnType<typeof getDateInfo>
}

interface CalendarWeek {
  cells:        CalendarCell[]
  isCompressed: boolean
  weekStart:    string
  hasMonday:    boolean
}

// ---------------------------------------------------------------------------
// Half-day helper — true when cell has a half-day special holiday or suspension
// (regular holidays are never half-day)
// ---------------------------------------------------------------------------
function isHalfDay(cell: CalendarCell): boolean {
  if (cell.info.holiday?.type === 'special' && cell.info.holiday.is_half_day) return true
  if (cell.info.suspension?.is_half_day) return true
  return false
}

// ---------------------------------------------------------------------------
// Build weeks array
// ---------------------------------------------------------------------------
const calendarWeeks = computed<CalendarWeek[]>(() => {
  const year        = viewYear.value
  const month       = viewMonth.value
  const firstDay    = new Date(year, month - 1, 1)
  const lastDay     = new Date(year, month, 0)
  const startDow    = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const todayISO    = toISODate(today)

  const allCells: CalendarCell[] = []

  for (let i = 0; i < startDow; i++) {
    allCells.push({ date: null, isoDate: '', isToday: false, isWeekend: false, isFriday: false, info: {} })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month - 1, d)
    const isoDate = toISODate(date)
    const dow     = date.getDay()
    allCells.push({ date, isoDate, isToday: isoDate === todayISO, isWeekend: dow === 0 || dow === 6, isFriday: dow === 5, info: getDateInfo(isoDate) })
  }

  while (allCells.length % 7 !== 0) {
    allCells.push({ date: null, isoDate: '', isToday: false, isWeekend: false, isFriday: false, info: {} })
  }

  const weeks: CalendarWeek[] = []
  for (let i = 0; i < allCells.length; i += 7) {
    const cells = allCells.slice(i, i + 7)

    let weekStart = ''
    const anchorCell = cells.find(c => c.date && c.date.getDay() !== 0) ?? cells.find(c => c.date)
    if (anchorCell?.date) {
      const d   = new Date(anchorCell.date)
      const dow = d.getDay()
      d.setDate(d.getDate() - (dow - 1))
      const yy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      weekStart = `${yy}-${mm}-${dd}`
    }

    const isCompressed = weekStart ? isWeekCompressed(weekStart) : false
    const hasMonday    = cells.some(c => c.date && c.date.getDay() === 1)

    weeks.push({ cells, isCompressed, weekStart, hasMonday })
  }

  return weeks
})

// ---------------------------------------------------------------------------
// Cell CSS classes
// ---------------------------------------------------------------------------
function cellClasses(cell: CalendarCell, isCompressed: boolean) {
  if (!cell.date) return { 'cm-cell--empty': true }
  const fridayIsCompressedOff = cell.isFriday && isCompressed && !cell.info.holiday && !cell.info.suspension
  return {
    'cm-cell--today':     cell.isToday,
    'cm-cell--weekend':   cell.isWeekend && !cell.info.holiday,
    'cm-cell--fri-cmp':   fridayIsCompressedOff,
    'cm-cell--rh':        cell.info.holiday?.type === 'regular',
    'cm-cell--sh':        cell.info.holiday?.type === 'special',
    'cm-cell--susp':      !!cell.info.suspension,
    'cm-cell--half':      isHalfDay(cell),
    'cm-cell--clickable': true,
  }
}

// ---------------------------------------------------------------------------
// Summary — working days count
// Only suspensions reduce working days (holidays do NOT affect the count).
// Full suspension = −1, half-day suspension = −0.5.
// ---------------------------------------------------------------------------
const summary = computed(() => {
   const base = getMonthSummary(viewYear.value, viewMonth.value)
   let workingDays = 0

   for (const week of calendarWeeks.value) {
     for (const cell of week.cells) {
       if (!cell.date) continue
       const dow = cell.date.getDay()

     // Working day slots are always Mon–Fri, regardless of compressed
    // vs standard schedule — compressed weeks just compress the hours
     // worked on Mon–Thu and leave Friday off duty, but Friday still
     // counts as a regular working day unless a suspension removes it.
      const isWorkSlot = dow >= 1 && dow <= 5

       if (!isWorkSlot) continue

       if (!cell.info.suspension) {
         // No suspension — counts as a full working day regardless of holidays
         workingDays += 1
       } else if (cell.info.suspension.is_half_day) {
         // Half-day suspension — only half the day is lost
         workingDays += 0.5
       }
       // Full suspension — 0 contribution
     }
   }

   return { ...base, totalWorkingDays: workingDays }
 })

// ---------------------------------------------------------------------------
// Cell click
// ---------------------------------------------------------------------------
function onCellClick(cell: CalendarCell) {
  if (!cell.date) return
  if (cell.info.suspension)   openSuspensionDialog(cell.info.suspension)
  else if (cell.info.holiday) openHolidayDialog(cell.info.holiday)
  else                        openPickerDialog(cell.date)
}

// ---------------------------------------------------------------------------
// Holiday dialog
// ---------------------------------------------------------------------------
const holidayDialog = reactive({
  visible:      false,
  editId:       null as number | null,
  date:         '',
  originalDate: '',
  dateChanged:  false,
  label:        '',
  type:         'regular' as HolidayType,
  isHalfDay:    false,
  error:        '',
  loading:      false,
})

function openHolidayDialog(holiday?: Holiday, prefillDate?: Date) {
  const dateVal              = holiday?.date ?? (prefillDate ? toISODate(prefillDate) : '')
  holidayDialog.editId       = holiday?.id ?? null
  holidayDialog.date         = dateVal
  holidayDialog.originalDate = dateVal
  holidayDialog.dateChanged  = false
  holidayDialog.label        = holiday?.label ?? ''
  holidayDialog.type         = holiday?.type ?? 'regular'
  holidayDialog.isHalfDay    = holiday?.is_half_day ?? false
  holidayDialog.error        = ''
  holidayDialog.loading      = false
  holidayDialog.visible      = true
}

function closeHolidayDialog() { holidayDialog.visible = false }

async function submitHoliday() {
  holidayDialog.error = ''
  if (!holidayDialog.date)         { holidayDialog.error = 'Please select a date.';  return }
  if (!holidayDialog.label.trim()) { holidayDialog.error = 'Please enter a label.'; return }
  holidayDialog.loading = true

  // Regular holidays are never half-day
  const isHalfDay = holidayDialog.type === 'special' ? holidayDialog.isHalfDay : false

  const result = holidayDialog.editId
    ? await updateHoliday(holidayDialog.editId, holidayDialog.date, holidayDialog.label, holidayDialog.type, isHalfDay)
    : await addHoliday(holidayDialog.date, holidayDialog.label, holidayDialog.type, isHalfDay)

  holidayDialog.loading = false
  if (result === true) {
    invalidateMonth(viewYear.value, viewMonth.value)
    await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
    closeHolidayDialog()
    showToast(holidayDialog.editId ? 'Holiday updated successfully.' : 'Holiday added successfully.')
  } else {
    holidayDialog.error = result
  }
}

// ---------------------------------------------------------------------------
// Suspension dialog
// ---------------------------------------------------------------------------
const suspensionDialog = reactive({
  visible:   false,
  editId:    null as number | null,
  date:      '',
  label:     '',
  isHalfDay: false,
  error:     '',
  loading:   false,
})

function openSuspensionDialog(suspension?: SuspensionDay, prefillDate?: Date) {
  suspensionDialog.editId    = suspension?.id ?? null
  suspensionDialog.date      = suspension?.date ?? (prefillDate ? toISODate(prefillDate) : '')
  suspensionDialog.label     = suspension?.label ?? ''
  suspensionDialog.isHalfDay = suspension?.is_half_day ?? false
  suspensionDialog.error     = ''
  suspensionDialog.loading   = false
  suspensionDialog.visible   = true
}

function closeSuspensionDialog() { suspensionDialog.visible = false }

async function submitSuspension() {
  suspensionDialog.error = ''
  if (!suspensionDialog.date)         { suspensionDialog.error = 'Please select a date.';  return }
  if (!suspensionDialog.label.trim()) { suspensionDialog.error = 'Please enter a label.'; return }
  suspensionDialog.loading = true

  const result = suspensionDialog.editId
    ? await updateSuspensionDay(suspensionDialog.editId, suspensionDialog.date, suspensionDialog.label, suspensionDialog.isHalfDay)
    : await addSuspensionDay(suspensionDialog.date, suspensionDialog.label, suspensionDialog.isHalfDay)

  suspensionDialog.loading = false
  if (result === true) {
    invalidateMonth(viewYear.value, viewMonth.value)
    await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
    closeSuspensionDialog()
    showToast(suspensionDialog.editId ? 'Suspension day updated.' : 'Suspension day added.')
  } else {
    suspensionDialog.error = result
  }
}

// ---------------------------------------------------------------------------
// Delete dialog
// ---------------------------------------------------------------------------
type DeleteTarget = 'holiday' | 'suspension'

const deleteDialog = reactive({
  visible: false,
  type:    'holiday' as DeleteTarget,
  id:      null as number | null,
  label:   '',
  date:    '',
  loading: false,
})

function confirmRemoveHoliday(h: Holiday) {
  deleteDialog.type = 'holiday'; deleteDialog.id = h.id; deleteDialog.label = h.label
  deleteDialog.date = h.date; deleteDialog.loading = false; deleteDialog.visible = true
}

function confirmRemoveSuspension(s: SuspensionDay) {
  deleteDialog.type = 'suspension'; deleteDialog.id = s.id; deleteDialog.label = s.label
  deleteDialog.date = s.date; deleteDialog.loading = false; deleteDialog.visible = true
}

async function executeDelete() {
  if (!deleteDialog.id) return
  deleteDialog.loading = true
  const result = deleteDialog.type === 'holiday'
    ? await removeHoliday(deleteDialog.id)
    : await removeSuspensionDay(deleteDialog.id)
  deleteDialog.loading = false
  if (result === true) {
    invalidateMonth(viewYear.value, viewMonth.value)
    await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
    deleteDialog.visible = false
    showToast(`${deleteDialog.type === 'holiday' ? 'Holiday' : 'Suspension day'} removed.`)
  } else {
    showToast(typeof result === 'string' ? result : 'Failed to remove.', 'error')
  }
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────── */
.calendar-mgmt {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.cm-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.cm-page-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cm-title-icon    { color: var(--primary-color); }

.cm-page-subtitle {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  margin-top: 0.2rem;
}

.cm-header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

/* ── Main Layout ────────────────────────────────────────────────────── */
.cm-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 960px) {
  .cm-layout { grid-template-columns: 1fr; }
}

/* ── Calendar Panel ─────────────────────────────────────────────────── */
.cm-calendar-panel,
.cm-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 1.25rem;
}

/* ── Month Nav ──────────────────────────────────────────────────────── */
.cm-month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cm-month-label {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-color);
}

.cm-loading { padding: 2rem 0; }

/* ── Legend ─────────────────────────────────────────────────────────── */
.cm-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.85rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.55rem 0.75rem;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.cm-legend-item {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.cm-legend-item--divider {
  width: 1px;
  height: 14px;
  background: var(--surface-border);
  padding: 0;
  margin: 0 0.1rem;
}

.cm-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.cm-legend-dot--rh      { background: var(--red-400); }
.cm-legend-dot--sh      { background: var(--orange-400); }
.cm-legend-dot--susp    { background: var(--green-400); }
.cm-legend-dot--today   { background: var(--primary-color); border-radius: 50%; }
.cm-legend-dot--weekend { background: var(--surface-border); }
.cm-legend-dot--fri-cmp { background: color-mix(in srgb, var(--purple-500, #9c27b0) 40%, transparent); }

.cm-legend-pill {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.cm-legend-pill--std {
  background: color-mix(in srgb, var(--primary-color) 15%, transparent);
  color: var(--primary-color);
}

.cm-legend-pill--cmp {
  background: color-mix(in srgb, var(--purple-500, #9c27b0) 15%, transparent);
  color: var(--purple-500, #9c27b0);
}

/* Half-day legend badge */
.cm-legend-half-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--purple-500, #9c27b0) 15%, transparent);
  color: var(--purple-500, #9c27b0);
}

/* ── Day Headers ────────────────────────────────────────────────────── */
.cm-day-headers {
  display: grid;
  grid-template-columns: 36px repeat(7, 1fr);
  margin-top: 0.75rem;
}

.cm-week-gutter-header { /* empty space above week labels */ }

.cm-day-name {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

/* ── Week Rows ──────────────────────────────────────────────────────── */
.cm-weeks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 0.5rem;
}

.cm-week-row {
  display: grid;
  grid-template-columns: 36px repeat(7, 1fr);
  gap: 4px;
  align-items: stretch;
}

/* ── Week Label ─────────────────────────────────────────────────────── */
.cm-week-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 6px;
  user-select: none;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}

.cm-week-label:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.cm-week-label--std {
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.cm-week-label--cmp {
  background: color-mix(in srgb, var(--purple-500, #9c27b0) 10%, transparent);
  color: var(--purple-500, #9c27b0);
}

.cm-week-label--saving {
  opacity: 0.5;
  pointer-events: none;
}

.cm-week-label--override {
  outline: 2px solid var(--orange-400, #fb8c00);
  outline-offset: 1px;
}

.cm-week-saving {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.cm-week-override-dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--orange-400, #fb8c00);
  margin: 1px auto 0;
  flex-shrink: 0;
}

.cm-week-label-empty { border-radius: 6px; }

/* ── Calendar Cells ─────────────────────────────────────────────────── */
.cm-cell {
  aspect-ratio: 1;
  border-radius: 8px;
  padding: 0.4rem;
  font-size: 0.8rem;
  position: relative;
  background: transparent;
  transition: background 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cm-cell--clickable       { cursor: pointer; }
.cm-cell--clickable:hover { background: var(--surface-hover); }
.cm-cell--weekend         { background: var(--surface-ground); }

.cm-cell--fri-cmp {
  background: color-mix(in srgb, var(--purple-500, #9c27b0) 8%, transparent);
  opacity: 0.6;
}

.cm-cell--today {
  background: color-mix(in srgb, var(--primary-color) 15%, transparent);
  outline: 2px solid var(--primary-color);
}

.cm-cell--rh   { background: color-mix(in srgb, var(--red-500) 12%, transparent); }
.cm-cell--sh   { background: color-mix(in srgb, var(--orange-500) 12%, transparent); }
.cm-cell--susp { background: color-mix(in srgb, var(--green-500) 12%, transparent); }

/* Half-day cells get a diagonal split to show partial day visually */
.cm-cell--sh.cm-cell--half {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--orange-500) 12%, transparent) 50%,
    transparent 50%
  );
}

.cm-cell--susp.cm-cell--half {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--green-500) 12%, transparent) 50%,
    transparent 50%
  );
}

.cm-cell--rh.cm-cell--susp,
.cm-cell--sh.cm-cell--susp {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--red-500) 12%, transparent) 50%,
    color-mix(in srgb, var(--green-500) 12%, transparent) 50%
  );
}

.cm-cell-num {
  font-weight: 600;
  color: var(--text-color);
  line-height: 1;
}

.cm-cell-badges {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin-top: 4px;
  justify-content: center;
}

.cm-badge {
  font-size: 0.6rem !important;
  height: 16px !important;
}

.cm-badge--half {
  font-weight: 700 !important;
  min-width: 18px !important;
}

/* ── Sidebar ────────────────────────────────────────────────────────── */
.cm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cm-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.cm-card-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-color);
  margin-bottom: 0.75rem;
}

.cm-card-header .cm-card-title { margin-bottom: 0; }

/* ── Stats ──────────────────────────────────────────────────────────── */
.cm-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.cm-stat {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cm-stat-inner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cm-stat-inner > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.cm-stat--rh      { background: color-mix(in srgb, var(--red-500)    10%, var(--surface-card)); }
.cm-stat--sh      { background: color-mix(in srgb, var(--orange-500) 10%, var(--surface-card)); }
.cm-stat--susp    { background: color-mix(in srgb, var(--green-500)  10%, var(--surface-card)); }
.cm-stat--working { background: color-mix(in srgb, var(--blue-500, #2196f3) 10%, var(--surface-card)); }

.cm-stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1;
}

.cm-stat-label {
  font-size: 0.68rem;
  color: var(--text-color-secondary);
  line-height: 1.3;
}

/* ── List Items ─────────────────────────────────────────────────────── */
.cm-list-section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.cm-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--surface-border);
}

.cm-list-item:last-child { border-bottom: none; }

.cm-list-item-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.cm-list-item-label {
  font-size: 0.82rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cm-list-item-actions {
  display: flex;
  flex-shrink: 0;
}

.cm-empty-text {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

/* ── Form Fields ────────────────────────────────────────────────────── */
.cm-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cm-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-color);
}

.cm-required { color: var(--red-500); }

.flex-1 { flex: 1; }
</style>
