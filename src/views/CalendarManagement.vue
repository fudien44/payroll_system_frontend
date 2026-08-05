<template>
  <div class="calendar-mgmt">

    <!-- ── Page Header ───────────────────────────────────────────────────── -->
    <div class="cm-page-header">
      <div>
        <h1 class="cm-page-title">
          <VIcon icon="mdi-calendar-month" class="cm-title-icon" />
          Calendar Management
        </h1>
        <p class="cm-page-subtitle">Manage Public Holidays, Work Suspension Days, Contract Breaks, and Standard Weeks</p>
      </div>

      <div class="cm-header-actions">
  <VMenu>
    <template #activator="{ props: menuProps }">
      <VBtn
        v-bind="menuProps"
        color="primary"
        prepend-icon="mdi-plus"
        append-icon="mdi-menu-down"
      >
        Add
      </VBtn>
    </template>
    <VList density="compact">
  <VListItem prepend-icon="mdi-calendar-star" title="Holiday" @click="openHolidayDialog()" />
  <VListItem prepend-icon="mdi-calendar-remove" title="Suspension Day" @click="openSuspensionDialog()" />
  <VDivider class="my-1" />
  <VListItem prepend-icon="mdi-calendar-remove-outline" title="Contract Break Batch" @click="openBatchDialog()" />
  <VListItem prepend-icon="mdi-account-clock-outline" title="Individual Contract Break" @click="openCustomBreakDialog()" />
  <VDivider class="my-1" />
  <VListItem prepend-icon="mdi-calendar-clock-outline" title="Standard Week Batch" @click="openStandardWeekBatchDialog()" />
  <VListItem prepend-icon="mdi-account-clock" title="Individual Standard Week" @click="openCustomStandardWeekDialog()" />
</VList>
  </VMenu>
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

                <!-- Contract Breaks -->
        <div class="cm-card">
          <div class="cm-card-header">
            <h3 class="cm-card-title">Contract Breaks</h3>
          </div>

          <div v-if="contractBreakBatchesForYear.length">
          <div
            v-for="batch in contractBreakBatchesForYear"
            :key="batch.id"
            class="cm-cb-item"
            @click="openBatchDetail(batch)"
          >
            <div class="cm-cb-item-main">
              <VChip size="x-small" color="grey-darken-1" variant="tonal" label>
                {{ formatBatchRange(batch.start_date, batch.end_date) }}
              </VChip>
              <span class="cm-cb-item-label">{{ batch.label }}</span>
            </div>
            <div class="cm-cb-item-meta">
              <span class="text-caption text-medium-emphasis">
                Resumes {{ formatDisplayDate(batch.resumption_date) }}
              </span>
              <VChip size="x-small" color="primary" variant="tonal">
                <VIcon start size="11">mdi-account-multiple</VIcon>
                {{ batch.employee_breaks_count ?? 0 }}
              </VChip>
              <VBtn icon size="x-small" variant="text" color="primary" @click.stop="openBatchDialog(batch)">
                <VIcon size="15">mdi-pencil-outline</VIcon>
              </VBtn>
              <VBtn icon size="x-small" variant="text" color="error" @click.stop="handleRemoveBatch(batch.id)">
                <VIcon size="15">mdi-delete-outline</VIcon>
              </VBtn>
            </div>
          </div>
        </div>

        <p v-else class="cm-empty-text">No contract break batches for {{ viewYear }}.</p>
         <template v-if="customContractBreaksForYear.length">
          <p class="cm-list-section-label mt-3">Individual</p>
          <div
            v-for="cb in customContractBreaksForYear"
            :key="cb.id"
            class="cm-list-item"
            style="cursor: pointer;"
            @click="openCustomBreakDialog(cb)"
          >
            <div class="cm-list-item-info">
              <VChip size="x-small" color="grey-darken-1" variant="tonal" label>
                {{ formatBatchRange(cb.start_date!, cb.end_date!) }}
              </VChip>
              <span class="cm-list-item-label">{{ cb.emp_name }}</span>
            </div>
            <div class="cm-list-item-actions">
              <VBtn icon size="x-small" variant="text" color="error" @click.stop="handleRemoveCustomBreak(cb.id)">
                <VIcon size="15">mdi-delete-outline</VIcon>
              </VBtn>
            </div>
          </div>
        </template>
      </div>

        <!-- Standard Week Exemptions -->
        <div class="cm-card">
          <div class="cm-card-header">
            <h3 class="cm-card-title">Standard Week Exemptions</h3>
          </div>

          <div v-if="standardWeekBatchesForYear.length">
            <div
              v-for="batch in standardWeekBatchesForYear"
              :key="batch.id"
              class="cm-cb-item"
              @click="openStandardWeekBatchDetail(batch)"
            >
              <div class="cm-cb-item-main">
                <VChip size="x-small" color="grey-darken-1" variant="tonal" label>
                  {{ formatBatchRange(batch.start_date, batch.end_date) }}
                </VChip>
                <span class="cm-cb-item-label">{{ batch.label }}</span>
              </div>
              <div class="cm-cb-item-meta">
                <VChip size="x-small" color="primary" variant="tonal">
                  <VIcon start size="11">mdi-account-multiple</VIcon>
                  {{ batch.employee_exemptions_count ?? 0 }}
                </VChip>
                <VBtn icon size="x-small" variant="text" color="primary" @click.stop="openStandardWeekBatchDialog(batch)">
                  <VIcon size="15">mdi-pencil-outline</VIcon>
                </VBtn>
                <VBtn icon size="x-small" variant="text" color="error" @click.stop="handleRemoveStandardWeekBatch(batch.id)">
                  <VIcon size="15">mdi-delete-outline</VIcon>
                </VBtn>
              </div>
            </div>
          </div>

          <p v-else class="cm-empty-text">No standard-week exemptions for {{ viewYear }}.</p>
         <template v-if="customStandardWeekExemptionsForYear.length">
          <p class="cm-list-section-label mt-3">Individual</p>
          <div
            v-for="ex in customStandardWeekExemptionsForYear"
            :key="ex.emp_id"
            class="cm-list-item"
            style="cursor: pointer;"
            @click="openCustomStandardWeekDialog({ emp_id: ex.emp_id, name: ex.emp_name })"
          >
            <div class="cm-list-item-info">
              <VChip size="x-small" color="grey-darken-1" variant="tonal" label>
                {{ ex.week_count }} wk{{ ex.week_count !== 1 ? 's' : '' }}
              </VChip>
              <span class="cm-list-item-label">{{ ex.emp_name }}</span>
            </div>
            <div class="cm-list-item-actions">
              <VBtn icon size="x-small" variant="text" color="error" @click.stop="handleRemoveCustomStandardWeek(ex.emp_id)">
                <VIcon size="15">mdi-delete-outline</VIcon>
              </VBtn>
            </div>
          </div>
        </template>
      </div>

        <!-- Holidays -->
        <div class="cm-card">
          <div class="cm-card-header">
            <h3 class="cm-card-title">Holidays</h3>
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

    <!-- ── Contract Break Batch Dialog ───────────────────────────────────── -->
