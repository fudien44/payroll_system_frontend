import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from '@axios'

// matches the shape of GET /api/payroll
interface Deductions {
    sss: number
    philhealth: number
    pagibig: number
    tax: number
    other: number
}

interface Payslip {
    id: number
    emp_id: number
    period_date: string
    basic_pay: number
    deductions: Deductions
    totalDeductions: number
    net_pay: number
}

export const usePayrollStore = defineStore('payroll', () => {
    const payslips = ref<Payslip[]>([])
    const selectedPayslip = ref<Payslip | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    const latestPayslip = computed(() => payslips.value[0] ?? null)

    const formattedPeriod = computed(() => {
        if (!selectedPayslip.value) return ''
        return new Date(selectedPayslip.value.period_date)
            .toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    })

    async function fetchPayslips() {
        isLoading.value = true
        error.value = null
        try {
            const { data } = await axios.get('/api/payroll') // Adjust endpoint as needed
            payslips.value = data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Failed to fetch payslips'
        } finally {
            isLoading.value = false
        }
    }

    //fetch single payslip by ID
    async function fetchPayslip(id: number) {
        isLoading.value = true
        error.value = null
        try {
            const { data } = await axios.get(`/api/payroll/${id}`) // Adjust endpoint as needed
            selectedPayslip.value = data
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Failed to fetch payslip'
        } finally {
            isLoading.value = false
        }
    }

    function clearPayroll() {
        payslips.value = []
        selectedPayslip.value = null
        error.value = null
    }

    return {
        payslips,
        selectedPayslip,
        isLoading,
        error,
        latestPayslip,
        formattedPeriod,
        fetchPayslips,
        fetchPayslip,
        clearPayroll,
    }
})
