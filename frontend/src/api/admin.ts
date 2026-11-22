import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  AdminComment,
  AdminPayment,
  AdminUser,
  AccountStatus,
  RegistrationDetail,
  RegistrationStatus,
  RegistrationSummary,
  Template,
  TemplateInput,
  UserRole,
} from './types'

// Every admin call from build prompt 7.2.

export const adminApi = {
  registrations: (status: RegistrationStatus) => api<RegistrationSummary[]>('/admin/registrations', { query: { status } }),
  registration: (userId: string) => api<RegistrationDetail>(`/admin/registrations/${userId}`),
  approve: (userId: string) => api<void>(`/admin/registrations/${userId}/approve`, { method: 'POST' }),
  reject: (userId: string, note: string) => api<void>(`/admin/registrations/${userId}/reject`, { method: 'POST', json: { note } }),

  users: (role?: UserRole) => api<AdminUser[]>('/admin/users', { query: { role } }),
  updateUser: (id: string, body: { status?: AccountStatus; verified?: boolean }) =>
    api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', json: body }),
  deleteUser: (id: string) => api<void>(`/admin/users/${id}`, { method: 'DELETE' }),

  templates: () => api<Template[]>('/admin/templates'),
  createTemplate: (body: TemplateInput) => api<Template>('/admin/templates', { method: 'POST', json: body }),
  updateTemplate: (id: string, body: Partial<TemplateInput>) => api<Template>(`/admin/templates/${id}`, { method: 'PATCH', json: body }),

  payments: () => api<AdminPayment[]>('/admin/payments'),
  payout: (id: string) => api<AdminPayment>(`/admin/payments/${id}/payout`, { method: 'POST' }),

  hiddenComments: () => api<AdminComment[]>('/admin/comments', { query: { status: 'hidden' } }),
  deleteComment: (id: string) => api<void>(`/admin/comments/${id}`, { method: 'DELETE' }),

  /** GET /files/{document_id}: a short-lived download link (admin or owner) */
  fileLink: (documentId: string) => api<{ url: string | null }>(`/files/${documentId}`),
}

export const aqk = {
  registrations: (status: RegistrationStatus) => ['admin', 'registrations', status] as const,
  registration: (id: string) => ['admin', 'registration', id] as const,
  users: ['admin', 'users'] as const,
  templates: ['admin', 'templates'] as const,
  payments: ['admin', 'payments'] as const,
  comments: ['admin', 'comments'] as const,
}

export const useRegistrations = (status: RegistrationStatus) =>
  useQuery({ queryKey: aqk.registrations(status), queryFn: () => adminApi.registrations(status) })
export const useRegistration = (id: string | null) =>
  useQuery({ queryKey: aqk.registration(id ?? ''), queryFn: () => adminApi.registration(id!), enabled: !!id })
export const useAdminUsers = () => useQuery({ queryKey: aqk.users, queryFn: () => adminApi.users() })
export const useAdminTemplates = () => useQuery({ queryKey: aqk.templates, queryFn: adminApi.templates })
export const useAdminPayments = () => useQuery({ queryKey: aqk.payments, queryFn: adminApi.payments })
export const useHiddenComments = () => useQuery({ queryKey: aqk.comments, queryFn: adminApi.hiddenComments })

/** Runs an admin action, then refreshes every admin list. */
export function useAdminAction<TVars, TOut = unknown>(fn: (vars: TVars) => Promise<TOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}