<VDialog v-model="batchDialog.visible" max-width="440" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="grey-darken-1" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-remove-outline" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">
            {{ batchDialog.editId ? 'Edit Batch' : 'Add Contract Break Batch' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ batchDialog.editId ? 'Update batch details' : 'Define a shared break period for multiple employees' }}
          </div>
        </div>
      </div>

      <div class="cm-field mb-3">
        <label class="cm-label">Label <span class="cm-required">*</span></label>
        <VTextField
          v-model="batchDialog.label"
          placeholder="e.g. July 2026 Batch A"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-tag-outline"
          hide-details="auto"
        />
      </div>

      <div class="d-flex gap-3 mb-3">
        <div class="cm-field flex-1">
          <label class="cm-label">Start Date <span class="cm-required">*</span></label>
          <VTextField
            v-model="batchDialog.startDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </div>
        <div class="cm-field flex-1">
          <label class="cm-label">End Date <span class="cm-required">*</span></label>
          <VTextField
            v-model="batchDialog.endDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </div>
      </div>

      <div class="cm-field mb-3">
        <label class="cm-label">Resumption Date <span class="cm-required">*</span></label>
        <VTextField
          v-model="batchDialog.resumptionDate"
          type="date"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-calendar-arrow-right"
          hide-details="auto"
        />
        <p class="text-caption text-medium-emphasis mt-1 mb-0">
          The official return-to-work date. Days between End Date and Resumption Date
          (exclusive) are also treated as part of the break.
        </p>
      </div>

      <div class="cm-field">
        <label class="cm-label">Notes</label>
        <VTextField
          v-model="batchDialog.notes"
          placeholder="Optional — e.g. memo reference"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-note-outline"
          hide-details="auto"
        />
      </div>

      <VAlert v-if="batchDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ batchDialog.error }}
      </VAlert>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" :disabled="batchDialog.loading" @click="closeBatchDialog">
        Cancel
      </VBtn>
      <VBtn
        color="primary"
        variant="tonal"
        :loading="batchDialog.loading"
        :prepend-icon="batchDialog.editId ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
        @click="submitBatch"
      >
        {{ batchDialog.editId ? 'Save Changes' : 'Create Batch' }}
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>


<VDialog v-model="standardWeekBatchDialog.visible" max-width="440" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="indigo" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-clock-outline" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">
            {{ standardWeekBatchDialog.editId ? 'Edit Batch' : 'Add Standard Week Batch' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ standardWeekBatchDialog.editId ? 'Update batch details' : 'Exempt employees from compressed week for a date range' }}
          </div>
        </div>
      </div>

      <div class="cm-field mb-3">
        <label class="cm-label">Label <span class="cm-required">*</span></label>
        <VTextField
          v-model="standardWeekBatchDialog.label"
          placeholder="e.g. August 2026 - Cashiering"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-tag-outline"
          hide-details="auto"
        />
      </div>

      <div class="cm-field mb-3">
        <label class="cm-label">Standard Weeks <span class="cm-required">*</span></label>
        <StandardWeekSelector v-model="standardWeekBatchDialog.weeks" color="indigo" />
      </div>

      <div class="cm-field">
        <label class="cm-label">Notes</label>
        <VTextField
          v-model="standardWeekBatchDialog.notes"
          placeholder="Optional — e.g. memo reference"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-note-outline"
          hide-details="auto"
        />
      </div>

      <VAlert v-if="standardWeekBatchDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ standardWeekBatchDialog.error }}
      </VAlert>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" :disabled="standardWeekBatchDialog.loading" @click="closeStandardWeekBatchDialog">Cancel</VBtn>
      <VBtn
        color="indigo"
        variant="tonal"
        :loading="standardWeekBatchDialog.loading"
        :prepend-icon="standardWeekBatchDialog.editId ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
        @click="submitStandardWeekBatch"
      >
        {{ standardWeekBatchDialog.editId ? 'Save Changes' : 'Create Batch' }}
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>

<!-- ── Standard Week Employee Picker Dialog (batch assignment) ───────── -->
<VDialog v-model="standardWeekEmployeePickerDialog.visible" max-width="480" scrollable>
  <VCard rounded="lg">
    <VCardText class="pa-6 pb-2">
      <div class="text-body-1 font-weight-medium mb-1">Assign Employees</div>
      <div class="text-caption text-medium-emphasis mb-3">Select employees to exempt from compressed week for this batch's date range</div>

      <div class="d-flex gap-2 mb-2">
        <VSelect
          v-model="standardWeekPickerDivisionFilter"
          :items="standardWeekPickerDivisionOptions"
          label="Division"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
        <VSelect
          v-model="standardWeekPickerSectionFilter"
          :items="standardWeekPickerSectionOptions"
          label="Section"
          density="compact"
          variant="outlined"
          clearable
          hide-details
        />
      </div>

      <VTextField
        v-model="standardWeekEmployeePickerDialog.search"
        placeholder="Search by name or position"
        density="compact"
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        hide-details
        clearable
      />
    </VCardText>

    <VDivider />

    <VCardText class="pa-0" style="max-height: 400px; overflow-y: auto;">
      <div v-if="filteredStandardWeekPickerEmployees.length > 0" class="d-flex align-center gap-2 pa-3 pb-0">
        <VCheckboxBtn
          :model-value="allStandardWeekFilteredChecked"
          :indeterminate="someStandardWeekFilteredChecked"
          density="compact"
          color="indigo"
          hide-details
          @update:model-value="toggleSelectAllStandardWeekFiltered"
        />
        <span class="text-caption text-medium-emphasis">
          Select all shown ({{ filteredStandardWeekPickerEmployees.length }})
        </span>
      </div>

      <VSkeletonLoader v-if="standardWeekEmployeePickerDialog.loading" type="list-item-two-line, list-item-two-line, list-item-two-line" />

      <VList v-else select-strategy="classic">
        <VListItem
          v-for="emp in filteredStandardWeekPickerEmployees"
          :key="emp.emp_id"
          @click="
            standardWeekEmployeePickerDialog.selected.includes(emp.emp_id)
              ? standardWeekEmployeePickerDialog.selected = standardWeekEmployeePickerDialog.selected.filter(id => id !== emp.emp_id)
              : standardWeekEmployeePickerDialog.selected.push(emp.emp_id)
          "
        >
          <template #prepend>
            <VCheckboxBtn :model-value="standardWeekEmployeePickerDialog.selected.includes(emp.emp_id)" />
          </template>
          <VListItemTitle>{{ emp.name }}</VListItemTitle>
          <VListItemSubtitle>{{ emp.position }} · {{ emp.division_name ?? '—' }}</VListItemSubtitle>
        </VListItem>

        <p v-if="filteredStandardWeekPickerEmployees.length === 0" class="text-center text-body-2 text-medium-emphasis pa-4 mb-0">
          No matching employees found.
        </p>
      </VList>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-space-between pa-4">
      <span class="text-caption text-medium-emphasis">
        {{ standardWeekEmployeePickerDialog.selected.length }} selected
      </span>
      <div class="d-flex gap-2">
        <VBtn variant="text" @click="standardWeekEmployeePickerDialog.visible = false">Cancel</VBtn>
        <VBtn
          color="indigo"
          variant="tonal"
          :loading="standardWeekEmployeePickerDialog.assigning"
          :disabled="standardWeekEmployeePickerDialog.selected.length === 0"
          @click="confirmStandardWeekAssignment"
        >
          Assign ({{ standardWeekEmployeePickerDialog.selected.length }})
        </VBtn>
      </div>
    </VCardActions>
  </VCard>
</VDialog>

