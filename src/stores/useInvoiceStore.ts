import { defineStore } from 'pinia'
import axios from '@axios'

export const useInvoiceStore = defineStore('InvoiceStore', {
  actions: {
    fetchInvoices() {
      return axios.get('/invoices')
    },

    fetchInvoice(invoiceId: string) {
      return axios.get('/invoice', { params: { invoiceId } })
    },

    deleteInvoice(invoiceId: string) {
      return axios.get('/invoice/delete', { params: { invoiceId } })
    },
  },
})