<!-- ── Batch Detail Dialog ────────────────────────────────────────────── -->
<VDialog v-model="batchDetailDialog.visible" max-width="560" scrollable>
  <VCard rounded="lg">
    <VCardText class="pa-6 pb-0">
      <div class="d-flex align-center gap-3 mb-1">
        <VAvatar color="grey-darken-1" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-remove-outline" size="22" />
        </VAvatar>
        <div class="flex-grow-1">
          <div class="text-body-1 font-weight-medium">{{ batchDetailDialog.batch?.label }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ batchDetailDialog.batch ? formatDisplayDate(batchDetailDialog.batch.start_date) : '' }}
            –
            {{ batchDetailDialog.batch ? formatDisplayDate(batchDetailDialog.batch.end_date) : '' }}
            · Resumes {{ batchDetailDialog.batch ? formatDisplayDate(batchDetailDialog.batch.resumption_date) : '' }}
          </div>
        </div>
        <VBtn icon variant="text" size="small" @click="closeBatchDetail">
          <VIcon>mdi-close</VIcon>
        </VBtn>
      </div>
    </VCardText>

    <VDivider class="mt-4" />

   <VCardText class="pa-6">
  <div class="d-flex justify-space-between align-center mb-3">
    <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
      Assigned Employees
      <VChip size="x-small" color="primary" variant="tonal" class="ml-1">
        {{ batchDetailDialog.assignedEmployees.length }}
      </VChip>
    </p>
    <VBtn
      size="small"
      variant="tonal"
      color="primary"
      prepend-icon="mdi-account-plus-outline"
      @click="batchDetailDialog.batch && openEmployeePicker(batchDetailDialog.batch.id)"
    >
      Assign Employees
    </VBtn>
  </div>

  <VSkeletonLoader v-if="batchDetailDialog.loadingAssigned" type="list-item-two-line, list-item-two-line" />

  <div v-else-if="batchDetailDialog.assignedEmployees.length === 0" class="text-center py-6"
    style="border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;">
    <VIcon icon="mdi-account-off-outline" size="32" class="text-medium-emphasis mb-2" />
    <p class="text-body-2 text-medium-emphasis mb-0">No employees assigned yet.</p>
  </div>

  <template v-else>
    <div class="d-flex align-center gap-2 mb-2">
      <VCheckboxBtn
        :model-value="allBatchDetailChecked"
        :indeterminate="someBatchDetailChecked"
        density="compact"
        color="error"
        hide-details
        @update:model-value="toggleSelectAllBatchDetail"
      />
      <span class="text-caption text-medium-emphasis">
        Select all ({{ batchDetailDialog.assignedEmployees.length }})
      </span>
      <VSpacer />
      <VBtn
        v-if="batchDetailDialog.selected.length > 0"
        size="small"
        variant="tonal"
        color="error"
        :loading="batchDetailDialog.removing"
        prepend-icon="mdi-account-minus-outline"
        @click="handleRemoveSelectedBatchDetail"
      >
        Remove Selected ({{ batchDetailDialog.selected.length }})
      </VBtn>
    </div>

    <div style="max-height: 360px; overflow-y: auto;">
      <div
        v-for="assignment in batchDetailDialog.assignedEmployees"
        :key="assignment.id"
        class="cm-list-item"
      >
        <div class="cm-list-item-info">
          <VCheckboxBtn
            :model-value="batchDetailDialog.selected.includes(assignment.id)"
            density="compact"
            color="error"
            hide-details
            @update:model-value="
              batchDetailDialog.selected.includes(assignment.id)
                ? batchDetailDialog.selected = batchDetailDialog.selected.filter(id => id !== assignment.id)
                : batchDetailDialog.selected.push(assignment.id)
            "
          />
          <span class="cm-list-item-label">
            {{ assignment.emp_name }}
            <span v-if="assignment.division_name" class="text-caption text-medium-emphasis ml-1">
              · {{ assignment.division_name }}
            </span>
          </span>
        </div>
        <div class="cm-list-item-actions">
          <VBtn icon size="x-small" variant="text" color="error" @click="handleUnassign(assignment)">
            <VIcon size="15">mdi-close</VIcon>
          </VBtn>
        </div>
      </div>
    </div>
  </template>
</VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4">
      <VBtn variant="tonal" @click="closeBatchDetail">Close</VBtn>
    </VCardActions>
  </VCard>
</VDialog>

<!-- ── Employee Picker Dialog (batch assignment) ─────────────────────── -->
<VDialog v-model="employeePickerDialog.visible" max-width="480" scrollable>
  <VCard rounded="lg">
    <VCardText class="pa-6 pb-2">
  <div class="text-body-1 font-weight-medium mb-1">Assign Employees</div>
  <div class="text-caption text-medium-emphasis mb-3">Select employees to add to this batch</div>

  <div class="d-flex gap-2 mb-2">
    <VSelect
      v-model="employeePickerDivisionFilter"
      :items="employeePickerDivisionOptions"
      label="Division"
      density="compact"
      variant="outlined"
      clearable
      hide-details
    />
    <VSelect
      v-model="employeePickerSectionFilter"
      :items="employeePickerSectionOptions"
      label="Section"
      density="compact"
      variant="outlined"
      clearable
      hide-details
    />
  </div>

  <VTextField
    v-model="employeePickerDialog.search"
    placeholder="Search by name or position"
    density="compact"
    variant="outlined"
    prepend-inner-icon="mdi-magnify"
    hide-details
    clearable
  />
</VCardText>

<VDivider />

<VCardText class="pa-0" style="max-height: 400px; overflow-y: auto;">
  <div v-if="filteredPickerEmployees.length > 0" class="d-flex align-center gap-2 pa-3 pb-0">
    <VCheckboxBtn
      :model-value="allFilteredChecked"
      :indeterminate="someFilteredChecked"
      density="compact"
      color="primary"
      hide-details
      @update:model-value="toggleSelectAllFiltered"
    />
    <span class="text-caption text-medium-emphasis">
      Select all shown ({{ filteredPickerEmployees.length }})
    </span>
  </div>

  <VSkeletonLoader v-if="employeePickerDialog.loading" type="list-item-two-line, list-item-two-line, list-item-two-line" />

  <VList v-else select-strategy="classic">
        <VListItem
          v-for="emp in filteredPickerEmployees"
          :key="emp.emp_id"
          @click="
            employeePickerDialog.selected.includes(emp.emp_id)
              ? employeePickerDialog.selected = employeePickerDialog.selected.filter(id => id !== emp.emp_id)
              : employeePickerDialog.selected.push(emp.emp_id)
          "
        >
          <template #prepend>
            <VCheckboxBtn :model-value="employeePickerDialog.selected.includes(emp.emp_id)" />
          </template>
          <VListItemTitle>{{ emp.name }}</VListItemTitle>
          <VListItemSubtitle>{{ emp.position }} · {{ emp.division_name ?? '—' }}</VListItemSubtitle>
        </VListItem>

        <p v-if="filteredPickerEmployees.length === 0" class="text-center text-body-2 text-medium-emphasis pa-4 mb-0">
          No matching employees found.
        </p>
      </VList>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-space-between pa-4">
      <span class="text-caption text-medium-emphasis">
        {{ employeePickerDialog.selected.length }} selected
      </span>
      <div class="d-flex gap-2">
        <VBtn variant="text" @click="employeePickerDialog.visible = false">Cancel</VBtn>
        <VBtn
          color="primary"
          variant="tonal"
          :loading="employeePickerDialog.assigning"
          :disabled="employeePickerDialog.selected.length === 0"
          @click="confirmAssignment"
        >
          Assign ({{ employeePickerDialog.selected.length }})
        </VBtn>
      </div>
    </VCardActions>
  </VCard>
</VDialog>

<!-- ── Standard Week Batch Detail Dialog ─────────────────────────────── -->
<VDialog v-model="standardWeekBatchDetailDialog.visible" max-width="560" scrollable>
  <VCard rounded="lg">
    <VCardText class="pa-6 pb-0">
      <div class="d-flex align-center gap-3 mb-1">
        <VAvatar color="indigo" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-clock-outline" size="22" />
        </VAvatar>
        <div class="flex-grow-1">
          <div class="text-body-1 font-weight-medium">{{ standardWeekBatchDetailDialog.batch?.label }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ standardWeekBatchDetailDialog.batch ? formatDisplayDate(standardWeekBatchDetailDialog.batch.start_date) : '' }}
            –
            {{ standardWeekBatchDetailDialog.batch ? formatDisplayDate(standardWeekBatchDetailDialog.batch.end_date) : '' }}
          </div>
        </div>
        <VBtn icon variant="text" size="small" @click="closeStandardWeekBatchDetail">
          <VIcon>mdi-close</VIcon>
        </VBtn>
      </div>
    </VCardText>

    <VDivider class="mt-4" />

    <VCardText class="pa-6">
  <div class="d-flex justify-space-between align-center mb-3">
    <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
      Assigned Employees
      <VChip size="x-small" color="primary" variant="tonal" class="ml-1">
        {{ standardWeekBatchDetailDialog.assignedEmployees.length }}
      </VChip>
    </p>
    <VBtn
      size="small"
      variant="tonal"
      color="indigo"
      prepend-icon="mdi-account-plus-outline"
      @click="standardWeekBatchDetailDialog.batch && openStandardWeekEmployeePicker(standardWeekBatchDetailDialog.batch.id)"
    >
      Assign Employees
    </VBtn>
  </div>

  <VSkeletonLoader v-if="standardWeekBatchDetailDialog.loadingAssigned" type="list-item-two-line, list-item-two-line" />

  <div v-else-if="standardWeekBatchDetailDialog.assignedEmployees.length === 0" class="text-center py-6"
    style="border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;">
    <VIcon icon="mdi-account-off-outline" size="32" class="text-medium-emphasis mb-2" />
    <p class="text-body-2 text-medium-emphasis mb-0">No employees assigned yet.</p>
  </div>

  <template v-else>
    <div class="d-flex align-center gap-2 mb-2">
      <VCheckboxBtn
        :model-value="allStandardWeekDetailChecked"
        :indeterminate="someStandardWeekDetailChecked"
        density="compact"
        color="error"
        hide-details
        @update:model-value="toggleSelectAllStandardWeekDetail"
      />
      <span class="text-caption text-medium-emphasis">
        Select all ({{ standardWeekBatchDetailDialog.assignedEmployees.length }})
      </span>
      <VSpacer />
      <VBtn
        v-if="standardWeekBatchDetailDialog.selected.length > 0"
        size="small"
        variant="tonal"
        color="error"
        :loading="standardWeekBatchDetailDialog.removing"
        prepend-icon="mdi-account-minus-outline"
        @click="handleRemoveSelectedStandardWeekDetail"
      >
        Remove Selected ({{ standardWeekBatchDetailDialog.selected.length }})
      </VBtn>
    </div>

    <div style="max-height: 360px; overflow-y: auto;">
      <div
        v-for="exemption in standardWeekBatchDetailDialog.assignedEmployees"
        :key="exemption.id"
        class="cm-list-item"
      >
        <div class="cm-list-item-info">
          <VCheckboxBtn
            :model-value="standardWeekBatchDetailDialog.selected.includes(exemption.id)"
            density="compact"
            color="error"
            hide-details
            @update:model-value="
              standardWeekBatchDetailDialog.selected.includes(exemption.id)
                ? standardWeekBatchDetailDialog.selected = standardWeekBatchDetailDialog.selected.filter(id => id !== exemption.id)
                : standardWeekBatchDetailDialog.selected.push(exemption.id)
            "
          />
          <span class="cm-list-item-label">
            {{ exemption.emp_name }}
            <span v-if="exemption.division_name" class="text-caption text-medium-emphasis ml-1">
              · {{ exemption.division_name }}
            </span>
          </span>
        </div>
        <div class="cm-list-item-actions">
          <VBtn icon size="x-small" variant="text" color="error" @click="handleUnassignStandardWeek(exemption)">
            <VIcon size="15">mdi-close</VIcon>
          </VBtn>
        </div>
      </div>
    </div>
  </template>
</VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4">
      <VBtn variant="tonal" @click="closeStandardWeekBatchDetail">Close</VBtn>
    </VCardActions>
  </VCard>
</VDialog>


<!-- ── Individual Contract Break Dialog ──────────────────────────────── -->
<VDialog v-model="customBreakDialog.visible" max-width="440" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="grey-darken-1" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-account-clock-outline" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">
            {{ customBreakDialog.editId ? 'Edit Individual Break' : 'Add Individual Contract Break' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ customBreakDialog.editId ? 'Update this employee\'s break dates' : 'For an employee whose break doesn\'t match any batch' }}
          </div>
        </div>
      </div>

      <!-- Employee selection — only shown when adding new, not editing -->
      <div v-if="!customBreakDialog.editId" class="cm-field mb-3">
        <label class="cm-label">Employee <span class="cm-required">*</span></label>

        <VTextField
          v-if="!customBreakDialog.empId"
          v-model="customBreakDialog.employeeSearch"
          placeholder="Search by name"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
        />

        <VCard v-else variant="tonal" color="primary" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-2 pa-3">
            <VIcon icon="mdi-account" size="18" />
            <span class="text-body-2 font-weight-medium">{{ customBreakDialog.empName }}</span>
            <VSpacer />
            <VBtn size="x-small" variant="text" @click="customBreakDialog.empId = null; customBreakDialog.empName = ''">
              Change
            </VBtn>
          </VCardText>
        </VCard>

        <div v-if="!customBreakDialog.empId" style="max-height: 220px; overflow-y: auto;" class="mt-2">
          <VSkeletonLoader v-if="customBreakDialog.loadingEmployees" type="list-item-two-line, list-item-two-line" />
          <VList v-else density="compact">
            <VListItem
              v-for="emp in filteredCustomEmployees"
              :key="emp.emp_id"
              @click="selectCustomEmployee(emp)"
            >
              <VListItemTitle>{{ emp.name }}</VListItemTitle>
              <VListItemSubtitle>{{ emp.position }} · {{ emp.division_name ?? '—' }}</VListItemSubtitle>
            </VListItem>
            <p v-if="filteredCustomEmployees.length === 0" class="text-caption text-medium-emphasis pa-2 mb-0">
              No matching employees.
            </p>
          </VList>
        </div>
      </div>

      <!-- Read-only employee name when editing -->
      <div v-else class="cm-field mb-3">
        <label class="cm-label">Employee</label>
        <VCard variant="tonal" color="grey" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-2 pa-3">
            <VIcon icon="mdi-account" size="18" />
            <span class="text-body-2 font-weight-medium">{{ customBreakDialog.empName }}</span>
          </VCardText>
        </VCard>
      </div>

      <div class="d-flex gap-3 mb-3">
        <div class="cm-field flex-1">
          <label class="cm-label">Start Date <span class="cm-required">*</span></label>
          <VTextField
            v-model="customBreakDialog.startDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </div>
        <div class="cm-field flex-1">
          <label class="cm-label">End Date <span class="cm-required">*</span></label>
          <VTextField
            v-model="customBreakDialog.endDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </div>
      </div>

      <div class="cm-field">
        <label class="cm-label">Resumption Date <span class="cm-required">*</span></label>
        <VTextField
          v-model="customBreakDialog.resumptionDate"
          type="date"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-calendar-arrow-right"
          hide-details="auto"
        />
        <p class="text-caption text-medium-emphasis mt-1 mb-0">
          The official return-to-work date.
        </p>
      </div>

      <VAlert v-if="customBreakDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ customBreakDialog.error }}
      </VAlert>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" :disabled="customBreakDialog.loading" @click="closeCustomBreakDialog">
        Cancel
      </VBtn>
      <VBtn
        color="primary"
        variant="tonal"
        :loading="customBreakDialog.loading"
        :prepend-icon="customBreakDialog.editId ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
        @click="submitCustomBreak"
      >
        {{ customBreakDialog.editId ? 'Save Changes' : 'Add Break' }}
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>

<!-- ── Individual Standard Week Dialog ───────────────────────────────── -->
<VDialog v-model="customStandardWeekDialog.visible" max-width="440" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="indigo" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-account-clock" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">
            {{ customStandardWeekDialog.isEditing ? 'Edit Individual Standard Week' : 'Add Individual Standard Week' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ customStandardWeekDialog.isEditing ? 'Update this employee\'s exemption dates' : 'For an employee whose exemption doesn\'t match any batch' }}
          </div>
        </div>
      </div>

      <!-- Employee selection — only shown when adding new, not editing -->
      <div v-if="!customStandardWeekDialog.isEditing" class="cm-field mb-3">
        <label class="cm-label">Employee <span class="cm-required">*</span></label>

        <VTextField
          v-if="!customStandardWeekDialog.empId"
          v-model="customStandardWeekDialog.employeeSearch"
          placeholder="Search by name"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
        />

        <VCard v-else variant="tonal" color="indigo" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-2 pa-3">
            <VIcon icon="mdi-account" size="18" />
            <span class="text-body-2 font-weight-medium">{{ customStandardWeekDialog.empName }}</span>
            <VSpacer />
            <VBtn size="x-small" variant="text" @click="customStandardWeekDialog.empId = null; customStandardWeekDialog.empName = ''">
              Change
            </VBtn>
          </VCardText>
        </VCard>

        <div v-if="!customStandardWeekDialog.empId" style="max-height: 220px; overflow-y: auto;" class="mt-2">
          <VSkeletonLoader v-if="customStandardWeekDialog.loadingEmployees" type="list-item-two-line, list-item-two-line" />
          <VList v-else density="compact">
            <VListItem
              v-for="emp in filteredCustomStandardWeekEmployees"
              :key="emp.emp_id"
              @click="selectCustomStandardWeekEmployee(emp)"
            >
              <VListItemTitle>{{ emp.name }}</VListItemTitle>
              <VListItemSubtitle>{{ emp.position }} · {{ emp.division_name ?? '—' }}</VListItemSubtitle>
            </VListItem>
            <p v-if="filteredCustomStandardWeekEmployees.length === 0" class="text-caption text-medium-emphasis pa-2 mb-0">
              No matching employees.
            </p>
          </VList>
        </div>
      </div>

      <!-- Read-only employee name when editing -->
      <div v-else class="cm-field mb-3">
        <label class="cm-label">Employee</label>
        <VCard variant="tonal" color="grey" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-2 pa-3">
            <VIcon icon="mdi-account" size="18" />
            <span class="text-body-2 font-weight-medium">{{ customStandardWeekDialog.empName }}</span>
          </VCardText>
        </VCard>
      </div>

     <div class="cm-field mb-3">
      <label class="cm-label">Standard Weeks <span class="cm-required">*</span></label>
      <StandardWeekSelector v-model="customStandardWeekDialog.weeks" color="indigo" />
    </div>

      <VAlert v-if="customStandardWeekDialog.error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ customStandardWeekDialog.error }}
      </VAlert>
    </VCardText>

    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" :disabled="customStandardWeekDialog.loading" @click="closeCustomStandardWeekDialog">
        Cancel
      </VBtn>
      <VBtn
        color="indigo"
        variant="tonal"
        :loading="customStandardWeekDialog.loading"
        :prepend-icon="customStandardWeekDialog.isEditing ? 'mdi-content-save-outline' : 'mdi-calendar-plus'"
        @click="submitCustomStandardWeek"
      >
        {{ customStandardWeekDialog.isEditing ? 'Save Changes' : 'Add Exemption' }}
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
import StandardWeekSelector from '@/components/payroll/StandardWeekSelector.vue'
import {
  formatDisplayDate,
  toISODate,
  usePayrollCalendar,
  type ContractBreakBatch,
  type ContractBreakEmployeePickerRow,
  type EmployeeContractBreak,
  type EmployeeStandardWeekExemption,
  type Holiday,
  type HolidayType,
  type StandardWeekBatch,
  type SuspensionDay
} from '@/composable/usePayrollCalendar'
import axios from '@axios'
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
  contractBreakBatches,
  fetchStandardWeekBatchWeeks,
  fetchContractBreakBatches,
  addContractBreakBatch,
  updateContractBreakBatch,
  removeContractBreakBatch,
  fetchBatchEmployees,
  assignEmployeesToBatch,
  unassignEmployeeBreak,
  addCustomContractBreak,
  updateCustomContractBreak,
  fetchContractBreakEmployeePicker,
  standardWeekBatches,
  fetchStandardWeekBatches,
  addStandardWeekBatch,
  updateStandardWeekBatch,
  removeStandardWeekBatch,
  fetchStandardWeekBatchEmployees,
  assignEmployeesToStandardWeekBatch,
  unassignStandardWeekExemption,
  fetchCustomStandardWeekExemptionWeeks,
  syncCustomStandardWeekExemption,
  fetchStandardWeekEmployeePicker,
  customContractBreaks,
  fetchCustomContractBreaks,
  customStandardWeekExemptions,
  fetchCustomStandardWeekExemptions,
  clearCustomStandardWeekExemption,
} = usePayrollCalendar()

const contractBreakBatchesForYear = computed(() =>
  contractBreakBatches.value.filter(b => new Date(b.start_date).getFullYear() === viewYear.value)
)
const standardWeekBatchesForYear = computed(() =>
  standardWeekBatches.value.filter(b => new Date(b.start_date).getFullYear() === viewYear.value)
)

const customContractBreaksForYear = computed(() =>
  customContractBreaks.value.filter(b => b.start_date && new Date(b.start_date).getFullYear() === viewYear.value)
)
const customStandardWeekExemptionsForYear = computed(() =>
  customStandardWeekExemptions.value.filter(e => new Date(e.earliest_week).getFullYear() === viewYear.value)
)

// ---------------------------------------------------------------------------
// Week Schedules
// ---------------------------------------------------------------------------

function formatBatchRange(start: string, end: string): string {
  return start === end ? formatDisplayDate(start) : `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`
}

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

onMounted(() => {
  fetchContractBreakBatches()
  fetchStandardWeekBatches()
  fetchCustomContractBreaks()
  fetchCustomStandardWeekExemptions()
})

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
// Half-day helper
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
// ---------------------------------------------------------------------------
const summary = computed(() => {
   const base = getMonthSummary(viewYear.value, viewMonth.value)
   let workingDays = 0

   for (const week of calendarWeeks.value) {
     for (const cell of week.cells) {
       if (!cell.date) continue
       const dow = cell.date.getDay()
       const isWorkSlot = dow >= 1 && dow <= 5
       if (!isWorkSlot) continue

       if (!cell.info.suspension) {
         workingDays += 1
       } else if (cell.info.suspension.is_half_day) {
         workingDays += 0.5
       }
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
// Contract Break Batch dialog
// ---------------------------------------------------------------------------
const batchDialog = reactive({
  visible: false,
  editId: null as number | null,
  label: '',
  startDate: '',
  endDate: '',
  resumptionDate: '',
  notes: '',
  error: '',
  loading: false,
})

function openBatchDialog(batch?: ContractBreakBatch) {
  batchDialog.editId         = batch?.id ?? null
  batchDialog.label          = batch?.label ?? ''
  batchDialog.startDate      = batch?.start_date ?? ''
  batchDialog.endDate        = batch?.end_date ?? ''
  batchDialog.resumptionDate = batch?.resumption_date ?? ''
  batchDialog.notes          = batch?.notes ?? ''
  batchDialog.error          = ''
  batchDialog.loading        = false
  batchDialog.visible        = true
}

function closeBatchDialog() { batchDialog.visible = false }

async function submitBatch() {
  batchDialog.error = ''
  if (!batchDialog.label.trim())   { batchDialog.error = 'Please enter a label.'; return }
  if (!batchDialog.startDate)      { batchDialog.error = 'Please select a start date.'; return }
  if (!batchDialog.endDate)        { batchDialog.error = 'Please select an end date.'; return }
  if (!batchDialog.resumptionDate) { batchDialog.error = 'Please select a resumption date.'; return }
  if (batchDialog.resumptionDate <= batchDialog.endDate) {
    batchDialog.error = 'Resumption date must be after the end date.'
    return
  }

  batchDialog.loading = true
  const result = batchDialog.editId
    ? await updateContractBreakBatch(batchDialog.editId, batchDialog.label, batchDialog.startDate, batchDialog.endDate, batchDialog.resumptionDate, batchDialog.notes)
    : await addContractBreakBatch(batchDialog.label, batchDialog.startDate, batchDialog.endDate, batchDialog.resumptionDate, batchDialog.notes)

  batchDialog.loading = false
  if (result === true) {
    closeBatchDialog()
    showToast(batchDialog.editId ? 'Batch updated.' : 'Batch created.')
  } else {
    batchDialog.error = result
  }
}

async function handleRemoveBatch(id: number) {
  const result = await removeContractBreakBatch(id)
  if (result === true) {
    showToast('Batch deleted.')
  } else {
    showToast(result, 'error')
  }
}

// ---------------------------------------------------------------------------
// Batch Detail dialog (Contract Break — employee assignment list)
// ---------------------------------------------------------------------------
const batchDetailDialog = reactive({
  visible: false,
  batch: null as ContractBreakBatch | null,
  assignedEmployees: [] as EmployeeContractBreak[],
  loadingAssigned: false,
  selected: [] as number[],         
  removing: false,
})

async function openBatchDetail(batch: ContractBreakBatch) {
  batchDetailDialog.batch   = batch
  batchDetailDialog.visible = true
  batchDetailDialog.selected = [] 
  batchDetailDialog.loadingAssigned = true
  batchDetailDialog.assignedEmployees = await fetchBatchEmployees(batch.id)
  batchDetailDialog.loadingAssigned = false
}

function closeBatchDetail() {
  batchDetailDialog.visible = false
  batchDetailDialog.selected = []        
}

async function handleUnassign(assignment: EmployeeContractBreak) {
  const result = await unassignEmployeeBreak(assignment.id)
  if (result === true) {
    batchDetailDialog.assignedEmployees = batchDetailDialog.assignedEmployees.filter(a => a.id !== assignment.id)
    if (batchDetailDialog.batch) {
      const idx = contractBreakBatches.value.findIndex(b => b.id === batchDetailDialog.batch!.id)
      if (idx !== -1) contractBreakBatches.value[idx].employee_breaks_count = batchDetailDialog.assignedEmployees.length
    }
    showToast('Employee removed from batch.')
  } else {
    showToast(result, 'error')
  }
}
const allBatchDetailChecked = computed(() =>
  batchDetailDialog.assignedEmployees.length > 0 &&
  batchDetailDialog.assignedEmployees.every(a => batchDetailDialog.selected.includes(a.id))
)
const someBatchDetailChecked = computed(() =>
  batchDetailDialog.assignedEmployees.some(a => batchDetailDialog.selected.includes(a.id)) &&
  !allBatchDetailChecked.value
)

function toggleSelectAllBatchDetail() {
  batchDetailDialog.selected = allBatchDetailChecked.value
    ? []
    : batchDetailDialog.assignedEmployees.map(a => a.id)
}

async function handleRemoveSelectedBatchDetail() {
  if (batchDetailDialog.selected.length === 0) return
  batchDetailDialog.removing = true

  const results = await Promise.all(
    batchDetailDialog.selected.map(id => unassignEmployeeBreak(id))
  )

  const failed = results.filter(r => r !== true).length
  const removedIds = batchDetailDialog.selected.filter((_, i) => results[i] === true)

  batchDetailDialog.assignedEmployees = batchDetailDialog.assignedEmployees.filter(
    a => !removedIds.includes(a.id)
  )
  if (batchDetailDialog.batch) {
    const idx = contractBreakBatches.value.findIndex(b => b.id === batchDetailDialog.batch!.id)
    if (idx !== -1) contractBreakBatches.value[idx].employee_breaks_count = batchDetailDialog.assignedEmployees.length
  }
  batchDetailDialog.selected = []
  batchDetailDialog.removing = false

  showToast(
    failed > 0
      ? `${removedIds.length} removed, ${failed} failed.`
      : `${removedIds.length} employee(s) removed.`,
    failed > 0 ? 'error' : 'success'
  )
}

// ---------------------------------------------------------------------------
// Employee Picker dialog (Contract Break — assign to batch)
// ---------------------------------------------------------------------------
const employeePickerDialog = reactive({
  visible: false,
  batchId: null as number | null,
  search: '',
  employees: [] as ContractBreakEmployeePickerRow[],
  selected: [] as number[],
  loading: false,
  assigning: false,
})

const employeePickerDivisionFilter = ref<string | null>(null)
const employeePickerSectionFilter  = ref<string | null>(null)

watch(employeePickerDivisionFilter, () => {
  employeePickerSectionFilter.value = null
})

async function openEmployeePicker(batchId: number) {
  employeePickerDialog.batchId   = batchId
  employeePickerDialog.search    = ''
  employeePickerDialog.selected  = []
  employeePickerDialog.visible   = true
  employeePickerDialog.loading   = true
  employeePickerDivisionFilter.value = null
  employeePickerSectionFilter.value  = null
  employeePickerDialog.employees = await fetchContractBreakEmployeePicker(batchId)
  employeePickerDialog.loading   = false
}

const filteredPickerEmployees = computed(() => {
  const q = employeePickerDialog.search.trim().toLowerCase()
  let base = employeePickerDialog.employees.filter(e => !e.already_assigned)

  if (employeePickerDivisionFilter.value) {
    base = base.filter(e => e.division_name === employeePickerDivisionFilter.value)
  }
  if (employeePickerSectionFilter.value) {
    base = base.filter(e => e.section_name === employeePickerSectionFilter.value)
  }
  if (!q) return base
  return base.filter(e => e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q))
})
const employeePickerDivisionOptions = computed(() => {
  const divisions = new Set(employeePickerDialog.employees.map(e => e.division_name).filter(Boolean))
  return Array.from(divisions).sort() as string[]
})

const employeePickerSectionOptions = computed(() => {
  const relevant = employeePickerDivisionFilter.value
    ? employeePickerDialog.employees.filter(e => e.division_name === employeePickerDivisionFilter.value)
    : employeePickerDialog.employees
  const sections = new Set(relevant.map(e => e.section_name).filter(Boolean))
  return Array.from(sections).sort() as string[]
})

const allFilteredChecked = computed(() =>
  filteredPickerEmployees.value.length > 0 &&
  filteredPickerEmployees.value.every(e => employeePickerDialog.selected.includes(e.emp_id))
)
const someFilteredChecked = computed(() =>
  filteredPickerEmployees.value.some(e => employeePickerDialog.selected.includes(e.emp_id)) &&
  !allFilteredChecked.value
)

function toggleSelectAllFiltered() {
  const filteredIds = filteredPickerEmployees.value.map(e => e.emp_id)
  if (allFilteredChecked.value) {
    employeePickerDialog.selected = employeePickerDialog.selected.filter(id => !filteredIds.includes(id))
  } else {
    const merged = new Set(employeePickerDialog.selected)
    filteredIds.forEach(id => merged.add(id))
    employeePickerDialog.selected = Array.from(merged)
  }
}

async function confirmAssignment() {
  if (!employeePickerDialog.batchId || employeePickerDialog.selected.length === 0) return
  employeePickerDialog.assigning = true
  const result = await assignEmployeesToBatch(employeePickerDialog.batchId, employeePickerDialog.selected)
  employeePickerDialog.assigning = false

  if (result.success) {
    employeePickerDialog.visible = false
    showToast(result.message)
    if (batchDetailDialog.batch?.id === employeePickerDialog.batchId) {
      batchDetailDialog.assignedEmployees = await fetchBatchEmployees(employeePickerDialog.batchId)
    }
  } else {
    showToast(result.message, 'error')
  }
}

// ---------------------------------------------------------------------------
// Custom / Individual Contract Break dialog
// ---------------------------------------------------------------------------
const customBreakDialog = reactive({
  visible: false,
  editId: null as number | null,
  empId: null as number | null,
  empName: '',
  startDate: '',
  endDate: '',
  resumptionDate: '',
  error: '',
  loading: false,
  employeeSearch: '',
  employees: [] as ContractBreakEmployeePickerRow[],
  loadingEmployees: false,
})

async function openCustomBreakDialog(existing?: EmployeeContractBreak) {
  customBreakDialog.editId          = existing?.id ?? null
  customBreakDialog.empId           = existing?.emp_id ?? null
  customBreakDialog.empName         = existing?.emp_name ?? ''
  customBreakDialog.startDate       = existing?.start_date ?? ''
  customBreakDialog.endDate         = existing?.end_date ?? ''
  customBreakDialog.resumptionDate  = existing?.resumption_date ?? ''
  customBreakDialog.error           = ''
  customBreakDialog.loading         = false
  customBreakDialog.employeeSearch  = ''
  customBreakDialog.visible         = true

  if (!existing) {
    customBreakDialog.loadingEmployees = true
    customBreakDialog.employees = await fetchContractBreakEmployeePicker()
    customBreakDialog.loadingEmployees = false
  }
}

function closeCustomBreakDialog() { customBreakDialog.visible = false }

const filteredCustomEmployees = computed(() => {
  const q = customBreakDialog.employeeSearch.trim().toLowerCase()
  if (!q) return customBreakDialog.employees
  return customBreakDialog.employees.filter(e => e.name.toLowerCase().includes(q))
})

function selectCustomEmployee(emp: ContractBreakEmployeePickerRow) {
  customBreakDialog.empId   = emp.emp_id
  customBreakDialog.empName = emp.name
}

async function submitCustomBreak() {
  customBreakDialog.error = ''
  if (!customBreakDialog.empId)          { customBreakDialog.error = 'Please select an employee.'; return }
  if (!customBreakDialog.startDate)      { customBreakDialog.error = 'Please select a start date.'; return }
  if (!customBreakDialog.endDate)        { customBreakDialog.error = 'Please select an end date.'; return }
  if (!customBreakDialog.resumptionDate) { customBreakDialog.error = 'Please select a resumption date.'; return }
  if (customBreakDialog.resumptionDate <= customBreakDialog.endDate) {
    customBreakDialog.error = 'Resumption date must be after the end date.'
    return
  }

  customBreakDialog.loading = true
  const result = customBreakDialog.editId
    ? await updateCustomContractBreak(customBreakDialog.editId, customBreakDialog.startDate, customBreakDialog.endDate, customBreakDialog.resumptionDate)
    : await addCustomContractBreak(customBreakDialog.empId, customBreakDialog.startDate, customBreakDialog.endDate, customBreakDialog.resumptionDate)

  customBreakDialog.loading = false
  if (result === true) {
    closeCustomBreakDialog()
    showToast(customBreakDialog.editId ? 'Custom break updated.' : 'Custom break added.')
    fetchCustomContractBreaks()   // ← ADD THIS
  } else {
    customBreakDialog.error = result
  }
}

async function handleRemoveCustomBreak(id: number) {
  const result = await unassignEmployeeBreak(id)
  if (result === true) {
    const idx = customContractBreaks.value.findIndex(b => b.id === id)
    if (idx !== -1) customContractBreaks.value.splice(idx, 1)
    showToast('Individual contract break removed.')
  } else {
    showToast(result, 'error')
  }
}

// ---------------------------------------------------------------------------
// Standard Week Batch dialog
// ---------------------------------------------------------------------------
const standardWeekBatchDialog = reactive({
  visible: false,
  editId: null as number | null,
  label: '',
  weeks: [] as string[],
  notes: '',
  error: '',
  loading: false,
})

async function openStandardWeekBatchDialog(batch?: StandardWeekBatch) {
  standardWeekBatchDialog.editId    = batch?.id ?? null
  standardWeekBatchDialog.label     = batch?.label ?? ''
  standardWeekBatchDialog.notes     = batch?.notes ?? ''
  standardWeekBatchDialog.error     = ''
  standardWeekBatchDialog.loading   = false
  standardWeekBatchDialog.visible   = true
  standardWeekBatchDialog.weeks     = batch ? await fetchStandardWeekBatchWeeks(batch.id) : []
}

function closeStandardWeekBatchDialog() { standardWeekBatchDialog.visible = false }

async function submitStandardWeekBatch() {
  standardWeekBatchDialog.error = ''
  if (!standardWeekBatchDialog.label.trim())      { standardWeekBatchDialog.error = 'Please enter a label.'; return }
  if (standardWeekBatchDialog.weeks.length === 0) { standardWeekBatchDialog.error = 'Please select at least one week.'; return }

  standardWeekBatchDialog.loading = true
  const result = standardWeekBatchDialog.editId
    ? await updateStandardWeekBatch(standardWeekBatchDialog.editId, standardWeekBatchDialog.label, standardWeekBatchDialog.weeks, standardWeekBatchDialog.notes)
    : await addStandardWeekBatch(standardWeekBatchDialog.label, standardWeekBatchDialog.weeks, standardWeekBatchDialog.notes)

  standardWeekBatchDialog.loading = false
  if (result === true) {
    closeStandardWeekBatchDialog()
    showToast(standardWeekBatchDialog.editId ? 'Batch updated.' : 'Batch created.')
  } else {
    standardWeekBatchDialog.error = result
  }
}

async function handleRemoveStandardWeekBatch(id: number) {
  const result = await removeStandardWeekBatch(id)
  if (result === true) showToast('Batch deleted.')
  else showToast(result, 'error')
}

// ---------------------------------------------------------------------------
// Standard Week Batch Detail dialog (employee assignment list)
// ---------------------------------------------------------------------------
const standardWeekBatchDetailDialog = reactive({
  visible: false,
  batch: null as StandardWeekBatch | null,
  assignedEmployees: [] as EmployeeStandardWeekExemption[],
  loadingAssigned: false,
  selected: [] as number[],         
  removing: false,
})

async function openStandardWeekBatchDetail(batch: StandardWeekBatch) {
  standardWeekBatchDetailDialog.batch   = batch
  standardWeekBatchDetailDialog.visible = true
  standardWeekBatchDetailDialog.selected = [] 
  standardWeekBatchDetailDialog.loadingAssigned = true
  standardWeekBatchDetailDialog.assignedEmployees = await fetchStandardWeekBatchEmployees(batch.id)
  standardWeekBatchDetailDialog.loadingAssigned = false
}

function closeStandardWeekBatchDetail() {
  standardWeekBatchDetailDialog.visible = false
  standardWeekBatchDetailDialog.selected = []          // ← ADD THIS
}

async function handleUnassignStandardWeek(exemption: EmployeeStandardWeekExemption) {
  const result = await unassignStandardWeekExemption(exemption.id)
  if (result === true) {
    standardWeekBatchDetailDialog.assignedEmployees =
      standardWeekBatchDetailDialog.assignedEmployees.filter(
        (a: EmployeeStandardWeekExemption) => a.id !== exemption.id   // ← explicit type added
      )
    if (standardWeekBatchDetailDialog.batch) {
      const idx = standardWeekBatches.value.findIndex(
        (b: StandardWeekBatch) => b.id === standardWeekBatchDetailDialog.batch!.id  // ← explicit type added too, for consistency
      )
      if (idx !== -1) standardWeekBatches.value[idx].employee_exemptions_count = standardWeekBatchDetailDialog.assignedEmployees.length
    }
    showToast('Employee removed from batch.')
  } else {
    showToast(result, 'error')
  }
}

const allStandardWeekDetailChecked = computed(() =>
  standardWeekBatchDetailDialog.assignedEmployees.length > 0 &&
  standardWeekBatchDetailDialog.assignedEmployees.every(a => standardWeekBatchDetailDialog.selected.includes(a.id))
)
const someStandardWeekDetailChecked = computed(() =>
  standardWeekBatchDetailDialog.assignedEmployees.some(a => standardWeekBatchDetailDialog.selected.includes(a.id)) &&
  !allStandardWeekDetailChecked.value
)

function toggleSelectAllStandardWeekDetail() {
  standardWeekBatchDetailDialog.selected = allStandardWeekDetailChecked.value
    ? []
    : standardWeekBatchDetailDialog.assignedEmployees.map(a => a.id)
}

async function handleRemoveSelectedStandardWeekDetail() {
  if (standardWeekBatchDetailDialog.selected.length === 0) return
  standardWeekBatchDetailDialog.removing = true

  const results = await Promise.all(
    standardWeekBatchDetailDialog.selected.map(id => unassignStandardWeekExemption(id))
  )

  const failed = results.filter(r => r !== true).length
  const removedIds = standardWeekBatchDetailDialog.selected.filter((_, i) => results[i] === true)

  standardWeekBatchDetailDialog.assignedEmployees = standardWeekBatchDetailDialog.assignedEmployees.filter(
    a => !removedIds.includes(a.id)
  )
  if (standardWeekBatchDetailDialog.batch) {
    const idx = standardWeekBatches.value.findIndex(b => b.id === standardWeekBatchDetailDialog.batch!.id)
    if (idx !== -1) standardWeekBatches.value[idx].employee_exemptions_count = standardWeekBatchDetailDialog.assignedEmployees.length
  }
  standardWeekBatchDetailDialog.selected = []
  standardWeekBatchDetailDialog.removing = false

  showToast(
    failed > 0
      ? `${removedIds.length} removed, ${failed} failed.`
      : `${removedIds.length} employee(s) removed.`,
    failed > 0 ? 'error' : 'success'
  )
}

// ---------------------------------------------------------------------------
// Standard Week Employee Picker dialog (assign to batch)
// ---------------------------------------------------------------------------
const standardWeekEmployeePickerDialog = reactive({
  visible: false,
  batchId: null as number | null,
  search: '',
  employees: [] as ContractBreakEmployeePickerRow[],
  selected: [] as number[],
  loading: false,
  assigning: false,
})

const standardWeekPickerDivisionFilter = ref<string | null>(null)
const standardWeekPickerSectionFilter  = ref<string | null>(null)

watch(standardWeekPickerDivisionFilter, () => {
  standardWeekPickerSectionFilter.value = null
})


async function openStandardWeekEmployeePicker(batchId: number) {
  standardWeekEmployeePickerDialog.batchId   = batchId
  standardWeekEmployeePickerDialog.search    = ''
  standardWeekEmployeePickerDialog.selected  = []
  standardWeekEmployeePickerDialog.visible   = true
  standardWeekEmployeePickerDialog.loading   = true
  standardWeekPickerDivisionFilter.value = null
  standardWeekPickerSectionFilter.value  = null
  standardWeekEmployeePickerDialog.employees = await fetchStandardWeekEmployeePicker(batchId)
  standardWeekEmployeePickerDialog.loading   = false
}

const filteredStandardWeekPickerEmployees = computed(() => {
  const q = standardWeekEmployeePickerDialog.search.trim().toLowerCase()
  let base = standardWeekEmployeePickerDialog.employees.filter(e => !e.already_assigned)

  if (standardWeekPickerDivisionFilter.value) {
    base = base.filter(e => e.division_name === standardWeekPickerDivisionFilter.value)
  }
  if (standardWeekPickerSectionFilter.value) {
    base = base.filter(e => e.section_name === standardWeekPickerSectionFilter.value)
  }
  if (!q) return base
  return base.filter(e => e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q))
})

const standardWeekPickerDivisionOptions = computed(() => {
  const divisions = new Set(standardWeekEmployeePickerDialog.employees.map(e => e.division_name).filter(Boolean))
  return Array.from(divisions).sort() as string[]
})

const standardWeekPickerSectionOptions = computed(() => {
  const relevant = standardWeekPickerDivisionFilter.value
    ? standardWeekEmployeePickerDialog.employees.filter(e => e.division_name === standardWeekPickerDivisionFilter.value)
    : standardWeekEmployeePickerDialog.employees
  const sections = new Set(relevant.map(e => e.section_name).filter(Boolean))
  return Array.from(sections).sort() as string[]
})

const allStandardWeekFilteredChecked = computed(() =>
  filteredStandardWeekPickerEmployees.value.length > 0 &&
  filteredStandardWeekPickerEmployees.value.every(e => standardWeekEmployeePickerDialog.selected.includes(e.emp_id))
)
const someStandardWeekFilteredChecked = computed(() =>
  filteredStandardWeekPickerEmployees.value.some(e => standardWeekEmployeePickerDialog.selected.includes(e.emp_id)) &&
  !allStandardWeekFilteredChecked.value
)

function toggleSelectAllStandardWeekFiltered() {
  const filteredIds = filteredStandardWeekPickerEmployees.value.map(e => e.emp_id)
  if (allStandardWeekFilteredChecked.value) {
    standardWeekEmployeePickerDialog.selected = standardWeekEmployeePickerDialog.selected.filter(id => !filteredIds.includes(id))
  } else {
    const merged = new Set(standardWeekEmployeePickerDialog.selected)
    filteredIds.forEach(id => merged.add(id))
    standardWeekEmployeePickerDialog.selected = Array.from(merged)
  }
}

async function confirmStandardWeekAssignment() {
  if (!standardWeekEmployeePickerDialog.batchId || standardWeekEmployeePickerDialog.selected.length === 0) return
  standardWeekEmployeePickerDialog.assigning = true
  const result = await assignEmployeesToStandardWeekBatch(
    standardWeekEmployeePickerDialog.batchId,
    standardWeekEmployeePickerDialog.selected
  )
  standardWeekEmployeePickerDialog.assigning = false

  if (result.success) {
    standardWeekEmployeePickerDialog.visible = false
    showToast(result.message)
    if (standardWeekBatchDetailDialog.batch?.id === standardWeekEmployeePickerDialog.batchId) {
      standardWeekBatchDetailDialog.assignedEmployees =
        await fetchStandardWeekBatchEmployees(standardWeekEmployeePickerDialog.batchId)
    }
  } else {
    showToast(result.message, 'error')
  }
}

// ---------------------------------------------------------------------------
// Custom / Individual Standard Week dialog
// ---------------------------------------------------------------------------
const customStandardWeekDialog = reactive({
  visible: false,
  isEditing: false,
  empId: null as number | null,
  empName: '',
  weeks: [] as string[],
  error: '',
  loading: false,
  employeeSearch: '',
  employees: [] as ContractBreakEmployeePickerRow[],
  loadingEmployees: false,
})

async function openCustomStandardWeekDialog(emp?: { emp_id: number; name: string }) {
  customStandardWeekDialog.isEditing      = !!emp
  customStandardWeekDialog.empId          = emp?.emp_id ?? null
  customStandardWeekDialog.empName        = emp?.name ?? ''
  customStandardWeekDialog.weeks          = []
  customStandardWeekDialog.error          = ''
  customStandardWeekDialog.loading        = false
  customStandardWeekDialog.employeeSearch = ''
  customStandardWeekDialog.visible        = true

  if (emp) {
    customStandardWeekDialog.weeks = await fetchCustomStandardWeekExemptionWeeks(emp.emp_id)
  } else {
    customStandardWeekDialog.loadingEmployees = true
    customStandardWeekDialog.employees = await fetchStandardWeekEmployeePicker()
    customStandardWeekDialog.loadingEmployees = false
  }
}


function closeCustomStandardWeekDialog() { customStandardWeekDialog.visible = false }

const filteredCustomStandardWeekEmployees = computed(() => {
  const q = customStandardWeekDialog.employeeSearch.trim().toLowerCase()
  const base = customStandardWeekDialog.employees.filter(e => !e.already_assigned)
  if (!q) return base
  return base.filter(e => e.name.toLowerCase().includes(q))
})

async function selectCustomStandardWeekEmployee(emp: ContractBreakEmployeePickerRow) {
  customStandardWeekDialog.empId   = emp.emp_id
  customStandardWeekDialog.empName = emp.name
  customStandardWeekDialog.weeks   = await fetchCustomStandardWeekExemptionWeeks(emp.emp_id)
}

async function submitCustomStandardWeek() {
  customStandardWeekDialog.error = ''
  if (!customStandardWeekDialog.empId)          { customStandardWeekDialog.error = 'Please select an employee.'; return }
  if (customStandardWeekDialog.weeks.length === 0) { customStandardWeekDialog.error = 'Please select at least one week.'; return }

  customStandardWeekDialog.loading = true
  const result = await syncCustomStandardWeekExemption(customStandardWeekDialog.empId, customStandardWeekDialog.weeks)

  customStandardWeekDialog.loading = false
  if (result === true) {
    closeCustomStandardWeekDialog()
    showToast('Exemption updated.')
    fetchCustomStandardWeekExemptions() 
  } else {
    customStandardWeekDialog.error = result
  }
}

async function handleRemoveCustomStandardWeek(empId: number) {
  const result = await clearCustomStandardWeekExemption(empId)
  if (result === true) {
    const idx = customStandardWeekExemptions.value.findIndex(e => e.emp_id === empId)
    if (idx !== -1) customStandardWeekExemptions.value.splice(idx, 1)
    showToast('Individual exemption removed.')
  } else {
    showToast(result, 'error')
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
.cm-cb-item {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
}
.cm-cb-item:last-child { border-bottom: none; }
.cm-cb-item:hover { background: var(--surface-hover); border-radius: 6px; }

.cm-cb-item-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.cm-cb-item-label {
  font-size: 0.85rem;
  color: var(--text-color);
  font-weight: 500;
}

.cm-cb-item-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
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
